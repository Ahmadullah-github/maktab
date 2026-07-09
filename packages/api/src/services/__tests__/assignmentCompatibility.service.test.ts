import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DataSource } from 'typeorm';
import { CacheManager } from '../../database/cache/cacheManager';
import { ClassRepository } from '../../database/repositories/class.repository';
import { SubjectRepository } from '../../database/repositories/subject.repository';
import { TeacherRepository } from '../../database/repositories/teacher.repository';
import { ClassGroup } from '../../entity/ClassGroup';
import { ClassSubjectRequirement } from '../../entity/ClassSubjectRequirement';
import { Subject } from '../../entity/Subject';
import { Teacher } from '../../entity/Teacher';
import { TeacherSubjectCapability } from '../../entity/TeacherSubjectCapability';
import { TeachingAssignment } from '../../entity/TeachingAssignment';
import { AssignmentCompatibilityService } from '../assignmentCompatibility.service';

describe('Phase 8 legacy compatibility reads', () => {
  let dataSource: DataSource;
  let compatibilityService: AssignmentCompatibilityService;
  let teacherRepository: TeacherRepository;
  let classRepository: ClassRepository;
  let subjectRepository: SubjectRepository;

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
        ClassSubjectRequirement,
        TeacherSubjectCapability,
        TeachingAssignment,
      ],
    });
    await dataSource.initialize();

    CacheManager.resetInstance();
    TeacherRepository.resetInstance();
    ClassRepository.resetInstance();
    SubjectRepository.resetInstance();

    compatibilityService = new AssignmentCompatibilityService(dataSource);
    teacherRepository = TeacherRepository.getInstance(dataSource);
    classRepository = ClassRepository.getInstance(dataSource);
    subjectRepository = SubjectRepository.getInstance(dataSource);
  });

  afterEach(async () => {
    await dataSource.destroy();
    CacheManager.resetInstance();
    TeacherRepository.resetInstance();
    ClassRepository.resetInstance();
    SubjectRepository.resetInstance();
  });

  it('derives compatibility reads from canonical tables instead of stale legacy mirrors', async () => {
    const teacherEntityRepository = dataSource.getRepository(Teacher);
    const classEntityRepository = dataSource.getRepository(ClassGroup);
    const requirementRepository = dataSource.getRepository(ClassSubjectRequirement);
    const capabilityRepository = dataSource.getRepository(TeacherSubjectCapability);
    const assignmentRepository = dataSource.getRepository(TeachingAssignment);

    const subject = await subjectRepository.saveSubject({
      name: 'Mathematics',
      periodsPerWeek: 5,
    });

    const teacher = await teacherEntityRepository.save(
      teacherEntityRepository.create({
        fullName: 'Teacher One',
        primarySubjectIds: JSON.stringify([999]),
        allowedSubjectIds: JSON.stringify([]),
        classAssignments: JSON.stringify([{ subjectId: '999', classIds: ['999'] }]),
        restrictToPrimarySubjects: false,
        availability: '{}',
        unavailable: '[]',
        maxPeriodsPerWeek: 24,
        maxPeriodsPerDay: 6,
        maxConsecutivePeriods: 3,
        timePreference: '',
        preferredRoomIds: '[]',
        preferredColleagues: '[]',
        meta: '{}',
      })
    );

    const classGroup = await classEntityRepository.save(
      classEntityRepository.create({
        name: 'Class 7A',
        displayName: 'Grade 7 A',
        section: '',
        grade: 7,
        sectionIndex: 'A',
        studentCount: 30,
        subjectRequirements: JSON.stringify([{ subjectId: 999, periodsPerWeek: 1, teacherId: 999 }]),
        meta: '{}',
      })
    );

    const requirement = await requirementRepository.save(
      requirementRepository.create({
        classId: classGroup.id,
        subjectId: subject.id,
        requiredPeriodsPerWeek: 5,
        allowSplitAssignment: false,
      })
    );

    await capabilityRepository.save(
      capabilityRepository.create({
        teacherId: teacher.id,
        subjectId: subject.id,
        capabilityLevel: 'primary',
      })
    );

    await assignmentRepository.save(
      assignmentRepository.create({
        classSubjectRequirementId: requirement.id,
        teacherId: teacher.id,
        assignedPeriodsPerWeek: 5,
        isFixed: true,
        source: 'manual',
      })
    );

    const compatibilityAssignments = await compatibilityService.getLegacyAssignments();
    expect(compatibilityAssignments).toEqual([
      expect.objectContaining({
        teacherId: teacher.id,
        classId: classGroup.id,
        subjectId: subject.id,
        periodsPerWeek: 5,
      }),
    ]);

    const parsedTeacher = await teacherRepository.getTeacher(teacher.id, { skipCache: true });
    expect(parsedTeacher).toMatchObject({
      id: teacher.id,
      primarySubjectIds: [subject.id],
      allowedSubjectIds: [],
      classAssignments: [
        {
          subjectId: String(subject.id),
          classIds: [String(classGroup.id)],
        },
      ],
    });
    expect(parsedTeacher?.primarySubjectIds).not.toContain(999);

    const parsedClass = await classRepository.getClass(classGroup.id, { skipCache: true });
    expect(parsedClass?.subjectRequirements).toEqual([
      {
        subjectId: subject.id,
        periodsPerWeek: 5,
        teacherId: teacher.id,
      },
    ]);
  });
});
