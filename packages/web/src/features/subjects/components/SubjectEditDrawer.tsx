/**
 * SubjectEditDrawer Component
 *
 * Inline edit panel that replaces stats card when a subject is selected.
 * Contains tabbed form for editing subject details and coverage analysis.
 * Follows TeacherEditDrawer pattern.
 *
 * Enhanced with coverage analysis section for assignment management.
 * Requirements: 4.1
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
import { LocalizedDate } from '@/components/ui/LocalizedDate';
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
import { TagInput } from '@/components/ui/tag-input';
import { useRoomTypesWithIcons } from '@/features/settings';
import { cn } from '@/lib/utils';
import { subjectSchema, type SubjectFormData } from '@/schemas/subject.schema';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertTriangle,
  BookOpen,
  Building,
  CheckCircle,
  Info,
  Loader2,
  PieChart,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { Subject, SubjectFormValues } from '../types';
import { SubjectAssignmentManager } from './SubjectAssignmentManager';

export interface SubjectEditDrawerProps {
  subject: Subject;
  onClose: () => void;
  onUpdate: (id: number, data: Partial<SubjectFormValues>) => Promise<void>;
  isUpdating?: boolean;
  className?: string;
}

type EditTab = 'info' | 'coverage';

const GRADE_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);
const NONE_VALUE = '__none__';

const SECTION_OPTIONS = [
  { value: NONE_VALUE, label: 'بدون مقطع' },
  { value: 'PRIMARY', label: 'ابتدایی' },
  { value: 'MIDDLE', label: 'متوسطه' },
  { value: 'HIGH', label: 'لیسه' },
];

function getDefaultValues(subject: Subject): SubjectFormData {
  return {
    name: subject.name,
    code: subject.code,
    grade: subject.grade,
    periodsPerWeek: subject.periodsPerWeek,
    section: subject.section,
    requiredRoomType: subject.requiredRoomType,
    requiredFeatures: subject.requiredFeatures || [],
    desiredFeatures: subject.desiredFeatures || [],
    isDifficult: subject.isDifficult,
    minRoomCapacity: subject.minRoomCapacity,
  };
}

function getSectionLabel(section: string): string {
  const option = SECTION_OPTIONS.find((o) => o.value === section);
  return option?.label || '—';
}

export function SubjectEditDrawer({
  subject,
  onClose,
  onUpdate,
  isUpdating = false,
  className,
}: SubjectEditDrawerProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<EditTab>('info');
  const { data: roomTypeOptions } = useRoomTypesWithIcons();

  const form = useForm<SubjectFormData>({
    resolver: zodResolver(subjectSchema),
    defaultValues: getDefaultValues(subject),
  });

  useEffect(() => {
    form.reset(getDefaultValues(subject));
  }, [subject, form]);

  const handleSubmit = useCallback(
    async (values: SubjectFormData) => {
      await onUpdate(subject.id, values as Partial<SubjectFormValues>);
    },
    [subject.id, onUpdate]
  );

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
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-md shrink-0">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-base text-slate-800 truncate">{subject.name}</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                {subject.code && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 h-5 bg-white border-slate-200 text-slate-600 font-mono"
                  >
                    {subject.code}
                  </Badge>
                )}
                {subject.section && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 h-5 bg-violet-50 text-violet-700"
                  >
                    {getSectionLabel(subject.section)}
                  </Badge>
                )}
                {subject.isDifficult && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 h-5 bg-amber-50 text-amber-700"
                  >
                    <AlertTriangle className="h-3 w-3" />
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
          <TabsList className="w-full grid grid-cols-2 h-10 bg-slate-100 border border-slate-200 p-1 rounded-lg">
            <TabsTrigger
              value="info"
              className="gap-1.5 text-xs data-[state=active]:bg-white data-[state=active]:text-violet-600 data-[state=active]:shadow-sm rounded-md transition-all"
            >
              <Info className="h-3.5 w-3.5" />
              <span>{t('subjects.tabs.info', 'معلومات')}</span>
            </TabsTrigger>
            <TabsTrigger
              value="coverage"
              className="gap-1.5 text-xs data-[state=active]:bg-white data-[state=active]:text-violet-600 data-[state=active]:shadow-sm rounded-md transition-all"
            >
              <PieChart className="h-3.5 w-3.5" />
              <span>{t('subjects.coverage.tabTitle', 'پوشش تدریس')}</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4">
            {/* Info Tab */}
            <TabsContent value="info" className="mt-0">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
                  {/* Basic Info Section */}
                  <div className="p-3 bg-white rounded-lg border-2 border-slate-100">
                    <div className="flex items-center gap-2 mb-3">
                      <Info className="h-4 w-4 text-violet-600" />
                      <h3 className="font-medium text-sm text-slate-800">
                        {t('subjects.tabs.info', 'اطلاعات صنف')}
                      </h3>
                    </div>
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-slate-700">
                              {t('subjects.form.name')}
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                disabled={isUpdating}
                                className="h-10 border-2 border-slate-200 focus:border-violet-400"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="code"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-slate-700">
                                {t('subjects.form.code')}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  disabled={isUpdating}
                                  className="h-10 border-2 border-slate-200 focus:border-violet-400 font-mono"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="periodsPerWeek"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-slate-700">
                                {t('subjects.form.periodsPerWeek')}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={1}
                                  max={84}
                                  value={field.value ?? ''}
                                  onChange={(e) =>
                                    field.onChange(
                                      e.target.value ? parseInt(e.target.value, 10) : null
                                    )
                                  }
                                  disabled={isUpdating}
                                  className="h-10 border-2 border-slate-200 focus:border-violet-400"
                                />
                              </FormControl>
                              <FormDescription className="text-xs text-slate-500">
                                {t(
                                  'subjects.form.periodsPerWeekHint',
                                  'Used as the default when curriculum is applied or a class adds this subject.'
                                )}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="section"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-slate-700">
                                {t('subjects.form.section')}
                              </FormLabel>
                              <Select
                                value={field.value || NONE_VALUE}
                                onValueChange={(v: string) =>
                                  field.onChange(v === NONE_VALUE ? '' : v)
                                }
                                disabled={isUpdating}
                              >
                                <FormControl>
                                  <SelectTrigger className="h-10 border-2 border-slate-200 focus:border-violet-400">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {SECTION_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                      {o.label}
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
                          name="grade"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-slate-700">
                                {t('subjects.form.grade')}
                              </FormLabel>
                              <Select
                                value={field.value?.toString() || NONE_VALUE}
                                onValueChange={(v: string) =>
                                  field.onChange(v === NONE_VALUE ? null : parseInt(v, 10))
                                }
                                disabled={isUpdating}
                              >
                                <FormControl>
                                  <SelectTrigger className="h-10 border-2 border-slate-200 focus:border-violet-400">
                                    <SelectValue
                                      placeholder={t('subjects.form.gradePlaceholder')}
                                    />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value={NONE_VALUE}>—</SelectItem>
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
                      </div>
                    </div>
                  </div>

                  {/* Room Requirements Section */}
                  <div className="p-3 bg-white rounded-lg border-2 border-slate-100">
                    <div className="flex items-center gap-2 mb-3">
                      <Building className="h-4 w-4 text-violet-600" />
                      <h3 className="font-medium text-sm text-slate-800">
                        {t('subjects.tabs.requirements', 'نیازمندی‌ها')}
                      </h3>
                    </div>
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="requiredRoomType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-slate-700">
                              {t('subjects.form.requiredRoomType')}
                            </FormLabel>
                            <Select
                              value={field.value || NONE_VALUE}
                              onValueChange={(v: string) =>
                                field.onChange(v === NONE_VALUE ? null : v)
                              }
                              disabled={isUpdating}
                            >
                              <FormControl>
                                <SelectTrigger className="h-10 border-2 border-slate-200 focus:border-violet-400">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value={NONE_VALUE}>
                                  {t('subjects.roomType.none')}
                                </SelectItem>
                                {roomTypeOptions.map((o) => {
                                  const Icon = o.IconComponent;
                                  return (
                                    <SelectItem
                                      key={o.value}
                                      value={o.value}
                                    >
                                      <div className="flex items-center gap-2">
                                        <Icon className="h-4 w-4 text-slate-500" />
                                        {o.label}
                                      </div>
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="minRoomCapacity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-slate-700">
                              {t('subjects.form.minRoomCapacity')}
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={0}
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                                disabled={isUpdating}
                                className="h-10 border-2 border-slate-200 focus:border-violet-400"
                              />
                            </FormControl>
                            <FormDescription className="text-xs">
                              {t('subjects.form.minRoomCapacityDesc', 'حداقل ظرفیت اتاق مورد نیاز')}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="requiredFeatures"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-slate-700">
                              {t('subjects.form.requiredFeatures')}
                            </FormLabel>
                            <FormControl>
                              <TagInput
                                value={field.value}
                                onChange={field.onChange}
                                placeholder="Enter را بزنید..."
                                disabled={isUpdating}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="desiredFeatures"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-slate-700">
                              {t('subjects.form.desiredFeatures')}
                            </FormLabel>
                            <FormControl>
                              <TagInput
                                value={field.value}
                                onChange={field.onChange}
                                placeholder="Enter را بزنید..."
                                disabled={isUpdating}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Settings Section */}
                  <div className="p-3 bg-white rounded-lg border-2 border-slate-100">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="h-4 w-4 text-violet-600" />
                      <h3 className="font-medium text-sm text-slate-800">
                        {t('subjects.tabs.settings', 'تنظیمات')}
                      </h3>
                    </div>
                    <FormField
                      control={form.control}
                      name="isDifficult"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border border-slate-200 p-3">
                          <div className="space-y-0.5">
                            <FormLabel className="text-sm font-medium text-slate-700">
                              {t('subjects.form.isDifficult')}
                            </FormLabel>
                            <FormDescription className="text-xs">
                              {t('subjects.form.isDifficultDesc')}
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
                  </div>

                  {/* Save Button */}
                  <div className="flex justify-end pt-3 border-t border-slate-100">
                    <Button
                      type="submit"
                      disabled={isUpdating}
                      size="sm"
                      className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
                    >
                      {isUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
                      {t('common.saveChanges')}
                    </Button>
                  </div>
                </form>
              </Form>

              {/* Subject Info Section */}
              <div className="mt-6 space-y-4">
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-emerald-100 rounded-lg">
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-slate-800">
                          {t('subjects.settings.status', 'وضعیت مضمون')}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {t('subjects.settings.statusDesc', 'مضمون فعال و قابل برنامه‌ریزی است')}
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                      {t('subjects.settings.active', 'فعال')}
                    </Badge>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Info className="h-4 w-4 text-violet-600" />
                    <h3 className="text-sm font-medium text-slate-800">
                      {t('subjects.settings.info', 'اطلاعات مضمون')}
                    </h3>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">{t('subjects.settings.id', 'شناسه')}</span>
                      <span className="font-mono text-slate-700">#{subject.id}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">
                        {t('subjects.settings.created', 'تاریخ ایجاد')}
                      </span>
                      <span className="text-slate-700">
                        {subject.createdAt
                          ? <LocalizedDate value={subject.createdAt} />
                          : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-500">
                        {t('subjects.settings.updated', 'آخرین بروزرسانی')}
                      </span>
                      <span className="text-slate-700">
                        {subject.updatedAt
                          ? <LocalizedDate value={subject.updatedAt} />
                          : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Coverage Tab */}
            <TabsContent value="coverage" className="mt-0">
              <SubjectAssignmentManager subject={subject} className="min-h-[400px]" />
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

export default SubjectEditDrawer;
