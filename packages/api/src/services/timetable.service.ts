/**
 * Timetable Service for business logic operations
 * @module services/timetable
 *
 * Requirements: 3.2
 * - Route handler SHALL delegate business logic to TimetableService class
 */

import { DataSource } from 'typeorm';
import {
  TimetableRepository,
  TimetableInput,
  ParsedTimetable,
  TimetableRevisionConflictError,
  TimetableSummary,
} from '../database/repositories/timetable.repository';
import { CacheManager } from '../database/cache/cacheManager';
import { PaginationParams, PaginatedResponse, ServiceResult } from '../types/common.types';
import { logger } from '../utils/logger';
import {
  clearDataSourceScopedInstances,
  getDataSourceScopedInstance,
} from '../utils/dataSourceScope';
import { SwapConstraintGatherer } from './SwapConstraintGatherer';
import { timetableDataSchema } from '../schemas/timetable.schema';
import { InvalidTimetableDraftError, SwapSolverService } from './SwapSolverService';

/**
 * TimetableService handles all business logic for Timetable operations
 */
export class TimetableService {
  private timetableRepository: TimetableRepository;
  private readonly swapConstraintGatherer: SwapConstraintGatherer;
  private readonly swapSolverService: SwapSolverService;

  private constructor(dataSource: DataSource, cacheManager?: CacheManager) {
    const cache = cacheManager ?? CacheManager.getInstance();
    this.timetableRepository = TimetableRepository.getInstance(dataSource, cache);
    this.swapConstraintGatherer = SwapConstraintGatherer.getInstance(dataSource, cache);
    this.swapSolverService = new SwapSolverService(this.swapConstraintGatherer);
  }

  static getInstance(dataSource: DataSource, cacheManager?: CacheManager): TimetableService {
    return getDataSourceScopedInstance(
      dataSource,
      TimetableService,
      () => new TimetableService(dataSource, cacheManager)
    );
  }

  static resetInstance(): void {
    clearDataSourceScopedInstances(TimetableService);
  }

  async create(input: TimetableInput): Promise<ServiceResult<ParsedTimetable>> {
    try {
      if (!input.name || input.name.trim() === '') {
        return { success: false, error: 'Timetable name is required' };
      }

      const validatedData = timetableDataSchema.parse(input.data);

      const timetable = await this.timetableRepository.saveTimetable({ ...input, data: validatedData });
      logger.info('TimetableService: Created timetable', {
        id: timetable.id,
        name: timetable.name,
      });
      return { success: true, data: timetable };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('TimetableService: Failed to create timetable', error);
      return { success: false, error: error.message };
    }
  }

  async updateData(
    id: number,
    data: unknown,
    expectedRevision: number
  ): Promise<ServiceResult<ParsedTimetable>> {
    try {
      const existing = await this.timetableRepository.getTimetable(id);
      if (!existing) {
        return { success: false, error: `Timetable with ID ${id} not found` };
      }

      const validatedData = timetableDataSchema.parse(data);
      const timetable = await this.timetableRepository.updateTimetable(
        id,
        validatedData,
        expectedRevision
      );
      if (!timetable) {
        return { success: false, error: `Failed to update timetable with ID ${id}` };
      }

      this.swapConstraintGatherer.invalidateCache(id);
      logger.info('TimetableService: Updated timetable data', { id });
      return { success: true, data: timetable };
    } catch (err) {
      if (err instanceof TimetableRevisionConflictError) {
        return {
          success: false,
          statusCode: 409,
          code: err.code,
          error: err.message,
          details: { currentRevision: err.currentRevision },
        };
      }
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('TimetableService: Failed to update timetable data', error, { id });
      return { success: false, error: error.message };
    }
  }

  async updateLessons(
    id: number,
    lessons: unknown[],
    expectedRevision: number
  ): Promise<ServiceResult<ParsedTimetable>> {
    try {
      const validatedLessons = timetableDataSchema.shape.schedule.parse(lessons);
      const validation = await this.swapSolverService.validateSchedule(
        id,
        expectedRevision,
        validatedLessons
      );
      if (!validation.isValid) {
        return {
          success: false,
          statusCode: 422,
          code: 'TIMETABLE_CONSTRAINT_VIOLATION',
          error: 'The edited timetable violates one or more hard constraints.',
          details: { errors: validation.errors },
        };
      }

      const timetable = await this.timetableRepository.updateTimetableLessons(
        id,
        validatedLessons,
        expectedRevision
      );
      if (!timetable) {
        return { success: false, statusCode: 404, error: `Timetable with ID ${id} not found` };
      }
      this.swapConstraintGatherer.invalidateCache(id);
      return { success: true, data: timetable };
    } catch (err) {
      if (err instanceof TimetableRevisionConflictError) {
        return {
          success: false,
          statusCode: 409,
          code: err.code,
          error: err.message,
          details: { currentRevision: err.currentRevision },
        };
      }
      if (err instanceof InvalidTimetableDraftError) {
        return {
          success: false,
          statusCode: 400,
          code: err.code,
          error: err.message,
        };
      }
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('TimetableService: Failed to update timetable lessons', error, { id });
      return { success: false, statusCode: 400, error: error.message };
    }
  }

  async updateMetadata(
    id: number,
    input: Partial<TimetableInput>
  ): Promise<ServiceResult<ParsedTimetable>> {
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

      this.swapConstraintGatherer.invalidateCache(id);
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

  async findAll(
    pagination?: PaginationParams
  ): Promise<ServiceResult<PaginatedResponse<ParsedTimetable>>> {
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

  async findAllSummaries(): Promise<ServiceResult<TimetableSummary[]>> {
    try {
      return { success: true, data: await this.timetableRepository.getAllTimetableSummaries() };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('TimetableService: Failed to load timetable summaries', error);
      return { success: false, error: error.message };
    }
  }

  async findByAcademicYearId(academicYearId: number): Promise<ServiceResult<ParsedTimetable[]>> {
    try {
      const timetables = await this.timetableRepository.findByAcademicYearId(academicYearId);
      return { success: true, data: timetables };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('TimetableService: Failed to find timetables by academic year', error, {
        academicYearId,
      });
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
