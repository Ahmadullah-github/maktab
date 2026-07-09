import { DataSource, EntityManager, In } from 'typeorm';
import { ClassSubjectRequirement } from '../entity/ClassSubjectRequirement';
import { TeacherSubjectCapability } from '../entity/TeacherSubjectCapability';
import { TeachingAssignment } from '../entity/TeachingAssignment';

export interface LegacyAssignmentCompatRecord {
  id: number;
  teacherId: number;
  classId: number;
  subjectId: number;
  periodsPerWeek: number;
  isFixed: boolean;
  schoolId: number | null;
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DerivedTeacherCompatibility {
  primarySubjectIds: number[];
  allowedSubjectIds: number[];
  classAssignments: Array<{ subjectId: string; classIds: string[] }>;
}

export interface DerivedClassRequirementCompatibility {
  subjectId: number;
  periodsPerWeek: number;
  teacherId?: number | null;
}

interface CompatibilityOptions {
  manager?: EntityManager;
}

interface AssignmentFilter extends CompatibilityOptions {
  teacherId?: number;
  classId?: number;
  subjectId?: number;
}

export class AssignmentCompatibilityService {
  constructor(private readonly dataSource: DataSource) {}

  async getLegacyAssignments(
    filter: AssignmentFilter = {}
  ): Promise<LegacyAssignmentCompatRecord[]> {
    const manager = filter.manager ?? this.dataSource.manager;
    const requirements = await this.loadRequirementsForAssignmentFilter(filter, manager);
    if (requirements.length === 0) {
      return [];
    }

    const requirementById = new Map(requirements.map((requirement) => [requirement.id, requirement]));
    const assignments = await manager.getRepository(TeachingAssignment).find({
      where: {
        classSubjectRequirementId: In(requirements.map((requirement) => requirement.id)),
        ...(filter.teacherId ? { teacherId: filter.teacherId } : {}),
        isDeleted: false,
      },
      order: { id: 'ASC' },
    });

    return assignments.flatMap((assignment) => {
      const requirement = requirementById.get(assignment.classSubjectRequirementId);
      return requirement ? [mapAssignmentToLegacyCompat(assignment, requirement)] : [];
    });
  }

  async getLegacyAssignment(
    id: number,
    options?: CompatibilityOptions
  ): Promise<LegacyAssignmentCompatRecord | null> {
    const manager = options?.manager ?? this.dataSource.manager;
    const assignment = await manager.getRepository(TeachingAssignment).findOne({
      where: { id, isDeleted: false },
    });
    if (!assignment) {
      return null;
    }

    const requirement = await manager.getRepository(ClassSubjectRequirement).findOne({
      where: { id: assignment.classSubjectRequirementId, isDeleted: false },
    });
    if (!requirement) {
      return null;
    }

    return mapAssignmentToLegacyCompat(assignment, requirement);
  }

  async getLegacyAssignmentSummary(
    classId: number,
    subjectId: number,
    options?: CompatibilityOptions
  ): Promise<{
    classId: number;
    subjectId: number;
    totalAssignedPeriods: number;
    assignments: Array<{
      id: number;
      teacherId: number;
      periodsPerWeek: number;
      isFixed: boolean;
    }>;
  }> {
    const assignments = await this.getLegacyAssignments({
      classId,
      subjectId,
      manager: options?.manager,
    });

    return {
      classId,
      subjectId,
      totalAssignedPeriods: assignments.reduce(
        (sum, assignment) => sum + assignment.periodsPerWeek,
        0
      ),
      assignments: assignments.map((assignment) => ({
        id: assignment.id,
        teacherId: assignment.teacherId,
        periodsPerWeek: assignment.periodsPerWeek,
        isFixed: assignment.isFixed,
      })),
    };
  }

  async getTeacherCompatibility(
    teacherIds: number[],
    options?: CompatibilityOptions
  ): Promise<Map<number, DerivedTeacherCompatibility>> {
    const normalizedTeacherIds = normalizeIds(teacherIds);
    const compatibilityByTeacherId = new Map<number, DerivedTeacherCompatibility>();

    for (const teacherId of normalizedTeacherIds) {
      compatibilityByTeacherId.set(teacherId, {
        primarySubjectIds: [],
        allowedSubjectIds: [],
        classAssignments: [],
      });
    }

    if (normalizedTeacherIds.length === 0) {
      return compatibilityByTeacherId;
    }

    const manager = options?.manager ?? this.dataSource.manager;
    const [capabilities, assignments] = await Promise.all([
      manager.getRepository(TeacherSubjectCapability).find({
        where: { teacherId: In(normalizedTeacherIds), isDeleted: false },
        order: { teacherId: 'ASC', subjectId: 'ASC' },
      }),
      manager.getRepository(TeachingAssignment).find({
        where: { teacherId: In(normalizedTeacherIds), isDeleted: false },
        order: { teacherId: 'ASC', id: 'ASC' },
      }),
    ]);

    const requirementIds = normalizeIds(
      assignments.map((assignment) => assignment.classSubjectRequirementId)
    );
    const requirements = requirementIds.length
      ? await manager.getRepository(ClassSubjectRequirement).find({
          where: { id: In(requirementIds), isDeleted: false },
        })
      : [];
    const requirementById = new Map(requirements.map((requirement) => [requirement.id, requirement]));

    for (const capability of capabilities) {
      const compatibility = compatibilityByTeacherId.get(capability.teacherId);
      if (!compatibility) {
        continue;
      }

      if (capability.capabilityLevel === 'primary') {
        compatibility.primarySubjectIds.push(capability.subjectId);
      } else {
        compatibility.allowedSubjectIds.push(capability.subjectId);
      }
    }

    const assignmentMapByTeacher = new Map<number, Map<number, Set<number>>>();
    for (const assignment of assignments) {
      const requirement = requirementById.get(assignment.classSubjectRequirementId);
      if (!requirement) {
        continue;
      }

      const teacherAssignments =
        assignmentMapByTeacher.get(assignment.teacherId) ?? new Map<number, Set<number>>();
      const classIdsForSubject = teacherAssignments.get(requirement.subjectId) ?? new Set<number>();
      classIdsForSubject.add(requirement.classId);
      teacherAssignments.set(requirement.subjectId, classIdsForSubject);
      assignmentMapByTeacher.set(assignment.teacherId, teacherAssignments);
    }

    for (const teacherId of normalizedTeacherIds) {
      const compatibility = compatibilityByTeacherId.get(teacherId);
      if (!compatibility) {
        continue;
      }

      compatibility.primarySubjectIds.sort((left, right) => left - right);
      compatibility.allowedSubjectIds.sort((left, right) => left - right);

      const teacherAssignments = assignmentMapByTeacher.get(teacherId);
      if (!teacherAssignments) {
        continue;
      }

      compatibility.classAssignments = Array.from(teacherAssignments.entries())
        .sort((left, right) => left[0] - right[0])
        .map(([subjectId, classIds]) => ({
          subjectId: String(subjectId),
          classIds: Array.from(classIds)
            .sort((left, right) => left - right)
            .map(String),
        }));
    }

    return compatibilityByTeacherId;
  }

  async getClassRequirementCompatibility(
    classIds: number[],
    options?: CompatibilityOptions
  ): Promise<Map<number, DerivedClassRequirementCompatibility[]>> {
    const normalizedClassIds = normalizeIds(classIds);
    const requirementsByClassId = new Map<number, DerivedClassRequirementCompatibility[]>();

    for (const classId of normalizedClassIds) {
      requirementsByClassId.set(classId, []);
    }

    if (normalizedClassIds.length === 0) {
      return requirementsByClassId;
    }

    const manager = options?.manager ?? this.dataSource.manager;
    const requirements = await manager.getRepository(ClassSubjectRequirement).find({
      where: { classId: In(normalizedClassIds), isDeleted: false },
      order: { classId: 'ASC', subjectId: 'ASC' },
    });
    const assignments = requirements.length
      ? await manager.getRepository(TeachingAssignment).find({
          where: {
            classSubjectRequirementId: In(requirements.map((requirement) => requirement.id)),
            isDeleted: false,
          },
          order: { teacherId: 'ASC', id: 'ASC' },
        })
      : [];

    const assignmentsByRequirementId = new Map<number, TeachingAssignment[]>();
    for (const assignment of assignments) {
      const current =
        assignmentsByRequirementId.get(assignment.classSubjectRequirementId) ?? [];
      current.push(assignment);
      assignmentsByRequirementId.set(assignment.classSubjectRequirementId, current);
    }

    for (const requirement of requirements) {
      const existingRequirements = requirementsByClassId.get(requirement.classId) ?? [];
      const activeAssignments = assignmentsByRequirementId.get(requirement.id) ?? [];

      existingRequirements.push({
        subjectId: requirement.subjectId,
        periodsPerWeek: requirement.requiredPeriodsPerWeek,
        teacherId: activeAssignments.length === 1 ? activeAssignments[0].teacherId : undefined,
      });
      requirementsByClassId.set(requirement.classId, existingRequirements);
    }

    return requirementsByClassId;
  }

  private async loadRequirementsForAssignmentFilter(
    filter: AssignmentFilter,
    manager: EntityManager
  ): Promise<ClassSubjectRequirement[]> {
    if (filter.classId || filter.subjectId) {
      return manager.getRepository(ClassSubjectRequirement).find({
        where: {
          ...(filter.classId ? { classId: filter.classId } : {}),
          ...(filter.subjectId ? { subjectId: filter.subjectId } : {}),
          isDeleted: false,
        },
        order: { classId: 'ASC', subjectId: 'ASC' },
      });
    }

    const assignments = await manager.getRepository(TeachingAssignment).find({
      where: {
        ...(filter.teacherId ? { teacherId: filter.teacherId } : {}),
        isDeleted: false,
      },
      order: { id: 'ASC' },
    });

    const requirementIds = normalizeIds(
      assignments.map((assignment) => assignment.classSubjectRequirementId)
    );

    if (requirementIds.length === 0) {
      return [];
    }

    return manager.getRepository(ClassSubjectRequirement).find({
      where: {
        id: In(requirementIds),
        isDeleted: false,
      },
      order: { classId: 'ASC', subjectId: 'ASC' },
    });
  }
}

function mapAssignmentToLegacyCompat(
  assignment: TeachingAssignment,
  requirement: ClassSubjectRequirement
): LegacyAssignmentCompatRecord {
  return {
    id: assignment.id,
    teacherId: assignment.teacherId,
    classId: requirement.classId,
    subjectId: requirement.subjectId,
    periodsPerWeek: assignment.assignedPeriodsPerWeek,
    isFixed: assignment.isFixed,
    schoolId: null,
    isDeleted: assignment.isDeleted,
    deletedAt: assignment.deletedAt,
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt,
  };
}

function normalizeIds(ids: number[]): number[] {
  return [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))].sort(
    (left, right) => left - right
  );
}
