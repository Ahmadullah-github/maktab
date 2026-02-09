/**
 * RoomEditDrawer Component
 *
 * Inline edit panel that replaces stats card when a room is selected.
 * Contains tabbed form for editing room details.
 * Uses real period structure and school settings for availability matrix.
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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePeriodStructure } from '@/features/periods/hooks/usePeriodStructure';
import { useSchoolSettings } from '@/features/school-settings/hooks/useSchoolSettings';
import { useRoomTypesWithIcons } from '@/features/settings';
import { cn } from '@/lib/utils';
import { roomSchema, type RoomFormData } from '@/schemas/room.schema';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Calendar,
  CheckCircle,
  DoorOpen,
  Hash,
  Info,
  Loader2,
  Settings,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { Room, RoomFormValues, RoomType, UnavailableSlot } from '../types';

export interface RoomEditDrawerProps {
  room: Room;
  onClose: () => void;
  onUpdate: (id: number, data: Partial<RoomFormValues>) => Promise<void>;
  isUpdating?: boolean;
  className?: string;
}

const NONE_VALUE = '__none__';

type EditTab = 'info' | 'features' | 'availability' | 'settings';

// Tag Input Component
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
  // Ensure value is always an array
  const tags = Array.isArray(value) ? value : [];

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      if (!tags.includes(inputValue.trim())) {
        onChange([...tags, inputValue.trim()]);
      }
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
        className="h-10 border-2 border-slate-200 focus:border-blue-400"
      />
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="gap-1.5 pe-1.5 bg-blue-50 text-blue-700 border border-blue-200"
            >
              {tag}
              <button
                type="button"
                onClick={() => onChange(tags.filter((t) => t !== tag))}
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

// Dynamic Availability Matrix Component
function AvailabilityMatrix({
  value,
  onChange,
  disabled,
}: {
  value: UnavailableSlot[];
  onChange: (slots: UnavailableSlot[]) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const { data: schoolSettings, isLoading: isLoadingSchool } = useSchoolSettings();
  const { data: periodStructure, isLoading: isLoadingPeriods } = usePeriodStructure();

  // Get active days from school settings
  const activeDays = useMemo(() => {
    if (!schoolSettings?.daysOfWeek) {
      return ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
    }
    return schoolSettings.daysOfWeek;
  }, [schoolSettings]);

  // Get periods per day - supports dynamic periods
  const getPeriodsForDay = useMemo(() => {
    const defaultPeriods =
      periodStructure?.defaultPeriodsPerDay ?? schoolSettings?.periodsPerDay ?? 7;
    const dynamicEnabled =
      periodStructure?.dynamicPeriodsEnabled ?? schoolSettings?.dynamicPeriodsEnabled ?? false;
    const periodsMap = periodStructure?.periodsPerDayMap ?? schoolSettings?.periodsPerDayMap ?? {};

    return (day: string): number => {
      if (dynamicEnabled && periodsMap[day]) {
        return periodsMap[day];
      }
      return defaultPeriods;
    };
  }, [periodStructure, schoolSettings]);

  // Calculate max periods for header
  const maxPeriods = useMemo(() => {
    return Math.max(...activeDays.map((day) => getPeriodsForDay(day)));
  }, [activeDays, getPeriodsForDay]);

  const isUnavailable = (dayIndex: number, period: number) =>
    value.some((slot) => slot.day === dayIndex && slot.period === period);

  const toggleSlot = (dayIndex: number, period: number) => {
    if (disabled) return;
    if (isUnavailable(dayIndex, period)) {
      onChange(value.filter((slot) => !(slot.day === dayIndex && slot.period === period)));
    } else {
      onChange([...value, { day: dayIndex, period }]);
    }
  };

  if (isLoadingSchool || isLoadingPeriods) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-600 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded border-2 border-slate-300 bg-emerald-50 flex items-center justify-center">
            <span className="text-emerald-500 text-[10px]">✓</span>
          </div>
          <span>{t('rooms.available', 'در دسترس')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded border-2 border-red-300 bg-red-100 flex items-center justify-center">
            <X className="h-3 w-3 text-red-500" />
          </div>
          <span>{t('rooms.unavailable', 'غیرفعال')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded border-2 border-slate-200 bg-slate-100 flex items-center justify-center">
            <span className="text-slate-400 text-[10px]">—</span>
          </div>
          <span>{t('rooms.notApplicable', 'ندارد')}</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border-2 border-slate-300 bg-white shadow-sm">
        <table className="w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr className="bg-linear-to-b from-slate-100 to-slate-50">
              <th className="p-3 text-start text-xs font-bold text-slate-700 border-b-2 border-e-2 border-slate-300 sticky start-0 bg-linear-to-b from-slate-100 to-slate-50 z-10 min-w-[80px]">
                {t('common.day')}
              </th>
              {Array.from({ length: maxPeriods }, (_, i) => (
                <th
                  key={i}
                  className="p-2.5 text-center min-w-[44px] text-xs font-bold text-slate-700 border-b-2 border-e-2 border-slate-300 last:border-e-0"
                >
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-400 font-normal">
                      {t('common.period', 'زنگ')}
                    </span>
                    <span className="text-sm">{i + 1}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeDays.map((day, dayIndex) => {
              const periodsForThisDay = getPeriodsForDay(day);
              const isLastRow = dayIndex === activeDays.length - 1;
              const isEvenRow = dayIndex % 2 === 0;
              return (
                <tr key={day} className={cn(isEvenRow ? 'bg-white' : 'bg-slate-50/70')}>
                  <td
                    className={cn(
                      'p-3 font-semibold text-xs text-slate-700 border-e-2 border-slate-300 sticky start-0 z-10 min-w-[80px]',
                      isEvenRow ? 'bg-white' : 'bg-slate-50',
                      !isLastRow && 'border-b-2 border-slate-200'
                    )}
                  >
                    <div className="flex flex-col">
                      <span>{t(`days.${day}`)}</span>
                      {periodsForThisDay !== maxPeriods && (
                        <span className="text-[10px] text-slate-400 font-normal">
                          ({periodsForThisDay} {t('common.periods', 'زنگ')})
                        </span>
                      )}
                    </div>
                  </td>
                  {Array.from({ length: maxPeriods }, (_, periodIndex) => {
                    const isActive = periodIndex < periodsForThisDay;
                    const unavailable = isUnavailable(dayIndex, periodIndex);
                    const isLastCol = periodIndex === maxPeriods - 1;

                    return (
                      <td
                        key={periodIndex}
                        className={cn(
                          'p-0 text-center transition-all duration-150',
                          !isLastRow && 'border-b-2 border-slate-200',
                          !isLastCol && 'border-e-2 border-slate-200',
                          isActive
                            ? unavailable
                              ? 'bg-red-100 hover:bg-red-200 cursor-pointer'
                              : 'bg-emerald-50/50 hover:bg-emerald-100 cursor-pointer'
                            : 'bg-slate-100 cursor-not-allowed',
                          disabled && 'cursor-not-allowed opacity-50'
                        )}
                        onClick={() => isActive && toggleSlot(dayIndex, periodIndex)}
                        role={isActive ? 'checkbox' : undefined}
                        aria-checked={isActive ? unavailable : undefined}
                        tabIndex={isActive ? 0 : -1}
                        onKeyDown={(e) => {
                          if (isActive && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            toggleSlot(dayIndex, periodIndex);
                          }
                        }}
                      >
                        <div className="w-full h-[44px] flex items-center justify-center">
                          {isActive && unavailable && (
                            <div className="w-7 h-7 rounded-md bg-red-200 flex items-center justify-center">
                              <X className="h-4 w-4 text-red-600" />
                            </div>
                          )}
                          {isActive && !unavailable && (
                            <div className="w-7 h-7 rounded-md bg-emerald-100 flex items-center justify-center">
                              <span className="text-emerald-500 text-sm">✓</span>
                            </div>
                          )}
                          {!isActive && <span className="text-slate-300 text-lg">—</span>}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">{t('rooms.availabilityHint')}</p>
    </div>
  );
}

function getDefaultValues(room: Room): RoomFormData {
  return {
    name: room.name,
    capacity: room.capacity,
    type: room.type as RoomType,
    features: room.features || [],
  };
}

export function RoomEditDrawer({
  room,
  onClose,
  onUpdate,
  isUpdating = false,
  className,
}: RoomEditDrawerProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<EditTab>('info');
  const [unavailableSlots, setUnavailableSlots] = useState<UnavailableSlot[]>([]);
  const { data: roomTypeOptions } = useRoomTypesWithIcons();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<RoomFormData>({
    resolver: zodResolver(roomSchema) as any,
    defaultValues: getDefaultValues(room),
  });

  // Reset form when room changes
  useEffect(() => {
    form.reset(getDefaultValues(room));
    setUnavailableSlots(room.unavailable || []);
  }, [room, form]);

  const handleSubmit = async (values: RoomFormData) => {
    await onUpdate(room.id, { ...values, unavailable: unavailableSlots });
  };

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
              <DoorOpen className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-base text-slate-800 truncate">{room.name}</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 h-5 bg-white border-slate-200 text-slate-600"
                >
                  {t(`rooms.type.${room.type || 'none'}`)}
                </Badge>
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 h-5 bg-blue-50 text-blue-700"
                >
                  <Users className="h-3 w-3 me-1" />
                  {room.capacity}
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
              <span className="hidden xl:inline">{t('rooms.tabs.info', 'اطلاعات')}</span>
            </TabsTrigger>
            <TabsTrigger
              value="features"
              className="gap-1.5 text-xs data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm rounded-md transition-all"
            >
              <Wrench className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">{t('rooms.tabs.features', 'امکانات')}</span>
            </TabsTrigger>
            <TabsTrigger
              value="availability"
              className="gap-1.5 text-xs data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm rounded-md transition-all"
            >
              <Calendar className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">{t('rooms.tabs.availability', 'زمان')}</span>
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="gap-1.5 text-xs data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm rounded-md transition-all"
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">{t('rooms.tabs.settings', 'تنظیمات')}</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4">
            {/* Info Tab */}
            <TabsContent value="info" className="mt-0 space-y-4">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
                  {/* @ts-ignore */}
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
                            disabled={isUpdating}
                            className="h-10 border-2 border-slate-200 focus:border-blue-400"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    {/* @ts-ignore */}
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
                                disabled={isUpdating}
                                className="h-10 ps-9 border-2 border-slate-200 focus:border-blue-400"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* @ts-ignore */}
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-slate-700">
                            {t('rooms.form.type')}
                          </FormLabel>
                          <Select
                            value={field.value || NONE_VALUE}
                            onValueChange={(v: string) => field.onChange(v === NONE_VALUE ? '' : v)}
                            disabled={isUpdating}
                          >
                            <FormControl>
                              <SelectTrigger className="h-10 border-2 border-slate-200 focus:border-blue-400">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {roomTypeOptions.map((o) => {
                                const Icon = o.IconComponent;
                                return (
                                  <SelectItem
                                    key={o.value || NONE_VALUE}
                                    value={o.value || NONE_VALUE}
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
              </Form>
            </TabsContent>

            {/* Features Tab */}
            <TabsContent value="features" className="mt-0 space-y-4">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
                  <div className="p-3 bg-white rounded-lg border-2 border-slate-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Wrench className="h-4 w-4 text-blue-600" />
                      <h3 className="font-medium text-sm text-slate-800">
                        {t('rooms.tabs.features', 'امکانات')}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500">{t('rooms.featuresDesc')}</p>
                  </div>

                  {/* @ts-ignore */}
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
                            disabled={isUpdating}
                          />
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
              </Form>
            </TabsContent>

            {/* Availability Tab */}
            <TabsContent value="availability" className="mt-0 space-y-4">
              <div className="p-3 bg-white rounded-lg border-2 border-slate-100">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <h3 className="font-medium text-sm text-slate-800">
                    {t('rooms.tabs.availability', 'زمان‌بندی')}
                  </h3>
                </div>
                <p className="text-xs text-slate-500">{t('rooms.availabilityDesc')}</p>
              </div>

              <AvailabilityMatrix
                value={unavailableSlots}
                onChange={setUnavailableSlots}
                disabled={isUpdating}
              />

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  disabled={isUpdating}
                  size="sm"
                  onClick={() => onUpdate(room.id, { unavailable: unavailableSlots })}
                  className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('common.saveChanges')}
                </Button>
              </div>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="mt-0 space-y-4">
              {/* Room Status */}
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-slate-800">
                        {t('rooms.settings.status', 'وضعیت اتاق')}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {t('rooms.settings.statusDesc', 'اتاق فعال و قابل استفاده است')}
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                    {t('rooms.settings.active', 'فعال')}
                  </Badge>
                </div>
              </div>

              {/* Room Info */}
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="h-4 w-4 text-blue-600" />
                  <h3 className="text-sm font-medium text-slate-800">
                    {t('rooms.settings.info', 'اطلاعات اتاق')}
                  </h3>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">{t('rooms.settings.id', 'شناسه')}</span>
                    <span className="font-mono text-slate-700">#{room.id}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">
                      {t('rooms.settings.created', 'تاریخ ایجاد')}
                    </span>
                    <span className="text-slate-700">
                      {room.createdAt ? new Date(room.createdAt).toLocaleDateString('fa-IR') : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500">
                      {t('rooms.settings.updated', 'آخرین بروزرسانی')}
                    </span>
                    <span className="text-slate-700">
                      {room.updatedAt ? new Date(room.updatedAt).toLocaleDateString('fa-IR') : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Usage Stats */}
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-violet-600" />
                  <h3 className="text-sm font-medium text-slate-800">
                    {t('rooms.settings.usage', 'آمار استفاده')}
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2.5 bg-slate-50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-slate-700">0</p>
                    <p className="text-[10px] text-slate-500">
                      {t('rooms.settings.scheduledClasses', 'کلاس برنامه‌ریزی شده')}
                    </p>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-slate-700">
                      {room.unavailable?.length || 0}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {t('rooms.settings.blockedSlots', 'زمان مسدود شده')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                  <Settings className="h-4 w-4 text-slate-600" />
                  <h3 className="text-sm font-medium text-slate-800">
                    {t('rooms.settings.quickActions', 'عملیات سریع')}
                  </h3>
                </div>
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2 text-xs"
                    onClick={() => {
                      setUnavailableSlots([]);
                      onUpdate(room.id, { unavailable: [] });
                    }}
                    disabled={isUpdating || !room.unavailable?.length}
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    {t('rooms.settings.clearAvailability', 'پاک کردن محدودیت‌های زمانی')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2 text-xs"
                    onClick={() => {
                      form.setValue('features', []);
                      form.handleSubmit(handleSubmit)();
                    }}
                    disabled={isUpdating || !room.features?.length}
                  >
                    <Wrench className="h-3.5 w-3.5" />
                    {t('rooms.settings.clearFeatures', 'پاک کردن امکانات')}
                  </Button>
                </div>
              </div>
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

export default RoomEditDrawer;
