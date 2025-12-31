/**
 * SubjectDataGrid Component
 *
 * DataGrid for displaying and managing subjects
 * Supports row selection, section badges, and isDifficult indicator
 *
 * Requirements: 1.2, 1.4, 7.3, 8.4
 */

import { cn } from '@/lib/utils';
import { AlertTriangle, BookOpen } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { RoomType, Section, Subject } from '../types';
import { componentLogger } from '../utils/logger';

export interface SubjectDataGridProps {
  /** Array of subjects to display */
  subjects: Subject[];
  /** Currently selected subject ID */
  selectedId: number | null;
  /** Callback when a subject row is selected */
  onSelect: (subject: Subject | null) => void;
  /** Whether data is loading */
  isLoading?: boolean;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Section badge color mapping
 * - PRIMARY: amber (grades 1-6)
 * - MIDDLE: blue (grades 7-9)
 * - HIGH: purple (grades 10-12)
 */
const SECTION_COLORS: Record<Section, string> = {
  PRIMARY: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  MIDDLE: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  HIGH: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  '': 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

/**
 * Translates section value to Farsi label
 *
 * Requirements: 8.4
 */
export function translateSection(section: Section, t: (key: string) => string): string {
  const sectionMap: Record<Section, string> = {
    PRIMARY: t('subjects.section.primary'),
    MIDDLE: t('subjects.section.middle'),
    HIGH: t('subjects.section.high'),
    '': '—',
  };
  return sectionMap[section] || '—';
}

/**
 * Translates room type value to Farsi label
 */
function translateRoomType(roomType: RoomType, t: (key: string) => string): string {
  const roomTypeMap: Record<RoomType, string> = {
    classroom: t('subjects.roomType.classroom'),
    lab: t('subjects.roomType.lab'),
    gym: t('subjects.roomType.gym'),
    library: t('subjects.roomType.library'),
    '': t('subjects.roomType.none'),
  };
  return roomTypeMap[roomType] || '—';
}

/**
 * SectionBadge displays a section with appropriate coloring
 */
function SectionBadge({ section, t }: { section: Section; t: (key: string) => string }) {
  const colorClass = SECTION_COLORS[section] || SECTION_COLORS[''];
  const label = translateSection(section, t);

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium',
        colorClass
      )}
    >
      {label}
    </span>
  );
}

/**
 * DifficultBadge displays an indicator for difficult subjects
 *
 * Requirements: 7.3
 */
function DifficultBadge({ t }: { t: (key: string) => string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400"
      title={t('subjects.isDifficultHint')}
    >
      <AlertTriangle className="h-4 w-4" />
    </span>
  );
}

/**
 * SubjectDataGrid displays subjects in a table format with selection
 *
 * @example
 * ```tsx
 * <SubjectDataGrid
 *   subjects={subjects}
 *   selectedId={selectedId}
 *   onSelect={handleSelect}
 * />
 * ```
 */
export function SubjectDataGrid({
  subjects,
  selectedId,
  onSelect,
  isLoading = false,
  className,
}: SubjectDataGridProps) {
  const { t } = useTranslation();

  // Debug logging on mount
  useEffect(() => {
    componentLogger.mount('SubjectDataGrid', { subjectCount: subjects.length, selectedId });
    return () => componentLogger.unmount('SubjectDataGrid');
  }, []);

  const handleRowClick = (subject: Subject) => {
    // Toggle selection if clicking the same row
    if (selectedId === subject.id) {
      onSelect(null);
    } else {
      onSelect(subject);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, subject: Subject) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleRowClick(subject);
    }
  };

  // Empty state
  if (!isLoading && subjects.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center h-64 text-muted-foreground',
          className
        )}
      >
        <BookOpen className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">{t('subjects.noSubjects')}</p>
        <p className="text-sm">{t('subjects.noSubjectsHint')}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col h-full border rounded-md overflow-hidden bg-background',
        className
      )}
    >
      {/* Header */}
      <div className="flex border-b bg-muted/40 font-medium text-xs text-muted-foreground">
        <div className="w-10 border-e flex items-center justify-center shrink-0">#</div>
        <div className="flex-1 min-w-[140px] px-3 py-2 border-e">{t('subjects.columns.name')}</div>
        <div className="w-20 px-3 py-2 border-e text-center">{t('subjects.columns.code')}</div>
        <div className="w-24 px-3 py-2 border-e text-center">{t('subjects.columns.section')}</div>
        <div className="w-16 px-3 py-2 border-e text-center">{t('subjects.columns.grade')}</div>
        <div className="w-20 px-3 py-2 border-e text-center">
          {t('subjects.columns.periodsPerWeek')}
        </div>
        <div className="w-28 px-3 py-2 border-e text-center">{t('subjects.columns.roomType')}</div>
        <div className="w-16 px-3 py-2 text-center">{t('subjects.columns.difficult')}</div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        {subjects.map((subject, index) => (
          <div
            key={subject.id}
            className={cn(
              'flex border-b last:border-b-0 cursor-pointer transition-colors',
              selectedId === subject.id ? 'bg-primary/10 hover:bg-primary/15' : 'hover:bg-muted/50'
            )}
            onClick={() => handleRowClick(subject)}
            onKeyDown={(e) => handleKeyDown(e, subject)}
            role="row"
            tabIndex={0}
            aria-selected={selectedId === subject.id}
          >
            {/* Row number */}
            <div className="w-10 border-e flex items-center justify-center shrink-0 text-xs text-muted-foreground bg-muted/10">
              {index + 1}
            </div>

            {/* Name */}
            <div className="flex-1 min-w-[140px] px-3 py-2 border-e">
              <span className="truncate font-medium">{subject.name}</span>
            </div>

            {/* Code */}
            <div className="w-20 px-3 py-2 border-e text-center text-sm font-mono">
              {subject.code || '—'}
            </div>

            {/* Section */}
            <div className="w-24 px-3 py-2 border-e flex items-center justify-center">
              <SectionBadge section={subject.section} t={t} />
            </div>

            {/* Grade */}
            <div className="w-16 px-3 py-2 border-e text-center text-sm">
              {subject.grade ?? '—'}
            </div>

            {/* Periods Per Week */}
            <div className="w-20 px-3 py-2 border-e text-center text-sm">
              {subject.periodsPerWeek ?? '—'}
            </div>

            {/* Room Type */}
            <div className="w-28 px-3 py-2 border-e text-center text-sm">
              {translateRoomType(subject.requiredRoomType, t)}
            </div>

            {/* Is Difficult */}
            <div className="w-16 px-3 py-2 flex items-center justify-center">
              {subject.isDifficult && <DifficultBadge t={t} />}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t p-2 text-xs text-muted-foreground bg-muted/20 flex justify-between">
        <span>{t('subjects.recordCount', { count: subjects.length })}</span>
      </div>
    </div>
  );
}

export default SubjectDataGrid;
