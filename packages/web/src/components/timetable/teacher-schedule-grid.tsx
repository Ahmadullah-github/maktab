import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TeacherSchedule } from "@/lib/timetableTransform";

interface TeacherScheduleGridProps {
  teacherSchedule: TeacherSchedule;
  days: string[];
  periodsPerDay: number;
  periods?: Array<{ index: number; startTime?: string; endTime?: string }>;
}

// Color palette for classes
const classColors = [
  "bg-indigo-100 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700",
  "bg-rose-100 dark:bg-rose-900/30 border-rose-300 dark:border-rose-700",
  "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700",
  "bg-violet-100 dark:bg-violet-900/30 border-violet-300 dark:border-violet-700",
  "bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700",
  "bg-sky-100 dark:bg-sky-900/30 border-sky-300 dark:border-sky-700",
  "bg-fuchsia-100 dark:bg-fuchsia-900/30 border-fuchsia-300 dark:border-fuchsia-700",
  "bg-lime-100 dark:bg-lime-900/30 border-lime-300 dark:border-lime-700",
];

export function TeacherScheduleGrid({ teacherSchedule, days, periodsPerDay, periods }: TeacherScheduleGridProps) {
  // Map class IDs to colors consistently
  const classColorMap = React.useMemo(() => {
    const map = new Map<string, string>();
    const uniqueClasses = new Set<string>();
    
    Object.values(teacherSchedule.schedule).forEach((daySchedule) => {
      Object.values(daySchedule).forEach((lesson) => {
        uniqueClasses.add(lesson.classId);
      });
    });

    Array.from(uniqueClasses).forEach((classId, index) => {
      map.set(classId, classColors[index % classColors.length]);
    });

    return map;
  }, [teacherSchedule]);

  const getPeriodTime = (periodIndex: number) => {
    if (!periods || !periods[periodIndex]) return `Period ${periodIndex + 1}`;
    const period = periods[periodIndex];
    if (period.startTime && period.endTime) {
      return `${period.startTime} - ${period.endTime}`;
    }
    return `Period ${periodIndex + 1}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{teacherSchedule.teacherName}'s Schedule</CardTitle>
        <CardDescription>
          Weekly timetable for {teacherSchedule.teacherName}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32 font-semibold">Period / Day</TableHead>
                {days.map((day) => (
                  <TableHead key={day} className="text-center font-semibold min-w-[150px]">
                    {day}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: periodsPerDay }, (_, periodIndex) => {
                // Check if this period has any lessons
                const hasLessons = days.some(
                  (day) => teacherSchedule.schedule[day]?.[periodIndex]
                );

                // Always show all periods for teachers (to show free periods)
                return (
                  <TableRow key={periodIndex}>
                    <TableCell className="font-medium bg-muted/50">
                      <div className="text-sm">
                        <div className="font-semibold">Period {periodIndex + 1}</div>
                        <div className="text-xs text-muted-foreground">
                          {getPeriodTime(periodIndex)}
                        </div>
                      </div>
                    </TableCell>
                    {days.map((day) => {
                      const lesson = teacherSchedule.schedule[day]?.[periodIndex];
                      
                      if (!lesson) {
                        return (
                          <TableCell key={day} className="text-center bg-gray-50 dark:bg-gray-900/20">
                            <span className="text-xs text-muted-foreground">Free</span>
                          </TableCell>
                        );
                      }

                      const colorClass = classColorMap.get(lesson.classId) || classColors[0];

                      return (
                        <TableCell key={day} className="p-2">
                          <div className={`border-l-4 rounded p-2 ${colorClass}`}>
                            <div className="font-semibold text-sm">{lesson.className}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              <div>📚 {lesson.subjectName}</div>
                              <div>🚪 {lesson.roomName}</div>
                            </div>
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

