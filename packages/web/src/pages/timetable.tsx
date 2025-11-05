import React, { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, Users, ArrowRight, BookOpen, Building2, TrendingUp, Sparkles, AlertTriangle } from "lucide-react"
import { useTeacherStore } from "@/stores/useTeacherStore"
import { useSubjectStore } from "@/stores/useSubjectStore"
import { useRoomStore } from "@/stores/useRoomStore"
import { useClassStore } from "@/stores/useClassStore"
import { useWizardStore } from "@/stores/useWizardStore"
import { useTimetableStore } from "@/stores/useTimetableStore"
import { ErrorDisplay } from "@/components/common/error-display"
import { Loading } from "@/components/common/loading"
import { ConflictPanel } from "@/components/timetable/conflict-panel"
import { TimetableStatistics } from "@/components/timetable/timetable-statistics"
import { GenerationHistory } from "@/components/timetable/generation-history"
import { RegenerateDialog } from "@/components/timetable/regenerate-dialog"
import { getExtendedTimetableStatistics, Lesson } from "@/lib/timetableTransform"
import { dataService } from "@/lib/dataService"
import { useLanguageCtx } from "@/i18n/provider"
import { toast } from "sonner"

export default function TimetablePage() {
  const navigate = useNavigate()
  const { t, isRTL } = useLanguageCtx()
  const [isGenerating, setIsGenerating] = useState(false)
  const [conflicts, setConflicts] = useState<any[]>([])
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false)
  
  const { preferences, schoolInfo } = useWizardStore()
  const timetableStore = useTimetableStore()
  
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
  
  const { 
    currentTimetable, 
    setStatistics, 
    loadTimetableFromStorage, 
    loadGenerationHistory 
  } = timetableStore
  
  // Load timetable and history on mount
  useEffect(() => {
    loadTimetableFromStorage()
    loadGenerationHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  
  useEffect(() => {
    // Fetch all data needed for timetable display
    fetchTeachers()
    fetchSubjects()
    fetchRooms()
    fetchClasses()
  }, [fetchTeachers, fetchSubjects, fetchRooms, fetchClasses])
  
  // Calculate statistics when timetable changes
  useEffect(() => {
    if (currentTimetable && teachers.length > 0 && subjects.length > 0 && rooms.length > 0 && classes.length > 0) {
      const stats = getExtendedTimetableStatistics(
        currentTimetable as Lesson[],
        classes,
        teachers,
        subjects,
        rooms,
        schoolInfo.periodsPerDay || 7,
        schoolInfo.daysPerWeek || 6
      )
      setStatistics(stats)
    }
  }, [currentTimetable, teachers, subjects, rooms, classes, schoolInfo, setStatistics])
  
  const handleRegenerateConfirm = async (saveToHistory: boolean) => {
    if (saveToHistory && currentTimetable && statistics) {
      // Save current timetable to history
      timetableStore.addGenerationHistory({
        totalLessons: statistics.totalLessons,
        uniqueClasses: statistics.uniqueClasses,
        uniqueTeachers: statistics.uniqueTeachers,
        qualityScore: statistics.qualityScore,
        conflictCount: statistics.conflictCount,
        success: true,
      })
    }
    
    // Navigate to wizard for regeneration
    navigate("/wizard")
  }
  
  const hasTimetable = currentTimetable && Array.isArray(currentTimetable) && currentTimetable.length > 0
  
  const { statistics } = timetableStore
  
  // Key metrics for top stat cards
  const keyMetrics = useMemo(() => {
    if (!statistics) return null
    
    return {
      totalLessons: statistics.totalLessons,
      teacherLoad: statistics.avgTeacherPeriodsPerWeek,
      roomUsage: statistics.avgRoomUtilization,
      qualityScore: statistics.qualityScore,
    }
  }, [statistics])
  
  const isLoading = teachersLoading || subjectsLoading || roomsLoading || classesLoading
  const error = teachersError || subjectsError || roomsError || classesError
  const hasSufficientData = teachers.length > 0 && subjects.length > 0 && rooms.length > 0 && classes.length > 0
  
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
  
  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      <Breadcrumb 
        items={[
          { label: t.nav?.dashboard || "Home", href: "/" },
          { label: t.nav?.timetable || "Timetable" }
        ]}
      />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t.nav?.timetable || "Timetable"}</h1>
          <p className="text-muted-foreground">
            View and manage your school timetable
          </p>
        </div>
        {hasTimetable && (
          <Button 
            onClick={() => setShowRegenerateDialog(true)}
            variant="outline"
            className="border-blue-600 text-blue-600 hover:bg-blue-50"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Regenerate Timetable
          </Button>
        )}
      </div>
      
      {!hasTimetable ? (
        <Card className="p-8">
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="p-4 bg-blue-100 rounded-full">
                <Calendar className="h-12 w-12 text-blue-600" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-semibold mb-2">
                No Timetable Generated Yet
              </h2>
              <p className="text-muted-foreground mb-6">
                Create your first timetable using the setup wizard. The wizard will guide you through configuring all necessary information.
              </p>
            </div>
            
            {!hasSufficientData ? (
              <>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div className="text-left">
                      <p className="font-medium text-yellow-800 mb-2">Insufficient Data</p>
                      <p className="text-sm text-yellow-700 mb-4">
                        Please add teachers, subjects, rooms, and classes before generating a timetable.
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-3 bg-white rounded border border-yellow-200">
                          <p className="text-2xl font-bold">{teachers.length}</p>
                          <p className="text-xs text-muted-foreground">Teachers</p>
                        </div>
                        <div className="p-3 bg-white rounded border border-yellow-200">
                          <p className="text-2xl font-bold">{subjects.length}</p>
                          <p className="text-xs text-muted-foreground">Subjects</p>
                        </div>
                        <div className="p-3 bg-white rounded border border-yellow-200">
                          <p className="text-2xl font-bold">{rooms.length}</p>
                          <p className="text-xs text-muted-foreground">Rooms</p>
                        </div>
                        <div className="p-3 bg-white rounded border border-yellow-200">
                          <p className="text-2xl font-bold">{classes.length}</p>
                          <p className="text-xs text-muted-foreground">Classes</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-green-700 mb-4">
                  ✓ All required data is ready! You can now create a timetable.
                </p>
              </div>
            )}
            
            <Button 
              onClick={() => navigate("/wizard")}
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
            >
              <Sparkles className="h-5 w-5 mr-2" />
              Create Your First Timetable
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Key Metrics Cards */}
          {keyMetrics && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Lessons</p>
                      <p className="text-2xl font-bold">{keyMetrics.totalLessons}</p>
                    </div>
                    <BookOpen className="h-8 w-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Teacher Load</p>
                      <p className="text-2xl font-bold">{keyMetrics.teacherLoad.toFixed(1)}</p>
                      <p className="text-xs text-muted-foreground">periods/week avg</p>
                    </div>
                    <Users className="h-8 w-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Room Usage</p>
                      <p className="text-2xl font-bold">{keyMetrics.roomUsage.toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">utilization avg</p>
                    </div>
                    <Building2 className="h-8 w-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Quality Score</p>
                      <p className={`text-2xl font-bold ${
                        keyMetrics.qualityScore >= 80 ? "text-green-600" :
                        keyMetrics.qualityScore >= 60 ? "text-yellow-600" :
                        "text-red-600"
                      }`}>
                        {keyMetrics.qualityScore}%
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          
          {/* Main Content: Statistics and History */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Statistics Dashboard - Takes 2/3 width */}
            <div className="lg:col-span-2">
              {statistics && (
                <TimetableStatistics
                  statistics={statistics}
                  teachers={teachers}
                  subjects={subjects}
                  rooms={rooms}
                  isRTL={isRTL}
                />
              )}
            </div>
            
            {/* Generation History - Takes 1/3 width */}
            <div className="lg:col-span-1">
              <GenerationHistory
                history={timetableStore.generationHistory}
                isRTL={isRTL}
              />
            </div>
          </div>
          
          {/* Conflicts Panel */}
          {conflicts.length > 0 && (
            <ConflictPanel conflicts={conflicts} />
          )}
          
          {/* Quick Action Cards */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Navigate to different timetable views and manage your schedule
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button 
                  className="w-full h-auto py-6" 
                  variant="outline"
                  onClick={() => navigate("/timetable/classes")}
                >
                  <div className="flex items-center gap-3 w-full">
                    <Calendar className="h-8 w-8 text-blue-600" />
                    <div className="flex-1 text-left">
                      <div className="font-semibold text-lg">Class Schedules</div>
                      <div className="text-sm text-muted-foreground">
                        View timetables for each class
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5" />
                  </div>
                </Button>
                
                <Button 
                  className="w-full h-auto py-6" 
                  variant="outline"
                  onClick={() => navigate("/timetable/teachers")}
                >
                  <div className="flex items-center gap-3 w-full">
                    <Users className="h-8 w-8 text-purple-600" />
                    <div className="flex-1 text-left">
                      <div className="font-semibold text-lg">Teacher Schedules</div>
                      <div className="text-sm text-muted-foreground">
                        View timetables for each teacher
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5" />
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Regenerate Dialog */}
      <RegenerateDialog
        open={showRegenerateDialog}
        onOpenChange={setShowRegenerateDialog}
        onConfirm={handleRegenerateConfirm}
        hasTimetable={hasTimetable}
        isRTL={isRTL}
      />
    </div>
  )
}