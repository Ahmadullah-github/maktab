/**
 * ClassEditDrawer Component
 *
 * Inline edit panel that replaces stats card when a class is selected.
 * Contains tabbed form for editing class details.
 * Follows TeacherEditDrawer pattern.
 *
 * Phase 1.2: Added "Apply Curriculum" button for populating subject requirements
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
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
import {
  AlertTriangle,
  BookOpen,
  Building,
  CheckCircle,
  GraduationCap,
  Info,
  Library,
  Loader2,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useCurriculumPopulation } from '../hooks/useCurriculumPopulation';
import type { ClassGroup, SubjectRequirement } from '../types';
import { getGradeCategory, shouldEnableSingleTeacherMode } from '../utils/gradeCategory';
import { ClassAssignmentManager } from './ClassAssignmentManager';
import { SubjectRequirementsEditor } from './SubjectRequirementsEditor';
import { RoomSelector } from './ui/RoomSelector';

export interface ClassEditDrawerProps {
  classData: ClassGroup;
  onClose: () => void;
  onUpdate: (id: number, data: Partial<ClassFormValues>) => Promise<void>;
  isUpdating?: boolean;
  assignedRoomIds?: number[];
  className?: string;
}

type EditTab = 'info' | 'room' | 'subjects';

interface Teacher {
  id: number;
  fullName: string;
  isDeleted?: boolean;
}

function useTeachers() {
  return useQuery({
    queryKey: ['teachers'],
    queryFn: async () => {
      const response = (await api.teachers.list()) as Teacher[];
      return response.filter((t) => !t.isDeleted);
    },
  });
}

const GRADE_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

const GRADE_CATEGORY_LABELS: Record<string, string> = {
  alphaPrimary: 'classes.filters.alphaPrimary',
  betaPrimary: 'classes.filters.betaPrimary',
  middle: 'classes.filters.middle',
  high: 'classes.filters.high',
  unknown: 'common.unknown',
};

function getDefaultValues(classData: ClassGroup): ClassFormValues {
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

export function ClassEditDrawer({
  classData,
  onClose,
  onUpdate,
  isUpdating = false,
  assignedRoomIds = [],
  className,
}: ClassEditDrawerProps) {
  const { t } = useTranslation();
  const { data: teachers = [], isLoading: isLoadingTeachers } = useTeachers();
  const [activeTab, setActiveTab] = useState<EditTab>('info');
  const [showCurriculumDialog, setShowCurriculumDialog] = useState(false);

  // Curriculum population hook
  const {
    curriculumPreview,
    canApplyCurriculum,
    hasExistingRequirements,
    isApplying,
    applyCurriculum,
  } = useCurriculumPopulation({
    classId: classData.id,
    classGrade: classData.grade,
    currentRequirements: classData.subjectRequirements,
    onSuccess: () => {
      setShowCurriculumDialog(false);
    },
  });

  const form = useForm<ClassFormValues>({
    resolver: zodResolver(classFormSchema) as any,
    defaultValues: getDefaultValues(classData),
  });

  useEffect(() => {
    form.reset(getDefaultValues(classData));
  }, [classData, form]);

  const watchedGrade = form.watch('grade');
  const watchedSingleTeacherMode = form.watch('singleTeacherMode');

  useEffect(() => {
    if (watchedGrade !== null && shouldEnableSingleTeacherMode(watchedGrade)) {
      const currentValue = form.getValues('singleTeacherMode');
      if (!currentValue) {
        form.setValue('singleTeacherMode', true);
      }
    }
  }, [watchedGrade, form]);

  useEffect(() => {
    if (!watchedSingleTeacherMode) {
      const currentTeacherId = form.getValues('classTeacherId');
      if (currentTeacherId !== null) {
        form.setValue('classTeacherId', null);
      }
    }
  }, [watchedSingleTeacherMode, form]);

  const handleSubmit = useCallback(
    async (values: ClassFormValues) => {
      const normalizedValues: Partial<ClassFormValues> = {
        ...values,
        fixedRoomId: values.fixedRoomId ?? null,
        classTeacherId: values.classTeacherId ?? null,
        displayName: values.displayName ?? '',
        sectionIndex: values.sectionIndex ?? '',
      };
      await onUpdate(classData.id, normalizedValues);
    },
    [classData.id, onUpdate]
  );

  const handleSubjectRequirementsChange = useCallback(
    async (requirements: SubjectRequirement[]) => {
      await onUpdate(classData.id, { subjectRequirements: requirements });
    },
    [classData.id, onUpdate]
  );

  // Handle applying curriculum
  const handleApplyCurriculum = useCallback(async () => {
    try {
      await applyCurriculum({ overwrite: hasExistingRequirements });
    } catch {
      // Error is handled by the hook
    }
  }, [applyCurriculum, hasExistingRequirements]);

  const filteredAssignedRoomIds = assignedRoomIds.filter((id) => id !== classData.fixedRoomId);
  const gradeCategory = getGradeCategory(classData.grade);

  return (
    <div
      className={cn(
        'border-slate-200 bg-linear-to-br from-slate-50 to-white shadow-sm h-full flex flex-col overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b-2 border-slate-100 bg-white">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md shrink-0">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-base text-slate-800 truncate">
                {classData.displayName || classData.name}
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                {classData.grade && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 h-5 bg-white border-slate-200 text-slate-600"
                  >
                    {t('classes.form.grade')}: {classData.grade}
                  </Badge>
                )}
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 h-5 bg-blue-50 text-blue-700"
                >
                  {t(GRADE_CATEGORY_LABELS[gradeCategory] || 'common.unknown')}
                </Badge>
                {classData.singleTeacherMode && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 h-5 bg-violet-50 text-violet-700"
                  >
                    <User className="h-3 w-3 me-0.5" />
                    {t('classes.form.singleTeacherMode')}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 shrink-0 hover:bg-slate-100"
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v: string) => setActiveTab(v as EditTab)}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="px-3 pt-3">
          <TabsList className="w-full grid grid-cols-3 h-10 bg-slate-100 border border-slate-200 p-1 rounded-lg">
            <TabsTrigger
              value="info"
              className="gap-1.5 text-xs data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm rounded-md transition-all"
            >
              <Info className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">{t('classes.tabs.basicInfo')}</span>
            </TabsTrigger>
            <TabsTrigger
              value="room"
              className="gap-1.5 text-xs data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm rounded-md transition-all"
            >
              <Building className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">{t('classes.drawer.roomTeacher', 'Room')}</span>
            </TabsTrigger>
            <TabsTrigger
              value="subjects"
              className="gap-1.5 text-xs data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm rounded-md transition-all"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">{t('classes.tabs.subjectRequirements')}</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4">
            <Form {...form}>
              {/* Info Tab */}
              <TabsContent value="info" className="mt-0 space-y-4">
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
                  <div className="p-3 bg-white rounded-lg border-2 border-slate-100">
                    <div className="flex items-center gap-2 mb-3">
                      <Info className="h-4 w-4 text-blue-600" />
                      <h3 className="font-medium text-sm text-slate-800">
                        {t('classes.tabs.basicInfo')}
                      </h3>
                    </div>
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-slate-700">
                              {t('classes.form.name')}
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                disabled={isUpdating}
                                className="h-10 border-2 border-slate-200 focus:border-blue-400"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="grade"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-slate-700">
                                {t('classes.form.grade')}
                              </FormLabel>
                              <Select
                                value={field.value?.toString() || ''}
                                onValueChange={(v: string) =>
                                  field.onChange(v ? parseInt(v, 10) : null)
                                }
                                disabled={isUpdating}
                              >
                                <FormControl>
                                  <SelectTrigger className="h-10 border-2 border-slate-200 focus:border-blue-400">
                                    <SelectValue placeholder={t('classes.form.gradePlaceholder')} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {GRADE_OPTIONS.map((g) => (
                                    <SelectItem key={g} value={g.toString()}>
                                      {g}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="sectionIndex"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-slate-700">
                                {t('classes.form.sectionIndex')}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  disabled={isUpdating}
                                  placeholder={t('classes.form.sectionIndexPlaceholder')}
                                  className="h-10 border-2 border-slate-200 focus:border-blue-400"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="studentCount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-slate-700">
                              {t('classes.form.studentCount')}
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={0}
                                max={500}
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                                disabled={isUpdating}
                                className="h-10 border-2 border-slate-200 focus:border-blue-400"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-3 border-t border-slate-100">
                    <Button
                      type="submit"
                      disabled={isUpdating}
                      size="sm"
                      className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {isUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
                      {t('common.saveChanges')}
                    </Button>
                  </div>
                </form>

                {/* Class Info Section */}
                <div className="mt-6 space-y-4">
                  <div className="p-3 bg-white rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-emerald-100 rounded-lg">
                          <CheckCircle className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-slate-800">
                            {t('common.status', 'Status')}
                          </h3>
                          <p className="text-xs text-slate-500">
                            {t('classes.statusActive', 'Class is active')}
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                        {t('common.active', 'Active')}
                      </Badge>
                    </div>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-slate-200">
                    <div className="flex items-center gap-2 mb-3">
                      <Info className="h-4 w-4 text-blue-600" />
                      <h3 className="text-sm font-medium text-slate-800">
                        {t('common.info', 'Info')}
                      </h3>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-slate-500">{t('common.id', 'ID')}</span>
                        <span className="font-mono text-slate-700">#{classData.id}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-slate-500">{t('common.createdAt', 'Created')}</span>
                        <span className="text-slate-700">
                          {classData.createdAt
                            ? new Date(classData.createdAt).toLocaleDateString('fa-IR')
                            : '-'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="text-slate-500">{t('common.updatedAt', 'Updated')}</span>
                        <span className="text-slate-700">
                          {classData.updatedAt
                            ? new Date(classData.updatedAt).toLocaleDateString('fa-IR')
                            : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Room & Teacher Tab */}
              <TabsContent value="room" className="mt-0 space-y-4">
                <div className="p-3 bg-white rounded-lg border-2 border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Building className="h-4 w-4 text-blue-600" />
                    <h3 className="font-medium text-sm text-slate-800">
                      {t('classes.drawer.roomTeacher', 'Room & Teacher')}
                    </h3>
                  </div>
                </div>
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="fixedRoomId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-slate-700">
                          {t('classes.form.fixedRoom')}
                        </FormLabel>
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
                  <FormField
                    control={form.control}
                    name="singleTeacherMode"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border-2 border-slate-100 p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm font-medium text-slate-700">
                            {t('classes.form.singleTeacherMode')}
                          </FormLabel>
                          <FormDescription className="text-xs">
                            {t('classes.form.singleTeacherModeDesc')}
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={isUpdating}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {watchedSingleTeacherMode && (
                    <FormField
                      control={form.control}
                      name="classTeacherId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-slate-700">
                            {t('classes.form.classTeacher')}
                          </FormLabel>
                          <Select
                            value={field.value?.toString() || ''}
                            onValueChange={(v: string) =>
                              field.onChange(v ? parseInt(v, 10) : null)
                            }
                            disabled={isUpdating || isLoadingTeachers}
                          >
                            <FormControl>
                              <SelectTrigger className="h-10 border-2 border-slate-200 focus:border-blue-400">
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
                </div>
                <div className="flex justify-end pt-3 border-t border-slate-100">
                  <Button
                    type="button"
                    disabled={isUpdating}
                    size="sm"
                    onClick={() => {
                      const values = form.getValues();
                      onUpdate(classData.id, {
                        fixedRoomId: values.fixedRoomId ?? null,
                        singleTeacherMode: values.singleTeacherMode,
                        classTeacherId: values.classTeacherId ?? null,
                      });
                    }}
                    className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
                    {t('common.saveChanges')}
                  </Button>
                </div>
              </TabsContent>

              {/* Subjects Tab */}
              <TabsContent value="subjects" className="mt-0 space-y-4">
                <div className="p-3 bg-white rounded-lg border-2 border-slate-100">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-blue-600" />
                      <h3 className="font-medium text-sm text-slate-800">
                        {t('classes.tabs.subjectRequirements')}
                      </h3>
                    </div>
                    {/* Apply Curriculum Button - shown when class has a grade */}
                    {canApplyCurriculum && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCurriculumDialog(true)}
                        disabled={isApplying || isUpdating}
                        className="h-7 px-2.5 text-xs gap-1.5 border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                      >
                        {isApplying ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        {t('classes.curriculum.apply', 'اعمال برنامه درسی')}
                      </Button>
                    )}
                  </div>
                  {classData.singleTeacherMode && (
                    <p className="text-xs text-slate-500">
                      {t(
                        'classes.singleTeacherModeNote',
                        'در حالت معلم واحد، یک معلم تمام مضامین را تدریس می‌کند'
                      )}
                    </p>
                  )}
                </div>

                {/* Empty State - Show when no subject requirements */}
                {classData.subjectRequirements.length === 0 ? (
                  <div className="p-6 bg-white rounded-xl border-2 border-dashed border-slate-200">
                    <div className="flex flex-col items-center justify-center text-center py-4">
                      <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
                        <Library className="h-7 w-7 text-blue-400" />
                      </div>
                      <h4 className="text-sm font-medium text-slate-700 mb-1">
                        {t('classes.curriculum.noSubjects', 'هیچ مضمونی تعریف نشده است')}
                      </h4>
                      <p className="text-xs text-slate-500 mb-4 max-w-[240px]">
                        {classData.grade
                          ? t(
                              'classes.curriculum.applyHint',
                              'برنامه درسی وزارت معارف را اعمال کنید یا مضامین را به صورت دستی اضافه کنید'
                            )
                          : t(
                              'classes.curriculum.setGradeFirst',
                              'ابتدا صنف تحصیلی را در تب اطلاعات تنظیم کنید'
                            )}
                      </p>
                      {canApplyCurriculum && curriculumPreview && (
                        <div className="space-y-3 w-full max-w-[280px]">
                          <Button
                            type="button"
                            onClick={() => setShowCurriculumDialog(true)}
                            disabled={isApplying || isUpdating}
                            className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            {isApplying ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Sparkles className="h-4 w-4" />
                            )}
                            {t('classes.curriculum.applyMinistry', 'اعمال برنامه درسی وزارت معارف')}
                          </Button>
                          <div className="flex items-center justify-center gap-3 text-xs text-slate-500">
                            <span>
                              {curriculumPreview.subjectCount} {t('common.subject', 'مضمون')}
                            </span>
                            <span className="w-1 h-1 rounded-full bg-slate-300" />
                            <span>
                              {curriculumPreview.totalPeriods}{' '}
                              {t('common.periodsPerWeek', 'ساعت/هفته')}
                            </span>
                          </div>
                        </div>
                      )}
                      {!classData.grade && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveTab('info')}
                          className="gap-1.5"
                        >
                          <Info className="h-3.5 w-3.5" />
                          {t('classes.curriculum.goToInfo', 'رفتن به تب اطلاعات')}
                        </Button>
                      )}
                    </div>
                  </div>
                ) : classData.singleTeacherMode ? (
                  /* Single teacher mode: just show subject requirements editor without teacher column */
                  <SubjectRequirementsEditor
                    value={classData.subjectRequirements}
                    onChange={handleSubjectRequirementsChange}
                    disabled={isUpdating}
                    showTeacherColumn={false}
                    classGrade={classData.grade}
                  />
                ) : (
                  /* Multi-teacher mode: show full assignment manager */
                  <ClassAssignmentManager classData={classData} isUpdating={isUpdating} />
                )}
              </TabsContent>
            </Form>

            {/* Apply Curriculum Confirmation Dialog */}
            <AlertDialog open={showCurriculumDialog} onOpenChange={setShowCurriculumDialog}>
              <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-blue-600" />
                    {t('classes.curriculum.applyTitle', 'اعمال برنامه درسی')}
                  </AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-3">
                      <p>
                        {t(
                          'classes.curriculum.applyConfirm',
                          'آیا می‌خواهید برنامه درسی وزارت معارف را برای این صنف اعمال کنید؟'
                        )}
                      </p>
                      {curriculumPreview && (
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                          <div className="flex items-center gap-2 mb-2">
                            <GraduationCap className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-800">
                              {t('common.grade', 'صنف')} {curriculumPreview.grade} -{' '}
                              {curriculumPreview.categoryFa}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-blue-700">
                            <span>
                              <strong>{curriculumPreview.subjectCount}</strong>{' '}
                              {t('common.subject', 'مضمون')}
                            </span>
                            <span>
                              <strong>{curriculumPreview.totalPeriods}</strong>{' '}
                              {t('common.periodsPerWeek', 'ساعت در هفته')}
                            </span>
                          </div>
                        </div>
                      )}
                      {hasExistingRequirements && (
                        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                          <p className="text-xs text-amber-800">
                            {t(
                              'classes.curriculum.willReplace',
                              'این عمل مضامین فعلی را جایگزین می‌کند. تخصیص‌های معلمان حذف خواهند شد.'
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isApplying}>
                    {t('common.cancel', 'انصراف')}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleApplyCurriculum}
                    disabled={isApplying}
                    className="bg-blue-600 hover:bg-blue-700 gap-2"
                  >
                    {isApplying && <Loader2 className="h-4 w-4 animate-spin" />}
                    {t('classes.curriculum.applyAction', 'اعمال برنامه')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

export default ClassEditDrawer;
