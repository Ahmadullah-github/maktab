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

export default function Dashboard() {
  const { teachers, fetchTeachers } = useTeacherStore();
  const { subjects, fetchSubjects } = useSubjectStore();
  const { rooms, fetchRooms } = useRoomStore();
  const { classes, fetchClasses } = useClassStore();

  useEffect(() => {
    // Fetch all data when component mounts
    fetchTeachers();
    fetchSubjects();
    fetchRooms();
    fetchClasses();
  }, [fetchTeachers, fetchSubjects, fetchRooms, fetchClasses]);

  // Check if we have any data
  const hasData =
    teachers.length > 0 ||
    subjects.length > 0 ||
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
            subjectCount={subjects.length}
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
