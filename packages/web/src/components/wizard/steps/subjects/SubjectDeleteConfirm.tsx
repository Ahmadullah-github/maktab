import React from "react";
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
import { useLanguageCtx } from "@/i18n/provider";
import { AlertTriangle } from "lucide-react";

interface SubjectDeleteConfirmProps {
  open: boolean;
  onClose: () => void;
  subjectName: string;
  grade: number;
  onConfirm: () => Promise<void>;
}

export function SubjectDeleteConfirm({ open, onClose, subjectName, grade, onConfirm }: SubjectDeleteConfirmProps) {
  const { t } = useLanguageCtx();
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error("Delete failed:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900 rounded-full">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <AlertDialogTitle>{t.common.subjectDialog?.deleteTitle || "Delete Subject?"}</AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            {t.common.subjectDialog?.deleteDescription?.replace("{{name}}", subjectName).replace("{{grade}}", grade.toString()) || `Are you sure you want to delete ${subjectName} from Grade ${grade}?`}
            <br />
            <span className="text-red-600 font-medium mt-2 block">
              {t.common.subjectDialog?.deleteWarning || "This action cannot be undone. Any classes using this subject will have it removed."}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>{t.actions?.cancel || "Cancel"}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isDeleting ? (t.common.subjectDialog?.deleting || "Deleting...") : (t.common.subjectDialog?.deleteAction || "Delete Subject")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

