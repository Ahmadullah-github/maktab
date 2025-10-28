import React from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, BookOpen } from "lucide-react";
import { Teacher } from "@/types";
import { AvailabilityEditor } from "./AvailabilityEditor";
import { SubjectsEditor } from "./SubjectsEditor";

interface ExpandedPanelProps {
  teacher: Teacher;
  subjects: Array<{ id: string; name: string; code?: string }>;
  schoolInfo: {
    workingDays: string[];
  };
  periodsInfo: {
    periodsPerDay: number;
    schoolStartTime: string;
    periodDuration: number;
  };
  loadingStates: Record<string, string | null>;
  onSaveAvailability: (availability: Record<string, boolean[]>) => Promise<void>;
  onSubjectToggle: (subjectId: string, isPrimary: boolean) => void;
  onRestrictToggle: (restricted: boolean) => void;
  columnCount: number; // For colspan
}

export function ExpandedPanel({
  teacher,
  subjects,
  schoolInfo,
  periodsInfo,
  loadingStates,
  onSaveAvailability,
  onSubjectToggle,
  onRestrictToggle,
  columnCount,
}: ExpandedPanelProps) {
  const isLoadingAvailability = loadingStates[teacher.id] === "availability";
  const isLoadingSubjects = loadingStates[teacher.id] === "subjects";

  return (
    <TableRow className="bg-gradient-to-b from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
      <TableCell colSpan={columnCount} className="p-0">
        <div className="px-6 py-4 border-t-2 border-blue-200 dark:border-blue-800">
          <Tabs defaultValue="availability" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2 mb-4">
              <TabsTrigger value="availability" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Availability
              </TabsTrigger>
              <TabsTrigger value="subjects" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Subjects
              </TabsTrigger>
            </TabsList>

            <TabsContent value="availability">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    Weekly Availability - {teacher.fullName}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <AvailabilityEditor
                    key={`${teacher.id}-availability-${JSON.stringify(teacher.availability)}`}
                    teacher={teacher}
                    onSave={onSaveAvailability}
                    onCancel={() => {}} // Not needed in inline mode
                    schoolInfo={schoolInfo}
                    periodsInfo={periodsInfo}
                    isLoading={isLoadingAvailability}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="subjects">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    Subject Assignments - {teacher.fullName}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <SubjectsEditor
                    key={`${teacher.id}-subjects-${teacher.primarySubjectIds.join(',')}-${teacher.restrictToPrimarySubjects}`}
                    teacher={teacher}
                    subjects={subjects}
                    onSubjectToggle={onSubjectToggle}
                    onRestrictToggle={onRestrictToggle}
                  />
                  {isLoadingSubjects && (
                    <div className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                      Updating subjects...
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </TableCell>
    </TableRow>
  );
}

