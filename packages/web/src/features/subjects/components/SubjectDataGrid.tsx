/**
 * SubjectDataGrid Component
 *
 * DataGrid for displaying subjects with:
 * - Checkbox selection for bulk operations
 * - Row click to open edit drawer
 * - Section badges with color coding
 * - Room type badges
 * - Difficult indicator with tooltip
 * - Compact mode when drawer is open
 */

import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { AlertTriangle, Beaker, BookOpen, Building, Dumbbell, Library } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAllSubjectAssignmentSummaries } from '../hooks/useSubjectAssignments';
import type { RoomType, Section, Subject } from '../types';
import { SubjectCoverageCell } from './SubjectCoverageCell';

export interface SubjectDataGridProps {
  subjects: Subject[];
  selectedId: number | null;
  selectedIds?: Set<number>;
  onSelect: (subject: Subject) => void;
  onToggleSelect?: (subjectId: number) => void;
  onToggleSelectAll?: () => void;
  onCoverageClick?: (subject: Subject) => void;
  isLoading?: boolean;
  compact?: boolean;
  className?: string;
}

// Section badge colors - matching teachers' style
const SECTION_STYLES: Record<Section, { bg: string; text: string; border: string }> = {
  PRIMARY: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  MIDDLE: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  HIGH: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  '': { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200' },
};

// Room type icons and colors
const ROOM_TYPE_CONFIG: Record<RoomType, { icon: typeof BookOpen; color: string }> = {
  normal: { icon: Building, color: 'text-slate-500' },
  computer_lab: { icon: Beaker, color: 'text-cyan-600' },
  biology_lab: { icon: Beaker, color: 'text-emerald-600' },
  chemistry_lab: { icon: Beaker, color: 'text-orange-600' },
  math_lab: { icon: Beaker, color: 'text-indigo-600' },
  physics_lab: { icon: Beaker, color: 'text-violet-600' },
  lab: { icon: Beaker, color: 'text-purple-600' },
  library: { icon: Library, color: 'text-amber-600' },
  salon: { icon: Building, color: 'text-pink-600' },
  gym: { icon: Dumbbell, color: 'text-green-600' },
  sport_camp: { icon: Dumbbell, color: 'text-lime-600' },
  other: { icon: Building, color: 'text-slate-500' },
  '': { icon: Building, color: 'text-gray-400' },
};

export function translateSection(section: Section, t: (key: string) => string): string {
  // Normalize to uppercase for case-insensitive matching
  const normalizedSection = (section?.toUpperCase() || '') as Section;
  const map: Record<Section, string> = {
    PRIMARY: t('subjects.section.primary'),
    MIDDLE: t('subjects.section.middle'),
    HIGH: t('subjects.section.high'),
    '': '—',
  };
  return map[normalizedSection] || '—';
}

function translateRoomType(roomType: RoomType, t: (key: string) => string): string {
  const map: Record<RoomType, string> = {
    normal: t('subjects.roomType.normal'),
    computer_lab: t('subjects.roomType.computer_lab'),
    biology_lab: t('subjects.roomType.biology_lab'),
    chemistry_lab: t('subjects.roomType.chemistry_lab'),
    math_lab: t('subjects.roomType.math_lab'),
    physics_lab: t('subjects.roomType.physics_lab'),
    lab: t('subjects.roomType.lab'),
    library: t('subjects.roomType.library'),
    salon: t('subjects.roomType.salon'),
    gym: t('subjects.roomType.gym'),
    sport_camp: t('subjects.roomType.sport_camp'),
    other: t('subjects.roomType.other'),
    '': t('subjects.roomType.none'),
  };
  return map[roomType] || '—';
}

function SectionBadge({ section, t }: { section: Section; t: (key: string) => string }) {
  // Normalize to uppercase for case-insensitive matching
  const normalizedSection = (section?.toUpperCase() || '') as Section;
  const style = SECTION_STYLES[normalizedSection] || SECTION_STYLES[''];
  return (
    <Badge
      variant="secondary"
      className={cn(
        'text-[10px] px-1.5 py-0 h-5 border font-medium',
        style.bg,
        style.text,
        style.border
      )}
    >
      {translateSection(section, t)}
    </Badge>
  );
}

function RoomTypeBadge({ roomType, t }: { roomType: RoomType; t: (key: string) => string }) {
  const config = ROOM_TYPE_CONFIG[roomType] || ROOM_TYPE_CONFIG[''];
  const Icon = config.icon;
  const label = translateRoomType(roomType, t);

  if (!roomType) return <span className="text-xs text-muted-foreground">—</span>;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Badge
              variant="outline"
              className={cn('text-[10px] px-1.5 py-0 h-5 gap-1 cursor-help', config.color)}
            >
              <Icon className="h-3 w-3" />
              <span className="hidden lg:inline">{label}</span>
            </Badge>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function DifficultBadge({ t }: { t: (key: string) => string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-600 cursor-help">
            <AlertTriangle className="h-3.5 w-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{t('subjects.isDifficultHint')}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function SubjectDataGrid({
  subjects,
  selectedId,
  selectedIds = new Set(),
  onSelect,
  onToggleSelect,
  onToggleSelectAll,
  onCoverageClick,
  isLoading = false,
  compact = false,
  className,
}: SubjectDataGridProps) {
  const { t } = useTranslation();

  // Get assignment summaries for all subjects
  const { allSummaries } = useAllSubjectAssignmentSummaries();

  // Create a map for quick lookup
  const summaryMap = useMemo(() => {
    const map = new Map<number, (typeof allSummaries)[0]>();
    allSummaries.forEach((s) => map.set(s.subjectId, s));
    return map;
  }, [allSummaries]);

  const handleRowClick = useCallback(
    (subject: Subject, e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-checkbox]')) return;
      if ((e.target as HTMLElement).closest('[data-coverage]')) return;
      onSelect(subject);
    },
    [onSelect]
  );

  const handleCoverageClick = useCallback(
    (subject: Subject, e: React.MouseEvent) => {
      e.stopPropagation();
      onCoverageClick?.(subject);
    },
    [onCoverageClick]
  );

  const handleCheckboxClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, subject: Subject) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(subject);
      }
    },
    [onSelect]
  );

  const allSelected = subjects.length > 0 && selectedIds.size === subjects.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < subjects.length;

  // Empty state with better styling
  if (!isLoading && subjects.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center h-full min-h-[300px] text-muted-foreground bg-white rounded-lg',
          className
        )}
      >
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <BookOpen className="h-8 w-8 text-slate-400" />
        </div>
        <p className="text-lg font-semibold text-gray-700">{t('subjects.noSubjects')}</p>
        <p className="text-sm text-muted-foreground mt-1">{t('subjects.noSubjectsHint')}</p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full overflow-hidden bg-white', className)}>
      {/* Table Container */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          {/* Header */}
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50 border-b text-xs text-muted-foreground">
              <th className="w-12 p-3 border-e bg-gray-50" data-checkbox>
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={onToggleSelectAll}
                  aria-label={t('common.selectAll')}
                  className={cn(someSelected && 'data-[state=checked]:bg-primary/50')}
                  {...(someSelected ? { 'data-state': 'indeterminate' } : {})}
                />
              </th>
              {!compact && (
                <th className="w-10 p-3 border-e bg-gray-50 text-center font-semibold">#</th>
              )}
              <th className="p-3 border-e bg-gray-50 text-start font-semibold min-w-[140px]">
                <div className="flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-violet-600" />
                  {t('subjects.columns.name')}
                </div>
              </th>
              <th className="w-20 p-3 border-e bg-gray-50 text-center font-semibold">
                {t('subjects.columns.code')}
              </th>
              <th className="w-24 p-3 border-e bg-gray-50 text-center font-semibold">
                {t('subjects.columns.section')}
              </th>
              {!compact && (
                <th className="w-16 p-3 border-e bg-gray-50 text-center font-semibold">
                  {t('subjects.columns.grade')}
                </th>
              )}
              <th className="w-20 p-3 border-e bg-gray-50 text-center font-semibold">
                {t('subjects.columns.periodsPerWeek')}
              </th>
              {!compact && (
                <th className="w-28 p-3 border-e bg-gray-50 text-center font-semibold">
                  {t('subjects.columns.roomType')}
                </th>
              )}
              <th className="w-16 p-3 border-e bg-gray-50 text-center font-semibold">
                {t('subjects.columns.difficult')}
              </th>
              <th className="w-24 p-3 bg-gray-50 text-center font-semibold">
                {t('subjects.columns.coverage', 'پوشش')}
              </th>
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {subjects.map((subject, index) => {
              const isSelected = selectedId === subject.id;
              const isChecked = selectedIds.has(subject.id);

              return (
                <tr
                  key={subject.id}
                  className={cn(
                    'border-b last:border-b-0 cursor-pointer transition-colors',
                    isSelected ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50',
                    isChecked && !isSelected && 'bg-primary/5'
                  )}
                  onClick={(e) => handleRowClick(subject, e)}
                  onKeyDown={(e) => handleKeyDown(e, subject)}
                  tabIndex={0}
                  aria-selected={isSelected}
                >
                  {/* Checkbox */}
                  <td
                    className={cn(
                      'w-12 p-3 border-e text-center',
                      isSelected && 'border-s-4 border-s-blue-500'
                    )}
                    data-checkbox
                    onClick={handleCheckboxClick}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => onToggleSelect?.(subject.id)}
                      aria-label={t('common.select')}
                    />
                  </td>

                  {/* Row number */}
                  {!compact && (
                    <td className="w-10 p-3 border-e text-center text-xs text-muted-foreground">
                      {index + 1}
                    </td>
                  )}

                  {/* Name */}
                  <td className="p-3 border-e">
                    <span className="font-medium text-gray-900">{subject.name}</span>
                    {compact && (
                      <div className="flex items-center gap-2 mt-0.5">
                        {subject.grade && (
                          <span className="text-xs text-muted-foreground">
                            {t('subjects.columns.grade')}: {subject.grade}
                          </span>
                        )}
                        {subject.requiredRoomType && (
                          <RoomTypeBadge roomType={subject.requiredRoomType} t={t} />
                        )}
                      </div>
                    )}
                  </td>

                  {/* Code */}
                  <td className="w-20 p-3 border-e text-center">
                    {subject.code ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 h-5 font-mono bg-slate-50"
                      >
                        {subject.code}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* Section */}
                  <td className="w-24 p-3 border-e text-center">
                    <SectionBadge section={subject.section} t={t} />
                  </td>

                  {/* Grade */}
                  {!compact && (
                    <td className="w-16 p-3 border-e text-center">
                      {subject.grade ? (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 text-sm font-medium text-gray-700">
                          {subject.grade}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  )}

                  {/* Periods Per Week */}
                  <td className="w-20 p-3 border-e text-center">
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 text-sm font-semibold text-blue-700 cursor-help">
                            {subject.periodsPerWeek ?? '—'}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">
                            {subject.periodsPerWeek}{' '}
                            {t('subjects.periodsPerWeekHint', 'ساعت در هفته')}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </td>

                  {/* Room Type */}
                  {!compact && (
                    <td className="w-28 p-3 border-e text-center">
                      <RoomTypeBadge roomType={subject.requiredRoomType} t={t} />
                    </td>
                  )}

                  {/* Is Difficult */}
                  <td className="w-16 p-3 border-e text-center">
                    {subject.isDifficult && <DifficultBadge t={t} />}
                  </td>

                  {/* Coverage */}
                  <td
                    className="w-24 p-3 text-center"
                    data-coverage
                    onClick={(e) => handleCoverageClick(subject, e)}
                  >
                    <SubjectCoverageCell
                      summary={summaryMap.get(subject.id) ?? null}
                      onClick={() => onCoverageClick?.(subject)}
                      compact
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="border-t px-4 py-2 text-xs text-muted-foreground bg-gray-50 flex justify-between items-center shrink-0">
        <span>{t('subjects.recordCount', { count: subjects.length })}</span>
        {selectedIds.size > 0 && (
          <span className="text-primary font-medium">
            {selectedIds.size} {t('common.selected', 'انتخاب شده')}
          </span>
        )}
      </div>
    </div>
  );
}

export default SubjectDataGrid;
