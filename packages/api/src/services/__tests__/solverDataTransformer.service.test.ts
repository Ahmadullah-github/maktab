import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DataSource } from 'typeorm';
import { CacheManager } from '../../database/cache/cacheManager';
import { ClassRepository } from '../../database/repositories/class.repository';
import { ConfigRepository } from '../../database/repositories/config.repository';
import { RoomRepository } from '../../database/repositories/room.repository';
import { SchoolConfigRepository } from '../../database/repositories/schoolConfig.repository';
import { SubjectRepository } from '../../database/repositories/subject.repository';
import { TeacherRepository } from '../../database/repositories/teacher.repository';
import { ClassGroup } from '../../entity/ClassGroup';
import { ClassSubjectRequirement } from '../../entity/ClassSubjectRequirement';
import { Configuration } from '../../entity/Configuration';
import { Room } from '../../entity/Room';
import { SchoolConfig } from '../../entity/SchoolConfig';
import { Subject } from '../../entity/Subject';
import { Teacher } from '../../entity/Teacher';
import { TeacherSubjectCapability } from '../../entity/TeacherSubjectCapability';
import { TeachingAssignment } from '../../entity/TeachingAssignment';
import { SolverDataTransformerService } from '../solverDataTransformer.service';

describe('Phase 7 solver cutover', () => {
  let dataSource: DataSource;
  let transformer: SolverDataTransformerService;

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
        Room,
        Configuration,
        SchoolConfig,
        ClassSubjectRequirement,
        TeacherSubjectCapability,
        TeachingAssignment,
      ],
    });
    await dataSource.initialize();

    CacheManager.resetInstance();
    TeacherRepository.resetInstance();
    SubjectRepository.resetInstance();
    ClassRepository.resetInstance();
    RoomRepository.resetInstance();
    ConfigRepository.resetInstance();
    SchoolConfigRepository.resetInstance();
    SolverDataTransformerService.resetInstance();

    transformer = SolverDataTransformerService.getInstance(dataSource);
  });

  afterEach(async () => {
    await dataSource.destroy();
    CacheManager.resetInstance();
    TeacherRepository.resetInstance();
    SubjectRepository.resetInstance();
    ClassRepository.resetInstance();
    RoomRepository.resetInstance();
    ConfigRepository.resetInstance();
    SchoolConfigRepository.resetInstance();
    SolverDataTransformerService.resetInstance();
  });

  it('builds solver input from canonical assignment tables instead of legacy mirrors', async () => {
    const teacherRepo = dataSource.getRepository(Teacher);
    const subjectRepo = dataSource.getRepository(Subject);
    const classRepo = dataSource.getRepository(ClassGroup);
    const roomRepo = dataSource.getRepository(Room);
    const requirementRepo = dataSource.getRepository(ClassSubjectRequirement);
    const capabilityRepo = dataSource.getRepository(TeacherSubjectCapability);
    const assignmentRepo = dataSource.getRepository(TeachingAssignment);

    const subject = await subjectRepo.save(
      subjectRepo.create({
        name: 'Mathematics',
        periodsPerWeek: 5,
        requiredFeatures: '[]',
        desiredFeatures: '[]',
      })
    );

    const teacher = await teacherRepo.save(
      teacherRepo.create({
        fullName: 'Canonical Teacher',
        primarySubjectIds: JSON.stringify([999]),
        allowedSubjectIds: JSON.stringify([]),
        restrictToPrimarySubjects: false,
        availability: JSON.stringify([]),
        unavailable: JSON.stringify([]),
        maxPeriodsPerWeek: 24,
        maxPeriodsPerDay: 6,
        maxConsecutivePeriods: 3,
        timePreference: 'any',
        preferredRoomIds: JSON.stringify([]),
        preferredColleagues: JSON.stringify([]),
        classAssignments: JSON.stringify([{ subjectId: 999, classIds: [999] }]),
        meta: '{}',
      })
    );

    const classGroup = await classRepo.save(
      classRepo.create({
        name: 'Grade 7 A',
        displayName: '7-A',
        grade: 7,
        sectionIndex: 'A',
        studentCount: 30,
        singleTeacherMode: false,
        subjectRequirements: JSON.stringify([{ subjectId: 999, periodsPerWeek: 2 }]),
        meta: '{}',
      })
    );

    await roomRepo.save(
      roomRepo.create({
        name: 'Room 101',
        capacity: 40,
        type: 'classroom',
        features: '[]',
        unavailable: '[]',
        meta: '{}',
      })
    );

    const requirement = await requirementRepo.save(
      requirementRepo.create({
        classId: classGroup.id,
        subjectId: subject.id,
        requiredPeriodsPerWeek: 5,
        allowSplitAssignment: false,
      })
    );

    await capabilityRepo.save(
      capabilityRepo.create({
        teacherId: teacher.id,
        subjectId: subject.id,
        capabilityLevel: 'allowed',
      })
    );

    await assignmentRepo.save(
      assignmentRepo.create({
        classSubjectRequirementId: requirement.id,
        teacherId: teacher.id,
        assignedPeriodsPerWeek: 5,
        isFixed: true,
        source: 'manual',
      })
    );

    const solverInput = await transformer.transformToSolverInput();
    const transformedTeacher = solverInput.teachers.find((item) => item.id === String(teacher.id));
    const transformedClass = solverInput.classes.find((item) => item.id === String(classGroup.id));

    expect(transformedTeacher).toMatchObject({
      id: String(teacher.id),
      primarySubjectIds: [],
      allowedSubjectIds: [String(subject.id)],
    });
    expect(transformedTeacher?.primarySubjectIds).not.toContain('999');

    expect(transformedClass?.subjectRequirements).toEqual({
      [String(subject.id)]: {
        periodsPerWeek: 5,
        minConsecutive: undefined,
        maxConsecutive: undefined,
        minDaysPerWeek: undefined,
        maxDaysPerWeek: undefined,
      },
    });
    expect(transformedClass?.subjectRequirements['999']).toBeUndefined();

    expect(solverInput.fixedTeacherAssignments).toEqual([
      {
        teacherId: String(teacher.id),
        classId: String(classGroup.id),
        subjectId: String(subject.id),
        periodsPerWeek: 5,
        isFixed: true,
      },
    ]);
  });
});
