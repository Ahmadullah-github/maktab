import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClassSchedule } from "@/lib/timetableTransform";

interface ClassScheduleGridProps {
  classSchedule: ClassSchedule;
  days: string[];
  periodsPerDay: number;
  periods?: Array<{ index: number; startTime?: string; endTime?: string }>;
}

// Color palette for subjects
const subjectColors = [
  "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700",
  "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700",
  "bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700",
  "bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700",
  "bg-pink-100 dark:bg-pink-900/30 border-pink-300 dark:border-pink-700",
  "bg-cyan-100 dark:bg-cyan-900/30 border-cyan-300 dark:border-cyan-700",
  "bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700",
  "bg-teal-100 dark:bg-teal-900/30 border-teal-300 dark:border-teal-700",
];

export function ClassScheduleGrid({ classSchedule, days, periodsPerDay, periods }: ClassScheduleGridProps) {
  // Map subject IDs to colors consistently
  const subjectColorMap = React.useMemo(() => {
    const map = new Map<string, string>();
    const uniqueSubjects = new Set<string>();
    
    Object.values(classSchedule.schedule).forEach((daySchedule) => {
      Object.values(daySchedule).forEach((lesson) => {
        uniqueSubjects.add(lesson.subjectId);
      });
    });

    Array.from(uniqueSubjects).forEach((subjectId, index) => {
      map.set(subjectId, subjectColors[index % subjectColors.length]);
    });

    return map;
  }, [classSchedule]);

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
        <CardTitle>{classSchedule.className} Schedule</CardTitle>
        <CardDescription>
          Weekly timetable for {classSchedule.className}
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
                  (day) => classSchedule.schedule[day]?.[periodIndex]
                );

                if (!hasLessons) return null; // Skip empty periods

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
                      const lesson = classSchedule.schedule[day]?.[periodIndex];
                      
                      if (!lesson) {
                        return (
                          <TableCell key={day} className="text-center text-muted-foreground text-sm">
                            —
                          </TableCell>
                        );
                      }

                      const colorClass = subjectColorMap.get(lesson.subjectId) || subjectColors[0];

                      return (
                        <TableCell key={day} className="p-2">
                          <div className={`border-l-4 rounded p-2 ${colorClass}`}>
                            <div className="font-semibold text-sm">{lesson.subjectName}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              <div>👨‍🏫 {lesson.teacherNames.join(", ")}</div>
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

