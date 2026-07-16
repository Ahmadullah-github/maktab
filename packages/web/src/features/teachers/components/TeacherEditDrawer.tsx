/**
 * TeacherEditDrawer Component
 *
 * Inline edit panel that replaces stats card when a teacher is selected.
 * Contains tabbed form for editing teacher details.
 * Follows RoomEditDrawer pattern.
 */

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { teacherFormSchema, type TeacherFormValues } from '@/schemas/teacher.schema';
import { zodResolver } from '@hookform/resolvers/zod';
import { BookOpen, Calendar, CheckCircle, Info, Loader2, Settings, Users, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  calculateMaxPeriodsPerWeek,
  getEffectivePeriodsPerDayMap,
  getMaxPeriodsPerDay,
} from '@/features/school-settings/hooks/useSchoolSettings';
import type { SchoolConfig } from '@/features/school-settings/types';
import type {
  Teacher,
  TeacherFormValues as TeacherFormValuesType,
  UnavailableSlot,
} from '../types';
import { ensureArray } from '../utils/serialization';
import { AvailabilityMatrix } from './AvailabilityMatrix';
import { SubjectAssignmentManager } from './SubjectAssignmentManager';
import { useRooms } from '@/features/rooms/hooks/useRooms';
import { useTeachers } from '../hooks/useTeachers';

export interface TeacherEditDrawerProps {
  teacher: Teacher;
  onClose: () => void;
  onUpdate: (id: number, data: Partial<TeacherFormValuesType>) => Promise<void>;
  isUpdating?: boolean;
  schoolConfig: SchoolConfig;
  className?: string;
  /** Initial tab to show when drawer opens */
  initialTab?: EditTab | 'subjects' | 'assignments';
}

type EditTab = 'info' | 'subjects-assignments' | 'availability' | 'constraints';

export type { EditTab };

function getDefaultValues(teacher: Teacher): TeacherFormValues {
  return {
    fullName: teacher.fullName,
    staffCode: teacher.staffCode,
    employmentType: teacher.employmentType,
    primarySubjectIds: ensureArray(teacher.primarySubjectIds),
    allowedSubjectIds: ensureArray(teacher.allowedSubjectIds),
    restrictToPrimarySubjects: teacher.restrictToPrimarySubjects,
    unavailable: ensureArray(teacher.unavailable),
    maxPeriodsPerWeek: teacher.maxPeriodsPerWeek,
    maxPeriodsPerDay: teacher.maxPeriodsPerDay,
    maxConsecutivePeriods: teacher.maxConsecutivePeriods,
    timePreference: teacher.timePreference || 'any',
    preferredRoomIds: ensureArray(teacher.preferredRoomIds),
    preferredColleagues: ensureArray(teacher.preferredColleagues),
  };
}

export function TeacherEditDrawer({
  teacher,
  onClose,
  onUpdate,
  isUpdating = false,
  schoolConfig,
  className,
  initialTab = 'info',
}: TeacherEditDrawerProps) {
  const { t } = useTranslation();
  const { data: rooms = [] } = useRooms();
  const { data: teachers = [] } = useTeachers();
  // Map old tab values to new ones for backward compatibility
  const mappedInitialTab = useMemo(() => {
    if (initialTab === 'subjects' || initialTab === 'assignments') {
      return 'subjects-assignments';
    }
    return initialTab as EditTab;
  }, [initialTab]);

  const [activeTab, setActiveTab] = useState<EditTab>(mappedInitialTab);

  const maxPeriodsPerWeekLimit = useMemo(
    () => calculateMaxPeriodsPerWeek(schoolConfig),
    [schoolConfig]
  );
  const maxPeriodsPerDayLimit = getMaxPeriodsPerDay(schoolConfig);
  const effectivePeriodsPerDayMap = useMemo(
    () => getEffectivePeriodsPerDayMap(schoolConfig),
    [schoolConfig]
  );

  const form = useForm<TeacherFormValues>({
    resolver: zodResolver(teacherFormSchema),
    defaultValues: getDefaultValues(teacher),
  });

  // Reset form when teacher changes
  useEffect(() => {
    form.reset(getDefaultValues(teacher));
  }, [teacher, form]);

  // Reset tab when initialTab changes (e.g., clicking assignment badge)
  useEffect(() => {
    const mapped =
      initialTab === 'subjects' || initialTab === 'assignments'
        ? 'subjects-assignments'
        : (initialTab as EditTab);
    setActiveTab(mapped);
  }, [initialTab]);

  const handleSubmit = useCallback(
    async (values: TeacherFormValues) => {
      await onUpdate(teacher.id, values as TeacherFormValuesType);
    },
    [teacher.id, onUpdate]
  );

  // Availability handler
  const handleAvailabilityChange = useCallback(
    (slots: UnavailableSlot[]) => {
      form.setValue('unavailable', slots, { shouldDirty: true });
    },
    [form]
  );

  // Subject & Assignment handler for the new unified component
  const handleSubjectAssignmentUpdate = useCallback(
    async (data: Partial<TeacherFormValuesType>) => {
      await onUpdate(teacher.id, data);
    },
    [teacher.id, onUpdate]
  );

  // Watch form values
  const watchedPrimarySubjectIds = form.watch('primarySubjectIds');
  const watchedAllowedSubjectIds = form.watch('allowedSubjectIds');
  const watchedRestrictToPrimary = form.watch('restrictToPrimarySubjects');
  const watchedUnavailable = form.watch('unavailable');

  const subjectCount = useMemo(() => {
    const primaryCount = watchedPrimarySubjectIds?.length || 0;
    const allowedCount = watchedRestrictToPrimary ? 0 : watchedAllowedSubjectIds?.length || 0;
    return primaryCount + allowedCount;
  }, [watchedPrimarySubjectIds, watchedAllowedSubjectIds, watchedRestrictToPrimary]);

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
              <Users className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-base text-slate-800 truncate">
                {teacher.fullName}
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 h-5 bg-white border-slate-200 text-slate-600"
                >
                  {teacher.employmentType === 'full_time'
                    ? t('teachers.filterFullTime', 'تمام وقت')
                    : t('teachers.filterPartTime', 'نیمه وقت')}
                </Badge>
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 h-5 bg-blue-50 text-blue-700"
                >
                  <BookOpen className="h-3 w-3 me-1" />
                  {subjectCount}
                </Badge>
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
          <TabsList className="w-full grid grid-cols-4 h-10 bg-slate-100 border border-slate-200 p-1 rounded-lg">
            <TabsTrigger
              value="info"
              className="gap-1.5 text-xs data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm rounded-md transition-all"
            >
              <Info className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">{t('teachers.tabs.basicInfo', 'اطلاعات')}</span>
            </TabsTrigger>
            <TabsTrigger
              value="subjects-assignments"
              className="gap-1.5 text-xs data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm rounded-md transition-all"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">
                {t('teachers.tabs.subjectsClasses', 'مضامین و صنف‌ها')}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="availability"
              className="gap-1.5 text-xs data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm rounded-md transition-all"
            >
              <Calendar className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">{t('teachers.tabs.schedule', 'زمان')}</span>
            </TabsTrigger>
            <TabsTrigger
              value="constraints"
              className="gap-1.5 text-xs data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm rounded-md transition-all"
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">{t('teachers.tabs.constraints', 'محدودیت')}</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4">
            <Form {...form}>
              {/* Info Tab */}
              <TabsContent value="info" className="mt-0 space-y-4">
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-slate-700">
                          {t('teachers.fullName')}
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
                  <FormField
                    control={form.control}
                    name="staffCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('teachers.staffCode', 'Staff code')}</FormLabel>
                        <FormControl><Input {...field} disabled={isUpdating} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="employmentType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('teachers.employmentType', 'Employment type')}</FormLabel>
                        <FormControl>
                          <select {...field} disabled={isUpdating} className="h-10 w-full rounded-md border-2 px-3">
                            <option value="full_time">{t('teachers.filterFullTime')}</option>
                            <option value="part_time">{t('teachers.filterPartTime')}</option>
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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
              </TabsContent>

              {/* Subjects & Assignments Tab - NEW UNIFIED TAB */}
              <TabsContent value="subjects-assignments" className="mt-0">
                <SubjectAssignmentManager
                  teacher={teacher}
                  onUpdate={handleSubjectAssignmentUpdate}
                  isUpdating={isUpdating}
                  className="h-full"
                />
              </TabsContent>

              {/* Availability Tab */}
              <TabsContent value="availability" className="mt-0 space-y-4">
                <div className="p-3 bg-white rounded-lg border-2 border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    <h3 className="font-medium text-sm text-slate-800">
                      {t('teachers.availability', 'زمان‌بندی')}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500">{t('teachers.availabilityDesc')}</p>
                </div>

                <AvailabilityMatrix
                  value={watchedUnavailable}
                  onChange={handleAvailabilityChange}
                  disabled={isUpdating}
                  daysOfWeek={schoolConfig.daysOfWeek}
                  periodsPerDayMap={effectivePeriodsPerDayMap}
                  defaultPeriodsPerDay={schoolConfig.defaultPeriodsPerDay}
                />

                <div className="flex justify-end pt-3 border-t border-slate-100">
                  <Button
                    type="button"
                    disabled={isUpdating}
                    size="sm"
                    onClick={() => onUpdate(teacher.id, { unavailable: watchedUnavailable })}
                    className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
                    {t('common.saveChanges')}
                  </Button>
                </div>
              </TabsContent>

              {/* Constraints Tab */}
              <TabsContent value="constraints" className="mt-0 space-y-4">
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
                  <div className="p-3 bg-white rounded-lg border-2 border-slate-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Settings className="h-4 w-4 text-blue-600" />
                      <h3 className="font-medium text-sm text-slate-800">
                        {t('teachers.constraints', 'محدودیت‌ها')}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500">{t('teachers.constraintsDesc')}</p>
                  </div>

                  <FormField
                    control={form.control}
                    name="timePreference"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('teachers.timePreference', 'Time preference')}</FormLabel>
                        <FormControl>
                          <select {...field} disabled={isUpdating} className="h-10 w-full rounded-md border-2 px-3">
                            <option value="any">{t('teachers.timeAny', 'Any time')}</option>
                            <option value="morning">{t('teachers.timeMorning', 'Morning')}</option>
                            <option value="afternoon">{t('teachers.timeAfternoon', 'Afternoon')}</option>
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="preferredRoomIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('teachers.preferredRooms', 'Preferred rooms')}</FormLabel>
                        <FormControl>
                          <select multiple value={field.value.map(String)} onChange={(event) => field.onChange(Array.from(event.currentTarget.selectedOptions, (option) => Number(option.value)))} disabled={isUpdating} className="min-h-24 w-full rounded-md border-2 px-3 py-2">
                            {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="preferredColleagues"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('teachers.preferredColleagues', 'Preferred colleagues')}</FormLabel>
                        <FormControl>
                          <select multiple value={field.value.map(String)} onChange={(event) => field.onChange(Array.from(event.currentTarget.selectedOptions, (option) => Number(option.value)))} disabled={isUpdating} className="min-h-24 w-full rounded-md border-2 px-3 py-2">
                            {teachers.filter((candidate) => candidate.id !== teacher.id).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.fullName} ({candidate.staffCode})</option>)}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="maxPeriodsPerWeek"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-slate-700">
                          {t('teachers.maxPeriodsPerWeek')}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            max={maxPeriodsPerWeekLimit}
                            {...field}
                            onChange={(e) => field.onChange(Number.parseInt(e.target.value, 10) || 0)}
                            disabled={isUpdating}
                            className="h-10 border-2 border-slate-200 focus:border-blue-400"
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          {t('common.period')} 0-{maxPeriodsPerWeekLimit}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="maxPeriodsPerDay"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-slate-700">
                          {t('teachers.maxPeriodsPerDay')}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={maxPeriodsPerDayLimit}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
                            disabled={isUpdating}
                            className="h-10 border-2 border-slate-200 focus:border-blue-400"
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          {t('common.period')} 1-{maxPeriodsPerDayLimit}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="maxConsecutivePeriods"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-slate-700">
                          {t('teachers.maxConsecutive')}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={2}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
                            disabled={isUpdating}
                            className="h-10 border-2 border-slate-200 focus:border-blue-400"
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          {t('common.period')} 1-2
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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
              </TabsContent>
            </Form>

            {/* Settings Section - Always visible at bottom */}
            {activeTab === 'info' && (
              <div className="mt-6 space-y-4">
                {/* Teacher Status */}
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-emerald-100 rounded-lg">
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-slate-800">
                          {t('teachers.settings.status', 'وضعیت معلم')}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {t('teachers.settings.statusDesc', 'معلم فعال و قابل برنامه‌ریزی است')}
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                      {t('teachers.settings.active', 'فعال')}
                    </Badge>
                  </div>
                </div>

                {/* Teacher Info */}
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Info className="h-4 w-4 text-blue-600" />
                    <h3 className="text-sm font-medium text-slate-800">
                      {t('teachers.settings.info', 'اطلاعات معلم')}
                    </h3>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">{t('teachers.settings.id', 'شناسه')}</span>
                      <span className="font-mono text-slate-700">#{teacher.id}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">
                        {t('teachers.settings.created', 'تاریخ ایجاد')}
                      </span>
                      <span className="text-slate-700">
                        {teacher.createdAt
                          ? new Date(teacher.createdAt).toLocaleDateString('fa-IR')
                          : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-500">
                        {t('teachers.settings.updated', 'آخرین بروزرسانی')}
                      </span>
                      <span className="text-slate-700">
                        {teacher.updatedAt
                          ? new Date(teacher.updatedAt).toLocaleDateString('fa-IR')
                          : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

export default TeacherEditDrawer;
