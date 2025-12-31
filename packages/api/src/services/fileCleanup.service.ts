import * as fs from 'fs/promises';
import * as path from 'path';
import * as zipStream from 'zip-stream';

/**
 * File cleanup configuration
 */
interface CleanupConfig {
  downloadUrlExpiry: number; // 1 hour in milliseconds
  cleanupInterval: number; // 15 minutes in milliseconds
  maxFileAge: number; // 2 hours in milliseconds
}

/**
 * Scheduled cleanup task
 */
interface CleanupTask {
  filePath: string;
  expirationTime: Date;
}

/**
 * File Cleanup Service
 * Requirements: 8.3, 8.5
 *
 * Handles automatic cleanup of expired export files,
 * cleanup scheduling and monitoring, and download URL expiration
 */
export class FileCleanupService {
  private readonly config: CleanupConfig;
  private readonly scheduledTasks: Map<string, CleanupTask> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config?: Partial<CleanupConfig>) {
    this.config = {
      downloadUrlExpiry: 60 * 60 * 1000, // 1 hour
      cleanupInterval: 15 * 60 * 1000, // 15 minutes
      maxFileAge: 2 * 60 * 60 * 1000, // 2 hours
      ...config,
    };

    // Start automatic cleanup process
    this.startCleanupScheduler();
  }

  /**
   * Schedule cleanup for a specific file
   * Requirements: 8.3, 8.5
   */
  async scheduleCleanup(filePath: string, expirationTime: Date): Promise<void> {
    const taskId = path.basename(filePath);

    this.scheduledTasks.set(taskId, {
      filePath,
      expirationTime,
    });

    console.log(`Scheduled cleanup for ${filePath} at ${expirationTime.toISOString()}`);
  }

  /**
   * Clean up expired files immediately
   * Requirements: 8.3, 8.5
   */
  async cleanupExpiredFiles(): Promise<void> {
    const now = new Date();
    const expiredTasks: string[] = [];

    for (const [taskId, task] of this.scheduledTasks.entries()) {
      if (now >= task.expirationTime) {
        try {
          // Check if file exists before attempting to delete
          await fs.access(task.filePath);
          await fs.unlink(task.filePath);
          console.log(`Cleaned up expired file: ${task.filePath}`);
        } catch (error) {
          // File might already be deleted or not exist
          console.warn(`Could not clean up file ${task.filePath}:`, error);
        }

        expiredTasks.push(taskId);
      }
    }

    // Remove completed tasks from schedule
    for (const taskId of expiredTasks) {
      this.scheduledTasks.delete(taskId);
    }

    console.log(`Cleanup completed. Removed ${expiredTasks.length} expired files.`);
  }

  /**
   * Clean up files older than maxFileAge, regardless of scheduled tasks
   * Requirements: 8.5
   */
  async cleanupOldFiles(directory: string): Promise<void> {
    try {
      const files = await fs.readdir(directory);
      const now = Date.now();
      let cleanedCount = 0;

      for (const file of files) {
        const filePath = path.join(directory, file);

        try {
          const stats = await fs.stat(filePath);
          const fileAge = now - stats.mtime.getTime();

          if (fileAge > this.config.maxFileAge) {
            await fs.unlink(filePath);
            cleanedCount++;
            console.log(`Cleaned up old file: ${filePath}`);
          }
        } catch (error) {
          console.warn(`Could not process file ${filePath}:`, error);
        }
      }

      if (cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} old files from ${directory}`);
      }
    } catch (error) {
      console.error(`Failed to clean up directory ${directory}:`, error);
    }
  }

  /**
   * Create archive from multiple files for batch exports
   * Requirements: 8.5
   * Using zip-stream for memory-efficient archive creation
   */
  async createArchive(files: { name: string; content: Buffer }[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const archive = zipStream();
      const chunks: Buffer[] = [];

      archive.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      archive.on('end', () => {
        const result = Buffer.concat(chunks);
        resolve(result);
      });

      archive.on('error', (error: Error) => {
        reject(error);
      });

      // Add files to archive
      for (const file of files) {
        archive.entry(file.content, { name: file.name }, (error: any) => {
          if (error) {
            reject(error);
            return;
          }
        });
      }

      // Finalize the archive
      archive.finalize();
    });
  }

  /**
   * Start automatic cleanup scheduler
   * Requirements: 8.3, 8.5
   */
  private startCleanupScheduler(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(async () => {
      try {
        await this.cleanupExpiredFiles();
      } catch (error) {
        console.error('Scheduled cleanup failed:', error);
      }
    }, this.config.cleanupInterval);

    console.log(
      `File cleanup scheduler started with ${this.config.cleanupInterval / 1000}s interval`
    );
  }

  /**
   * Stop cleanup scheduler
   */
  stopCleanupScheduler(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      console.log('File cleanup scheduler stopped');
    }
  }

  /**
   * Get cleanup statistics
   */
  getCleanupStats(): {
    scheduledTasks: number;
    nextCleanupTime: Date | null;
    config: CleanupConfig;
  } {
    let nextCleanupTime: Date | null = null;

    if (this.scheduledTasks.size > 0) {
      const times = Array.from(this.scheduledTasks.values()).map((task) =>
        task.expirationTime.getTime()
      );
      nextCleanupTime = new Date(Math.min(...times));
    }

    return {
      scheduledTasks: this.scheduledTasks.size,
      nextCleanupTime,
      config: this.config,
    };
  }

  /**
   * Force cleanup of specific file
   * Requirements: 8.5
   */
  async forceCleanup(filePath: string): Promise<boolean> {
    try {
      await fs.unlink(filePath);

      // Remove from scheduled tasks if exists
      const taskId = path.basename(filePath);
      this.scheduledTasks.delete(taskId);

      console.log(`Force cleaned up file: ${filePath}`);
      return true;
    } catch (error) {
      console.warn(`Could not force cleanup file ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Check if download URL has expired
   * Requirements: 8.3
   */
  isUrlExpired(createdAt: Date): boolean {
    const now = Date.now();
    const urlAge = now - createdAt.getTime();
    return urlAge > this.config.downloadUrlExpiry;
  }

  /**
   * Get remaining time before URL expires
   * Requirements: 8.3
   */
  getUrlExpirationTime(createdAt: Date): number {
    const now = Date.now();
    const urlAge = now - createdAt.getTime();
    const remaining = this.config.downloadUrlExpiry - urlAge;
    return Math.max(0, remaining);
  }

  /**
   * Cleanup service destructor
   */
  destroy(): void {
    this.stopCleanupScheduler();
    this.scheduledTasks.clear();
  }
}
