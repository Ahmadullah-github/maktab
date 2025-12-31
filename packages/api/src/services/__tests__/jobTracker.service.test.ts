/**
 * Unit Tests for JobTrackerService
 *
 * Tests progress tracking and job management for batch exports.
 *
 * Requirements: 4.1, 4.2, 10.1, 10.2
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getJobTracker, JobTrackerService, resetJobTracker } from '../jobTracker.service';

describe('JobTrackerService', () => {
  let jobTracker: JobTrackerService;

  beforeEach(() => {
    resetJobTracker();
    jobTracker = new JobTrackerService(
      2 * 60 * 60 * 1000, // 2 hours expiration
      15 * 60 * 1000 // 15 minutes cleanup interval
    );
  });

  afterEach(() => {
    jobTracker.stopCleanupScheduler();
    jobTracker.clearAllJobs();
  });

  describe('Job Creation', () => {
    it('should create a new job with unique ID', () => {
      const jobId = jobTracker.createJob({ total: 10 });

      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');
      expect(jobId.length).toBeGreaterThan(0);
    });

    it('should create job with initial preparing status', () => {
      const jobId = jobTracker.createJob({ total: 10 });
      const job = jobTracker.getJob(jobId);

      expect(job).not.toBeNull();
      expect(job?.progress.status).toBe('preparing');
      expect(job?.progress.current).toBe(0);
      expect(job?.progress.total).toBe(10);
    });

    it('should create job with custom message', () => {
      const jobId = jobTracker.createJob({
        total: 5,
        message: 'Custom message',
      });
      const job = jobTracker.getJob(jobId);

      expect(job?.progress.message).toBe('Custom message');
    });

    it('should create multiple jobs with unique IDs', () => {
      const jobId1 = jobTracker.createJob({ total: 10 });
      const jobId2 = jobTracker.createJob({ total: 20 });

      expect(jobId1).not.toBe(jobId2);
    });
  });

  describe('Job Progress Updates', () => {
    it('should update job progress', () => {
      const jobId = jobTracker.createJob({ total: 10 });

      const updated = jobTracker.updateJob(jobId, {
        current: 5,
        status: 'generating',
        message: 'Generating 5 of 10...',
      });

      expect(updated).toBe(true);

      const job = jobTracker.getJob(jobId);
      expect(job?.progress.current).toBe(5);
      expect(job?.progress.status).toBe('generating');
      expect(job?.progress.message).toBe('Generating 5 of 10...');
    });

    it('should return false when updating non-existent job', () => {
      const updated = jobTracker.updateJob('non-existent-id', {
        current: 5,
      });

      expect(updated).toBe(false);
    });

    it('should update job timestamp on progress update', async () => {
      const jobId = jobTracker.createJob({ total: 10 });
      const job1 = jobTracker.getJob(jobId);
      const initialUpdatedAt = job1?.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      jobTracker.updateJob(jobId, { current: 1 });
      const job2 = jobTracker.getJob(jobId);

      expect(job2?.updatedAt.getTime()).toBeGreaterThanOrEqual(initialUpdatedAt?.getTime() || 0);
    });
  });

  describe('Job Completion', () => {
    it('should mark job as complete with download info', () => {
      const jobId = jobTracker.createJob({ total: 10 });
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      const completed = jobTracker.completeJob(
        jobId,
        '/api/export/download/token123',
        'schedule_export.pdf',
        1024,
        expiresAt,
        10
      );

      expect(completed).toBe(true);

      const job = jobTracker.getJob(jobId);
      expect(job?.progress.status).toBe('complete');
      expect(job?.downloadUrl).toBe('/api/export/download/token123');
      expect(job?.filename).toBe('schedule_export.pdf');
      expect(job?.fileSize).toBe(1024);
      expect(job?.pageCount).toBe(10);
    });

    it('should set current to total on completion', () => {
      const jobId = jobTracker.createJob({ total: 10 });
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      jobTracker.completeJob(jobId, '/download/token', 'file.pdf', 1024, expiresAt);

      const job = jobTracker.getJob(jobId);
      expect(job?.progress.current).toBe(10);
    });
  });

  describe('Job Failure', () => {
    it('should mark job as failed with error message', () => {
      const jobId = jobTracker.createJob({ total: 10 });

      const failed = jobTracker.failJob(jobId, 'PDF generation failed');

      expect(failed).toBe(true);

      const job = jobTracker.getJob(jobId);
      expect(job?.progress.status).toBe('error');
      expect(job?.progress.message).toBe('PDF generation failed');
      expect(job?.error).toBe('PDF generation failed');
    });
  });

  describe('Job Cancellation', () => {
    it('should cancel an active job', () => {
      const jobId = jobTracker.createJob({ total: 10 });
      jobTracker.updateJob(jobId, { status: 'generating' });

      const cancelled = jobTracker.cancelJob(jobId);

      expect(cancelled).toBe(true);

      const job = jobTracker.getJob(jobId);
      expect(job?.progress.status).toBe('cancelled');
    });

    it('should not cancel a completed job', () => {
      const jobId = jobTracker.createJob({ total: 10 });
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      jobTracker.completeJob(jobId, '/download', 'file.pdf', 1024, expiresAt);

      const cancelled = jobTracker.cancelJob(jobId);

      expect(cancelled).toBe(false);

      const job = jobTracker.getJob(jobId);
      expect(job?.progress.status).toBe('complete');
    });

    it('should not cancel an already cancelled job', () => {
      const jobId = jobTracker.createJob({ total: 10 });
      jobTracker.cancelJob(jobId);

      const cancelled = jobTracker.cancelJob(jobId);

      expect(cancelled).toBe(false);
    });

    it('should check if job is cancelled', () => {
      const jobId = jobTracker.createJob({ total: 10 });

      expect(jobTracker.isJobCancelled(jobId)).toBe(false);

      jobTracker.cancelJob(jobId);

      expect(jobTracker.isJobCancelled(jobId)).toBe(true);
    });
  });

  describe('Progress Retrieval', () => {
    it('should get progress for existing job', () => {
      const jobId = jobTracker.createJob({ total: 10 });
      jobTracker.updateJob(jobId, { current: 5, status: 'generating' });

      const progress = jobTracker.getProgress(jobId);

      expect(progress).not.toBeNull();
      expect(progress?.current).toBe(5);
      expect(progress?.total).toBe(10);
      expect(progress?.status).toBe('generating');
    });

    it('should return null for non-existent job', () => {
      const progress = jobTracker.getProgress('non-existent-id');

      expect(progress).toBeNull();
    });
  });

  describe('Job Deletion', () => {
    it('should delete a job', () => {
      const jobId = jobTracker.createJob({ total: 10 });

      const deleted = jobTracker.deleteJob(jobId);

      expect(deleted).toBe(true);
      expect(jobTracker.getJob(jobId)).toBeNull();
    });

    it('should return false when deleting non-existent job', () => {
      const deleted = jobTracker.deleteJob('non-existent-id');

      expect(deleted).toBe(false);
    });
  });

  describe('Active Jobs', () => {
    it('should return only active jobs', () => {
      const jobId1 = jobTracker.createJob({ total: 10 });
      const jobId2 = jobTracker.createJob({ total: 20 });
      const jobId3 = jobTracker.createJob({ total: 30 });

      // Complete one job
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      jobTracker.completeJob(jobId1, '/download', 'file.pdf', 1024, expiresAt);

      // Fail another job
      jobTracker.failJob(jobId2, 'Error');

      const activeJobs = jobTracker.getActiveJobs();

      expect(activeJobs.length).toBe(1);
      expect(activeJobs[0].jobId).toBe(jobId3);
    });
  });

  describe('Job Count', () => {
    it('should return correct job count', () => {
      expect(jobTracker.getJobCount()).toBe(0);

      jobTracker.createJob({ total: 10 });
      expect(jobTracker.getJobCount()).toBe(1);

      jobTracker.createJob({ total: 20 });
      expect(jobTracker.getJobCount()).toBe(2);
    });
  });

  describe('Singleton Instance', () => {
    it('should return same instance from getJobTracker', () => {
      resetJobTracker();
      const instance1 = getJobTracker();
      const instance2 = getJobTracker();

      expect(instance1).toBe(instance2);
    });

    it('should reset singleton instance', () => {
      const instance1 = getJobTracker();
      instance1.createJob({ total: 10 });

      resetJobTracker();

      const instance2 = getJobTracker();
      expect(instance2.getJobCount()).toBe(0);
    });
  });
});
