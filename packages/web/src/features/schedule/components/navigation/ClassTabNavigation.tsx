/**
 * ClassTabNavigation - Hybrid tabs + dropdown navigation for classes
 *
 * Modern horizontal navigation that shows:
 * - Recent/pinned classes as tabs (quick access)
 * - Dropdown for all classes (full access)
 * - Current class metadata
 *
 * Design: Hybrid Tabs + Dropdown approach
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { ChevronDown, GraduationCap, MoreHorizontal, User } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { CategoryWithClasses, ClassMetadata } from '../../types';

/**
 * Props for ClassTabNavigation
 */
export interface ClassTabNavigationProps {
  /** All classes grouped by category */
  categories: CategoryWithClasses[];
  /** Currently selected class ID */
  selectedClassId: string | null;
  /** Callback when class is selected */
  onSelectClass: (classId: string) => void;
  /** Maximum number of tabs to show (default: 6) */
  maxTabs?: number;
}

/**
 * ClassTab - Individual class tab button
 */
interface ClassTabProps {
  classData: ClassMetadata;
  isSelected: boolean;
  onClick: () => void;
}

const ClassTab = memo(function ClassTab({ classData, isSelected, onClick }: ClassTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all duration-200',
        'border-b-2 whitespace-nowrap',
        isSelected
          ? 'border-emerald-500 text-emerald-900 bg-emerald-50'
          : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100 hover:border-slate-300'
      )}
      aria-selected={isSelected}
      role="tab"
    >
      <span>{classData.className}</span>

      {/* Indicators */}
      <div className="flex items-center gap-1">
        {classData.singleTeacherMode && (
          <User className={cn('h-3 w-3', isSelected ? 'text-emerald-600' : 'text-slate-400')} />
        )}
        {classData.studentCount > 0 && (
          <span
            className={cn(
              'text-xs px-1.5 py-0.5 rounded',
              isSelected
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
            )}
          >
            {classData.studentCount}
          </span>
        )}
      </div>
    </button>
  );
});

/**
 * ClassDropdownItem - Class item in dropdown menu
 */
interface ClassDropdownItemProps {
  classData: ClassMetadata;
  isSelected: boolean;
  onClick: () => void;
}

const ClassDropdownItem = memo(function ClassDropdownItem({
  classData,
  isSelected,
  onClick,
}: ClassDropdownItemProps) {
  return (
    <DropdownMenuItem
      onClick={onClick}
      className={cn(
        'flex items-center justify-between gap-3 px-3 py-2 cursor-pointer',
        isSelected && 'bg-emerald-50 text-emerald-900'
      )}
    >
      <span className="font-medium">{classData.className}</span>
      <div className="flex items-center gap-1.5">
        {classData.singleTeacherMode && <User className="h-3 w-3 text-violet-500" />}
        {classData.studentCount > 0 && (
          <span className={cn('text-xs', isSelected ? 'text-emerald-700' : 'text-slate-500')}>
            {classData.studentCount}
          </span>
        )}
      </div>
    </DropdownMenuItem>
  );
});

/**
 * ClassTabNavigation - Main component
 */
export const ClassTabNavigation = memo(function ClassTabNavigation({
  categories,
  selectedClassId,
  onSelectClass,
  maxTabs = 6,
}: ClassTabNavigationProps) {
  const { t } = useTranslation();

  // Flatten all classes
  const allClasses = useMemo(() => {
    return categories.flatMap((cat) => cat.classes);
  }, [categories]);

  // Get selected class data
  const selectedClass = useMemo(() => {
    return allClasses.find((c) => c.classId === selectedClassId) ?? null;
  }, [allClasses, selectedClassId]);

  // Get category of selected class
  const selectedCategory = useMemo(() => {
    return categories.find((cat) => cat.classes.some((c) => c.classId === selectedClassId));
  }, [categories, selectedClassId]);

  // Determine which classes to show as tabs
  // Strategy: Show selected class + nearby classes from same category
  const tabClasses = useMemo(() => {
    if (!selectedClass || !selectedCategory) {
      // No selection: show first N classes
      return allClasses.slice(0, maxTabs);
    }

    // Get classes from selected category
    const categoryClasses = selectedCategory.classes;
    const selectedIndex = categoryClasses.findIndex((c) => c.classId === selectedClassId);

    // Calculate how many to show before and after
    const before = Math.floor((maxTabs - 1) / 2);
    const after = maxTabs - 1 - before;

    let startIndex = Math.max(0, selectedIndex - before);
    let endIndex = Math.min(categoryClasses.length, selectedIndex + after + 1);

    // Adjust if we're at the edges
    if (endIndex - startIndex < maxTabs) {
      if (startIndex === 0) {
        endIndex = Math.min(categoryClasses.length, maxTabs);
      } else {
        startIndex = Math.max(0, endIndex - maxTabs);
      }
    }

    return categoryClasses.slice(startIndex, endIndex);
  }, [allClasses, selectedClass, selectedCategory, selectedClassId, maxTabs]);

  // Classes not shown in tabs (for dropdown)
  const dropdownClasses = useMemo(() => {
    const tabIds = new Set(tabClasses.map((c) => c.classId));
    return allClasses.filter((c) => !tabIds.has(c.classId));
  }, [allClasses, tabClasses]);

  // Group dropdown classes by category
  const dropdownByCategory = useMemo(() => {
    return categories
      .map((cat) => ({
        ...cat,
        classes: cat.classes.filter((c) => dropdownClasses.some((dc) => dc.classId === c.classId)),
      }))
      .filter((cat) => cat.classes.length > 0);
  }, [categories, dropdownClasses]);

  if (allClasses.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-slate-500">
        <GraduationCap className="h-5 w-5 me-2" />
        {t('schedule.noClasses', 'هیچ صنفی یافت نشد')}
      </div>
    );
  }

  return (
    <div className="flex flex-col border-b border-slate-200 bg-white">
      {/* Tab Bar */}
      <div className="flex items-center gap-2 px-4">
        {/* Tabs Container with Horizontal Scroll */}
        <ScrollArea className="flex-1">
          <div className="flex items-center" role="tablist">
            {tabClasses.map((classData) => (
              <ClassTab
                key={classData.classId}
                classData={classData}
                isSelected={classData.classId === selectedClassId}
                onClick={() => onSelectClass(classData.classId)}
              />
            ))}
          </div>
        </ScrollArea>

        {/* More Dropdown */}
        {dropdownClasses.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 border-b-2 border-transparent rounded-none transition-colors"
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="text-sm">{t('schedule.moreClasses', 'بیشتر')}</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 max-h-96 overflow-y-auto">
              {dropdownByCategory.map((category, index) => (
                <DropdownMenuGroup key={category.key}>
                  {index > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuLabel className="text-xs font-semibold text-slate-500">
                    {category.nameFa} ({category.classes.length})
                  </DropdownMenuLabel>
                  {category.classes.map((classData) => (
                    <ClassDropdownItem
                      key={classData.classId}
                      classData={classData}
                      isSelected={classData.classId === selectedClassId}
                      onClick={() => onSelectClass(classData.classId)}
                    />
                  ))}
                </DropdownMenuGroup>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Metadata Bar - Shows info about selected class */}
      {selectedClass && (
        <div className="flex items-center gap-4 px-4 py-2 bg-emerald-50/50 border-t border-emerald-100">
          <div className="flex items-center gap-2 text-xs text-slate-700">
            <GraduationCap className="h-3.5 w-3.5 text-emerald-600" />
            <span className="font-medium">{selectedClass.className}</span>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-600">
            {/* Student count */}
            {selectedClass.studentCount > 0 && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3 text-emerald-600" />
                {selectedClass.studentCount} {t('schedule.students', 'شاگرد')}
              </span>
            )}

            {/* Single teacher mode */}
            {selectedClass.singleTeacherMode && (
              <Badge
                variant="secondary"
                className="text-xs bg-violet-100 text-violet-700 border-violet-200"
              >
                {t('schedule.singleTeacherMode', 'تک‌معلم')}
              </Badge>
            )}

            {/* Category */}
            {selectedCategory && (
              <span className="text-slate-500">• {selectedCategory.nameFa}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

export default ClassTabNavigation;
