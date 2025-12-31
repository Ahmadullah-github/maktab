/**
 * Teacher Service for business logic operations
 * @module services/teacher
 * 
 * Requirements: 3.1
 * - Route handler SHALL delegate business logic to TeacherService class
 */

import { DataSource } from 'typeorm';
import { TeacherRepository, TeacherInput, ParsedTeacher } from '../database/repositories/teacher.repository';
import { CacheManager } from '../database/cache/cacheManager';
import { PaginationParams, PaginatedResponse, ServiceResult } from '../types/common.types';
import { logger } from '../utils/logger';

/**
 * TeacherService handles all business logic for Teacher operations
 */
export class TeacherService {
  private static instance: TeacherService | null = null;
  private teacherRepository: TeacherRepository;

  private constructor(dataSource: DataSource, cacheManager?: CacheManager) {
    this.teacherRepository = TeacherRepository.getInstance(dataSource, cacheManager);
  }

  static getInstance(dataSource: DataSource, cacheManager?: CacheManager): TeacherService {
    if (!TeacherService.instance) {
      TeacherService.instance = new TeacherService(dataSource, cacheManager);
    }
    return TeacherService.instance;
  }

  static resetInstance(): void {
    TeacherService.instance = null;
  }

  async create(input: TeacherInput): Promise<ServiceResult<ParsedTeacher>> {
    try {
      if (!input.fullName || input.fullName.trim() === '') {
        return { success: false, error: 'Teacher name is required' };
      }

      const existing = await this.teacherRepository.findByName(input.fullName);
      if (existing) {
        return { success: false, error: `Teacher with name "${input.fullName}" already exists` };
      }

      const teacher = await this.teacherRepository.saveTeacher(input);
      logger.info('TeacherService: Created teacher', { id: teacher.id, name: teacher.fullName });
      return { success: true, data: teacher };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('TeacherService: Failed to create teacher', error);
      return { success: false, error: error.message };
    }
  }

  async update(id: number, input: Partial<TeacherInput>): Promise<ServiceResult<ParsedTeacher>> {
    try {
      if (input.fullName !== undefined && input.fullName.trim() === '') {
        return { success: false, error: 'Teacher name cannot be empty' };
      }

      const existing = await this.teacherRepository.getTeacher(id);
      if (!existing) {
        return { success: false, error: `Teacher with ID ${id} not found` };
      }

      if (input.fullName && input.fullName !== existing.fullName) {
        const duplicate = await this.teacherRepository.findByName(input.fullName);
        if (duplicate && duplicate.id !== id) {
          return { success: false, error: `Teacher with name "${input.fullName}" already exists` };
        }
      }

      const teacher = await this.teacherRepository.updateTeacher(id, input);
      if (!teacher) {
        return { success: false, error: `Failed to update teacher with ID ${id}` };
      }

      logger.info('TeacherService: Updated teacher', { id });
      return { success: true, data: teacher };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('TeacherService: Failed to update teacher', error, { id });
      return { success: false, error: error.message };
    }
  }

  async delete(id: number): Promise<ServiceResult<boolean>> {
    try {
      const existing = await this.teacherRepository.getTeacher(id);
      if (!existing) {
        return { success: false, error: `Teacher with ID ${id} not found` };
      }

      const deleted = await this.teacherRepository.deleteTeacher(id);
      if (!deleted) {
        return { success: false, error: `Failed to delete teacher with ID ${id}` };
      }

      logger.info('TeacherService: Deleted teacher', { id });
      return { success: true, data: true };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('TeacherService: Failed to delete teacher', error, { id });
      return { success: false, error: error.message };
    }
  }

  async findById(id: number): Promise<ServiceResult<ParsedTeacher>> {
    try {
      const teacher = await this.teacherRepository.getTeacher(id);
      if (!teacher) {
        return { success: false, error: `Teacher with ID ${id} not found` };
      }
      return { success: true, data: teacher };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('TeacherService: Failed to find teacher', error, { id });
      return { success: false, error: error.message };
    }
  }

  async findAll(pagination?: PaginationParams): Promise<ServiceResult<PaginatedResponse<ParsedTeacher>>> {
    try {
      const result = await this.teacherRepository.getAllTeachers(pagination);
      return { success: true, data: result };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('TeacherService: Failed to find all teachers', error);
      return { success: false, error: error.message };
    }
  }

  async findAllUnpaginated(): Promise<ServiceResult<ParsedTeacher[]>> {
    try {
      const teachers = await this.teacherRepository.getAllTeachersUnpaginated();
      return { success: true, data: teachers };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('TeacherService: Failed to find all teachers', error);
      return { success: false, error: error.message };
    }
  }

  async bulkImport(teachersData: TeacherInput[]): Promise<ServiceResult<ParsedTeacher[]>> {
    try {
      const invalidTeachers = teachersData.filter(t => !t.fullName || t.fullName.trim() === '');
      if (invalidTeachers.length > 0) {
        return { success: false, error: `${invalidTeachers.length} teacher(s) have empty names` };
      }

      const teachers = await this.teacherRepository.bulkImport(teachersData);
      logger.info('TeacherService: Bulk imported teachers', { count: teachers.length });
      return { success: true, data: teachers };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('TeacherService: Failed to bulk import teachers', error);
      return { success: false, error: error.message };
    }
  }

  async bulkDelete(ids: number[]): Promise<ServiceResult<number>> {
    try {
      if (ids.length === 0) {
        return { success: true, data: 0 };
      }
      const deleted = await this.teacherRepository.bulkDeleteTeachers(ids);
      logger.info('TeacherService: Bulk deleted teachers', { count: deleted });
      return { success: true, data: deleted };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('TeacherService: Failed to bulk delete teachers', error);
      return { success: false, error: error.message };
    }
  }

  async findByName(fullName: string): Promise<ServiceResult<ParsedTeacher | null>> {
    try {
      const teacher = await this.teacherRepository.findByName(fullName);
      return { success: true, data: teacher };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('TeacherService: Failed to find teacher by name', error, { fullName });
      return { success: false, error: error.message };
    }
  }

  async count(): Promise<ServiceResult<number>> {
    try {
      const count = await this.teacherRepository.countTeachers();
      return { success: true, data: count };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('TeacherService: Failed to count teachers', error);
      return { success: false, error: error.message };
    }
  }
}
