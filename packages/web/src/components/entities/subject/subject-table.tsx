import React from "react";
import { DataTable } from "@/components/common/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Subject } from "@/types";
import { Pencil, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";

interface SubjectTableProps {
  subjects: Subject[];
  onEdit: (subject: Subject) => void;
  onDelete: (subjectId: string) => void;
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  onSearch?: (query: string) => void;
}

const columns = [
  { key: "name", title: "Name" },
  { key: "code", title: "Code" },
  {
    key: "isDifficult",
    title: "Difficulty",
    render: (subject: Subject) => (
      <Badge variant={subject.isDifficult ? "destructive" : "secondary"}>
        {subject.isDifficult ? "Difficult" : "Normal"}
      </Badge>
    ),
  },
  { key: "requiredRoomType", title: "Required Room" },
];

export function SubjectTable({
  subjects,
  onEdit,
  onDelete,
  currentPage,
  totalPages,
  onPageChange,
  onSearch,
}: SubjectTableProps) {
  const columnsWithActions = [
    ...columns,
    {
      key: "actions",
      title: "Actions",
      render: (subject: Subject) => (
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(subject);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>

          <ConfirmDialog
            title="Delete Subject"
            description={`Are you sure you want to delete ${subject.name}? This action cannot be undone.`}
            onConfirm={() => onDelete(subject.id)}
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
      data={subjects}
      columns={columnsWithActions}
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={onPageChange}
      onSearch={onSearch}
      // ✅ امضای درست: دو آرگومان (subject, e)
      onRowClick={(subject, e) => {
        if ((e.target as HTMLElement).closest("button")) return; // جلوگیری از کلیک دکمه
        onEdit(subject);
      }}
    />
  );
}
