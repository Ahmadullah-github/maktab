/**
 * SubjectSelector Component
 *
 * Phase 1.4: Shared UI Components
 *
 * Dropdown for selecting a subject with:
 * - Coverage percentage
 * - Classes requiring count
 * - Compatibility filtering (when teacher is selected)
 */

import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { BookOpen, CheckCircle2 } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { SubjectOption } from '../../hooks/useUnifiedAssignment';

export interface SubjectSelectorProps {
  /** Currently selected subject ID */
  value: number | null;
  /** Change handler */
  onChange: (subjectId: number | null) => void;
  /** Available subject options */
  subjects: SubjectOption[];
  /** Placeholder text */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Show coverage info */
  showCoverage?: boolean;
  /** Show classes requiring count */
  showClassCount?: boolean;
  /** Filter to only subjects with unassigned classes */
  filterIncomplete?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Get coverage color based on percentage
 */
function getCoverageColor(percentage: number): string {
  if (percentage === 100) return 'text-emerald-600';
  if (percentage >= 50) return 'text-blue-600';
  if (percentage > 0) return 'text-amber-600';
  return 'text-red-600';
}

/**
 * Get coverage badge variant
 */
function getCoverageBadgeStyle(percentage: number): {
  bg: string;
  text: string;
  border: string;
} {
  if (percentage === 100) {
    return { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' };
  }
  if (percentage >= 50) {
    return { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' };
  }
  if (percentage > 0) {
    return { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' };
  }
  return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' };
}

export function SubjectSelector({
  value,
  onChange,
  subjects,
  placeholder,
  disabled = false,
  showCoverage = true,
  showClassCount = true,
  filterIncomplete = false,
  className,
}: SubjectSelectorProps) {
  const { t } = useTranslation();

  // Filter and categorize subjects
  const { completeSubjects, incompleteSubjects, selectedSubject } = useMemo(() => {
    let filtered = subjects;
    if (filterIncomplete) {
      filtered = subjects.filter((s) => s.coveragePercentage < 100 || s.id === value);
    }

    const complete = filtered.filter((s) => s.coveragePercentage === 100);
    const incomplete = filtered.filter((s) => s.coveragePercentage < 100);
    const selected = value ? subjects.find((s) => s.id === value) : null;

    return {
      completeSubjects: complete,
      incompleteSubjects: incomplete,
      selectedSubject: selected,
    };
  }, [subjects, filterIncomplete, value]);

  const handleChange = (val: string) => {
    if (val === 'none') {
      onChange(null);
    } else {
      onChange(parseInt(val, 10));
    }
  };

  return (
    <Select value={value?.toString() ?? 'none'} onValueChange={handleChange} disabled={disabled}>
      <SelectTrigger className={cn('w-full', className)}>
        <SelectValue placeholder={placeholder || t('assignments.selectSubject', 'انتخاب مضمون')}>
          {selectedSubject && (
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-slate-400" />
              <span className="truncate">{selectedSubject.name}</span>
              {showCoverage && (
                <span
                  className={cn(
                    'text-xs tabular-nums',
                    getCoverageColor(selectedSubject.coveragePercentage)
                  )}
                >
                  {selectedSubject.coveragePercentage}%
                </span>
              )}
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {/* No selection option */}
        <SelectItem value="none">
          <span className="text-slate-500">{t('common.none', 'هیچکدام')}</span>
        </SelectItem>

        {/* Incomplete subjects (need attention) */}
        {incompleteSubjects.length > 0 && (
          <SelectGroup>
            <SelectLabel className="text-xs text-amber-600">
              {t('assignments.needsAttention', 'نیاز به تخصیص')}
            </SelectLabel>
            {incompleteSubjects.map((subject) => (
              <SubjectOptionItem
                key={subject.id}
                subject={subject}
                showCoverage={showCoverage}
                showClassCount={showClassCount}
              />
            ))}
          </SelectGroup>
        )}

        {/* Complete subjects */}
        {completeSubjects.length > 0 && (
          <SelectGroup>
            <SelectLabel className="text-xs text-emerald-600">
              {t('assignments.fullyAssigned', 'تخصیص کامل')}
            </SelectLabel>
            {completeSubjects.map((subject) => (
              <SubjectOptionItem
                key={subject.id}
                subject={subject}
                showCoverage={showCoverage}
                showClassCount={showClassCount}
              />
            ))}
          </SelectGroup>
        )}

        {/* Empty state */}
        {incompleteSubjects.length === 0 && completeSubjects.length === 0 && (
          <div className="py-4 text-center text-sm text-slate-500">
            {t('assignments.noSubjectsAvailable', 'مضمونی موجود نیست')}
          </div>
        )}
      </SelectContent>
    </Select>
  );
}

/**
 * Individual subject option in the dropdown
 */
function SubjectOptionItem({
  subject,
  showCoverage,
  showClassCount,
}: {
  subject: SubjectOption;
  showCoverage: boolean;
  showClassCount: boolean;
}) {
  const coverageStyle = getCoverageBadgeStyle(subject.coveragePercentage);
  const isComplete = subject.coveragePercentage === 100;

  return (
    <SelectItem value={subject.id.toString()} className="py-2">
      <div className="flex items-center justify-between w-full gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="truncate">{subject.name}</span>
          {isComplete && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {showClassCount && subject.classesRequiring > 0 && (
            <span className="text-xs text-slate-500 tabular-nums">
              {subject.classesAssigned}/{subject.classesRequiring}
            </span>
          )}

          {showCoverage && (
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] px-1.5 py-0 tabular-nums',
                coverageStyle.bg,
                coverageStyle.text,
                coverageStyle.border
              )}
            >
              {subject.coveragePercentage}%
            </Badge>
          )}
        </div>
      </div>
    </SelectItem>
  );
}

export default SubjectSelector;
