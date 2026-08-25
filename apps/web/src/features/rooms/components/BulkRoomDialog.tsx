/**
 * BulkRoomDialog Component
 *
 * Dialog for creating multiple rooms at once with a naming pattern.
 * User specifies prefix, start number, and count.
 * Shows preview before creating.
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RoomTypeWithIcon } from '@/constants/roomTypes';
import { useRoomTypesWithIcons } from '@/features/settings';
import { cn } from '@/lib/utils';
import { Copy, DoorOpen, Hash, Loader2, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBulkCreateRooms } from '../hooks/useRooms';
import type { RoomFormValues, RoomType } from '../types';

export interface BulkRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_CAPACITY = 40;
const DEFAULT_TYPE: RoomType = 'normal';
const MAX_ROOMS = 50;

export function BulkRoomDialog({ open, onOpenChange }: BulkRoomDialogProps) {
  const { t } = useTranslation();
  const bulkCreate = useBulkCreateRooms();
  const { data: roomTypeOptions } = useRoomTypesWithIcons();

  // Form state
  const [prefix, setPrefix] = useState('اتاق');
  const [startNumber, setStartNumber] = useState(1);
  const [count, setCount] = useState(10);
  const [capacity, setCapacity] = useState(DEFAULT_CAPACITY);
  const [roomType, setRoomType] = useState<RoomType>(DEFAULT_TYPE);
  const [separator, setSeparator] = useState('-');

  // Generate preview names
  const previewRooms = useMemo(() => {
    const rooms: { name: string; data: RoomFormValues }[] = [];
    const actualCount = Math.min(count, MAX_ROOMS);
    const actualSeparator = separator === 'none' ? '' : separator;

    for (let i = 0; i < actualCount; i++) {
      const number = startNumber + i;
      const name = `${prefix}${actualSeparator}${number}`;
      rooms.push({
        name,
        data: {
          name,
          capacity,
          type: roomType,
          features: [],
          unavailable: [],
        },
      });
    }
    return rooms;
  }, [prefix, startNumber, count, capacity, roomType, separator]);

  const handleCreate = async () => {
    const roomsData = previewRooms.map((r) => r.data);
    await bulkCreate.mutateAsync(roomsData);
    onOpenChange(false);
    // Reset form
    setPrefix('اتاق');
    setStartNumber(1);
    setCount(10);
    setCapacity(DEFAULT_CAPACITY);
    setRoomType(DEFAULT_TYPE);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 gap-0 overflow-hidden bg-white border-0 shadow-2xl">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b bg-linear-to-br from-blue-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
              <Copy className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {t('rooms.bulk.title', 'ایجاد دسته‌ای اتاق‌ها')}
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500">
                {t('rooms.bulk.description', 'چندین اتاق را با یک الگوی نام‌گذاری ایجاد کنید')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-4 space-y-5 bg-white">
          {/* Naming Pattern Section */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <h3 className="font-medium text-sm text-slate-800">
                {t('rooms.bulk.namingPattern', 'الگوی نام‌گذاری')}
              </h3>
            </div>

            <div className="grid grid-cols-4 gap-3">
              {/* Prefix */}
              <div className="col-span-2">
                <Label className="text-xs text-slate-600 mb-1.5 block">
                  {t('rooms.bulk.prefix', 'پیشوند')}
                </Label>
                <Input
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  placeholder="اتاق"
                  className="h-9 border-slate-200 focus:border-blue-400"
                />
              </div>

              {/* Separator */}
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">
                  {t('rooms.bulk.separator', 'جداکننده')}
                </Label>
                <Select value={separator} onValueChange={setSeparator}>
                  <SelectTrigger className="h-9 border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="-">-</SelectItem>
                    <SelectItem value="_">_</SelectItem>
                    <SelectItem value=" ">(فاصله)</SelectItem>
                    <SelectItem value="none">(بدون)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Start Number */}
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">
                  {t('rooms.bulk.startNumber', 'شروع از')}
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={999}
                  value={startNumber}
                  onChange={(e) => setStartNumber(parseInt(e.target.value) || 1)}
                  className="h-9 border-slate-200 focus:border-blue-400"
                />
              </div>
            </div>

            {/* Preview of pattern */}
            <div className="mt-3 p-2 bg-white rounded-lg border border-slate-200">
              <p className="text-xs text-slate-500 mb-1">{t('rooms.bulk.example', 'نمونه:')}</p>
              <p className="font-mono text-sm text-blue-600">
                {prefix}
                {separator === 'none' ? '' : separator}
                {startNumber}, {prefix}
                {separator === 'none' ? '' : separator}
                {startNumber + 1}, {prefix}
                {separator === 'none' ? '' : separator}
                {startNumber + 2}...
              </p>
            </div>
          </div>

          {/* Count & Defaults Section */}
          <div className="grid grid-cols-3 gap-4">
            {/* Count */}
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">
                <Hash className="h-3 w-3 inline me-1" />
                {t('rooms.bulk.count', 'تعداد')}
              </Label>
              <Input
                type="number"
                min={1}
                max={MAX_ROOMS}
                value={count}
                onChange={(e) => setCount(Math.min(parseInt(e.target.value) || 1, MAX_ROOMS))}
                className="h-9 border-slate-200 focus:border-blue-400"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                {t('rooms.bulk.maxRooms', 'حداکثر {{max}} اتاق', { max: MAX_ROOMS })}
              </p>
            </div>

            {/* Capacity */}
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">
                {t('rooms.form.capacity', 'ظرفیت')}
              </Label>
              <Input
                type="number"
                min={1}
                max={500}
                value={capacity}
                onChange={(e) => setCapacity(parseInt(e.target.value) || DEFAULT_CAPACITY)}
                className="h-9 border-slate-200 focus:border-blue-400"
              />
            </div>

            {/* Type */}
            <div>
              <Label className="text-xs text-slate-600 mb-1.5 block">
                {t('rooms.form.type', 'نوع')}
              </Label>
              <Select value={roomType} onValueChange={(v: string) => setRoomType(v as RoomType)}>
                <SelectTrigger className="h-9 border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roomTypeOptions
                    .filter((opt: RoomTypeWithIcon) => opt.value !== '' && opt.value !== '__none__')
                    .map((opt: RoomTypeWithIcon) => {
                      const Icon = opt.IconComponent;
                      return (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-slate-500" />
                            {opt.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Preview Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs text-slate-600">
                {t('rooms.bulk.preview', 'پیش‌نمایش')} ({previewRooms.length}{' '}
                {t('rooms.bulk.rooms', 'اتاق')})
              </Label>
              <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700">
                <DoorOpen className="h-3 w-3 me-1" />
                {t(`rooms.type.${roomType}`)} • {capacity} {t('rooms.bulk.capacity', 'نفر')}
              </Badge>
            </div>
            <ScrollArea className="h-[120px] rounded-lg border border-slate-200 bg-white">
              <div className="p-3 flex flex-wrap gap-2">
                {previewRooms.map((room, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className={cn(
                      'text-xs px-2.5 py-1 bg-white border-slate-200 text-slate-700',
                      idx < 3 && 'border-blue-300 bg-blue-50 text-blue-700'
                    )}
                  >
                    {room.name}
                  </Badge>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t bg-slate-50">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={bulkCreate.isPending}
          >
            {t('common.cancel', 'انصراف')}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={bulkCreate.isPending || previewRooms.length === 0 || !prefix.trim()}
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {bulkCreate.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('rooms.bulk.create', 'ایجاد {{count}} اتاق', { count: previewRooms.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default BulkRoomDialog;
