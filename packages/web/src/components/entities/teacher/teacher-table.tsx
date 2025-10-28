import React from "react";
import { DataTable } from "@/components/common/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Teacher } from "@/types";
import { Pencil, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";

interface TeacherTableProps {
  teachers: Teacher[];
  onEdit: (teacher: Teacher) => void;
  onDelete: (teacherId: string) => void;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  onSearch?: (query: string) => void;
}

const columns = [
  { key: "fullName", title: "Name" },
  { key: "maxPeriodsPerWeek", title: "Max Periods/Week" },
  { key: "maxPeriodsPerDay", title: "Max Periods/Day" },
  {
    key: "timePreference",
    title: "Time Preference",
    render: (teacher: Teacher) => (
      <Badge
        variant={teacher.timePreference === "None" ? "secondary" : "default"}
      >
        {teacher.timePreference}
      </Badge>
    ),
  },
  {
    key: "primarySubjectIds",
    title: "Primary Subjects",
    render: (teacher: Teacher) => (
      <span>{teacher.primarySubjectIds.length}</span>
    ),
  },
];

export function TeacherTable({
  teachers,
  onEdit,
  onDelete,
  currentPage,
  totalPages,
  onPageChange,
  onSearch,
}: TeacherTableProps) {
  const columnsWithActions = [
    ...columns,
    {
      key: "actions",
      title: "Actions",
      render: (teacher: Teacher) => (
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(teacher);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>

          <ConfirmDialog
            title="Delete Teacher"
            description={`Are you sure you want to delete ${teacher.fullName}? This action cannot be undone.`}
            onConfirm={() => onDelete(teacher.id)}
          >
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => e.stopPropagation()}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </ConfirmDialog>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      data={teachers}
      columns={columnsWithActions}
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={onPageChange}
      onSearch={onSearch}
      // ✅ امضا با دو آرگومان (teacher, e)
      onRowClick={(teacher, e) => {
        if ((e.target as HTMLElement).closest("button")) return; // جلوگیری از کلیک دکمه
        onEdit(teacher);
      }}
    />
  );
}
