import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useTimetableStore } from "@/stores/useTimetableStore";
import { useClassStore } from "@/stores/useClassStore";
import { useSubjectStore } from "@/stores/useSubjectStore";
import { useTeacherStore } from "@/stores/useTeacherStore";
import { useRoomStore } from "@/stores/useRoomStore";
import { useWizardStore } from "@/stores/useWizardStore";
import { useLanguageCtx } from "@/i18n/provider";
import { transformToClassSchedule, transformToTeacherSchedule, getTimetableStatistics } from "@/lib/timetableTransform";
import { generateClassSchedulePDF, generateTeacherSchedulePDF } from "@/lib/pdfGenerator";

// Declare window.electron type
declare global {
  interface Window {
    electron?: {
      ipcRenderer?: {
        invoke: (channel: string, payload: any) => Promise<any>;
      };
    };
  }
}

export interface ExportPdfOptions {
  type?: "class" | "teacher";
  ids?: string[];
  filename?: string;
  orientation?: "landscape" | "portrait";
  compact?: boolean;
  includeEmpty?: boolean;
  preview?: boolean;
}

export interface ExportProgress {
  current: number;
  total: number;
  filename: string;
  stage?: "loading" | "generating" | "saving" | "complete";
}

export interface ExportResult {
  status: "success" | "error";
  path?: string;
  filename?: string;
  message?: string;
  results?: ExportResult[];
  count?: number;
}

export function useExportPdf() {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);

  // Get data from stores
  const { currentTimetable } = useTimetableStore();
  const { classes } = useClassStore();
  const { subjects } = useSubjectStore();
  const { teachers } = useTeacherStore();
  const { rooms } = useRoomStore();
  const { schoolInfo, periodsInfo } = useWizardStore();
  const { language } = useLanguageCtx();

  const exportPdf = useCallback(async (options: ExportPdfOptions): Promise<ExportResult> => {
    try {
      console.log("[useExportPdf] Starting export with options:", options);
      console.log("[useExportPdf] Current data:", {
        timetableLength: currentTimetable?.length || 0,
        classesCount: classes.length,
        subjectsCount: subjects.length,
        teachersCount: teachers.length,
        roomsCount: rooms.length,
      });

      setIsExporting(true);
      setProgress({
        current: 0,
        total: 100,
        filename: options.filename || "timetable.pdf",
        stage: "loading",
      });

      // Get timetable data - try store first, then localStorage as fallback
      let timetableData = currentTimetable;
      
      if (!timetableData || timetableData.length === 0) {
        console.log("[useExportPdf] Store timetable is empty, checking localStorage...");
        try {
          const storedTimetable = localStorage.getItem("generatedTimetable");
          if (storedTimetable) {
            timetableData = JSON.parse(storedTimetable);
            console.log("[useExportPdf] Loaded timetable from localStorage, length:", timetableData?.length || 0);
          }
        } catch (e) {
          console.error("[useExportPdf] Failed to parse stored timetable:", e);
        }
      }

      // Validate data
      if (!timetableData || timetableData.length === 0) {
        const error = "No timetable data available. Please generate a timetable first.";
        console.error("[useExportPdf] Validation error:", error);
        throw new Error(error);
      }

      if (classes.length === 0 || subjects.length === 0 || teachers.length === 0 || rooms.length === 0) {
        const error = "Missing required data. Please ensure all entities (classes, subjects, teachers, rooms) are loaded.";
        console.error("[useExportPdf] Validation error:", error);
        throw new Error(error);
      }

      const type = options.type || "class";
      const ids = options.ids || [];
      const orientation = options.orientation || "landscape";
      const compact = options.compact || false;
      const includeEmpty = options.includeEmpty !== false;
      const schoolName = schoolInfo?.schoolName || "";

      // Update progress
      setProgress({
        current: 20,
        total: 100,
        filename: options.filename || "timetable.pdf",
        stage: "generating",
      });

      // Transform timetable data
      let schedules: any[];
      if (type === "class") {
        schedules = transformToClassSchedule(
          timetableData,
          classes,
          subjects,
          teachers,
          rooms
        );
        // Filter by IDs if provided
        if (ids.length > 0) {
          schedules = schedules.filter((s) => ids.includes(s.classId));
        }
      } else {
        schedules = transformToTeacherSchedule(
          timetableData,
          teachers,
          classes,
          subjects,
          rooms
        );
        // Filter by IDs if provided
        if (ids.length > 0) {
          schedules = schedules.filter((s) => ids.includes(s.teacherId));
        }
      }

      if (schedules.length === 0) {
        throw new Error(`No ${type} schedules found matching the selected criteria.`);
      }

      // Calculate statistics
      const statistics = getTimetableStatistics(timetableData);

      // Generate PDF
      console.log("[useExportPdf] Generating PDF for", schedules.length, "schedules");
      setProgress({
        current: 40,
        total: 100,
        filename: options.filename || "timetable.pdf",
        stage: "generating",
      });

      let pdfBlob: Blob;
      try {
        if (type === "class") {
          console.log("[useExportPdf] Generating class schedule PDF");
          pdfBlob = await generateClassSchedulePDF(schedules, {
            orientation,
            compact,
            includeEmpty,
            schoolName,
            periodsInfo,
            language: language === "fa" ? "fa" : "en",
            statistics,
          });
        } else {
          console.log("[useExportPdf] Generating teacher schedule PDF");
          pdfBlob = await generateTeacherSchedulePDF(schedules, {
            orientation,
            compact,
            includeEmpty,
            schoolName,
            periodsInfo,
            language: language === "fa" ? "fa" : "en",
            statistics,
          });
        }
        console.log("[useExportPdf] PDF generated successfully, size:", pdfBlob.size, "bytes");
      } catch (pdfError) {
        console.error("[useExportPdf] PDF generation error:", pdfError);
        throw new Error(`Failed to generate PDF: ${pdfError instanceof Error ? pdfError.message : String(pdfError)}`);
      }

      setProgress({
        current: 80,
        total: 100,
        filename: options.filename || "timetable.pdf",
        stage: "saving",
      });

      // Save PDF using Electron dialog
      if (!window.electron?.ipcRenderer) {
        // Fallback for web environment: download directly
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = options.filename || "timetable.pdf";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setIsExporting(false);
        setProgress(null);
        toast.success(`PDF exported successfully: ${options.filename || "timetable.pdf"}`);
        return {
          status: "success",
          filename: options.filename || "timetable.pdf",
        };
      }

      // Use Electron save dialog
      const filename = options.filename || "timetable.pdf";
      const result = await window.electron.ipcRenderer.invoke("save-pdf-dialog", {
        filename,
        defaultPath: filename,
      });

      if (result.canceled) {
        setIsExporting(false);
        setProgress(null);
        return {
          status: "error",
          message: "Save cancelled by user",
        };
      }

      const savePath = result.filePath;
      
      // Convert blob to array buffer and save
      const arrayBuffer = await pdfBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Save file using Electron fs (via IPC)
      // Convert Uint8Array to regular array for IPC serialization
      await window.electron.ipcRenderer.invoke("save-pdf-file", {
        path: savePath,
        data: Array.from(uint8Array),
      });

      // Open PDF if requested
      if (!options.preview) {
        await window.electron.ipcRenderer.invoke("open-pdf", savePath);
      }

      setProgress({
        current: 100,
        total: 100,
        filename: options.filename || "timetable.pdf",
        stage: "complete",
      });

      setIsExporting(false);
      setProgress(null);

      toast.success(`PDF exported successfully: ${filename}`);
      return {
        status: "success",
        path: savePath,
        filename,
      };
    } catch (error) {
      setIsExporting(false);
      setProgress(null);
      
      const errorMessage = error instanceof Error ? error.message : "Failed to export PDF";
      toast.error(errorMessage);
      
      return {
        status: "error",
        message: errorMessage,
      };
    }
  }, [currentTimetable, classes, subjects, teachers, rooms, schoolInfo, periodsInfo, language]);

  const exportBatch = useCallback(async (jobs: ExportPdfOptions[]): Promise<ExportResult> => {
    // For batch export, we'll export all as a single PDF
    // This matches the current behavior where all selected items go into one PDF
    const firstJob = jobs[0];
    if (!firstJob) {
      return {
        status: "error",
        message: "No export jobs provided",
      };
    }

    // Combine all IDs from all jobs
    const allIds = jobs.flatMap((job) => job.ids || []);
    
    // Use the first job's options for the combined export
    return exportPdf({
      ...firstJob,
      ids: allIds,
      filename: firstJob.filename || "timetable.pdf",
    });
  }, [exportPdf]);

  return {
    exportPdf,
    exportBatch,
    isExporting,
    progress,
  };
}

