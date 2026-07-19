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
import { ChevronDown, GraduationCap, ListFilter, User } from 'lucide-react';
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
        'group relative flex h-9 items-center gap-2 whitespace-nowrap rounded-lg border px-3 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        isSelected
          ? 'border-primary/20 bg-primary text-primary-foreground shadow-sm'
          : 'border-transparent bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
      aria-selected={isSelected}
      role="tab"
    >
      <span>{classData.className}</span>

      {/* Indicators */}
      <div className="flex items-center gap-1">
        {classData.singleTeacherMode && (
          <User className={cn('h-3 w-3', isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground')} />
        )}
        {classData.studentCount > 0 && (
          <span
            className={cn(
              'rounded-md px-1.5 py-0.5 text-[11px] tabular-nums',
              isSelected
                ? 'bg-primary-foreground/20 text-primary-foreground'
                : 'bg-muted text-muted-foreground group-hover:bg-background'
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
        isSelected && 'bg-accent text-accent-foreground'
      )}
    >
      <span className="font-medium">{classData.className}</span>
      <div className="flex items-center gap-1.5">
        {classData.singleTeacherMode && <User className="h-3 w-3 text-muted-foreground" />}
        {classData.studentCount > 0 && (
          <span className="text-xs tabular-nums text-muted-foreground">
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
    <div className="border-b border-border/70 bg-background px-3 py-2">
      {/* Tab Bar */}
      <div className="flex items-center gap-2">
        {/* Tabs Container with Horizontal Scroll */}
        <ScrollArea className="flex-1">
          <div className="flex items-center gap-1.5" role="tablist">
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
                className="h-9 shrink-0 gap-1.5 rounded-lg border border-border/70 px-3 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ListFilter className="h-4 w-4" />
                <span className="hidden text-sm sm:inline">{t('schedule.moreClasses', 'همه صنف‌ها')}</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 max-h-96 overflow-y-auto">
              {dropdownByCategory.map((category, index) => (
                <DropdownMenuGroup key={category.key}>
                  {index > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
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

    </div>
  );
});

export default ClassTabNavigation;
