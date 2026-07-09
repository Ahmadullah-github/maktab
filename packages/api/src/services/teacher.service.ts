/**
 * Teacher Service for business logic operations
 * @module services/teacher
 * 
 * Requirements: 3.1
 * - Route handler SHALL delegate business logic to TeacherService class
 */

import { DataSource, EntityManager } from 'typeorm';
import { TeacherRepository, TeacherInput, ParsedTeacher } from '../database/repositories/teacher.repository';
import { CacheManager } from '../database/cache/cacheManager';
import { PaginationParams, PaginatedResponse, ServiceResult } from '../types/common.types';
import { SubjectReferenceCleanupService } from './subjectReferenceCleanup.service';
import { AssignmentCommandService } from './assignmentCommand.service';
import { TeacherCapabilityService } from './teacherCapability.service';
import { logger } from '../utils/logger';

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
    classAssignments: hasClassAssignments ? input.classAssignments ?? [] : undefined,
    hasClassAssignments,
  };
}

/**
 * TeacherService handles all business logic for Teacher operations
 */
export class TeacherService {
  private static instance: TeacherService | null = null;
  private dataSource: DataSource;
  private teacherRepository: TeacherRepository;
  private subjectReferenceCleanupService: SubjectReferenceCleanupService;
  private teacherCapabilityService: TeacherCapabilityService;
  private assignmentCommandService: AssignmentCommandService;

  private constructor(dataSource: DataSource, cacheManager?: CacheManager) {
    this.dataSource = dataSource;
    this.teacherRepository = TeacherRepository.getInstance(dataSource, cacheManager);
    this.subjectReferenceCleanupService = SubjectReferenceCleanupService.getInstance(
      dataSource,
      cacheManager
    );
    this.teacherCapabilityService = TeacherCapabilityService.getInstance(dataSource, cacheManager);
    this.assignmentCommandService = AssignmentCommandService.getInstance(dataSource, cacheManager);
  }

  static getInstance(dataSource: DataSource, cacheManager?: CacheManager): TeacherService {
    if (!TeacherService.instance) {
      TeacherService.instance = new TeacherService(dataSource, cacheManager);
    }
    return TeacherService.instance;
  }

  static resetInstance(): void {
    TeacherService.instance = null;
  }

  async create(input: TeacherInput): Promise<ServiceResult<ParsedTeacher>> {
    try {
      warnOnDeprecatedTeacherWrite('create', input);

      if (!input.fullName || input.fullName.trim() === '') {
        return { success: false, error: 'Teacher name is required' };
      }

      const existing = await this.teacherRepository.findByName(input.fullName);
      if (existing) {
        return { success: false, error: `Teacher with name "${input.fullName}" already exists` };
      }

      const splitInput = splitTeacherWriteInput(input);
      let teacher: ParsedTeacher | null = null;

      await this.dataSource.transaction(async (manager: EntityManager) => {
        teacher = await this.teacherRepository.saveTeacher(splitInput.baseInput as TeacherInput, {
          manager,
          skipCache: true,
        });

        if (!teacher) {
          throw new Error('Failed to create teacher');
        }

        if (splitInput.hasCapabilityInput) {
          await this.teacherCapabilityService.syncTeacherCapabilities(
            teacher.id,
            splitInput.capabilityInput,
            { manager }
          );
        }

        if (splitInput.hasClassAssignments) {
          await this.assignmentCommandService.syncTeacherAssignmentsFromLegacyMirror(
            teacher.id,
            splitInput.classAssignments ?? [],
            { manager }
          );
        }

        teacher = await this.teacherRepository.getTeacher(teacher.id, {
          manager,
          skipCache: true,
        });
      });

      if (!teacher) {
        return { success: false, error: 'Failed to create teacher' };
      }

      const createdTeacher = teacher as ParsedTeacher;
      logger.info('TeacherService: Created teacher', {
        id: createdTeacher.id,
        name: createdTeacher.fullName,
      });
      return { success: true, data: createdTeacher };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('TeacherService: Failed to create teacher', error);
      return { success: false, error: error.message };
    }
  }

  async update(id: number, input: Partial<TeacherInput>): Promise<ServiceResult<ParsedTeacher>> {
    try {
      warnOnDeprecatedTeacherWrite('update', input, id);

      if (input.fullName !== undefined && input.fullName.trim() === '') {
        return { success: false, error: 'Teacher name cannot be empty' };
      }

      const existing = await this.teacherRepository.getTeacher(id);
      if (!existing) {
        return { success: false, error: `Teacher with ID ${id} not found` };
      }

      if (input.fullName && input.fullName !== existing.fullName) {
        const duplicate = await this.teacherRepository.findByName(input.fullName);
        if (duplicate && duplicate.id !== id) {
          return { success: false, error: `Teacher with name "${input.fullName}" already exists` };
        }
      }

      const splitInput = splitTeacherWriteInput(input);
      let teacher: ParsedTeacher | null = null;

      await this.dataSource.transaction(async (manager: EntityManager) => {
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

        if (splitInput.hasClassAssignments) {
          await this.assignmentCommandService.syncTeacherAssignmentsFromLegacyMirror(
            id,
            splitInput.classAssignments ?? [],
            { manager }
          );
        }

        teacher = await this.teacherRepository.getTeacher(id, {
          manager,
          skipCache: true,
        });
      });

      if (!teacher) {
        return { success: false, error: `Failed to update teacher with ID ${id}` };
      }

      logger.info('TeacherService: Updated teacher', { id });
      return { success: true, data: teacher };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('TeacherService: Failed to update teacher', error, { id });
      return { success: false, error: error.message };
    }
  }

  async delete(id: number): Promise<ServiceResult<boolean>> {
    try {
      const existing = await this.teacherRepository.getTeacher(id);
      if (!existing) {
        return { success: false, error: `Teacher with ID ${id} not found` };
      }

      let deleted = false;
      await this.dataSource.transaction(async (manager: EntityManager) => {
        await this.assignmentCommandService.removeAssignmentsForTeacher(id, { manager });
        await this.teacherCapabilityService.clearTeacherCapabilities(id, { manager });

        deleted = await this.teacherRepository.deleteTeacher(id, {
          manager,
          skipCache: true,
        });
      });

      if (!deleted) {
        return { success: false, error: `Failed to delete teacher with ID ${id}` };
      }

      logger.info('TeacherService: Deleted teacher', { id });
      return { success: true, data: true };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('TeacherService: Failed to delete teacher', error, { id });
      return { success: false, error: error.message };
    }
  }

  async findById(id: number): Promise<ServiceResult<ParsedTeacher>> {
    try {
      await this.subjectReferenceCleanupService.cleanupDeletedSubjectReferences();
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

  async findAll(pagination?: PaginationParams): Promise<ServiceResult<PaginatedResponse<ParsedTeacher>>> {
    try {
      await this.subjectReferenceCleanupService.cleanupDeletedSubjectReferences();
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
      await this.subjectReferenceCleanupService.cleanupDeletedSubjectReferences();
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

      const invalidTeachers = teachersData.filter(t => !t.fullName || t.fullName.trim() === '');
      if (invalidTeachers.length > 0) {
        return { success: false, error: `${invalidTeachers.length} teacher(s) have empty names` };
      }

      const teachers: ParsedTeacher[] = [];
      for (const teacherData of teachersData) {
        const result = await this.create(teacherData);
        if (!result.success || !result.data) {
          return { success: false, error: result.error ?? 'Failed to bulk import teachers' };
        }
        teachers.push(result.data);
      }
      logger.info('TeacherService: Bulk imported teachers', { count: teachers.length });
      return { success: true, data: teachers };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('TeacherService: Failed to bulk import teachers', error);
      return { success: false, error: error.message };
    }
  }

  async bulkDelete(ids: number[]): Promise<ServiceResult<number>> {
    try {
      if (ids.length === 0) {
        return { success: true, data: 0 };
      }
      const deleted = await this.teacherRepository.bulkDeleteTeachers(ids);
      logger.info('TeacherService: Bulk deleted teachers', { count: deleted });
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
}
