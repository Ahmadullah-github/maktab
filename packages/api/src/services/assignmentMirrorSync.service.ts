import { DataSource, EntityManager } from 'typeorm';
import { CacheManager } from '../database/cache/cacheManager';
import { ClassSubjectRequirementRepository } from '../database/repositories/classSubjectRequirement.repository';
import { ClassRepository, SubjectRequirement } from '../database/repositories/class.repository';
import { TeacherRepository } from '../database/repositories/teacher.repository';
import { TeacherSubjectCapabilityRepository } from '../database/repositories/teacherSubjectCapability.repository';
import { ClassSubjectRequirement } from '../entity/ClassSubjectRequirement';
import { TeachingAssignment } from '../entity/TeachingAssignment';

interface MirrorSyncOptions {
  manager?: EntityManager;
}

interface CanonicalAssignmentRow {
  teacherId: number;
  classId: number;
  subjectId: number;
  assignedPeriodsPerWeek: number;
}

export class AssignmentMirrorSyncService {
  private static instance: AssignmentMirrorSyncService | null = null;

  private readonly teacherRepository: TeacherRepository;
  private readonly classRepository: ClassRepository;
  private readonly capabilityRepository: TeacherSubjectCapabilityRepository;
  private readonly requirementRepository: ClassSubjectRequirementRepository;

  private constructor(
    private readonly dataSource: DataSource,
    cacheManager?: CacheManager
  ) {
    const cache = cacheManager ?? CacheManager.getInstance();
    this.teacherRepository = TeacherRepository.getInstance(dataSource, cache);
    this.classRepository = ClassRepository.getInstance(dataSource, cache);
    this.capabilityRepository = TeacherSubjectCapabilityRepository.getInstance(dataSource, cache);
    this.requirementRepository = ClassSubjectRequirementRepository.getInstance(dataSource, cache);
  }

  static getInstance(
    dataSource: DataSource,
    cacheManager?: CacheManager
  ): AssignmentMirrorSyncService {
    if (!AssignmentMirrorSyncService.instance) {
      AssignmentMirrorSyncService.instance = new AssignmentMirrorSyncService(dataSource, cacheManager);
    }

    return AssignmentMirrorSyncService.instance;
  }

  static resetInstance(): void {
    AssignmentMirrorSyncService.instance = null;
  }

  async syncTeacherCapabilityMirror(teacherId: number, options?: MirrorSyncOptions): Promise<void> {
    const capabilities = await this.capabilityRepository.getActiveByTeacher(teacherId, {
      manager: options?.manager,
      skipCache: true,
    });

    const primarySubjectIds = capabilities
      .filter((capability) => capability.capabilityLevel === 'primary')
      .map((capability) => capability.subjectId)
      .sort((left, right) => left - right);

    const allowedSubjectIds = capabilities
      .filter((capability) => capability.capabilityLevel === 'allowed')
      .map((capability) => capability.subjectId)
      .sort((left, right) => left - right);

    await this.teacherRepository.updateTeacher(
      teacherId,
      {
        primarySubjectIds,
        allowedSubjectIds,
      },
      { manager: options?.manager }
    );
  }

  async syncTeacherAssignmentMirror(teacherId: number, options?: MirrorSyncOptions): Promise<void> {
    const assignmentRows = await this.getCanonicalAssignments({ manager: options?.manager, teacherId });

    const groupedBySubject = new Map<number, number[]>();
    for (const assignment of assignmentRows) {
      const classIds = groupedBySubject.get(assignment.subjectId) ?? [];
      classIds.push(assignment.classId);
      groupedBySubject.set(assignment.subjectId, classIds);
    }

    const classAssignments = Array.from(groupedBySubject.entries())
      .sort(([left], [right]) => left - right)
      .map(([subjectId, classIds]) => ({
        subjectId: String(subjectId),
        classIds: [...new Set(classIds)].sort((left, right) => left - right).map(String),
      }));

    await this.teacherRepository.updateTeacher(
      teacherId,
      { classAssignments },
      { manager: options?.manager }
    );
  }

  async syncClassRequirementMirror(classId: number, options?: MirrorSyncOptions): Promise<void> {
    const requirements = await this.requirementRepository.getActiveByClass(classId, {
      manager: options?.manager,
      skipCache: true,
    });
    const canonicalAssignments = await this.getCanonicalAssignments({ manager: options?.manager, classId });

    const assignmentsByRequirement = new Map<string, CanonicalAssignmentRow[]>();
    for (const assignment of canonicalAssignments) {
      const key = `${assignment.classId}:${assignment.subjectId}`;
      const rows = assignmentsByRequirement.get(key) ?? [];
      rows.push(assignment);
      assignmentsByRequirement.set(key, rows);
    }

    const subjectRequirements: SubjectRequirement[] = requirements
      .sort((left, right) => left.subjectId - right.subjectId)
      .map((requirement) => {
        const assignments = assignmentsByRequirement.get(
          `${requirement.classId}:${requirement.subjectId}`
        ) ?? [];

        let teacherId: number | null = null;
        if (
          assignments.length === 1 &&
          assignments[0].assignedPeriodsPerWeek === requirement.requiredPeriodsPerWeek
        ) {
          teacherId = assignments[0].teacherId;
        }

        return {
          subjectId: requirement.subjectId,
          periodsPerWeek: requirement.requiredPeriodsPerWeek,
          teacherId,
        };
      });

    await this.classRepository.updateClass(
      classId,
      { subjectRequirements },
      { manager: options?.manager }
    );
  }

  private async getCanonicalAssignments(input: {
    manager?: EntityManager;
    teacherId?: number;
    classId?: number;
  }): Promise<CanonicalAssignmentRow[]> {
    const manager = input.manager ?? this.dataSource.manager;
    const query = manager
      .getRepository(TeachingAssignment)
      .createQueryBuilder('assignment')
      .innerJoin(
        ClassSubjectRequirement,
        'requirement',
        'requirement.id = assignment.class_subject_requirement_id AND requirement.is_deleted = :requirementDeleted',
        { requirementDeleted: false }
      )
      .select('assignment.teacher_id', 'teacherId')
      .addSelect('requirement.class_id', 'classId')
      .addSelect('requirement.subject_id', 'subjectId')
      .addSelect('assignment.assigned_periods_per_week', 'assignedPeriodsPerWeek')
      .where('assignment.is_deleted = :assignmentDeleted', { assignmentDeleted: false });

    if (input.teacherId !== undefined) {
      query.andWhere('assignment.teacher_id = :teacherId', { teacherId: input.teacherId });
    }

    if (input.classId !== undefined) {
      query.andWhere('requirement.class_id = :classId', { classId: input.classId });
    }

    const rows = await query
      .orderBy('requirement.subject_id', 'ASC')
      .addOrderBy('requirement.class_id', 'ASC')
      .addOrderBy('assignment.teacher_id', 'ASC')
      .getRawMany<{
        teacherId: number | string;
        classId: number | string;
        subjectId: number | string;
        assignedPeriodsPerWeek: number | string;
      }>();

    return rows.map((row) => ({
      teacherId: Number(row.teacherId),
      classId: Number(row.classId),
      subjectId: Number(row.subjectId),
      assignedPeriodsPerWeek: Number(row.assignedPeriodsPerWeek),
    }));
  }
}
