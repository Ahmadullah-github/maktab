/**
 * SubjectInspector Component
 * Requirements: 3.1, 3.2, 3.4, 3.5, 3.6, 3.7, 5.1, 5.2, 5.3, 5.4
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
import { TagInput } from '@/components/ui/tag-input';
import { useRoomTypeOptions } from '@/features/settings';
import { cn } from '@/lib/utils';
import { subjectSchema, type SubjectFormData } from '@/schemas/subject.schema';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Info, Loader2, Settings, Wrench, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { Subject, SubjectFormValues } from '../types';
import { componentLogger, logger } from '../utils/logger';
import { getSectionLabel } from '../utils/sectionTranslation';

export interface SubjectInspectorProps {
  subject: Subject | null;
  onClose: () => void;
  onUpdate: (id: number, data: Partial<SubjectFormValues>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  isUpdating?: boolean;
  isDeleting?: boolean;
  className?: string;
}

const GRADE_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);
const NONE_VALUE = '__none__'; // Radix Select doesn't allow empty string values
const SECTION_OPTIONS: { value: string; label: string }[] = [
  { value: NONE_VALUE, label: 'بدون مقطع' },
  { value: 'PRIMARY', label: 'ابتدایی' },
  { value: 'MIDDLE', label: 'متوسطه' },
  { value: 'HIGH', label: 'لیسه' },
];

type InspectorTab = 'info' | 'requirements' | 'settings';

function getDefaultValues(subject: Subject | null): SubjectFormData {
  if (!subject)
    return {
      name: '',
      code: '',
      grade: null,
      periodsPerWeek: null,
      section: '',
      requiredRoomType: null,
      requiredFeatures: [],
      desiredFeatures: [],
      isDifficult: false,
      minRoomCapacity: 0,
    };
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

export function SubjectInspector({
  subject,
  onClose,
  onUpdate,
  onDelete,
  isUpdating = false,
  isDeleting = false,
  className,
}: SubjectInspectorProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<InspectorTab>('info');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { options: roomTypeOptions } = useRoomTypeOptions();
  const form = useForm<SubjectFormData>({
    resolver: zodResolver(subjectSchema),
    defaultValues: getDefaultValues(subject),
  });

  useEffect(() => {
    componentLogger.mount('SubjectInspector', { hasSubject: !!subject, subjectId: subject?.id });
    return () => componentLogger.unmount('SubjectInspector');
  }, [subject]);
  useEffect(() => {
    if (subject) {
      form.reset(getDefaultValues(subject));
      logger.debug('SubjectInspector: form reset', { subjectId: subject.id });
    }
  }, [subject, form]);

  const handleSubmit = async (values: SubjectFormData) => {
    if (!subject) return;
    logger.debug('SubjectInspector: submitting', { subjectId: subject.id });
    await onUpdate(subject.id, values as Partial<SubjectFormValues>);
  };
  const handleDeleteConfirm = async () => {
    if (!subject) return;
    logger.debug('SubjectInspector: deleting', { subjectId: subject.id });
    await onDelete(subject.id);
    setShowDeleteDialog(false);
    onClose();
  };

  if (!subject) return null;

  return (
    <>
      <div
        className={cn(
          'flex flex-col h-full border-s bg-background w-full sm:w-[350px] md:w-[400px] lg:w-[450px]',
          className
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <h2 className="font-semibold text-lg">{subject.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">{subject.code}</Badge>
              {subject.section && (
                <Badge variant="secondary">{getSectionLabel(subject.section)}</Badge>
              )}
              {subject.isDifficult && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {t('subjects.columns.difficult')}
                </Badge>
              )}
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
        <Tabs
          value={activeTab}
          onValueChange={(v: string) => setActiveTab(v as InspectorTab)}
          className="flex-1 flex flex-col"
        >
          <TabsList className="mx-4 mt-4 grid grid-cols-3">
            <TabsTrigger value="info" className="gap-1.5">
              <Info className="h-4 w-4" />
              <span className="hidden sm:inline">{t('subjects.tabs.info')}</span>
            </TabsTrigger>
            <TabsTrigger value="requirements" className="gap-1.5">
              <Wrench className="h-4 w-4" />
              <span className="hidden sm:inline">{t('subjects.tabs.requirements')}</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">{t('subjects.tabs.settings')}</span>
            </TabsTrigger>
          </TabsList>
          <ScrollArea className="flex-1">
            <TabsContent value="info" className="p-4 mt-0">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('subjects.form.name')}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('subjects.form.code')}</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="grade"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('subjects.form.grade')}</FormLabel>
                          <Select
                            value={field.value?.toString() || ''}
                            onValueChange={(v: string) =>
                              field.onChange(v ? parseInt(v, 10) : null)
                            }
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('subjects.form.gradePlaceholder')} />
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
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="section"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('subjects.form.section')}</FormLabel>
                          <Select
                            value={field.value || NONE_VALUE}
                            onValueChange={(v: string) => field.onChange(v === NONE_VALUE ? '' : v)}
                          >
                            <FormControl>
                              <SelectTrigger>
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
                      name="periodsPerWeek"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('subjects.form.periodsPerWeek')}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              max={84}
                              value={field.value ?? ''}
                              onChange={(e) =>
                                field.onChange(e.target.value ? parseInt(e.target.value, 10) : null)
                              }
                            />
                          </FormControl>
                          <FormDescription>
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
                  <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={isUpdating}>
                      {isUpdating && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                      {t('common.saveChanges')}
                    </Button>
                  </div>
                </form>
              </Form>
            </TabsContent>
            <TabsContent value="requirements" className="p-4 mt-0">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="requiredRoomType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('subjects.form.requiredRoomType')}</FormLabel>
                        <Select
                          value={field.value || NONE_VALUE}
                          onValueChange={(v: string) => field.onChange(v === NONE_VALUE ? null : v)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={NONE_VALUE}>{t('subjects.roomType.none')}</SelectItem>
                            {roomTypeOptions.map((o) => (
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
                    name="minRoomCapacity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('subjects.form.minRoomCapacity')}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="requiredFeatures"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('subjects.form.requiredFeatures')}</FormLabel>
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
                        <FormLabel>{t('subjects.form.desiredFeatures')}</FormLabel>
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
                  <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={isUpdating}>
                      {isUpdating && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                      {t('common.saveChanges')}
                    </Button>
                  </div>
                </form>
              </Form>
            </TabsContent>
            <TabsContent value="settings" className="p-4 mt-0">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="isDifficult"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            {t('subjects.form.isDifficult')}
                          </FormLabel>
                          <FormDescription>{t('subjects.form.isDifficultDesc')}</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={isUpdating}>
                      {isUpdating && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                      {t('common.saveChanges')}
                    </Button>
                  </div>
                  <div className="border-t pt-6 mt-6">
                    <h3 className="text-sm font-medium text-destructive mb-2">
                      {t('subjects.delete')}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {t('subjects.deleteConfirm.message', { name: subject.name })}
                    </p>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => setShowDeleteDialog(true)}
                      disabled={isDeleting}
                    >
                      {isDeleting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                      {t('common.delete')}
                    </Button>
                  </div>
                </form>
              </Form>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </div>
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('subjects.deleteConfirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('subjects.deleteConfirm.message', { name: subject.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default SubjectInspector;
