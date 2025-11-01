import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, HelpCircle, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { parseTimetableError, ParsedTimetableError } from "@/lib/errorParser";
import { cn } from "@/lib/utils/tailwaindMergeUtil";
import type { Teacher, Subject, ClassGroup, Room } from "@/types";

interface TimetableErrorDisplayProps {
  error: any; // Can be Error object, string, or structured error
  onDismiss?: () => void;
  // Entity stores for resolving names
  teachers?: Teacher[];
  subjects?: Subject[];
  classes?: ClassGroup[];
  rooms?: Room[];
}

/**
 * Resolve entity name by ID and type
 */
function resolveEntityName(
  entityId: string | null,
  entityType: "Teacher" | "Class" | "Subject" | "Room" | "Period" | null,
  teachers?: Teacher[],
  subjects?: Subject[],
  classes?: ClassGroup[],
  rooms?: Room[]
): string | null {
  if (!entityId || !entityType) return null;

  const id = String(entityId);

  switch (entityType) {
    case "Teacher":
      if (teachers) {
        const teacher = teachers.find((t) => String(t.id) === id);
        return teacher?.fullName || null;
      }
      break;
    case "Subject":
      if (subjects) {
        const subject = subjects.find((s) => String(s.id) === id);
        return subject?.name || null;
      }
      break;
    case "Class":
      if (classes) {
        const classGroup = classes.find((c) => String(c.id) === id);
        return classGroup?.name || null;
      }
      break;
    case "Room":
      if (rooms) {
        const room = rooms.find((r) => String(r.id) === id);
        return room?.name || null;
      }
      break;
  }
  return null;
}

/**
 * Get friendly error message based on error type and entity
 */
function getFriendlyMessage(
  parsed: ParsedTimetableError,
  entityName: string | null
): {
  title: string;
  message: string;
  steps: string[]; // Step-by-step instructions
  icon: React.ReactNode;
  colorClass: string;
} {
  const { entityType, entityId, field, day, expected, actual } = parsed;
  const displayName = entityName || entityId || "Unknown";

  // Teacher availability errors
  if (entityType === "Teacher" && field === "availability" && day) {
    if (expected && actual) {
      return {
        title: "Teacher Schedule Mismatch",
        message: `${displayName} has ${actual} time slots configured for ${day}, but ${expected} are required to match your school's schedule.`,
        steps: [
          `Go to the "Teachers" step in the wizard`,
          `Find and click on ${displayName} to edit their schedule`,
          `In the availability section, select "${day}"`,
          `Adjust the time slots to have exactly ${expected} periods`,
          `Make sure all ${expected} time slots are properly configured`,
          `Save the changes and try generating the timetable again`,
        ],
        icon: <AlertCircle className="h-5 w-5 text-amber-500" />,
        colorClass: "border-amber-200 bg-amber-50",
      };
    } else {
      return {
        title: "Missing Teacher Schedule",
        message: `${displayName} is missing schedule information for ${day}.`,
        steps: [
          `Go to the "Teachers" step in the wizard`,
          `Find and click on ${displayName} to edit their schedule`,
          `In the availability section, configure the schedule for "${day}"`,
          `Add ${expected || "the required number of"} time slots for ${day}`,
          `Save the changes and try generating the timetable again`,
        ],
        icon: <HelpCircle className="h-5 w-5 text-blue-500" />,
        colorClass: "border-blue-200 bg-blue-50",
      };
    }
  }

  // Teacher subject reference errors
  if (entityType === "Teacher" && field === "primarySubjectIds") {
    return {
      title: "Teacher Subject Assignment Issue",
      message: `${displayName} is assigned to teach a subject that doesn't exist in your subject list.`,
      steps: [
        `Go to the "Teachers" step in the wizard`,
        `Find and click on ${displayName} to edit their information`,
        `In the "Subjects" section, check the assigned subjects`,
        `Either remove the invalid subject assignment, or`,
        `If the subject should exist, go to the "Subjects" step and add it first`,
        `Save the changes and try generating the timetable again`,
      ],
      icon: <HelpCircle className="h-5 w-5 text-blue-500" />,
      colorClass: "border-blue-200 bg-blue-50",
    };
  }

  // Class subject requirement errors
  if (entityType === "Class" && field === "subjectRequirements") {
    return {
      title: "Class Subject Requirement Issue",
      message: `${displayName} requires a subject that doesn't exist in your subject list.`,
      steps: [
        `Go to the "Classes" step in the wizard`,
        `Find and click on ${displayName} to edit the class`,
        `In the "Subject Requirements" section, check which subjects are required`,
        `Either remove the invalid subject requirement, or`,
        `If the subject should exist, go to the "Subjects" step and add it first`,
        `Save the changes and try generating the timetable again`,
      ],
      icon: <HelpCircle className="h-5 w-5 text-blue-500" />,
      colorClass: "border-blue-200 bg-blue-50",
    };
  }

  // Generic teacher errors
  if (entityType === "Teacher") {
    return {
      title: "Teacher Configuration Issue",
      message: `There's an issue with ${displayName}'s configuration.`,
      steps: [
        `Go to the "Teachers" step in the wizard`,
        `Find and click on ${displayName} to edit`,
        `Review all settings and ensure everything is configured correctly`,
        `Pay special attention to availability, subjects, and other requirements`,
        `Save the changes and try generating the timetable again`,
      ],
      icon: <HelpCircle className="h-5 w-5 text-blue-500" />,
      colorClass: "border-blue-200 bg-blue-50",
    };
  }

  // Generic class errors
  if (entityType === "Class") {
    return {
      title: "Class Configuration Issue",
      message: `There's an issue with ${displayName}'s configuration.`,
      steps: [
        `Go to the "Classes" step in the wizard`,
        `Find and click on ${displayName} to edit`,
        `Review all settings including subject requirements`,
        `Ensure all referenced subjects exist in your subject list`,
        `Save the changes and try generating the timetable again`,
      ],
      icon: <HelpCircle className="h-5 w-5 text-blue-500" />,
      colorClass: "border-blue-200 bg-blue-50",
    };
  }

  // Generic validation errors
  return {
    title: "Configuration Issue",
    message: parsed.userMessage || "There's an issue with your timetable configuration.",
    steps: [
      `Review the error details below`,
      `Check your wizard configuration in the relevant steps`,
      `Ensure all required fields are filled correctly`,
      `Verify that all references between entities are valid`,
      `Try generating the timetable again`,
    ],
    icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
    colorClass: "border-amber-200 bg-amber-50",
  };
}

export function TimetableErrorDisplay({
  error,
  onDismiss,
  teachers,
  subjects,
  classes,
  rooms,
}: TimetableErrorDisplayProps) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const parsedError = parseTimetableError(error);

  if (!parsedError) {
    // Fallback for unparseable errors
    const errorMessage = typeof error === 'string' 
      ? error 
      : error?.message || 'An unknown error occurred.';
    
    return (
      <Card className="border-amber-200 bg-amber-50 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-800">
            <AlertTriangle className="h-5 w-5" />
            Something Went Wrong
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-amber-700 mb-4">
            We encountered an issue while generating your timetable. Please try again, and if the problem persists, contact support.
          </p>
          {onDismiss && (
            <Button onClick={onDismiss} variant="outline" size="sm">
              Dismiss
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const { entityId, entityType } = parsedError;
  
  // Resolve entity name
  const entityName = resolveEntityName(
    entityId,
    entityType,
    teachers,
    subjects,
    classes,
    rooms
  );

  const friendlyInfo = getFriendlyMessage(parsedError, entityName);

  return (
    <Card className={cn("shadow-lg", friendlyInfo.colorClass)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-gray-800">
          {friendlyInfo.icon}
          {friendlyInfo.title}
        </CardTitle>
        <CardDescription className="text-gray-700 font-medium text-base mt-2">
          {friendlyInfo.message}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Step-by-step instructions */}
        <div className="bg-white/80 rounded-lg p-5 border border-gray-200">
          <div className="flex items-start gap-2 mb-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <h4 className="font-semibold text-gray-800">Here's what you need to do:</h4>
          </div>
          <ol className="space-y-3 ml-7">
            {friendlyInfo.steps.map((step, index) => (
              <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="font-semibold text-blue-600 flex-shrink-0 w-6">
                  {index + 1}.
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Action button */}
        <div className="flex gap-2 pt-2">
          {onDismiss && (
            <Button 
              onClick={onDismiss} 
              variant="outline" 
              size="lg"
              className="border-gray-300"
            >
              Got it, I'll fix this
            </Button>
          )}
        </div>

        {/* Technical details (collapsible) */}
        <div className="pt-2 border-t border-gray-200">
          <button
            onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
            className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            {showTechnicalDetails ? (
              <>
                <ChevronUp className="h-3 w-3" />
                Hide Technical Details
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" />
                Show Technical Details
              </>
            )}
          </button>
          
          {showTechnicalDetails && (
            <div className="mt-3 p-3 bg-gray-50 rounded text-xs font-mono text-gray-600 overflow-auto max-h-48">
              <div className="space-y-1">
                {parsedError.entityType && (
                  <div><span className="font-semibold">Entity Type:</span> {parsedError.entityType}</div>
                )}
                {parsedError.entityId && (
                  <div><span className="font-semibold">Entity ID:</span> {parsedError.entityId}</div>
                )}
                {entityName && (
                  <div><span className="font-semibold">Entity Name:</span> {entityName}</div>
                )}
                {parsedError.field && (
                  <div><span className="font-semibold">Field:</span> {parsedError.field}</div>
                )}
                {parsedError.day && (
                  <div><span className="font-semibold">Day:</span> {parsedError.day}</div>
                )}
                {parsedError.expected && (
                  <div><span className="font-semibold">Expected:</span> {parsedError.expected}</div>
                )}
                {parsedError.actual && (
                  <div><span className="font-semibold">Actual:</span> {parsedError.actual}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
