import React, { useMemo } from "react";
import { Subject } from "@/types";
import { BookOpen, GraduationCap, Layers, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils/tailwaindMergeUtil";

interface SubjectStatisticsProps {
  subjects: Subject[];
  isRTL?: boolean;
}

export function SubjectStatistics({ subjects, isRTL = false }: SubjectStatisticsProps) {
  const stats = useMemo(() => {
    const totalSubjects = subjects.length;
    const primarySubjects = subjects.filter(s => s.section === 'PRIMARY').length;
    const middleSubjects = subjects.filter(s => s.section === 'MIDDLE').length;
    const highSubjects = subjects.filter(s => s.section === 'HIGH').length;
    const difficultSubjects = subjects.filter(s => s.isDifficult).length;
    const avgPeriods = totalSubjects > 0 
      ? Math.round(subjects.reduce((sum, s) => sum + (s.periodsPerWeek || 0), 0) / totalSubjects) 
      : 0;

    return {
      totalSubjects,
      primarySubjects,
      middleSubjects,
      highSubjects,
      difficultSubjects,
      avgPeriods,
    };
  }, [subjects]);

  const statCards = [
    {
      icon: BookOpen,
      label: isRTL ? "کل مواد" : "Total Subjects",
      value: stats.totalSubjects,
      gradient: "from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-900",
      border: "border-indigo-200 dark:border-indigo-800",
      iconColor: "text-indigo-600 dark:text-indigo-400",
    },
    {
      icon: GraduationCap,
      label: isRTL ? "ابتدایی" : "Primary",
      value: stats.primarySubjects,
      gradient: "from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900",
      border: "border-blue-200 dark:border-blue-800",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      icon: GraduationCap,
      label: isRTL ? "متوسطه" : "Middle",
      value: stats.middleSubjects,
      gradient: "from-green-50 to-green-100 dark:from-green-950 dark:to-green-900",
      border: "border-green-200 dark:border-green-800",
      iconColor: "text-green-600 dark:text-green-400",
    },
    {
      icon: GraduationCap,
      label: isRTL ? "دبیرستان" : "High",
      value: stats.highSubjects,
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
              <Icon className={cn("h-5 w-5", stat.iconColor)} />
              <span className={cn(
                "text-sm font-medium",
                stat.iconColor.replace("text-", "text-").replace("-600", "-700").replace("-400", "-300")
              )}>
                {stat.label}
              </span>
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

