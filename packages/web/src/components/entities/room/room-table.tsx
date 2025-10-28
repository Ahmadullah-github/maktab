import React from "react"
import { DataTable } from "@/components/common/data-table"
import { Button } from "@/components/ui/button"
import { Room } from "@/types"
import { Pencil, Trash2 } from "lucide-react"
import { ConfirmDialog } from "@/components/common/confirm-dialog"

interface RoomTableProps {
  rooms: Room[]
  onEdit: (room: Room) => void
  onDelete: (roomId: string) => void
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
    key: "capacity",
    title: "Capacity",
  },
  {
    key: "type",
    title: "Type",
  },
  {
    key: "features",
    title: "Features",
    render: (room: Room) => (
      <span>
        {room.features && room.features.length > 0
          ? room.features.join(", ")
          : "None"}
      </span>
    ),
  },
]

export function RoomTable({
  rooms,
  onEdit,
  onDelete,
  currentPage,
  totalPages,
  onPageChange,
  onSearch,
}: RoomTableProps) {
  const columnsWithActions = [
    ...columns,
    {
      key: "actions",
      title: "Actions",
      render: (room: Room) => (
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation() // جلوگیری از کلیک روی ردیف
              onEdit(room)
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>

          <ConfirmDialog
            title="Delete Room"
            description={`Are you sure you want to delete ${room.name}? This action cannot be undone.`}
            onConfirm={() => onDelete(room.id)}
          >
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => e.stopPropagation()} // جلوگیری از اجرای onRowClick
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </ConfirmDialog>
        </div>
      ),
    },
  ]

  // ✅ هندل کردن کلیک روی ردیف‌ها با جلوگیری از تریگر شدن داخل دکمه
  const handleRowClick = (e: React.MouseEvent, room: Room) => {
    // اگر کلیک روی دکمه یا فرزند دکمه بود، نادیده بگیر
    if ((e.target as HTMLElement).closest("button")) return
    onEdit(room)
  }

  return (
    <DataTable
      data={rooms}
      columns={columnsWithActions}
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={onPageChange}
      onSearch={onSearch}
      // ✅ اینجا کنترل می‌کنیم که کلیک روی دکمه‌ها باعث اجرا نشود
      onRowClick={(room: Room, e: React.MouseEvent) => handleRowClick(e, room)}
    />
  )
}
