/**
 * OnboardingEmptyState Component
 * Empty state display for new users with no data
 *
 * Features:
 * - Welcome message in Persian
 * - Quick links to Teachers, Classes, Subjects, Rooms pages
 * - Progress indicator showing data completion percentage
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ReadinessData } from '@/types/readiness';
import { useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { BookOpen, CalendarDays, DoorOpen, GraduationCap, Sparkles, Users } from 'lucide-react';
import { DataCompletionProgress } from './DataCompletionProgress';

/**
 * Quick link configuration
 */
interface QuickLink {
  key: string;
  labelFa: string;
  icon: React.ElementType;
  path: string;
  description: string;
}

/**
 * Quick links to entity management pages
 */
const QUICK_LINKS: QuickLink[] = [
  {
    key: 'teachers',
    labelFa: 'استادان',
    icon: Users,
    path: '/teachers',
    description: 'افزودن استادان مکتب',
  },
  {
    key: 'classes',
    labelFa: 'صنف‌ها',
    icon: GraduationCap,
    path: '/classes',
    description: 'تعریف صنف‌های مکتب',
  },
  {
    key: 'subjects',
    labelFa: 'مضامین',
    icon: BookOpen,
    path: '/subjects',
    description: 'افزودن مضامین درسی',
  },
  {
    key: 'rooms',
    labelFa: 'اتاق‌ها',
    icon: DoorOpen,
    path: '/rooms',
    description: 'تعریف اتاق‌های درسی',
  },
];

/**
 * Props for OnboardingEmptyState component
 */
export interface OnboardingEmptyStateProps {
  /** Readiness data for calculating completion percentage */
  readinessData: ReadinessData;
  /** Additional CSS classes */
  className?: string;
}

/**
 * OnboardingEmptyState component for new users
 *
 * Displays a welcome message, quick links to set up data,
 * and a progress indicator showing completion percentage.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */
export function OnboardingEmptyState({ readinessData, className }: OnboardingEmptyStateProps) {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        'flex flex-col items-center justify-center py-12 px-6',
        'bg-linear-to-b from-gray-50/50 to-white rounded-xl border border-dashed border-gray-200',
        className
      )}
    >
      {/* Welcome Icon */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4"
      >
        <CalendarDays className="w-8 h-8 text-primary" />
      </motion.div>

      {/* Welcome Message (Requirement: 8.2) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="text-center mb-6"
      >
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          به سیستم جدول زمانی مکتب خوش آمدید!
        </h2>
        <p className="text-muted-foreground max-w-md">
          برای شروع تولید جدول زمانی، ابتدا اطلاعات صنف مکتب را وارد کنید.
        </p>
      </motion.div>

      {/* Progress Indicator (Requirement: 8.4) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
        className="w-full max-w-sm mb-8"
      >
        <DataCompletionProgress readinessData={readinessData} />
      </motion.div>

      {/* Quick Links (Requirement: 8.3) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.4 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-2xl"
      >
        {QUICK_LINKS.map((link, index) => {
          const Icon = link.icon;
          const count = getCountForKey(readinessData, link.key);
          const isComplete = count > 0;

          return (
            <motion.div
              key={link.key}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: 0.4 + index * 0.05 }}
            >
              <Button
                variant="outline"
                className={cn(
                  'w-full h-auto flex flex-col items-center gap-2 p-4',
                  'hover:bg-gray-50 hover:border-primary/30 transition-all',
                  isComplete && 'border-green-200 bg-green-50/30'
                )}
                onClick={() => navigate({ to: link.path })}
              >
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center',
                    isComplete ? 'bg-green-100' : 'bg-gray-100'
                  )}
                >
                  <Icon
                    className={cn('w-5 h-5', isComplete ? 'text-green-600' : 'text-gray-600')}
                  />
                </div>
                <span className="font-medium text-sm">{link.labelFa}</span>
                <span className="text-xs text-muted-foreground">{link.description}</span>
                {isComplete && (
                  <span className="text-xs text-green-600 font-medium">{count} ثبت شده</span>
                )}
              </Button>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Encouragement text */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.6 }}
        className="flex items-center gap-2 mt-6 text-sm text-muted-foreground"
      >
        <Sparkles className="w-4 h-4 text-amber-500" />
        <span>با تکمیل اطلاعات، می‌توانید جدول زمانی خود را تولید کنید</span>
      </motion.div>
    </motion.div>
  );
}

/**
 * Helper function to get count from readiness data by key
 */
function getCountForKey(data: ReadinessData, key: string): number {
  const countMap: Record<string, number> = {
    teachers: data.teacherCount,
    classes: data.classCount,
    subjects: data.subjectCount,
    rooms: data.roomCount,
  };
  return countMap[key] ?? 0;
}
