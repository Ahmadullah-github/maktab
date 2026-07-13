/**
 * ClassInspector Component
 *
 * A side panel for viewing and editing class details.
 * Opens on the left side (RTL layout) with a tabbed interface.
 *
 * Features:
 * - Tabbed interface: Basic Info, Subject Requirements, Assignments
 * - Close button and deselect handling
 * - Integrates with update mutation for saving changes
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 8.1, 8.2, 8.3, 8.4, 11.2, 11.3
 */

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { classFormSchema, type ClassFormValues } from '@/schemas/class.schema';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Info, Loader2, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { ClassGroup, SubjectRequirement } from '../types';
import { shouldEnableSingleTeacherMode } from '../utils/gradeCategory';
import { componentLogger, logger } from '../utils/logger';
import { SubjectRequirementsEditor } from './SubjectRequirementsEditor';
import { GradeBadge } from './ui/GradeBadge';
import { RoomSelector } from './ui/RoomSelector';
import { SingleTeacherBadge } from './ui/SingleTeacherBadge';

/**
 * Teacher type for the class teacher selector
 */
interface Teacher {
  id: number;
  fullName: string;
  isDeleted?: boolean;
}

/**
 * Props for the ClassInspector component
 */
export interface ClassInspectorProps {
  /** The class to display/edit, or null if none selected */
  classData: ClassGroup | null;
  /** Callback when the inspector should close */
  onClose: () => void;
  /** Callback when the class is updated */
  onUpdate: (id: number, data: Partial<ClassFormValues>) => Promise<void>;
  /** Whether an update is in progress */
  isUpdating?: boolean;
  /** IDs of rooms already assigned to other classes */
  assignedRoomIds?: number[];
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Hook to fetch teachers for the class teacher selector
 */
function useTeachers() {
  return useQuery({
    queryKey: ['teachers'],
    queryFn: async () => {
      const response = (await api.teachers.list()) as Teacher[];
      return response.filter((teacher) => !teacher.isDeleted);
    },
  });
}

/**
 * Grade options for the grade selector (1-12)
 */
const GRADE_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

/**
 * Tab values for the inspector
 */
type InspectorTab = 'basicInfo' | 'subjectRequirements' | 'assignments';

/**
 * ClassInspector provides a side panel for viewing and editing class details
 *
 * @example
 * ```tsx
 * <ClassInspector
 *   classData={selectedClass}
 *   onClose={() => setSelectedClass(null)}
 *   onUpdate={handleUpdate}
 *   isUpdating={isPending}
 * />
 * ```
 */
export function ClassInspector({
  classData,
  onClose,
  onUpdate,
  isUpdating = false,
  assignedRoomIds = [],
  className,
}: ClassInspectorProps) {
  const { t } = useTranslation();
  const { data: teachers = [], isLoading: isLoadingTeachers } = useTeachers();
  const [activeTab, setActiveTab] = useState<InspectorTab>('basicInfo');

  // Initialize form with react-hook-form and Zod validation
  const form = useForm<ClassFormValues>({
    resolver: zodResolver(classFormSchema),
    defaultValues: getDefaultValues(classData),
  });

  // Watch grade field to auto-enable single-teacher mode
  const watchedGrade = form.watch('grade');
  const watchedSingleTeacherMode = form.watch('singleTeacherMode');

  // Debug logging on mount
  useEffect(() => {
    componentLogger.mount('ClassInspector', {
      hasClassData: !!classData,
      classId: classData?.id,
    });
    return () => componentLogger.unmount('ClassInspector');
  }, [classData]);

  // Reset form when classData changes
  useEffect(() => {
    if (classData) {
      form.reset(getDefaultValues(classData));
      logger.debug('ClassInspector: form reset with class data', { classId: classData.id });
    }
  }, [classData, form]);

  // Auto-enable single-teacher mode for grades 1-3
  useEffect(() => {
    if (watchedGrade !== null && shouldEnableSingleTeacherMode(watchedGrade)) {
      const currentValue = form.getValues('singleTeacherMode');
      if (!currentValue) {
        logger.debug('Auto-enabling single-teacher mode for grade', { grade: watchedGrade });
        form.setValue('singleTeacherMode', true);
      }
    }
  }, [watchedGrade, form]);

  // Clear classTeacherId when single-teacher mode is disabled
  useEffect(() => {
    if (!watchedSingleTeacherMode) {
      const currentTeacherId = form.getValues('classTeacherId');
      if (currentTeacherId !== null) {
        logger.debug('Clearing classTeacherId as single-teacher mode is disabled');
        form.setValue('classTeacherId', null);
      }
    }
  }, [watchedSingleTeacherMode, form]);

  // Handle form submission
  const handleSubmit = async (values: ClassFormValues) => {
    if (!classData) return;

    logger.debug('ClassInspector: submitting form', { classId: classData.id, name: values.name });

    // Normalize optional fields
    const normalizedValues: Partial<ClassFormValues> = {
      ...values,
      fixedRoomId: values.fixedRoomId ?? null,
      classTeacherId: values.classTeacherId ?? null,
      displayName: values.displayName ?? '',
      sectionIndex: values.sectionIndex ?? '',
    };

    await onUpdate(classData.id, normalizedValues);
  };

  // Handle subject requirements change
  const handleSubjectRequirementsChange = async (requirements: SubjectRequirement[]) => {
    if (!classData) return;

    logger.debug('ClassInspector: updating subject requirements', {
      classId: classData.id,
      count: requirements.length,
    });

    await onUpdate(classData.id, { subjectRequirements: requirements });
  };

  // Translate validation error messages
  const translateError = (message: string | undefined): string | undefined => {
    if (!message) return undefined;
    if (message.startsWith('classes.')) {
      return t(message);
    }
    return message;
  };

  // Don't render if no class is selected
  if (!classData) {
    return null;
  }

  // Filter out current class's room from assigned rooms
  const filteredAssignedRoomIds = assignedRoomIds.filter((id) => id !== classData.fixedRoomId);

  return (
    <div
      className={cn(
        'flex flex-col h-full border-e bg-background',
        'w-full sm:w-[350px] md:w-[400px] lg:w-[450px]',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="font-semibold text-lg">{classData.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <GradeBadge grade={classData.grade} showCategoryLabel />
              <SingleTeacherBadge enabled={classData.singleTeacherMode} />
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8"
          aria-label={t('common.cancel')}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(value: string) => setActiveTab(value as InspectorTab)}
        className="flex-1 flex flex-col"
      >
        <TabsList className="mx-4 mt-4 grid grid-cols-3">
          <TabsTrigger value="basicInfo" className="gap-1.5">
            <Info className="h-4 w-4" />
            <span className="hidden sm:inline">{t('classes.tabs.basicInfo')}</span>
          </TabsTrigger>
          <TabsTrigger value="subjectRequirements" className="gap-1.5">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">{t('classes.tabs.subjectRequirements')}</span>
          </TabsTrigger>
          <TabsTrigger value="assignments" className="gap-1.5">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">{t('classes.tabs.assignments')}</span>
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          {/* Basic Info Tab */}
          <TabsContent value="basicInfo" className="p-4 mt-0">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                {/* Class Name */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>{t('classes.form.name')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('classes.form.namePlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage>{translateError(fieldState.error?.message)}</FormMessage>
                    </FormItem>
                  )}
                />

                {/* Grade and Section Index */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="grade"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel>{t('classes.form.grade')}</FormLabel>
                        <Select
                          value={field.value?.toString() || ''}
                          onValueChange={(value: string) => {
                            const numValue = value ? parseInt(value, 10) : null;
                            field.onChange(numValue);
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('classes.form.gradePlaceholder')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {GRADE_OPTIONS.map((grade) => (
                              <SelectItem key={grade} value={grade.toString()}>
                                {grade}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage>{translateError(fieldState.error?.message)}</FormMessage>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sectionIndex"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('classes.form.sectionIndex')}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t('classes.form.sectionIndexPlaceholder')}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Student Count */}
                <FormField
                  control={form.control}
                  name="studentCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('classes.form.studentCount')}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={500}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Fixed Room Selector */}
                <FormField
                  control={form.control}
                  name="fixedRoomId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('classes.form.fixedRoom')}</FormLabel>
                      <FormControl>
                        <RoomSelector
                          value={field.value ?? null}
                          onChange={field.onChange}
                          assignedRoomIds={filteredAssignedRoomIds}
                          currentClassId={classData.id}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Single-Teacher Mode Toggle */}
                <FormField
                  control={form.control}
                  name="singleTeacherMode"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          {t('classes.form.singleTeacherMode')}
                        </FormLabel>
                        <FormDescription>{t('classes.form.singleTeacherModeDesc')}</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Class Teacher Selector - Only shown when single-teacher mode is enabled */}
                {watchedSingleTeacherMode && (
                  <FormField
                    control={form.control}
                    name="classTeacherId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('classes.form.classTeacher')}</FormLabel>
                        <Select
                          value={field.value?.toString() || ''}
                          onValueChange={(value: string) => {
                            const numValue = value ? parseInt(value, 10) : null;
                            field.onChange(numValue);
                          }}
                          disabled={isLoadingTeachers}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={t('classes.form.classTeacherPlaceholder')}
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {teachers.map((teacher) => (
                              <SelectItem key={teacher.id} value={teacher.id.toString()}>
                                {teacher.fullName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Save Button */}
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={isUpdating}>
                    {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('common.saveChanges')}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>

          {/* Subject Requirements Tab */}
          <TabsContent value="subjectRequirements" className="p-4 mt-0">
            <SubjectRequirementsEditor
              value={classData.subjectRequirements}
              onChange={handleSubjectRequirementsChange}
              disabled={isUpdating}
              showTeacherColumn={!classData.singleTeacherMode}
              classGrade={classData.grade}
              classId={classData.id}
            />
          </TabsContent>

          {/* Assignments Tab */}
          <TabsContent value="assignments" className="p-4 mt-0">
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Users className="h-12 w-12 mb-4 opacity-30" />
              <p className="text-sm">{t('common.notImplemented')}</p>
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

/**
 * Get default form values from class data
 */
function getDefaultValues(classData: ClassGroup | null): ClassFormValues {
  if (!classData) {
    return {
      name: '',
      displayName: '',
      grade: null,
      sectionIndex: '',
      studentCount: 0,
      fixedRoomId: null,
      singleTeacherMode: false,
      classTeacherId: null,
      subjectRequirements: [],
    };
  }

  return {
    name: classData.name,
    displayName: classData.displayName || '',
    grade: classData.grade,
    sectionIndex: classData.sectionIndex || '',
    studentCount: classData.studentCount,
    fixedRoomId: classData.fixedRoomId,
    singleTeacherMode: classData.singleTeacherMode,
    classTeacherId: classData.classTeacherId,
    subjectRequirements: classData.subjectRequirements || [],
  };
}

export default ClassInspector;
