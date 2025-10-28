import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ClassGroup } from "@/types"
import { z } from "zod"
import { classFormSchema } from "@/schemas/classSchema"

interface ClassFormProps {
  classGroup?: ClassGroup
  onSubmit: (classGroup: Omit<ClassGroup, 'id'> | ClassGroup) => void
  onCancel: () => void
}

export function ClassForm({ classGroup, onSubmit, onCancel }: ClassFormProps) {
  const [formData, setFormData] = useState({
    name: classGroup?.name || "",
    studentCount: classGroup?.studentCount || 20,
    subjectRequirements: classGroup?.subjectRequirements || [],
  })
  
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    const newValue = name === "studentCount" ? Number(value) : value
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
      classFormSchema.parse(formData)
      
      // Submit form
      if (classGroup) {
        onSubmit({ ...formData, id: classGroup.id })
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
        <CardTitle>{classGroup ? "Edit Class" : "Add Class"}</CardTitle>
        <CardDescription>
          {classGroup 
            ? "Edit the class's information" 
            : "Enter the new class's information"}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Class Name</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter class name"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="studentCount">Student Count</Label>
            <Input
              id="studentCount"
              name="studentCount"
              type="number"
              value={formData.studentCount}
              onChange={handleChange}
            />
            {errors.studentCount && (
              <p className="text-sm text-destructive">{errors.studentCount}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">
            {classGroup ? "Update Class" : "Add Class"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}