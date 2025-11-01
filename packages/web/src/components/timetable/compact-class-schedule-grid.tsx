import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClassSchedule } from "@/lib/timetableTransform";

interface CompactClassScheduleGridProps {
  classSchedule: ClassSchedule;
  days: string[];
  periodsPerDay: number;
}

// Color palette for subjects (same as full version)
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

export function CompactClassScheduleGrid({ 
  classSchedule, 
  days, 
  periodsPerDay 
}: CompactClassScheduleGridProps) {
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

  // Calculate total lessons for this class
  const totalLessons = Object.values(classSchedule.schedule).reduce(
    (acc, daySchedule) => acc + Object.keys(daySchedule).length,
    0
  );

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>{classSchedule.className}</span>
          <span className="text-sm font-normal text-muted-foreground">
            {totalLessons} lessons/week
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20 font-semibold text-xs">Period</TableHead>
                {days.map((day) => (
                  <TableHead key={day} className="text-center font-semibold text-xs min-w-[120px]">
                    {day.substring(0, 3)}
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
                  <TableRow key={periodIndex} className="h-16">
                    <TableCell className="font-medium bg-muted/50 text-xs py-2">
                      P{periodIndex + 1}
                    </TableCell>
                    {days.map((day) => {
                      const lesson = classSchedule.schedule[day]?.[periodIndex];
                      
                      if (!lesson) {
                        return (
                          <TableCell key={day} className="text-center text-muted-foreground text-xs py-2">
                            —
                          </TableCell>
                        );
                      }

                      const colorClass = subjectColorMap.get(lesson.subjectId) || subjectColors[0];

                      return (
                        <TableCell key={day} className="p-1.5 py-2">
                          <div className={`border-l-2 rounded p-1.5 ${colorClass}`}>
                            <div className="font-semibold text-xs leading-tight">
                              {lesson.subjectName}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                              <div>👨‍🏫 {lesson.teacherNames[0]}{lesson.teacherNames.length > 1 ? ` +${lesson.teacherNames.length - 1}` : ''}</div>
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

