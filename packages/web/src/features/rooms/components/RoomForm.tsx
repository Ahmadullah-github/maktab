/**
 * RoomForm Component
 *
 * A reusable form component for creating and editing rooms.
 * Uses react-hook-form with Zod validation and supports localized error messages.
 *
 * Features:
 * - Name input (required, min 1 char)
 * - Capacity input (required, min 1)
 * - Type select dropdown (classroom, lab, gym, library)
 * - Features TagInput component for multi-select
 * - Submit/cancel buttons with loading state
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 7.1
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
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
import { roomSchema, type RoomFormData } from '@/schemas/room.schema';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, X } from 'lucide-react';
import { useEffect, useState, type KeyboardEvent } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { RoomFormValues } from '../types';

// Simple logger for debugging
const logger = {
  debug: (msg: string, data?: unknown) => console.debug(`[RoomForm] ${msg}`, data),
};

const componentLogger = {
  mount: (name: string, data?: unknown) => console.debug(`[${name}] mounted`, data),
  unmount: (name: string) => console.debug(`[${name}] unmounted`),
};

/**
 * Props for the RoomForm component
 */
export interface RoomFormProps {
  /** Initial values for editing an existing room */
  initialValues?: Partial<RoomFormValues>;
  /** Callback when form is submitted successfully */
  onSubmit: (values: RoomFormValues) => void;
  /** Callback when form is cancelled */
  onCancel?: () => void;
  /** Whether the form is in a loading/submitting state */
  isSubmitting?: boolean;
  /** Whether this is an edit form (vs create) */
  isEditing?: boolean;
}

/**
 * Placeholder value for "no type" since Radix Select doesn't allow empty strings
 */
const NONE_VALUE = '__none__';

/**
 * Room type options for the type selector
 */
const ROOM_TYPE_OPTIONS: { value: string; labelKey: string }[] = [
  { value: NONE_VALUE, labelKey: 'rooms.type.none' },
  { value: 'classroom', labelKey: 'rooms.type.classroom' },
  { value: 'lab', labelKey: 'rooms.type.lab' },
  { value: 'gym', labelKey: 'rooms.type.gym' },
  { value: 'library', labelKey: 'rooms.type.library' },
];

/**
 * Default form values for a new room
 */
const DEFAULT_VALUES: RoomFormValues = {
  name: '',
  capacity: 30,
  type: 'classroom',
  features: [],
  unavailable: [],
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
 * RoomForm provides a form for creating and editing rooms
 *
 * @example
 * ```tsx
 * <RoomForm
 *   onSubmit={handleSubmit}
 *   onCancel={handleCancel}
 *   isSubmitting={isPending}
 * />
 * ```
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 7.1
 */
export function RoomForm({
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting = false,
  isEditing = false,
}: RoomFormProps) {
  const { t } = useTranslation();

  // Initialize form with react-hook-form and Zod validation
  const form = useForm<RoomFormData>({
    // @ts-ignore - Type inference issue with zod resolver
    resolver: zodResolver(roomSchema),
    defaultValues: {
      ...DEFAULT_VALUES,
      ...initialValues,
    },
  });

  // Debug logging on mount
  useEffect(() => {
    componentLogger.mount('RoomForm', { isEditing, hasInitialValues: !!initialValues });
    return () => componentLogger.unmount('RoomForm');
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
    logger.debug('RoomForm submitted', { name: values.name });
    // Add empty unavailable array if not present
    const formValues: RoomFormValues = {
      ...values,
      unavailable: initialValues?.unavailable || [],
    };
    onSubmit(formValues);
  };

  return (
    <Form {...form}>
      {/* @ts-ignore - Type inference issue with form.handleSubmit */}
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Room Name */}
        <FormField
          // @ts-expect-error - Type inference issue with zod resolver
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('rooms.form.name')}</FormLabel>
              <FormControl>
                <Input placeholder={t('rooms.form.namePlaceholder')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Capacity and Type - Side by side */}
        <div className="grid grid-cols-2 gap-4">
          {/* Capacity */}
          <FormField
            // @ts-expect-error - Type inference issue with zod resolver
            control={form.control}
            name="capacity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('rooms.form.capacity')}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Room Type Selector */}
          <FormField
            // @ts-expect-error - Type inference issue with zod resolver
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('rooms.form.type')}</FormLabel>
                <Select
                  value={field.value || NONE_VALUE}
                  onValueChange={(v: string) => field.onChange(v === NONE_VALUE ? '' : v)}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t('rooms.form.typePlaceholder')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ROOM_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Features */}
        <FormField
          // @ts-expect-error - Type inference issue with zod resolver
          control={form.control}
          name="features"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('rooms.form.features')}</FormLabel>
              <FormControl>
                <TagInput
                  value={field.value}
                  onChange={field.onChange}
                  placeholder={t('rooms.form.featuresPlaceholder')}
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormMessage />
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

export default RoomForm;
