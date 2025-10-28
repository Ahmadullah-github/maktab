import React, { useState, useEffect } from "react"
import { RoomForm } from "@/components/entities/room/room-form"
import { RoomTable } from "@/components/entities/room/room-table"
import { Button } from "@/components/ui/button"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { Room } from "@/types"
import { Plus } from "lucide-react"
import { useRoomStore } from "@/stores/useRoomStore"
import { ErrorDisplay } from "@/components/common/error-display"
import { Loading } from "@/components/common/loading"

export default function RoomsPage() {
  const [showForm, setShowForm] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  
  const { 
    rooms, 
    isLoading, 
    error, 
    fetchRooms, 
    addRoom, 
    updateRoom, 
    deleteRoom 
  } = useRoomStore()
  
  useEffect(() => {
    fetchRooms()
  }, [fetchRooms])
  
  const handleAddRoom = () => {
    setEditingRoom(null)
    setShowForm(true)
  }

  const handleEditRoom = (room: Room) => {
    setEditingRoom(room)
    setShowForm(true)
  }

  const handleDeleteRoom = async (roomId: string) => {
    try {
      await deleteRoom(roomId)
    } catch (err) {
      console.error("Failed to delete room:", err)
    }
  }

  const handleSubmit = async (room: Omit<Room, 'id'> | Room) => {
    try {
      if ('id' in room) {
        await updateRoom(room)
      } else {
        await addRoom(room)
      }
      setShowForm(false)
    } catch (err) {
      console.error("Failed to save room:", err)
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingRoom(null)
  }

  if (isLoading && rooms.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading />
      </div>
    )
  }

  if (error) {
    return (
      <ErrorDisplay 
        title="Error Loading Rooms"
        message={error}
        onRetry={fetchRooms}
      />
    )
  }

  return (
    <div className="space-y-6">
      <Breadcrumb 
        items={[
          { label: "Home", href: "/" },
          { label: "Rooms" }
        ]}
      />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Rooms</h1>
          <p className="text-muted-foreground">
            Manage rooms in your school
          </p>
        </div>
        <Button onClick={handleAddRoom}>
          <Plus className="mr-2 h-4 w-4" />
          Add Room
        </Button>
      </div>
      
      {showForm ? (
        <RoomForm 
          room={editingRoom || undefined}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      ) : (
        <RoomTable
          rooms={rooms}
          onEdit={handleEditRoom}
          onDelete={handleDeleteRoom}
        />
      )}
    </div>
  )
}
