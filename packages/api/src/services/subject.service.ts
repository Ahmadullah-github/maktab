/**
 * Subject Service for business logic operations
 * @module services/subject
 * 
 * Requirements: 3.2
 * - Route handler SHALL delegate business logic to SubjectService class
 */

import { DataSource } from 'typeorm';
import { SubjectRepository, SubjectInput, ParsedSubject } from '../database/repositories/subject.repository';
import { CacheManager } from '../database/cache/cacheManager';
import { PaginationParams, PaginatedResponse, ServiceResult } from '../types/common.types';
import { SubjectReferenceCleanupService } from './subjectReferenceCleanup.service';
import { logger } from '../utils/logger';

/**
 * SubjectService handles all business logic for Subject operations
 */
export class SubjectService {
  private static instance: SubjectService | null = null;
  private dataSource: DataSource;
  private subjectRepository: SubjectRepository;
  private subjectReferenceCleanupService: SubjectReferenceCleanupService;

  private constructor(dataSource: DataSource, cacheManager?: CacheManager) {
    this.dataSource = dataSource;
    this.subjectRepository = SubjectRepository.getInstance(dataSource, cacheManager);
    this.subjectReferenceCleanupService = SubjectReferenceCleanupService.getInstance(
      dataSource,
      cacheManager
    );
  }

  static getInstance(dataSource: DataSource, cacheManager?: CacheManager): SubjectService {
    if (!SubjectService.instance) {
      SubjectService.instance = new SubjectService(dataSource, cacheManager);
    }
    return SubjectService.instance;
  }

  static resetInstance(): void {
    SubjectService.instance = null;
  }

  async create(input: SubjectInput): Promise<ServiceResult<ParsedSubject>> {
    try {
      if (!input.name || input.name.trim() === '') {
        return { success: false, error: 'Subject name is required' };
      }

      const grade = typeof input.grade === 'number' ? input.grade : null;
      const existing = await this.subjectRepository.findByGradeAndName(grade, input.name);
      if (existing) {
        return { success: false, error: `Subject "${input.name}" already exists for grade ${grade ?? 'unspecified'}` };
      }

      const subject = await this.subjectRepository.saveSubject(input);
      logger.info('SubjectService: Created subject', { id: subject.id, name: subject.name });
      return { success: true, data: subject };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('SubjectService: Failed to create subject', error);
      return { success: false, error: error.message };
    }
  }

  async update(id: number, input: Partial<SubjectInput>): Promise<ServiceResult<ParsedSubject>> {
    try {
      if (input.name !== undefined && input.name.trim() === '') {
        return { success: false, error: 'Subject name cannot be empty' };
      }

      const existing = await this.subjectRepository.getSubject(id);
      if (!existing) {
        return { success: false, error: `Subject with ID ${id} not found` };
      }

      if (input.name || input.grade !== undefined) {
        const newName = input.name ?? existing.name;
        const newGrade = input.grade !== undefined ? input.grade : existing.grade;
        const duplicate = await this.subjectRepository.findByGradeAndName(newGrade, newName);
        if (duplicate && duplicate.id !== id) {
          return { success: false, error: `Subject "${newName}" already exists for grade ${newGrade ?? 'unspecified'}` };
        }
      }

      const subject = await this.subjectRepository.updateSubject(id, input);
      if (!subject) {
        return { success: false, error: `Failed to update subject with ID ${id}` };
      }

      logger.info('SubjectService: Updated subject', { id });
      return { success: true, data: subject };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('SubjectService: Failed to update subject', error, { id });
      return { success: false, error: error.message };
    }
  }

  async delete(id: number): Promise<ServiceResult<boolean>> {
    try {
      const existing = await this.subjectRepository.getSubject(id);
      if (!existing) {
        return { success: false, error: `Subject with ID ${id} not found` };
      }

      await this.dataSource.transaction(async (manager) => {
        const deleted = await this.subjectRepository.deleteSubject(id, {
          manager,
          skipCache: true,
        });
        if (!deleted) {
          throw new Error(`Failed to delete subject with ID ${id}`);
        }

        await this.subjectReferenceCleanupService.cleanupDeletedSubjectReferences([id], manager);
      });

      logger.info('SubjectService: Deleted subject', { id });
      return { success: true, data: true };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('SubjectService: Failed to delete subject', error, { id });
      return { success: false, error: error.message };
    }
  }

  async findById(id: number): Promise<ServiceResult<ParsedSubject>> {
    try {
      const subject = await this.subjectRepository.getSubject(id);
      if (!subject) {
        return { success: false, error: `Subject with ID ${id} not found` };
      }
      return { success: true, data: subject };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('SubjectService: Failed to find subject', error, { id });
      return { success: false, error: error.message };
    }
  }

  async findAll(pagination?: PaginationParams): Promise<ServiceResult<PaginatedResponse<ParsedSubject>>> {
    try {
      await this.subjectReferenceCleanupService.cleanupDeletedSubjectReferences();
      const result = await this.subjectRepository.getAllSubjects(pagination);
      return { success: true, data: result };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('SubjectService: Failed to find all subjects', error);
      return { success: false, error: error.message };
    }
  }

  async findAllUnpaginated(): Promise<ServiceResult<ParsedSubject[]>> {
    try {
      await this.subjectReferenceCleanupService.cleanupDeletedSubjectReferences();
      const subjects = await this.subjectRepository.getAllSubjectsUnpaginated();
      return { success: true, data: subjects };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('SubjectService: Failed to find all subjects', error);
      return { success: false, error: error.message };
    }
  }

  async bulkUpsert(subjectsData: SubjectInput[]): Promise<ServiceResult<ParsedSubject[]>> {
    try {
      const invalidSubjects = subjectsData.filter(s => !s.name || s.name.trim() === '');
      if (invalidSubjects.length > 0) {
        return { success: false, error: `${invalidSubjects.length} subject(s) have empty names` };
      }

      const subjects = await this.subjectRepository.bulkUpsert(subjectsData);
      logger.info('SubjectService: Bulk upserted subjects', { count: subjects.length });
      return { success: true, data: subjects };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('SubjectService: Failed to bulk upsert subjects', error);
      return { success: false, error: error.message };
    }
  }

  async bulkDelete(ids: number[]): Promise<ServiceResult<number>> {
    try {
      if (ids.length === 0) {
        return { success: true, data: 0 };
      }

      const deleted = await this.dataSource.transaction(async (manager) => {
        const deletedCount = await this.subjectRepository.bulkDeleteSubjects(ids, {
          manager,
          skipCache: true,
        });
        await this.subjectReferenceCleanupService.cleanupDeletedSubjectReferences(ids, manager);
        return deletedCount;
      });

      logger.info('SubjectService: Bulk deleted subjects', { count: deleted });
      return { success: true, data: deleted };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('SubjectService: Failed to bulk delete subjects', error);
      return { success: false, error: error.message };
    }
  }

  async findByGrade(grade: number): Promise<ServiceResult<ParsedSubject[]>> {
    try {
      const subjects = await this.subjectRepository.findByGrade(grade);
      return { success: true, data: subjects };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('SubjectService: Failed to find subjects by grade', error, { grade });
      return { success: false, error: error.message };
    }
  }

  async findBySection(section: string): Promise<ServiceResult<ParsedSubject[]>> {
    try {
      const subjects = await this.subjectRepository.findBySection(section);
      return { success: true, data: subjects };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('SubjectService: Failed to find subjects by section', error, { section });
      return { success: false, error: error.message };
    }
  }

  async count(): Promise<ServiceResult<number>> {
    try {
      const count = await this.subjectRepository.countSubjects();
      return { success: true, data: count };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('SubjectService: Failed to count subjects', error);
      return { success: false, error: error.message };
    }
  }
}
