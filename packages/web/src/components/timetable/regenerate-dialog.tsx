import React, { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Save } from "lucide-react";
import { useLanguageCtx } from "@/i18n/provider";

interface RegenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (saveToHistory: boolean) => void;
  hasTimetable: boolean;
  isRTL?: boolean;
}

export function RegenerateDialog({
  open,
  onOpenChange,
  onConfirm,
  hasTimetable,
  isRTL = false,
}: RegenerateDialogProps) {
  const { t } = useLanguageCtx();
  const [saveToHistory, setSaveToHistory] = useState(true);

  const handleConfirm = () => {
    onConfirm(saveToHistory);
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent dir={isRTL ? "rtl" : "ltr"}>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Regenerate Timetable?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            {hasTimetable ? (
              <>
                <p>
                  This will replace your current timetable with a newly generated one.
                  Are you sure you want to continue?
                </p>
                <div className="flex items-start space-x-2 pt-2">
                  <Checkbox
                    id="save-history"
                    checked={saveToHistory}
                    onCheckedChange={(checked) => setSaveToHistory(checked === true)}
                    className="mt-1"
                  />
                  <label
                    htmlFor="save-history"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    Save current timetable to history before regenerating
                  </label>
                </div>
              </>
            ) : (
              <p>
                A new timetable will be generated based on your current configuration.
                This may take a few moments.
              </p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {hasTimetable ? "Regenerate" : "Generate Timetable"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

