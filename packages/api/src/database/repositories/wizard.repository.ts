/**
 * Wizard Repository for WizardStep entity data access operations
 * @module database/repositories/wizard
 * 
 * Requirements: 1.7
 * - Dedicated wizardRepository.ts file containing only WizardStep-related database operations
 */

import { DataSource, EntityManager, EntityTarget } from 'typeorm';
import { WizardStep } from '../../entity/WizardStep';
import { CacheManager } from '../cache/cacheManager';
import { BaseRepository, RepositoryOptions } from './base.repository';
import { safeJsonParse, safeJsonStringify } from '../../utils/jsonTransformer';
import { logger } from '../../utils/logger';

/**
 * WizardStep data transfer object for input
 */
export interface WizardStepInput {
  wizardId: number;
  stepKey: string;
  data: unknown;
}

/**
 * WizardStep with parsed JSON data field
 */
export interface ParsedWizardStep {
  id: number;
  wizardId: number;
  stepKey: string;
  data: unknown;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Wizard Repository
 * 
 * Handles all WizardStep-related database operations with:
 * - JSON data field parsing/stringifying
 * - Caching via CacheManager
 * - Composite key lookups (wizardId + stepKey)
 */
export class WizardRepository extends BaseRepository<WizardStep> {
  protected readonly entityClass: EntityTarget<WizardStep> = WizardStep;
  protected readonly cachePrefix: string = 'wizard';

  private static instance: WizardRepository | null = null;

  constructor(dataSource: DataSource, cacheManager: CacheManager) {
    super(dataSource, cacheManager);
  }

  /**
   * Get singleton instance of WizardRepository
   * @param dataSource - TypeORM DataSource
   * @param cacheManager - CacheManager instance
   */
  static getInstance(dataSource: DataSource, cacheManager?: CacheManager): WizardRepository {
    if (!WizardRepository.instance) {
      const cache = cacheManager ?? CacheManager.getInstance();
      WizardRepository.instance = new WizardRepository(dataSource, cache);
    }
    return WizardRepository.instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    WizardRepository.instance = null;
  }

  // =========================================================================
  // Cache Key Helpers
  // =========================================================================

  /**
   * Generate cache key for a wizard step
   * @param wizardId - Wizard ID
   * @param stepKey - Step key
   */
  private getStepCacheKey(wizardId: number, stepKey: string): string {
    return `wizard:${wizardId}:step:${stepKey}`;
  }

  /**
   * Generate cache key for all steps of a wizard
   * @param wizardId - Wizard ID
   */
  private getWizardStepsCacheKey(wizardId: number): string {
    return `wizard:${wizardId}:all`;
  }

  // =========================================================================
  // JSON Field Helpers
  // =========================================================================

  /**
   * Parse JSON data field in a WizardStep entity
   * @param step - WizardStep entity with JSON string data field
   * @returns WizardStep with parsed data field
   */
  private parseWizardStepJsonFields(step: WizardStep): ParsedWizardStep {
    return {
      id: step.id,
      wizardId: step.wizardId,
      stepKey: step.stepKey,
      data: safeJsonParse<unknown>(step.data, {}),
      createdAt: step.createdAt,
      updatedAt: step.updatedAt,
    };
  }

  // =========================================================================
  // CRUD Operations
  // =========================================================================

  /**
   * Get a wizard step by wizardId and stepKey
   * @param wizardId - Wizard ID
   * @param stepKey - Step key
   * @param options - Repository options
   * @returns Parsed wizard step or null
   */
  async getWizardStep(
    wizardId: number,
    stepKey: string,
    options?: RepositoryOptions
  ): Promise<ParsedWizardStep | null> {
    const cacheKey = this.getStepCacheKey(wizardId, stepKey);

    // Check cache first
    if (!options?.skipCache) {
      const cached = this.cacheManager.get<ParsedWizardStep>(this.cachePrefix, cacheKey);
      if (cached !== undefined) {
        logger.debug('Retrieved wizard step from cache', { wizardId, stepKey });
        return cached;
      }
    }

    const repo = this.getRepository(options?.manager);
    const step = await repo.findOne({ where: { wizardId, stepKey } });

    if (!step) {
      logger.debug('Wizard step not found', { wizardId, stepKey });
      return null;
    }

    const parsed = this.parseWizardStepJsonFields(step);

    // Cache the parsed result
    if (!options?.skipCache) {
      this.cacheManager.set(this.cachePrefix, cacheKey, parsed);
      logger.debug('Retrieved wizard step from database and cached', { wizardId, stepKey });
    }

    return parsed;
  }

  /**
   * Get all wizard steps for a wizard
   * @param wizardId - Wizard ID
   * @param options - Repository options
   * @returns Array of parsed wizard steps
   */
  async getAllWizardSteps(
    wizardId: number,
    options?: RepositoryOptions
  ): Promise<ParsedWizardStep[]> {
    const cacheKey = this.getWizardStepsCacheKey(wizardId);

    // Check cache first
    if (!options?.skipCache) {
      const cached = this.cacheManager.get<ParsedWizardStep[]>(this.cachePrefix, cacheKey);
      if (cached !== undefined) {
        logger.debug('Retrieved all wizard steps from cache', { wizardId });
        return cached;
      }
    }

    const repo = this.getRepository(options?.manager);
    const steps = await repo.find({
      where: { wizardId },
      order: { id: 'ASC' },
    });

    const parsedSteps = steps.map((s) => this.parseWizardStepJsonFields(s));

    // Cache the result
    if (!options?.skipCache) {
      this.cacheManager.set(this.cachePrefix, cacheKey, parsedSteps);
      logger.debug('Retrieved all wizard steps from database and cached', {
        wizardId,
        count: parsedSteps.length,
      });
    }

    return parsedSteps;
  }

  /**
   * Save a wizard step (upsert by wizardId + stepKey)
   * @param input - Wizard step input data
   * @param options - Repository options
   * @returns Saved wizard step with parsed JSON data
   */
  async saveWizardStep(
    input: WizardStepInput,
    options?: RepositoryOptions
  ): Promise<ParsedWizardStep> {
    const repo = this.getRepository(options?.manager);
    const now = new Date();

    let step = await repo.findOne({
      where: { wizardId: input.wizardId, stepKey: input.stepKey },
    });

    if (!step) {
      step = new WizardStep();
      step.wizardId = input.wizardId;
      step.stepKey = input.stepKey;
      logger.debug('Creating new wizard step', {
        wizardId: input.wizardId,
        stepKey: input.stepKey,
      });
    } else {
      logger.debug('Updating existing wizard step', {
        wizardId: input.wizardId,
        stepKey: input.stepKey,
        id: step.id,
      });
    }

    step.data = safeJsonStringify(input.data, '{}');
    step.updatedAt = now;

    const saved = await repo.save(step);

    // Invalidate cache
    if (!options?.skipCache) {
      const stepCacheKey = this.getStepCacheKey(input.wizardId, input.stepKey);
      const allStepsCacheKey = this.getWizardStepsCacheKey(input.wizardId);
      this.cacheManager.delete(this.cachePrefix, stepCacheKey);
      this.cacheManager.delete(this.cachePrefix, allStepsCacheKey);
    }

    logger.info('Saved wizard step', {
      id: saved.id,
      wizardId: saved.wizardId,
      stepKey: saved.stepKey,
    });
    return this.parseWizardStepJsonFields(saved);
  }

  /**
   * Delete all wizard steps for a wizard
   * @param wizardId - Wizard ID
   * @param options - Repository options
   * @returns true if any steps were deleted
   */
  async deleteWizardSteps(wizardId: number, options?: RepositoryOptions): Promise<boolean> {
    const repo = this.getRepository(options?.manager);
    const result = await repo.delete({ wizardId });

    // Invalidate cache for this wizard
    if (!options?.skipCache) {
      // Invalidate all cache entries for this wizard
      this.cacheManager.invalidatePrefix(`${this.cachePrefix}:wizard:${wizardId}`);
      // Also invalidate the all steps cache
      const allStepsCacheKey = this.getWizardStepsCacheKey(wizardId);
      this.cacheManager.delete(this.cachePrefix, allStepsCacheKey);
    }

    const success = (result.affected ?? 0) > 0;
    if (success) {
      logger.info('Deleted wizard steps', { wizardId, count: result.affected });
    } else {
      logger.debug('No wizard steps found to delete', { wizardId });
    }
    return success;
  }

  /**
   * Delete a specific wizard step
   * @param wizardId - Wizard ID
   * @param stepKey - Step key
   * @param options - Repository options
   * @returns true if deleted, false if not found
   */
  async deleteWizardStep(
    wizardId: number,
    stepKey: string,
    options?: RepositoryOptions
  ): Promise<boolean> {
    const repo = this.getRepository(options?.manager);
    const result = await repo.delete({ wizardId, stepKey });

    // Invalidate cache
    if (!options?.skipCache) {
      const stepCacheKey = this.getStepCacheKey(wizardId, stepKey);
      const allStepsCacheKey = this.getWizardStepsCacheKey(wizardId);
      this.cacheManager.delete(this.cachePrefix, stepCacheKey);
      this.cacheManager.delete(this.cachePrefix, allStepsCacheKey);
    }

    const success = (result.affected ?? 0) > 0;
    if (success) {
      logger.info('Deleted wizard step', { wizardId, stepKey });
    }
    return success;
  }

  /**
   * Count wizard steps for a wizard
   * @param wizardId - Wizard ID
   * @param options - Repository options
   * @returns Count of steps
   */
  async countWizardSteps(wizardId: number, options?: RepositoryOptions): Promise<number> {
    const repo = this.getRepository(options?.manager);
    return repo.count({ where: { wizardId } });
  }
}
