import React, { useState, useEffect } from "react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Printer, Users } from "lucide-react";
import { useClassStore } from "@/stores/useClassStore";
import { useSubjectStore } from "@/stores/useSubjectStore";
import { useTeacherStore } from "@/stores/useTeacherStore";
import { useRoomStore } from "@/stores/useRoomStore";
import { TeacherScheduleGrid } from "@/components/timetable/teacher-schedule-grid";
import { CompactTeacherScheduleGrid } from "@/components/timetable/compact-teacher-schedule-grid";
import { transformToTeacherSchedule, exportToCSV } from "@/lib/timetableTransform";
import { exportTeacherScheduleToPDF } from "@/lib/pdfExportWithCanvas";
import { ErrorDisplay } from "@/components/common/error-display";
import { Loading } from "@/components/common/loading";
import { toast } from "sonner";

export default function TeacherSchedulePage() {
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("all");
  const [timetableData, setTimetableData] = useState<any>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  
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
      <div className="space-y-6">
        <Breadcrumb 
          items={[
            { label: "Home", href: "/" },
            { label: "Timetable", href: "/timetable" },
            { label: "Teacher Schedules" }
          ]}
        />
        
        <ErrorDisplay
          title="No Timetable Generated"
          message="Please generate a timetable first before viewing teacher schedules."
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

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      if (selectedTeacherId === "all") {
        // Export all teachers to PDF
        await exportTeacherScheduleToPDF(teacherSchedules, days, periodsPerDay, {
          title: "All Teacher Schedules",
        });
        toast.success("PDF exported successfully");
      } else if (selectedSchedule) {
        // Export single teacher to PDF
        await exportTeacherScheduleToPDF([selectedSchedule], days, periodsPerDay, {
          title: `${selectedSchedule.teacherName}'s Schedule`,
        });
        toast.success("PDF exported successfully");
      }
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Failed to export PDF. Please try again.");
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExportCSV = () => {
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
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumb 
        className="no-print"
        items={[
          { label: "Home", href: "/" },
          { label: "Timetable", href: "/timetable" },
          { label: "Teacher Schedules" }
        ]}
      />
      
      <div className="flex items-center justify-between mb-6 no-print">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            Teacher Schedules
          </h1>
          <p className="text-muted-foreground mt-1">
            View timetables for all teachers
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} className="no-print">
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleExportPDF} 
            className="no-print"
            disabled={isExportingPDF}
          >
            <Download className="mr-2 h-4 w-4" />
            {isExportingPDF ? "Exporting..." : "Export PDF"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="no-print">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="sticky top-0 z-10 bg-background pb-4 border-b mb-6 no-print">
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
            <div key={teacherSchedule.teacherId} className="print-schedule-page">
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
        <div className="print-schedule-page">
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

