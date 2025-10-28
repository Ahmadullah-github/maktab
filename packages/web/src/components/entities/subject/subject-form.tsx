import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Subject } from "@/types"
import { z } from "zod"
import { subjectFormSchema } from "@/schemas/subjectSchema"
import { Switch } from "@/components/ui/switch"

interface SubjectFormProps {
  subject?: Subject
  onSubmit: (subject: Omit<Subject, 'id'> | Subject) => void
  onCancel: () => void
}

export function SubjectForm({ subject, onSubmit, onCancel }: SubjectFormProps) {
  const [formData, setFormData] = useState({
    name: subject?.name || "",
    code: subject?.code || "",
    isDifficult: subject?.isDifficult || false,
    requiredRoomType: subject?.requiredRoomType || "",
  })
  
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target
    const checked = type === "checkbox" ? (e.target as HTMLInputElement).checked : undefined
    
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
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
      subjectFormSchema.parse(formData)
      
      // Submit form
      if (subject) {
        onSubmit({ ...formData, id: subject.id })
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
        <CardTitle>{subject ? "Edit Subject" : "Add Subject"}</CardTitle>
        <CardDescription>
          {subject 
            ? "Edit the subject's information" 
            : "Enter the new subject's information"}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Subject Name</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter subject name"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="code">Subject Code</Label>
            <Input
              id="code"
              name="code"
              value={formData.code}
              onChange={handleChange}
              placeholder="Enter subject code (optional)"
            />
            {errors.code && (
              <p className="text-sm text-destructive">{errors.code}</p>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="isDifficult"
              name="isDifficult"
              checked={formData.isDifficult}
              onCheckedChange={(checked) => 
                setFormData(prev => ({ ...prev, isDifficult: checked }))
              }
            />
            <Label htmlFor="isDifficult">Difficult Subject</Label>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="requiredRoomType">Required Room Type</Label>
            <Input
              id="requiredRoomType"
              name="requiredRoomType"
              value={formData.requiredRoomType}
              onChange={handleChange}
              placeholder="Enter required room type (optional)"
            />
            {errors.requiredRoomType && (
              <p className="text-sm text-destructive">{errors.requiredRoomType}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">
            {subject ? "Update Subject" : "Add Subject"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}