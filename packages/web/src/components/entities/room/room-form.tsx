import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Room } from "@/types"
import { z } from "zod"
import { roomFormSchema } from "@/schemas/roomSchema"
import { cn } from "@/lib/utils/tailwaindMergeUtil"
import { Save, X } from "lucide-react"

interface RoomFormProps {
  room?: Room
  onSubmit: (room: Omit<Room, 'id'> | Room) => void
  onCancel: () => void
  isRTL?: boolean
}

// Common room types
const COMMON_ROOM_TYPES_EN = [
  "Regular",
  "Chemistry Lab",
  "Physics Lab",
  "Computer Lab",
  "Biology Lab",
  "Assembly Hall",
  "Library",
  "Gymnasium",
];

const COMMON_ROOM_TYPES_FA = [
  "عادی",
  "آزمایشگاه کیمیا",
  "آزمایشگاه فزیک",
  "آزمایشگاه کمپیوتر",
  "آزمایشگاه بیولوژی",
  "سالن بزرگ",
  "کتابخانه",
  "سالن ورزشی",
];

export function RoomForm({ room, onSubmit, onCancel, isRTL = false }: RoomFormProps) {
  const [formData, setFormData] = useState({
    name: room?.name || "",
    capacity: room?.capacity || 30,
    type: room?.type || "",
    features: room?.features || [],
    unavailable: room?.unavailable || [],
  })
  
  const [errors, setErrors] = useState<Record<string, string>>({})
  const commonRoomTypes = isRTL ? COMMON_ROOM_TYPES_FA : COMMON_ROOM_TYPES_EN;

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
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        {/* Room Name */}
        <div className="space-y-2">
          <Label htmlFor="name" className={cn(isRTL && "text-right block")}>
            {isRTL ? "نام کلاس" : "Room Name"} <span className="text-red-500">*</span>
          </Label>
          <Input
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder={isRTL ? "مثال: کلاس 101" : "e.g., Room 101"}
            className={cn(isRTL && "text-right")}
          />
          {errors.name && (
            <p className={cn("text-sm text-destructive", isRTL && "text-right")}>{errors.name}</p>
          )}
        </div>

        {/* Room Type */}
        <div className="space-y-2">
          <Label htmlFor="type" className={cn(isRTL && "text-right block")}>
            {isRTL ? "نوع کلاس" : "Room Type"} <span className="text-red-500">*</span>
          </Label>
          <Input
            id="type"
            name="type"
            value={formData.type}
            onChange={handleChange}
            placeholder={isRTL ? "انتخاب یا نوشتن نوع کلاس" : "Select or type room type"}
            list="room-types"
            className={cn(isRTL && "text-right")}
          />
          <datalist id="room-types">
            {commonRoomTypes.map(type => (
              <option key={type} value={type} />
            ))}
          </datalist>
          {errors.type && (
            <p className={cn("text-sm text-destructive", isRTL && "text-right")}>{errors.type}</p>
          )}
        </div>

        {/* Capacity */}
        <div className="space-y-2">
          <Label htmlFor="capacity" className={cn(isRTL && "text-right block")}>
            {isRTL ? "ظرفیت" : "Capacity"} <span className="text-red-500">*</span>
          </Label>
          <Input
            id="capacity"
            name="capacity"
            type="number"
            value={formData.capacity}
            onChange={handleChange}
            placeholder={isRTL ? "تعداد دانش‌آموزان" : "Number of students"}
            min="1"
            max="1000"
            className={cn(isRTL && "text-right")}
          />
          {errors.capacity && (
            <p className={cn("text-sm text-destructive", isRTL && "text-right")}>{errors.capacity}</p>
          )}
        </div>

        {/* Help Text */}
        <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-md">
          <p className={cn("text-sm text-blue-900 dark:text-blue-100", isRTL && "text-right")}>
            {isRTL 
              ? "همه فیلدهای علامت‌دار با * الزامی هستند."
              : "All fields marked with * are required."}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className={cn(
        "flex gap-3 pt-4 border-t",
        isRTL ? "flex-row" : ""
      )}>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className={cn("flex-1", isRTL && "flex-row")}
        >
          <X className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
          {isRTL ? "لغو" : "Cancel"}
        </Button>
        <Button
          type="submit"
          className={cn("flex-1", isRTL && "flex-row")}
        >
          <Save className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
          {room ? (isRTL ? "بروزرسانی" : "Update") : (isRTL ? "ذخیره" : "Save")}
        </Button>
      </div>
    </form>
  )
}