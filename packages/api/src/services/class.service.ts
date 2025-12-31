/**
 * Class Service for business logic operations
 * @module services/class
 * 
 * Requirements: 3.2
 * - Route handler SHALL delegate business logic to ClassService class
 */

import { DataSource } from 'typeorm';
import { ClassRepository, ClassInput, ParsedClass } from '../database/repositories/class.repository';
import { RoomRepository } from '../database/repositories/room.repository';
import { CacheManager } from '../database/cache/cacheManager';
import { PaginationParams, PaginatedResponse, ServiceResult } from '../types/common.types';
import { logger } from '../utils/logger';

/**
 * ClassService handles all business logic for ClassGroup operations
 */
export class ClassService {
  private static instance: ClassService | null = null;
  private classRepository: ClassRepository;
  private roomRepository: RoomRepository;

  private constructor(dataSource: DataSource, cacheManager?: CacheManager) {
    this.classRepository = ClassRepository.getInstance(dataSource, cacheManager);
    this.roomRepository = RoomRepository.getInstance(dataSource, cacheManager);
  }

  static getInstance(dataSource: DataSource, cacheManager?: CacheManager): ClassService {
    if (!ClassService.instance) {
      ClassService.instance = new ClassService(dataSource, cacheManager);
    }
    return ClassService.instance;
  }

  static resetInstance(): void {
    ClassService.instance = null;
  }

  private async validateFixedRoomId(fixedRoomId: number | null | undefined): Promise<string | null> {
    if (fixedRoomId === null || fixedRoomId === undefined) {
      return null;
    }
    const room = await this.roomRepository.getRoom(fixedRoomId);
    if (!room) {
      return `Room with ID ${fixedRoomId} not found`;
    }
    return null;
  }

  async create(input: ClassInput): Promise<ServiceResult<ParsedClass>> {
    try {
      if (!input.name || input.name.trim() === '') {
        return { success: false, error: 'Class name is required' };
      }

      const existing = await this.classRepository.findByName(input.name);
      if (existing) {
        return { success: false, error: `Class with name "${input.name}" already exists` };
      }

      const roomError = await this.validateFixedRoomId(input.fixedRoomId);
      if (roomError) {
        return { success: false, error: roomError };
      }

      if (input.studentCount !== undefined && input.studentCount < 0) {
        return { success: false, error: 'Student count cannot be negative' };
      }

      if (input.grade !== undefined && input.grade !== null) {
        if (input.grade < 1 || input.grade > 12) {
          return { success: false, error: 'Grade must be between 1 and 12' };
        }
      }

      const classGroup = await this.classRepository.saveClass(input);
      logger.info('ClassService: Created class', { id: classGroup.id, name: classGroup.name });
      return { success: true, data: classGroup };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('ClassService: Failed to create class', error, { input: JSON.stringify(input) });
      return { success: false, error: error.message };
    }
  }

  async update(id: number, input: Partial<ClassInput>): Promise<ServiceResult<ParsedClass>> {
    try {
      if (input.name !== undefined && input.name.trim() === '') {
        return { success: false, error: 'Class name cannot be empty' };
      }

      const existing = await this.classRepository.getClass(id);
      if (!existing) {
        return { success: false, error: `Class with ID ${id} not found` };
      }

      if (input.name && input.name !== existing.name) {
        const duplicate = await this.classRepository.findByName(input.name);
        if (duplicate && duplicate.id !== id) {
          return { success: false, error: `Class with name "${input.name}" already exists` };
        }
      }

      if (input.fixedRoomId !== undefined) {
        const roomError = await this.validateFixedRoomId(input.fixedRoomId);
        if (roomError) {
          return { success: false, error: roomError };
        }
      }

      if (input.studentCount !== undefined && input.studentCount < 0) {
        return { success: false, error: 'Student count cannot be negative' };
      }

      if (input.grade !== undefined && input.grade !== null) {
        if (input.grade < 1 || input.grade > 12) {
          return { success: false, error: 'Grade must be between 1 and 12' };
        }
      }

      const classGroup = await this.classRepository.updateClass(id, input);
      if (!classGroup) {
        return { success: false, error: `Failed to update class with ID ${id}` };
      }

      logger.info('ClassService: Updated class', { id });
      return { success: true, data: classGroup };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('ClassService: Failed to update class', error, { id });
      return { success: false, error: error.message };
    }
  }

  async delete(id: number): Promise<ServiceResult<boolean>> {
    try {
      const existing = await this.classRepository.getClass(id);
      if (!existing) {
        return { success: false, error: `Class with ID ${id} not found` };
      }

      const deleted = await this.classRepository.deleteClass(id);
      if (!deleted) {
        return { success: false, error: `Failed to delete class with ID ${id}` };
      }

      logger.info('ClassService: Deleted class', { id });
      return { success: true, data: true };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('ClassService: Failed to delete class', error, { id });
      return { success: false, error: error.message };
    }
  }

  async findById(id: number): Promise<ServiceResult<ParsedClass>> {
    try {
      const classGroup = await this.classRepository.getClass(id);
      if (!classGroup) {
        return { success: false, error: `Class with ID ${id} not found` };
      }
      return { success: true, data: classGroup };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('ClassService: Failed to find class', error, { id });
      return { success: false, error: error.message };
    }
  }

  async findAll(pagination?: PaginationParams): Promise<ServiceResult<PaginatedResponse<ParsedClass>>> {
    try {
      const result = await this.classRepository.getAllClasses(pagination);
      return { success: true, data: result };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('ClassService: Failed to find all classes', error);
      return { success: false, error: error.message };
    }
  }

  async findAllUnpaginated(): Promise<ServiceResult<ParsedClass[]>> {
    try {
      const classes = await this.classRepository.getAllClassesUnpaginated();
      return { success: true, data: classes };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('ClassService: Failed to find all classes', error);
      return { success: false, error: error.message };
    }
  }

  async bulkImport(classesData: ClassInput[]): Promise<ServiceResult<ParsedClass[]>> {
    try {
      const invalidClasses = classesData.filter(c => !c.name || c.name.trim() === '');
      if (invalidClasses.length > 0) {
        return { success: false, error: `${invalidClasses.length} class(es) have empty names` };
      }

      for (const classData of classesData) {
        if (classData.fixedRoomId) {
          const roomError = await this.validateFixedRoomId(classData.fixedRoomId);
          if (roomError) {
            return { success: false, error: `Class "${classData.name}": ${roomError}` };
          }
        }
      }

      const classes = await this.classRepository.bulkImport(classesData);
      logger.info('ClassService: Bulk imported classes', { count: classes.length });
      return { success: true, data: classes };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('ClassService: Failed to bulk import classes', error);
      return { success: false, error: error.message };
    }
  }

  async bulkUpsert(classesData: ClassInput[]): Promise<ServiceResult<ParsedClass[]>> {
    try {
      const invalidClasses = classesData.filter(c => !c.name || c.name.trim() === '');
      if (invalidClasses.length > 0) {
        return { success: false, error: `${invalidClasses.length} class(es) have empty names` };
      }

      for (const classData of classesData) {
        if (classData.fixedRoomId) {
          const roomError = await this.validateFixedRoomId(classData.fixedRoomId);
          if (roomError) {
            return { success: false, error: `Class "${classData.name}": ${roomError}` };
          }
        }
      }

      const classes = await this.classRepository.bulkUpsert(classesData);
      logger.info('ClassService: Bulk upserted classes', { count: classes.length });
      return { success: true, data: classes };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('ClassService: Failed to bulk upsert classes', error);
      return { success: false, error: error.message };
    }
  }

  async bulkDelete(ids: number[]): Promise<ServiceResult<number>> {
    try {
      if (ids.length === 0) {
        return { success: true, data: 0 };
      }
      const deleted = await this.classRepository.bulkDeleteClasses(ids);
      logger.info('ClassService: Bulk deleted classes', { count: deleted });
      return { success: true, data: deleted };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('ClassService: Failed to bulk delete classes', error);
      return { success: false, error: error.message };
    }
  }

  async findByName(name: string): Promise<ServiceResult<ParsedClass | null>> {
    try {
      const classGroup = await this.classRepository.findByName(name);
      return { success: true, data: classGroup };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('ClassService: Failed to find class by name', error, { name });
      return { success: false, error: error.message };
    }
  }

  async findByFixedRoomId(fixedRoomId: number): Promise<ServiceResult<ParsedClass[]>> {
    try {
      const classes = await this.classRepository.findByFixedRoomId(fixedRoomId);
      return { success: true, data: classes };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('ClassService: Failed to find classes by room', error, { fixedRoomId });
      return { success: false, error: error.message };
    }
  }

  async findByGrade(grade: number): Promise<ServiceResult<ParsedClass[]>> {
    try {
      const classes = await this.classRepository.findByGrade(grade);
      return { success: true, data: classes };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('ClassService: Failed to find classes by grade', error, { grade });
      return { success: false, error: error.message };
    }
  }

  async findBySection(section: string): Promise<ServiceResult<ParsedClass[]>> {
    try {
      const classes = await this.classRepository.findBySection(section);
      return { success: true, data: classes };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('ClassService: Failed to find classes by section', error, { section });
      return { success: false, error: error.message };
    }
  }

  async findSingleTeacherModeClasses(): Promise<ServiceResult<ParsedClass[]>> {
    try {
      const classes = await this.classRepository.findSingleTeacherModeClasses();
      return { success: true, data: classes };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('ClassService: Failed to find single teacher mode classes', error);
      return { success: false, error: error.message };
    }
  }

  async count(): Promise<ServiceResult<number>> {
    try {
      const count = await this.classRepository.countClasses();
      return { success: true, data: count };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('ClassService: Failed to count classes', error);
      return { success: false, error: error.message };
    }
  }
}
