/**
 * Assignment Serialization Utilities
 * Handles serialization and deserialization of enhanced assignment data
 * while maintaining backward compatibility with the solver format.
 *
 * Requirements: 7.1, 7.2, 7.4, 7.5
 */

import type { ClassGroup, SubjectRequirement } from '../../classes/types';
import type { Subject } from '../../subjects/types';
import type { ClassAssignment, Teacher } from '../../teachers/types';
import type {
  AssignmentConflict,
  AssignmentStatus,
  EnhancedClassAssignment,
  EnhancedSubjectRequirement,
} from '../types';

// ============================================================================
// Solver Format Types (for backward compatibility)
// ============================================================================

/**
 * Solver-compatible class assignment format
 * This is the format expected by the Python solver
 */
export interface SolverClassAssignment {
  subjectId: number;
  classIds: number[];
}

/**
 * Solver-compatible subject requirement format
 */
export interface SolverSubjectRequirement {
  subjectId: number;
  periodsPerWeek: number;
  teacherId?: number | null;
}

// ============================================================================
// Class Assignment Serialization
// ============================================================================

/**
 * Serialize enhanced class assignments to JSON string (solver-compatible format)
 *
 * Requirements: 7.1, 7.4
 *
 * @param assignments - Enhanced class assignments to serialize
 * @returns JSON string in solver-compatible format
 */
export function serializeEnhancedClassAssignments(assignments: EnhancedClassAssignment[]): string {
  // Convert to solver-compatible format (strip calculated fields)
  const solverFormat: SolverClassAssignment[] = assignments.map((assignment) => ({
    subjectId: assignment.subjectId,
    classIds: Array.isArray(assignment.classIds) ? [...assignment.classIds] : [],
  }));

  return JSON.stringify(solverFormat);
}

/**
 * Serialize base class assignments to JSON string
 *
 * @param assignments - Base class assignments to serialize
 * @returns JSON string
 */
export function serializeClassAssignments(assignments: ClassAssignment[]): string {
  const solverFormat: SolverClassAssignment[] = assignments.map((assignment) => ({
    subjectId: assignment.subjectId,
    classIds: Array.isArray(assignment.classIds) ? [...assignment.classIds] : [],
  }));

  return JSON.stringify(solverFormat);
}

/**
 * Deserialize JSON string to base class assignments
 *
 * @param json - JSON string to parse
 * @returns Array of class assignments
 */
export function deserializeClassAssignments(json: string | null | undefined): ClassAssignment[] {
  if (!json || json === '[]' || json === 'null') {
    return [];
  }

  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((item: unknown) => {
      const assignment = item as Record<string, unknown>;
      return {
        subjectId: Number(assignment.subjectId) || 0,
        classIds: Array.isArray(assignment.classIds)
          ? assignment.classIds.map((id: unknown) => Number(id))
          : [],
      };
    });
  } catch {
    console.warn('Failed to parse class assignments JSON:', json);
    return [];
  }
}

/**
 * Deserialize JSON string to enhanced class assignments with calculated fields
 *
 * Requirements: 7.2, 7.5
 *
 * @param json - JSON string to parse
 * @param teacher - The teacher (for conflict detection)
 * @param subjects - All subjects (for periods lookup)
 * @param classes - All classes (for requirement lookup)
 * @returns Array of enhanced class assignments
 */
export function deserializeEnhancedClassAssignments(
  json: string | null | undefined,
  teacher: Teacher,
  subjects: Subject[],
  classes: ClassGroup[]
): EnhancedClassAssignment[] {
  const baseAssignments = deserializeClassAssignments(json);

  return baseAssignments.map((assignment) => {
    return enhanceClassAssignment(assignment, teacher, subjects, classes);
  });
}

/**
 * Enhance a single class assignment with calculated fields
 *
 * @param assignment - Base class assignment
 * @param teacher - The teacher
 * @param subjects - All subjects
 * @param classes - All classes
 * @returns Enhanced class assignment
 */
export function enhanceClassAssignment(
  assignment: ClassAssignment,
  _teacher: Teacher,
  subjects: Subject[],
  classes: ClassGroup[]
): EnhancedClassAssignment {
  const subject = subjects.find((s) => s.id === assignment.subjectId);
  const conflicts: AssignmentConflict[] = [];

  // NOTE: No longer check teacher-subject compatibility as a conflict
  // Primary/allowed subjects are solver preferences, not hard restrictions

  // Calculate periods per week and total periods
  const { periodsPerWeek, totalPeriods } = calculateAssignmentPeriods(assignment, subject, classes);

  // Determine assignment status
  const status = determineAssignmentStatus(assignment, conflicts);

  return {
    subjectId: assignment.subjectId,
    classIds: Array.isArray(assignment.classIds) ? [...assignment.classIds] : [],
    periodsPerWeek,
    totalPeriods,
    conflicts,
    status,
  };
}

/**
 * Calculate periods for an assignment
 *
 * @param assignment - The assignment
 * @param subject - The subject (may be undefined)
 * @param classes - All classes
 * @returns Object with periodsPerWeek and totalPeriods
 */
function calculateAssignmentPeriods(
  assignment: ClassAssignment,
  subject: Subject | undefined,
  classes: ClassGroup[]
): { periodsPerWeek: number; totalPeriods: number } {
  // Default periods from subject definition
  const defaultPeriodsPerWeek = subject?.periodsPerWeek || 0;
  let totalPeriods = 0;
  let representativePeriods: number | null = null;

  for (const classId of assignment.classIds) {
    const classGroup = classes.find((c) => c.id === classId);
    // Ensure subjectRequirements is an array (handles JSON string from API)
    const requirements = ensureSubjectRequirements(classGroup?.subjectRequirements);
    const requirement = requirements.find((r) => r.subjectId === assignment.subjectId);

    // Use class-specific periods if available, otherwise use subject default
    const periods = requirement?.periodsPerWeek || defaultPeriodsPerWeek || 1;
    totalPeriods += periods;
    if (representativePeriods === null) {
      representativePeriods = periods;
    }
  }

  return {
    periodsPerWeek: representativePeriods ?? defaultPeriodsPerWeek,
    totalPeriods,
  };
}

/**
 * Safely parse JSON array from string or return as-is if already an array
 */
function parseJsonArray<T>(value: string | T[] | null | undefined): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Ensure subjectRequirements is always an array
 */
function ensureSubjectRequirements(
  requirements: SubjectRequirement[] | string | null | undefined
): SubjectRequirement[] {
  return parseJsonArray<SubjectRequirement>(requirements);
}

/**
 * Determine assignment status based on conflicts and class count
 *
 * @param assignment - The assignment
 * @param conflicts - Detected conflicts
 * @returns Assignment status
 */
function determineAssignmentStatus(
  assignment: ClassAssignment,
  conflicts: AssignmentConflict[]
): AssignmentStatus {
  if (conflicts.some((c) => c.severity === 'error')) {
    return 'conflict';
  }

  if (assignment.classIds.length === 0) {
    return 'unassigned';
  }

  return 'assigned';
}

// ============================================================================
// Subject Requirement Serialization
// ============================================================================

/**
 * Serialize enhanced subject requirements to JSON string (solver-compatible format)
 *
 * Requirements: 7.1, 7.4
 *
 * @param requirements - Enhanced subject requirements to serialize
 * @returns JSON string in solver-compatible format
 */
export function serializeEnhancedSubjectRequirements(
  requirements: EnhancedSubjectRequirement[]
): string {
  // Convert to solver-compatible format (strip calculated fields)
  const solverFormat: SolverSubjectRequirement[] = requirements.map((req) => ({
    subjectId: req.subjectId,
    periodsPerWeek: req.periodsPerWeek,
    teacherId: req.teacherId,
  }));

  return JSON.stringify(solverFormat);
}

/**
 * Serialize base subject requirements to JSON string
 *
 * @param requirements - Base subject requirements to serialize
 * @returns JSON string
 */
export function serializeSubjectRequirements(requirements: SubjectRequirement[]): string {
  const solverFormat: SolverSubjectRequirement[] = requirements.map((req) => ({
    subjectId: req.subjectId,
    periodsPerWeek: req.periodsPerWeek,
    teacherId: req.teacherId ?? null,
  }));

  return JSON.stringify(solverFormat);
}

/**
 * Deserialize JSON string to base subject requirements
 *
 * @param json - JSON string to parse
 * @returns Array of subject requirements
 */
export function deserializeSubjectRequirements(
  json: string | null | undefined
): SubjectRequirement[] {
  if (!json || json === '[]' || json === 'null') {
    return [];
  }

  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((item: unknown) => {
      const req = item as Record<string, unknown>;
      return {
        subjectId: Number(req.subjectId) || 0,
        periodsPerWeek: Number(req.periodsPerWeek) || 0,
        teacherId: req.teacherId != null ? Number(req.teacherId) : null,
      };
    });
  } catch {
    console.warn('Failed to parse subject requirements JSON:', json);
    return [];
  }
}

/**
 * Deserialize JSON string to enhanced subject requirements with calculated fields
 *
 * Requirements: 7.2, 7.5
 *
 * @param json - JSON string to parse
 * @param classGroup - The class group
 * @param teachers - All teachers (for conflict detection)
 * @param subjects - All subjects (for name lookup)
 * @returns Array of enhanced subject requirements
 */
export function deserializeEnhancedSubjectRequirements(
  json: string | null | undefined,
  classGroup: ClassGroup,
  teachers: Teacher[],
  subjects: Subject[]
): EnhancedSubjectRequirement[] {
  const baseRequirements = deserializeSubjectRequirements(json);

  return baseRequirements.map((requirement) => {
    return enhanceSubjectRequirement(requirement, classGroup, teachers, subjects);
  });
}

/**
 * Enhance a single subject requirement with calculated fields
 *
 * @param requirement - Base subject requirement
 * @param classGroup - The class group
 * @param teachers - All teachers
 * @param subjects - All subjects
 * @returns Enhanced subject requirement
 */
export function enhanceSubjectRequirement(
  requirement: SubjectRequirement,
  classGroup: ClassGroup,
  teachers: Teacher[],
  _subjects: Subject[]
): EnhancedSubjectRequirement {
  const conflicts: AssignmentConflict[] = [];
  let assignmentStatus: AssignmentStatus = 'unassigned';

  if (requirement.teacherId != null) {
    const teacher = teachers.find((t) => t.id === requirement.teacherId);

    if (teacher) {
      // Teacher exists and is assigned - that's valid
      // Primary/allowed subjects are solver preferences, not hard restrictions
      assignmentStatus = 'assigned';
    } else {
      // Teacher not found - this is an error
      conflicts.push({
        type: 'subject_incompatible',
        severity: 'error',
        message: `Assigned teacher (ID: ${requirement.teacherId}) not found`,
        messageFa: `معلم تخصیص یافته (شناسه: ${requirement.teacherId}) یافت نشد`,
        affectedEntities: {
          teacherId: requirement.teacherId,
          subjectId: requirement.subjectId,
          classId: classGroup.id,
        },
      });
      assignmentStatus = 'conflict';
    }
  }

  return {
    subjectId: requirement.subjectId,
    periodsPerWeek: requirement.periodsPerWeek,
    teacherId: requirement.teacherId ?? null,
    assignmentStatus,
    conflicts,
  };
}

// ============================================================================
// Conversion Utilities
// ============================================================================

/**
 * Convert enhanced class assignments back to base format
 *
 * @param enhanced - Enhanced class assignments
 * @returns Base class assignments
 */
export function toBaseClassAssignments(enhanced: EnhancedClassAssignment[]): ClassAssignment[] {
  return enhanced.map((e) => ({
    subjectId: e.subjectId,
    classIds: Array.isArray(e.classIds) ? [...e.classIds] : [],
  }));
}

/**
 * Convert enhanced subject requirements back to base format
 *
 * @param enhanced - Enhanced subject requirements
 * @returns Base subject requirements
 */
export function toBaseSubjectRequirements(
  enhanced: EnhancedSubjectRequirement[]
): SubjectRequirement[] {
  return enhanced.map((e) => ({
    subjectId: e.subjectId,
    periodsPerWeek: e.periodsPerWeek,
    teacherId: e.teacherId,
  }));
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate that serialized data can be round-tripped correctly
 *
 * Requirements: 7.4, 7.5
 *
 * @param original - Original assignments
 * @returns true if round-trip produces equivalent data
 */
export function validateClassAssignmentRoundTrip(original: ClassAssignment[]): boolean {
  try {
    const serialized = serializeClassAssignments(original);
    const deserialized = deserializeClassAssignments(serialized);

    if (original.length !== deserialized.length) {
      return false;
    }

    for (let i = 0; i < original.length; i++) {
      const orig = original[i];
      const deser = deserialized[i];

      if (orig.subjectId !== deser.subjectId) {
        return false;
      }

      if (orig.classIds.length !== deser.classIds.length) {
        return false;
      }

      for (let j = 0; j < orig.classIds.length; j++) {
        if (orig.classIds[j] !== deser.classIds[j]) {
          return false;
        }
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Validate that serialized subject requirements can be round-tripped correctly
 *
 * @param original - Original requirements
 * @returns true if round-trip produces equivalent data
 */
export function validateSubjectRequirementRoundTrip(original: SubjectRequirement[]): boolean {
  try {
    const serialized = serializeSubjectRequirements(original);
    const deserialized = deserializeSubjectRequirements(serialized);

    if (original.length !== deserialized.length) {
      return false;
    }

    for (let i = 0; i < original.length; i++) {
      const orig = original[i];
      const deser = deserialized[i];

      if (orig.subjectId !== deser.subjectId) {
        return false;
      }

      if (orig.periodsPerWeek !== deser.periodsPerWeek) {
        return false;
      }

      // Handle null/undefined comparison for teacherId
      const origTeacherId = orig.teacherId ?? null;
      const deserTeacherId = deser.teacherId ?? null;
      if (origTeacherId !== deserTeacherId) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Merge Utilities
// ============================================================================

/**
 * Merge a new assignment into existing assignments
 * If an assignment for the same subject exists, merge the class IDs
 *
 * @param existing - Existing assignments
 * @param newAssignment - New assignment to merge
 * @returns Merged assignments array
 */
export function mergeClassAssignment(
  existing: ClassAssignment[],
  newAssignment: ClassAssignment
): ClassAssignment[] {
  const result = [...existing];
  const existingIndex = result.findIndex((a) => a.subjectId === newAssignment.subjectId);

  if (existingIndex >= 0) {
    // Merge class IDs (avoid duplicates)
    const existingClassIds = new Set(result[existingIndex].classIds || []);
    const newClassIds = Array.isArray(newAssignment.classIds) ? newAssignment.classIds : [];
    for (const classId of newClassIds) {
      existingClassIds.add(classId);
    }
    result[existingIndex] = {
      ...result[existingIndex],
      classIds: Array.from(existingClassIds),
    };
  } else {
    // Add new assignment
    result.push({
      subjectId: newAssignment.subjectId,
      classIds: Array.isArray(newAssignment.classIds) ? [...newAssignment.classIds] : [],
    });
  }

  return result;
}

/**
 * Remove class IDs from an assignment
 * If all class IDs are removed, the assignment is removed entirely
 *
 * @param existing - Existing assignments
 * @param subjectId - Subject ID to modify
 * @param classIdsToRemove - Class IDs to remove
 * @returns Updated assignments array
 */
export function removeFromClassAssignment(
  existing: ClassAssignment[],
  subjectId: number,
  classIdsToRemove: number[]
): ClassAssignment[] {
  const removeSet = new Set(classIdsToRemove);

  return existing
    .map((assignment) => {
      if (assignment.subjectId !== subjectId) {
        return assignment;
      }

      const remainingClassIds = assignment.classIds.filter((id) => !removeSet.has(id));

      return {
        ...assignment,
        classIds: remainingClassIds,
      };
    })
    .filter((assignment) => assignment.classIds.length > 0);
}
