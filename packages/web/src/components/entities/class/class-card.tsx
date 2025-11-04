import React from "react";
import { ClassGroup } from "@/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  Edit, 
  Trash2, 
  BookOpen,
  GraduationCap,
  Calendar
} from "lucide-react";
import { cn } from "@/lib/utils/tailwaindMergeUtil";

interface ClassCardProps {
  classGroup: ClassGroup;
  onEdit: (classGroup: ClassGroup) => void;
  onDelete: (classId: string) => void;
  isRTL?: boolean;
}

const getSectionColor = (section?: 'PRIMARY' | 'MIDDLE' | 'HIGH') => {
  switch (section) {
    case 'PRIMARY':
      return {
        gradient: "from-blue-100 via-blue-50 to-blue-100 dark:from-blue-900 dark:via-blue-950 dark:to-blue-900 border-blue-300 dark:border-blue-700",
        badge: "bg-blue-500 text-white",
        text: "text-blue-700 dark:text-blue-300"
      };
    case 'MIDDLE':
      return {
        gradient: "from-green-100 via-green-50 to-green-100 dark:from-green-900 dark:via-green-950 dark:to-green-900 border-green-300 dark:border-green-700",
        badge: "bg-green-500 text-white",
        text: "text-green-700 dark:text-green-300"
      };
    case 'HIGH':
      return {
        gradient: "from-purple-100 via-purple-50 to-purple-100 dark:from-purple-900 dark:via-purple-950 dark:to-purple-900 border-purple-300 dark:border-purple-700",
        badge: "bg-purple-500 text-white",
        text: "text-purple-700 dark:text-purple-300"
      };
    default:
      return {
        gradient: "from-slate-100 via-slate-50 to-slate-100 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 border-slate-300 dark:border-slate-700",
        badge: "bg-slate-500 text-white",
        text: "text-slate-700 dark:text-slate-300"
      };
  }
};

const getSectionLabel = (section?: 'PRIMARY' | 'MIDDLE' | 'HIGH', isRTL?: boolean) => {
  if (isRTL) {
    switch (section) {
      case 'PRIMARY': return 'ابتدایی';
      case 'MIDDLE': return 'متوسطه';
      case 'HIGH': return 'دبیرستان';
      default: return 'نامشخص';
    }
  }
  return section || 'Unknown';
};

export function ClassCard({ classGroup, onEdit, onDelete, isRTL = false }: ClassCardProps) {
  const colors = getSectionColor(classGroup.section);
  const sectionLabel = getSectionLabel(classGroup.section, isRTL);
  
  // Calculate total periods per week
  const totalPeriods = classGroup.subjectRequirements.reduce(
    (sum, req) => sum + req.periodsPerWeek, 
    0
  );

  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer border-2",
        "bg-gradient-to-br",
        colors.gradient
      )}
      onClick={() => onEdit(classGroup)}
    >
      {/* Section Badge in Top Right/Left */}
      <div className={cn(
        "absolute top-4 px-3 py-1 rounded-full shadow-md flex items-center gap-1",
        colors.badge,
        isRTL ? "left-4" : "right-4"
      )}>
        <GraduationCap className="h-4 w-4" />
        <span className="text-xs font-semibold">{sectionLabel}</span>
      </div>

      <div className="p-6">
        {/* Class Name and Grade */}
        <div className={cn("mb-3 pr-24", isRTL && "pl-24 pr-0")}>
          <h3 className={cn(
            "text-xl font-bold text-gray-900 dark:text-gray-100 mb-1",
            isRTL && "text-right"
          )}>
            {classGroup.name}
          </h3>
          
          {classGroup.grade && (
            <div className={cn(
              "flex items-center gap-1.5",
              colors.text,
              isRTL && "flex-row"
            )}>
              <BookOpen className="h-4 w-4" />
              <span className="text-sm font-medium">
                {isRTL ? `پایه ${classGroup.grade}` : `Grade ${classGroup.grade}`}
              </span>
            </div>
          )}
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {/* Student Count */}
          <div className={cn(
            "flex flex-col items-center justify-center p-3 bg-white/60 dark:bg-gray-800/60 rounded-lg",
            isRTL && "text-right"
          )}>
            <Users className="h-5 w-5 text-gray-600 dark:text-gray-400 mb-1" />
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {classGroup.studentCount}
            </span>
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {isRTL ? "دانش‌آموز" : "Students"}
            </span>
          </div>

          {/* Subject Count */}
          <div className={cn(
            "flex flex-col items-center justify-center p-3 bg-white/60 dark:bg-gray-800/60 rounded-lg",
            isRTL && "text-right"
          )}>
            <BookOpen className="h-5 w-5 text-gray-600 dark:text-gray-400 mb-1" />
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {classGroup.subjectRequirements.length}
            </span>
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {isRTL ? "مواد" : "Subjects"}
            </span>
          </div>

          {/* Total Periods */}
          <div className={cn(
            "flex flex-col items-center justify-center p-3 bg-white/60 dark:bg-gray-800/60 rounded-lg",
            isRTL && "text-right"
          )}>
            <Calendar className="h-5 w-5 text-gray-600 dark:text-gray-400 mb-1" />
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {totalPeriods}
            </span>
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {isRTL ? "دوره/هفته" : "Periods/wk"}
            </span>
          </div>
        </div>

        {/* Action Buttons - Shown on hover */}
        <div className={cn(
          "flex gap-2 pt-4 border-t border-gray-300 dark:border-gray-700 opacity-0 group-hover:opacity-100 transition-opacity",
          isRTL && "flex-row"
        )}>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(classGroup);
            }}
            className={cn(
              "flex-1 bg-white/80 hover:bg-white text-black/60 hover:text-black/80 dark:bg-gray-800/80 dark:hover:bg-gray-800",
              isRTL && "flex-row"
            )}
          >
            <Edit className="h-4 w-4 me-1" />
            {isRTL ? "ویرایش" : "Edit"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(classGroup.id);
            }}
            className={cn(
              "flex-1 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-400 border-red-200 dark:bg-red-950/30 dark:hover:bg-red-950/50",
              isRTL && "flex-row"
            )}
          >
            <Trash2 className="h-4 w-4 me-1" />
            {isRTL ? "حذف" : "Delete"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

