import React, { useState, useEffect } from "react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Users } from "lucide-react";
import { useClassStore } from "@/stores/useClassStore";
import { useSubjectStore } from "@/stores/useSubjectStore";
import { useTeacherStore } from "@/stores/useTeacherStore";
import { useRoomStore } from "@/stores/useRoomStore";
import { TeacherScheduleGrid } from "@/components/timetable/teacher-schedule-grid";
import { CompactTeacherScheduleGrid } from "@/components/timetable/compact-teacher-schedule-grid";
import { transformToTeacherSchedule, exportToCSV } from "@/lib/timetableTransform";
import { ErrorDisplay } from "@/components/common/error-display";
import { Loading } from "@/components/common/loading";
import { toast } from "sonner";
import { useLanguageCtx } from "@/i18n/provider";

export default function TeacherSchedulePage() {
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("all");
  const [timetableData, setTimetableData] = useState<any>(null);
  const { t, isRTL } = useLanguageCtx();
  
  const { classes, fetchClasses, isLoading: classesLoading } = useClassStore();
  const { subjects, fetchSubjects, isLoading: subjectsLoading } = useSubjectStore();
  const { teachers, fetchTeachers, isLoading: teachersLoading } = useTeacherStore();
  const { rooms, fetchRooms, isLoading: roomsLoading } = useRoomStore();

  // Load all data on mount
  useEffect(() => {
    fetchClasses();
    fetchSubjects();
    fetchTeachers();
    fetchRooms();
  }, [fetchClasses, fetchSubjects, fetchTeachers, fetchRooms]);

  // Auto-select first teacher when teachers load (only if still on "all")
  useEffect(() => {
    if (teachers.length > 0 && selectedTeacherId === "all") {
      // Keep "all" as default, don't auto-select first teacher
    }
  }, [teachers, selectedTeacherId]);

  // Load timetable from localStorage (generated timetable)
  useEffect(() => {
    const storedTimetable = localStorage.getItem("generatedTimetable");
    if (storedTimetable) {
      try {
        setTimetableData(JSON.parse(storedTimetable));
      } catch (error) {
        console.error("Failed to parse stored timetable:", error);
      }
    }
  }, []);

  const isLoading = classesLoading || subjectsLoading || teachersLoading || roomsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading />
      </div>
    );
  }

  if (!timetableData || !timetableData.length) {
    return (
      <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
        <Breadcrumb 
          items={[
            { label: t.nav.home, href: "/" },
            { label: t.nav.timetable, href: "/timetable" },
            { label: t.schedule.teacherSchedulesTitle }
          ]}
        />
        
        <ErrorDisplay
          title={t.schedule.noTimetableGenerated}
          message={t.schedule.generateFirst}
          onRetry={() => window.location.href = "/timetable"}
        />
      </div>
    );
  }

  // Transform timetable data to teacher-centric view
  const teacherSchedules = transformToTeacherSchedule(
    timetableData,
    teachers,
    classes,
    subjects,
    rooms
  );

  const selectedSchedule = selectedTeacherId !== "all"
    ? teacherSchedules.find((ts) => ts.teacherId === selectedTeacherId)
    : null;

  // Get configuration
  const days = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];
  const periodsPerDay = 6;


  const handleExportCSV = () => {
    try {
      if (selectedTeacherId === "all") {
        // Export all teachers
        const csv = exportToCSV(timetableData, "teacher", {
          classes,
          subjects,
          teachers,
          rooms,
        });
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;bom=true;" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `all_teachers_schedule.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success("CSV exported successfully");
      } else if (selectedSchedule) {
        // Export single teacher
        const lessonsForTeacher = timetableData.filter((l: any) => 
          l.teacherIds.includes(selectedTeacherId)
        );
        const csv = exportToCSV(lessonsForTeacher, "teacher", {
          classes,
          subjects,
          teachers,
          rooms,
        });
        
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;bom=true;" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${selectedSchedule.teacherName}_schedule.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success("CSV exported successfully");
      }
    } catch (error) {
      console.error("Error exporting CSV:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(errorMessage, {
        duration: 8000, // Show longer for detailed messages
      });
    }
  };

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      <Breadcrumb 
        items={[
          { label: t.nav.home, href: "/" },
          { label: t.nav.timetable, href: "/timetable" },
          { label: t.schedule.teacherSchedulesTitle }
        ]}
      />
      
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            {t.schedule.teacherSchedulesTitle}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t.schedule.viewTeacherSchedules}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className={isRTL ? "ml-2" : "mr-2 h-4 w-4"} />
            {t.actions.exportCsv}
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="sticky top-0 z-10 bg-background pb-4 border-b mb-6">
        <Tabs value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="all" className="px-4">
              ALL ({teacherSchedules.length})
            </TabsTrigger>
            {teacherSchedules.map((teacherSchedule) => {
              const totalLessons = Object.values(teacherSchedule.schedule).reduce(
                (acc, daySchedule) => acc + Object.keys(daySchedule).length,
                0
              );
              const totalPeriods = days.length * periodsPerDay;
              const freePeriods = totalPeriods - totalLessons;
              
              return (
                <TabsTrigger 
                  key={teacherSchedule.teacherId} 
                  value={teacherSchedule.teacherId}
                  className="px-4"
                >
                  {teacherSchedule.teacherName} ({totalLessons}/{freePeriods})
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>

      {/* Content Area */}
      {selectedTeacherId === "all" ? (
        /* Show all schedules in compact vertical list */
        <div className="space-y-4">
          {teacherSchedules.map((teacherSchedule) => (
            <div key={teacherSchedule.teacherId}>
              <CompactTeacherScheduleGrid
                teacherSchedule={teacherSchedule}
                days={days}
                periodsPerDay={periodsPerDay}
              />
            </div>
          ))}
        </div>
      ) : selectedSchedule ? (
        /* Show full detailed schedule for selected teacher */
        <div>
          <TeacherScheduleGrid
            teacherSchedule={selectedSchedule}
            days={days}
            periodsPerDay={periodsPerDay}
          />
        </div>
      ) : null}
    </div>
  );
}

