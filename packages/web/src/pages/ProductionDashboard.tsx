import React, { useEffect } from "react";
import { StatsOverview } from "@/components/dashboard/stats-overview";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { EmptyDashboard } from "@/components/dashboard/empty-dashboard";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { useTeacherStore } from "@/stores/useTeacherStore";
import { useSubjectStore } from "@/stores/useSubjectStore";
import { useRoomStore } from "@/stores/useRoomStore";
import { useClassStore } from "@/stores/useClassStore";
import { useWizardStore } from "@/stores/useWizardStore";
import { useMemo } from "react";

export default function Dashboard() {
  const { teachers, fetchTeachers } = useTeacherStore();
  const { subjects, fetchSubjects } = useSubjectStore();
  const { rooms, fetchRooms } = useRoomStore();
  const { classes, fetchClasses } = useClassStore();
  const { schoolInfo } = useWizardStore();

  useEffect(() => {
    // Fetch all data when component mounts
    fetchTeachers();
    fetchSubjects();
    fetchRooms();
    fetchClasses();
  }, [fetchTeachers, fetchSubjects, fetchRooms, fetchClasses]);

  // Calculate enabled grades based on schoolInfo
  const enabledGrades = useMemo(() => {
    const grades: number[] = [];
    if (schoolInfo.enablePrimary) for (let g=1; g<=6; g++) grades.push(g);
    if (schoolInfo.enableMiddle) for (let g=7; g<=9; g++) grades.push(g);
    if (schoolInfo.enableHigh) for (let g=10; g<=12; g++) grades.push(g);
    return grades;
  }, [schoolInfo.enablePrimary, schoolInfo.enableMiddle, schoolInfo.enableHigh]);

  // Filter subjects to only include those from enabled grades
  const filteredSubjects = useMemo(() => {
    return subjects.filter(s => {
      if (s.grade === null || s.grade === undefined) return false;
      return enabledGrades.includes(s.grade);
    });
  }, [subjects, enabledGrades]);

  // Check if we have any data
  const hasData =
    teachers.length > 0 ||
    filteredSubjects.length > 0 ||
    rooms.length > 0 ||
    classes.length > 0;

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Dashboard", href: "/" }]} />

      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your timetable system
        </p>
      </div>

      {hasData ? (
        <>
          <StatsOverview
            teacherCount={teachers.length}
            subjectCount={filteredSubjects.length}
            roomCount={rooms.length}
            classCount={classes.length}
          />
          <div className="grid gap-6 md:grid-cols-2">
            <QuickActions />
            <RecentActivity />
          </div>
        </>
      ) : (
        <EmptyDashboard />
      )}
    </div>
  );
}
