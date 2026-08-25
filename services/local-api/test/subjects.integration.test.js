const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

require('reflect-metadata');

const { DataSource } = require('typeorm');
const { AppDataSource } = require('../dist/ormconfig');
const { CacheManager } = require('../dist/src/database/cache/cacheManager');
const { AuditLog } = require('../dist/src/entity/AuditLog');
const { ClassGroup } = require('../dist/src/entity/ClassGroup');
const { SchoolConfig } = require('../dist/src/entity/SchoolConfig');
const { Subject } = require('../dist/src/entity/Subject');
const { Teacher } = require('../dist/src/entity/Teacher');
const { TeachingAssignment } = require('../dist/src/entity/TeachingAssignment');
const { TimetableRepository } = require('../dist/src/database/repositories/timetable.repository');
const { SchoolConfigRepository } = require('../dist/src/database/repositories/schoolConfig.repository');
const { ClassService } = require('../dist/src/services/class.service');
const { RequirementService } = require('../dist/src/services/requirement.service');
const {
  CurriculumConflictError,
  SchoolCurriculumOrchestrator,
} = require('../dist/src/services/schoolCurriculumOrchestrator.service');
const { SubjectService } = require('../dist/src/services/subject.service');
const { TeacherService } = require('../dist/src/services/teacher.service');

async function withDatabase(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'maktab-curriculum-'));
  const databasePath = path.join(directory, 'curriculum.db');
  const dataSource = new DataSource({ ...AppDataSource.options, database: databasePath });
  const cache = new CacheManager();
  try {
    await dataSource.initialize();
    await enableMiddleGrades(dataSource);
    await run({ dataSource, cache, databasePath });
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

async function enableMiddleGrades(dataSource) {
  const repository = dataSource.getRepository(SchoolConfig);
  const config = await SchoolConfigRepository.getInstance(dataSource, new CacheManager()).getOrCreate(null);
  config.enableMiddle = true;
  config.updatedAt = new Date();
  await repository.save(config);
}

async function applyTemplate(orchestrator, grades) {
  const plan = await orchestrator.getPlan(null);
  const template = await orchestrator.getAfghanistanTemplate(null);
  const preview = await orchestrator.preview({
    schoolId: null,
    revision: plan.revision,
    changedGrades: grades.map((grade) => ({
      grade,
      items: template.grades.find((entry) => entry.grade === grade).items.map(
        ({ normalizedCode, position, ...item }) => item
      ),
    })),
    synchronizeClassIds: [],
    proposedClasses: [],
  });
  assert.deepEqual(preview.blockers, []);
  return orchestrator.apply(preview.previewToken, false);
}

test('school curriculum starts empty and Afghanistan template is non-mutating', async () => {
  await withDatabase(async ({ dataSource, cache }) => {
    const orchestrator = SchoolCurriculumOrchestrator.getInstance(dataSource, cache);
    const before = await orchestrator.getPlan(null);
    assert.equal(before.revision, 0);
    assert.ok(before.activeGrades.includes(7));
    assert.equal(before.grades.find((entry) => entry.grade === 7).items.length, 0);

    const template = await orchestrator.getAfghanistanTemplate(null);
    assert.ok(template.grades.find((entry) => entry.grade === 7).items.length > 0);
    const after = await orchestrator.getPlan(null);
    assert.equal(after.revision, 0);
    assert.equal(after.grades.find((entry) => entry.grade === 7).items.length, 0);
  });
});

test('manual subject creation becomes curriculum and synchronizes every existing grade class', async () => {
  await withDatabase(async ({ dataSource, cache }) => {
    const classService = ClassService.getInstance(dataSource, cache);
    const classes = [];
    for (const section of ['A', 'B', 'C']) {
      const created = await classService.create({
        name: `Grade 7 ${section}`,
        displayName: `7-${section}`,
        grade: 7,
        schoolId: null,
        studentCount: 25,
      });
      assert.equal(created.success, true);
      classes.push(created.data);
    }

    const createdSubject = await SubjectService.getInstance(dataSource, cache).create({
      name: 'ترکی',
      code: 'TR7',
      grade: 7,
      schoolId: null,
      periodsPerWeek: 2,
    });
    assert.equal(createdSubject.success, true);
    assert.ok(createdSubject.data.curriculumItemId);

    for (const classGroup of classes) {
      const refreshed = await classService.findById(classGroup.id);
      assert.equal(
        refreshed.data.subjectRequirements.some(
          (requirement) => requirement.subjectId === createdSubject.data.id
        ),
        true
      );
    }
  });
});

test('reported grades 7-9 flow removes حرفه and adds ترکی without restoring the template row', async () => {
  await withDatabase(async ({ dataSource, cache }) => {
    const orchestrator = SchoolCurriculumOrchestrator.getInstance(dataSource, cache);
    await applyTemplate(orchestrator, [7, 8, 9]);
    const classService = ClassService.getInstance(dataSource, cache);
    const classes = [];
    for (const grade of [7, 8, 9]) {
      const created = await classService.create({
        name: `Grade ${grade} A`,
        displayName: `${grade}-A`,
        grade,
        schoolId: null,
        studentCount: 30,
      });
      assert.equal(created.success, true);
      classes.push(created.data);
    }

    const subjectService = SubjectService.getInstance(dataSource, cache);
    for (const grade of [7, 8, 9]) {
      const vocational = (await dataSource.getRepository(Subject).find({
        where: { grade, isDeleted: false },
      })).find((subject) => subject.name === 'حرفه');
      assert.ok(vocational);
      const removed = await subjectService.delete(vocational.id);
      assert.equal(removed.success, true);

      const turkish = await subjectService.create({
        name: 'ترکی',
        code: `TR${grade}`,
        grade,
        schoolId: null,
        periodsPerWeek: 1,
      });
      assert.equal(turkish.success, true);
    }

    for (const classGroup of classes) {
      const refreshed = await classService.findById(classGroup.id);
      const subjectIds = refreshed.data.subjectRequirements.map((entry) => entry.subjectId);
      const activeSubjects = await dataSource.getRepository(Subject).find({
        where: { grade: classGroup.grade, isDeleted: false },
      });
      assert.equal(activeSubjects.some((subject) => subject.name === 'حرفه'), false);
      const turkish = activeSubjects.find((subject) => subject.name === 'ترکی');
      assert.ok(turkish);
      assert.ok(subjectIds.includes(turkish.id));
    }
  });
});

test('curriculum edits preserve stable subject identity and class period overrides', async () => {
  await withDatabase(async ({ dataSource, cache }) => {
    const orchestrator = SchoolCurriculumOrchestrator.getInstance(dataSource, cache);
    const subjectService = SubjectService.getInstance(dataSource, cache);
    const classService = ClassService.getInstance(dataSource, cache);
    const requirementService = RequirementService.getInstance(dataSource, cache);
    const createdSubject = await subjectService.create({
      name: 'ریاضی',
      code: 'M7',
      grade: 7,
      periodsPerWeek: 4,
    });
    const createdClass = await classService.create({
      name: 'Grade 7 Identity',
      grade: 7,
      studentCount: 20,
    });
    await requirementService.updateRequirementPeriods(
      createdClass.data.id,
      createdSubject.data.id,
      3
    );

    const plan = await orchestrator.getPlan(null);
    const grade = plan.grades.find((entry) => entry.grade === 7);
    const preview = await orchestrator.preview({
      revision: plan.revision,
      changedGrades: [{
        grade: 7,
        items: grade.items.map(({ normalizedCode, ...item }) => ({
          ...item,
          name: 'ریاضیات',
          code: 'MATH7',
          weeklyPeriods: 5,
        })),
      }],
      synchronizeClassIds: [],
      proposedClasses: [],
    });
    await orchestrator.apply(preview.previewToken, false);

    const renamed = await dataSource.getRepository(Subject).findOne({
      where: { id: createdSubject.data.id },
    });
    assert.equal(renamed.name, 'ریاضیات');
    assert.equal(renamed.code, 'MATH7');
    assert.equal(renamed.curriculumItemId, createdSubject.data.curriculumItemId);
    const refreshed = await classService.findById(createdClass.data.id);
    const requirement = refreshed.data.subjectRequirements.find(
      (entry) => entry.subjectId === createdSubject.data.id
    );
    assert.equal(requirement.periodsPerWeek, 3);
    assert.equal(requirement.periodMode, 'class_override');
  });
});

test('preview is non-mutating, fingerprints concurrent changes, and requires destructive confirmation', async () => {
  await withDatabase(async ({ dataSource, cache }) => {
    const orchestrator = SchoolCurriculumOrchestrator.getInstance(dataSource, cache);
    const subjectService = SubjectService.getInstance(dataSource, cache);
    const classService = ClassService.getInstance(dataSource, cache);
    const subject = await subjectService.create({
      name: 'Assigned',
      code: 'ASSIGNED7',
      grade: 7,
      periodsPerWeek: 2,
    });
    const classGroup = await classService.create({ name: 'Assigned Class', grade: 7, studentCount: 20 });
    const [requirement] = await RequirementService.getInstance(dataSource, cache).getRequirementsByClass(classGroup.data.id);
    const teacherResult = await TeacherService.getInstance(dataSource, cache).create({
      fullName: 'Curriculum Teacher',
      staffCode: 'CURR-T-1',
    });
    assert.equal(teacherResult.success, true);
    const teacher = teacherResult.data;
    await dataSource.getRepository(TeachingAssignment).save(dataSource.getRepository(TeachingAssignment).create({
      classSubjectRequirementId: requirement.id,
      teacherId: teacher.id,
      assignedPeriodsPerWeek: 2,
      isFixed: true,
      source: 'manual',
    }));

    const plan = await orchestrator.getPlan(null);
    const grade = plan.grades.find((entry) => entry.grade === 7);
    const preview = await orchestrator.preview({
      revision: plan.revision,
      changedGrades: [{ grade: 7, items: grade.items.filter((item) => item.id !== subject.data.curriculumItemId) }],
      synchronizeClassIds: [],
      proposedClasses: [],
    });
    assert.equal((await orchestrator.getPlan(null)).revision, plan.revision);
    assert.equal(preview.assignmentImpacts.length, 1);
    await assert.rejects(
      orchestrator.apply(preview.previewToken, false),
      (error) => error instanceof CurriculumConflictError && error.code === 'CONFIRMATION_REQUIRED'
    );
    await orchestrator.apply(preview.previewToken, true);
    assert.equal((await dataSource.getRepository(TeachingAssignment).find({ where: { isDeleted: false } })).length, 0);
    assert.equal((await dataSource.getRepository(AuditLog).count({ where: { entityType: 'SchoolCurriculumPlan' } })) > 0, true);

    const current = await orchestrator.getPlan(null);
    const syncPreview = await orchestrator.preview({
      revision: current.revision,
      changedGrades: [],
      synchronizeClassIds: [classGroup.data.id],
      proposedClasses: [],
    });
    await dataSource.getRepository(ClassGroup).update(
      { id: classGroup.data.id },
      { grade: 8, updatedAt: new Date(Date.now() + 1000) }
    );
    await assert.rejects(
      orchestrator.apply(syncPreview.previewToken, true),
      (error) => error instanceof CurriculumConflictError && error.code === 'PREVIEW_CHANGED'
    );
  });
});

test('curriculum apply marks timetables stale once with a structured reason', async () => {
  await withDatabase(async ({ dataSource, cache }) => {
    const timetableRepository = TimetableRepository.getInstance(dataSource, cache);
    const saved = await timetableRepository.saveTimetable({
      name: 'Current schedule',
      schoolId: null,
      data: { schedule: [] },
    });
    const created = await SubjectService.getInstance(dataSource, cache).create({
      name: 'New subject',
      code: 'NEW7',
      grade: 7,
      periodsPerWeek: 2,
    });
    assert.equal(created.success, true);
    const stale = await timetableRepository.getTimetable(saved.id);
    assert.equal(stale.isStale, true);
    assert.equal(JSON.parse(stale.staleReason).code, 'SCHOOL_CURRICULUM_APPLIED');
  });
});

test('expired previews, capacity blockers, and reused tokens are rejected with structured conflicts', async () => {
  await withDatabase(async ({ dataSource, cache }) => {
    const orchestrator = SchoolCurriculumOrchestrator.getInstance(dataSource, cache);
    const plan = await orchestrator.getPlan(null);
    const validPreview = await orchestrator.preview({
      revision: plan.revision,
      changedGrades: [{
        grade: 7,
        items: [{ name: 'ترکی', code: 'TR7', weeklyPeriods: 1 }],
      }],
      synchronizeClassIds: [],
      proposedClasses: [],
    });
    const stored = orchestrator.previews.get(validPreview.previewToken);
    stored.expiresAt = Date.now() - 1;
    await assert.rejects(
      orchestrator.apply(validPreview.previewToken, false),
      (error) => error instanceof CurriculumConflictError && error.code === 'PREVIEW_EXPIRED'
    );

    const capacityPreview = await orchestrator.preview({
      revision: plan.revision,
      changedGrades: [{
        grade: 7,
        items: [{ name: 'بیش از ظرفیت', code: 'OVER7', weeklyPeriods: 84 }],
      }],
      synchronizeClassIds: [],
      proposedClasses: [],
    });
    assert.equal(capacityPreview.blockers.some((entry) => entry.code === 'GRADE_CAPACITY_EXCEEDED'), true);
    await assert.rejects(
      orchestrator.apply(capacityPreview.previewToken, false),
      (error) => error instanceof CurriculumConflictError && error.code === 'CURRICULUM_BLOCKED'
    );

    const secondValid = await orchestrator.preview({
      revision: plan.revision,
      changedGrades: [{
        grade: 7,
        items: [{ name: 'ترکی', code: 'TR7', weeklyPeriods: 1 }],
      }],
      synchronizeClassIds: [],
      proposedClasses: [],
    });
    await orchestrator.apply(secondValid.previewToken, false);
    await assert.rejects(
      orchestrator.apply(secondValid.previewToken, false),
      (error) => error instanceof CurriculumConflictError && error.code === 'PREVIEW_EXPIRED'
    );
  });
});

test('apply rolls back curriculum, subjects, and requirements when orchestration fails', async () => {
  await withDatabase(async ({ dataSource, cache }) => {
    const subjectService = SubjectService.getInstance(dataSource, cache);
    const classService = ClassService.getInstance(dataSource, cache);
    const orchestrator = SchoolCurriculumOrchestrator.getInstance(dataSource, cache);
    const requirementService = RequirementService.getInstance(dataSource, cache);
    const subject = await subjectService.create({
      name: 'Rollback subject', code: 'ROLL7', grade: 7, periodsPerWeek: 2,
    });
    const classGroup = await classService.create({ name: 'Rollback class', grade: 7, studentCount: 20 });
    const before = await orchestrator.getPlan(null);
    const grade = before.grades.find((entry) => entry.grade === 7);
    const preview = await orchestrator.preview({
      revision: before.revision,
      changedGrades: [{
        grade: 7,
        items: grade.items.map(({ normalizedCode, ...item }) => ({ ...item, weeklyPeriods: 3 })),
      }],
      synchronizeClassIds: [],
      proposedClasses: [],
    });

    const originalSync = requirementService.syncClassRequirements;
    requirementService.syncClassRequirements = async () => {
      throw new Error('forced orchestration failure');
    };
    try {
      await assert.rejects(orchestrator.apply(preview.previewToken, false), /forced orchestration failure/);
    } finally {
      requirementService.syncClassRequirements = originalSync;
    }

    const after = await orchestrator.getPlan(null);
    assert.equal(after.revision, before.revision);
    assert.equal(after.grades.find((entry) => entry.grade === 7).items[0].weeklyPeriods, 2);
    assert.equal((await dataSource.getRepository(Subject).findOneBy({ id: subject.data.id })).periodsPerWeek, 2);
    const [requirement] = await requirementService.getRequirementsByClass(classGroup.data.id);
    assert.equal(requirement.requiredPeriodsPerWeek, 2);
  });
});

test('reviewed class proposals populate exactly themselves without syncing an unchanged grade', async () => {
  await withDatabase(async ({ dataSource, cache }) => {
    const subject = await SubjectService.getInstance(dataSource, cache).create({
      name: 'Grade seven subject', code: 'ONLY7', grade: 7, periodsPerWeek: 2,
    });
    const classService = ClassService.getInstance(dataSource, cache);
    const existing = await classService.create({ name: 'Existing 7', grade: 7, studentCount: 20 });
    const requirementService = RequirementService.getInstance(dataSource, cache);
    await requirementService.updateRequirementPeriods(existing.data.id, subject.data.id, 1);

    const orchestrator = SchoolCurriculumOrchestrator.getInstance(dataSource, cache);
    const before = await orchestrator.getPlan(null);
    const preview = await orchestrator.preview({
      revision: before.revision,
      changedGrades: [],
      synchronizeClassIds: [],
      proposedClasses: [{ name: 'Reviewed 7-A', grade: 7, studentCount: 24, academicYearId: null }],
    });
    assert.deepEqual(preview.affectedClasses, []);
    const result = await orchestrator.apply(preview.previewToken, false);
    assert.equal(result.revision, before.revision);
    assert.equal(result.createdClassIds.length, 1);

    const created = await dataSource.getRepository(ClassGroup).findOneBy({ id: result.createdClassIds[0] });
    assert.equal(created.academicYearId, null);
    const createdRequirements = await requirementService.getRequirementsByClass(created.id);
    assert.equal(createdRequirements.some((entry) => entry.subjectId === subject.data.id), true);
    const existingRequirements = await requirementService.getRequirementsByClass(existing.data.id);
    assert.equal(existingRequirements.find((entry) => entry.subjectId === subject.data.id).requiredPeriodsPerWeek, 1);

    const invalid = await orchestrator.preview({
      revision: result.revision,
      changedGrades: [],
      synchronizeClassIds: [],
      proposedClasses: [
        { name: 'Reviewed 7-A', grade: 7, fixedRoomId: 999999 },
        { name: 'Invalid teacher', grade: 7, classTeacherId: 999999 },
      ],
    });
    assert.equal(invalid.blockers.some((entry) => entry.code === 'CLASS_NAME_CONFLICT'), true);
    assert.equal(invalid.blockers.some((entry) => entry.code === 'INVALID_ROOM'), true);
    assert.equal(invalid.blockers.some((entry) => entry.code === 'INVALID_TEACHER'), true);
  });
});
