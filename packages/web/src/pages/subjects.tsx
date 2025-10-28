import React, { useState, useEffect } from "react"
import { SubjectForm } from "@/components/entities/subject/subject-form"
import { SubjectTable } from "@/components/entities/subject/subject-table"
import { Button } from "@/components/ui/button"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { Subject } from "@/types"
import { Plus } from "lucide-react"
import { useSubjectStore } from "@/stores/useSubjectStore"
import { ErrorDisplay } from "@/components/common/error-display"
import { Loading } from "@/components/common/loading"

export default function SubjectsPage() {
  const [showForm, setShowForm] = useState(false)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  
  const { 
    subjects, 
    isLoading, 
    error, 
    fetchSubjects, 
    addSubject, 
    updateSubject, 
    deleteSubject 
  } = useSubjectStore()
  
  useEffect(() => {
    fetchSubjects()
  }, [fetchSubjects])
  
  const handleAddSubject = () => {
    setEditingSubject(null)
    setShowForm(true)
  }

  const handleEditSubject = (subject: Subject) => {
    setEditingSubject(subject)
    setShowForm(true)
  }

  const handleDeleteSubject = async (subjectId: string) => {
    try {
      await deleteSubject(subjectId)
    } catch (err) {
      console.error("Failed to delete subject:", err)
    }
  }

  const handleSubmit = async (subject: Omit<Subject, 'id'> | Subject) => {
    try {
      if ('id' in subject) {
        await updateSubject(subject)
      } else {
        await addSubject(subject)
      }
      setShowForm(false)
    } catch (err) {
      console.error("Failed to save subject:", err)
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingSubject(null)
  }

  if (isLoading && subjects.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading />
      </div>
    )
  }

  if (error) {
    return (
      <ErrorDisplay 
        title="Error Loading Subjects"
        message={error}
        onRetry={fetchSubjects}
      />
    )
  }

  return (
    <div className="space-y-6">
      <Breadcrumb 
        items={[
          { label: "Home", href: "/" },
          { label: "Subjects" }
        ]}
      />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Subjects</h1>
          <p className="text-muted-foreground">
            Manage subjects in your school
          </p>
        </div>
        <Button onClick={handleAddSubject}>
          <Plus className="mr-2 h-4 w-4" />
          Add Subject
        </Button>
      </div>
      
      {showForm ? (
        <SubjectForm 
          subject={editingSubject || undefined}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      ) : (
        <SubjectTable
          subjects={subjects}
          onEdit={handleEditSubject}
          onDelete={handleDeleteSubject}
        />
      )}
    </div>
  )
}