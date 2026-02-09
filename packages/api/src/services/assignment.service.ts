/**
 * Assignment Service for teacher-subject-class assignment operations
 * @module services/assignment
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.5, 1.6, 3.5, 2.1, 4.2
 * - Assignment validation logic
 * - Conflict detection
 * - Workload calculation
 * - Coverage analysis
 * - Bidirectional data updates
 */

import { DataSource, EntityManager } from 'typeorm';
import { CacheManager } from '../database/cache/cacheManager';
import {
  ClassRepository,
  ParsedClass,
  SubjectRequirement,
} from '../database/repositories/class.repository';
import { ParsedSubject, SubjectRepository } from '../database/repositories/subject.repository';
import { ParsedTeacher, TeacherRepository } from '../database/repositories/teacher.repository';
import { TeacherClassSubjectAssignmentRepository } from '../database/repositories/teacherClassSubjectAssignment.repository';
import { ServiceResult } from '../types/common.types';
import { logger } from '../utils/logger';

// Re-export SubjectRequirement for use in routes
export type { SubjectRequirement };

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Ensure subjectRequirements is always an array
 * Handles cases where it might be an object {} instead of array []
 */
function ensureSubjectRequirementsArray(
  requirements: SubjectRequirement[] | Record<string, unknown> | null | undefined
): SubjectRequirement[] {
  if (!requirements) return [];
  if (Array.isArray(requirements)) return requirements;
  // If it's an object (legacy data), return empty array
  if (typeof requirements === 'object') {
    logger.warn('subjectRequirements is an object instead of array, returning empty array');
    return [];
  }
  return [];
}

// ============================================================================
// Types
// ============================================================================

export type AssignmentStatus = 'assigned' | 'unassigned' | 'partial' | 'conflict';
export type ConflictType =
  | 'workload_exceeded'
  | 'subject_incompatible'
  | 'availability_conflict'
  | 'coverage_insufficient'
  | 'duplicate_assignment';
export type ConflictSeverity = 'warning' | 'error';
export type WorkloadStatus = 'underloaded' | 'optimal' | 'near_capacity' | 'overloaded';
export type TeacherCompatibilityLevel = 'primary' | 'allowed' | 'incompatible';

export interface AffectedEntities {
  teacherId?: number;
  subjectId?: number;
  classId?: number;
}

export interface AssignmentConflict {
  type: ConflictType;
  severity: ConflictSeverity;
  message: string;
  messageFa: string;
  affectedEntities: AffectedEntities;
  suggestedResolution?: string;
  suggestedResolutionFa?: string;
}

export interface AssignmentValidationRequest {
  teacherId: number;
  subjectId: number;
  classIds: number[];
  periodsPerWeek: number;
}

export interface AssignmentValidationResult {
  isValid: boolean;
  conflicts: AssignmentConflict[];
  warnings: AssignmentConflict[];
}

export interface WorkloadBreakdown {
  subjectId: number;
  subjectName: string;
  classIds: number[];
  periodsPerWeek: number;
  totalPeriods: number;
}

export interface TeacherWorkload {
  teacherId: number;
  totalPeriods: number;
  maxPeriods: number;
  utilizationPercentage: number;
  breakdown: WorkloadBreakdown[];
  status: WorkloadStatus;
  remainingCapacity: number;
}

export interface ClassCoverageDetail {
  classId: number;
  className: string;
  periodsPerWeek: number;
  assignmentStatus: AssignmentStatus;
  assignedTeacherId: number | null;
  assignedTeacherName: string | null;
  conflicts: AssignmentConflict[];
}

export interface TeacherCoverageDetail {
  teacherId: number;
  teacherName: string;
  assignedClassIds: number[];
  totalPeriods: number;
  compatibility: TeacherCompatibilityLevel;
}

export interface SubjectCoverage {
  subjectId: number;
  subjectName: string;
  totalClassesRequiring: number;
  assignedClasses: number;
  unassignedClasses: ClassCoverageDetail[];
  teacherDistribution: TeacherCoverageDetail[];
  coveragePercentage: number;
  status: 'complete' | 'partial' | 'uncovered';
}

export interface AssignmentOperationResult {
  success: boolean;
  conflicts: AssignmentConflict[];
  updatedTeacherId?: number;
  updatedClassIds?: number[];
}

// Constants
const NEAR_CAPACITY_THRESHOLD = 5;

/**
 * AssignmentService handles all assignment-related business logic
 */
export class AssignmentService {
  private static instance: AssignmentService | null = null;
  private dataSource: DataSource;
  private teacherRepository: TeacherRepository;
  private classRepository: ClassRepository;
  private subjectRepository: SubjectRepository;
  private teacherAssignmentRepository: TeacherClassSubjectAssignmentRepository;

  private constructor(dataSource: DataSource, cacheManager?: CacheManager) {
    this.dataSource = dataSource;
    const cache = cacheManager ?? CacheManager.getInstance();
    this.teacherRepository = TeacherRepository.getInstance(dataSource, cache);
    this.classRepository = ClassRepository.getInstance(dataSource, cache);
    this.subjectRepository = SubjectRepository.getInstance(dataSource, cache);
    this.teacherAssignmentRepository = TeacherClassSubjectAssignmentRepository.getInstance(
      dataSource,
      cache
    );
  }

  static getInstance(dataSource: DataSource, cacheManager?: CacheManager): AssignmentService {
    if (!AssignmentService.instance) {
      AssignmentService.instance = new AssignmentService(dataSource, cacheManager);
    }
    return AssignmentService.instance;
  }

  static resetInstance(): void {
    AssignmentService.instance = null;
  }

  // =========================================================================
  // Teacher-Subject Compatibility
  // =========================================================================

  /**
   * Check if a teacher can teach a specific subject
   * Requirements: 5.1, 5.2, 5.3
   */
  getTeacherSubjectCompatibility(
    teacher: ParsedTeacher,
    subjectId: number
  ): TeacherCompatibilityLevel {
    if (teacher.primarySubjectIds.includes(subjectId)) {
      return 'primary';
    }
    if (teacher.restrictToPrimarySubjects) {
      return 'incompatible';
    }
    if (teacher.allowedSubjectIds.includes(subjectId)) {
      return 'allowed';
    }
    return 'incompatible';
  }

  /**
   * Check if a teacher can teach a specific subject (boolean version)
   */
  canTeacherTeachSubject(teacher: ParsedTeacher, subjectId: number): boolean {
    return this.getTeacherSubjectCompatibility(teacher, subjectId) !== 'incompatible';
  }

  // =========================================================================
  // Workload Calculation
  // =========================================================================

  /**
   * Calculate total assigned periods for a teacher
   * Requirements: 2.2, 2.5
   */
  calculateTotalAssignedPeriods(
    teacher: ParsedTeacher,
    subjects: ParsedSubject[],
    classes: ParsedClass[]
  ): number {
    let totalPeriods = 0;

    // Ensure classAssignments is an array before iterating
    const teacherAssignments = Array.isArray(teacher.classAssignments)
      ? teacher.classAssignments
      : [];
    for (const assignment of teacherAssignments) {
      const subjectId =
        typeof assignment.subjectId === 'string'
          ? parseInt(assignment.subjectId, 10)
          : assignment.subjectId;
      const subject = subjects.find((s) => s.id === subjectId);

      // Ensure classIds is an array before iterating
      const assignmentClassIds = Array.isArray(assignment.classIds) ? assignment.classIds : [];
      for (const classIdStr of assignmentClassIds) {
        const classId = typeof classIdStr === 'string' ? parseInt(classIdStr, 10) : classIdStr;
        const classGroup = classes.find((c) => c.id === classId);
        const classRequirements = ensureSubjectRequirementsArray(classGroup?.subjectRequirements);
        const requirement = classRequirements.find((r) => r.subjectId === subjectId);

        if (requirement?.periodsPerWeek) {
          totalPeriods += requirement.periodsPerWeek;
        } else if (subject?.periodsPerWeek) {
          totalPeriods += subject.periodsPerWeek;
        } else {
          totalPeriods += 1;
        }
      }
    }

    return totalPeriods;
  }

  /**
   * Determine workload status based on current and max periods
   * Requirements: 2.3, 2.4
   */
  determineWorkloadStatus(totalPeriods: number, maxPeriods: number): WorkloadStatus {
    if (maxPeriods <= 0) {
      return 'underloaded';
    }

    const utilizationPercentage = (totalPeriods / maxPeriods) * 100;
    const remainingCapacity = maxPeriods - totalPeriods;

    if (totalPeriods > maxPeriods) {
      return 'overloaded';
    }
    if (remainingCapacity <= NEAR_CAPACITY_THRESHOLD) {
      return 'near_capacity';
    }
    if (utilizationPercentage >= 50) {
      return 'optimal';
    }
    return 'underloaded';
  }

  /**
   * Calculate complete workload information for a teacher
   * Requirements: 2.1, 2.2, 2.5
   */
  async calculateTeacherWorkload(teacherId: number): Promise<ServiceResult<TeacherWorkload>> {
    try {
      const teacher = await this.teacherRepository.getTeacher(teacherId);
      if (!teacher) {
        return { success: false, error: `Teacher with ID ${teacherId} not found` };
      }

      const subjects = await this.subjectRepository.getAllSubjectsUnpaginated();
      const classes = await this.classRepository.getAllClassesUnpaginated();

      const breakdown = this.calculateWorkloadBreakdown(teacher, subjects, classes);
      const totalPeriods = breakdown.reduce((sum, b) => sum + b.totalPeriods, 0);
      const maxPeriods = teacher.maxPeriodsPerWeek;
      const utilizationPercentage = maxPeriods > 0 ? (totalPeriods / maxPeriods) * 100 : 0;
      const remainingCapacity = maxPeriods - totalPeriods;
      const status = this.determineWorkloadStatus(totalPeriods, maxPeriods);

      return {
        success: true,
        data: {
          teacherId: teacher.id,
          totalPeriods,
          maxPeriods,
          utilizationPercentage,
          breakdown,
          status,
          remainingCapacity,
        },
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('AssignmentService: Failed to calculate workload', error, { teacherId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Calculate workload breakdown by subject
   */
  private calculateWorkloadBreakdown(
    teacher: ParsedTeacher,
    subjects: ParsedSubject[],
    classes: ParsedClass[]
  ): WorkloadBreakdown[] {
    const breakdown: WorkloadBreakdown[] = [];

    // Ensure classAssignments is an array before iterating
    const teacherAssignments = Array.isArray(teacher.classAssignments)
      ? teacher.classAssignments
      : [];
    for (const assignment of teacherAssignments) {
      const subjectId =
        typeof assignment.subjectId === 'string'
          ? parseInt(assignment.subjectId, 10)
          : assignment.subjectId;
      const subject = subjects.find((s) => s.id === subjectId);
      const subjectName = subject?.name || `Subject ${subjectId}`;

      let totalPeriods = 0;
      let periodsPerWeek = subject?.periodsPerWeek || 0;
      const classIds: number[] = [];

      // Ensure classIds is an array before iterating
      const assignmentClassIds = Array.isArray(assignment.classIds) ? assignment.classIds : [];
      for (const classIdStr of assignmentClassIds) {
        const classId = typeof classIdStr === 'string' ? parseInt(classIdStr, 10) : classIdStr;
        classIds.push(classId);
        const classGroup = classes.find((c) => c.id === classId);
        const classRequirements = ensureSubjectRequirementsArray(classGroup?.subjectRequirements);
        const requirement = classRequirements.find((r) => r.subjectId === subjectId);

        const periods = requirement?.periodsPerWeek || periodsPerWeek || 1;
        totalPeriods += periods;

        if (requirement?.periodsPerWeek) {
          periodsPerWeek = requirement.periodsPerWeek;
        }
      }

      breakdown.push({
        subjectId,
        subjectName,
        classIds,
        periodsPerWeek,
        totalPeriods,
      });
    }

    return breakdown;
  }

  // =========================================================================
  // Assignment Validation
  // =========================================================================

  /**
   * Validate an assignment request
   * Requirements: 5.1, 5.2, 5.3, 5.4, 6.5
   */
  async validateAssignment(
    request: AssignmentValidationRequest
  ): Promise<ServiceResult<AssignmentValidationResult>> {
    try {
      const teacher = await this.teacherRepository.getTeacher(request.teacherId);
      if (!teacher) {
        return { success: false, error: `Teacher with ID ${request.teacherId} not found` };
      }

      const subject = await this.subjectRepository.getSubject(request.subjectId);
      if (!subject) {
        return { success: false, error: `Subject with ID ${request.subjectId} not found` };
      }

      const classes = await this.classRepository.getAllClassesUnpaginated();
      const subjects = await this.subjectRepository.getAllSubjectsUnpaginated();
      const teachers = await this.teacherRepository.getAllTeachersUnpaginated();

      const requestedClasses = classes.filter((c) => request.classIds.includes(c.id));
      if (requestedClasses.length !== request.classIds.length) {
        const foundIds = requestedClasses.map((c) => c.id);
        const missingIds = request.classIds.filter((id) => !foundIds.includes(id));
        return { success: false, error: `Classes not found: ${missingIds.join(', ')}` };
      }

      const conflicts: AssignmentConflict[] = [];
      const warnings: AssignmentConflict[] = [];

      // 1. Validate teacher-subject compatibility
      // Note: Subject incompatibility is now a warning, not a blocking conflict,
      // because the assignment will automatically add the subject to teacher's primarySubjectIds
      const compatibility = this.getTeacherSubjectCompatibility(teacher, request.subjectId);
      if (compatibility === 'incompatible') {
        // Changed from conflict to warning - subject will be added to teacher's primarySubjectIds
        warnings.push({
          ...this.createIncompatibleSubjectConflict(teacher, subject),
          severity: 'warning',
          message: `Subject "${subject.name}" will be added to teacher's primary subjects`,
          messageFa: `مضمون "${subject.name}" به لیست مضامین اصلی معلم اضافه خواهد شد`,
        });
      }

      // 2. Validate workload
      const currentWorkload = this.calculateTotalAssignedPeriods(teacher, subjects, classes);
      const additionalPeriods = request.classIds.length * request.periodsPerWeek;
      const newTotalWorkload = currentWorkload + additionalPeriods;

      if (newTotalWorkload > teacher.maxPeriodsPerWeek) {
        conflicts.push(this.createWorkloadExceededConflict(teacher, newTotalWorkload));
      } else if (newTotalWorkload > teacher.maxPeriodsPerWeek - NEAR_CAPACITY_THRESHOLD) {
        warnings.push(this.createNearCapacityWarning(teacher, newTotalWorkload));
      }

      // 3. Check for duplicate assignments
      // Ensure classAssignments is an array before calling .find()
      const teacherAssignments = Array.isArray(teacher.classAssignments)
        ? teacher.classAssignments
        : [];
      const existingAssignment = teacherAssignments.find((a) => {
        const aSubjectId =
          typeof a.subjectId === 'string' ? parseInt(a.subjectId, 10) : a.subjectId;
        return aSubjectId === request.subjectId;
      });
      if (existingAssignment) {
        const existingClassIds = Array.isArray(existingAssignment.classIds)
          ? existingAssignment.classIds.map((id) =>
              typeof id === 'string' ? parseInt(id, 10) : id
            )
          : [];
        const duplicateClasses = request.classIds.filter((classId) =>
          existingClassIds.includes(classId)
        );
        if (duplicateClasses.length > 0) {
          warnings.push(this.createDuplicateAssignmentWarning(teacher, subject, duplicateClasses));
        }
      }

      // 4. Check if classes already have this subject assigned to another teacher
      for (const classId of request.classIds) {
        const classGroup = requestedClasses.find((c) => c.id === classId);
        if (classGroup) {
          const classRequirements = ensureSubjectRequirementsArray(classGroup.subjectRequirements);
          const existingReq = classRequirements.find(
            (r) => r.subjectId === request.subjectId && r.teacherId && r.teacherId !== teacher.id
          );
          if (existingReq) {
            const existingTeacher = teachers.find((t) => t.id === existingReq.teacherId);
            warnings.push(
              this.createClassAlreadyAssignedWarning(
                classGroup,
                subject,
                existingTeacher?.fullName || `Teacher ${existingReq.teacherId}`
              )
            );
          }
        }
      }

      return {
        success: true,
        data: {
          isValid: conflicts.length === 0,
          conflicts,
          warnings,
        },
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('AssignmentService: Failed to validate assignment', error);
      return { success: false, error: error.message };
    }
  }

  // =========================================================================
  // Conflict Factory Functions
  // =========================================================================

  private createIncompatibleSubjectConflict(
    teacher: ParsedTeacher,
    subject: ParsedSubject
  ): AssignmentConflict {
    return {
      type: 'subject_incompatible',
      severity: 'error',
      message: `Teacher "${teacher.fullName}" cannot teach "${subject.name}"`,
      messageFa: `معلم "${teacher.fullName}" مجاز به تدریس "${subject.name}" نیست`,
      affectedEntities: {
        teacherId: teacher.id,
        subjectId: subject.id,
      },
      suggestedResolution: `Add "${subject.name}" to teacher's allowed subjects or select a different teacher`,
      suggestedResolutionFa: `"${subject.name}" را به لیست مضامین مجاز معلم اضافه کنید یا معلم دیگری انتخاب کنید`,
    };
  }

  private createWorkloadExceededConflict(
    teacher: ParsedTeacher,
    newTotalWorkload: number
  ): AssignmentConflict {
    return {
      type: 'workload_exceeded',
      severity: 'error',
      message: `Assignment would exceed teacher's maximum workload (${newTotalWorkload}/${teacher.maxPeriodsPerWeek} periods)`,
      messageFa: `این تخصیص باعث تجاوز از حداکثر ساعات معلم می‌شود (${newTotalWorkload}/${teacher.maxPeriodsPerWeek} ساعت)`,
      affectedEntities: {
        teacherId: teacher.id,
      },
      suggestedResolution: `Reduce assignments or increase teacher's maximum periods per week`,
      suggestedResolutionFa: `تعداد تخصیص‌ها را کاهش دهید یا حداکثر ساعات هفتگی معلم را افزایش دهید`,
    };
  }

  private createNearCapacityWarning(
    teacher: ParsedTeacher,
    newTotalWorkload: number
  ): AssignmentConflict {
    return {
      type: 'workload_exceeded',
      severity: 'warning',
      message: `Teacher is approaching maximum workload (${newTotalWorkload}/${teacher.maxPeriodsPerWeek} periods)`,
      messageFa: `معلم به حداکثر ساعات نزدیک می‌شود (${newTotalWorkload}/${teacher.maxPeriodsPerWeek} ساعت)`,
      affectedEntities: {
        teacherId: teacher.id,
      },
    };
  }

  private createDuplicateAssignmentWarning(
    teacher: ParsedTeacher,
    subject: ParsedSubject,
    duplicateClassIds: number[]
  ): AssignmentConflict {
    return {
      type: 'duplicate_assignment',
      severity: 'warning',
      message: `Teacher "${teacher.fullName}" is already assigned to teach "${subject.name}" in ${duplicateClassIds.length} of these classes`,
      messageFa: `معلم "${teacher.fullName}" قبلاً برای تدریس "${subject.name}" در ${duplicateClassIds.length} صنف از این صنف‌ها تخصیص یافته است`,
      affectedEntities: {
        teacherId: teacher.id,
        subjectId: subject.id,
      },
    };
  }

  private createClassAlreadyAssignedWarning(
    classGroup: ParsedClass,
    subject: ParsedSubject,
    existingTeacherName: string
  ): AssignmentConflict {
    return {
      type: 'duplicate_assignment',
      severity: 'warning',
      message: `"${existingTeacherName}" will be replaced as the teacher for "${subject.name}" in class "${classGroup.displayName || classGroup.name}"`,
      messageFa: `"${existingTeacherName}" به عنوان معلم "${subject.name}" در صنف "${classGroup.displayName || classGroup.name}" جایگزین خواهد شد`,
      affectedEntities: {
        classId: classGroup.id,
        subjectId: subject.id,
      },
      suggestedResolution: `The previous teacher will be automatically unassigned`,
      suggestedResolutionFa: `معلم قبلی به صورت خودکار حذف خواهد شد`,
    };
  }

  // =========================================================================
  // Assignment Operations
  // =========================================================================

  /**
   * Assign a teacher to subject-class combinations
   * Requirements: 1.6, 3.5
   *
   * Uses database transaction to ensure atomic updates across:
   * - Teacher.classAssignments (old system)
   * - Class.subjectRequirements (old system)
   * - TeacherClassSubjectAssignment table (new system)
   */
  async assignTeacher(
    teacherId: number,
    subjectId: number,
    classIds: number[],
    periodsPerWeek: number
  ): Promise<ServiceResult<AssignmentOperationResult>> {
    logger.info('[AssignmentService] assignTeacher called', {
      teacherId,
      subjectId,
      classIds,
      periodsPerWeek,
    });

    try {
      // Validate first (outside transaction - read-only)
      logger.info('[AssignmentService] Running validation...');
      const validationResult = await this.validateAssignment({
        teacherId,
        subjectId,
        classIds,
        periodsPerWeek,
      });

      logger.info('[AssignmentService] Validation result', {
        success: validationResult.success,
        error: validationResult.error,
        isValid: validationResult.data?.isValid,
        conflictsCount: validationResult.data?.conflicts?.length,
        warningsCount: validationResult.data?.warnings?.length,
      });

      if (!validationResult.success) {
        logger.warn('[AssignmentService] Validation failed', { error: validationResult.error });
        return { success: false, error: validationResult.error };
      }

      if (!validationResult.data?.isValid) {
        logger.warn('[AssignmentService] Validation returned isValid=false', {
          conflicts: validationResult.data?.conflicts,
        });
        return {
          success: true,
          data: {
            success: false,
            conflicts: validationResult.data?.conflicts || [],
          },
        };
      }

      // Execute all writes within a transaction for atomicity
      logger.info('[AssignmentService] Starting transaction for assignment...');
      const result = await this.dataSource.transaction(async (manager: EntityManager) => {
        return this.executeAssignTeacher(manager, teacherId, subjectId, classIds, periodsPerWeek);
      });

      logger.info('[AssignmentService] Transaction result', { result });

      if (result.success) {
        logger.info('[AssignmentService] Assignment completed successfully', {
          teacherId,
          subjectId,
          classIds,
        });
      }

      return {
        success: true,
        data: {
          success: result.success,
          conflicts: result.success ? validationResult.data?.warnings || [] : result.conflicts,
          updatedTeacherId: teacherId,
          updatedClassIds: classIds,
        },
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error(
        `[AssignmentService] Failed to assign teacher: teacherId=${teacherId}, subjectId=${subjectId}, classIds=${classIds.join(',')}`,
        error
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute assignment within a transaction
   * SINGLE-TEACHER ENFORCEMENT: Each class-subject can only have ONE teacher.
   * Assigning a new teacher will automatically remove the previous teacher.
   * @private
   */
  private async executeAssignTeacher(
    manager: EntityManager,
    teacherId: number,
    subjectId: number,
    classIds: number[],
    periodsPerWeek: number
  ): Promise<{ success: boolean; conflicts: AssignmentConflict[] }> {
    logger.info(
      '[AssignmentService.executeAssignTeacher] Starting execution (single-teacher mode)',
      {
        teacherId,
        subjectId,
        classIds,
        periodsPerWeek,
      }
    );

    // Get current teacher data - SKIP CACHE to ensure fresh data
    // This is critical when multiple assignments are made in quick succession
    const teacher = await this.teacherRepository.getTeacher(teacherId, { skipCache: true });
    if (!teacher) {
      logger.error(
        `[AssignmentService.executeAssignTeacher] Teacher not found: teacherId=${teacherId}`
      );
      throw new Error(`Teacher with ID ${teacherId} not found`);
    }

    // Get all teachers to find previous assignments - also skip cache
    const allTeachers = await this.teacherRepository.getAllTeachersUnpaginated({ skipCache: true });

    logger.info('[AssignmentService.executeAssignTeacher] Teacher found', {
      teacherId: teacher.id,
      teacherName: teacher.fullName,
      currentPrimarySubjectIds: teacher.primarySubjectIds,
      currentClassAssignments: teacher.classAssignments,
    });

    // =========================================================================
    // STEP 1: Remove previous teacher assignments for these class-subject pairs
    // This enforces single-teacher per class-subject
    // =========================================================================
    for (const classId of classIds) {
      // Find and remove from old teacher's classAssignments
      for (const otherTeacher of allTeachers) {
        if (otherTeacher.id === teacherId) continue; // Skip the new teacher

        const otherAssignments = Array.isArray(otherTeacher.classAssignments)
          ? otherTeacher.classAssignments
          : [];

        let needsUpdate = false;
        const updatedOtherAssignments = otherAssignments
          .map((a) => {
            const aSubjectId =
              typeof a.subjectId === 'string' ? parseInt(a.subjectId, 10) : a.subjectId;
            if (aSubjectId !== subjectId) return a;

            const existingClassIds = Array.isArray(a.classIds)
              ? a.classIds.map((id) => (typeof id === 'string' ? parseInt(id, 10) : id))
              : [];

            if (existingClassIds.includes(classId)) {
              needsUpdate = true;
              const remainingClassIds = existingClassIds.filter((id) => id !== classId);

              if (remainingClassIds.length === 0) {
                return null; // Remove entire assignment entry
              }

              return {
                subjectId: String(subjectId),
                classIds: remainingClassIds.map(String),
              };
            }
            return a;
          })
          .filter((a): a is NonNullable<typeof a> => a !== null);

        if (needsUpdate) {
          logger.info(
            '[AssignmentService.executeAssignTeacher] Removing previous teacher assignment',
            {
              previousTeacherId: otherTeacher.id,
              previousTeacherName: otherTeacher.fullName,
              classId,
              subjectId,
            }
          );

          await this.teacherRepository.updateTeacher(
            otherTeacher.id,
            { classAssignments: updatedOtherAssignments },
            { manager }
          );
        }
      }

      // Remove from TeacherClassSubjectAssignment table (any existing assignment for this class-subject)
      const existingAssignments = await this.teacherAssignmentRepository.findByClassAndSubject(
        classId,
        subjectId
      );

      for (const existing of existingAssignments) {
        if (existing.teacherId !== teacherId) {
          logger.info(
            '[AssignmentService.executeAssignTeacher] Removing previous assignment record',
            {
              existingId: existing.id,
              previousTeacherId: existing.teacherId,
              classId,
              subjectId,
            }
          );
          await this.teacherAssignmentRepository.deleteAssignment(existing.id, { manager });
        }
      }
    }

    // =========================================================================
    // STEP 2: Add subject to new teacher's primarySubjectIds if not already there
    // =========================================================================
    const currentPrimarySubjectIds = Array.isArray(teacher.primarySubjectIds)
      ? teacher.primarySubjectIds
      : [];
    const updatedPrimarySubjectIds = currentPrimarySubjectIds.includes(subjectId)
      ? currentPrimarySubjectIds
      : [...currentPrimarySubjectIds, subjectId];

    logger.info('[AssignmentService.executeAssignTeacher] Updating primarySubjectIds', {
      currentPrimarySubjectIds,
      updatedPrimarySubjectIds,
      subjectIdToAdd: subjectId,
    });

    // =========================================================================
    // STEP 3: Update new teacher's classAssignments (replace, not merge)
    // =========================================================================
    const currentAssignments = Array.isArray(teacher.classAssignments)
      ? teacher.classAssignments
      : [];
    const updatedAssignments = [...currentAssignments];
    const existingIndex = updatedAssignments.findIndex((a) => {
      const aSubjectId = typeof a.subjectId === 'string' ? parseInt(a.subjectId, 10) : a.subjectId;
      return aSubjectId === subjectId;
    });

    if (existingIndex >= 0) {
      // Merge with existing assignment for this teacher
      const existing = updatedAssignments[existingIndex];
      const existingClassIds = Array.isArray(existing.classIds)
        ? existing.classIds.map((id) => (typeof id === 'string' ? parseInt(id, 10) : id))
        : [];
      const newClassIds = [...new Set([...existingClassIds, ...classIds])];
      updatedAssignments[existingIndex] = {
        subjectId: String(subjectId),
        classIds: newClassIds.map(String),
      };
      logger.info('[AssignmentService.executeAssignTeacher] Merged with existing assignment', {
        existingClassIds,
        newClassIds,
      });
    } else {
      // Add new assignment
      updatedAssignments.push({
        subjectId: String(subjectId),
        classIds: classIds.map(String),
      });
      logger.info('[AssignmentService.executeAssignTeacher] Added new assignment entry');
    }

    logger.info('[AssignmentService.executeAssignTeacher] Updating teacher record', {
      updatedAssignments,
      updatedPrimarySubjectIds,
    });

    // Save teacher updates including primarySubjectIds (using manager for transaction)
    await this.teacherRepository.updateTeacher(
      teacherId,
      {
        classAssignments: updatedAssignments,
        primarySubjectIds: updatedPrimarySubjectIds,
      },
      { manager }
    );

    logger.info('[AssignmentService.executeAssignTeacher] Teacher record updated');

    // =========================================================================
    // STEP 4: Update class subjectRequirements (bidirectional update)
    // =========================================================================
    logger.info('[AssignmentService.executeAssignTeacher] Updating class subjectRequirements...');
    for (const classId of classIds) {
      const classGroup = await this.classRepository.getClass(classId);
      if (classGroup) {
        const currentRequirements = ensureSubjectRequirementsArray(classGroup.subjectRequirements);
        const updatedRequirements = [...currentRequirements];
        const reqIndex = updatedRequirements.findIndex((r) => r.subjectId === subjectId);

        logger.info('[AssignmentService.executeAssignTeacher] Class requirements update', {
          classId,
          className: classGroup.name,
          currentRequirements,
          reqIndex,
        });

        if (reqIndex >= 0) {
          // Replace teacher (single-teacher enforcement)
          updatedRequirements[reqIndex] = {
            ...updatedRequirements[reqIndex],
            teacherId,
          };
          logger.info('[AssignmentService.executeAssignTeacher] Replaced teacher in requirement', {
            classId,
            updatedRequirement: updatedRequirements[reqIndex],
          });
        } else {
          updatedRequirements.push({
            subjectId,
            periodsPerWeek,
            teacherId,
          });
          logger.info('[AssignmentService.executeAssignTeacher] Added new requirement', {
            classId,
            newRequirement: { subjectId, periodsPerWeek, teacherId },
          });
        }

        await this.classRepository.updateClass(
          classId,
          {
            subjectRequirements: updatedRequirements,
          },
          { manager }
        );
        logger.info('[AssignmentService.executeAssignTeacher] Class updated', { classId });
      } else {
        logger.warn('[AssignmentService.executeAssignTeacher] Class not found', { classId });
      }
    }

    // =========================================================================
    // STEP 5: DUAL-WRITE to TeacherClassSubjectAssignment table
    // Single-teacher enforcement: one record per class-subject
    // Uses upsert to handle race conditions and duplicate requests safely
    // =========================================================================
    logger.info('[AssignmentService.executeAssignTeacher] Dual-write to assignment table...');
    for (const classId of classIds) {
      // Use upsert to safely handle duplicates and race conditions
      logger.info('[AssignmentService.executeAssignTeacher] Upserting assignment record', {
        teacherId,
        classId,
        subjectId,
        periodsPerWeek,
      });

      await this.teacherAssignmentRepository.upsertAssignment(
        {
          teacherId,
          classId,
          subjectId,
          periodsPerWeek,
          isFixed: true,
        },
        { manager }
      );
    }

    logger.info('[AssignmentService.executeAssignTeacher] Execution completed successfully');
    return { success: true, conflicts: [] };
  }

  /**
   * Unassign a teacher from subject-class combinations
   * Requirements: 1.6, 3.5
   *
   * Uses database transaction to ensure atomic updates across:
   * - Teacher.classAssignments (old system)
   * - Class.subjectRequirements (old system)
   * - TeacherClassSubjectAssignment table (new system)
   */
  async unassignTeacher(
    teacherId: number,
    subjectId: number,
    classIds: number[]
  ): Promise<ServiceResult<AssignmentOperationResult>> {
    try {
      const teacher = await this.teacherRepository.getTeacher(teacherId);
      if (!teacher) {
        return { success: false, error: `Teacher with ID ${teacherId} not found` };
      }

      // Execute all writes within a transaction for atomicity
      await this.dataSource.transaction(async (manager: EntityManager) => {
        await this.executeUnassignTeacher(manager, teacherId, subjectId, classIds, teacher);
      });

      logger.info('AssignmentService: Unassigned teacher (transactional)', {
        teacherId,
        subjectId,
        classIds,
      });

      return {
        success: true,
        data: {
          success: true,
          conflicts: [],
          updatedTeacherId: teacherId,
          updatedClassIds: classIds,
        },
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('AssignmentService: Failed to unassign teacher', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute unassignment within a transaction
   * @private
   */
  private async executeUnassignTeacher(
    manager: EntityManager,
    teacherId: number,
    subjectId: number,
    classIds: number[],
    teacher: ParsedTeacher
  ): Promise<void> {
    // Update teacher's classAssignments
    // Ensure classAssignments is an array before processing
    const currentAssignments = Array.isArray(teacher.classAssignments)
      ? teacher.classAssignments
      : [];
    const updatedAssignments = currentAssignments
      .map((a) => {
        const aSubjectId =
          typeof a.subjectId === 'string' ? parseInt(a.subjectId, 10) : a.subjectId;
        if (aSubjectId !== subjectId) {
          return a;
        }

        const existingClassIds = Array.isArray(a.classIds)
          ? a.classIds.map((id) => (typeof id === 'string' ? parseInt(id, 10) : id))
          : [];
        const remainingClassIds = existingClassIds.filter((id) => !classIds.includes(id));

        if (remainingClassIds.length === 0) {
          return null; // Remove entire assignment
        }

        return {
          subjectId: String(subjectId),
          classIds: remainingClassIds.map(String),
        };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);

    // Save teacher updates (using manager for transaction)
    await this.teacherRepository.updateTeacher(
      teacherId,
      {
        classAssignments: updatedAssignments,
      },
      { manager }
    );

    // Update class subjectRequirements (bidirectional update)
    for (const classId of classIds) {
      const classGroup = await this.classRepository.getClass(classId);
      if (classGroup) {
        const currentRequirements = ensureSubjectRequirementsArray(classGroup.subjectRequirements);
        const updatedRequirements = currentRequirements.map((r) => {
          if (r.subjectId === subjectId && r.teacherId === teacherId) {
            return { ...r, teacherId: undefined };
          }
          return r;
        });

        await this.classRepository.updateClass(
          classId,
          {
            subjectRequirements: updatedRequirements,
          },
          { manager }
        );
      }
    }

    // DUAL-WRITE: Also delete from TeacherClassSubjectAssignment table
    // This is now part of the transaction for consistency
    for (const classId of classIds) {
      const existing = await this.teacherAssignmentRepository.findExisting(
        teacherId,
        classId,
        subjectId
      );

      if (existing) {
        await this.teacherAssignmentRepository.deleteAssignment(existing.id, { manager });
      }
    }
  }

  // =========================================================================
  // Coverage Analysis
  // =========================================================================

  /**
   * Calculate coverage analysis for a subject
   * Requirements: 4.2, 6.5
   */
  async calculateSubjectCoverage(subjectId: number): Promise<ServiceResult<SubjectCoverage>> {
    try {
      const subject = await this.subjectRepository.getSubject(subjectId);
      if (!subject) {
        return { success: false, error: `Subject with ID ${subjectId} not found` };
      }

      const classes = await this.classRepository.getAllClassesUnpaginated();
      const teachers = await this.teacherRepository.getAllTeachersUnpaginated();

      // Find classes that require this subject
      const classesRequiringSubject = classes.filter((c) => {
        const requirements = ensureSubjectRequirementsArray(c.subjectRequirements);
        return requirements.some((r) => r.subjectId === subjectId);
      });

      const unassignedClasses: ClassCoverageDetail[] = [];
      const teacherMap = new Map<number, { classIds: number[]; totalPeriods: number }>();
      let assignedCount = 0;

      for (const classGroup of classesRequiringSubject) {
        const classRequirements = ensureSubjectRequirementsArray(classGroup.subjectRequirements);
        const requirement = classRequirements.find((r) => r.subjectId === subjectId);
        if (!requirement) continue;

        const assignedTeacher = requirement.teacherId
          ? teachers.find((t) => t.id === requirement.teacherId)
          : null;

        if (assignedTeacher) {
          assignedCount++;
          const existing = teacherMap.get(assignedTeacher.id) || { classIds: [], totalPeriods: 0 };
          existing.classIds.push(classGroup.id);
          existing.totalPeriods += requirement.periodsPerWeek;
          teacherMap.set(assignedTeacher.id, existing);
        } else {
          unassignedClasses.push({
            classId: classGroup.id,
            className: classGroup.displayName || classGroup.name,
            periodsPerWeek: requirement.periodsPerWeek,
            assignmentStatus: 'unassigned',
            assignedTeacherId: null,
            assignedTeacherName: null,
            conflicts: [],
          });
        }
      }

      // Build teacher distribution
      const teacherDistribution: TeacherCoverageDetail[] = [];
      for (const [tId, data] of teacherMap.entries()) {
        const teacher = teachers.find((t) => t.id === tId);
        if (teacher) {
          teacherDistribution.push({
            teacherId: tId,
            teacherName: teacher.fullName,
            assignedClassIds: data.classIds,
            totalPeriods: data.totalPeriods,
            compatibility: this.getTeacherSubjectCompatibility(teacher, subjectId),
          });
        }
      }

      const totalClassesRequiring = classesRequiringSubject.length;
      const coveragePercentage =
        totalClassesRequiring > 0 ? (assignedCount / totalClassesRequiring) * 100 : 100;

      let status: 'complete' | 'partial' | 'uncovered';
      if (coveragePercentage === 100) {
        status = 'complete';
      } else if (coveragePercentage > 0) {
        status = 'partial';
      } else {
        status = 'uncovered';
      }

      return {
        success: true,
        data: {
          subjectId,
          subjectName: subject.name,
          totalClassesRequiring,
          assignedClasses: assignedCount,
          unassignedClasses,
          teacherDistribution,
          coveragePercentage,
          status,
        },
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('AssignmentService: Failed to calculate coverage', error, { subjectId });
      return { success: false, error: error.message };
    }
  }

  // =========================================================================
  // Conflict Detection
  // =========================================================================

  /**
   * Detect all conflicts across the system
   * Requirements: 6.1, 6.5
   */
  async detectAllConflicts(): Promise<ServiceResult<AssignmentConflict[]>> {
    try {
      const teachers = await this.teacherRepository.getAllTeachersUnpaginated();
      const subjects = await this.subjectRepository.getAllSubjectsUnpaginated();
      const classes = await this.classRepository.getAllClassesUnpaginated();

      const conflicts: AssignmentConflict[] = [];

      // 1. Check all teacher conflicts
      for (const teacher of teachers) {
        const teacherConflicts = this.detectTeacherConflicts(teacher, subjects, classes);
        conflicts.push(...teacherConflicts);
      }

      // 2. Check all subject coverage conflicts
      for (const subject of subjects) {
        const coverageConflict = this.detectCoverageConflict(subject, classes);
        if (coverageConflict) {
          conflicts.push(coverageConflict);
        }
      }

      // 3. Check for duplicate assignments
      const duplicateConflicts = this.detectDuplicateAssignments(teachers, subjects, classes);
      conflicts.push(...duplicateConflicts);

      return { success: true, data: conflicts };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('AssignmentService: Failed to detect conflicts', error);
      return { success: false, error: error.message };
    }
  }

  private detectTeacherConflicts(
    teacher: ParsedTeacher,
    subjects: ParsedSubject[],
    classes: ParsedClass[]
  ): AssignmentConflict[] {
    const conflicts: AssignmentConflict[] = [];

    // Check workload
    const totalPeriods = this.calculateTotalAssignedPeriods(teacher, subjects, classes);
    if (totalPeriods > teacher.maxPeriodsPerWeek) {
      conflicts.push({
        type: 'workload_exceeded',
        severity: 'error',
        message: `Teacher "${teacher.fullName}" is overloaded: ${totalPeriods}/${teacher.maxPeriodsPerWeek} periods`,
        messageFa: `معلم "${teacher.fullName}" بیش از حد بارگذاری شده: ${totalPeriods}/${teacher.maxPeriodsPerWeek} ساعت`,
        affectedEntities: { teacherId: teacher.id },
        suggestedResolution: `Remove ${totalPeriods - teacher.maxPeriodsPerWeek} periods of assignments`,
        suggestedResolutionFa: `${totalPeriods - teacher.maxPeriodsPerWeek} ساعت از تخصیص‌ها را حذف کنید`,
      });
    }

    // Check subject compatibility
    // Ensure classAssignments is an array before iterating
    const teacherAssignments = Array.isArray(teacher.classAssignments)
      ? teacher.classAssignments
      : [];
    for (const assignment of teacherAssignments) {
      const subjectId =
        typeof assignment.subjectId === 'string'
          ? parseInt(assignment.subjectId, 10)
          : assignment.subjectId;
      const compatibility = this.getTeacherSubjectCompatibility(teacher, subjectId);

      if (compatibility === 'incompatible') {
        const subject = subjects.find((s) => s.id === subjectId);
        conflicts.push({
          type: 'subject_incompatible',
          severity: 'error',
          message: `Teacher "${teacher.fullName}" is assigned to teach "${subject?.name || `Subject ${subjectId}`}" but is not qualified`,
          messageFa: `معلم "${teacher.fullName}" برای تدریس "${subject?.name || `مضمون ${subjectId}`}" تخصیص یافته اما صلاحیت ندارد`,
          affectedEntities: { teacherId: teacher.id, subjectId },
          suggestedResolution: `Add subject to teacher's allowed subjects or reassign to a qualified teacher`,
          suggestedResolutionFa: `مضمون را به لیست مجاز معلم اضافه کنید یا به معلم واجد شرایط تخصیص دهید`,
        });
      }
    }

    return conflicts;
  }

  private detectCoverageConflict(
    subject: ParsedSubject,
    classes: ParsedClass[]
  ): AssignmentConflict | null {
    const classesRequiringSubject = classes.filter((c) => {
      const requirements = ensureSubjectRequirementsArray(c.subjectRequirements);
      return requirements.some((r) => r.subjectId === subject.id);
    });

    if (classesRequiringSubject.length === 0) {
      return null;
    }

    const unassignedClasses = classesRequiringSubject.filter((c) => {
      const requirements = ensureSubjectRequirementsArray(c.subjectRequirements);
      const req = requirements.find((r) => r.subjectId === subject.id);
      return !req?.teacherId;
    });

    if (unassignedClasses.length > 0) {
      return {
        type: 'coverage_insufficient',
        severity: 'warning',
        message: `Subject "${subject.name}" has ${unassignedClasses.length} classes without assigned teachers`,
        messageFa: `مضمون "${subject.name}" دارای ${unassignedClasses.length} صنف بدون معلم تخصیص یافته است`,
        affectedEntities: { subjectId: subject.id },
        suggestedResolution: `Assign teachers to the remaining classes`,
        suggestedResolutionFa: `معلم‌ها را به صنف‌های باقیمانده تخصیص دهید`,
      };
    }

    return null;
  }

  private detectDuplicateAssignments(
    teachers: ParsedTeacher[],
    subjects: ParsedSubject[],
    classes: ParsedClass[]
  ): AssignmentConflict[] {
    const conflicts: AssignmentConflict[] = [];
    const assignmentMap = new Map<string, number[]>();

    for (const teacher of teachers) {
      // Ensure classAssignments is an array before iterating
      const teacherAssignments = Array.isArray(teacher.classAssignments)
        ? teacher.classAssignments
        : [];
      for (const assignment of teacherAssignments) {
        const subjectId =
          typeof assignment.subjectId === 'string'
            ? parseInt(assignment.subjectId, 10)
            : assignment.subjectId;

        // Ensure classIds is an array before iterating
        const assignmentClassIds = Array.isArray(assignment.classIds) ? assignment.classIds : [];
        for (const classIdStr of assignmentClassIds) {
          const classId = typeof classIdStr === 'string' ? parseInt(classIdStr, 10) : classIdStr;
          const key = `${subjectId}-${classId}`;
          const existing = assignmentMap.get(key) || [];
          existing.push(teacher.id);
          assignmentMap.set(key, existing);
        }
      }
    }

    for (const [key, teacherIds] of assignmentMap.entries()) {
      if (teacherIds.length > 1) {
        const [subjectId, classId] = key.split('-').map(Number);
        const subject = subjects.find((s) => s.id === subjectId);
        const classGroup = classes.find((c) => c.id === classId);
        const teacherNames = teacherIds
          .map((id) => teachers.find((t) => t.id === id)?.fullName || `Teacher ${id}`)
          .join(', ');

        conflicts.push({
          type: 'duplicate_assignment',
          severity: 'error',
          message: `Subject "${subject?.name}" in class "${classGroup?.displayName || classGroup?.name}" is assigned to multiple teachers: ${teacherNames}`,
          messageFa: `مضمون "${subject?.name}" در صنف "${classGroup?.displayName || classGroup?.name}" به چند معلم تخصیص یافته: ${teacherNames}`,
          affectedEntities: { subjectId, classId },
          suggestedResolution: `Remove duplicate assignments, keeping only one teacher`,
          suggestedResolutionFa: `تخصیص‌های تکراری را حذف کنید و فقط یک معلم نگه دارید`,
        });
      }
    }

    return conflicts;
  }

  // =========================================================================
  // Audit & Consistency
  // =========================================================================

  /**
   * Audit assignment data consistency between old and new systems
   * Compares Teacher.classAssignments + Class.subjectRequirements with TeacherClassSubjectAssignment table
   *
   * Requirements: Phase 0 - Data Consistency Foundation
   */
  async auditAssignmentConsistency(): Promise<
    ServiceResult<{
      isConsistent: boolean;
      oldSystemCount: number;
      newSystemCount: number;
      missingInNewSystem: Array<{ teacherId: number; classId: number; subjectId: number }>;
      missingInOldSystem: Array<{ teacherId: number; classId: number; subjectId: number }>;
      periodMismatches: Array<{
        teacherId: number;
        classId: number;
        subjectId: number;
        oldPeriods: number;
        newPeriods: number;
      }>;
    }>
  > {
    try {
      const teachers = await this.teacherRepository.getAllTeachersUnpaginated();
      const classes = await this.classRepository.getAllClassesUnpaginated();
      const newAssignments = await this.teacherAssignmentRepository.getAllAssignments();

      // Build set of assignments from old system (Teacher.classAssignments)
      const oldSystemAssignments = new Map<
        string,
        { teacherId: number; classId: number; subjectId: number; periodsPerWeek: number }
      >();

      for (const teacher of teachers) {
        // Ensure classAssignments is an array before iterating
        const teacherAssignments = Array.isArray(teacher.classAssignments)
          ? teacher.classAssignments
          : [];
        for (const assignment of teacherAssignments) {
          const subjectId =
            typeof assignment.subjectId === 'string'
              ? parseInt(assignment.subjectId, 10)
              : assignment.subjectId;

          // Ensure classIds is an array before iterating
          const assignmentClassIds = Array.isArray(assignment.classIds) ? assignment.classIds : [];
          for (const classIdStr of assignmentClassIds) {
            const classId = typeof classIdStr === 'string' ? parseInt(classIdStr, 10) : classIdStr;
            const classGroup = classes.find((c) => c.id === classId);
            const classRequirements = ensureSubjectRequirementsArray(
              classGroup?.subjectRequirements
            );
            const requirement = classRequirements.find((r) => r.subjectId === subjectId);
            const periodsPerWeek = requirement?.periodsPerWeek || 0;

            const key = `${teacher.id}-${classId}-${subjectId}`;
            oldSystemAssignments.set(key, {
              teacherId: teacher.id,
              classId,
              subjectId,
              periodsPerWeek,
            });
          }
        }
      }

      // Build set of assignments from new system (TeacherClassSubjectAssignment table)
      const newSystemAssignments = new Map<
        string,
        { teacherId: number; classId: number; subjectId: number; periodsPerWeek: number }
      >();

      for (const assignment of newAssignments) {
        const key = `${assignment.teacherId}-${assignment.classId}-${assignment.subjectId}`;
        newSystemAssignments.set(key, {
          teacherId: assignment.teacherId,
          classId: assignment.classId,
          subjectId: assignment.subjectId,
          periodsPerWeek: assignment.periodsPerWeek,
        });
      }

      // Find discrepancies
      const missingInNewSystem: Array<{ teacherId: number; classId: number; subjectId: number }> =
        [];
      const missingInOldSystem: Array<{ teacherId: number; classId: number; subjectId: number }> =
        [];
      const periodMismatches: Array<{
        teacherId: number;
        classId: number;
        subjectId: number;
        oldPeriods: number;
        newPeriods: number;
      }> = [];

      // Check what's in old system but not in new
      for (const [key, oldAssignment] of oldSystemAssignments) {
        const newAssignment = newSystemAssignments.get(key);
        if (!newAssignment) {
          missingInNewSystem.push({
            teacherId: oldAssignment.teacherId,
            classId: oldAssignment.classId,
            subjectId: oldAssignment.subjectId,
          });
        } else if (oldAssignment.periodsPerWeek !== newAssignment.periodsPerWeek) {
          periodMismatches.push({
            teacherId: oldAssignment.teacherId,
            classId: oldAssignment.classId,
            subjectId: oldAssignment.subjectId,
            oldPeriods: oldAssignment.periodsPerWeek,
            newPeriods: newAssignment.periodsPerWeek,
          });
        }
      }

      // Check what's in new system but not in old
      for (const [key, newAssignment] of newSystemAssignments) {
        if (!oldSystemAssignments.has(key)) {
          missingInOldSystem.push({
            teacherId: newAssignment.teacherId,
            classId: newAssignment.classId,
            subjectId: newAssignment.subjectId,
          });
        }
      }

      const isConsistent =
        missingInNewSystem.length === 0 &&
        missingInOldSystem.length === 0 &&
        periodMismatches.length === 0;

      logger.info('AssignmentService: Audit completed', {
        isConsistent,
        oldSystemCount: oldSystemAssignments.size,
        newSystemCount: newSystemAssignments.size,
        missingInNewSystem: missingInNewSystem.length,
        missingInOldSystem: missingInOldSystem.length,
        periodMismatches: periodMismatches.length,
      });

      return {
        success: true,
        data: {
          isConsistent,
          oldSystemCount: oldSystemAssignments.size,
          newSystemCount: newSystemAssignments.size,
          missingInNewSystem,
          missingInOldSystem,
          periodMismatches,
        },
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('AssignmentService: Failed to audit consistency', error);
      return { success: false, error: error.message };
    }
  }

  // =========================================================================
  // Data Cleanup - Single Teacher Enforcement
  // =========================================================================

  /**
   * Clean up duplicate assignments to enforce single-teacher per class-subject.
   * For each class-subject pair with multiple teachers, keeps only the most recent assignment.
   *
   * This is a migration utility to fix existing data that violates the single-teacher rule.
   */
  async cleanupDuplicateAssignments(): Promise<
    ServiceResult<{
      duplicatesFound: number;
      duplicatesRemoved: number;
      details: Array<{
        classId: number;
        subjectId: number;
        keptTeacherId: number;
        removedTeacherIds: number[];
      }>;
    }>
  > {
    try {
      const teachers = await this.teacherRepository.getAllTeachersUnpaginated();
      const classes = await this.classRepository.getAllClassesUnpaginated();
      const subjects = await this.subjectRepository.getAllSubjectsUnpaginated();

      // Build map of class-subject -> teacher assignments
      const assignmentMap = new Map<string, Array<{ teacherId: number; teacherName: string }>>();

      for (const teacher of teachers) {
        const teacherAssignments = Array.isArray(teacher.classAssignments)
          ? teacher.classAssignments
          : [];

        for (const assignment of teacherAssignments) {
          const subjectId =
            typeof assignment.subjectId === 'string'
              ? parseInt(assignment.subjectId, 10)
              : assignment.subjectId;

          const assignmentClassIds = Array.isArray(assignment.classIds) ? assignment.classIds : [];
          for (const classIdStr of assignmentClassIds) {
            const classId = typeof classIdStr === 'string' ? parseInt(classIdStr, 10) : classIdStr;
            const key = `${classId}-${subjectId}`;

            const existing = assignmentMap.get(key) || [];
            existing.push({ teacherId: teacher.id, teacherName: teacher.fullName });
            assignmentMap.set(key, existing);
          }
        }
      }

      // Find duplicates and clean them up
      const details: Array<{
        classId: number;
        subjectId: number;
        keptTeacherId: number;
        removedTeacherIds: number[];
      }> = [];
      let duplicatesFound = 0;
      let duplicatesRemoved = 0;

      await this.dataSource.transaction(async (manager: EntityManager) => {
        for (const [key, teacherList] of assignmentMap.entries()) {
          if (teacherList.length <= 1) continue;

          duplicatesFound++;
          const [classIdStr, subjectIdStr] = key.split('-');
          const classId = parseInt(classIdStr, 10);
          const subjectId = parseInt(subjectIdStr, 10);

          // Keep the first teacher (could be enhanced to keep most recent or primary)
          const keptTeacher = teacherList[0];
          const removedTeachers = teacherList.slice(1);

          logger.info('[AssignmentService.cleanupDuplicateAssignments] Cleaning duplicate', {
            classId,
            subjectId,
            keptTeacherId: keptTeacher.teacherId,
            removedTeacherIds: removedTeachers.map((t) => t.teacherId),
          });

          // Remove from other teachers' classAssignments
          for (const removedTeacher of removedTeachers) {
            const teacher = teachers.find((t) => t.id === removedTeacher.teacherId);
            if (!teacher) continue;

            const currentAssignments = Array.isArray(teacher.classAssignments)
              ? teacher.classAssignments
              : [];

            const updatedAssignments = currentAssignments
              .map((a) => {
                const aSubjectId =
                  typeof a.subjectId === 'string' ? parseInt(a.subjectId, 10) : a.subjectId;
                if (aSubjectId !== subjectId) return a;

                const existingClassIds = Array.isArray(a.classIds)
                  ? a.classIds.map((id) => (typeof id === 'string' ? parseInt(id, 10) : id))
                  : [];
                const remainingClassIds = existingClassIds.filter((id) => id !== classId);

                if (remainingClassIds.length === 0) {
                  return null;
                }

                return {
                  subjectId: String(subjectId),
                  classIds: remainingClassIds.map(String),
                };
              })
              .filter((a): a is NonNullable<typeof a> => a !== null);

            await this.teacherRepository.updateTeacher(
              removedTeacher.teacherId,
              { classAssignments: updatedAssignments },
              { manager }
            );

            // Also remove from TeacherClassSubjectAssignment table
            const existingAssignment = await this.teacherAssignmentRepository.findExisting(
              removedTeacher.teacherId,
              classId,
              subjectId
            );
            if (existingAssignment) {
              await this.teacherAssignmentRepository.deleteAssignment(existingAssignment.id, {
                manager,
              });
            }

            duplicatesRemoved++;
          }

          details.push({
            classId,
            subjectId,
            keptTeacherId: keptTeacher.teacherId,
            removedTeacherIds: removedTeachers.map((t) => t.teacherId),
          });
        }
      });

      logger.info('[AssignmentService.cleanupDuplicateAssignments] Cleanup completed', {
        duplicatesFound,
        duplicatesRemoved,
      });

      return {
        success: true,
        data: {
          duplicatesFound,
          duplicatesRemoved,
          details,
        },
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('AssignmentService: Failed to cleanup duplicates', error);
      return { success: false, error: error.message };
    }
  }
}
