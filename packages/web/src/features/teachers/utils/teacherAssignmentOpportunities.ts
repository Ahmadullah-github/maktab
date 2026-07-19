import type {
  ProjectionAssignmentSummary,
  ProjectionRequirementView,
} from '@/features/assignments/projections';
import type { AssignmentBatchChange } from '@/features/assignments/hooks/useAssignmentMutations';
import type { Subject } from '@/features/subjects/types';

export type TeacherClassOpportunityStatus =
  | 'unassigned'
  | 'partial'
  | 'current'
  | 'fully_assigned_other';

export type TeacherSubjectOpportunityGroup = 'needs' | 'current' | 'hidden' | 'no_demand';

export interface TeacherClassOpportunity {
  requirementId: number;
  assignmentVersion: number;
  classId: number;
  className: string;
  subjectId: number;
  requiredPeriodsPerWeek: number;
  periodMode?: 'inherited' | 'class_override';
  assignedPeriodsPerWeek: number;
  remainingPeriodsPerWeek: number;
  allowSplitAssignment: boolean;
  assignments: ProjectionAssignmentSummary[];
  selectedTeacherPeriods: number;
  status: TeacherClassOpportunityStatus;
  requiresOverride: boolean;
}

export interface TeacherSubjectOpportunity {
  subject: Subject;
  requirements: TeacherClassOpportunity[];
  group: TeacherSubjectOpportunityGroup;
  unassignedCount: number;
  partialCount: number;
  currentCount: number;
  fullyAssignedOtherCount: number;
}

function toClassOpportunity(
  requirement: ProjectionRequirementView,
  teacherId: number
): TeacherClassOpportunity {
  const selectedTeacherPeriods = requirement.assignments
    .filter((assignment) => assignment.teacherId === teacherId)
    .reduce((sum, assignment) => sum + assignment.assignedPeriodsPerWeek, 0);

  let status: TeacherClassOpportunityStatus;
  if (requirement.remainingPeriodsPerWeek > 0) {
    status = requirement.assignedPeriodsPerWeek > 0 ? 'partial' : 'unassigned';
  } else if (selectedTeacherPeriods > 0) {
    status = 'current';
  } else {
    status = 'fully_assigned_other';
  }

  return {
    requirementId: requirement.requirementId,
    assignmentVersion: requirement.assignmentVersion,
    classId: requirement.classId,
    className: requirement.className,
    subjectId: requirement.subjectId,
    requiredPeriodsPerWeek: requirement.requiredPeriodsPerWeek,
    periodMode: requirement.periodMode,
    assignedPeriodsPerWeek: requirement.assignedPeriodsPerWeek,
    remainingPeriodsPerWeek: Math.max(0, requirement.remainingPeriodsPerWeek),
    allowSplitAssignment: requirement.allowSplitAssignment,
    assignments: requirement.assignments,
    selectedTeacherPeriods,
    status,
    requiresOverride: status === 'fully_assigned_other',
  };
}

export function buildTeacherSubjectOpportunities(
  subjects: Subject[],
  requirements: ProjectionRequirementView[],
  teacherId: number
): TeacherSubjectOpportunity[] {
  const requirementsBySubject = new Map<number, ProjectionRequirementView[]>();
  for (const requirement of requirements) {
    const current = requirementsBySubject.get(requirement.subjectId) ?? [];
    current.push(requirement);
    requirementsBySubject.set(requirement.subjectId, current);
  }

  return subjects.map((subject) => {
    const classRequirements = (requirementsBySubject.get(subject.id) ?? [])
      .map((requirement) => toClassOpportunity(requirement, teacherId))
      .sort((a, b) => a.className.localeCompare(b.className, 'fa'));
    const unassignedCount = classRequirements.filter(
      (requirement) => requirement.status === 'unassigned'
    ).length;
    const partialCount = classRequirements.filter(
      (requirement) => requirement.status === 'partial'
    ).length;
    const currentCount = classRequirements.filter(
      (requirement) => requirement.selectedTeacherPeriods > 0
    ).length;
    const fullyAssignedOtherCount = classRequirements.filter(
      (requirement) => requirement.status === 'fully_assigned_other'
    ).length;

    let group: TeacherSubjectOpportunityGroup;
    if (unassignedCount > 0 || partialCount > 0) {
      group = 'needs';
    } else if (currentCount > 0) {
      group = 'current';
    } else if (classRequirements.length > 0) {
      group = 'hidden';
    } else {
      group = 'no_demand';
    }

    return {
      subject,
      requirements: classRequirements,
      group,
      unassignedCount,
      partialCount,
      currentCount,
      fullyAssignedOtherCount,
    };
  });
}

export function matchesTeacherSubjectOpportunity(
  opportunity: TeacherSubjectOpportunity,
  query: string
): boolean {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return true;
  if (opportunity.subject.name.toLocaleLowerCase().includes(normalized)) return true;
  if (opportunity.subject.code?.toLocaleLowerCase().includes(normalized)) return true;
  return opportunity.requirements.some((requirement) =>
    requirement.className.toLocaleLowerCase().includes(normalized)
  );
}

export function sortTeacherSubjectOpportunities(
  opportunities: TeacherSubjectOpportunity[]
): TeacherSubjectOpportunity[] {
  return [...opportunities].sort((a, b) => {
    const aPriority = a.unassignedCount > 0 ? 0 : a.partialCount > 0 ? 1 : 2;
    const bPriority = b.unassignedCount > 0 ? 0 : b.partialCount > 0 ? 1 : 2;
    if (aPriority !== bPriority) return aPriority - bPriority;
    const aRemaining = a.requirements.reduce(
      (sum, requirement) => sum + requirement.remainingPeriodsPerWeek,
      0
    );
    const bRemaining = b.requirements.reduce(
      (sum, requirement) => sum + requirement.remainingPeriodsPerWeek,
      0
    );
    if (aRemaining !== bRemaining) return bRemaining - aRemaining;
    return a.subject.name.localeCompare(b.subject.name, 'fa');
  });
}

export function buildTeacherAssignmentBatchChanges(
  opportunities: TeacherClassOpportunity[],
  teacherId: number,
  periodOverrides: Record<number, number>
): AssignmentBatchChange[] {
  return opportunities.map((opportunity) => {
    if (opportunity.requiresOverride) {
      return {
        requirementId: opportunity.requirementId,
        expectedVersion: opportunity.assignmentVersion,
        allocations: [
          { teacherId, periodsPerWeek: opportunity.requiredPeriodsPerWeek },
        ],
      };
    }

    const requestedPeriods =
      periodOverrides[opportunity.classId] ?? opportunity.remainingPeriodsPerWeek;
    if (
      !Number.isInteger(requestedPeriods) ||
      requestedPeriods <= 0 ||
      requestedPeriods > opportunity.remainingPeriodsPerWeek
    ) {
      throw new Error(
        `Invalid period allocation for requirement ${opportunity.requirementId}`
      );
    }

    const existingSelectedPeriods = opportunity.selectedTeacherPeriods;
    const allocations = opportunity.assignments
      .filter((assignment) => assignment.teacherId !== teacherId)
      .map((assignment) => ({
        teacherId: assignment.teacherId,
        periodsPerWeek: assignment.assignedPeriodsPerWeek,
      }));
    allocations.push({
      teacherId,
      periodsPerWeek: existingSelectedPeriods + requestedPeriods,
    });

    return {
      requirementId: opportunity.requirementId,
      expectedVersion: opportunity.assignmentVersion,
      allocations,
    };
  });
}
