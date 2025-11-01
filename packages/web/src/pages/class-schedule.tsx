import React, { useState, useEffect } from "react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Printer, Calendar } from "lucide-react";
import { useClassStore } from "@/stores/useClassStore";
import { useSubjectStore } from "@/stores/useSubjectStore";
import { useTeacherStore } from "@/stores/useTeacherStore";
import { useRoomStore } from "@/stores/useRoomStore";
import { ClassScheduleGrid } from "@/components/timetable/class-schedule-grid";
import { CompactClassScheduleGrid } from "@/components/timetable/compact-class-schedule-grid";
import { transformToClassSchedule, exportToCSV } from "@/lib/timetableTransform";
import { exportClassScheduleToPDF } from "@/lib/pdfExportWithCanvas";
import { ErrorDisplay } from "@/components/common/error-display";
import { Loading } from "@/components/common/loading";
import { toast } from "sonner";

export default function ClassSchedulePage() {
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
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

  // Auto-select first class when classes load (only if still on "all")
  useEffect(() => {
    if (classes.length > 0 && selectedClassId === "all") {
      // Keep "all" as default, don't auto-select first class
    }
  }, [classes, selectedClassId]);

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
            { label: "Class Schedules" }
          ]}
        />
        
        <ErrorDisplay
          title="No Timetable Generated"
          message="Please generate a timetable first before viewing class schedules."
          onRetry={() => window.location.href = "/timetable"}
        />
      </div>
    );
  }

  // Transform timetable data to class-centric view
  const classSchedules = transformToClassSchedule(
    timetableData,
    classes,
    subjects,
    teachers,
    rooms
  );

  const selectedSchedule = selectedClassId !== "all" 
    ? classSchedules.find((cs) => cs.classId === selectedClassId)
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
      if (selectedClassId === "all") {
        // Export all classes to PDF
        await exportClassScheduleToPDF(classSchedules, days, periodsPerDay, {
          title: "All Class Schedules",
        });
        toast.success("PDF exported successfully");
      } else if (selectedSchedule) {
        // Export single class to PDF
        await exportClassScheduleToPDF([selectedSchedule], days, periodsPerDay, {
          title: `${selectedSchedule.className} Schedule`,
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
    if (selectedClassId === "all") {
      // Export all classes
      const csv = exportToCSV(timetableData, "class", {
        classes,
        subjects,
        teachers,
        rooms,
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;bom=true;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `all_classes_schedule.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } else if (selectedSchedule) {
      // Export single class
      const lessonsForClass = timetableData.filter((l: any) => l.classId === selectedClassId);
      const csv = exportToCSV(lessonsForClass, "class", {
        classes,
        subjects,
        teachers,
        rooms,
      });
      
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;bom=true;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedSchedule.className}_schedule.csv`;
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
          { label: "Class Schedules" }
        ]}
      />
      
      <div className="flex items-center justify-between mb-6 no-print">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Calendar className="h-8 w-8" />
            Class Schedules
          </h1>
          <p className="text-muted-foreground mt-1">
            View timetables for all classes
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
        <Tabs value={selectedClassId} onValueChange={setSelectedClassId}>
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="all" className="px-4">
              ALL ({classSchedules.length})
            </TabsTrigger>
            {classSchedules.map((classSchedule) => {
              const totalLessons = Object.values(classSchedule.schedule).reduce(
                (acc, daySchedule) => acc + Object.keys(daySchedule).length,
                0
              );
              return (
                <TabsTrigger 
                  key={classSchedule.classId} 
                  value={classSchedule.classId}
                  className="px-4"
                >
                  {classSchedule.className} ({totalLessons})
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>

      {/* Content Area */}
      {selectedClassId === "all" ? (
        /* Show all schedules in compact vertical list */
        <div className="space-y-4">
          {classSchedules.map((classSchedule) => (
            <div key={classSchedule.classId} className="print-schedule-page">
              <CompactClassScheduleGrid
                classSchedule={classSchedule}
                days={days}
                periodsPerDay={periodsPerDay}
              />
            </div>
          ))}
        </div>
      ) : selectedSchedule ? (
        /* Show full detailed schedule for selected class */
        <div className="print-schedule-page">
          <ClassScheduleGrid
            classSchedule={selectedSchedule}
            days={days}
            periodsPerDay={periodsPerDay}
          />
        </div>
      ) : null}
    </div>
  );
}

