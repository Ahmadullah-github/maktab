/**
 * DeviceTrial Service - manages 7-day auto-trial per device
 *
 * Requirements: License System
 * - Auto-start 7-day trial on first API call per machine ID
 * - Track trial usage to prevent abuse (reinstall won't reset trial)
 * - Provide trial status for license middleware
 */

import { AppDataSource } from '../../ormconfig';
import { DeviceTrial } from '../entity/DeviceTrial';
import { logger } from '../utils/logger';

export interface TrialStatus {
  hasTrial: boolean;
  isTrialActive: boolean;
  isTrialExpired: boolean;
  trialDaysRemaining: number;
  trialStartedAt: Date | null;
  trialExpiresAt: Date | null;
  message: string;
  messageType: 'info' | 'warning' | 'expired';
}

const TRIAL_DURATION_DAYS = 7;

export class DeviceTrialService {
  private static instance: DeviceTrialService;

  private constructor() {}

  public static getInstance(): DeviceTrialService {
    if (!DeviceTrialService.instance) {
      DeviceTrialService.instance = new DeviceTrialService();
    }
    return DeviceTrialService.instance;
  }

  /**
   * Get or create trial for a device
   * If device has no trial record, creates one with 7-day duration
   * If device already has trial, returns existing status
   */
  async getOrCreateTrial(machineId: string): Promise<TrialStatus> {
    try {
      const repo = AppDataSource.getRepository(DeviceTrial);

      // Check if device already has a trial record
      let deviceTrial = await repo.findOneBy({ machineId });

      if (!deviceTrial) {
        // First time - create new trial
        const now = new Date();
        const expiresAt = new Date();
        expiresAt.setDate(now.getDate() + TRIAL_DURATION_DAYS);

        deviceTrial = new DeviceTrial();
        deviceTrial.machineId = machineId;
        deviceTrial.trialStartedAt = now;
        deviceTrial.trialExpiresAt = expiresAt;
        deviceTrial.trialUsed = true;

        await repo.save(deviceTrial);

        logger.info('Created new device trial', { machineId, expiresAt });
      }

      return this.calculateTrialStatus(deviceTrial);
    } catch (error) {
      logger.error(
        'Error in getOrCreateTrial',
        error instanceof Error ? error : new Error(String(error))
      );
      // Return expired status on error to be safe
      return {
        hasTrial: false,
        isTrialActive: false,
        isTrialExpired: true,
        trialDaysRemaining: 0,
        trialStartedAt: null,
        trialExpiresAt: null,
        message: 'خطا در بررسی دوره آزمایشی',
        messageType: 'expired',
      };
    }
  }

  /**
   * Check trial status for a device without creating one
   */
  async checkTrialStatus(machineId: string): Promise<TrialStatus | null> {
    try {
      const repo = AppDataSource.getRepository(DeviceTrial);
      const deviceTrial = await repo.findOneBy({ machineId });

      if (!deviceTrial) {
        return null; // No trial exists for this device
      }

      return this.calculateTrialStatus(deviceTrial);
    } catch (error) {
      logger.error(
        'Error checking trial status',
        error instanceof Error ? error : new Error(String(error))
      );
      return null;
    }
  }

  /**
   * Calculate trial status from DeviceTrial entity
   */
  private calculateTrialStatus(deviceTrial: DeviceTrial): TrialStatus {
    const now = new Date();
    const expiresAt = new Date(deviceTrial.trialExpiresAt);
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / msPerDay);

    const isActive = now < expiresAt;
    const isExpired = !isActive;

    let message: string;
    let messageType: 'info' | 'warning' | 'expired';

    if (isExpired) {
      message = 'دوره آزمایشی ۷ روزه به پایان رسیده است. برای ادامه استفاده، لایسنس فعال کنید.';
      messageType = 'expired';
    } else if (daysRemaining <= 2) {
      message = `دوره آزمایشی: ${daysRemaining} روز باقی‌مانده. برای ادامه استفاده لایسنس فعال کنید.`;
      messageType = 'warning';
    } else {
      message = `دوره آزمایشی: ${daysRemaining} روز باقی‌مانده`;
      messageType = 'info';
    }

    return {
      hasTrial: true,
      isTrialActive: isActive,
      isTrialExpired: isExpired,
      trialDaysRemaining: Math.max(0, daysRemaining),
      trialStartedAt: deviceTrial.trialStartedAt,
      trialExpiresAt: deviceTrial.trialExpiresAt,
      message,
      messageType,
    };
  }
}
