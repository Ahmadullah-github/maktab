import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DataSource } from 'typeorm';
import { CacheManager } from '../../database/cache/cacheManager';
import { ClassGroup } from '../../entity/ClassGroup';
import { ClassSubjectRequirement } from '../../entity/ClassSubjectRequirement';
import { Subject } from '../../entity/Subject';
import { TeacherSubjectCapability } from '../../entity/TeacherSubjectCapability';
import { Teacher } from '../../entity/Teacher';
import { TeachingAssignment } from '../../entity/TeachingAssignment';
import { AssignmentProjectionService } from '../assignmentProjection.service';

describe('Phase 4 assignment projections', () => {
  let dataSource: DataSource;
  let assignmentProjectionService: AssignmentProjectionService;

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
    AssignmentProjectionService.resetInstance();
    assignmentProjectionService = AssignmentProjectionService.getInstance(dataSource);
  });

  afterEach(async () => {
    await dataSource.destroy();
    CacheManager.resetInstance();
    AssignmentProjectionService.resetInstance();
  });

  it('builds projections from canonical tables instead of legacy mirrors', async () => {
    const fixture = await seedCanonicalProjectionFixture(dataSource, 8);

    const matrixResult = await assignmentProjectionService.getAssignmentMatrix();
    expect(matrixResult.success).toBe(true);
    expect(matrixResult.data?.classes).toHaveLength(2);

    const classA = matrixResult.data?.classes.find(
      (classGroup) => classGroup.classId === fixture.classA.id
    );
    expect(classA?.requirements).toHaveLength(1);
    expect(classA?.requirements[0]).toMatchObject({
      subjectId: fixture.subjectMath.id,
      subjectName: 'Mathematics',
      requiredPeriodsPerWeek: 5,
      assignedPeriodsPerWeek: 5,
      remainingPeriodsPerWeek: 0,
    });
    expect(classA?.requirements[0].assignments).toEqual([
      expect.objectContaining({
        teacherId: fixture.teacherOne.id,
        teacherName: 'Teacher One',
        assignedPeriodsPerWeek: 5,
        capabilityLevel: 'primary',
      }),
    ]);

    const classB = matrixResult.data?.classes.find(
      (classGroup) => classGroup.classId === fixture.classB.id
    );
    expect(classB?.requirements[0].assignedPeriodsPerWeek).toBe(3);
    expect(classB?.requirements[0].remainingPeriodsPerWeek).toBe(1);
    expect(classB?.requirements[0].warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'remaining_unassigned_periods' }),
        expect.objectContaining({ code: 'missing_capability' }),
      ])
    );

    const classViewResult = await assignmentProjectionService.getClassAssignmentView(
      fixture.classA.id
    );
    expect(classViewResult.success).toBe(true);
    expect(classViewResult.data).toMatchObject({
      classId: fixture.classA.id,
      className: 'Grade 7 A',
      classTeacherId: fixture.teacherTwo.id,
      classTeacherName: 'Teacher Two',
    });

    const subjectCoverageViewResult = await assignmentProjectionService.getSubjectCoverageView(
      fixture.subjectMath.id
    );
    expect(subjectCoverageViewResult.success).toBe(true);
    expect(subjectCoverageViewResult.data?.coverage).toHaveLength(2);
    expect(
      subjectCoverageViewResult.data?.coverage.find(
        (requirement) => requirement.classId === fixture.classB.id
      )
    ).toMatchObject({
      requiredPeriodsPerWeek: 4,
      assignedPeriodsPerWeek: 3,
      remainingPeriodsPerWeek: 1,
    });

    const teacherWorkloadViewResult = await assignmentProjectionService.getTeacherWorkloadView(
      fixture.teacherOne.id
    );
    expect(teacherWorkloadViewResult.success).toBe(true);
    expect(teacherWorkloadViewResult.data).toMatchObject({
      teacherId: fixture.teacherOne.id,
      teacherName: 'Teacher One',
      assignedPeriodsPerWeek: 7,
      remainingCapacityPerWeek: 1,
      capabilities: [
        {
          subjectId: fixture.subjectMath.id,
          subjectName: 'Mathematics',
          capabilityLevel: 'primary',
        },
      ],
    });
    expect(teacherWorkloadViewResult.data?.assignments).toHaveLength(2);

    const teacherSummaryResult = await assignmentProjectionService.getTeacherAssignmentSummary(
      fixture.teacherOne.id
    );
    expect(teacherSummaryResult.success).toBe(true);
    expect(teacherSummaryResult.data).toMatchObject({
      teacherId: fixture.teacherOne.id,
      teacherName: 'Teacher One',
      totals: {
        classCount: 2,
        assignedPeriodsPerWeek: 7,
      },
    });
    expect(teacherSummaryResult.data?.subjectLoad).toEqual([
      expect.objectContaining({
        subjectId: fixture.subjectMath.id,
        classCount: 2,
        assignedPeriodsPerWeek: 7,
      }),
    ]);
  });

  it('derives workload, coverage, and conflicts from canonical rows', async () => {
    const fixture = await seedCanonicalProjectionFixture(dataSource, 6);

    const workloadResult = await assignmentProjectionService.calculateTeacherWorkload(
      fixture.teacherOne.id
    );
    expect(workloadResult.success).toBe(true);
    expect(workloadResult.data).toMatchObject({
      teacherId: fixture.teacherOne.id,
      totalPeriods: 7,
      maxPeriods: 6,
      remainingCapacity: -1,
      status: 'overloaded',
    });
    expect(workloadResult.data?.breakdown).toEqual([
      expect.objectContaining({
        subjectId: fixture.subjectMath.id,
        totalPeriods: 7,
      }),
    ]);

    const subjectCoverageResult = await assignmentProjectionService.calculateSubjectCoverage(
      fixture.subjectMath.id
    );
    expect(subjectCoverageResult.success).toBe(true);
    expect(subjectCoverageResult.data).toMatchObject({
      subjectId: fixture.subjectMath.id,
      totalClassesRequiring: 2,
      assignedClasses: 2,
      coveragePercentage: 100,
      status: 'complete',
    });
    expect(subjectCoverageResult.data?.teacherDistribution).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          teacherId: fixture.teacherOne.id,
          compatibility: 'primary',
          totalPeriods: 7,
        }),
        expect.objectContaining({
          teacherId: fixture.teacherTwo.id,
          compatibility: 'incompatible',
          totalPeriods: 1,
        }),
      ])
    );

    const conflictsResult = await assignmentProjectionService.detectAllConflicts();
    expect(conflictsResult.success).toBe(true);
    expect(conflictsResult.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'workload_exceeded',
          affectedEntities: { teacherId: fixture.teacherOne.id },
        }),
        expect.objectContaining({
          type: 'coverage_insufficient',
          affectedEntities: {
            classId: fixture.classB.id,
            subjectId: fixture.subjectMath.id,
          },
        }),
        expect.objectContaining({
          type: 'subject_incompatible',
          affectedEntities: {
            teacherId: fixture.teacherTwo.id,
            classId: fixture.classB.id,
            subjectId: fixture.subjectMath.id,
          },
        }),
      ])
    );

    const duplicateConflictsForSplitRequirement =
      conflictsResult.data?.filter(
        (conflict) =>
          conflict.type === 'duplicate_assignment' &&
          conflict.affectedEntities.classId === fixture.classB.id &&
          conflict.affectedEntities.subjectId === fixture.subjectMath.id
      ) ?? [];
    expect(duplicateConflictsForSplitRequirement).toHaveLength(0);
  });
});

async function seedCanonicalProjectionFixture(
  dataSource: DataSource,
  teacherOneMaxPeriodsPerWeek: number
): Promise<{
  teacherOne: Teacher;
  teacherTwo: Teacher;
  subjectMath: Subject;
  classA: ClassGroup;
  classB: ClassGroup;
}> {
  const teacherRepository = dataSource.getRepository(Teacher);
  const subjectRepository = dataSource.getRepository(Subject);
  const classRepository = dataSource.getRepository(ClassGroup);
  const requirementRepository = dataSource.getRepository(ClassSubjectRequirement);
  const capabilityRepository = dataSource.getRepository(TeacherSubjectCapability);
  const assignmentRepository = dataSource.getRepository(TeachingAssignment);

  const teacherOne = await teacherRepository.save(
    teacherRepository.create({
      fullName: 'Teacher One',
      primarySubjectIds: '[]',
      allowedSubjectIds: '[]',
      classAssignments: JSON.stringify([{ subjectId: '999', classIds: ['999'] }]),
      restrictToPrimarySubjects: true,
      availability: '{}',
      unavailable: '[]',
      maxPeriodsPerWeek: teacherOneMaxPeriodsPerWeek,
      maxPeriodsPerDay: 6,
      maxConsecutivePeriods: 3,
      timePreference: '',
      preferredRoomIds: '[]',
      preferredColleagues: '[]',
      meta: '{}',
    })
  );

  const teacherTwo = await teacherRepository.save(
    teacherRepository.create({
      fullName: 'Teacher Two',
      primarySubjectIds: '[]',
      allowedSubjectIds: '[]',
      classAssignments: '[]',
      restrictToPrimarySubjects: true,
      availability: '{}',
      unavailable: '[]',
      maxPeriodsPerWeek: 4,
      maxPeriodsPerDay: 4,
      maxConsecutivePeriods: 2,
      timePreference: '',
      preferredRoomIds: '[]',
      preferredColleagues: '[]',
      meta: '{}',
    })
  );

  const subjectMath = await subjectRepository.save(
    subjectRepository.create({
      name: 'Mathematics',
      code: 'MATH',
      periodsPerWeek: 5,
      section: '',
      requiredRoomType: '',
      requiredFeatures: '[]',
      desiredFeatures: '[]',
      isDifficult: false,
      minRoomCapacity: 0,
      meta: '{}',
    })
  );

  const classA = await classRepository.save(
    classRepository.create({
      name: 'Class 7A',
      displayName: 'Grade 7 A',
      section: '',
      grade: 7,
      sectionIndex: 'A',
      studentCount: 30,
      fixedRoomId: null,
      singleTeacherMode: false,
      classTeacherId: teacherTwo.id,
      subjectRequirements: '[]',
      meta: '{}',
    })
  );

  const classB = await classRepository.save(
    classRepository.create({
      name: 'Class 7B',
      displayName: 'Grade 7 B',
      section: '',
      grade: 7,
      sectionIndex: 'B',
      studentCount: 28,
      fixedRoomId: null,
      singleTeacherMode: false,
      classTeacherId: null,
      subjectRequirements: JSON.stringify([
        { subjectId: subjectMath.id, periodsPerWeek: 99, teacherId: teacherTwo.id },
      ]),
      meta: '{}',
    })
  );

  const requirementA = await requirementRepository.save(
    requirementRepository.create({
      classId: classA.id,
      subjectId: subjectMath.id,
      requiredPeriodsPerWeek: 5,
      allowSplitAssignment: false,
    })
  );

  const requirementB = await requirementRepository.save(
    requirementRepository.create({
      classId: classB.id,
      subjectId: subjectMath.id,
      requiredPeriodsPerWeek: 4,
      allowSplitAssignment: true,
    })
  );

  await capabilityRepository.save(
    capabilityRepository.create({
      teacherId: teacherOne.id,
      subjectId: subjectMath.id,
      capabilityLevel: 'primary',
    })
  );

  await assignmentRepository.save([
    assignmentRepository.create({
      classSubjectRequirementId: requirementA.id,
      teacherId: teacherOne.id,
      assignedPeriodsPerWeek: 5,
      isFixed: true,
      source: 'manual',
    }),
    assignmentRepository.create({
      classSubjectRequirementId: requirementB.id,
      teacherId: teacherOne.id,
      assignedPeriodsPerWeek: 2,
      isFixed: true,
      source: 'manual',
    }),
    assignmentRepository.create({
      classSubjectRequirementId: requirementB.id,
      teacherId: teacherTwo.id,
      assignedPeriodsPerWeek: 1,
      isFixed: true,
      source: 'manual',
    }),
  ]);

  return {
    teacherOne,
    teacherTwo,
    subjectMath,
    classA,
    classB,
  };
}
