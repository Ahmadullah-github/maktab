import React from "react";
import { Subject } from "@/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  BookOpen, 
  Edit, 
  Trash2, 
  Calendar,
  AlertTriangle,
  Building,
  GraduationCap
} from "lucide-react";
import { cn } from "@/lib/utils/tailwaindMergeUtil";

interface SubjectCardProps {
  subject: Subject;
  onEdit: (subject: Subject) => void;
  onDelete: (subjectId: string) => void;
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

export function SubjectCard({ subject, onEdit, onDelete, isRTL = false }: SubjectCardProps) {
  const colors = getSectionColor(subject.section);
  const sectionLabel = getSectionLabel(subject.section, isRTL);

  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer border-2",
        "bg-gradient-to-br",
        colors.gradient
      )}
      onClick={() => onEdit(subject)}
    >
      {/* Difficulty Indicator */}
      {subject.isDifficult && (
        <div className={cn(
          "absolute top-4 p-2 rounded-full bg-amber-500 shadow-md",
          isRTL ? "left-4" : "right-4"
        )}>
          <AlertTriangle className="h-4 w-4 text-white" />
        </div>
      )}

      {/* Section Badge */}
      {subject.section && (
        <div className={cn(
          "absolute top-4 px-3 py-1 rounded-full shadow-md flex items-center gap-1",
          colors.badge,
          subject.isDifficult ? (isRTL ? "left-16" : "right-16") : (isRTL ? "left-4" : "right-4")
        )}>
          <GraduationCap className="h-4 w-4" />
          <span className="text-xs font-semibold">{sectionLabel}</span>
        </div>
      )}

      <div className="p-6">
        {/* Subject Name and Code */}
        <div className={cn(
          "mb-3",
          subject.isDifficult || subject.section ? "pr-24" : "pr-4",
          isRTL && (subject.isDifficult || subject.section ? "pl-24 pr-0" : "pl-4 pr-0")
        )}>
          <h3 className={cn(
            "text-xl font-bold text-gray-900 dark:text-gray-100 mb-1",
            isRTL && "text-right"
          )}>
            {subject.name}
          </h3>
          
          <div className={cn(
            "flex items-center gap-2 flex-wrap",
            isRTL && "flex-row"
          )}>
            {subject.code && (
              <Badge variant="secondary" className="text-xs bg-white/70 dark:bg-gray-800/70">
                {subject.code}
              </Badge>
            )}
            {subject.grade && (
              <div className={cn(
                "flex items-center gap-1.5 text-xs",
                colors.text
              )}>
                <BookOpen className="h-3 w-3" />
                <span className="font-medium">
                  {isRTL ? `پایه ${subject.grade}` : `Grade ${subject.grade}`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Subject Details */}
        <div className="space-y-2 mb-4">
          {/* Periods per Week */}
          {subject.periodsPerWeek && (
            <div className={cn(
              "flex items-center justify-between p-2 bg-white/60 dark:bg-gray-800/60 rounded",
              isRTL && "flex-row"
            )}>
              <div className={cn("flex items-center gap-2", isRTL && "flex-row")}>
                <Calendar className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {isRTL ? "دوره/هفته" : "Periods/week"}
                </span>
              </div>
              <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {subject.periodsPerWeek}
              </span>
            </div>
          )}

          {/* Room Type Requirement */}
          {subject.requiredRoomType && (
            <div className={cn(
              "flex items-center gap-2 p-2 bg-white/60 dark:bg-gray-800/60 rounded text-xs",
              isRTL && "flex-row"
            )}>
              <Building className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              <span className="text-gray-700 dark:text-gray-300">
                {subject.requiredRoomType}
              </span>
            </div>
          )}
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
              onEdit(subject);
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
              onDelete(subject.id);
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

