import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DataSource } from 'typeorm';
import { CacheManager } from '../../database/cache/cacheManager';
import { ClassRepository } from '../../database/repositories/class.repository';
import { ClassSubjectRequirementRepository } from '../../database/repositories/classSubjectRequirement.repository';
import { SubjectRepository } from '../../database/repositories/subject.repository';
import { TeacherClassSubjectAssignmentRepository } from '../../database/repositories/teacherClassSubjectAssignment.repository';
import { TeacherRepository } from '../../database/repositories/teacher.repository';
import { TeacherSubjectCapabilityRepository } from '../../database/repositories/teacherSubjectCapability.repository';
import { TeachingAssignmentRepository } from '../../database/repositories/teachingAssignment.repository';
import { ClassGroup } from '../../entity/ClassGroup';
import { ClassSubjectRequirement } from '../../entity/ClassSubjectRequirement';
import { Subject } from '../../entity/Subject';
import { Teacher } from '../../entity/Teacher';
import { TeacherClassSubjectAssignment } from '../../entity/TeacherClassSubjectAssignment';
import { TeacherSubjectCapability } from '../../entity/TeacherSubjectCapability';
import { TeachingAssignment } from '../../entity/TeachingAssignment';
import { AssignmentCommandService } from '../assignmentCommand.service';
import { AssignmentMirrorSyncService } from '../assignmentMirrorSync.service';
import { ClassService } from '../class.service';
import { RequirementService } from '../requirement.service';
import { TeacherCapabilityService } from '../teacherCapability.service';
import { TeacherService } from '../teacher.service';

describe('Phase 3 assignment write boundary', () => {
  let dataSource: DataSource;
  let assignmentCommandService: AssignmentCommandService;
  let requirementService: RequirementService;
  let teacherService: TeacherService;
  let classService: ClassService;
  let teacherRepository: TeacherRepository;
  let classRepository: ClassRepository;
  let subjectRepository: SubjectRepository;
  let legacyAssignmentRepository: TeacherClassSubjectAssignmentRepository;

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      synchronize: true,
      dropSchema: true,
      entities: [
        Teacher,
        Subject,
        ClassGroup,
        TeacherClassSubjectAssignment,
        ClassSubjectRequirement,
        TeacherSubjectCapability,
        TeachingAssignment,
      ],
    });
    await dataSource.initialize();

    CacheManager.resetInstance();
    TeacherRepository.resetInstance();
    ClassRepository.resetInstance();
    ClassSubjectRequirementRepository.resetInstance();
    SubjectRepository.resetInstance();
    TeacherClassSubjectAssignmentRepository.resetInstance();
    TeacherSubjectCapabilityRepository.resetInstance();
    TeachingAssignmentRepository.resetInstance();
    AssignmentCommandService.resetInstance();
    AssignmentMirrorSyncService.resetInstance();
    RequirementService.resetInstance();
    TeacherCapabilityService.resetInstance();
    TeacherService.resetInstance();
    ClassService.resetInstance();

    assignmentCommandService = AssignmentCommandService.getInstance(dataSource);
    requirementService = RequirementService.getInstance(dataSource);
    teacherService = TeacherService.getInstance(dataSource);
    classService = ClassService.getInstance(dataSource);
    teacherRepository = TeacherRepository.getInstance(dataSource);
    classRepository = ClassRepository.getInstance(dataSource);
    subjectRepository = SubjectRepository.getInstance(dataSource);
    legacyAssignmentRepository = TeacherClassSubjectAssignmentRepository.getInstance(dataSource);
  });

  afterEach(async () => {
    await dataSource.destroy();
    CacheManager.resetInstance();
    TeacherRepository.resetInstance();
    ClassRepository.resetInstance();
    ClassSubjectRequirementRepository.resetInstance();
    SubjectRepository.resetInstance();
    TeacherClassSubjectAssignmentRepository.resetInstance();
    TeacherSubjectCapabilityRepository.resetInstance();
    TeachingAssignmentRepository.resetInstance();
    AssignmentCommandService.resetInstance();
    AssignmentMirrorSyncService.resetInstance();
    RequirementService.resetInstance();
    TeacherCapabilityService.resetInstance();
    TeacherService.resetInstance();
    ClassService.resetInstance();
  });

  it('writes canonical tables and legacy mirrors when assigning a teacher', async () => {
    const teacher = await teacherRepository.saveTeacher({
      fullName: 'Teacher One',
      maxPeriodsPerWeek: 24,
    });
    const subject = await subjectRepository.saveSubject({
      name: 'Math',
      periodsPerWeek: 4,
    });
    const classGroup = await classRepository.saveClass({
      name: 'Class 7A',
    });

    await requirementService.syncClassRequirements(classGroup.id, [
      { subjectId: subject.id, periodsPerWeek: 4 },
    ]);

    const result = await assignmentCommandService.assignTeacher(
      teacher.id,
      subject.id,
      [classGroup.id]
    );

    expect(result.success).toBe(true);
    expect(result.data?.success).toBe(true);

    const canonicalAssignments = await dataSource.getRepository(TeachingAssignment).find({
      where: { isDeleted: false },
    });
    expect(canonicalAssignments).toHaveLength(1);
    expect(canonicalAssignments[0].teacherId).toBe(teacher.id);
    expect(canonicalAssignments[0].assignedPeriodsPerWeek).toBe(4);

    const legacyAssignments = await legacyAssignmentRepository.findByTeacher(teacher.id);
    expect(legacyAssignments).toHaveLength(1);
    expect(legacyAssignments[0].classId).toBe(classGroup.id);
    expect(legacyAssignments[0].subjectId).toBe(subject.id);

    const updatedTeacher = await teacherRepository.getTeacher(teacher.id, { skipCache: true });
    expect(updatedTeacher?.allowedSubjectIds).toEqual([subject.id]);
    expect(updatedTeacher?.classAssignments).toEqual([
      {
        subjectId: String(subject.id),
        classIds: [String(classGroup.id)],
      },
    ]);

    const updatedClass = await classRepository.getClass(classGroup.id, { skipCache: true });
    expect(updatedClass?.subjectRequirements).toEqual([
      {
        subjectId: subject.id,
        periodsPerWeek: 4,
        teacherId: teacher.id,
      },
    ]);
  });

  it('replaces the previous teacher when split assignment is disabled', async () => {
    const teacherOne = await teacherRepository.saveTeacher({
      fullName: 'Teacher One',
      maxPeriodsPerWeek: 24,
    });
    const teacherTwo = await teacherRepository.saveTeacher({
      fullName: 'Teacher Two',
      maxPeriodsPerWeek: 24,
    });
    const subject = await subjectRepository.saveSubject({
      name: 'Science',
      periodsPerWeek: 3,
    });
    const classGroup = await classRepository.saveClass({
      name: 'Class 8A',
    });

    await requirementService.syncClassRequirements(classGroup.id, [
      { subjectId: subject.id, periodsPerWeek: 3, allowSplitAssignment: false },
    ]);

    const firstResult = await assignmentCommandService.assignTeacher(
      teacherOne.id,
      subject.id,
      [classGroup.id]
    );

    const secondResult = await assignmentCommandService.assignTeacher(
      teacherTwo.id,
      subject.id,
      [classGroup.id]
    );
    expect(firstResult.error).toBeUndefined();
    expect(secondResult.error).toBeUndefined();

    const activeCanonicalAssignments = await dataSource.getRepository(TeachingAssignment).find({
      where: { isDeleted: false },
    });
    expect(activeCanonicalAssignments).toHaveLength(1);
    expect(activeCanonicalAssignments[0].teacherId).toBe(teacherTwo.id);

    const activeLegacyAssignments = await legacyAssignmentRepository.findByClassAndSubject(
      classGroup.id,
      subject.id
    );
    expect(activeLegacyAssignments).toHaveLength(1);
    expect(activeLegacyAssignments[0].teacherId).toBe(teacherTwo.id);

    const replacedTeacher = await teacherRepository.getTeacher(teacherOne.id, { skipCache: true });
    expect(replacedTeacher?.classAssignments).toEqual([]);

    const updatedClass = await classRepository.getClass(classGroup.id, { skipCache: true });
    expect(updatedClass?.subjectRequirements[0]?.teacherId).toBe(teacherTwo.id);
  });

  it('delegates teacher update compatibility fields into canonical services', async () => {
    const teacher = await teacherRepository.saveTeacher({
      fullName: 'Teacher Three',
      maxPeriodsPerWeek: 24,
    });
    const subject = await subjectRepository.saveSubject({
      name: 'History',
      periodsPerWeek: 2,
    });
    const classGroup = await classRepository.saveClass({
      name: 'Class 9A',
    });
    await requirementService.syncClassRequirements(classGroup.id, [
      { subjectId: subject.id, periodsPerWeek: 2 },
    ]);

    const result = await teacherService.update(teacher.id, {
      primarySubjectIds: [subject.id],
      classAssignments: [
        {
          subjectId: String(subject.id),
          classIds: [String(classGroup.id)],
        },
      ],
    });

    expect(result.success).toBe(true);

    const capabilities = await dataSource.getRepository(TeacherSubjectCapability).find({
      where: { teacherId: teacher.id, isDeleted: false },
    });
    expect(capabilities).toHaveLength(1);
    expect(capabilities[0].subjectId).toBe(subject.id);
    expect(capabilities[0].capabilityLevel).toBe('primary');

    const canonicalAssignments = await dataSource.getRepository(TeachingAssignment).find({
      where: { isDeleted: false },
    });
    expect(canonicalAssignments).toHaveLength(1);
    expect(canonicalAssignments[0].teacherId).toBe(teacher.id);

    const updatedTeacher = await teacherRepository.getTeacher(teacher.id, { skipCache: true });
    expect(updatedTeacher?.primarySubjectIds).toEqual([subject.id]);
    expect(updatedTeacher?.classAssignments).toEqual([
      {
        subjectId: String(subject.id),
        classIds: [String(classGroup.id)],
      },
    ]);
  });

  it('delegates class subjectRequirements into canonical requirement and assignment services', async () => {
    const teacher = await teacherRepository.saveTeacher({
      fullName: 'Teacher Four',
      maxPeriodsPerWeek: 24,
    });
    const subject = await subjectRepository.saveSubject({
      name: 'Geography',
      periodsPerWeek: 5,
    });
    const classGroup = await classRepository.saveClass({
      name: 'Class 10A',
    });

    const result = await classService.update(classGroup.id, {
      subjectRequirements: [
        {
          subjectId: subject.id,
          periodsPerWeek: 5,
          teacherId: teacher.id,
        },
      ],
    });

    expect(result.success).toBe(true);

    const requirements = await dataSource.getRepository(ClassSubjectRequirement).find({
      where: { classId: classGroup.id, isDeleted: false },
    });
    expect(requirements).toHaveLength(1);
    expect(requirements[0].subjectId).toBe(subject.id);
    expect(requirements[0].requiredPeriodsPerWeek).toBe(5);

    const canonicalAssignments = await dataSource.getRepository(TeachingAssignment).find({
      where: { isDeleted: false },
    });
    expect(canonicalAssignments).toHaveLength(1);
    expect(canonicalAssignments[0].teacherId).toBe(teacher.id);

    const legacyAssignments = await legacyAssignmentRepository.findByClassAndSubject(
      classGroup.id,
      subject.id
    );
    expect(legacyAssignments).toHaveLength(1);
    expect(legacyAssignments[0].teacherId).toBe(teacher.id);

    const updatedClass = await classRepository.getClass(classGroup.id, { skipCache: true });
    expect(updatedClass?.subjectRequirements).toEqual([
      {
        subjectId: subject.id,
        periodsPerWeek: 5,
        teacherId: teacher.id,
      },
    ]);
  });

  it('persists requirement overrides when assigning from 2 to 3 periods', async () => {
    const teacher = await teacherRepository.saveTeacher({
      fullName: 'Teacher Five',
      maxPeriodsPerWeek: 24,
    });
    const subject = await subjectRepository.saveSubject({
      name: 'Social Studies',
      periodsPerWeek: 2,
    });
    const classGroup = await classRepository.saveClass({
      name: 'Class 4A',
      displayName: 'صنف 4 الف',
    });

    await requirementService.syncClassRequirements(classGroup.id, [
      { subjectId: subject.id, periodsPerWeek: 2, allowSplitAssignment: true },
    ]);

    const result = await assignmentCommandService.assignTeacher(
      teacher.id,
      subject.id,
      [classGroup.id],
      undefined,
      [{ classId: classGroup.id, periodsPerWeek: 3 }],
      true
    );

    expect(result.success).toBe(true);
    expect(result.data?.success).toBe(true);
    expect(result.data?.warnings).toHaveLength(1);
    expect(result.data?.warnings?.[0]?.type).toBe('subject_incompatible');

    const requirement = await dataSource.getRepository(ClassSubjectRequirement).findOne({
      where: { classId: classGroup.id, subjectId: subject.id, isDeleted: false },
    });
    expect(requirement?.requiredPeriodsPerWeek).toBe(3);

    const canonicalAssignments = await dataSource.getRepository(TeachingAssignment).find({
      where: { isDeleted: false },
    });
    expect(canonicalAssignments).toHaveLength(1);
    expect(canonicalAssignments[0].assignedPeriodsPerWeek).toBe(3);

    const updatedClass = await classRepository.getClass(classGroup.id, { skipCache: true });
    expect(updatedClass?.subjectRequirements).toEqual([
      {
        subjectId: subject.id,
        periodsPerWeek: 3,
        teacherId: teacher.id,
      },
    ]);
  });

  it('trims the edited teacher when lowering a persisted split requirement', async () => {
    const primaryTeacher = await teacherRepository.saveTeacher({
      fullName: 'Teacher Six',
      maxPeriodsPerWeek: 24,
    });
    const secondaryTeacher = await teacherRepository.saveTeacher({
      fullName: 'Teacher Seven',
      maxPeriodsPerWeek: 24,
    });
    const subject = await subjectRepository.saveSubject({
      name: 'History',
      periodsPerWeek: 5,
    });
    const classGroup = await classRepository.saveClass({
      name: 'Class 6A',
      displayName: 'صنف 6 الف',
    });

    await requirementService.syncClassRequirements(classGroup.id, [
      { subjectId: subject.id, periodsPerWeek: 5, allowSplitAssignment: true },
    ]);

    await assignmentCommandService.createLegacyAssignment({
      teacherId: secondaryTeacher.id,
      classId: classGroup.id,
      subjectId: subject.id,
      periodsPerWeek: 2,
      isFixed: true,
    });

    const result = await assignmentCommandService.assignTeacher(
      primaryTeacher.id,
      subject.id,
      [classGroup.id],
      undefined,
      [{ classId: classGroup.id, periodsPerWeek: 3 }],
      true
    );

    expect(result.success).toBe(true);
    expect(result.data?.success).toBe(true);
    expect(result.data?.warnings).toHaveLength(2);
    expect(
      result.data?.warnings?.some(
        (warning) =>
          warning.type === 'coverage_insufficient' && warning.message.includes('trimmed')
      )
    ).toBe(true);

    const requirement = await dataSource.getRepository(ClassSubjectRequirement).findOne({
      where: { classId: classGroup.id, subjectId: subject.id, isDeleted: false },
    });
    expect(requirement?.requiredPeriodsPerWeek).toBe(3);

    const canonicalAssignments = await dataSource.getRepository(TeachingAssignment).find({
      where: { isDeleted: false },
      order: { teacherId: 'ASC' },
    });
    expect(canonicalAssignments).toHaveLength(2);
    expect(canonicalAssignments.map((assignment) => assignment.assignedPeriodsPerWeek)).toEqual([1, 2]);

    const updatedClass = await classRepository.getClass(classGroup.id, { skipCache: true });
    expect(updatedClass?.subjectRequirements).toHaveLength(1);
    expect(updatedClass?.subjectRequirements[0]).toMatchObject({
      subjectId: subject.id,
      periodsPerWeek: 3,
    });
    expect(updatedClass?.subjectRequirements[0]?.teacherId ?? null).toBeNull();
  });

  it('blocks persisted requirement overrides when other teachers already exceed the new total', async () => {
    const primaryTeacher = await teacherRepository.saveTeacher({
      fullName: 'Teacher Eight',
      maxPeriodsPerWeek: 24,
    });
    const secondaryTeacher = await teacherRepository.saveTeacher({
      fullName: 'Teacher Nine',
      maxPeriodsPerWeek: 24,
    });
    const subject = await subjectRepository.saveSubject({
      name: 'Civics',
      periodsPerWeek: 5,
    });
    const classGroup = await classRepository.saveClass({
      name: 'Class 5A',
      displayName: 'صنف 5 الف',
    });

    await requirementService.syncClassRequirements(classGroup.id, [
      { subjectId: subject.id, periodsPerWeek: 5, allowSplitAssignment: true },
    ]);

    await assignmentCommandService.createLegacyAssignment({
      teacherId: secondaryTeacher.id,
      classId: classGroup.id,
      subjectId: subject.id,
      periodsPerWeek: 3,
      isFixed: true,
    });

    const result = await assignmentCommandService.assignTeacher(
      primaryTeacher.id,
      subject.id,
      [classGroup.id],
      undefined,
      [{ classId: classGroup.id, periodsPerWeek: 2 }],
      true
    );

    expect(result.success).toBe(true);
    expect(result.data?.success).toBe(false);
    expect(result.data?.conflicts).toHaveLength(1);

    const requirement = await dataSource.getRepository(ClassSubjectRequirement).findOne({
      where: { classId: classGroup.id, subjectId: subject.id, isDeleted: false },
    });
    expect(requirement?.requiredPeriodsPerWeek).toBe(5);

    const canonicalAssignments = await dataSource.getRepository(TeachingAssignment).find({
      where: { isDeleted: false },
    });
    expect(canonicalAssignments).toHaveLength(1);
    expect(canonicalAssignments[0].teacherId).toBe(secondaryTeacher.id);
    expect(canonicalAssignments[0].assignedPeriodsPerWeek).toBe(3);
  });

  it('keeps the old behavior when persistRequirementOverrides is omitted', async () => {
    const teacher = await teacherRepository.saveTeacher({
      fullName: 'Teacher Ten',
      maxPeriodsPerWeek: 24,
    });
    const subject = await subjectRepository.saveSubject({
      name: 'Geography',
      periodsPerWeek: 2,
    });
    const classGroup = await classRepository.saveClass({
      name: 'Class 4B',
      displayName: 'صنف 4 ب',
    });

    await requirementService.syncClassRequirements(classGroup.id, [
      { subjectId: subject.id, periodsPerWeek: 2, allowSplitAssignment: true },
    ]);

    const result = await assignmentCommandService.assignTeacher(
      teacher.id,
      subject.id,
      [classGroup.id],
      undefined,
      [{ classId: classGroup.id, periodsPerWeek: 3 }]
    );

    expect(result.success).toBe(true);
    expect(result.data?.success).toBe(false);
    expect(result.data?.conflicts).toHaveLength(1);

    const requirement = await dataSource.getRepository(ClassSubjectRequirement).findOne({
      where: { classId: classGroup.id, subjectId: subject.id, isDeleted: false },
    });
    expect(requirement?.requiredPeriodsPerWeek).toBe(2);

    const canonicalAssignments = await dataSource.getRepository(TeachingAssignment).find({
      where: { isDeleted: false },
    });
    expect(canonicalAssignments).toHaveLength(0);
  });
});
