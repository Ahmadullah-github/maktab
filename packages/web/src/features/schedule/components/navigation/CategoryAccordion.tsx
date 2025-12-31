import { Badge } from '@/components/ui/badge';
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
        'w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-md transition-colors',
        'hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
        isSelected && 'bg-primary/10 text-primary font-medium border-s-2 border-primary'
      )}
      aria-selected={isSelected}
      role="option"
    >
      <span className="truncate text-start">{classData.className}</span>
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Single-teacher mode indicator */}
        {classData.singleTeacherMode && (
          <span
            className="flex items-center gap-0.5 text-xs text-muted-foreground"
            title={t('schedule.singleTeacherMode', 'حالت تک‌معلم')}
          >
            <User className="h-3 w-3" />
          </span>
        )}
        {/* Student count badge */}
        {classData.studentCount > 0 && (
          <Badge variant="outline" className="text-xs px-1.5 py-0">
            {classData.studentCount}
          </Badge>
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
      className="border-b border-border last:border-b-0"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            'w-full flex items-center justify-between gap-2 px-3 py-3',
            'hover:bg-muted/50 transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset'
          )}
          aria-expanded={isOpen || hasSelectedClass}
        >
          <div className="flex items-center gap-2">
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform duration-200',
                (isOpen || hasSelectedClass) && 'rotate-180'
              )}
            />
            <span className="font-medium text-sm">{category.nameFa}</span>
          </div>
          {/* Class count badge */}
          <Badge variant="secondary" className="text-xs">
            {category.classes.length}
          </Badge>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pb-2 ps-4 pe-2 space-y-0.5" role="listbox" aria-label={category.nameFa}>
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
