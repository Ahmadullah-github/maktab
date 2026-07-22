/**
 * StatsCards Component
 * Displays aggregate statistics in a row of cards.
 *
 * Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 1.8
 */

import { Card, CardContent } from '@/components/ui/card';
import { LocalizedDate } from '@/components/ui/LocalizedDate';
import { Skeleton } from '@/components/ui/skeleton';
import type { LucideIcon } from 'lucide-react';
import { Calendar, Clock, GraduationCap, Users } from 'lucide-react';
import type { ReactNode } from 'react';

export interface StatsCardsProps {
  totalSchedules: number;
  totalClasses: number;
  totalTeachers: number;
  lastGeneratedAt: Date | null;
  isLoading: boolean;
}

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  isLoading?: boolean;
}

function StatCard({ icon: Icon, label, value, isLoading }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="rounded-lg bg-primary/10 p-3">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm text-muted-foreground">{label}</span>
          {isLoading ? (
            <Skeleton className="h-7 w-16" />
          ) : (
            <span className="text-2xl font-bold">{value}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function StatsCards({
  totalSchedules,
  totalClasses,
  totalTeachers,
  lastGeneratedAt,
  isLoading,
}: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={Calendar}
        label="تعداد جدول‌ها"
        value={totalSchedules}
        isLoading={isLoading}
      />
      <StatCard
        icon={GraduationCap}
        label="تعداد صنف‌ها"
        value={totalClasses}
        isLoading={isLoading}
      />
      <StatCard icon={Users} label="تعداد معلمین" value={totalTeachers} isLoading={isLoading} />
      <StatCard
        icon={Clock}
        label="آخرین تولید"
        value={
          lastGeneratedAt ? (
            <LocalizedDate
              value={lastGeneratedAt}
              options={{ year: 'numeric', month: 'short', day: 'numeric' }}
            />
          ) : (
            '---'
          )
        }
        isLoading={isLoading}
      />
    </div>
  );
}
