import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Room } from "@/types"
import { z } from "zod"
import { roomFormSchema } from "@/schemas/roomSchema"

interface RoomFormProps {
  room?: Room
  onSubmit: (room: Omit<Room, 'id'> | Room) => void
  onCancel: () => void
}

export function RoomForm({ room, onSubmit, onCancel }: RoomFormProps) {
  const [formData, setFormData] = useState({
    name: room?.name || "",
    capacity: room?.capacity || 20,
    type: room?.type || "Classroom",
    features: room?.features || [],
  })
  
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    const newValue = name === "capacity" ? Number(value) : value
    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }))
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      // Validate form data
      roomFormSchema.parse(formData)
      
      // Submit form
      if (room) {
        onSubmit({ ...formData, id: room.id })
      } else {
        onSubmit(formData)
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {}
        error.errors.forEach(err => {
          if (err.path[0]) {
            fieldErrors[err.path[0]] = err.message
          }
        })
        setErrors(fieldErrors)
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{room ? "Edit Room" : "Add Room"}</CardTitle>
        <CardDescription>
          {room 
            ? "Edit the room's information" 
            : "Enter the new room's information"}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Room Name</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter room name"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="capacity">Capacity</Label>
            <Input
              id="capacity"
              name="capacity"
              type="number"
              value={formData.capacity}
              onChange={handleChange}
            />
            {errors.capacity && (
              <p className="text-sm text-destructive">{errors.capacity}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="type">Room Type</Label>
            <Input
              id="type"
              name="type"
              value={formData.type}
              onChange={handleChange}
              placeholder="Enter room type"
            />
            {errors.type && (
              <p className="text-sm text-destructive">{errors.type}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">
            {room ? "Update Room" : "Add Room"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}