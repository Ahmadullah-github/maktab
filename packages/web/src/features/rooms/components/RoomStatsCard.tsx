/**
 * RoomStatsCard Component
 *
 * Stats sidebar showing room statistics summary
 * Inspired by SchoolSettingsPage StatsSidebar
 */

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CheckCircle, DoorOpen, Hash, Layers, TrendingUp, Users } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Room } from '../types';
import { useRoomTypesWithIcons } from '@/features/settings';

export interface RoomStatsCardProps {
  rooms: Room[];
  selectedCount: number;
  className?: string;
}

interface RoomStats {
  total: number;
  byType: Record<string, number>;
  totalCapacity: number;
  avgCapacity: number;
  withFeatures: number;
}

function calculateStats(rooms: Room[]): RoomStats {
  const byType: Record<string, number> = {};

  let totalCapacity = 0;
  let withFeatures = 0;

  rooms.forEach((room) => {
    byType[room.type] = (byType[room.type] || 0) + 1;
    totalCapacity += room.capacity || 0;
    if (room.features && room.features.length > 0) {
      withFeatures++;
    }
  });

  return {
    total: rooms.length,
    byType,
    totalCapacity,
    avgCapacity: rooms.length > 0 ? Math.round(totalCapacity / rooms.length) : 0,
    withFeatures,
  };
}

export function RoomStatsCard({ rooms, selectedCount, className }: RoomStatsCardProps) {
  const { t } = useTranslation();
  const { data: roomTypes } = useRoomTypesWithIcons();
  const stats = useMemo(() => calculateStats(rooms), [rooms]);
  const typeLabels = useMemo(
    () => new Map(roomTypes.map((roomType) => [roomType.value, roomType.label])),
    [roomTypes]
  );

  return (
    <div className={cn('h-full overflow-auto p-4 space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-700">
          <TrendingUp className="h-5 w-5" />
          <span className="font-semibold">{t('rooms.stats.summary', 'خلاصه آمار')}</span>
        </div>
        {selectedCount > 0 && (
          <Badge className="bg-blue-100 text-blue-700 border-blue-200">
            {selectedCount} {t('rooms.stats.selected', 'انتخاب شده')}
          </Badge>
        )}
      </div>

      {/* Total Rooms */}
      <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <DoorOpen className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">{t('rooms.stats.totalRooms', 'کل اتاق‌ها')}</p>
            <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
          </div>
        </div>
      </div>

      {/* Total Capacity */}
      <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-100 rounded-lg">
            <Users className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">{t('rooms.stats.totalCapacity', 'ظرفیت کل')}</p>
            <p className="text-2xl font-bold text-violet-700">{stats.totalCapacity}</p>
          </div>
        </div>
        <Badge variant="secondary" className="text-xs bg-gray-100">
          ~{stats.avgCapacity} {t('rooms.stats.perRoom', 'هر اتاق')}
        </Badge>
      </div>

      {/* Rooms with Features */}
      <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">
              {t('rooms.stats.withFeatures', 'دارای امکانات')}
            </p>
            <p className="text-2xl font-bold text-emerald-700">{stats.withFeatures}</p>
          </div>
        </div>
      </div>

      {/* Type Breakdown */}
      <div className="p-3 bg-slate-700 rounded-lg text-white">
        <div className="flex items-center gap-2 mb-3">
          <Layers className="h-4 w-4 text-slate-300" />
          <p className="text-xs text-slate-300">{t('rooms.stats.byType', 'بر اساس نوع')}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(stats.byType).map(([type, count]) => (
            <div
              key={type}
              className="flex items-center justify-between bg-white/10 rounded px-2 py-1.5"
            >
              <span className="text-xs truncate">{typeLabels.get(type) || type}</span>
              <span className="font-bold">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
        <Badge variant="outline" className="bg-white text-slate-600 px-2 py-1">
          <Hash className="h-3 w-3 me-1" />
          {stats.total} {t('rooms.stats.rooms', 'اتاق')}
        </Badge>
        <Badge variant="outline" className="bg-white text-slate-600 px-2 py-1">
          <Users className="h-3 w-3 me-1" />
          {stats.totalCapacity} {t('rooms.stats.seats', 'نفر')}
        </Badge>
      </div>
    </div>
  );
}

export default RoomStatsCard;
