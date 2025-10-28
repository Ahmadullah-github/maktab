import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Teacher } from "@/types"
import { z } from "zod"
import { teacherFormSchema } from "@/schemas/teacherSchema"

interface TeacherFormProps {
  teacher?: Teacher
  onSubmit: (teacher: Omit<Teacher, 'id'> | Teacher) => void
  onCancel: () => void
}

export function TeacherForm({ teacher, onSubmit, onCancel }: TeacherFormProps) {
  const [formData, setFormData] = useState({
    fullName: teacher?.fullName || "",
    maxPeriodsPerWeek: teacher?.maxPeriodsPerWeek || 20,
    maxPeriodsPerDay: teacher?.maxPeriodsPerDay || 6,
    timePreference: teacher?.timePreference || "None",
    primarySubjectIds: teacher?.primarySubjectIds || [],
  })
  
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name.includes("max") ? Number(value) : value
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
      teacherFormSchema.parse(formData)
      
      // Submit form
      if (teacher) {
        onSubmit({ ...formData, id: teacher.id })
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
        <CardTitle>{teacher ? "Edit Teacher" : "Add Teacher"}</CardTitle>
        <CardDescription>
          {teacher 
            ? "Edit the teacher's information" 
            : "Enter the new teacher's information"}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              placeholder="Enter teacher's full name"
            />
            {errors.fullName && (
              <p className="text-sm text-destructive">{errors.fullName}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="maxPeriodsPerWeek">Max Periods Per Week</Label>
            <Input
              id="maxPeriodsPerWeek"
              name="maxPeriodsPerWeek"
              type="number"
              min="1"
              max="40"
              value={formData.maxPeriodsPerWeek}
              onChange={handleChange}
            />
            {errors.maxPeriodsPerWeek && (
              <p className="text-sm text-destructive">{errors.maxPeriodsPerWeek}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="maxPeriodsPerDay">Max Periods Per Day</Label>
            <Input
              id="maxPeriodsPerDay"
              name="maxPeriodsPerDay"
              type="number"
              min="1"
              max="10"
              value={formData.maxPeriodsPerDay}
              onChange={handleChange}
            />
            {errors.maxPeriodsPerDay && (
              <p className="text-sm text-destructive">{errors.maxPeriodsPerDay}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="timePreference">Time Preference</Label>
            <select
              id="timePreference"
              name="timePreference"
              value={formData.timePreference}
              onChange={handleChange}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="None">None</option>
              <option value="Morning">Morning</option>
              <option value="Afternoon">Afternoon</option>
            </select>
            {errors.timePreference && (
              <p className="text-sm text-destructive">{errors.timePreference}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">
            {teacher ? "Update Teacher" : "Add Teacher"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}