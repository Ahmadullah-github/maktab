// Updated DashboardPage.tsx
import React, { useEffect, useMemo, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { CommandCenter } from "@/components/dashboard/CommandCenter"
import { AnalyticsHub } from "@/components/dashboard/AnalyticsHub"
import { EmptyDashboard } from "@/components/dashboard/empty-dashboard"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { useTeacherStore } from "@/stores/useTeacherStore"
import { useSubjectStore } from "@/stores/useSubjectStore"
import { useRoomStore } from "@/stores/useRoomStore"
import { useClassStore } from "@/stores/useClassStore"
import { useWizardStore } from "@/stores/useWizardStore"
import { useTimetableStore } from "@/stores/useTimetableStore"
import { useLanguageCtx } from "@/i18n/provider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { cn } from "@/lib/utils/tailwaindMergeUtil"

export default function Dashboard() {
  const { t, isRTL } = useLanguageCtx()
  const navigate = useNavigate()
  const { teachers, fetchTeachers } = useTeacherStore()
  const { subjects, fetchSubjects } = useSubjectStore()
  const { rooms, fetchRooms } = useRoomStore()
  const { classes, fetchClasses } = useClassStore()
  const { schoolInfo } = useWizardStore()
  const { 
    currentTimetable, 
    generationHistory, 
    statistics,
    loadTimetableFromStorage,
    loadGenerationHistory 
  } = useTimetableStore()

  // Load timetable and history from storage on mount
  useEffect(() => {
    loadTimetableFromStorage()
    loadGenerationHistory()
  }, [loadTimetableFromStorage, loadGenerationHistory])

  // Fetch all data on mount
  useEffect(() => {
    fetchTeachers()
    fetchSubjects()
    fetchRooms()
    fetchClasses()
  }, [fetchTeachers, fetchSubjects, fetchRooms, fetchClasses])

  // Handle timetable generation - navigate to wizard for now
  const handleGenerateTimetable = useCallback(() => {
    navigate("/wizard")
    toast.info(isRTL ? "لطفاً راهنمای تنظیمات را تکمیل کنید تا جدول زمانی تولید شود" : "Please complete the setup wizard to generate your timetable")
  }, [navigate, isRTL])

  // Get last generated timestamp from generation history
  const lastGenerated = useMemo(() => {
    if (generationHistory.length > 0 && generationHistory[0]?.timestamp) {
      return new Date(generationHistory[0].timestamp)
    }
    return undefined
  }, [generationHistory])

  // Calculate timetable status
  const timetableStatus = useMemo(() => {
    if (!currentTimetable || currentTimetable.length === 0) return 'none'
    // Check if timetable might be outdated (e.g., if data changed significantly)
    // For now, if it exists, it's generated
    return 'generated'
  }, [currentTimetable])

  // Calculate conflict count and coverage from statistics
  const conflictCount = useMemo(() => {
    return statistics?.conflictCount ?? 0
  }, [statistics])

  const coverage = useMemo(() => {
    if (statistics && statistics.scheduleDensity && statistics.scheduleDensity.length > 0) {
      // Calculate average fill rate from schedule density
      const avgFillRate = statistics.scheduleDensity.reduce((sum, day) => sum + day.fillRate, 0) / statistics.scheduleDensity.length
      return Math.round(avgFillRate * 100)
    }
    return currentTimetable ? 95 : 0 // Fallback to 95% if timetable exists but no stats
  }, [statistics, currentTimetable])

  // Calculate analytics data
  const analyticsData = useMemo(() => {
    const primaryClasses = classes.filter(c => {
      const grade = c.grade || parseInt(c.name.match(/\d+/)?.[0] || "0")
      return grade >= 1 && grade <= 6
    }).length

    const middleClasses = classes.filter(c => {
      const grade = c.grade || parseInt(c.name.match(/\d+/)?.[0] || "0")
      return grade >= 7 && grade <= 9
    }).length

    const highClasses = classes.filter(c => {
      const grade = c.grade || parseInt(c.name.match(/\d+/)?.[0] || "0")
      return grade >= 10
    }).length

    return {
      sectionBreakdown: {
        primary: { classes: primaryClasses, subjects: subjects.filter(s => s.grade && s.grade <= 6).length },
        middle: { classes: middleClasses, subjects: subjects.filter(s => s.grade && s.grade >= 7 && s.grade <= 9).length },
        high: { classes: highClasses, subjects: subjects.filter(s => s.grade && s.grade >= 10).length }
      },
      periodUtilization: coverage,
      teacherWorkload: { 
        balanced: statistics?.avgTeacherPeriodsPerWeek ? Math.round(statistics.avgTeacherPeriodsPerWeek) : 75, 
        overloaded: statistics?.teacherUtilization?.filter(t => t.periodsPerWeek > (statistics.avgTeacherPeriodsPerWeek || 0) * 1.2).length ?? 15
      },
      subjectDistribution: [
        { name: "Mathematics", count: subjects.filter(s => s.name?.toLowerCase().includes('math')).length, color: "#3b82f6" },
        { name: "Sciences", count: subjects.filter(s => s.name && (s.name.toLowerCase().includes('science') || s.name.toLowerCase().includes('biology') || s.name.toLowerCase().includes('chemistry') || s.name.toLowerCase().includes('physics'))).length, color: "#10b981" },
        { name: "Languages", count: subjects.filter(s => s.name && (s.name.toLowerCase().includes('language') || s.name.toLowerCase().includes('english') || s.name.toLowerCase().includes('dari') || s.name.toLowerCase().includes('pashto'))).length, color: "#f59e0b" },
        { name: "Social Studies", count: subjects.filter(s => s.name && (s.name.toLowerCase().includes('history') || s.name.toLowerCase().includes('geography') || s.name.toLowerCase().includes('social'))).length, color: "#ef4444" }
      ]
    }
  }, [classes, subjects, coverage, statistics])

  const hasData = teachers.length > 0 || subjects.length > 0 || rooms.length > 0 || classes.length > 0

  if (!hasData) {
    return <EmptyDashboard />
  }

  return (
    <div className={cn("space-y-6 pb-6", isRTL && "rtl")} dir={isRTL ? "rtl" : "ltr"}>
      {/* Header Section */}
      <div className="space-y-4">
        <Breadcrumb items={[{ label: t.dashboard?.title || "Dashboard", href: "/" }]} />
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t.dashboard?.title || "Dashboard"}</h1>
            <p className="text-muted-foreground mt-1">
              {schoolInfo.schoolName || t.app?.subtitle || "School Management Dashboard"}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="command" className="space-y-6">
        <TabsList className={cn("grid w-full grid-cols-2 max-w-md", isRTL && "rtl")} dir={isRTL ? "rtl" : "ltr"}>
          <TabsTrigger value="command" className="text-sm font-medium">
            Command Center
          </TabsTrigger>
          <TabsTrigger value="analytics" className="text-sm font-medium">
            Analytics Hub
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="command" className="space-y-6 mt-6">
          <CommandCenter
            teacherCount={teachers.length}
            subjectCount={subjects.length}
            roomCount={rooms.length}
            classCount={classes.length}
            timetableStatus={timetableStatus}
            lastGenerated={lastGenerated}
            conflictCount={conflictCount}
            coverage={coverage}
            onGenerateTimetable={handleGenerateTimetable}
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6 mt-6">
          <AnalyticsHub
            teacherCount={teachers.length}
            subjectCount={subjects.length}
            roomCount={rooms.length}
            classCount={classes.length}
            timetableData={currentTimetable}
            {...analyticsData}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}