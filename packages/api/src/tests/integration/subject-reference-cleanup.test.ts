import axios from 'axios';
import http from 'http';
import { AddressInfo } from 'net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppDataSource } from '../../../ormconfig';
import { createApp } from '../../app';
import { CacheManager } from '../../database/cache/cacheManager';
import { ClassRepository } from '../../database/repositories/class.repository';
import { SubjectRepository } from '../../database/repositories/subject.repository';
import { TeacherClassSubjectAssignmentRepository } from '../../database/repositories/teacherClassSubjectAssignment.repository';
import { TeacherRepository } from '../../database/repositories/teacher.repository';
import { ClassGroup } from '../../entity/ClassGroup';
import { License } from '../../entity/License';
import { Subject } from '../../entity/Subject';
import { Teacher } from '../../entity/Teacher';
import { TeacherClassSubjectAssignment } from '../../entity/TeacherClassSubjectAssignment';
import { ClassService } from '../../services/class.service';
import { SubjectReferenceCleanupService } from '../../services/subjectReferenceCleanup.service';
import { SubjectService } from '../../services/subject.service';
import { TeacherService } from '../../services/teacher.service';

describe('Subject Reference Cleanup Integration', () => {
  let server: http.Server;
  let baseURL: string;

  beforeAll(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }

    AppDataSource.setOptions({
      database: ':memory:',
      synchronize: true,
      logging: false,
      dropSchema: true,
    });
    await AppDataSource.initialize();

    SubjectService.resetInstance();
    ClassService.resetInstance();
    TeacherService.resetInstance();
    SubjectReferenceCleanupService.resetInstance();
    SubjectRepository.resetInstance();
    ClassRepository.resetInstance();
    TeacherRepository.resetInstance();
    TeacherClassSubjectAssignmentRepository.resetInstance();
    CacheManager.getInstance().clear();

    const license = new License();
    license.licenseKey = 'TEST-KEY-SUBJECT-CLEANUP';
    license.schoolName = 'Test School';
    license.contactName = 'Test Admin';
    license.contactPhone = '0700000000';
    license.licenseType = 'annual';
    license.isActive = true;
    license.expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
    license.issuedAt = new Date();
    license.activatedAt = new Date();
    license.gracePeriodDays = 0;
    license.machineId = 'TEST-MACHINE';
    license.signature = 'mock-signature';
    license.features = [];

    await AppDataSource.manager.save(license);

    const app = createApp({
      dataSource: AppDataSource,
      enableCors: false,
    });

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as AddressInfo;
        baseURL = `http://127.0.0.1:${addr.port}/api`;
        resolve();
      });
    });
  });

  beforeEach(async () => {
    await AppDataSource.getRepository(TeacherClassSubjectAssignment).clear();
    await AppDataSource.getRepository(ClassGroup).clear();
    await AppDataSource.getRepository(Teacher).clear();
    await AppDataSource.getRepository(Subject).clear();
    CacheManager.getInstance().clear();
  });

  afterAll(async () => {
    if (server) server.close();
    if (AppDataSource.isInitialized) await AppDataSource.destroy();
  });

  it('repairs existing orphaned subject references on fetch', async () => {
    const subjectRepo = AppDataSource.getRepository(Subject);
    const classRepo = AppDataSource.getRepository(ClassGroup);
    const teacherRepo = AppDataSource.getRepository(Teacher);
    const assignmentRepo = AppDataSource.getRepository(TeacherClassSubjectAssignment);

    const validSubject = await subjectRepo.save(
      subjectRepo.create({
        name: 'Valid Subject',
        code: 'VS',
        grade: 6,
        periodsPerWeek: 4,
        section: 'PRIMARY',
        requiredFeatures: '[]',
        desiredFeatures: '[]',
        meta: '{}',
      })
    );

    const classGroup = await classRepo.save(
      classRepo.create({
        name: 'Class 6A',
        displayName: 'Class 6A',
        grade: 6,
        section: 'PRIMARY',
        subjectRequirements: JSON.stringify([
          { subjectId: validSubject.id, periodsPerWeek: 4, teacherId: null },
          { subjectId: 999, periodsPerWeek: 2, teacherId: null },
        ]),
        meta: '{}',
      })
    );

    const teacher = await teacherRepo.save(
      teacherRepo.create({
        fullName: 'Teacher One',
        primarySubjectIds: JSON.stringify([validSubject.id, 999]),
        allowedSubjectIds: JSON.stringify([999]),
        availability: '{}',
        unavailable: '[]',
        preferredRoomIds: '[]',
        preferredColleagues: '[]',
        classAssignments: JSON.stringify([
          { subjectId: String(validSubject.id), classIds: [String(classGroup.id)] },
          { subjectId: '999', classIds: [String(classGroup.id)] },
        ]),
        meta: '{}',
      })
    );

    await assignmentRepo.save(
      assignmentRepo.create({
        teacherId: teacher.id,
        classId: classGroup.id,
        subjectId: 999,
        periodsPerWeek: 2,
        isFixed: true,
        schoolId: null,
      })
    );

    const classesResponse = await axios.get(`${baseURL}/classes`);
    expect(classesResponse.status).toBe(200);

    const cleanedClass = classesResponse.data.find((item: { id: number }) => item.id === classGroup.id);
    expect(cleanedClass.subjectRequirements).toEqual([
      { subjectId: validSubject.id, periodsPerWeek: 4, teacherId: null },
    ]);

    const teachersResponse = await axios.get(`${baseURL}/teachers`);
    expect(teachersResponse.status).toBe(200);

    const cleanedTeacher = teachersResponse.data.find((item: { id: number }) => item.id === teacher.id);
    expect(cleanedTeacher.primarySubjectIds).toEqual([validSubject.id]);
    expect(cleanedTeacher.allowedSubjectIds).toEqual([]);
    expect(cleanedTeacher.classAssignments).toEqual([
      { subjectId: String(validSubject.id), classIds: [String(classGroup.id)] },
    ]);

    const assignmentsResponse = await axios.get(`${baseURL}/teacher-assignments`);
    expect(assignmentsResponse.status).toBe(200);
    expect(assignmentsResponse.data).toEqual([]);

    const storedClass = await classRepo.findOneByOrFail({ id: classGroup.id });
    expect(JSON.parse(storedClass.subjectRequirements)).toEqual([
      { subjectId: validSubject.id, periodsPerWeek: 4, teacherId: null },
    ]);

    const storedTeacher = await teacherRepo.findOneByOrFail({ id: teacher.id });
    expect(JSON.parse(storedTeacher.primarySubjectIds)).toEqual([validSubject.id]);
    expect(JSON.parse(storedTeacher.allowedSubjectIds)).toEqual([]);
    expect(JSON.parse(storedTeacher.classAssignments)).toEqual([
      { subjectId: String(validSubject.id), classIds: [String(classGroup.id)] },
    ]);

    const storedAssignments = await assignmentRepo.find({ where: { subjectId: 999 } });
    expect(storedAssignments).toHaveLength(1);
    expect(storedAssignments[0].isDeleted).toBe(true);
  });

  it('cascades subject deletion cleanup across classes, teachers, and assignments', async () => {
    const subjectRepo = AppDataSource.getRepository(Subject);
    const classRepo = AppDataSource.getRepository(ClassGroup);
    const teacherRepo = AppDataSource.getRepository(Teacher);
    const assignmentRepo = AppDataSource.getRepository(TeacherClassSubjectAssignment);

    const keptSubject = await subjectRepo.save(
      subjectRepo.create({
        name: 'Kept Subject',
        code: 'KS',
        grade: 6,
        periodsPerWeek: 3,
        section: 'PRIMARY',
        requiredFeatures: '[]',
        desiredFeatures: '[]',
        meta: '{}',
      })
    );
    const deletedSubject = await subjectRepo.save(
      subjectRepo.create({
        name: 'Deleted Subject',
        code: 'DS',
        grade: 6,
        periodsPerWeek: 2,
        section: 'PRIMARY',
        requiredFeatures: '[]',
        desiredFeatures: '[]',
        meta: '{}',
      })
    );

    const classGroup = await classRepo.save(
      classRepo.create({
        name: 'Class 6B',
        displayName: 'Class 6B',
        grade: 6,
        section: 'PRIMARY',
        subjectRequirements: JSON.stringify([
          { subjectId: keptSubject.id, periodsPerWeek: 3, teacherId: null },
          { subjectId: deletedSubject.id, periodsPerWeek: 2, teacherId: 1 },
        ]),
        meta: '{}',
      })
    );

    const teacher = await teacherRepo.save(
      teacherRepo.create({
        fullName: 'Teacher Two',
        primarySubjectIds: JSON.stringify([deletedSubject.id]),
        allowedSubjectIds: JSON.stringify([keptSubject.id, deletedSubject.id]),
        availability: '{}',
        unavailable: '[]',
        preferredRoomIds: '[]',
        preferredColleagues: '[]',
        classAssignments: JSON.stringify([
          { subjectId: String(keptSubject.id), classIds: [String(classGroup.id)] },
          { subjectId: String(deletedSubject.id), classIds: [String(classGroup.id)] },
        ]),
        meta: '{}',
      })
    );

    await assignmentRepo.save(
      assignmentRepo.create({
        teacherId: teacher.id,
        classId: classGroup.id,
        subjectId: deletedSubject.id,
        periodsPerWeek: 2,
        isFixed: true,
        schoolId: null,
      })
    );

    const deleteResponse = await axios.delete(`${baseURL}/subjects/${deletedSubject.id}`);
    expect(deleteResponse.status).toBe(204);

    const classesResponse = await axios.get(`${baseURL}/classes`);
    const cleanedClass = classesResponse.data.find((item: { id: number }) => item.id === classGroup.id);
    expect(cleanedClass.subjectRequirements).toEqual([
      { subjectId: keptSubject.id, periodsPerWeek: 3, teacherId: null },
    ]);

    const teachersResponse = await axios.get(`${baseURL}/teachers`);
    const cleanedTeacher = teachersResponse.data.find((item: { id: number }) => item.id === teacher.id);
    expect(cleanedTeacher.primarySubjectIds).toEqual([]);
    expect(cleanedTeacher.allowedSubjectIds).toEqual([keptSubject.id]);
    expect(cleanedTeacher.classAssignments).toEqual([
      { subjectId: String(keptSubject.id), classIds: [String(classGroup.id)] },
    ]);

    const assignmentsResponse = await axios.get(`${baseURL}/teacher-assignments`);
    expect(assignmentsResponse.data).toEqual([]);
  });

  it('does not treat double-encoded valid teacher subject arrays as deleted references', async () => {
    const subjectRepo = AppDataSource.getRepository(Subject);
    const teacherRepo = AppDataSource.getRepository(Teacher);
    const assignmentRepo = AppDataSource.getRepository(TeacherClassSubjectAssignment);
    const cleanupService = SubjectReferenceCleanupService.getInstance(AppDataSource);

    const english = await subjectRepo.save(
      subjectRepo.create({
        name: 'English',
        code: 'ENG-4',
        grade: 4,
        periodsPerWeek: 2,
        section: 'PRIMARY',
        requiredFeatures: '[]',
        desiredFeatures: '[]',
        meta: '{}',
      })
    );
    const sport = await subjectRepo.save(
      subjectRepo.create({
        name: 'Sport',
        code: 'SPORT-4',
        grade: 4,
        periodsPerWeek: 1,
        section: 'PRIMARY',
        requiredFeatures: '[]',
        desiredFeatures: '[]',
        meta: '{}',
      })
    );

    const teacher = await teacherRepo.save(
      teacherRepo.create({
        fullName: 'Teacher Three',
        primarySubjectIds: JSON.stringify(JSON.stringify([english.id, sport.id])),
        allowedSubjectIds: JSON.stringify(JSON.stringify([])),
        availability: '{}',
        unavailable: '[]',
        preferredRoomIds: '[]',
        preferredColleagues: '[]',
        classAssignments: JSON.stringify([]),
        meta: '{}',
      })
    );

    const assignment = await assignmentRepo.save(
      assignmentRepo.create({
        teacherId: teacher.id,
        classId: 1,
        subjectId: english.id,
        periodsPerWeek: 2,
        isFixed: true,
        schoolId: null,
      })
    );

    const result = await cleanupService.cleanupDeletedSubjectReferences();
    expect(result.targetSubjectIds).toEqual([]);
    expect(result.deletedTeacherAssignments).toBe(0);

    const storedAssignment = await assignmentRepo.findOneByOrFail({ id: assignment.id });
    expect(storedAssignment.isDeleted).toBe(false);

    const parsedTeacher = await TeacherRepository.getInstance(AppDataSource).getTeacher(teacher.id, {
      skipCache: true,
    });
    expect(parsedTeacher?.primarySubjectIds).toEqual([english.id, sport.id]);
    expect(parsedTeacher?.allowedSubjectIds).toEqual([]);
  });
});
