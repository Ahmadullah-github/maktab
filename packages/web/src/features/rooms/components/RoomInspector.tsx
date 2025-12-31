/**
 * RoomInspector Component
 * Requirements: 3.1, 3.2, 3.3, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 7.2, 7.3, 8.1, 8.2, 8.3
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { roomSchema, type RoomFormData } from '@/schemas/room.schema';
import { zodResolver } from '@hookform/resolvers/zod';
import { Calendar, Info, Loader2, Settings, Wrench, X } from 'lucide-react';
import { useEffect, useState, type KeyboardEvent } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { Room, RoomFormValues, UnavailableSlot } from '../types';
import { componentLogger, logger } from '../utils/logger';

export interface RoomInspectorProps {
  room: Room | null;
  onClose: () => void;
  onUpdate: (id: number, data: Partial<RoomFormValues>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  isUpdating?: boolean;
  isDeleting?: boolean;
  className?: string;
}

const NONE_VALUE = '__none__'; // Radix Select doesn't allow empty string values
const ROOM_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: NONE_VALUE, label: 'بدون نوع' },
  { value: 'classroom', label: 'صنف عادی' },
  { value: 'lab', label: 'لابراتوار' },
  { value: 'gym', label: 'سالون ورزش' },
  { value: 'library', label: 'کتابخانه' },
];

type InspectorTab = 'info' | 'features' | 'availability' | 'settings';

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
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 pe-1">
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((t) => t !== tag))}
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

const DAYS_OF_WEEK = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
const DEFAULT_PERIODS_PER_DAY = 7;

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
  const isUnavailable = (day: number, period: number) =>
    value.some((slot) => slot.day === day && slot.period === period);
  const toggleSlot = (day: number, period: number) => {
    if (disabled) return;
    if (isUnavailable(day, period)) {
      onChange(value.filter((slot) => !(slot.day === day && slot.period === period)));
    } else {
      onChange([...value, { day, period }]);
    }
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border p-2 bg-muted/40 text-start">{t('common.day')}</th>
            {Array.from({ length: DEFAULT_PERIODS_PER_DAY }, (_, i) => (
              <th key={i} className="border p-2 bg-muted/40 text-center w-12">
                {i + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DAYS_OF_WEEK.map((day, dayIndex) => (
            <tr key={day}>
              <td className="border p-2 font-medium">{t(`days.${day}`)}</td>
              {Array.from({ length: DEFAULT_PERIODS_PER_DAY }, (_, periodIndex) => (
                <td
                  key={periodIndex}
                  className={cn(
                    'border p-2 text-center cursor-pointer transition-colors',
                    isUnavailable(dayIndex, periodIndex)
                      ? 'bg-destructive/20 hover:bg-destructive/30'
                      : 'hover:bg-muted/50',
                    disabled && 'cursor-not-allowed opacity-50'
                  )}
                  onClick={() => toggleSlot(dayIndex, periodIndex)}
                  role="checkbox"
                  aria-checked={isUnavailable(dayIndex, periodIndex)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleSlot(dayIndex, periodIndex);
                    }
                  }}
                >
                  {isUnavailable(dayIndex, periodIndex) ? '✕' : ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground mt-2">{t('rooms.availabilityHint')}</p>
    </div>
  );
}

function getDefaultValues(room: Room | null): RoomFormData {
  if (!room) return { name: '', capacity: 30, type: 'classroom', features: [] };
  return {
    name: room.name,
    capacity: room.capacity,
    type: room.type,
    features: room.features || [],
  };
}

export function RoomInspector({
  room,
  onClose,
  onUpdate,
  onDelete,
  isUpdating = false,
  isDeleting = false,
  className,
}: RoomInspectorProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<InspectorTab>('info');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [unavailableSlots, setUnavailableSlots] = useState<UnavailableSlot[]>([]);
  // @ts-ignore - Type inference issue with zod resolver
  const form = useForm<RoomFormData>({
    resolver: zodResolver(roomSchema),
    defaultValues: getDefaultValues(room),
  });

  useEffect(() => {
    componentLogger.mount('RoomInspector', { hasRoom: !!room, roomId: room?.id });
    return () => componentLogger.unmount('RoomInspector');
  }, [room?.id]);

  useEffect(() => {
    if (room) {
      form.reset(getDefaultValues(room));
      setUnavailableSlots(room.unavailable || []);
      logger.debug('RoomInspector: form reset', { roomId: room.id });
    }
  }, [room, form]);

  const handleSubmit = async (values: RoomFormData) => {
    if (!room) return;
    logger.debug('RoomInspector: submitting', { roomId: room.id });
    await onUpdate(room.id, { ...values, unavailable: unavailableSlots });
  };

  const handleDeleteConfirm = async () => {
    if (!room) return;
    logger.debug('RoomInspector: deleting', { roomId: room.id });
    await onDelete(room.id);
    setShowDeleteDialog(false);
    onClose();
  };

  if (!room) return null;

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
            <h2 className="font-semibold text-lg">{room.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">{t(`rooms.type.${room.type || 'none'}`)}</Badge>
              <Badge variant="secondary">
                {t('rooms.capacityBadge', { count: room.capacity })}
              </Badge>
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
          onValueChange={(v) => setActiveTab(v as InspectorTab)}
          className="flex-1 flex flex-col"
        >
          <TabsList className="mx-4 mt-4 grid grid-cols-4">
            <TabsTrigger value="info" className="gap-1.5">
              <Info className="h-4 w-4" />
              <span className="hidden sm:inline">{t('rooms.tabs.info')}</span>
            </TabsTrigger>
            <TabsTrigger value="features" className="gap-1.5">
              <Wrench className="h-4 w-4" />
              <span className="hidden sm:inline">{t('rooms.tabs.features')}</span>
            </TabsTrigger>
            <TabsTrigger value="availability" className="gap-1.5">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">{t('rooms.tabs.availability')}</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">{t('rooms.tabs.settings')}</span>
            </TabsTrigger>
          </TabsList>
          <ScrollArea className="flex-1">
            <TabsContent value="info" className="p-4 mt-0">
              <Form {...form}>
                {/* @ts-ignore - Type inference issue with form.handleSubmit */}
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                  {/* @ts-ignore - Type inference issue with form.control */}
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('rooms.form.name')}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    {/* @ts-ignore - Type inference issue with form.control */}
                    <FormField
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
                    {/* @ts-ignore - Type inference issue with form.control */}
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('rooms.form.type')}</FormLabel>
                          <Select
                            value={field.value || NONE_VALUE}
                            onValueChange={(v) => field.onChange(v === NONE_VALUE ? '' : v)}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {ROOM_TYPE_OPTIONS.map((o) => (
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
                  <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={isUpdating}>
                      {isUpdating && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                      {t('common.saveChanges')}
                    </Button>
                  </div>
                </form>
              </Form>
            </TabsContent>
            <TabsContent value="features" className="p-4 mt-0">
              <Form {...form}>
                {/* @ts-ignore - Type inference issue with form.handleSubmit */}
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                  <div>
                    <h3 className="font-medium mb-1">{t('rooms.tabs.features')}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{t('rooms.featuresDesc')}</p>
                  </div>
                  {/* @ts-ignore - Type inference issue with form.control */}
                  <FormField
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
            <TabsContent value="availability" className="p-4 mt-0">
              <div className="space-y-6">
                <div>
                  <h3 className="font-medium mb-1">{t('rooms.tabs.availability')}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t('rooms.availabilityDesc')}
                  </p>
                </div>
                <AvailabilityMatrix
                  value={unavailableSlots}
                  onChange={setUnavailableSlots}
                  disabled={isUpdating}
                />
                <div className="flex justify-end pt-4">
                  <Button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => room && onUpdate(room.id, { unavailable: unavailableSlots })}
                  >
                    {isUpdating && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                    {t('common.saveChanges')}
                  </Button>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="settings" className="p-4 mt-0">
              <div className="space-y-6">
                <div className="border-t pt-6 mt-6">
                  <h3 className="text-sm font-medium text-destructive mb-2">{t('rooms.delete')}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t('rooms.deleteConfirm.message', { name: room.name })}
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
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </div>
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('rooms.deleteConfirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('rooms.deleteConfirm.message', { name: room.name })}
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

export default RoomInspector;
