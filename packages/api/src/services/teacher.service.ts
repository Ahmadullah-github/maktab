/**
 * Teacher Service for business logic operations
 * @module services/teacher
 *
 * Requirements: 3.1
 * - Route handler SHALL delegate business logic to TeacherService class
 */

import { DataSource, EntityManager, In } from 'typeorm';
import {
  TeacherRepository,
  TeacherInput,
  ParsedTeacher,
} from '../database/repositories/teacher.repository';
import { CacheManager } from '../database/cache/cacheManager';
import { runCommittedTransaction } from '../database/transaction';
import { PaginationParams, PaginatedResponse, ServiceResult } from '../types/common.types';
import { TeacherCapabilityService } from './teacherCapability.service';
import { SWAP_CONSTRAINT_CACHE_PREFIX } from './SwapConstraintCache';
import { logger } from '../utils/logger';
import {
  clearDataSourceScopedInstances,
  getDataSourceScopedInstance,
} from '../utils/dataSourceScope';
import {
  SchoolScopeConflictError,
  assertOperationalWriteScope,
} from '../utils/schoolScopeGuard';
import {
  normalizeTeacherName,
  normalizeTeacherStaffCode,
  normalizeUnavailableSlots,
} from '../utils/teacherContracts';
import { Teacher } from '../entity/Teacher';
import { Room } from '../entity/Room';
import { SchoolConfigService } from './schoolConfig.service';
import { safeJsonParse, safeJsonStringify } from '../utils/jsonTransformer';
import type { SchoolConfigDto } from '../types/schoolConfig.types';
import { buildCanonicalPeriodConfiguration } from '../utils/periodConfiguration';

function warnOnDeprecatedTeacherWrite(
  operation: 'create' | 'update' | 'bulkImport',
  input: Partial<TeacherInput>,
  teacherId?: number
): void {
  const deprecatedFields = [
    Array.isArray(input.primarySubjectIds) && input.primarySubjectIds.length > 0
      ? 'primarySubjectIds'
      : null,
    Array.isArray(input.allowedSubjectIds) && input.allowedSubjectIds.length > 0
      ? 'allowedSubjectIds'
      : null,
    Array.isArray(input.classAssignments) && input.classAssignments.length > 0
      ? 'classAssignments'
      : null,
  ].filter((field): field is string => field !== null);

  if (deprecatedFields.length === 0) {
    return;
  }

  logger.warn('TeacherService: Teacher payload still uses deprecated compatibility fields', {
    operation,
    teacherId,
    deprecatedFields,
    replacementDocs: 'docs/ASSIGNMENT_PHASE_0_BASELINE.md',
  });
}

interface TeacherWriteSplitResult {
  baseInput: Partial<TeacherInput>;
  capabilityInput: {
    primarySubjectIds?: number[];
    allowedSubjectIds?: number[];
  };
  hasCapabilityInput: boolean;
  classAssignments?: TeacherInput['classAssignments'];
  hasClassAssignments: boolean;
}

function splitTeacherWriteInput(input: Partial<TeacherInput>): TeacherWriteSplitResult {
  const baseInput: Partial<TeacherInput> = { ...input };
  delete baseInput.primarySubjectIds;
  delete baseInput.allowedSubjectIds;
  delete baseInput.classAssignments;
  // Sparse `unavailable` slots are authoritative. Never persist the retired
  // full availability matrix from write payloads.
  delete baseInput.availability;

  const hasPrimary = Object.prototype.hasOwnProperty.call(input, 'primarySubjectIds');
  const hasAllowed = Object.prototype.hasOwnProperty.call(input, 'allowedSubjectIds');
  const hasClassAssignments = Object.prototype.hasOwnProperty.call(input, 'classAssignments');

  return {
    baseInput,
    capabilityInput: {
      ...(hasPrimary ? { primarySubjectIds: input.primarySubjectIds ?? [] } : {}),
      ...(hasAllowed ? { allowedSubjectIds: input.allowedSubjectIds ?? [] } : {}),
    },
    hasCapabilityInput: hasPrimary || hasAllowed,
    classAssignments: hasClassAssignments ? (input.classAssignments ?? []) : undefined,
    hasClassAssignments,
  };
}

/**
 * TeacherService handles all business logic for Teacher operations
 */
export class TeacherService {
  private dataSource: DataSource;
  private teacherRepository: TeacherRepository;
  private teacherCapabilityService: TeacherCapabilityService;
  private readonly cacheManager: CacheManager;
  private readonly schoolConfigService: SchoolConfigService;

  private constructor(dataSource: DataSource, cacheManager?: CacheManager) {
    this.dataSource = dataSource;
    this.cacheManager = cacheManager ?? CacheManager.getInstance();
    this.teacherRepository = TeacherRepository.getInstance(dataSource, this.cacheManager);
    this.teacherCapabilityService = TeacherCapabilityService.getInstance(
      dataSource,
      this.cacheManager
    );
    this.schoolConfigService = SchoolConfigService.getInstance(dataSource, this.cacheManager);
  }

  static getInstance(dataSource: DataSource, cacheManager?: CacheManager): TeacherService {
    return getDataSourceScopedInstance(
      dataSource,
      TeacherService,
      () => new TeacherService(dataSource, cacheManager)
    );
  }

  static resetInstance(): void {
    clearDataSourceScopedInstances(TeacherService);
  }

  async create(input: TeacherInput): Promise<ServiceResult<ParsedTeacher>> {
    try {
      input = {
        ...input,
        fullName: normalizeTeacherName(input.fullName),
        staffCode: normalizeTeacherStaffCode(input.staffCode),
      };
      input = await this.validateCalendarConstraints(input, input.schoolId ?? null);
      warnOnDeprecatedTeacherWrite('create', input);

      if (!input.fullName || input.fullName.trim() === '') {
        return { success: false, error: 'Teacher name is required' };
      }

      if (!input.staffCode) {
        return { success: false, error: 'Teacher staff code is required', statusCode: 400 };
      }
      const existing = await this.teacherRepository.findByStaffCode(
        input.staffCode,
        input.schoolId ?? null
      );
      if (existing) {
        return {
          success: false,
          error: `Teacher with staff code "${input.staffCode}" already exists`,
          statusCode: 409,
        };
      }
      await assertOperationalWriteScope(this.dataSource, [
        { entity: 'teacher', schoolId: input.schoolId ?? null },
      ]);

      const splitInput = splitTeacherWriteInput(input);
      let teacher: ParsedTeacher | null = null;

      await runCommittedTransaction(
        this.dataSource,
        this.cacheManager,
        async (manager: EntityManager) => {
          teacher = await this.teacherRepository.saveTeacher(splitInput.baseInput as TeacherInput, {
            manager,
            skipCache: true,
          });

          if (!teacher) {
            throw new Error('Failed to create teacher');
          }
          await this.validatePreferenceReferences(input, teacher.schoolId, teacher.id, manager);

          if (splitInput.hasCapabilityInput) {
            await this.teacherCapabilityService.syncTeacherCapabilities(
              teacher.id,
              splitInput.capabilityInput,
              { manager }
            );
          }


          teacher = await this.teacherRepository.getTeacher(teacher.id, {
            manager,
            skipCache: true,
          });
        }
      );

      if (!teacher) {
        return { success: false, error: 'Failed to create teacher' };
      }

      const createdTeacher = teacher as ParsedTeacher;
      logger.info('TeacherService: Created teacher', {
        id: createdTeacher.id,
        name: createdTeacher.fullName,
      });
      this.invalidateSwapConstraints();
      return { success: true, data: createdTeacher };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('TeacherService: Failed to create teacher', error);
      return error instanceof SchoolScopeConflictError
        ? { success: false, error: error.message, statusCode: 409, code: error.code, details: error.details }
        : { success: false, error: error.message };
    }
  }

  async update(id: number, input: Partial<TeacherInput>): Promise<ServiceResult<ParsedTeacher>> {
    try {
      input = {
        ...input,
        ...(input.fullName === undefined ? {} : { fullName: normalizeTeacherName(input.fullName) }),
        ...(input.staffCode === undefined
          ? {}
          : { staffCode: normalizeTeacherStaffCode(input.staffCode) }),
      };
      warnOnDeprecatedTeacherWrite('update', input, id);

      if (input.fullName !== undefined && input.fullName.trim() === '') {
        return { success: false, error: 'Teacher name cannot be empty' };
      }

      const existing = await this.teacherRepository.getTeacher(id);
      if (!existing) {
        return { success: false, error: `Teacher with ID ${id} not found` };
      }
      const targetSchoolId = input.schoolId === undefined ? existing.schoolId : input.schoolId;
      input = await this.validateCalendarConstraints(input, targetSchoolId);

      if (input.staffCode && input.staffCode !== existing.staffCode) {
        const duplicate = await this.teacherRepository.findByStaffCode(
          input.staffCode,
          input.schoolId === undefined ? existing.schoolId : (input.schoolId ?? null)
        );
        if (duplicate && duplicate.id !== id) {
          return {
            success: false,
            error: `Teacher with staff code "${input.staffCode}" already exists`,
            statusCode: 409,
          };
        }
      }
      await assertOperationalWriteScope(this.dataSource, [
        {
          entity: 'teacher',
          id,
          schoolId: input.schoolId === undefined ? existing.schoolId : input.schoolId,
        },
      ]);

      const splitInput = splitTeacherWriteInput(input);
      let teacher: ParsedTeacher | null = null;

      await runCommittedTransaction(
        this.dataSource,
        this.cacheManager,
        async (manager: EntityManager) => {
          await this.validatePreferenceReferences(input, targetSchoolId, id, manager);
          teacher = await this.teacherRepository.updateTeacher(id, splitInput.baseInput, {
            manager,
            skipCache: true,
          });
          if (!teacher) {
            throw new Error(`Failed to update teacher with ID ${id}`);
          }

          if (splitInput.hasCapabilityInput) {
            await this.teacherCapabilityService.syncTeacherCapabilities(
              id,
              splitInput.capabilityInput,
              { manager }
            );
          }


          teacher = await this.teacherRepository.getTeacher(id, {
            manager,
            skipCache: true,
          });
        }
      );

      if (!teacher) {
        return { success: false, error: `Failed to update teacher with ID ${id}` };
      }

      logger.info('TeacherService: Updated teacher', { id });
      this.invalidateSwapConstraints();
      return { success: true, data: teacher };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('TeacherService: Failed to update teacher', error, { id });
      return error instanceof SchoolScopeConflictError
        ? { success: false, error: error.message, statusCode: 409, code: error.code, details: error.details }
        : { success: false, error: error.message };
    }
  }

  async delete(id: number): Promise<ServiceResult<boolean>> {
    try {
      const existing = await this.teacherRepository.getTeacher(id);
      if (!existing) {
        return { success: false, error: `Teacher with ID ${id} not found` };
      }

      let deleted = false;
      await runCommittedTransaction(
        this.dataSource,
        this.cacheManager,
        async (manager: EntityManager) => {
          const count = await this.deleteTeachersInsideTransaction([existing], manager);
          deleted = count === 1;
        }
      );

      if (!deleted) {
        return { success: false, error: `Failed to delete teacher with ID ${id}` };
      }

      logger.info('TeacherService: Deleted teacher', { id });
      this.invalidateSwapConstraints();
      return { success: true, data: true };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('TeacherService: Failed to delete teacher', error, { id });
      return { success: false, error: error.message };
    }
  }

  async findById(id: number): Promise<ServiceResult<ParsedTeacher>> {
    try {
      const teacher = await this.teacherRepository.getTeacher(id);
      if (!teacher) {
        return { success: false, error: `Teacher with ID ${id} not found` };
      }
      return { success: true, data: teacher };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('TeacherService: Failed to find teacher', error, { id });
      return { success: false, error: error.message };
    }
  }

  async findAll(
    pagination?: PaginationParams
  ): Promise<ServiceResult<PaginatedResponse<ParsedTeacher>>> {
    try {
      const result = await this.teacherRepository.getAllTeachers(pagination);
      return { success: true, data: result };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('TeacherService: Failed to find all teachers', error);
      return { success: false, error: error.message };
    }
  }

  async findAllUnpaginated(): Promise<ServiceResult<ParsedTeacher[]>> {
    try {
      const teachers = await this.teacherRepository.getAllTeachersUnpaginated();
      return { success: true, data: teachers };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('TeacherService: Failed to find all teachers', error);
      return { success: false, error: error.message };
    }
  }

  async bulkImport(teachersData: TeacherInput[]): Promise<ServiceResult<ParsedTeacher[]>> {
    try {
      teachersData.forEach((teacher) => warnOnDeprecatedTeacherWrite('bulkImport', teacher));

      await assertOperationalWriteScope(
        this.dataSource,
        teachersData.map((teacher) => ({
          entity: 'teacher',
          schoolId: teacher.schoolId ?? null,
        }))
      );

      const schoolIds = [...new Set(teachersData.map((teacher) => teacher.schoolId ?? null))];
      const configsBySchool = new Map<number | null, SchoolConfigDto>(
        await Promise.all(
          schoolIds.map(async (schoolId) => [
            schoolId,
            await this.schoolConfigService.getConfig(schoolId),
          ] as const)
        )
      );
      const normalized = await Promise.all(
        teachersData.map((teacher) => {
          const schoolId = teacher.schoolId ?? null;
          return this.validateCalendarConstraints(
            {
              ...teacher,
              fullName: normalizeTeacherName(teacher.fullName),
              staffCode: normalizeTeacherStaffCode(teacher.staffCode),
            },
            schoolId,
            configsBySchool.get(schoolId)
          );
        })
      );
      const invalidTeachers = normalized.filter(
        (teacher) => !teacher.fullName || !teacher.staffCode
      );
      if (invalidTeachers.length > 0) {
        return {
          success: false,
          error: `${invalidTeachers.length} teacher(s) have an empty name or staff code`,
          statusCode: 400,
        };
      }
      const batchKeys = normalized.map(
        (teacher) => `${teacher.schoolId ?? 'null'}:${teacher.staffCode.toLocaleLowerCase()}`
      );
      if (new Set(batchKeys).size !== batchKeys.length) {
        return { success: false, error: 'Bulk import contains duplicate staff codes', statusCode: 409 };
      }
      for (const teacher of normalized) {
        if (await this.teacherRepository.findByStaffCode(teacher.staffCode, teacher.schoolId ?? null)) {
          return {
            success: false,
            error: `Teacher with staff code "${teacher.staffCode}" already exists`,
            statusCode: 409,
          };
        }
      }

      const teachers: ParsedTeacher[] = [];
      await runCommittedTransaction(this.dataSource, this.cacheManager, async (manager) => {
        for (const teacherData of normalized) {
          const split = splitTeacherWriteInput(teacherData);
          await this.validatePreferenceReferences(
            teacherData,
            teacherData.schoolId ?? null,
            undefined,
            manager
          );
          let teacher = await this.teacherRepository.saveTeacher(split.baseInput as TeacherInput, {
            manager,
            skipCache: true,
          });
          if (split.hasCapabilityInput) {
            await this.teacherCapabilityService.syncTeacherCapabilities(
              teacher.id,
              split.capabilityInput,
              { manager }
            );
          }
          teacher = (await this.teacherRepository.getTeacher(teacher.id, {
            manager,
            skipCache: true,
          })) as ParsedTeacher;
          teachers.push(teacher);
        }
      });
      logger.info('TeacherService: Bulk imported teachers', { count: teachers.length });
      return { success: true, data: teachers };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('TeacherService: Failed to bulk import teachers', error);
      return err instanceof SchoolScopeConflictError
        ? { success: false, error: err.message, statusCode: 409, code: err.code, details: err.details }
        : { success: false, error: error.message };
    }
  }

  async bulkDelete(ids: number[]): Promise<ServiceResult<number>> {
    try {
      if (ids.length === 0) {
        return { success: true, data: 0 };
      }
      const uniqueIds = [...new Set(ids)];
      const existing = (
        await Promise.all(uniqueIds.map((id) => this.teacherRepository.getTeacher(id)))
      ).filter((teacher): teacher is ParsedTeacher => teacher !== null);
      if (existing.length !== uniqueIds.length) {
        return { success: false, error: 'One or more teachers were not found', statusCode: 404 };
      }
      let deleted = 0;
      await runCommittedTransaction(this.dataSource, this.cacheManager, async (manager) => {
        deleted = await this.deleteTeachersInsideTransaction(existing, manager);
      });
      logger.info('TeacherService: Bulk deleted teachers', { count: deleted });
      if (deleted > 0) this.invalidateSwapConstraints();
      return { success: true, data: deleted };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('TeacherService: Failed to bulk delete teachers', error);
      return { success: false, error: error.message };
    }
  }

  async findByName(fullName: string): Promise<ServiceResult<ParsedTeacher | null>> {
    try {
      const teacher = await this.teacherRepository.findByName(fullName);
      return { success: true, data: teacher };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('TeacherService: Failed to find teacher by name', error, { fullName });
      return { success: false, error: error.message };
    }
  }

  async count(): Promise<ServiceResult<number>> {
    try {
      const count = await this.teacherRepository.countTeachers();
      return { success: true, data: count };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('TeacherService: Failed to count teachers', error);
      return { success: false, error: error.message };
    }
  }

  private invalidateSwapConstraints(): void {
    this.cacheManager.invalidatePrefix(SWAP_CONSTRAINT_CACHE_PREFIX);
  }

  private async validateCalendarConstraints<T extends Partial<TeacherInput>>(
    input: T,
    schoolId: number | null,
    providedConfig?: SchoolConfigDto
  ): Promise<T> {
    const config = providedConfig ?? (await this.schoolConfigService.getConfig(schoolId));
    const canonicalPeriods = buildCanonicalPeriodConfiguration({
      ...config,
      periodsPerDayMap: config.periodsPerDayMap as Record<string, number>,
      categoryPeriodsMap: config.categoryPeriodsMap as Record<string, Record<string, number>>,
    });
    const periodsByDay = Object.fromEntries(
      config.daysOfWeek.map((day) => [
        day.toLowerCase(),
        canonicalPeriods.periodsPerDayMap[day],
      ])
    );
    const calendarPeriods = Object.values(periodsByDay).reduce((sum, value) => sum + value, 0);
    const maximumDay = Math.max(...Object.values(periodsByDay));
    if (input.maxPeriodsPerWeek !== undefined && input.maxPeriodsPerWeek > calendarPeriods) {
      throw new Error(`maxPeriodsPerWeek cannot exceed the school calendar (${calendarPeriods})`);
    }
    if (input.maxPeriodsPerDay !== undefined && input.maxPeriodsPerDay > maximumDay) {
      throw new Error(`maxPeriodsPerDay cannot exceed the school calendar (${maximumDay})`);
    }
    if (input.maxConsecutivePeriods !== undefined && input.maxConsecutivePeriods > maximumDay) {
      throw new Error(`maxConsecutivePeriods cannot exceed the school calendar (${maximumDay})`);
    }
    if (input.unavailable === undefined) return input;
    const unavailable = normalizeUnavailableSlots(input.unavailable);
    for (const slot of unavailable) {
      const periods = periodsByDay[slot.day.toLowerCase()];
      if (periods === undefined || slot.period >= periods) {
        throw new Error(`Unavailable slot ${slot.day}:${slot.period} is outside the school calendar`);
      }
    }
    return { ...input, unavailable } as T;
  }

  private async validatePreferenceReferences(
    input: Partial<TeacherInput>,
    schoolId: number | null,
    teacherId: number | undefined,
    manager: EntityManager
  ): Promise<void> {
    if (input.preferredRoomIds !== undefined) {
      const ids = [...new Set(input.preferredRoomIds)];
      const rooms = ids.length
        ? await manager.getRepository(Room).find({ where: { id: In(ids), isDeleted: false } })
        : [];
      if (rooms.length !== ids.length || rooms.some((room) => room.schoolId !== schoolId)) {
        throw new Error('One or more preferred rooms are inactive or outside the teacher school');
      }
    }
    if (input.preferredColleagues !== undefined) {
      const ids = [...new Set(input.preferredColleagues)];
      if (teacherId !== undefined && ids.includes(teacherId)) {
        throw new Error('A teacher cannot be their own preferred colleague');
      }
      const colleagues = ids.length
        ? await manager.getRepository(Teacher).find({ where: { id: In(ids), isDeleted: false } })
        : [];
      if (
        colleagues.length !== ids.length ||
        colleagues.some((colleague) => colleague.schoolId !== schoolId)
      ) {
        throw new Error('One or more preferred colleagues are inactive or outside the teacher school');
      }
    }
  }

  private async deleteTeachersInsideTransaction(
    teachers: ParsedTeacher[],
    manager: EntityManager
  ): Promise<number> {
    const ids = teachers.map((teacher) => teacher.id);
    if (ids.length === 0) return 0;
    const placeholders = ids.map(() => '?').join(', ');

    await manager.query(
      `DELETE FROM teaching_assignment WHERE teacher_id IN (${placeholders})`,
      ids
    );
    await manager.query(
      `DELETE FROM teacher_subject_capability WHERE teacher_id IN (${placeholders})`,
      ids
    );
    if (await manager.query(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='teacher_class_subject_assignment' LIMIT 1`).then((rows) => rows.length > 0)) {
      await manager.query(
        `DELETE FROM teacher_class_subject_assignment WHERE teacherId IN (${placeholders})`,
        ids
      );
    }
    await manager.query(
      `UPDATE class_group SET classTeacherId = NULL, updatedAt = CURRENT_TIMESTAMP WHERE classTeacherId IN (${placeholders})`,
      ids
    );

    const colleagueRows = (await manager.query(
      `SELECT id, preferredColleagues FROM teacher WHERE isDeleted = 0 AND id NOT IN (${placeholders})`,
      ids
    )) as Array<{ id: number; preferredColleagues: string | null }>;
    const deletedIds = new Set(ids);
    for (const colleague of colleagueRows) {
      const current = safeJsonParse<number[]>(colleague.preferredColleagues, []);
      const next = current.filter((teacherId) => !deletedIds.has(teacherId));
      if (next.length !== current.length) {
        await manager.query(
          `UPDATE teacher SET preferredColleagues = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
          [safeJsonStringify(next, '[]'), colleague.id]
        );
      }
    }

    const scopes = [...new Set(teachers.map((teacher) => teacher.schoolId))];
    for (const schoolId of scopes) {
      await manager.query(
        schoolId === null
          ? `UPDATE timetable SET isStale = 1, staleReason = 'Teacher deleted', staleAt = CURRENT_TIMESTAMP WHERE schoolId IS NULL AND isDeleted = 0`
          : `UPDATE timetable SET isStale = 1, staleReason = 'Teacher deleted', staleAt = CURRENT_TIMESTAMP WHERE schoolId = ? AND isDeleted = 0`,
        schoolId === null ? [] : [schoolId]
      );
    }

    const result = await manager.getRepository(Teacher).delete(ids);
    return result.affected ?? 0;
  }
}
