/**
 * GradeBadge Component
 *
 * Displays a grade number with a category-colored badge
 * based on the Afghan education system classification:
 * - alphaPrimary (1-3): Green
 * - betaPrimary (4-6): Blue
 * - middle (7-9): Purple
 * - high (10-12): Orange
 *
 * Requirements: 1.4, 5.3
 */

import { cn } from '@/lib/utils';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { GradeCategory } from '../../types';
import { getGradeCategory, GRADE_CATEGORY_COLORS } from '../../utils/gradeCategory';
import { componentLogger } from '../../utils/logger';

export interface GradeBadgeProps {
  /** Grade number (1-12) or null */
  grade: number | null;
  /** Optional additional CSS classes */
  className?: string;
  /** Whether to show the category label alongside the grade */
  showCategoryLabel?: boolean;
}

/**
 * GradeBadge displays a grade number with appropriate category coloring
 *
 * @example
 * ```tsx
 * <GradeBadge grade={7} />
 * <GradeBadge grade={3} showCategoryLabel />
 * ```
 */
export function GradeBadge({ grade, className, showCategoryLabel = false }: GradeBadgeProps) {
  const { t } = useTranslation();

  // Debug logging on mount
  useEffect(() => {
    componentLogger.mount('GradeBadge', { grade, showCategoryLabel });
    return () => componentLogger.unmount('GradeBadge');
  }, [grade, showCategoryLabel]);

  // Handle null grade
  if (grade === null) {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium',
          'bg-gray-100 text-gray-500',
          className
        )}
      >
        —
      </span>
    );
  }

  const category = getGradeCategory(grade);
  const colorClass = GRADE_CATEGORY_COLORS[category];
  const categoryLabel = getCategoryLabel(category, t);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium',
        colorClass,
        className
      )}
      dir="auto"
    >
      <span className="font-semibold">{grade}</span>
      {showCategoryLabel && categoryLabel && (
        <span className="text-xs opacity-80">({categoryLabel})</span>
      )}
    </span>
  );
}

/**
 * Gets the localized category label
 */
function getCategoryLabel(category: GradeCategory, t: (key: string) => string): string | null {
  if (category === 'all') return null;

  const labelKey = `classes.gradeCategory.${category}`;
  return t(labelKey);
}

export default GradeBadge;
