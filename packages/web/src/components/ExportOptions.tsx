import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useExportPdf, ExportPdfOptions } from "@/hooks/useExportPdf";
import { useLanguageCtx } from "@/i18n/provider";
import { FileDown } from "lucide-react";
import { toast } from "sonner";

interface ExportOptionsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type?: "class" | "teacher";
  items?: Array<{ id: string; name: string }>;
  defaultIds?: string[];
}

export function ExportOptions({
  open,
  onOpenChange,
  type = "class",
  items = [],
  defaultIds = [],
}: ExportOptionsProps) {
  const { t, isRTL } = useLanguageCtx();
  const { exportPdf, isExporting, progress } = useExportPdf();

  // Load saved preferences from localStorage
  const [prefs, setPrefs] = useState<ExportPdfOptions>(() => {
    try {
      const saved = localStorage.getItem("printPrefs");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      // Ignore parse errors
    }
    return {
      orientation: "landscape",
      compact: false,
      includeEmpty: true,
      type: type,
      ids: defaultIds,
    };
  });

  // Save preferences to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem("printPrefs", JSON.stringify(prefs));
    } catch (e) {
      // Ignore save errors
    }
  }, [prefs]);

  const [selectedIds, setSelectedIds] = useState<string[]>(defaultIds);
  const [exportRange, setExportRange] = useState<"all" | "selected">(
    defaultIds.length > 0 ? "selected" : "all"
  );
  const [showProgress, setShowProgress] = useState(false);
  const [completedPaths, setCompletedPaths] = useState<string[]>([]);

  // Update selectedIds when exportRange changes
  useEffect(() => {
    if (exportRange === "all") {
      setSelectedIds(items.map((item) => item.id));
    } else if (exportRange === "selected" && defaultIds.length > 0) {
      setSelectedIds(defaultIds);
    }
  }, [exportRange, items, defaultIds]);

  const handleExport = async () => {
    if (selectedIds.length === 0) {
      toast.error("Please select at least one item to export.");
      return;
    }

    console.log("[ExportOptions] Starting export with:", {
      type,
      selectedIds,
      exportRange,
      prefs,
      itemsCount: items.length,
    });

    setShowProgress(true);
    setCompletedPaths([]);

    try {
      // Always export as single PDF (all selected IDs in one file)
      const filename = exportRange === "all" 
        ? `all_${type}_schedules.pdf`
        : selectedIds.length === 1
        ? `${items.find((i) => i.id === selectedIds[0])?.name || "timetable"}.pdf`
        : `selected_${type}_schedules.pdf`;

      console.log("[ExportOptions] Calling exportPdf with:", {
        ...prefs,
        type: type,
        ids: selectedIds,
        filename: filename,
      });

      const result = await exportPdf({
        ...prefs,
        type: type,
        ids: selectedIds, // Export all selected IDs in one PDF
        filename: filename,
      });

      console.log("[ExportOptions] Export result:", result);

      if (result.status === "success") {
        if (result.path) {
          setCompletedPaths([result.path]);
        }
        
        // PDF opening is handled in useExportPdf hook
        // Auto-close dialog after a short delay
        setTimeout(() => {
          setShowProgress(false);
          setCompletedPaths([]);
          onOpenChange(false);
        }, 1500);
      } else {
        // Show error message
        const errorMsg = result?.message || "Failed to export PDF. Check console for details.";
        toast.error(errorMsg);
        console.error("[ExportOptions] Export failed:", result);
        setShowProgress(false);
      }
    } catch (error) {
      console.error("[ExportOptions] Export error:", error);
      const errorMsg = error instanceof Error ? error.message : "Failed to export PDF. Check console for details.";
      toast.error(errorMsg);
      setShowProgress(false);
    }
  };

  const handlePreview = async () => {
    if (selectedIds.length === 0) {
      return;
    }

    await exportPdf({
      ...prefs,
      type: type,
      ids: selectedIds,
      preview: true,
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{t.actions.exportPdf || "Export PDF"}</DialogTitle>
            <DialogDescription>
              {t.actions.exportPdfDescription || "Configure export settings and select items to export"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Export Range */}
            <div className="space-y-2">
              <Label>{t.actions.exportRange || "Export Range"}</Label>
              <Select
                value={exportRange}
                onValueChange={(value) => setExportRange(value as "all" | "selected")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t.actions.exportAll || "All"} ({items.length})
                  </SelectItem>
                  <SelectItem value="selected">
                    {t.actions.exportSelected || "Selected"} ({selectedIds.length})
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Selection (if range is selected) */}
            {exportRange === "selected" && (
              <div className="space-y-2">
                <Label>{type === "class" ? t.schedule.classes || "Classes" : t.schedule.teachers || "Teachers"}</Label>
                <div className="max-h-48 overflow-y-auto border rounded-md p-3 space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={item.id}
                        checked={selectedIds.includes(item.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedIds([...selectedIds, item.id]);
                          } else {
                            setSelectedIds(selectedIds.filter((id) => id !== item.id));
                          }
                        }}
                      />
                      <Label
                        htmlFor={item.id}
                        className="flex-1 cursor-pointer"
                      >
                        {item.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Orientation */}
            <div className="space-y-2">
              <Label>{t.actions.orientation || "Orientation"}</Label>
              <Select
                value={prefs.orientation || "landscape"}
                onValueChange={(value) =>
                  setPrefs({ ...prefs, orientation: value as "landscape" | "portrait" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="landscape">{t.actions.landscape || "Landscape"}</SelectItem>
                  <SelectItem value="portrait">{t.actions.portrait || "Portrait"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Options */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="compact"
                  checked={prefs.compact || false}
                  onCheckedChange={(checked) =>
                    setPrefs({ ...prefs, compact: checked as boolean })
                  }
                />
                <Label htmlFor="compact" className="cursor-pointer">
                  {t.actions.compactMode || "Compact Mode"}
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeEmpty"
                  checked={prefs.includeEmpty !== false}
                  onCheckedChange={(checked) =>
                    setPrefs({ ...prefs, includeEmpty: checked as boolean })
                  }
                />
                <Label htmlFor="includeEmpty" className="cursor-pointer">
                  {t.actions.includeEmptyPeriods || "Include Empty Periods"}
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
              {t.actions.cancel || "Cancel"}
            </Button>
            <Button variant="outline" onClick={handlePreview} disabled={isExporting || selectedIds.length === 0}>
              <FileDown className="mr-2 h-4 w-4" />
              {t.actions.preview || "Preview"}
            </Button>
            <Button onClick={handleExport} disabled={isExporting || selectedIds.length === 0}>
              <FileDown className="mr-2 h-4 w-4" />
              {isExporting
                ? t.actions.exporting || "Exporting..."
                : t.actions.export || "Export"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Progress Dialog */}
      <Dialog open={showProgress} onOpenChange={() => {}}>
        <DialogContent className="max-w-md" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isExporting ? (
                <>
                  <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  {t.actions.exporting || "Exporting PDF..."}
                </>
              ) : (
                <>
                  <div className="h-4 w-4 rounded-full bg-green-500" />
                  {t.actions.exportComplete || "Export Complete!"}
                </>
              )}
            </DialogTitle>
            <DialogDescription asChild>
              <div>
                {isExporting ? (
                  progress ? (
                    <div className="space-y-2 mt-2">
                      <div className="font-medium">
                        {progress.stage === "loading" && (t.actions.loadingPage || "Loading data...")}
                        {progress.stage === "generating" && (t.actions.generatingPdf || "Generating PDF...")}
                        {progress.stage === "saving" && (t.actions.savingPdf || "Saving PDF...")}
                        {progress.stage === "complete" && (t.actions.complete || "Complete!")}
                        {!progress.stage && (t.actions.processing || "Processing...")}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {progress.filename || t.actions.exporting || "Exporting..."}
                      </div>
                    </div>
                  ) : (
                    <span>{t.actions.preparing || "Preparing export..."}</span>
                  )
                ) : completedPaths.length > 0 ? (
                  <span className="text-green-600 dark:text-green-400">
                    {t.actions.pdfReady || "PDF has been generated and opened successfully!"}
                  </span>
                ) : (
                  <span>{t.actions.preparing || "Preparing export..."}</span>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>

          {isExporting && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-500 ease-out rounded-full shadow-sm"
                    style={{ 
                      width: progress 
                        ? `${Math.min(Math.max((progress.current / progress.total) * 100, 0), 100)}%` 
                        : "10%"
                    }}
                  />
                </div>
                {progress && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{t.actions.progress || "Progress"}: {Math.round(Math.min(Math.max((progress.current / progress.total) * 100, 0), 100))}%</span>
                    <span>{progress.stage === "complete" ? "✓ Complete" : progress.stage || "Processing"}</span>
                  </div>
                )}
              </div>
              
              {!progress && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
                  <span>{t.actions.initializing || "Initializing..."}</span>
                </div>
              )}
            </div>
          )}

          {!isExporting && completedPaths.length === 0 && (
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowProgress(false);
                setCompletedPaths([]);
                onOpenChange(false);
              }}>
                {t.actions.close || "Close"}
              </Button>
            </DialogFooter>
          )}
          
          {!isExporting && completedPaths.length > 0 && (
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowProgress(false);
                setCompletedPaths([]);
                onOpenChange(false);
              }}>
                {t.actions.close || "Close"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

