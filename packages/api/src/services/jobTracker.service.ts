/**
 * Job Tracker Service
 *
 * Manages job tracking for long-running export operations.
 * Stores progress state in memory with support for progress updates,
 * cancellation, and automatic cleanup of completed/expired jobs.
 *
 * Requirements: 4.1, 4.2
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Export progress status types
 */
export type JobStatus =
  | 'preparing'
  | 'generating'
  | 'finalizing'
  | 'complete'
  | 'error'
  | 'cancelled';

/**
 * Export progress information
 * Requirements: 4.1, 4.2
 */
export interface ExportProgress {
  current: number;
  total: number;
  status: JobStatus;
  message: string;
}

/**
 * Job information stored in tracker
 */
export interface JobInfo {
  jobId: string;
  progress: ExportProgress;
  createdAt: Date;
  updatedAt: Date;
  downloadUrl?: string;
  filename?: string;
  expiresAt?: Date;
  fileSize?: number;
  pageCount?: number;
  error?: string;
}

/**
 * Job creation options
 */
export interface CreateJobOptions {
  total: number;
  message?: string;
}

/**
 * Job update options
 */
export interface UpdateJobOptions {
  current?: number;
  total?: number;
  status?: JobStatus;
  message?: string;
  downloadUrl?: string;
  filename?: string;
  expiresAt?: Date;
  fileSize?: number;
  pageCount?: number;
  error?: string;
}

/**
 * Job Tracker Service
 *
 * Provides in-memory job tracking for batch export operations.
 * In production, this could be replaced with Redis or database storage.
 *
 * Requirements: 4.1, 4.2
 */
export class JobTrackerService {
  private jobs: Map<string, JobInfo> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly jobExpirationMs: number;
  private readonly cleanupIntervalMs: number;

  constructor(
    jobExpirationMs: number = 2 * 60 * 60 * 1000, // 2 hours default
    cleanupIntervalMs: number = 15 * 60 * 1000 // 15 minutes default
  ) {
    this.jobExpirationMs = jobExpirationMs;
    this.cleanupIntervalMs = cleanupIntervalMs;
    this.startCleanupScheduler();
  }

  /**
   * Create a new job and return its ID
   * Requirements: 4.1
   */
  createJob(options: CreateJobOptions): string {
    const jobId = uuidv4();
    const now = new Date();

    const jobInfo: JobInfo = {
      jobId,
      progress: {
        current: 0,
        total: options.total,
        status: 'preparing',
        message: options.message || 'Preparing export...',
      },
      createdAt: now,
      updatedAt: now,
    };

    this.jobs.set(jobId, jobInfo);
    return jobId;
  }

  /**
   * Get job progress by ID
   * Requirements: 4.1, 4.2
   */
  getJob(jobId: string): JobInfo | null {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Get job progress in the format expected by frontend
   * Requirements: 4.2
   */
  getProgress(jobId: string): ExportProgress | null {
    const job = this.jobs.get(jobId);
    return job ? job.progress : null;
  }

  /**
   * Update job progress
   * Requirements: 4.1, 4.2
   */
  updateJob(jobId: string, options: UpdateJobOptions): boolean {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    // Update progress fields
    if (options.current !== undefined) {
      job.progress.current = options.current;
    }
    if (options.total !== undefined) {
      job.progress.total = options.total;
    }
    if (options.status !== undefined) {
      job.progress.status = options.status;
    }
    if (options.message !== undefined) {
      job.progress.message = options.message;
    }

    // Update job metadata
    if (options.downloadUrl !== undefined) {
      job.downloadUrl = options.downloadUrl;
    }
    if (options.filename !== undefined) {
      job.filename = options.filename;
    }
    if (options.expiresAt !== undefined) {
      job.expiresAt = options.expiresAt;
    }
    if (options.fileSize !== undefined) {
      job.fileSize = options.fileSize;
    }
    if (options.pageCount !== undefined) {
      job.pageCount = options.pageCount;
    }
    if (options.error !== undefined) {
      job.error = options.error;
    }

    job.updatedAt = new Date();
    this.jobs.set(jobId, job);
    return true;
  }

  /**
   * Mark job as complete with download information
   * Requirements: 4.1
   */
  completeJob(
    jobId: string,
    downloadUrl: string,
    filename: string,
    fileSize: number,
    expiresAt: Date,
    pageCount?: number
  ): boolean {
    return this.updateJob(jobId, {
      status: 'complete',
      message: 'Export completed successfully',
      downloadUrl,
      filename,
      fileSize,
      expiresAt,
      pageCount,
      current: this.getJob(jobId)?.progress.total || 1,
    });
  }

  /**
   * Mark job as failed with error message
   * Requirements: 4.1
   */
  failJob(jobId: string, error: string): boolean {
    return this.updateJob(jobId, {
      status: 'error',
      message: error,
      error,
    });
  }

  /**
   * Cancel a job
   * Requirements: 4.3
   */
  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    // Only allow cancellation of jobs that are not complete or already cancelled
    if (job.progress.status === 'complete' || job.progress.status === 'cancelled') {
      return false;
    }

    return this.updateJob(jobId, {
      status: 'cancelled',
      message: 'Export cancelled by user',
    });
  }

  /**
   * Check if a job is cancelled
   */
  isJobCancelled(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    return job?.progress.status === 'cancelled';
  }

  /**
   * Delete a job
   */
  deleteJob(jobId: string): boolean {
    return this.jobs.delete(jobId);
  }

  /**
   * Get all active jobs (not complete, error, or cancelled)
   */
  getActiveJobs(): JobInfo[] {
    const activeJobs: JobInfo[] = [];
    this.jobs.forEach((job) => {
      if (!['complete', 'error', 'cancelled'].includes(job.progress.status)) {
        activeJobs.push(job);
      }
    });
    return activeJobs;
  }

  /**
   * Start the cleanup scheduler
   */
  private startCleanupScheduler(): void {
    if (this.cleanupInterval) {
      return;
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredJobs();
    }, this.cleanupIntervalMs);
  }

  /**
   * Stop the cleanup scheduler
   */
  stopCleanupScheduler(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clean up expired jobs
   */
  cleanupExpiredJobs(): number {
    const now = new Date();
    const expirationThreshold = new Date(now.getTime() - this.jobExpirationMs);
    let cleanedCount = 0;

    this.jobs.forEach((job, jobId) => {
      // Remove jobs that are older than expiration threshold
      if (job.createdAt < expirationThreshold) {
        this.jobs.delete(jobId);
        cleanedCount++;
      }
    });

    return cleanedCount;
  }

  /**
   * Get the count of all jobs
   */
  getJobCount(): number {
    return this.jobs.size;
  }

  /**
   * Clear all jobs (for testing)
   */
  clearAllJobs(): void {
    this.jobs.clear();
  }
}

// Singleton instance for application-wide use
let jobTrackerInstance: JobTrackerService | null = null;

/**
 * Get the singleton JobTrackerService instance
 */
export function getJobTracker(): JobTrackerService {
  if (!jobTrackerInstance) {
    jobTrackerInstance = new JobTrackerService();
  }
  return jobTrackerInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetJobTracker(): void {
  if (jobTrackerInstance) {
    jobTrackerInstance.stopCleanupScheduler();
    jobTrackerInstance.clearAllJobs();
    jobTrackerInstance = null;
  }
}
