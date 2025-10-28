import React from "react"
import { DataTable } from "@/components/common/data-table"
import { Button } from "@/components/ui/button"
import { ClassGroup } from "@/types"
import { Pencil, Trash2 } from "lucide-react"
import { ConfirmDialog } from "@/components/common/confirm-dialog"

interface ClassTableProps {
  classes: ClassGroup[]
  onEdit: (classGroup: ClassGroup) => void
  onDelete: (classId: string) => void
  currentPage?: number
  totalPages?: number
  onPageChange?: (page: number) => void
  onSearch?: (query: string) => void
}

const columns = [
  {
    key: "name",
    title: "Name",
  },
  {
    key: "studentCount",
    title: "Student Count",
  },
  {
    key: "subjectRequirements",
    title: "Subject Requirements",
    render: (classGroup: ClassGroup) => {
      let count = 0
      if (Array.isArray(classGroup.subjectRequirements)) {
        count = classGroup.subjectRequirements.length
      } else if (
        typeof classGroup.subjectRequirements === "object" &&
        classGroup.subjectRequirements !== null
      ) {
        count = Object.keys(classGroup.subjectRequirements).length
      }
      return <span>{count > 0 ? `${count} subjects` : "None"}</span>
    },
  },
]

export function ClassTable({
  classes,
  onEdit,
  onDelete,
  currentPage,
  totalPages,
  onPageChange,
  onSearch,
}: ClassTableProps) {
  const columnsWithActions = [
    ...columns,
    {
      key: "actions",
      title: "Actions",
      render: (classGroup: ClassGroup) => (
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onEdit(classGroup)
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>

          <ConfirmDialog
            title="Delete Class"
            description={`Are you sure you want to delete ${classGroup.name}? This action cannot be undone.`}
            onConfirm={() => onDelete(classGroup.id)}
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
  ]

  // ✅ جلوگیری از کلیک ناخواسته روی دکمه‌ها
  const handleRowClick = (e: React.MouseEvent, classGroup: ClassGroup) => {
    if ((e.target as HTMLElement).closest("button")) return
    onEdit(classGroup)
  }

  return (
    <DataTable
      data={classes}
      columns={columnsWithActions}
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={onPageChange}
      onSearch={onSearch}
      onRowClick={(classGroup: ClassGroup, e: React.MouseEvent) =>
        handleRowClick(e, classGroup)
      }
    />
  )
}
