import React, { useState, useEffect } from "react";
import { TeacherForm } from "@/components/entities/teacher/teacher-form";
import { TeacherTable } from "@/components/entities/teacher/teacher-table";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Teacher } from "@/types";
import { Plus, AlertCircle } from "lucide-react";
import { useTeacherStore } from "@/stores/useTeacherStore";
import { ErrorDisplay } from "@/components/common/error-display";
import { Loading } from "@/components/common/loading";

export default function TeachersPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);

  const {
    teachers,
    isLoading,
    error,
    fetchTeachers,
    addTeacher,
    updateTeacher,
    deleteTeacher,
  } = useTeacherStore();

  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers]);

  const handleAddTeacher = () => {
    setEditingTeacher(null);
    setShowForm(true);
  };

  const handleEditTeacher = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setShowForm(true);
  };

  const handleDeleteTeacher = async (teacherId: string) => {
    try {
      await deleteTeacher(teacherId);
    } catch (err) {
      console.error("Failed to delete teacher:", err);
    }
  };

  const handleSubmit = async (teacher: Omit<Teacher, "id"> | Teacher) => {
    try {
      if ("id" in teacher) {
        await updateTeacher(teacher);
      } else {
        await addTeacher(teacher);
      }
      setShowForm(false);
    } catch (err) {
      console.error("Failed to save teacher:", err);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingTeacher(null);
  };

  if (isLoading && teachers.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorDisplay
        title="Error Loading Teachers"
        message={error}
        onRetry={fetchTeachers}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: "Home", href: "/" }, { label: "Teachers" }]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Teachers</h1>
          <p className="text-muted-foreground">
            Manage teachers in your school
          </p>
        </div>
        <Button onClick={handleAddTeacher}>
          <Plus className="mr-2 h-4 w-4" />
          Add Teacher
        </Button>
      </div>

      {showForm ? (
        <TeacherForm
          teacher={editingTeacher || undefined}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      ) : (
        <TeacherTable
          teachers={teachers}
          onEdit={handleEditTeacher}
          onDelete={handleDeleteTeacher}
        />
      )}
    </div>
  );
}
