/**
 * AddClassPopover Component
 *
 * Popover for adding classes to a subject assignment.
 * Shows:
 * - Search input for filtering classes
 * - Checkbox list of available classes (not already assigned)
 * - Class name + grade badge + periods info
 * - Select all / Deselect all buttons
 * - "Add Selected" button with period preview
 *
 * Phase 1.2 of SubjectManager Refactoring
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { CheckSquare, GraduationCap, Loader2, Plus, Search, Square, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Class info for display in the popover
 */
export interface AvailableClass {
  id: number;
  name: string;
  displayName?: string;
  grade?: number | null;
  /** Total periods per week for the subject in this class */
  periodsPerWeek: number;
  /** Periods already assigned to other teachers (for multi-teacher support) */
  assignedPeriods?: number;
  /** Remaining periods available for assignment */
  remainingPeriods?: number;
}

export interface AddClassPopoverProps {
  /** Subject name for display */
  subjectName: string;
  /** Classes available to add (not already assigned) */
  availableClasses: AvailableClass[];
  /** Callback when classes are added */
  onAdd: (classIds: number[]) => void;
  /** Whether the popover is disabled */
  disabled?: boolean;
  /** Whether an add operation is in progress */
  isAdding?: boolean;
  /** The trigger element */
  trigger: React.ReactNode;
  /** Popover alignment */
  align?: 'start' | 'center' | 'end';
  /** Additional CSS classes for the popover content */
  className?: string;
}

/**
 * Get grade category label
 */
function getGradeLabel(grade: number | null | undefined): string {
  if (grade === null || grade === undefined) return '';
  if (grade >= 1 && grade <= 3) return 'α';
  if (grade >= 4 && grade <= 6) return 'β';
  if (grade >= 7 && grade <= 9) return 'M';
  if (grade >= 10 && grade <= 12) return 'H';
  return '';
}

/**
 * Get grade badge color
 */
function getGradeBadgeColor(grade: number | null | undefined): string {
  if (grade === null || grade === undefined) return 'bg-slate-100 text-slate-600';
  if (grade >= 1 && grade <= 3) return 'bg-pink-100 text-pink-700';
  if (grade >= 4 && grade <= 6) return 'bg-purple-100 text-purple-700';
  if (grade >= 7 && grade <= 9) return 'bg-cyan-100 text-cyan-700';
  if (grade >= 10 && grade <= 12) return 'bg-emerald-100 text-emerald-700';
  return 'bg-slate-100 text-slate-600';
}

/**
 * AddClassPopover - Popover for selecting classes to add to a subject
 */
export function AddClassPopover({
  subjectName,
  availableClasses,
  onAdd,
  disabled = false,
  isAdding = false,
  trigger,
  align = 'start',
  className,
}: AddClassPopoverProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Filter classes by search query
  const filteredClasses = useMemo(() => {
    if (!searchQuery.trim()) return availableClasses;
    const query = searchQuery.toLowerCase();
    return availableClasses.filter(
      (cls) =>
        cls.name.toLowerCase().includes(query) ||
        (cls.displayName && cls.displayName.toLowerCase().includes(query)) ||
        (cls.grade !== null && cls.grade !== undefined && String(cls.grade).includes(query))
    );
  }, [availableClasses, searchQuery]);

  // Calculate total periods for selected classes
  const selectedPeriods = useMemo(() => {
    return filteredClasses
      .filter((cls) => selectedIds.has(cls.id))
      .reduce((sum, cls) => sum + cls.periodsPerWeek, 0);
  }, [filteredClasses, selectedIds]);

  // Handle checkbox toggle
  const handleToggle = useCallback((classId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) {
        next.delete(classId);
      } else {
        next.add(classId);
      }
      return next;
    });
  }, []);

  // Handle select all
  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(filteredClasses.map((cls) => cls.id)));
  }, [filteredClasses]);

  // Handle deselect all
  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Handle add
  const handleAdd = useCallback(() => {
    if (selectedIds.size === 0) return;
    onAdd(Array.from(selectedIds));
    // Reset state after adding
    setSelectedIds(new Set());
    setSearchQuery('');
    setIsOpen(false);
  }, [selectedIds, onAdd]);

  // Handle popover open change
  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Reset state when closing
      setSelectedIds(new Set());
      setSearchQuery('');
    }
  }, []);

  const allSelected = filteredClasses.length > 0 && selectedIds.size === filteredClasses.length;
  const someSelected = selectedIds.size > 0;

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild disabled={disabled || availableClasses.length === 0}>
        {trigger}
      </PopoverTrigger>
      <PopoverContent align={align} className={cn('w-80 p-0', className)}>
        {/* Header */}
        <div className="px-3 py-2.5 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-sm text-slate-800">
                {t('teachers.addClassesFor', 'افزودن صنف برای')}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 -me-1"
              onClick={() => setIsOpen(false)}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{subjectName}</p>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder={t('teachers.searchClasses', 'جستجوی صنف...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 ps-8 text-sm border-slate-200"
            />
          </div>
        </div>

        {/* Select All / Deselect All */}
        {filteredClasses.length > 0 && (
          <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {filteredClasses.length} {t('teachers.classesAvailable', 'صنف موجود')}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs gap-1"
                onClick={handleSelectAll}
                disabled={allSelected}
              >
                <CheckSquare className="w-3 h-3" />
                {t('common.selectAll', 'انتخاب همه')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs gap-1"
                onClick={handleDeselectAll}
                disabled={!someSelected}
              >
                <Square className="w-3 h-3" />
                {t('common.deselectAll', 'لغو انتخاب')}
              </Button>
            </div>
          </div>
        )}

        {/* Class List */}
        <ScrollArea className="max-h-[240px]">
          {filteredClasses.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <GraduationCap className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-500">
                {availableClasses.length === 0
                  ? t('teachers.noClassesAvailable', 'همه صنف‌ها اختصاص داده شده‌اند')
                  : t('teachers.noClassesFound', 'صنفی یافت نشد')}
              </p>
            </div>
          ) : (
            <div className="p-1.5">
              {filteredClasses.map((cls) => {
                const isSelected = selectedIds.has(cls.id);
                return (
                  <div
                    key={cls.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleToggle(cls.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleToggle(cls.id);
                      }
                    }}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-colors text-start cursor-pointer',
                      isSelected ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-slate-50'
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      className={cn(
                        'shrink-0',
                        isSelected && 'border-blue-500 data-[state=checked]:bg-blue-600'
                      )}
                      tabIndex={-1}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-sm text-slate-800 truncate">
                          {cls.displayName || cls.name}
                        </span>
                        {cls.grade !== null && cls.grade !== undefined && (
                          <Badge
                            variant="secondary"
                            className={cn(
                              'text-[9px] px-1.5 py-0 h-4 shrink-0',
                              getGradeBadgeColor(cls.grade)
                            )}
                          >
                            {getGradeLabel(cls.grade)}
                            {cls.grade}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-slate-500 shrink-0 tabular-nums">
                      {cls.periodsPerWeek} {t('common.period', 'ساعت')}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="px-3 py-2.5 border-t border-slate-200 bg-slate-50/50">
          <div className="flex items-center justify-between">
            {/* Period Preview */}
            <div className="text-xs text-slate-600">
              {someSelected && (
                <>
                  <span className="font-medium text-blue-600">{selectedIds.size}</span>{' '}
                  {t('teachers.classesSelected', 'صنف انتخاب شده')}
                  {' • '}
                  <span className="font-medium text-emerald-600">+{selectedPeriods}</span>{' '}
                  {t('common.period', 'ساعت')}
                </>
              )}
            </div>
            {/* Add Button */}
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!someSelected || isAdding}
              className="h-8 px-3 gap-1.5 bg-blue-600 hover:bg-blue-700"
            >
              {isAdding ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              {t('common.add', 'افزودن')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default AddClassPopover;
