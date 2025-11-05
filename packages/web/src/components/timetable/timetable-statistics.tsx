import React, { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ExtendedTimetableStatistics } from "@/lib/timetableTransform";
import { Users, Building2, BookOpen, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils/tailwaindMergeUtil";
import { useLanguageCtx } from "@/i18n/provider";

interface TimetableStatisticsProps {
  statistics: ExtendedTimetableStatistics;
  teachers?: Array<{ id: string; fullName: string }>;
  subjects?: Array<{ id: string; name: string }>;
  rooms?: Array<{ id: string; name: string }>;
  isRTL?: boolean;
}

export function TimetableStatistics({
  statistics,
  teachers = [],
  subjects = [],
  rooms = [],
  isRTL = false,
}: TimetableStatisticsProps) {
  const { t } = useLanguageCtx();

  // Get teacher/subject/room names for display
  const getTeacherName = (teacherId: string) => {
    return teachers.find((t) => t.id === teacherId)?.fullName || teacherId;
  };

  const getSubjectName = (subjectId: string) => {
    return subjects.find((s) => s.id === subjectId)?.name || subjectId;
  };

  const getRoomName = (roomId: string) => {
    return rooms.find((r) => r.id === roomId)?.name || roomId;
  };

  const qualityColor = useMemo(() => {
    if (statistics.qualityScore >= 80) return "text-green-600";
    if (statistics.qualityScore >= 60) return "text-yellow-600";
    return "text-red-600";
  }, [statistics.qualityScore]);

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      {/* Quality Score Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Schedule Quality
          </CardTitle>
          <CardDescription>Overall timetable quality metrics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className={cn("text-4xl font-bold", qualityColor)}>
                {statistics.qualityScore}%
              </div>
              <p className="text-sm text-muted-foreground mt-1">Quality Score</p>
            </div>
            <div className="flex items-center gap-2">
              {statistics.conflictCount === 0 ? (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  No Conflicts
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {statistics.conflictCount} Conflict{statistics.conflictCount !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
          </div>
          <Progress value={statistics.qualityScore} className="h-2" />
        </CardContent>
      </Card>

      {/* Teacher Utilization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Teacher Utilization
          </CardTitle>
          <CardDescription>
            Average: {statistics.avgTeacherPeriodsPerWeek} periods/week
            {" "}• Range: {statistics.minTeacherPeriodsPerWeek} - {statistics.maxTeacherPeriodsPerWeek}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {statistics.teacherUtilization.slice(0, 10).map((teacher) => (
              <div key={teacher.teacherId} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-sm">{getTeacherName(teacher.teacherId)}</p>
                  <p className="text-xs text-muted-foreground">
                    {teacher.periodsPerWeek} periods/week • Avg {teacher.avgPeriodsPerDay.toFixed(1)}/day
                  </p>
                </div>
                <Badge variant="outline">{teacher.maxPeriodsPerDay} max/day</Badge>
              </div>
            ))}
            {statistics.teacherUtilization.length > 10 && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                +{statistics.teacherUtilization.length - 10} more teachers
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Room Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Room Usage
          </CardTitle>
          <CardDescription>
            Average: {statistics.avgRoomUtilization.toFixed(1)}% utilization
            {" "}• Range: {statistics.minRoomUtilization.toFixed(1)}% - {statistics.maxRoomUtilization.toFixed(1)}%
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {statistics.roomUsage
              .sort((a, b) => b.utilizationRate - a.utilizationRate)
              .slice(0, 10)
              .map((room) => (
                <div key={room.roomId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{getRoomName(room.roomId)}</p>
                    <Badge variant="outline">{room.utilizationRate.toFixed(1)}%</Badge>
                  </div>
                  <Progress value={room.utilizationRate} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {room.periodsUsed} periods used
                  </p>
                </div>
              ))}
            {statistics.roomUsage.length > 10 && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                +{statistics.roomUsage.length - 10} more rooms
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Subject Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Subject Distribution
          </CardTitle>
          <CardDescription>
            {statistics.uniqueSubjects} subjects across the timetable
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {statistics.subjectDistribution
              .sort((a, b) => b.periodsPerWeek - a.periodsPerWeek)
              .slice(0, 10)
              .map((subject) => (
                <div key={subject.subjectId} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{getSubjectName(subject.subjectId)}</p>
                    <p className="text-xs text-muted-foreground">
                      {subject.periodsPerWeek} periods/week
                    </p>
                  </div>
                </div>
              ))}
            {statistics.subjectDistribution.length > 10 && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                +{statistics.subjectDistribution.length - 10} more subjects
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Schedule Density by Day */}
      <Card>
        <CardHeader>
          <CardTitle>Schedule Density by Day</CardTitle>
          <CardDescription>Fill rate for each day of the week</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {statistics.scheduleDensity.map((density) => (
              <div key={density.day} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{density.day}</p>
                  <Badge variant="outline">{density.fillRate.toFixed(1)}%</Badge>
                </div>
                <Progress value={density.fillRate} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {density.periodsFilled} / {density.totalSlots} slots filled
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

