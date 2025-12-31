/**
 * Timetable Service for business logic operations
 * @module services/timetable
 * 
 * Requirements: 3.2
 * - Route handler SHALL delegate business logic to TimetableService class
 */

import { DataSource } from 'typeorm';
import { TimetableRepository, TimetableInput, ParsedTimetable } from '../database/repositories/timetable.repository';
import { CacheManager } from '../database/cache/cacheManager';
import { PaginationParams, PaginatedResponse, ServiceResult } from '../types/common.types';
import { logger } from '../utils/logger';

/**
 * TimetableService handles all business logic for Timetable operations
 */
export class TimetableService {
  private static instance: TimetableService | null = null;
  private timetableRepository: TimetableRepository;

  private constructor(dataSource: DataSource, cacheManager?: CacheManager) {
    this.timetableRepository = TimetableRepository.getInstance(dataSource, cacheManager);
  }

  static getInstance(dataSource: DataSource, cacheManager?: CacheManager): TimetableService {
    if (!TimetableService.instance) {
      TimetableService.instance = new TimetableService(dataSource, cacheManager);
    }
    return TimetableService.instance;
  }

  static resetInstance(): void {
    TimetableService.instance = null;
  }

  async create(input: TimetableInput): Promise<ServiceResult<ParsedTimetable>> {
    try {
      if (!input.name || input.name.trim() === '') {
        return { success: false, error: 'Timetable name is required' };
      }

      if (input.data === undefined || input.data === null) {
        return { success: false, error: 'Timetable data is required' };
      }

      const timetable = await this.timetableRepository.saveTimetable(input);
      logger.info('TimetableService: Created timetable', { id: timetable.id, name: timetable.name });
      return { success: true, data: timetable };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('TimetableService: Failed to create timetable', error);
      return { success: false, error: error.message };
    }
  }

  async updateData(id: number, data: unknown): Promise<ServiceResult<ParsedTimetable>> {
    try {
      const existing = await this.timetableRepository.getTimetable(id);
      if (!existing) {
        return { success: false, error: `Timetable with ID ${id} not found` };
      }

      const timetable = await this.timetableRepository.updateTimetable(id, data);
      if (!timetable) {
        return { success: false, error: `Failed to update timetable with ID ${id}` };
      }

      logger.info('TimetableService: Updated timetable data', { id });
      return { success: true, data: timetable };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('TimetableService: Failed to update timetable data', error, { id });
      return { success: false, error: error.message };
    }
  }

  async updateMetadata(id: number, input: Partial<TimetableInput>): Promise<ServiceResult<ParsedTimetable>> {
    try {
      if (input.name !== undefined && input.name.trim() === '') {
        return { success: false, error: 'Timetable name cannot be empty' };
      }

      const existing = await this.timetableRepository.getTimetable(id);
      if (!existing) {
        return { success: false, error: `Timetable with ID ${id} not found` };
      }

      const timetable = await this.timetableRepository.updateTimetableMetadata(id, input);
      if (!timetable) {
        return { success: false, error: `Failed to update timetable with ID ${id}` };
      }

      logger.info('TimetableService: Updated timetable metadata', { id });
      return { success: true, data: timetable };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('TimetableService: Failed to update timetable metadata', error, { id });
      return { success: false, error: error.message };
    }
  }

  async delete(id: number): Promise<ServiceResult<boolean>> {
    try {
      const existing = await this.timetableRepository.getTimetable(id);
      if (!existing) {
        return { success: false, error: `Timetable with ID ${id} not found` };
      }

      const deleted = await this.timetableRepository.deleteTimetable(id);
      if (!deleted) {
        return { success: false, error: `Failed to delete timetable with ID ${id}` };
      }

      logger.info('TimetableService: Deleted timetable', { id });
      return { success: true, data: true };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('TimetableService: Failed to delete timetable', error, { id });
      return { success: false, error: error.message };
    }
  }

  async findById(id: number): Promise<ServiceResult<ParsedTimetable>> {
    try {
      const timetable = await this.timetableRepository.getTimetable(id);
      if (!timetable) {
        return { success: false, error: `Timetable with ID ${id} not found` };
      }
      return { success: true, data: timetable };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('TimetableService: Failed to find timetable', error, { id });
      return { success: false, error: error.message };
    }
  }

  async findAll(pagination?: PaginationParams): Promise<ServiceResult<PaginatedResponse<ParsedTimetable>>> {
    try {
      const result = await this.timetableRepository.getAllTimetables(pagination);
      return { success: true, data: result };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('TimetableService: Failed to find all timetables', error);
      return { success: false, error: error.message };
    }
  }

  async findAllUnpaginated(): Promise<ServiceResult<ParsedTimetable[]>> {
    try {
      const timetables = await this.timetableRepository.getAllTimetablesUnpaginated();
      return { success: true, data: timetables };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('TimetableService: Failed to find all timetables', error);
      return { success: false, error: error.message };
    }
  }

  async findByAcademicYearId(academicYearId: number): Promise<ServiceResult<ParsedTimetable[]>> {
    try {
      const timetables = await this.timetableRepository.findByAcademicYearId(academicYearId);
      return { success: true, data: timetables };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('TimetableService: Failed to find timetables by academic year', error, { academicYearId });
      return { success: false, error: error.message };
    }
  }

  async findByTermId(termId: number): Promise<ServiceResult<ParsedTimetable[]>> {
    try {
      const timetables = await this.timetableRepository.findByTermId(termId);
      return { success: true, data: timetables };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('TimetableService: Failed to find timetables by term', error, { termId });
      return { success: false, error: error.message };
    }
  }

  async count(): Promise<ServiceResult<number>> {
    try {
      const count = await this.timetableRepository.countTimetables();
      return { success: true, data: count };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('TimetableService: Failed to count timetables', error);
      return { success: false, error: error.message };
    }
  }
}
