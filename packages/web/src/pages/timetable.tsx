import React, { useState, useEffect } from "react"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { Button } from "@/components/ui/button"
import { useTeacherStore } from "@/stores/useTeacherStore"
import { useSubjectStore } from "@/stores/useSubjectStore"
import { useRoomStore } from "@/stores/useRoomStore"
import { useClassStore } from "@/stores/useClassStore"
import { ErrorDisplay } from "@/components/common/error-display"
import { Loading } from "@/components/common/loading"
import { TimetableView } from "@/components/timetable/timetable-view"
import { ConflictPanel } from "@/components/timetable/conflict-panel"
import { dataService } from "@/lib/dataService"

export default function TimetablePage() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedTimetable, setGeneratedTimetable] = useState<any>(null)
  const [conflicts, setConflicts] = useState<any[]>([])
  
  const { 
    teachers, 
    isLoading: teachersLoading, 
    error: teachersError, 
    fetchTeachers 
  } = useTeacherStore()
  
  const { 
    subjects, 
    isLoading: subjectsLoading, 
    error: subjectsError, 
    fetchSubjects 
  } = useSubjectStore()
  
  const { 
    rooms, 
    isLoading: roomsLoading, 
    error: roomsError, 
    fetchRooms 
  } = useRoomStore()
  
  const { 
    classes, 
    isLoading: classesLoading, 
    error: classesError, 
    fetchClasses 
  } = useClassStore()
  
  useEffect(() => {
    // Fetch all data needed for timetable generation
    fetchTeachers()
    fetchSubjects()
    fetchRooms()
    fetchClasses()
  }, [fetchTeachers, fetchSubjects, fetchRooms, fetchClasses])
  
  const handleGenerateTimetable = async () => {
    setIsGenerating(true)
    setConflicts([])
    
    try {
      // Prepare the data payload from the database
      const payload = {
        config: {
          periodsPerDay: 6,
          daysPerWeek: 6,
          // Use DayOfWeek enum values as solver expects
          daysOfWeek: ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"],
        },
        teachers: teachers.map(t => {
          // Ensure availability has all required days
          // Handle case where availability is empty object {}
          const teacherAvailability = (t as any).availability || {}
          
          // Check if availability is actually empty (no days set)
          const isEmptyAvailability = !teacherAvailability || 
            (typeof teacherAvailability === 'object' && 
             Object.keys(teacherAvailability).length === 0)
          
          const fullAvailability = isEmptyAvailability ? {
            Saturday: [true, true, true, true, true, true],
            Sunday: [true, true, true, true, true, true],
            Monday: [true, true, true, true, true, true],
            Tuesday: [true, true, true, true, true, true],
            Wednesday: [true, true, true, true, true, true],
            Thursday: [true, true, true, true, true, true],
          } : {
            Saturday: teacherAvailability.Saturday || [true, true, true, true, true, true],
            Sunday: teacherAvailability.Sunday || [true, true, true, true, true, true],
            Monday: teacherAvailability.Monday || [true, true, true, true, true, true],
            Tuesday: teacherAvailability.Tuesday || [true, true, true, true, true, true],
            Wednesday: teacherAvailability.Wednesday || [true, true, true, true, true, true],
            Thursday: teacherAvailability.Thursday || [true, true, true, true, true, true],
          }

          return {
            id: String(t.id),
            fullName: t.fullName,
            primarySubjectIds: Array.isArray(t.primarySubjectIds) 
              ? t.primarySubjectIds.map(id => String(id))
              : [],
            maxPeriodsPerWeek: t.maxPeriodsPerWeek || 30,
            maxPeriodsPerDay: t.maxPeriodsPerDay || 6,
            timePreference: t.timePreference || "None",
            availability: fullAvailability,
          }
        }),
        subjects: subjects.map(s => ({
          id: String(s.id),
          name: s.name,
          code: s.code || "",
          requiredRoomType: s.requiredRoomType || "",
        })),
        rooms: rooms.map(r => ({
          id: String(r.id),
          name: r.name,
          capacity: r.capacity || 30,
          type: r.type || "Classroom",
        })),
        classes: classes.map(c => {
          // Convert subjectRequirements from array to dict format expected by solver
          const subjectReqs = Array.isArray((c as any).subjectRequirements)
            ? (c as any).subjectRequirements.reduce((acc: any, req: any) => {
                acc[String(req.subjectId)] = {
                  periodsPerWeek: req.periodsPerWeek || 0,
                  minConsecutive: req.minConsecutive,
                  maxConsecutive: req.maxConsecutive,
                  minDaysPerWeek: req.minDaysPerWeek,
                  maxDaysPerWeek: req.maxDaysPerWeek,
                };
                return acc;
              }, {})
            : {};

          return {
            id: String(c.id),
            name: c.name,
            studentCount: (c as any).studentCount || 30,
            subjectRequirements: subjectReqs,
          };
        }),
      }

      console.log("Generating timetable with data from database:", payload)

      // Call the actual backend API
      const result = await dataService.generateTimetable(payload)
      
      console.log("Timetable generation result:", result)
      
      setGeneratedTimetable(result.data || result)
      
      // Extract conflicts if any
      if (result.conflicts && Array.isArray(result.conflicts)) {
        setConflicts(result.conflicts)
      }
      
      setIsGenerating(false)
    } catch (err) {
      console.error("Failed to generate timetable:", err)
      setConflicts([
        {
          id: "error",
          type: "error",
          description: `Generation failed: ${(err as Error).message}`,
          severity: "high"
        }
      ])
      setIsGenerating(false)
    }
  }
  
  const isLoading = teachersLoading || subjectsLoading || roomsLoading || classesLoading
  const error = teachersError || subjectsError || roomsError || classesError
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading />
      </div>
    )
  }
  
  if (error) {
    return (
      <ErrorDisplay 
        title="Error Loading Data"
        message={error}
        onRetry={() => {
          fetchTeachers()
          fetchSubjects()
          fetchRooms()
          fetchClasses()
        }}
      />
    )
  }
  
  // Check if we have enough data to generate a timetable
  const hasSufficientData = teachers.length > 0 && subjects.length > 0 && rooms.length > 0 && classes.length > 0
  
  return (
    <div className="space-y-6">
      <Breadcrumb 
        items={[
          { label: "Home", href: "/" },
          { label: "Timetable" }
        ]}
      />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Timetable</h1>
          <p className="text-muted-foreground">
            View and manage your school timetable
          </p>
        </div>
        <Button 
          onClick={handleGenerateTimetable} 
          disabled={!hasSufficientData || isGenerating}
        >
          {isGenerating ? "Generating..." : "Generate Timetable"}
        </Button>
      </div>
      
      {!hasSufficientData ? (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-8 text-center">
          <h2 className="text-2xl font-semibold mb-4">Insufficient Data</h2>
          <p className="text-muted-foreground mb-6">
            Please add teachers, subjects, rooms, and classes before generating a timetable.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium">{teachers.length}</p>
              <p className="text-sm text-muted-foreground">Teachers</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium">{subjects.length}</p>
              <p className="text-sm text-muted-foreground">Subjects</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium">{rooms.length}</p>
              <p className="text-sm text-muted-foreground">Rooms</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium">{classes.length}</p>
              <p className="text-sm text-muted-foreground">Classes</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {generatedTimetable ? (
            <>
              <TimetableView 
                timetableData={generatedTimetable}
                subjects={subjects}
                teachers={teachers}
                rooms={rooms}
                classes={classes}
              />
              <ConflictPanel conflicts={conflicts} />
            </>
          ) : (
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-8 text-center">
              <h2 className="text-2xl font-semibold mb-4">Timetable Generator</h2>
              <p className="text-muted-foreground mb-6">
                Click the "Generate Timetable" button to create your school timetable.
              </p>
              <Button 
                onClick={handleGenerateTimetable} 
                disabled={isGenerating}
              >
                {isGenerating ? "Generating..." : "Generate Timetable"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}