import { DataSource, EntityManager } from 'typeorm';
import { CacheManager } from '../database/cache/cacheManager';
import { runCommittedTransaction } from '../database/transaction';
import { TeacherSubjectCapability } from '../entity/TeacherSubjectCapability';
import { SubjectRepository } from '../database/repositories/subject.repository';
import { TeacherRepository } from '../database/repositories/teacher.repository';
import { TeacherSubjectCapabilityRepository } from '../database/repositories/teacherSubjectCapability.repository';
import { AssignmentMirrorSyncService } from './assignmentMirrorSync.service';
import {
  clearDataSourceScopedInstances,
  getDataSourceScopedInstance,
} from '../utils/dataSourceScope';

interface CapabilityWriteOptions {
  manager?: EntityManager;
}

export interface TeacherCapabilitySyncInput {
  primarySubjectIds?: number[];
  allowedSubjectIds?: number[];
}

export class TeacherCapabilityService {
  private readonly teacherRepository: TeacherRepository;
  private readonly subjectRepository: SubjectRepository;
  private readonly capabilityRepository: TeacherSubjectCapabilityRepository;
  private readonly mirrorSyncService: AssignmentMirrorSyncService;
  private readonly cacheManager: CacheManager;

  private constructor(
    private readonly dataSource: DataSource,
    cacheManager?: CacheManager
  ) {
    const cache = cacheManager ?? CacheManager.getInstance();
    this.cacheManager = cache;
    this.teacherRepository = TeacherRepository.getInstance(dataSource, cache);
    this.subjectRepository = SubjectRepository.getInstance(dataSource, cache);
    this.capabilityRepository = TeacherSubjectCapabilityRepository.getInstance(dataSource, cache);
    this.mirrorSyncService = AssignmentMirrorSyncService.getInstance(dataSource, cache);
  }

  static getInstance(
    dataSource: DataSource,
    cacheManager?: CacheManager
  ): TeacherCapabilityService {
    return getDataSourceScopedInstance(
      dataSource,
      TeacherCapabilityService,
      () => new TeacherCapabilityService(dataSource, cacheManager)
    );
  }

  static resetInstance(): void {
    clearDataSourceScopedInstances(TeacherCapabilityService);
  }

  async getCapabilityLevel(
    teacherId: number,
    subjectId: number,
    options?: CapabilityWriteOptions
  ): Promise<'primary' | 'allowed' | null> {
    const capabilities = await this.capabilityRepository.getActiveByTeacher(teacherId, {
      manager: options?.manager,
      skipCache: true,
    });

    const capability = capabilities.find((row) => row.subjectId === subjectId);
    return capability?.capabilityLevel ?? null;
  }

  async getCapabilities(
    teacherId: number,
    options?: CapabilityWriteOptions
  ): Promise<TeacherSubjectCapability[]> {
    return this.capabilityRepository.getActiveByTeacher(teacherId, {
      manager: options?.manager,
      skipCache: true,
    });
  }

  async ensureCapability(
    teacherId: number,
    subjectId: number,
    capabilityLevel: 'primary' | 'allowed' = 'allowed',
    options?: CapabilityWriteOptions
  ): Promise<void> {
    const existingLevel = await this.getCapabilityLevel(teacherId, subjectId, options);
    if (existingLevel !== null) {
      return;
    }

    await this.assertTeacherAndSubjectAreActive(teacherId, subjectId, options?.manager);
    await this.capabilityRepository.upsertCapability(
      {
        teacherId,
        subjectId,
        capabilityLevel,
      },
      { manager: options?.manager, skipCache: true }
    );

    await this.mirrorSyncService.syncTeacherCapabilityMirror(teacherId, {
      manager: options?.manager,
    });
  }

  async syncTeacherCapabilities(
    teacherId: number,
    input: TeacherCapabilitySyncInput,
    options?: CapabilityWriteOptions
  ): Promise<void> {
    const operation = async (manager: EntityManager) => {
      const teacher = await this.assertTeacherIsActive(teacherId, manager);

      const hasPrimary = Object.prototype.hasOwnProperty.call(input, 'primarySubjectIds');
      const hasAllowed = Object.prototype.hasOwnProperty.call(input, 'allowedSubjectIds');

      if (!hasPrimary && !hasAllowed) {
        return;
      }

      const currentCapabilities = await this.capabilityRepository.getActiveByTeacher(teacherId, {
        manager,
        skipCache: true,
      });
      const currentPrimary = currentCapabilities
        .filter((capability) => capability.capabilityLevel === 'primary')
        .map((capability) => capability.subjectId);
      const currentAllowed = currentCapabilities
        .filter((capability) => capability.capabilityLevel === 'allowed')
        .map((capability) => capability.subjectId);

      const primarySubjectIds = normalizeIds(
        hasPrimary ? (input.primarySubjectIds ?? []) : currentPrimary
      );
      const allowedSubjectIds = normalizeIds(
        hasAllowed ? (input.allowedSubjectIds ?? []) : currentAllowed
      ).filter((subjectId) => !primarySubjectIds.includes(subjectId));

      const subjects = await this.assertSubjectsAreActive(
        [...primarySubjectIds, ...allowedSubjectIds],
        manager
      );
      assertMatchingSchoolScope([
        { label: 'teacher', id: teacher.id, schoolId: teacher.schoolId },
        ...subjects.map((subject) => ({
          label: 'subject',
          id: subject.id,
          schoolId: subject.schoolId,
        })),
      ]);

      const desiredCapabilityBySubject = new Map<number, 'primary' | 'allowed'>();
      for (const subjectId of primarySubjectIds) {
        desiredCapabilityBySubject.set(subjectId, 'primary');
      }
      for (const subjectId of allowedSubjectIds) {
        if (!desiredCapabilityBySubject.has(subjectId)) {
          desiredCapabilityBySubject.set(subjectId, 'allowed');
        }
      }

      const repo = manager.getRepository(TeacherSubjectCapability);
      for (const capability of currentCapabilities) {
        const desiredLevel = desiredCapabilityBySubject.get(capability.subjectId);
        if (!desiredLevel) {
          capability.isDeleted = true;
          capability.deletedAt = new Date();
          capability.updatedAt = new Date();
          await repo.save(capability);
        }
      }

      for (const [subjectId, capabilityLevel] of desiredCapabilityBySubject.entries()) {
        await this.capabilityRepository.upsertCapability(
          {
            teacherId,
            subjectId,
            capabilityLevel,
          },
          { manager, skipCache: true }
        );
      }

      await this.mirrorSyncService.syncTeacherCapabilityMirror(teacherId, { manager });
    };

    if (options?.manager) {
      await operation(options.manager);
      return;
    }

    await runCommittedTransaction(this.dataSource, this.cacheManager, operation);
  }

  async clearTeacherCapabilities(
    teacherId: number,
    options?: CapabilityWriteOptions
  ): Promise<void> {
    const operation = async (manager: EntityManager) => {
      const repo = manager.getRepository(TeacherSubjectCapability);
      const capabilities = await repo.find({
        where: { teacherId, isDeleted: false },
      });

      for (const capability of capabilities) {
        capability.isDeleted = true;
        capability.deletedAt = new Date();
        capability.updatedAt = new Date();
        await repo.save(capability);
      }

      await this.mirrorSyncService.syncTeacherCapabilityMirror(teacherId, { manager });
    };

    if (options?.manager) {
      await operation(options.manager);
      return;
    }

    await runCommittedTransaction(this.dataSource, this.cacheManager, operation);
  }

  private async assertTeacherAndSubjectAreActive(
    teacherId: number,
    subjectId: number,
    manager?: EntityManager
  ): Promise<void> {
    const teacher = await this.assertTeacherIsActive(teacherId, manager);
    const [subject] = await this.assertSubjectsAreActive([subjectId], manager);
    assertMatchingSchoolScope([
      { label: 'teacher', id: teacher.id, schoolId: teacher.schoolId },
      { label: 'subject', id: subject.id, schoolId: subject.schoolId },
    ]);
  }

  private async assertTeacherIsActive(teacherId: number, manager?: EntityManager) {
    const teacher = await this.teacherRepository.getTeacher(teacherId, {
      manager,
      skipCache: true,
    });

    if (!teacher || teacher.isDeleted) {
      throw new Error(`Teacher with ID ${teacherId} not found`);
    }
    return teacher;
  }

  private async assertSubjectsAreActive(
    subjectIds: number[],
    manager?: EntityManager
  ) {
    const subjects: Array<{ id: number; schoolId: number | null }> = [];
    for (const subjectId of normalizeIds(subjectIds)) {
      const subject = await this.subjectRepository.getSubject(subjectId, {
        manager,
        skipCache: true,
      });
      if (!subject || subject.isDeleted) {
        throw new Error(`Subject with ID ${subjectId} not found`);
      }
      subjects.push(subject);
    }
    return subjects;
  }
}

function assertMatchingSchoolScope(
  rows: Array<{ label: string; id: number; schoolId: number | null }>
): void {
  if (rows.length < 2) return;
  const expected = rows[0].schoolId;
  const conflict = rows.find((row) => row.schoolId !== expected);
  if (conflict) {
    throw new Error(
      `School scope conflict: ${rows[0].label} ${rows[0].id} and ${conflict.label} ${conflict.id} do not belong to the same school`
    );
  }
}

function normalizeIds(ids: number[]): number[] {
  return [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))].sort(
    (left, right) => left - right
  );
}
