/**
 * Export API functions for Schedule Export System
 *
 * Handles communication with export endpoints including:
 * - Single and batch export requests
 * - Progress polling for batch operations
 * - Download URL management
 *
 * Requirements: 2.1, 8.1
 */

import type { ExportProgress, ExportRequest, ExportResponse } from '@/schemas/export.schema';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

/**
 * Build a URL relative to the configured API base.
 */
function buildApiUrl(endpoint: string): string {
  const normalizedBase = API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`;
  const normalizedEndpoint = endpoint.replace(/^\//, '');

  return new URL(normalizedEndpoint, normalizedBase).toString();
}

/**
 * Resolve a download URL returned by the API.
 * The backend currently returns paths like `/api/export/download/:token`,
 * so these need to be expanded against the API origin in development.
 */
function resolveDownloadUrl(downloadUrl: string): string {
  if (/^https?:\/\//i.test(downloadUrl)) {
    return downloadUrl;
  }

  return new URL(downloadUrl, new URL(API_BASE_URL).origin).toString();
}

/**
 * Base fetch wrapper with error handling
 */
async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = buildApiUrl(endpoint);

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: response.statusText,
    }));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }

  // Handle empty responses
  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

/**
 * Export job response for batch operations
 */
export interface ExportJobResponse {
  jobId: string;
  status: 'started' | 'in_progress' | 'completed' | 'failed';
  downloadUrl?: string;
  filename?: string;
  expiresAt?: string;
  fileSize?: number;
  pageCount?: number;
}

/**
 * Export API client
 *
 * Provides methods for:
 * - Triggering export operations
 * - Polling progress for batch exports
 * - Handling download URLs and cancellation
 *
 * Requirements: 2.1, 8.1
 */
export const exportApi = {
  /**
   * Initiates an export request
   * For single exports, returns immediate response with download URL
   * For batch exports, returns job ID for progress tracking
   *
   * Requirements: 2.1
   */
  async exportSchedule(request: ExportRequest): Promise<ExportResponse | ExportJobResponse> {
    try {
      const response = await fetchAPI<ExportResponse | ExportJobResponse>(
        `/export/schedule/${request.scheduleId}`,
        {
          method: 'POST',
          body: JSON.stringify(request),
        }
      );

      return response;
    } catch (error) {
      throw new Error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Polls export progress for batch operations
   *
   * Requirements: 8.1
   */
  async getExportProgress(jobId: string): Promise<ExportProgress> {
    try {
      const response = await fetchAPI<ExportProgress>(`/export/progress/${jobId}`);
      return response;
    } catch (error) {
      throw new Error(
        `Failed to get export progress: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  },

  /**
   * Fetches the full job payload after a batch export completes.
   */
  async getExportJob(jobId: string): Promise<ExportJobResponse> {
    try {
      const response = await fetchAPI<ExportJobResponse>(`/export/job/${jobId}`);
      return response;
    } catch (error) {
      throw new Error(
        `Failed to get export job: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  },

  /**
   * Cancels an ongoing export operation
   *
   * Requirements: 8.1
   */
  async cancelExport(jobId: string): Promise<void> {
    try {
      await fetchAPI<void>(`/export/cancel/${jobId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      throw new Error(
        `Failed to cancel export: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  },

  /**
   * Downloads a file using the provided download URL
   * Triggers browser download automatically
   *
   * Requirements: 8.1
   */
  async downloadFile(downloadUrl: string, filename: string): Promise<void> {
    try {
      const response = await fetch(resolveDownloadUrl(downloadUrl));

      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      const blob = await response.blob();

      // Create download link and trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      throw new Error(
        `File download failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  },
};

/**
 * Utility function to determine if response is a job (batch export)
 */
export function isExportJob(
  response: ExportResponse | ExportJobResponse
): response is ExportJobResponse {
  return 'jobId' in response;
}

/**
 * Sanitize a string for use in filenames
 * Removes invalid characters and normalizes the result
 *
 * Requirements: 2.5, 8.4
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(
      /[^a-zA-Z0-9\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF-_]/g,
      '-'
    )
    .replace(/-+/g, '-') // Replace consecutive hyphens with single hyphen
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Utility function to generate filename following the convention
 * Pattern: schedule_{scope-prefix}{type}_{name}_{lang}_{date}.{ext}
 *
 * Requirements: 2.5, 8.4
 */
export function generateExportFilename(
  type: 'class' | 'teacher',
  name: string,
  language: 'fa' | 'en',
  format: 'pdf' | 'excel',
  scope: 'current' | 'all-classes' | 'all-teachers'
): string {
  const date = new Date().toISOString().split('T')[0];
  const scopePrefix = scope === 'current' ? '' : 'all-';
  const extension = format === 'excel' ? 'xlsx' : 'pdf';

  // Sanitize name for filename - keep original characters that are valid
  // but replace invalid ones with hyphens
  const sanitizedName = name.replace(
    /[^a-zA-Z0-9\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF-_]/g,
    '-'
  );

  return `schedule_${scopePrefix}${type}_${sanitizedName}_${language}_${date}.${extension}`;
}
