import React from "react";
import { Teacher } from "@/types";
import { TeacherEditModal } from "@/components/wizard/steps/teachers/TeacherEditModal";
import { useSubjectStore } from "@/stores/useSubjectStore";
import { useClassStore } from "@/stores/useClassStore";
import { useWizardStore } from "@/stores/useWizardStore";
import { useTeacherStore } from "@/stores/useTeacherStore";

interface TeacherFormWrapperProps {
  open: boolean;
  onClose: () => void;
  teacher: Teacher | null;
  onSave: (teacher: Omit<Teacher, "id"> & { id?: string }) => Promise<void>;
}

export function TeacherFormWrapper({ open, onClose, teacher, onSave }: TeacherFormWrapperProps) {
  const { subjects } = useSubjectStore();
  const { classes } = useClassStore();
  const { schoolInfo, periodsInfo } = useWizardStore();
  const { teachers } = useTeacherStore();

  return (
    <TeacherEditModal
      open={open}
      onClose={onClose}
      teacher={teacher}
      subjects={subjects}
      classes={classes}
      schoolInfo={schoolInfo}
      periodsInfo={periodsInfo}
      onSave={onSave}
    />
  );
}

