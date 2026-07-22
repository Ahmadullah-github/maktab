const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

require('reflect-metadata');

const { DataSource } = require('typeorm');
const { AppDataSource } = require('../dist/ormconfig');
const { CacheManager } = require('../dist/src/database/cache/cacheManager');
const {
  SubjectIdentityConflictError,
  SubjectRepository,
} = require('../dist/src/database/repositories/subject.repository');
const {
  CurriculumConfigRepository,
} = require('../dist/src/database/repositories/curriculum.repository');
const {
  TimetableRepository,
} = require('../dist/src/database/repositories/timetable.repository');
const { SubjectService } = require('../dist/src/services/subject.service');
const { ClassService } = require('../dist/src/services/class.service');
const { RequirementService } = require('../dist/src/services/requirement.service');
const {
  CurriculumMaterializationService,
} = require('../dist/src/services/curriculumMaterialization.service');
const { runCommittedTransaction } = require('../dist/src/database/transaction');
const { SchoolConfigRepository } = require('../dist/src/database/repositories/schoolConfig.repository');
const { CurriculumPlanService } = require('../dist/src/services/curriculumPlan.service');
const { Teacher } = require('../dist/src/entity/Teacher');
const { TeachingAssignment } = require('../dist/src/entity/TeachingAssignment');

async function withDatabase(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'maktab-subjects-'));
  const databasePath = path.join(directory, 'subjects.db');
  const dataSource = new DataSource({ ...AppDataSource.options, database: databasePath });
  const cache = new CacheManager();
  try {
    await dataSource.initialize();
    await run({ dataSource, cache });
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('subject identity is normalized, scoped, strict, and batch-safe', async () => {
  await withDatabase(async ({ dataSource, cache }) => {
    const repository = SubjectRepository.getInstance(dataSource, cache);
    const gradeOne = await repository.saveSubject({
      name: ' Shared   Name ',
      code: ' G1 ',
      grade: 1,
      schoolId: null,
    });
    const noGrade = await repository.saveSubject({
      name: 'Shared Name',
      code: 'NONE',
      grade: null,
      schoolId: null,
    });
    const anotherSchool = await repository.saveSubject({
      name: 'Shared Name',
      code: 'G1',
      grade: 1,
      schoolId: 99,
    });

    assert.notEqual(gradeOne.id, noGrade.id);
    assert.notEqual(gradeOne.id, anotherSchool.id);
    assert.equal(gradeOne.name, 'Shared Name');
    assert.equal(gradeOne.code, 'G1');

    await assert.rejects(
      repository.saveSubject({ name: ' shared name ', code: 'OTHER', grade: 1, schoolId: null }),
      /UNIQUE|unique/i
    );
    await assert.rejects(
      repository.saveSubject({ name: 'Invalid periods', code: 'ZERO', grade: 1, periodsPerWeek: 0 }),
      /invalid subject contract/
    );

    await assert.rejects(
      repository.bulkUpsert([
        { name: 'Batch', code: 'B', grade: 2, schoolId: null, periodsPerWeek: 2 },
        { name: ' Batch ', code: 'b', grade: 2, schoolId: null, periodsPerWeek: 4 },
      ]),
      SubjectIdentityConflictError
    );
    assert.equal((await repository.findByGrade(2)).length, 0);

    await repository.saveSubject({ name: 'Alpha', code: 'A', grade: 3, schoolId: null });
    await repository.saveSubject({ name: 'Beta', code: 'BETA', grade: 3, schoolId: null });
    await assert.rejects(
      repository.bulkUpsert([
        { name: 'Alpha', code: 'BETA', grade: 3, schoolId: null },
      ]),
      SubjectIdentityConflictError
    );
  });
});

test('curriculum import preserves user-owned constraints and normalizes feature tags', async () => {
  await withDatabase(async ({ dataSource, cache }) => {
    const service = SubjectService.getInstance(dataSource, cache);
    const invalidCustom = await service.create({
      name: 'Unclassified custom',
      code: 'BAD-CUSTOM',
      grade: 4,
      isCustom: true,
    });
    assert.equal(invalidCustom.success, false);
    assert.match(invalidCustom.error, /customCategory/);

    const created = await service.create({
      name: 'Configured',
      code: 'CFG',
      grade: 4,
      schoolId: null,
      periodsPerWeek: 2,
      requiredRoomType: 'normal',
      requiredFeatures: [' Projector ', 'projector', 'AUDIO'],
      desiredFeatures: ['WhiteBoard'],
      minRoomCapacity: 35,
      meta: { owner: 'user' },
    });
    assert.equal(created.success, true);

    const imported = await service.bulkUpsert([
      {
        name: 'Configured',
        code: 'CFG',
        grade: 4,
        schoolId: null,
        periodsPerWeek: 5,
        isDifficult: true,
      },
    ]);
    assert.equal(imported.success, true);
    assert.deepEqual(imported.data[0].requiredFeatures, ['audio', 'projector']);
    assert.deepEqual(imported.data[0].desiredFeatures, ['whiteboard']);
    assert.equal(imported.data[0].requiredRoomType, 'normal');
    assert.equal(imported.data[0].minRoomCapacity, 35);
    assert.equal(imported.data[0].meta.owner, 'user');
    assert.equal(imported.data[0].periodsPerWeek, 5);
    const curriculum = await CurriculumConfigRepository.getInstance(dataSource, cache).getForGrade(4);
    assert.equal(curriculum.subjects.find((subject) => subject.code === 'CFG').periodsPerWeek, 5);
  });
});

test('effective curriculum materializes custom subjects and specialized labs', async () => {
  await withDatabase(async ({ dataSource, cache }) => {
    const curriculumRepository = CurriculumConfigRepository.getInstance(dataSource, cache);
    await curriculumRepository.saveForGrade(
      7,
      {
        subjects: [
          {
            itemId: 'math-7',
            name: 'ریاضی',
            nameEn: 'Mathematics',
            code: 'ریض۷',
            periodsPerWeek: 4,
            isDifficult: true,
          },
          {
            itemId: 'robotics-7',
            name: 'رباتیک',
            nameEn: 'Robotics',
            code: 'ROB7',
            periodsPerWeek: 2,
            requiredRoomType: 'computer_lab',
          },
        ],
      },
      null
    );

    const result = await CurriculumMaterializationService.getInstance(
      dataSource,
      cache
    ).materializeGrades([7], null);
    const custom = result.subjects.find((subject) => subject.code === 'ROB7');
    const physics = result.subjects.find((subject) => subject.code === 'فزی۷');
    const mathematics = result.subjects.find((subject) => subject.code === 'ریض۷');

    assert.equal(custom.isCustom, true);
    assert.equal(custom.customCategory, 'Middle');
    assert.equal(custom.requiredRoomType, 'computer_lab');
    assert.equal(mathematics.periodsPerWeek, 4);
  });
});

test('class creation reconciles and applies the complete effective curriculum', async () => {
  await withDatabase(async ({ dataSource, cache }) => {
    const manualSubject = await SubjectService.getInstance(dataSource, cache).create({
      name: 'Turkish',
      code: 'TR8',
      grade: 8,
      schoolId: null,
      periodsPerWeek: 3,
    });
    assert.equal(manualSubject.success, true);

    const created = await ClassService.getInstance(dataSource, cache).create({
      name: 'Grade 8 A',
      displayName: '8-A',
      grade: 8,
      schoolId: null,
      studentCount: 25,
    });

    assert.equal(created.success, true);
    assert.equal(created.data.subjectRequirements.length, 1);
    assert.equal(
      created.data.subjectRequirements.some(
        (requirement) => requirement.subjectId === manualSubject.data.id
      ),
      true
    );
    assert.equal(
      created.data.subjectRequirements.every(
        (requirement) => Number.isInteger(requirement.periodsPerWeek) && requirement.periodsPerWeek > 0
      ),
      true
    );
    assert.equal(
      created.data.subjectRequirements.reduce(
        (sum, requirement) => sum + requirement.periodsPerWeek,
        0
      ),
      3
    );
  });
});

test('curriculum synchronization adds manual grade subjects to existing classes', async () => {
  await withDatabase(async ({ dataSource, cache }) => {
    const classService = ClassService.getInstance(dataSource, cache);
    const createdClass = await classService.create({
      name: 'Grade 7 A',
      displayName: '7-A',
      grade: 7,
      schoolId: null,
      studentCount: 30,
    });
    assert.equal(createdClass.success, true);

    const manualSubject = await SubjectService.getInstance(dataSource, cache).create({
      name: 'Turkish',
      code: 'TR7',
      grade: 7,
      schoolId: null,
      periodsPerWeek: 3,
    });
    assert.equal(manualSubject.success, true);

    const result = await CurriculumMaterializationService.getInstance(
      dataSource,
      cache
    ).materializeGrades([7], null);
    const refreshedClass = await classService.findById(createdClass.data.id);

    assert.equal(
      result.subjects.some((subject) => subject.id === manualSubject.data.id),
      true
    );
    assert.equal(refreshedClass.success, true);
    const manualRequirement = refreshedClass.data.subjectRequirements.find(
      (requirement) => requirement.subjectId === manualSubject.data.id
    );
    assert.equal(manualRequirement.subjectId, manualSubject.data.id);
    assert.equal(manualRequirement.periodsPerWeek, 3);
  });
});

test('grade period changes preserve explicit class exceptions and reset cleanly', async () => {
  await withDatabase(async ({ dataSource, cache }) => {
    const materializer = CurriculumMaterializationService.getInstance(dataSource, cache);
    const classService = ClassService.getInstance(dataSource, cache);
    const requirementService = RequirementService.getInstance(dataSource, cache);
    const curriculumRepository = CurriculumConfigRepository.getInstance(dataSource, cache);
    await curriculumRepository.saveForGrade(7, { subjects: [{
      itemId: 'math-7', name: 'ریاضی', nameEn: 'Mathematics', code: 'ریض۷', periodsPerWeek: 5,
    }] }, null);
    const initial = await materializer.materializeGrades([7], null);
    const mathematics = initial.subjects.find((subject) => subject.code === 'ریض۷');
    assert.ok(mathematics);
    assert.ok(mathematics.periodsPerWeek > 1);

    const createdClasses = [];
    for (const section of ['A', 'B', 'C']) {
      const result = await classService.create({
        name: `Grade 7 ${section}`,
        displayName: `7-${section}`,
        grade: 7,
        schoolId: null,
        studentCount: 25,
      });
      assert.equal(result.success, true);
      createdClasses.push(result.data);
    }

    const exceptionalClass = createdClasses[2];
    const exceptionalPeriods = mathematics.periodsPerWeek - 1;
    const exceptionUpdate = await requirementService.updateRequirementPeriods(
      exceptionalClass.id,
      mathematics.id,
      exceptionalPeriods
    );
    assert.equal(exceptionUpdate.periodMode, 'class_override');

    const nextDefault = mathematics.periodsPerWeek + 1;
    await materializer.updateGradeSubjectPeriods(7, mathematics.id, nextDefault, null);

    for (const classGroup of createdClasses) {
      const refreshed = await classService.findById(classGroup.id);
      assert.equal(refreshed.success, true);
      const requirement = refreshed.data.subjectRequirements.find(
        (item) => item.subjectId === mathematics.id
      );
      assert.ok(requirement);
      if (classGroup.id === exceptionalClass.id) {
        assert.equal(requirement.periodsPerWeek, exceptionalPeriods);
        assert.equal(requirement.periodMode, 'class_override');
      } else {
        assert.equal(requirement.periodsPerWeek, nextDefault);
        assert.equal(requirement.periodMode, 'inherited');
      }
    }

    const resetRequirement = await requirementService.updateRequirementPeriods(
      exceptionalClass.id,
      mathematics.id,
      nextDefault
    );
    assert.equal(resetRequirement.requiredPeriodsPerWeek, nextDefault);
    assert.equal(resetRequirement.periodMode, 'inherited');
  });
});

test('curriculum configuration and materialization roll back as one transaction', async () => {
  await withDatabase(async ({ dataSource, cache }) => {
    const curriculumRepository = CurriculumConfigRepository.getInstance(dataSource, cache);
    const materializer = CurriculumMaterializationService.getInstance(dataSource, cache);

    await assert.rejects(
      runCommittedTransaction(dataSource, cache, async (manager) => {
        await curriculumRepository.saveForGrade(
          6,
          {
            subjects: [
              {
                itemId: 'bad-room-6',
                name: 'Invalid room subject',
                nameEn: 'Invalid room subject',
                code: 'BADROOM',
                periodsPerWeek: 2,
                requiredRoomType: 'room_type_that_does_not_exist',
              },
            ],
          },
          null,
          manager
        );
        await materializer.materializeGrades([6], null, { manager });
      }),
      /FOREIGN KEY|constraint/i
    );

    assert.equal(await curriculumRepository.getForGrade(6, null), null);
  });
});

test('subject changes mark matching saved timetables stale', async () => {
  await withDatabase(async ({ dataSource, cache }) => {
    const timetableRepository = TimetableRepository.getInstance(dataSource, cache);
    const saved = await timetableRepository.saveTimetable({
      name: 'Current schedule',
      schoolId: null,
      data: { schedule: [] },
    });
    assert.equal(saved.isStale, false);

    const created = await SubjectService.getInstance(dataSource, cache).create({
      name: 'New subject',
      code: 'NEW',
      grade: 5,
      schoolId: null,
      periodsPerWeek: 2,
    });
    assert.equal(created.success, true);

    const stale = await timetableRepository.getTimetable(saved.id);
    assert.equal(stale.isStale, true);
    assert.match(stale.staleReason, /Subject .* was created/);

    const refreshed = await timetableRepository.updateTimetable(
      saved.id,
      { schedule: [] },
      stale.revision
    );
    assert.equal(refreshed.isStale, true);
    assert.match(refreshed.staleReason, /Subject .* was created/);

    await assert.rejects(
      timetableRepository.updateTimetable(saved.id, { schedule: [] }, stale.revision),
      (error) => error.code === 'TIMETABLE_REVISION_CONFLICT'
    );
  });
});

test('curriculum preview is non-mutating and apply atomically creates subjects and reviewed classes', async () => {
  await withDatabase(async ({ dataSource, cache }) => {
    const schoolConfig = await SchoolConfigRepository.getInstance(dataSource, cache).getOrCreate();
    const planner = new CurriculumPlanService(dataSource);
    const input = {
      schoolId: null,
      schoolConfigRevision: schoolConfig.revision,
      gradeConfigs: [{
        grade: 7,
        revision: 0,
        subjects: [{ itemId: 'turkish-7', name: 'ترکی', nameEn: 'Turkish', code: 'TR7', periodsPerWeek: 1 }],
      }],
      classes: [{ name: 'صنف-7-الف', displayName: 'صنف 7 الف', grade: 7, sectionIndex: 'الف', studentCount: 30 }],
    };

    const preview = await planner.preview(input);
    assert.equal(preview.canApply, true);
    assert.equal(preview.changedGrades[0].subjects.added.length, 1);
    assert.equal(await CurriculumConfigRepository.getInstance(dataSource, cache).getForGrade(7), null);

    const applied = await planner.apply({
      ...input,
      previewToken: preview.previewToken,
      confirmAssignmentRemoval: false,
    });
    assert.equal(applied.createdClasses.length, 1);
    const saved = await CurriculumConfigRepository.getInstance(dataSource, cache).getForGrade(7);
    assert.equal(saved.subjects[0].name, 'ترکی');
    const createdClass = await ClassService.getInstance(dataSource, cache).findById(applied.createdClasses[0].id);
    assert.equal(createdClass.data.subjectRequirements.length, 1);

    await assert.rejects(
      planner.apply({ ...input, previewToken: preview.previewToken, confirmAssignmentRemoval: false }),
      /changed|stale/i
    );
  });
});

test('curriculum preview blocks demand above configured weekly capacity', async () => {
  await withDatabase(async ({ dataSource, cache }) => {
    const schoolConfig = await SchoolConfigRepository.getInstance(dataSource, cache).getOrCreate();
    const preview = await new CurriculumPlanService(dataSource).preview({
      schoolId: null,
      schoolConfigRevision: schoolConfig.revision,
      gradeConfigs: [{
        grade: 7,
        revision: 0,
        subjects: [{ itemId: 'too-many', name: 'Over capacity', code: 'OVER', periodsPerWeek: 43 }],
      }],
      classes: [],
    });
    assert.equal(preview.canApply, false);
    assert.equal(preview.changedGrades[0].blocker, true);
  });
});

test('curriculum deletion preview reports assigned teachers and requires confirmation', async () => {
  await withDatabase(async ({ dataSource, cache }) => {
    const schoolConfig = await SchoolConfigRepository.getInstance(dataSource, cache).getOrCreate();
    const planner = new CurriculumPlanService(dataSource);
    const initialInput = {
      schoolId: null,
      schoolConfigRevision: schoolConfig.revision,
      gradeConfigs: [{
        grade: 7,
        revision: 0,
        subjects: [{ itemId: 'craft-7', name: 'حرفه', code: 'CR7', periodsPerWeek: 1 }],
      }],
      classes: [{ name: 'Grade 7 A', grade: 7, sectionIndex: 'A', studentCount: 30 }],
    };
    const initialPreview = await planner.preview(initialInput);
    const initialApply = await planner.apply({
      ...initialInput,
      previewToken: initialPreview.previewToken,
      confirmAssignmentRemoval: false,
    });

    const createdClass = initialApply.createdClasses[0];
    const requirement = (await RequirementService.getInstance(dataSource, cache)
      .getRequirementsByClass(createdClass.id))[0];
    const teacher = await dataSource.getRepository(Teacher).save({
      fullName: 'Craft teacher',
      staffCode: 'CRAFT-1',
      primarySubjectIds: '[]',
      allowedSubjectIds: '[]',
      unavailable: '[]',
      maxPeriodsPerWeek: 10,
      classAssignments: '[]',
    });
    const assignment = await dataSource.getRepository(TeachingAssignment).save({
      classSubjectRequirementId: requirement.id,
      teacherId: teacher.id,
      assignedPeriodsPerWeek: 1,
      isFixed: true,
      source: 'manual',
    });

    const removalInput = {
      schoolId: null,
      schoolConfigRevision: schoolConfig.revision,
      gradeConfigs: [{ grade: 7, revision: 1, subjects: [] }],
      classes: [],
    };
    const removalPreview = await planner.preview(removalInput);
    assert.deepEqual(removalPreview.assignmentRemovals, [{
      id: assignment.id,
      teacherId: teacher.id,
      classId: createdClass.id,
      subjectId: requirement.subjectId,
    }]);
    await assert.rejects(
      planner.apply({
        ...removalInput,
        previewToken: removalPreview.previewToken,
        confirmAssignmentRemoval: false,
      }),
      /explicit confirmation/i
    );

    await planner.apply({
      ...removalInput,
      previewToken: removalPreview.previewToken,
      confirmAssignmentRemoval: true,
    });
    const deletedAssignment = await dataSource.getRepository(TeachingAssignment).findOneBy({ id: assignment.id });
    assert.equal(deletedAssignment, null);
  });
});
