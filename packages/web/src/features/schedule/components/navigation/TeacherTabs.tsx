import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { memo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { TeacherTabsProps } from '../../types';

/**
 * TeacherTab - Individual teacher tab button
 */
interface TeacherTabProps {
  teacherId: string | null;
  teacherName: string;
  periodCount: number;
  isSelected: boolean;
  onClick: () => void;
}

const TeacherTab = memo(function TeacherTab({
  teacherId,
  teacherName,
  periodCount,
  isSelected,
  onClick,
}: TeacherTabProps) {
  const tabRef = useRef<HTMLButtonElement>(null);

  // Scroll selected tab into view
  useEffect(() => {
    if (isSelected && tabRef.current) {
      tabRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [isSelected]);

  return (
    <button
      ref={tabRef}
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium whitespace-nowrap',
        'rounded-md transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
        'hover:bg-accent/50',
        isSelected
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'bg-muted/50 text-muted-foreground hover:text-foreground'
      )}
      role="tab"
      aria-selected={isSelected}
      aria-controls={teacherId ? `teacher-schedule-${teacherId}` : 'all-teachers-schedule'}
      data-state={isSelected ? 'active' : 'inactive'}
    >
      <span className="truncate max-w-[150px]">{teacherName}</span>
      {periodCount > 0 && (
        <Badge
          variant={isSelected ? 'secondary' : 'outline'}
          className={cn(
            'text-xs px-1.5 py-0 min-w-6 justify-center',
            isSelected && 'bg-primary-foreground/20 text-primary-foreground border-transparent'
          )}
        >
          {periodCount}
        </Badge>
      )}
    </button>
  );
});

/**
 * TeacherTabs - Horizontal scrollable tabs for teacher selection
 *
 * Displays a list of teachers as tabs with period count badges.
 * Includes an "All" tab to show all teachers' schedules.
 */
export const TeacherTabs = memo(function TeacherTabs({
  teachers,
  selectedTeacherId,
  onSelectTeacher,
  lessonCounts,
}: TeacherTabsProps) {
  const { t } = useTranslation();

  // Calculate total lessons for "All" tab
  const totalLessons = Array.from(lessonCounts.values()).reduce((sum, count) => sum + count, 0);

  return (
    <nav
      className="flex items-center gap-1 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
      role="tablist"
      aria-label={t('schedule.teacherNavigation', 'ناوبری معلمان')}
    >
      {/* "All" tab */}
      <TeacherTab
        teacherId={null}
        teacherName={t('schedule.allTeachers', 'همه')}
        periodCount={totalLessons}
        isSelected={selectedTeacherId === null}
        onClick={() => onSelectTeacher(null)}
      />

      {/* Teacher tabs */}
      {teachers.map((teacher) => (
        <TeacherTab
          key={teacher.teacherId}
          teacherId={teacher.teacherId}
          teacherName={teacher.teacherName}
          periodCount={lessonCounts.get(teacher.teacherId) ?? 0}
          isSelected={selectedTeacherId === teacher.teacherId}
          onClick={() => onSelectTeacher(teacher.teacherId)}
        />
      ))}
    </nav>
  );
});

export default TeacherTabs;
