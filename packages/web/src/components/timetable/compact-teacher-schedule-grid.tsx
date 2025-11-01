import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TeacherSchedule } from "@/lib/timetableTransform";

interface CompactTeacherScheduleGridProps {
  teacherSchedule: TeacherSchedule;
  days: string[];
  periodsPerDay: number;
}

// Color palette for classes (same as full version)
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

export function CompactTeacherScheduleGrid({ 
  teacherSchedule, 
  days, 
  periodsPerDay 
}: CompactTeacherScheduleGridProps) {
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

  // Calculate total lessons and free periods
  const totalLessons = Object.values(teacherSchedule.schedule).reduce(
    (acc, daySchedule) => acc + Object.keys(daySchedule).length,
    0
  );
  const totalPeriods = days.length * periodsPerDay;
  const freePeriods = totalPeriods - totalLessons;

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>{teacherSchedule.teacherName}</span>
          <span className="text-sm font-normal text-muted-foreground">
            {totalLessons} lessons / {freePeriods} free periods
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
                return (
                  <TableRow key={periodIndex} className="h-16">
                    <TableCell className="font-medium bg-muted/50 text-xs py-2">
                      P{periodIndex + 1}
                    </TableCell>
                    {days.map((day) => {
                      const lesson = teacherSchedule.schedule[day]?.[periodIndex];
                      
                      if (!lesson) {
                        return (
                          <TableCell key={day} className="text-center bg-gray-50 dark:bg-gray-900/20 text-xs py-2">
                            <span className="text-[10px] text-muted-foreground">Free</span>
                          </TableCell>
                        );
                      }

                      const colorClass = classColorMap.get(lesson.classId) || classColors[0];

                      return (
                        <TableCell key={day} className="p-1.5 py-2">
                          <div className={`border-l-2 rounded p-1.5 ${colorClass}`}>
                            <div className="font-semibold text-xs leading-tight">
                              {lesson.className}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
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

