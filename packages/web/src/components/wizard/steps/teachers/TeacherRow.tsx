import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { Trash2, Copy, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Teacher } from "@/types";
import { EditableCell } from "./EditableCell";

interface TeacherRowProps {
  teacher: Teacher;
  subjects: Array<{ id: string; name: string; code?: string }>;
  isSelected: boolean;
  isExpanded: boolean;
  loadingStates: Record<string, string | null>;
  onSelect: () => void;
  onExpand: () => void;
  onUpdateField: (field: string, value: any) => Promise<boolean>;
  onDelete: () => void;
  onDuplicate: () => void;
  getSubjectName: (subjectId: string) => string;
}

export function TeacherRow({
  teacher,
  subjects,
  isSelected,
  isExpanded,
  loadingStates,
  onSelect,
  onExpand,
  onUpdateField,
  onDelete,
  onDuplicate,
  getSubjectName,
}: TeacherRowProps) {
  const isDeleting = loadingStates[teacher.id] === "delete";
  const isDuplicating = loadingStates[teacher.id] === "duplicate";

  return (
    <>
      <TableRow
        className={`
          ${isExpanded ? "bg-blue-50 dark:bg-blue-950/20" : ""}
          ${isSelected ? "bg-yellow-50 dark:bg-yellow-950/20" : ""}
          transition-colors
        `}
      >
        {/* Checkbox */}
        <TableCell className="w-[50px]">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className="rounded border-gray-300"
          />
        </TableCell>

        {/* Expand Icon */}
        <TableCell className="w-[50px]">
          <Button
            size="sm"
            variant="ghost"
            onClick={onExpand}
            className="h-8 w-8 p-0"
            title={isExpanded ? "Collapse" : "Expand to edit availability & subjects"}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </TableCell>

        {/* Name */}
        <TableCell className="w-[200px]">
          <div className="flex items-center gap-2">
            <span className="font-medium text-base">{teacher.fullName}</span>
            {teacher.timePreference !== "None" && (
              <Badge
                variant={teacher.timePreference === "Morning" ? "default" : "secondary"}
                className="text-xs"
              >
                {teacher.timePreference}
              </Badge>
            )}
          </div>
        </TableCell>

        {/* Max Periods/Week - Editable */}
        <TableCell className="w-[150px]">
          <EditableCell
            key={`${teacher.id}-maxPeriodsPerWeek-${teacher.maxPeriodsPerWeek}`}
            value={teacher.maxPeriodsPerWeek}
            field="maxPeriodsPerWeek"
            type="number"
            min={1}
            max={40}
            onSave={async (value) => await onUpdateField("maxPeriodsPerWeek", value)}
            isLoading={loadingStates[teacher.id] === "maxPeriodsPerWeek"}
          />
        </TableCell>

        {/* Time Preference - Editable */}
        <TableCell className="w-[150px]">
          <EditableCell
            key={`${teacher.id}-timePreference-${teacher.timePreference || "None"}`}
            value={teacher.timePreference || "None"}
            field="timePreference"
            type="select"
            options={[
              { value: "None", label: "No Preference" },
              { value: "Morning", label: "Morning" },
              { value: "Afternoon", label: "Afternoon" },
            ]}
            onSave={async (value) => await onUpdateField("timePreference", value)}
            isLoading={loadingStates[teacher.id] === "timePreference"}
          />
        </TableCell>

        {/* Primary Subjects */}
        <TableCell className="w-[200px]">
          <div className="flex flex-wrap gap-1">
            {teacher.primarySubjectIds.length > 0 ? (
              teacher.primarySubjectIds.map((subjectId) => (
                <Badge key={subjectId} variant="outline" className="text-xs">
                  {getSubjectName(subjectId)}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">No subjects</span>
            )}
          </div>
        </TableCell>

        {/* Max Periods/Day - Editable */}
        <TableCell className="w-[120px]">
          <EditableCell
            key={`${teacher.id}-maxPeriodsPerDay-${teacher.maxPeriodsPerDay || 0}`}
            value={teacher.maxPeriodsPerDay || 0}
            field="maxPeriodsPerDay"
            type="number"
            min={0}
            max={10}
            onSave={async (value) => await onUpdateField("maxPeriodsPerDay", value)}
            isLoading={loadingStates[teacher.id] === "maxPeriodsPerDay"}
            displayValue={teacher.maxPeriodsPerDay ? String(teacher.maxPeriodsPerDay) : "-"}
          />
        </TableCell>

        {/* Max Consecutive - Editable */}
        <TableCell className="w-[120px]">
          <EditableCell
            key={`${teacher.id}-maxConsecutivePeriods-${teacher.maxConsecutivePeriods || 0}`}
            value={teacher.maxConsecutivePeriods || 0}
            field="maxConsecutivePeriods"
            type="number"
            min={0}
            max={8}
            onSave={async (value) => await onUpdateField("maxConsecutivePeriods", value)}
            isLoading={loadingStates[teacher.id] === "maxConsecutivePeriods"}
            displayValue={teacher.maxConsecutivePeriods ? String(teacher.maxConsecutivePeriods) : "-"}
          />
        </TableCell>

        {/* Actions */}
        <TableCell className="w-[120px]">
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
              disabled={isDuplicating}
              className="h-8 px-2 hover:bg-green-50 hover:text-green-600 transition-colors"
              title="Duplicate teacher"
            >
              {isDuplicating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              disabled={isDeleting}
              className="h-8 px-2 hover:bg-red-50 hover:text-red-600 transition-colors"
              title="Delete teacher"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </TableCell>
      </TableRow>
    </>
  );
}

