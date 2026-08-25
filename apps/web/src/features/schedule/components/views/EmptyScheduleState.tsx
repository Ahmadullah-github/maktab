/**
 * EmptyScheduleState - Displays when no schedule is loaded
 *
 * Requirements: 7.3
 */

import { CalendarX2 } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * EmptyScheduleState - Empty state component for schedule views
 *
 * Displays a message and icon when no schedule is loaded,
 * with guidance on how to load a schedule.
 */
export const EmptyScheduleState = memo(function EmptyScheduleState() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8 text-center">
      <CalendarX2 className="h-16 w-16 text-muted-foreground/50 mb-4" strokeWidth={1.5} />
      <h3 className="text-lg font-medium text-foreground mb-2">
        {t('schedule.empty.title', 'جدول زمانی بارگذاری نشده')}
      </h3>
      <p className="text-sm text-muted-foreground max-w-md">
        {t(
          'schedule.empty.description',
          'برای مشاهده جدول زمانی، ابتدا یک جدول از لیست جداول ذخیره شده انتخاب کنید یا جدول جدیدی ایجاد نمایید.'
        )}
      </p>
    </div>
  );
});

export default EmptyScheduleState;
