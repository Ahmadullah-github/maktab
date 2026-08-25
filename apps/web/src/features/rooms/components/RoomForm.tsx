/**
 * RoomForm Component - Modern styled form for creating/editing rooms
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
import { useRoomTypeOptions } from '@/features/settings';
import { roomSchema, type RoomFormData } from '@/schemas/room.schema';
import { zodResolver } from '@hookform/resolvers/zod';
import { DoorOpen, Hash, Loader2, Wrench, X } from 'lucide-react';
import { useEffect, useState, type KeyboardEvent } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { RoomFormValues } from '../types';

export interface RoomFormProps {
  initialValues?: Partial<RoomFormValues>;
  onSubmit: (values: RoomFormValues) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  isEditing?: boolean;
}

const DEFAULT_VALUES: RoomFormValues = {
  name: '',
  capacity: 30,
  type: 'normal',
  features: [],
  unavailable: [],
};

function TagInput({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [inputValue, setInputValue] = useState('');
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      if (!value.includes(inputValue.trim())) onChange([...value, inputValue.trim()]);
      setInputValue('');
    }
  };
  return (
    <div className="space-y-3">
      <Input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="h-10 border-2 border-slate-200 focus:border-blue-400 bg-white"
      />
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="gap-1.5 pe-1.5 bg-blue-50 text-blue-700 border border-blue-200"
            >
              {tag}
              <button
                type="button"
                onClick={() => onChange(value.filter((t) => t !== tag))}
                disabled={disabled}
                className="rounded-full hover:bg-blue-200 p-0.5 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export function RoomForm({
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting = false,
  isEditing = false,
}: RoomFormProps) {
  const { t } = useTranslation();
  const { options: roomTypeOptions } = useRoomTypeOptions();
  const form = useForm<RoomFormData>({
    resolver: zodResolver(roomSchema),
    defaultValues: { ...DEFAULT_VALUES, ...initialValues },
  });

  useEffect(() => {
    if (initialValues) form.reset({ ...DEFAULT_VALUES, ...initialValues });
  }, [initialValues, form]);

  const handleSubmit = (values: RoomFormData) => {
    onSubmit({ ...values, unavailable: initialValues?.unavailable || [] } as RoomFormValues);
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="p-4 bg-white rounded-xl border-2 border-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
            <DoorOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">
              {isEditing ? t('rooms.edit', 'ویرایش اتاق') : t('rooms.add', 'افزودن اتاق جدید')}
            </h3>
            <p className="text-sm text-slate-500">
              {t('rooms.formDesc', 'اطلاعات اتاق را وارد کنید')}
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
          {/* Room Name */}
          <div className="p-4 bg-white rounded-xl border-2 border-slate-100">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-slate-700">
                    {t('rooms.form.name')}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t('rooms.form.namePlaceholder')}
                      disabled={isSubmitting}
                      className="h-10 border-2 border-slate-200 focus:border-blue-400 bg-white"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Capacity and Type */}
          <div className="p-4 bg-white rounded-xl border-2 border-slate-100">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-slate-700">
                      {t('rooms.form.capacity')}
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Hash className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          type="number"
                          min={1}
                          max={1000}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
                          disabled={isSubmitting}
                          className="h-10 ps-9 border-2 border-slate-200 focus:border-blue-400 bg-white"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-slate-700">
                      {t('rooms.form.type')}
                    </FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger className="h-10 border-2 border-slate-200 focus:border-blue-400 bg-white">
                          <SelectValue placeholder={t('rooms.form.typePlaceholder')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
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
            </div>
          </div>

          {/* Features */}
          <div className="p-4 bg-white rounded-xl border-2 border-slate-100">
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-slate-700">{t('rooms.form.features')}</span>
            </div>
            <FormField
              control={form.control}
              name="features"
              render={({ field }) => (
                <FormItem>
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
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
                className="border-2 border-slate-200 hover:bg-slate-50"
              >
                {t('common.cancel')}
              </Button>
            )}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? t('common.saveChanges') : t('common.create')}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

export default RoomForm;
