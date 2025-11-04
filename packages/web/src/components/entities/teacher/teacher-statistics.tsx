import React, { useMemo } from "react";
import { Teacher, Subject } from "@/types";
import { Users, Calendar, TrendingUp, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils/tailwaindMergeUtil";

interface TeacherStatisticsProps {
  teachers: Teacher[];
  subjects: Subject[];
  isRTL?: boolean;
}

// Calculate total periods for a teacher
const calculateTeacherTotalPeriods = (teacher: Teacher, subjects: Subject[]): number => {
  let total = 0;
  
  (teacher.primarySubjectIds || []).forEach(subjectId => {
    const subject = subjects.find(s => s.id === subjectId);
    if (!subject || !subject.periodsPerWeek) return;

    const assignment = (teacher.classAssignments || []).find(a => a.subjectId === subjectId);
    const classCount = assignment?.classIds.length || 0;
    total += subject.periodsPerWeek * classCount;
  });

  return total;
};

export function TeacherStatistics({ teachers, subjects, isRTL = false }: TeacherStatisticsProps) {
  const stats = useMemo(() => {
    const totalTeachers = teachers.length;
    const totalPeriodsUsed = teachers.reduce((sum, teacher) => 
      sum + calculateTeacherTotalPeriods(teacher, subjects), 0
    );
    const avgPeriods = totalTeachers > 0 
      ? Math.round(totalPeriodsUsed / totalTeachers) 
      : 0;
    // Count total unique expert subjects across all teachers
    const uniqueSubjects = new Set<string>();
    teachers.forEach(teacher => {
      teacher.primarySubjectIds.forEach(id => uniqueSubjects.add(id));
    });

    return {
      totalTeachers,
      totalPeriodsUsed,
      avgPeriods,
      totalExpertSubjects: uniqueSubjects.size,
    };
  }, [teachers, subjects]);

  const statCards = [
    {
      icon: Users,
      label: isRTL ? "کل معلمین" : "Total Teachers",
      value: stats.totalTeachers,
      gradient: "from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-900",
      border: "border-indigo-200 dark:border-indigo-800",
      iconColor: "text-indigo-600 dark:text-indigo-400",
    },
    {
      icon: Calendar,
      label: isRTL ? "کل دوره‌ها" : "Total Periods Used",
      value: stats.totalPeriodsUsed,
      gradient: "from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900",
      border: "border-blue-200 dark:border-blue-800",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      icon: TrendingUp,
      label: isRTL ? "میانگین دوره" : "Average Periods",
      value: stats.avgPeriods,
      gradient: "from-green-50 to-green-100 dark:from-green-950 dark:to-green-900",
      border: "border-green-200 dark:border-green-800",
      iconColor: "text-green-600 dark:text-green-400",
    },
    {
      icon: BookOpen,
      label: isRTL ? "مواد تخصصی" : "Expert Subjects",
      value: stats.totalExpertSubjects,
      gradient: "from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900",
      border: "border-purple-200 dark:border-purple-800",
      iconColor: "text-purple-600 dark:text-purple-400",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {statCards.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div
            key={index}
            className={cn(
              "bg-gradient-to-br p-5 rounded-lg border-2 shadow-sm hover:shadow-md transition-shadow",
              stat.gradient,
              stat.border
            )}
          >
                        <div className={cn(
              "flex items-center gap-3 mb-2",
              isRTL && "flex-row"
            )}>
              {isRTL && (
                <span className={cn(
                  "text-sm font-medium",
                  stat.iconColor.replace("text-", "text-").replace("-600", "-700").replace("-400", "-300")                                                        
                )}>
                  {stat.label}
                </span>
              )}
              <Icon className={cn("h-5 w-5", stat.iconColor)} />
              {!isRTL && (
                <span className={cn(
                  "text-sm font-medium",
                  stat.iconColor.replace("text-", "text-").replace("-600", "-700").replace("-400", "-300")                                                        
                )}>
                  {stat.label}
                </span>
              )}
            </div>
            <p className={cn(
              "text-3xl font-bold",
              stat.iconColor.replace("text-", "text-").replace("-600", "-900").replace("-400", "-100"),
              isRTL && "text-right"
            )}>
              {stat.value}
            </p>
          </div>
        );
      })}
    </div>
  );
}

