import React, { useState, useEffect } from "react"
import { ClassForm } from "@/components/entities/class/class-form"
import { ClassTable } from "@/components/entities/class/class-table"
import { Button } from "@/components/ui/button"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { ClassGroup, Subject } from "@/types"
import { Plus } from "lucide-react"
import { useClassStore } from "@/stores/useClassStore"
import { useSubjectStore } from "@/stores/useSubjectStore"
import { ErrorDisplay } from "@/components/common/error-display"
import { Loading } from "@/components/common/loading"

export default function ClassesPage() {
  const [showForm, setShowForm] = useState(false)
  const [editingClass, setEditingClass] = useState<ClassGroup | null>(null)
  
  const { 
    classes, 
    isLoading: classesLoading, 
    error: classesError, 
    fetchClasses, 
    addClass, 
    updateClass, 
    deleteClass 
  } = useClassStore()
  
  const { 
    subjects, 
    isLoading: subjectsLoading, 
    error: subjectsError, 
    fetchSubjects 
  } = useSubjectStore()
  
  useEffect(() => {
    fetchClasses()
    fetchSubjects()
  }, [fetchClasses, fetchSubjects])
  
  const handleAddClass = () => {
    setEditingClass(null)
    setShowForm(true)
  }

  const handleEditClass = (classGroup: ClassGroup) => {
    setEditingClass(classGroup)
    setShowForm(true)
  }

  const handleDeleteClass = async (classId: string) => {
    try {
      await deleteClass(classId)
    } catch (err) {
      console.error("Failed to delete class:", err)
    }
  }

  const handleSubmit = async (classGroup: Omit<ClassGroup, 'id'> | ClassGroup) => {
    try {
      if ('id' in classGroup) {
        await updateClass(classGroup)
      } else {
        await addClass(classGroup)
      }
      setShowForm(false)
    } catch (err) {
      console.error("Failed to save class:", err)
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingClass(null)
  }

  const isLoading = classesLoading || subjectsLoading
  const error = classesError || subjectsError

  if (isLoading && classes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading />
      </div>
    )
  }

  if (error) {
    return (
      <ErrorDisplay 
        title="Error Loading Classes"
        message={error}
        onRetry={() => {
          fetchClasses()
          fetchSubjects()
        }}
      />
    )
  }

  return (
    <div className="space-y-6">
      <Breadcrumb 
        items={[
          { label: "Home", href: "/" },
          { label: "Classes" }
        ]}
      />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Classes</h1>
          <p className="text-muted-foreground">
            Manage classes in your school
          </p>
        </div>
        <Button onClick={handleAddClass}>
          <Plus className="mr-2 h-4 w-4" />
          Add Class
        </Button>
      </div>
      
      {showForm ? (
        <ClassForm 
          classGroup={editingClass || undefined}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      ) : (
        <ClassTable
          classes={classes}
          onEdit={handleEditClass}
          onDelete={handleDeleteClass}
        />
      )}
    </div>
  )
}
