import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { ChevronDown, User } from 'lucide-react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CategoryAccordionProps, CategoryWithClasses, ClassMetadata } from '../../types';

/**
 * ClassItem - Renders a single class in the accordion
 */
interface ClassItemProps {
  classData: ClassMetadata;
  isSelected: boolean;
  onClick: () => void;
}

const ClassItem = memo(function ClassItem({ classData, isSelected, onClick }: ClassItemProps) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm rounded-lg transition-all duration-200',
        'hover:bg-slate-50 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20',
        isSelected
          ? 'bg-blue-50 text-blue-700 font-medium shadow-sm border border-blue-200'
          : 'text-slate-700 hover:text-slate-900'
      )}
      aria-selected={isSelected}
      role="option"
    >
      <span className="truncate text-start flex-1">{classData.className}</span>

      {/* Metadata badges */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Student count - primary info */}
        {classData.studentCount > 0 && (
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium transition-colors',
              isSelected
                ? 'bg-blue-100 text-blue-700'
                : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
            )}
          >
            <User className="h-3 w-3" />
            {classData.studentCount}
          </span>
        )}

        {/* Single-teacher indicator - subtle */}
        {classData.singleTeacherMode && (
          <span
            className={cn(
              'inline-flex items-center px-1.5 py-0.5 rounded text-xs',
              isSelected
                ? 'bg-violet-100 text-violet-600'
                : 'bg-violet-50 text-violet-500 group-hover:bg-violet-100'
            )}
            title={t('schedule.singleTeacherMode', 'حالت تک‌معلم')}
          >
            <User className="h-3 w-3" />
          </span>
        )}
      </div>
    </button>
  );
});

/**
 * CategorySection - Renders a collapsible category section
 */
interface CategorySectionProps {
  category: CategoryWithClasses;
  selectedClassId: string | null;
  onSelectClass: (classId: string) => void;
  defaultOpen?: boolean;
}

const CategorySection = memo(function CategorySection({
  category,
  selectedClassId,
  onSelectClass,
  defaultOpen = false,
}: CategorySectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Auto-expand if selected class is in this category
  const hasSelectedClass = category.classes.some((c) => c.classId === selectedClassId);

  return (
    <Collapsible
      open={isOpen || hasSelectedClass}
      onOpenChange={setIsOpen}
      className="border-b border-slate-100 last:border-b-0"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            'w-full flex items-center justify-between gap-3 px-4 py-3.5',
            'hover:bg-slate-50 transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:ring-inset',
            (isOpen || hasSelectedClass) && 'bg-slate-50'
          )}
          aria-expanded={isOpen || hasSelectedClass}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex items-center justify-center w-6 h-6 rounded-md transition-colors',
                isOpen || hasSelectedClass
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-slate-100 text-slate-500'
              )}
            >
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform duration-200',
                  (isOpen || hasSelectedClass) && 'rotate-180'
                )}
              />
            </div>
            <span className="font-semibold text-sm text-slate-800">{category.nameFa}</span>
          </div>
          {/* Class count badge - more prominent */}
          <span
            className={cn(
              'inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full text-xs font-medium transition-colors',
              isOpen || hasSelectedClass
                ? 'bg-blue-100 text-blue-700'
                : 'bg-slate-100 text-slate-600'
            )}
          >
            {category.classes.length}
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="py-2 px-3 space-y-1" role="listbox" aria-label={category.nameFa}>
          {category.classes.map((classData) => (
            <ClassItem
              key={classData.classId}
              classData={classData}
              isSelected={classData.classId === selectedClassId}
              onClick={() => onSelectClass(classData.classId)}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
});

/**
 * CategoryAccordion - Collapsible navigation for classes grouped by grade category
 *
 * Renders collapsible sections for Afghanistan's four-tier grade classification:
 * - Alpha-Primary (grades 1-3)
 * - Beta-Primary (grades 4-6)
 * - Middle (grades 7-9)
 * - High (grades 10-12)
 */
export const CategoryAccordion = memo(function CategoryAccordion({
  categories,
  selectedClassId,
  onSelectClass,
}: CategoryAccordionProps) {
  const { t } = useTranslation();

  if (categories.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        {t('schedule.noClasses', 'هیچ صنفی یافت نشد')}
      </div>
    );
  }

  return (
    <nav
      className="flex flex-col"
      role="navigation"
      aria-label={t('schedule.classNavigation', 'ناوبری صنف‌ها')}
    >
      {categories.map((category, index) => (
        <CategorySection
          key={category.key}
          category={category}
          selectedClassId={selectedClassId}
          onSelectClass={onSelectClass}
          defaultOpen={index === 0}
        />
      ))}
    </nav>
  );
});

export default CategoryAccordion;
