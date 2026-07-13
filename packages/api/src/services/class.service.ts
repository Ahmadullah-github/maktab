/**
 * Class Service for business logic operations
 * @module services/class
 *
 * Requirements: 3.2
 * - Route handler SHALL delegate business logic to ClassService class
 *
 * Phase 2: Auto-populate subject requirements from curriculum on class creation
 */

import { DataSource, EntityManager } from 'typeorm';
import { CacheManager } from '../database/cache/cacheManager';
import { runCommittedTransaction } from '../database/transaction';
import {
  ClassInput,
  ClassRepository,
  ParsedClass,
  SubjectRequirement,
} from '../database/repositories/class.repository';
import { SchoolConfigRepository } from '../database/repositories/schoolConfig.repository';
import { RoomRepository } from '../database/repositories/room.repository';
import { ParsedSubject, SubjectRepository } from '../database/repositories/subject.repository';
import { PaginatedResponse, PaginationParams, ServiceResult } from '../types/common.types';
import { AssignmentCommandService } from './assignmentCommand.service';
import { RequirementService } from './requirement.service';
import { SubjectReferenceCleanupService } from './subjectReferenceCleanup.service';
import { logger } from '../utils/logger';
import {
  clearDataSourceScopedInstances,
  getDataSourceScopedInstance,
} from '../utils/dataSourceScope';

function usesDeprecatedSubjectRequirementTeacherIds(
  subjectRequirements: ClassInput['subjectRequirements'] | string | undefined
): boolean {
  if (subjectRequirements === undefined) {
    return false;
  }

  let parsedRequirements: unknown = subjectRequirements;

  if (typeof subjectRequirements === 'string') {
    try {
      parsedRequirements = JSON.parse(subjectRequirements);
    } catch {
      return false;
    }
  }

  if (!Array.isArray(parsedRequirements)) {
    return false;
  }

  return parsedRequirements.some((requirement) => {
    if (typeof requirement !== 'object' || requirement === null) {
      return false;
    }

    return Object.prototype.hasOwnProperty.call(requirement, 'teacherId');
  });
}

function warnOnDeprecatedClassWrite(
  operation: 'create' | 'update' | 'bulkImport' | 'bulkUpsert',
  input: Partial<ClassInput>,
  classId?: number
): void {
  if (!usesDeprecatedSubjectRequirementTeacherIds(input.subjectRequirements)) {
    return;
  }

  logger.warn(
    'ClassService: Class payload still uses deprecated subjectRequirements.teacherId assignment writes',
    {
      operation,
      classId,
      replacementDocs: 'docs/ASSIGNMENT_PHASE_0_BASELINE.md',
    }
  );
}

interface ClassWriteSplitResult {
  baseInput: Partial<ClassInput>;
  hasSubjectRequirements: boolean;
  subjectRequirements?: SubjectRequirement[];
}

function normalizeSubjectRequirementsInput(
  subjectRequirements: ClassInput['subjectRequirements']
): SubjectRequirement[] {
  if (!subjectRequirements) {
    return [];
  }

  if (Array.isArray(subjectRequirements)) {
    return subjectRequirements;
  }

  return [];
}

function splitClassWriteInput(input: Partial<ClassInput>): ClassWriteSplitResult {
  const baseInput: Partial<ClassInput> = { ...input };
  delete baseInput.subjectRequirements;

  const hasSubjectRequirements = Object.prototype.hasOwnProperty.call(input, 'subjectRequirements');
  return {
    baseInput,
    hasSubjectRequirements,
    subjectRequirements: hasSubjectRequirements
      ? normalizeSubjectRequirementsInput(input.subjectRequirements)
      : undefined,
  };
}

/**
 * ClassService handles all business logic for ClassGroup operations
 */
export class ClassService {
  private dataSource: DataSource;
  private classRepository: ClassRepository;
  private roomRepository: RoomRepository;
  private subjectRepository: SubjectRepository;
  private schoolConfigRepository: SchoolConfigRepository;
  private subjectReferenceCleanupService: SubjectReferenceCleanupService;
  private requirementService: RequirementService;
  private assignmentCommandService: AssignmentCommandService;
  private readonly cacheManager: CacheManager;

  private constructor(dataSource: DataSource, cacheManager?: CacheManager) {
    this.dataSource = dataSource;
    this.cacheManager = cacheManager ?? CacheManager.getInstance();
    this.classRepository = ClassRepository.getInstance(dataSource, this.cacheManager);
    this.roomRepository = RoomRepository.getInstance(dataSource, this.cacheManager);
    this.subjectRepository = SubjectRepository.getInstance(dataSource, this.cacheManager);
    this.schoolConfigRepository = SchoolConfigRepository.getInstance(dataSource, this.cacheManager);
    this.subjectReferenceCleanupService = SubjectReferenceCleanupService.getInstance(
      dataSource,
      this.cacheManager
    );
    this.requirementService = RequirementService.getInstance(dataSource, this.cacheManager);
    this.assignmentCommandService = AssignmentCommandService.getInstance(
      dataSource,
      this.cacheManager
    );
  }

  static getInstance(dataSource: DataSource, cacheManager?: CacheManager): ClassService {
    return getDataSourceScopedInstance(
      dataSource,
      ClassService,
      () => new ClassService(dataSource, cacheManager)
    );
  }

  static resetInstance(): void {
    clearDataSourceScopedInstances(ClassService);
  }

  private async validateFixedRoomId(
    fixedRoomId: number | null | undefined
  ): Promise<string | null> {
    if (fixedRoomId === null || fixedRoomId === undefined) {
      return null;
    }
    const room = await this.roomRepository.getRoom(fixedRoomId);
    if (!room) {
      return `Room with ID ${fixedRoomId} not found`;
    }
    return null;
  }

  /**
   * Check if subject requirements should be auto-populated
   * Auto-populate when:
   * - Grade is set (1-12)
   * - No subjectRequirements provided OR empty array
   */
  private shouldAutoPopulate(input: ClassInput): boolean {
    if (!input.subjectRequirements) {
      return true;
    }
    if (Array.isArray(input.subjectRequirements) && input.subjectRequirements.length === 0) {
      return true;
    }
    return false;
  }

  /**
   * Populate subject requirements from database subjects for a grade
   * Maps subjects to SubjectRequirement format with teacherId = null
   */
  private async populateFromCurriculum(grade: number): Promise<SubjectRequirement[]> {
    try {
      // Get subjects for this grade from database
      const subjects = await this.subjectRepository.findByGrade(grade);

      if (subjects.length === 0) {
        logger.debug('No subjects found for grade, skipping auto-population', { grade });
        return [];
      }

      // Map to SubjectRequirement format
      const requirements: SubjectRequirement[] = subjects
        .filter((s: ParsedSubject) => !s.isDeleted)
        .map((s: ParsedSubject) => ({
          subjectId: s.id,
          periodsPerWeek: s.periodsPerWeek ?? 3,
          teacherId: null,
        }));

      logger.info('Auto-populated subject requirements from curriculum', {
        grade,
        subjectCount: requirements.length,
        totalPeriods: requirements.reduce((sum, r) => sum + r.periodsPerWeek, 0),
      });

      return requirements;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to populate curriculum', error, { grade });
      return [];
    }
  }

  private async syncRequirementPayload(
    classId: number,
    requirements: SubjectRequirement[],
    manager: EntityManager
  ): Promise<void> {
    await this.requirementService.syncClassRequirements(
      classId,
      requirements.map((requirement) => ({
        subjectId: requirement.subjectId,
        periodsPerWeek: requirement.periodsPerWeek,
      })),
      { manager }
    );

    await this.assignmentCommandService.syncClassAssignmentsFromLegacyRequirements(
      classId,
      requirements,
      { manager }
    );
  }

  async create(input: ClassInput): Promise<ServiceResult<ParsedClass>> {
    try {
      warnOnDeprecatedClassWrite('create', input);

      if (!input.name || input.name.trim() === '') {
        return { success: false, error: 'Class name is required' };
      }

      const existing = await this.classRepository.findByName(input.name);
      if (existing) {
        return { success: false, error: `Class with name "${input.name}" already exists` };
      }

      const roomError = await this.validateFixedRoomId(input.fixedRoomId);
      if (roomError) {
        return { success: false, error: roomError };
      }

      if (input.studentCount !== undefined && input.studentCount < 0) {
        return { success: false, error: 'Student count cannot be negative' };
      }

      if (input.grade !== undefined && input.grade !== null) {
        if (input.grade < 1 || input.grade > 12) {
          return { success: false, error: 'Grade must be between 1 and 12' };
        }
      }

      // Phase 2: Auto-populate subject requirements from curriculum
      // Only when grade is set, no requirements provided, and config allows it
      if (input.grade && this.shouldAutoPopulate(input)) {
        // Check if auto-population is enabled in school config
        const schoolConfig = await this.schoolConfigRepository.getOrCreate();
        const autoPopulateEnabled = schoolConfig?.autoPopulateCurriculum ?? true; // Default: enabled

        if (autoPopulateEnabled) {
          const populatedRequirements = await this.populateFromCurriculum(input.grade);
          if (populatedRequirements.length > 0) {
            input.subjectRequirements = populatedRequirements;
            logger.info('ClassService: Auto-populated curriculum for new class', {
              name: input.name,
              grade: input.grade,
              subjectCount: populatedRequirements.length,
            });
          }
        } else {
          logger.debug('ClassService: Auto-population disabled by school config', {
            name: input.name,
            grade: input.grade,
          });
        }
      }

      const splitInput = splitClassWriteInput(input);
      const requirementsToSync = splitInput.hasSubjectRequirements
        ? (splitInput.subjectRequirements ?? [])
        : undefined;
      let classGroup: ParsedClass | null = null;

      await runCommittedTransaction(
        this.dataSource,
        this.cacheManager,
        async (manager: EntityManager) => {
          classGroup = await this.classRepository.saveClass(splitInput.baseInput as ClassInput, {
            manager,
            skipCache: true,
          });

          if (!classGroup) {
            throw new Error('Failed to create class');
          }

          if (requirementsToSync !== undefined) {
            await this.syncRequirementPayload(classGroup.id, requirementsToSync, manager);
          }

          classGroup = await this.classRepository.getClass(classGroup.id, {
            manager,
            skipCache: true,
          });
        }
      );

      if (!classGroup) {
        return { success: false, error: 'Failed to create class' };
      }

      const createdClassGroup = classGroup as ParsedClass;
      logger.info('ClassService: Created class', {
        id: createdClassGroup.id,
        name: createdClassGroup.name,
      });
      return { success: true, data: createdClassGroup };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('ClassService: Failed to create class', error, { input: JSON.stringify(input) });
      return { success: false, error: error.message };
    }
  }

  async update(id: number, input: Partial<ClassInput>): Promise<ServiceResult<ParsedClass>> {
    try {
      warnOnDeprecatedClassWrite('update', input, id);

      if (input.name !== undefined && input.name.trim() === '') {
        return { success: false, error: 'Class name cannot be empty' };
      }

      const existing = await this.classRepository.getClass(id);
      if (!existing) {
        return { success: false, error: `Class with ID ${id} not found` };
      }

      if (input.name && input.name !== existing.name) {
        const duplicate = await this.classRepository.findByName(input.name);
        if (duplicate && duplicate.id !== id) {
          return { success: false, error: `Class with name "${input.name}" already exists` };
        }
      }

      if (input.fixedRoomId !== undefined) {
        const roomError = await this.validateFixedRoomId(input.fixedRoomId);
        if (roomError) {
          return { success: false, error: roomError };
        }
      }

      if (input.studentCount !== undefined && input.studentCount < 0) {
        return { success: false, error: 'Student count cannot be negative' };
      }

      if (input.grade !== undefined && input.grade !== null) {
        if (input.grade < 1 || input.grade > 12) {
          return { success: false, error: 'Grade must be between 1 and 12' };
        }
      }

      const splitInput = splitClassWriteInput(input);
      let classGroup: ParsedClass | null = null;

      await runCommittedTransaction(
        this.dataSource,
        this.cacheManager,
        async (manager: EntityManager) => {
          classGroup = await this.classRepository.updateClass(id, splitInput.baseInput, {
            manager,
            skipCache: true,
          });

          if (!classGroup) {
            throw new Error(`Failed to update class with ID ${id}`);
          }

          if (splitInput.hasSubjectRequirements) {
            await this.syncRequirementPayload(id, splitInput.subjectRequirements ?? [], manager);
          }

          classGroup = await this.classRepository.getClass(id, {
            manager,
            skipCache: true,
          });
        }
      );

      if (!classGroup) {
        return { success: false, error: `Failed to update class with ID ${id}` };
      }

      logger.info('ClassService: Updated class', { id });
      return { success: true, data: classGroup };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('ClassService: Failed to update class', error, { id });
      return { success: false, error: error.message };
    }
  }

  async delete(id: number): Promise<ServiceResult<boolean>> {
    try {
      const existing = await this.classRepository.getClass(id);
      if (!existing) {
        return { success: false, error: `Class with ID ${id} not found` };
      }

      let deleted = false;
      await runCommittedTransaction(
        this.dataSource,
        this.cacheManager,
        async (manager: EntityManager) => {
          await this.requirementService.clearClassRequirements(id, { manager });
          deleted = await this.classRepository.deleteClass(id, {
            manager,
            skipCache: true,
          });
        }
      );

      if (!deleted) {
        return { success: false, error: `Failed to delete class with ID ${id}` };
      }

      logger.info('ClassService: Deleted class', { id });
      return { success: true, data: true };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('ClassService: Failed to delete class', error, { id });
      return { success: false, error: error.message };
    }
  }

  async findById(id: number): Promise<ServiceResult<ParsedClass>> {
    try {
      await this.subjectReferenceCleanupService.cleanupDeletedSubjectReferences();
      const classGroup = await this.classRepository.getClass(id);
      if (!classGroup) {
        return { success: false, error: `Class with ID ${id} not found` };
      }
      return { success: true, data: classGroup };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('ClassService: Failed to find class', error, { id });
      return { success: false, error: error.message };
    }
  }

  async findAll(
    pagination?: PaginationParams
  ): Promise<ServiceResult<PaginatedResponse<ParsedClass>>> {
    try {
      await this.subjectReferenceCleanupService.cleanupDeletedSubjectReferences();
      const result = await this.classRepository.getAllClasses(pagination);
      return { success: true, data: result };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('ClassService: Failed to find all classes', error);
      return { success: false, error: error.message };
    }
  }

  async findAllUnpaginated(): Promise<ServiceResult<ParsedClass[]>> {
    try {
      await this.subjectReferenceCleanupService.cleanupDeletedSubjectReferences();
      const classes = await this.classRepository.getAllClassesUnpaginated();
      return { success: true, data: classes };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('ClassService: Failed to find all classes', error);
      return { success: false, error: error.message };
    }
  }

  async bulkImport(classesData: ClassInput[]): Promise<ServiceResult<ParsedClass[]>> {
    try {
      classesData.forEach((classData) => warnOnDeprecatedClassWrite('bulkImport', classData));

      const invalidClasses = classesData.filter((c) => !c.name || c.name.trim() === '');
      if (invalidClasses.length > 0) {
        return { success: false, error: `${invalidClasses.length} class(es) have empty names` };
      }

      for (const classData of classesData) {
        if (classData.fixedRoomId) {
          const roomError = await this.validateFixedRoomId(classData.fixedRoomId);
          if (roomError) {
            return { success: false, error: `Class "${classData.name}": ${roomError}` };
          }
        }
      }

      const normalizedNames = classesData.map((classData) => classData.name.trim());
      if (new Set(normalizedNames).size !== normalizedNames.length) {
        return { success: false, error: 'Bulk import contains duplicate class names' };
      }
      for (const name of normalizedNames) {
        if (await this.classRepository.findByName(name)) {
          return { success: false, error: `Class with name "${name}" already exists` };
        }
      }

      const preparedClasses = classesData.map((classData) => ({
        ...classData,
        name: classData.name.trim(),
      }));
      const schoolConfig = await this.schoolConfigRepository.getOrCreate();
      if (schoolConfig?.autoPopulateCurriculum ?? true) {
        for (const classData of preparedClasses) {
          if (classData.grade && this.shouldAutoPopulate(classData)) {
            classData.subjectRequirements = await this.populateFromCurriculum(classData.grade);
          }
        }
      }

      const classes = await runCommittedTransaction(
        this.dataSource,
        this.cacheManager,
        async (manager) => {
          const created: ParsedClass[] = [];
          for (const classData of preparedClasses) {
            const splitInput = splitClassWriteInput(classData);
            const classGroup = await this.classRepository.saveClass(
              splitInput.baseInput as ClassInput,
              { manager, skipCache: true }
            );
            if (splitInput.hasSubjectRequirements) {
              await this.syncRequirementPayload(
                classGroup.id,
                splitInput.subjectRequirements ?? [],
                manager
              );
            }
            const hydrated = await this.classRepository.getClass(classGroup.id, {
              manager,
              skipCache: true,
            });
            if (!hydrated) throw new Error(`Failed to create class "${classData.name}"`);
            created.push(hydrated);
          }
          return created;
        }
      );
      logger.info('ClassService: Bulk imported classes', { count: classes.length });
      return { success: true, data: classes };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('ClassService: Failed to bulk import classes', error);
      return { success: false, error: error.message };
    }
  }

  async bulkUpsert(classesData: ClassInput[]): Promise<ServiceResult<ParsedClass[]>> {
    try {
      classesData.forEach((classData) => warnOnDeprecatedClassWrite('bulkUpsert', classData));

      const invalidClasses = classesData.filter((c) => !c.name || c.name.trim() === '');
      if (invalidClasses.length > 0) {
        return { success: false, error: `${invalidClasses.length} class(es) have empty names` };
      }

      for (const classData of classesData) {
        if (classData.fixedRoomId) {
          const roomError = await this.validateFixedRoomId(classData.fixedRoomId);
          if (roomError) {
            return { success: false, error: `Class "${classData.name}": ${roomError}` };
          }
        }
      }

      const classes: ParsedClass[] = [];
      for (const classData of classesData) {
        const existing = await this.classRepository.findByName(classData.name);
        const result = existing
          ? await this.update(existing.id, classData)
          : await this.create(classData);

        if (!result.success || !result.data) {
          return { success: false, error: result.error ?? 'Failed to bulk upsert classes' };
        }
        classes.push(result.data);
      }
      logger.info('ClassService: Bulk upserted classes', { count: classes.length });
      return { success: true, data: classes };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('ClassService: Failed to bulk upsert classes', error);
      return { success: false, error: error.message };
    }
  }

  async bulkDelete(ids: number[]): Promise<ServiceResult<number>> {
    try {
      if (ids.length === 0) {
        return { success: true, data: 0 };
      }
      const deleted = await this.classRepository.bulkDeleteClasses(ids);
      logger.info('ClassService: Bulk deleted classes', { count: deleted });
      return { success: true, data: deleted };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('ClassService: Failed to bulk delete classes', error);
      return { success: false, error: error.message };
    }
  }

  async findByName(name: string): Promise<ServiceResult<ParsedClass | null>> {
    try {
      const classGroup = await this.classRepository.findByName(name);
      return { success: true, data: classGroup };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('ClassService: Failed to find class by name', error, { name });
      return { success: false, error: error.message };
    }
  }

  async findByFixedRoomId(fixedRoomId: number): Promise<ServiceResult<ParsedClass[]>> {
    try {
      const classes = await this.classRepository.findByFixedRoomId(fixedRoomId);
      return { success: true, data: classes };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('ClassService: Failed to find classes by room', error, { fixedRoomId });
      return { success: false, error: error.message };
    }
  }

  async findByGrade(grade: number): Promise<ServiceResult<ParsedClass[]>> {
    try {
      const classes = await this.classRepository.findByGrade(grade);
      return { success: true, data: classes };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('ClassService: Failed to find classes by grade', error, { grade });
      return { success: false, error: error.message };
    }
  }

  async findBySection(section: string): Promise<ServiceResult<ParsedClass[]>> {
    try {
      const classes = await this.classRepository.findBySection(section);
      return { success: true, data: classes };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('ClassService: Failed to find classes by section', error, { section });
      return { success: false, error: error.message };
    }
  }

  async findSingleTeacherModeClasses(): Promise<ServiceResult<ParsedClass[]>> {
    try {
      const classes = await this.classRepository.findSingleTeacherModeClasses();
      return { success: true, data: classes };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('ClassService: Failed to find single teacher mode classes', error);
      return { success: false, error: error.message };
    }
  }

  async count(): Promise<ServiceResult<number>> {
    try {
      const count = await this.classRepository.countClasses();
      return { success: true, data: count };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('ClassService: Failed to count classes', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Bulk apply curriculum to multiple classes
   * @param classIds - Array of class IDs to apply curriculum to, or undefined to apply to all classes without requirements
   * @param overwrite - If true, overwrite existing requirements; if false, skip classes with requirements
   * @returns Result with counts of updated, skipped, and failed classes
   */
  async bulkApplyCurriculum(
    classIds?: number[],
    overwrite: boolean = false
  ): Promise<
    ServiceResult<{
      updated: number;
      skipped: number;
      failed: number;
      details: Array<{
        classId: number;
        className: string;
        status: 'updated' | 'skipped' | 'failed';
        reason?: string;
      }>;
    }>
  > {
    try {
      let classesToProcess: ParsedClass[];

      if (classIds && classIds.length > 0) {
        // Get specific classes by IDs
        const classes: ParsedClass[] = [];
        for (const id of classIds) {
          const cls = await this.classRepository.getClass(id);
          if (cls && !cls.isDeleted) {
            classes.push(cls);
          }
        }
        classesToProcess = classes;
      } else {
        // Get all classes (for "apply to all without requirements" mode)
        classesToProcess = await this.classRepository.getAllClassesUnpaginated();
        classesToProcess = classesToProcess.filter((c) => !c.isDeleted);
      }

      if (classesToProcess.length === 0) {
        return {
          success: true,
          data: { updated: 0, skipped: 0, failed: 0, details: [] },
        };
      }

      logger.info('ClassService: Starting bulk curriculum application', {
        totalClasses: classesToProcess.length,
        overwrite,
      });

      let updated = 0;
      let skipped = 0;
      let failed = 0;
      const details: Array<{
        classId: number;
        className: string;
        status: 'updated' | 'skipped' | 'failed';
        reason?: string;
      }> = [];

      for (const cls of classesToProcess) {
        try {
          // Skip if no grade
          if (!cls.grade) {
            skipped++;
            details.push({
              classId: cls.id,
              className: cls.name,
              status: 'skipped',
              reason: 'No grade set',
            });
            continue;
          }

          // Skip if has requirements and not overwriting
          if (!overwrite && cls.subjectRequirements && cls.subjectRequirements.length > 0) {
            skipped++;
            details.push({
              classId: cls.id,
              className: cls.name,
              status: 'skipped',
              reason: 'Already has requirements',
            });
            continue;
          }

          // Get curriculum for this grade
          const requirements = await this.populateFromCurriculum(cls.grade);

          if (requirements.length === 0) {
            skipped++;
            details.push({
              classId: cls.id,
              className: cls.name,
              status: 'skipped',
              reason: 'No subjects found for grade',
            });
            continue;
          }

          await runCommittedTransaction(
            this.dataSource,
            this.cacheManager,
            async (manager: EntityManager) => {
              await this.syncRequirementPayload(cls.id, requirements, manager);
            }
          );

          updated++;
          details.push({
            classId: cls.id,
            className: cls.name,
            status: 'updated',
          });
          logger.debug('ClassService: Applied curriculum to class', {
            classId: cls.id,
            className: cls.name,
            grade: cls.grade,
            subjectCount: requirements.length,
          });
        } catch (err) {
          failed++;
          const errorMsg = err instanceof Error ? err.message : String(err);
          details.push({
            classId: cls.id,
            className: cls.name,
            status: 'failed',
            reason: errorMsg,
          });
          logger.error(
            'ClassService: Failed to apply curriculum to class',
            err instanceof Error ? err : new Error(String(err)),
            { classId: cls.id, className: cls.name }
          );
        }
      }

      logger.info('ClassService: Bulk curriculum application completed', {
        updated,
        skipped,
        failed,
        total: classesToProcess.length,
      });

      return {
        success: true,
        data: { updated, skipped, failed, details },
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('ClassService: Failed to bulk apply curriculum', error);
      return { success: false, error: error.message };
    }
  }
}
