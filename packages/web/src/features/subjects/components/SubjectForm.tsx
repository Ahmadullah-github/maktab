/**
 * SubjectForm Component
 *
 * A reusable form component for creating and editing subjects.
 * Uses react-hook-form with Zod validation and supports localized error messages.
 *
 * Features:
 * - All subject fields with Farsi labels
 * - Room type select dropdown
 * - Required/desired features tag inputs
 * - isDifficult switch with hint text
 * - Validation errors in Farsi
 *
 * Requirements: 4.2, 4.4, 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 8.1, 8.2
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { subjectSchema, type SubjectFormData } from '@/schemas/subject.schema';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, X } from 'lucide-react';
import { useEffect, useState, type KeyboardEvent } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { SubjectFormValues } from '../types';
import { componentLogger, logger } from '../utils/logger';

/**
 * Props for the SubjectForm component
 */
export interface SubjectFormProps {
  /** Initial values for editing an existing subject */
  initialValues?: Partial<SubjectFormValues>;
  /** Callback when form is submitted successfully */
  onSubmit: (values: SubjectFormValues) => void;
  /** Callback when form is cancelled */
  onCancel?: () => void;
  /** Whether the form is in a loading/submitting state */
  isSubmitting?: boolean;
  /** Whether this is an edit form (vs create) */
  isEditing?: boolean;
}

/**
 * Grade options for the grade selector (1-12)
 */
const GRADE_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

/**
 * Placeholder value for "none" options since Radix Select doesn't allow empty strings
 */
const NONE_VALUE = '__none__';

/**
 * Section options for the section selector
 */
const SECTION_OPTIONS: { value: string; label: string }[] = [
  { value: NONE_VALUE, label: 'بدون مقطع' },
  { value: 'PRIMARY', label: 'ابتدایی' },
  { value: 'MIDDLE', label: 'متوسطه' },
  { value: 'HIGH', label: 'لیسه' },
];

/**
 * Room type options for the room type selector
 */
const ROOM_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: NONE_VALUE, label: 'بدون محدودیت' },
  { value: 'classroom', label: 'صنف عادی' },
  { value: 'lab', label: 'لابراتوار' },
  { value: 'gym', label: 'سالون ورزش' },
  { value: 'library', label: 'کتابخانه' },
];

/**
 * Default form values for a new subject
 */
const DEFAULT_VALUES: SubjectFormValues = {
  name: '',
  code: '',
  grade: null,
  periodsPerWeek: null,
  section: '',
  requiredRoomType: '',
  requiredFeatures: [],
  desiredFeatures: [],
  isDifficult: false,
  minRoomCapacity: 0,
};

/**
 * TagInput component for managing feature tags
 */
interface TagInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

function TagInput({ value, onChange, placeholder, disabled }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      if (!value.includes(inputValue.trim())) {
        onChange([...value, inputValue.trim()]);
      }
      setInputValue('');
    }
  };

  const handleRemove = (tagToRemove: string) => {
    onChange(value.filter((tag) => tag !== tagToRemove));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 pe-1">
            {tag}
            <button
              type="button"
              onClick={() => handleRemove(tag)}
              disabled={disabled}
              className="rounded-full hover:bg-muted-foreground/20 p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <Input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="h-8"
      />
    </div>
  );
}

/**
 * SubjectForm provides a form for creating and editing subjects
 *
 * @example
 * ```tsx
 * <SubjectForm
 *   onSubmit={handleSubmit}
 *   onCancel={handleCancel}
 *   isSubmitting={isPending}
 * />
 * ```
 */
export function SubjectForm({
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting = false,
  isEditing = false,
}: SubjectFormProps) {
  const { t } = useTranslation();

  // Initialize form with react-hook-form and Zod validation
  const form = useForm<SubjectFormData>({
    // @ts-ignore - Type inference issue with zod resolver
    resolver: zodResolver(subjectSchema),
    defaultValues: {
      ...DEFAULT_VALUES,
      ...initialValues,
    },
  });

  // Debug logging on mount
  useEffect(() => {
    componentLogger.mount('SubjectForm', { isEditing, hasInitialValues: !!initialValues });
    return () => componentLogger.unmount('SubjectForm');
  }, [isEditing, initialValues]);

  // Reset form when initialValues change (for edit mode)
  useEffect(() => {
    if (initialValues) {
      form.reset({
        ...DEFAULT_VALUES,
        ...initialValues,
      });
    }
  }, [initialValues, form]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSubmit = (values: any) => {
    logger.debug('SubjectForm submitted', { name: values.name, code: values.code });
    onSubmit(values as SubjectFormValues);
  };

  return (
    <Form {...form}>
      {/* @ts-ignore - Type inference issue with form.handleSubmit */}
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Subject Name */}
        <FormField
          // @ts-expect-error - Type inference issue with zod resolver
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('subjects.form.name')}</FormLabel>
              <FormControl>
                <Input placeholder={t('subjects.form.namePlaceholder')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Code and Grade - Side by side */}
        <div className="grid grid-cols-2 gap-4">
          {/* Subject Code */}
          <FormField
            // @ts-expect-error - Type inference issue with zod resolver
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('subjects.form.code')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('subjects.form.codePlaceholder')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Grade Selector */}
          <FormField
            // @ts-expect-error - Type inference issue with zod resolver
            control={form.control}
            name="grade"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('subjects.form.grade')}</FormLabel>
                <Select
                  value={field.value?.toString() || ''}
                  onValueChange={(value: string) => {
                    const numValue = value ? parseInt(value, 10) : null;
                    field.onChange(numValue);
                  }}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t('subjects.form.gradePlaceholder')} />
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
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Section and Periods Per Week - Side by side */}
        <div className="grid grid-cols-2 gap-4">
          {/* Section Selector */}
          <FormField
            // @ts-expect-error - Type inference issue with zod resolver
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
                      <SelectValue placeholder={t('subjects.form.sectionPlaceholder')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {SECTION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Periods Per Week */}
          <FormField
            // @ts-expect-error - Type inference issue with zod resolver
            control={form.control}
            name="periodsPerWeek"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('subjects.form.periodsPerWeek')}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={field.value ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      field.onChange(val ? parseInt(val, 10) : null);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Room Type Selector */}
        <FormField
          // @ts-expect-error - Type inference issue with zod resolver
          control={form.control}
          name="requiredRoomType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('subjects.form.requiredRoomType')}</FormLabel>
              <Select
                value={field.value || NONE_VALUE}
                onValueChange={(v: string) => field.onChange(v === NONE_VALUE ? '' : v)}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t('subjects.roomType.none')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {ROOM_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Min Room Capacity */}
        <FormField
          // @ts-expect-error - Type inference issue with zod resolver
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

        {/* Required Features */}
        <FormField
          // @ts-expect-error - Type inference issue with zod resolver
          control={form.control}
          name="requiredFeatures"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('subjects.form.requiredFeatures')}</FormLabel>
              <FormControl>
                <TagInput
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Enter را بزنید برای افزودن..."
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Desired Features */}
        <FormField
          // @ts-expect-error - Type inference issue with zod resolver
          control={form.control}
          name="desiredFeatures"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('subjects.form.desiredFeatures')}</FormLabel>
              <FormControl>
                <TagInput
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Enter را بزنید برای افزودن..."
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Is Difficult Toggle */}
        <FormField
          // @ts-expect-error - Type inference issue with zod resolver
          control={form.control}
          name="isDifficult"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">{t('subjects.form.isDifficult')}</FormLabel>
                <FormDescription>{t('subjects.form.isDifficultDesc')}</FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Form Actions */}
        <div className="flex justify-end gap-3 pt-4">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              {t('common.cancel')}
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {isEditing ? t('common.saveChanges') : t('common.create')}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default SubjectForm;
