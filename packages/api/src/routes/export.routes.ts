/**
 * Export routes for Schedule Export System
 * Requirements: 2.1, 4.1, 8.1
 */

import { Router } from 'express';
import { DataSource } from 'typeorm';
import { CacheManager } from '../database/cache/cacheManager';
import { exportRequestSchema } from '../schemas/export.schema';
import { positiveIntegerParam, textParam } from '../middleware/validation.middleware';
import { AnalysisGenerationService } from '../services/analysisGeneration.service';
import { ExcelGenerationService } from '../services/excelGeneration.service';
import { ExportService } from '../services/export.service';
import { FileCleanupService } from '../services/fileCleanup.service';
import { PDFGenerationService } from '../services/pdfGeneration.service';

/**
 * Creates export routes with dependency injection
 */
export function createExportRoutes(dataSource: DataSource, cacheManager?: CacheManager): Router {
  const router = Router();
  router.param('id', positiveIntegerParam);
  router.param('jobId', textParam(1, 128));
  router.param('token', textParam(1, 256));

  // Initialize services
  const pdfService = new PDFGenerationService();
  const excelService = new ExcelGenerationService();
  const analysisService = new AnalysisGenerationService(dataSource);
  const fileCleanupService = new FileCleanupService();

  const exportService = new ExportService(
    dataSource,
    pdfService,
    excelService,
    analysisService,
    fileCleanupService
  );

  // POST /api/export/schedule/:id - Export schedule
  // Note: This is the main export endpoint for schedules
  // Requirements: 2.1, 8.1
  router.post('/schedule/:id', async (req, res) => {
    try {
      const scheduleId = Number(req.params.id);
      if (isNaN(scheduleId)) {
        return res.status(400).json({ error: 'Invalid schedule ID' });
      }

      // Validate request body
      const validationResult = exportRequestSchema.safeParse({
        ...req.body,
        scheduleId,
      });

      if (!validationResult.success) {
        return res.status(400).json({
          error: 'Invalid request data',
          details: validationResult.error.issues,
        });
      }

      const exportRequest = validationResult.data;

      // For batch exports (all-classes or all-teachers), use job tracking
      if (exportRequest.scope !== 'current') {
        const jobResponse = await exportService.startBatchExport(exportRequest);
        return res.json(jobResponse);
      }

      // For single exports, process immediately
      const result = await exportService.exportSchedule(exportRequest);
      res.json(result);
    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({
        error: 'Export failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // GET /api/export/progress/:jobId - Get export progress
  // Requirements: 4.1, 4.2
  router.get('/progress/:jobId', (req, res) => {
    try {
      const jobId = req.params.jobId;
      const progress = exportService.getBatchExportProgress(jobId);

      if (!progress) {
        return res.status(404).json({ error: 'Job not found' });
      }

      res.json(progress);
    } catch (error) {
      console.error('Progress check error:', error);
      res.status(500).json({
        error: 'Failed to get progress',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // GET /api/export/job/:jobId - Get full job information
  // Requirements: 4.1
  router.get('/job/:jobId', (req, res) => {
    try {
      const jobId = req.params.jobId;
      const job = exportService.getBatchExportJob(jobId);

      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      res.json(job);
    } catch (error) {
      console.error('Job info error:', error);
      res.status(500).json({
        error: 'Failed to get job info',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // GET /api/export/download/:token - Download exported file
  router.get('/download/:token', async (req, res) => {
    try {
      const token = req.params.token;
      const filePath = await exportService.getFilePathFromToken(token);

      if (!filePath) {
        return res.status(404).json({ error: 'File not found or expired' });
      }

      // Send file for download
      res.download(filePath, (err) => {
        if (err) {
          console.error('Download error:', err);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Download failed' });
          }
        }
      });
    } catch (error) {
      console.error('Download error:', error);
      res.status(500).json({ error: 'Download failed' });
    }
  });

  // DELETE /api/export/cancel/:jobId - Cancel export operation
  // Requirements: 4.3
  router.delete('/cancel/:jobId', (req, res) => {
    try {
      const jobId = req.params.jobId;
      const cancelled = exportService.cancelBatchExport(jobId);

      if (!cancelled) {
        return res.status(404).json({
          success: false,
          message: 'Job not found or cannot be cancelled',
        });
      }

      res.json({ success: true, message: 'Export cancelled' });
    } catch (error) {
      console.error('Cancel error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}

export default createExportRoutes;
