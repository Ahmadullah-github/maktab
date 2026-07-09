import { DataSource, EntityManager } from 'typeorm';
import { CacheManager } from '../database/cache/cacheManager';
import { TeacherSubjectCapability } from '../entity/TeacherSubjectCapability';
import { SubjectRepository } from '../database/repositories/subject.repository';
import { TeacherRepository } from '../database/repositories/teacher.repository';
import { TeacherSubjectCapabilityRepository } from '../database/repositories/teacherSubjectCapability.repository';
import { AssignmentMirrorSyncService } from './assignmentMirrorSync.service';

interface CapabilityWriteOptions {
  manager?: EntityManager;
}

export interface TeacherCapabilitySyncInput {
  primarySubjectIds?: number[];
  allowedSubjectIds?: number[];
}

export class TeacherCapabilityService {
  private static instance: TeacherCapabilityService | null = null;

  private readonly teacherRepository: TeacherRepository;
  private readonly subjectRepository: SubjectRepository;
  private readonly capabilityRepository: TeacherSubjectCapabilityRepository;
  private readonly mirrorSyncService: AssignmentMirrorSyncService;

  private constructor(
    private readonly dataSource: DataSource,
    cacheManager?: CacheManager
  ) {
    const cache = cacheManager ?? CacheManager.getInstance();
    this.teacherRepository = TeacherRepository.getInstance(dataSource, cache);
    this.subjectRepository = SubjectRepository.getInstance(dataSource, cache);
    this.capabilityRepository = TeacherSubjectCapabilityRepository.getInstance(dataSource, cache);
    this.mirrorSyncService = AssignmentMirrorSyncService.getInstance(dataSource, cache);
  }

  static getInstance(
    dataSource: DataSource,
    cacheManager?: CacheManager
  ): TeacherCapabilityService {
    if (!TeacherCapabilityService.instance) {
      TeacherCapabilityService.instance = new TeacherCapabilityService(dataSource, cacheManager);
    }

    return TeacherCapabilityService.instance;
  }

  static resetInstance(): void {
    TeacherCapabilityService.instance = null;
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
      await this.assertTeacherIsActive(teacherId, manager);

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
        hasPrimary ? input.primarySubjectIds ?? [] : currentPrimary
      );
      const allowedSubjectIds = normalizeIds(
        hasAllowed ? input.allowedSubjectIds ?? [] : currentAllowed
      ).filter((subjectId) => !primarySubjectIds.includes(subjectId));

      await this.assertSubjectsAreActive([...primarySubjectIds, ...allowedSubjectIds], manager);

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

    await this.dataSource.transaction(operation);
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

    await this.dataSource.transaction(operation);
  }

  private async assertTeacherAndSubjectAreActive(
    teacherId: number,
    subjectId: number,
    manager?: EntityManager
  ): Promise<void> {
    await this.assertTeacherIsActive(teacherId, manager);
    await this.assertSubjectsAreActive([subjectId], manager);
  }

  private async assertTeacherIsActive(teacherId: number, manager?: EntityManager): Promise<void> {
    const teacher = await this.teacherRepository.getTeacher(teacherId, {
      manager,
      skipCache: true,
    });

    if (!teacher || teacher.isDeleted) {
      throw new Error(`Teacher with ID ${teacherId} not found`);
    }
  }

  private async assertSubjectsAreActive(
    subjectIds: number[],
    manager?: EntityManager
  ): Promise<void> {
    for (const subjectId of normalizeIds(subjectIds)) {
      const subject = await this.subjectRepository.getSubject(subjectId, {
        manager,
        skipCache: true,
      });
      if (!subject || subject.isDeleted) {
        throw new Error(`Subject with ID ${subjectId} not found`);
      }
    }
  }
}

function normalizeIds(ids: number[]): number[] {
  return [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))].sort(
    (left, right) => left - right
  );
}
