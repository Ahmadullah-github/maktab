import React from "react";
import { Teacher, Subject } from "@/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  User, 
  Edit, 
  Trash2, 
  Calendar,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils/tailwaindMergeUtil";

interface TeacherCardProps {
  teacher: Teacher;
  subjects: Subject[];
  currentPeriods: number;
  assignedClassesCount: number;
  onEdit: (teacher: Teacher) => void;
  onDelete: (teacherId: string) => void;
  isRTL?: boolean;
}


export function TeacherCard({ 
  teacher, 
  subjects, 
  currentPeriods, 
  assignedClassesCount,
  onEdit, 
  onDelete, 
  isRTL = false 
}: TeacherCardProps) {
  // Get expert subjects (first 3 for display)
  const expertSubjects = teacher.primarySubjectIds
    .map(id => subjects.find(s => s.id === id))
    .filter((s): s is Subject => s !== undefined)
    .slice(0, 3);
  
  const remainingSubjectsCount = teacher.primarySubjectIds.length - expertSubjects.length;
  
  // Calculate periods percentage
  const periodsPercentage = teacher.maxPeriodsPerWeek > 0 
    ? Math.min((currentPeriods / teacher.maxPeriodsPerWeek) * 100, 100)
    : 0;
  
  const isOverloaded = currentPeriods >= teacher.maxPeriodsPerWeek;
  const isUnderloaded = currentPeriods < teacher.maxPeriodsPerWeek * 0.7;

  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer border-2",
        "bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 border-slate-300 dark:border-slate-700"
      )}
      onClick={() => onEdit(teacher)}
    >
      <div className="p-6">
        {/* Teacher Name */}
        <div className="mb-3">
          <h3 className={cn(
            "text-xl font-bold text-gray-900 dark:text-gray-100 mb-2",
            isRTL && "text-right"
          )}>
            {teacher.fullName}
          </h3>
        </div>

        {/* Expert Subjects */}
        {expertSubjects.length > 0 && (
          <div className="mb-3">
            <div className={cn(
              "flex flex-wrap gap-1.5 mb-2",
              isRTL && "flex-row"
            )}>
              {expertSubjects.map((subject) => (
                <Badge 
                  key={subject.id} 
                  variant="secondary" 
                  className="text-xs bg-white/70 dark:bg-gray-800/70"
                >
                  {subject.name}
                  {subject.grade && (
                    <span className="ml-1 opacity-75">
                      {isRTL ? `(پایه ${subject.grade})` : `(G${subject.grade})`}
                    </span>
                  )}
                </Badge>
              ))}
              {remainingSubjectsCount > 0 && (
                <Badge variant="outline" className="text-xs">
                  +{remainingSubjectsCount}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Periods Usage */}
        <div className={cn(
          "mb-3 p-3 bg-white/60 dark:bg-gray-800/60 rounded",
          isRTL && "text-right"
        )}>
          <div className={cn(
            "flex items-center justify-between mb-2",
            isRTL && "flex-row"
          )}>
            <div className={cn("flex items-center gap-2", isRTL && "flex-row")}>
              <Calendar className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {isRTL ? "دوره/هفته" : "Periods/week"}
              </span>
            </div>
            <span className={cn(
              "text-lg font-bold",
              isOverloaded ? "text-red-600 dark:text-red-400" :
              isUnderloaded ? "text-amber-600 dark:text-amber-400" :
              "text-gray-900 dark:text-gray-100"
            )}>
              {currentPeriods}/{teacher.maxPeriodsPerWeek}
            </span>
          </div>
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className={cn(
                "h-2 rounded-full transition-all",
                isOverloaded ? "bg-red-500" :
                isUnderloaded ? "bg-amber-500" :
                "bg-green-500"
              )}
              style={{ width: `${periodsPercentage}%` }}
            />
          </div>
        </div>

        {/* Assigned Classes */}
        {assignedClassesCount > 0 && (
          <div className={cn(
            "flex items-center gap-2 p-2 bg-white/60 dark:bg-gray-800/60 rounded text-sm mb-3",
            isRTL && "flex-row"
          )}>
            <Users className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            <span className="text-gray-700 dark:text-gray-300">
              {isRTL ? `${assignedClassesCount} صنف` : `${assignedClassesCount} classes`}
            </span>
          </div>
        )}

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
              onEdit(teacher);
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
              onDelete(teacher.id);
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

