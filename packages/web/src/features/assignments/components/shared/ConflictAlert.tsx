/**
 * ConflictAlert Component
 *
 * Phase 4.3: Unified Conflict Display Across Views
 *
 * Displays assignment conflicts with consistent styling and Farsi messages
 * across all three views (teacher, subject, class).
 *
 * Features:
 * - Consistent error/warning styling
 * - Farsi messages with resolution suggestions
 * - Collapsible for multiple conflicts
 * - Icon indicators by conflict type
 */

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  UserX,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AssignmentConflict, ConflictType } from '../../types';

// ============================================================================
// Types
// ============================================================================

export interface ConflictAlertProps {
  /** Single conflict to display */
  conflict?: AssignmentConflict;
  /** Multiple conflicts to display */
  conflicts?: AssignmentConflict[];
  /** Whether to show resolution suggestions */
  showResolution?: boolean;
  /** Whether to use compact mode */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get icon for conflict type
 */
function getConflictIcon(type: ConflictType) {
  switch (type) {
    case 'workload_exceeded':
      return <Clock className="h-4 w-4" />;
    case 'subject_incompatible':
      return <UserX className="h-4 w-4" />;
    case 'duplicate_assignment':
      return <Copy className="h-4 w-4" />;
    case 'coverage_insufficient':
      return <Users className="h-4 w-4" />;
    case 'availability_conflict':
      return <Clock className="h-4 w-4" />;
    default:
      return <AlertCircle className="h-4 w-4" />;
  }
}

/**
 * Get conflict type label in Farsi
 */
function getConflictTypeLabel(type: ConflictType): string {
  switch (type) {
    case 'workload_exceeded':
      return 'تجاوز از ظرفیت';
    case 'subject_incompatible':
      return 'عدم تطابق مضمون';
    case 'duplicate_assignment':
      return 'تخصیص تکراری';
    case 'coverage_insufficient':
      return 'پوشش ناکافی';
    case 'availability_conflict':
      return 'تعارض در دسترسی';
    default:
      return 'تعارض';
  }
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Single conflict item display
 */
function ConflictItem({
  conflict,
  showResolution = true,
  compact = false,
}: {
  conflict: AssignmentConflict;
  showResolution?: boolean;
  compact?: boolean;
}) {
  const { i18n } = useTranslation();
  const isFarsi = i18n.language === 'fa';
  const isError = conflict.severity === 'error';

  if (compact) {
    return (
      <div
        className={cn(
          'flex items-start gap-2 text-xs p-2 rounded-lg',
          isError ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
        )}
      >
        <span className="shrink-0 mt-0.5">
          {isError ? (
            <AlertCircle className="h-3.5 w-3.5" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5" />
          )}
        </span>
        <span>{isFarsi ? conflict.messageFa : conflict.message}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-2 p-3 rounded-lg border',
        isError ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className={cn(isError ? 'text-red-600' : 'text-amber-600')}>
          {getConflictIcon(conflict.type)}
        </span>
        <Badge
          variant="outline"
          className={cn(
            'text-[10px] px-1.5 py-0',
            isError
              ? 'bg-red-100 text-red-700 border-red-200'
              : 'bg-amber-100 text-amber-700 border-amber-200'
          )}
        >
          {getConflictTypeLabel(conflict.type)}
        </Badge>
      </div>

      {/* Message */}
      <p className={cn('text-sm', isError ? 'text-red-700' : 'text-amber-700')}>
        {isFarsi ? conflict.messageFa : conflict.message}
      </p>

      {/* Resolution */}
      {showResolution && (conflict.suggestedResolutionFa || conflict.suggestedResolution) && (
        <p className="text-xs text-slate-600 border-t border-slate-200 pt-2 mt-1">
          <span className="font-medium">{isFarsi ? 'پیشنهاد: ' : 'Suggestion: '}</span>
          {isFarsi ? conflict.suggestedResolutionFa : conflict.suggestedResolution}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ConflictAlert({
  conflict,
  conflicts,
  showResolution = true,
  compact = false,
  className,
}: ConflictAlertProps) {
  const { i18n } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const isFarsi = i18n.language === 'fa';

  // Normalize to array
  const allConflicts = conflicts || (conflict ? [conflict] : []);

  if (allConflicts.length === 0) {
    return null;
  }

  const errors = allConflicts.filter((c) => c.severity === 'error');
  const warnings = allConflicts.filter((c) => c.severity === 'warning');
  const hasErrors = errors.length > 0;

  // Single conflict - simple display
  if (allConflicts.length === 1) {
    return (
      <div className={className}>
        <ConflictItem
          conflict={allConflicts[0]}
          showResolution={showResolution}
          compact={compact}
        />
      </div>
    );
  }

  // Multiple conflicts - collapsible display
  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className={className}>
      <Alert
        variant={hasErrors ? 'destructive' : 'default'}
        className={cn(
          'border-2',
          hasErrors
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-amber-50 border-amber-200 text-amber-800'
        )}
      >
        <div className="flex items-center gap-2">
          {hasErrors ? (
            <AlertCircle className="h-4 w-4 text-red-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          )}
          <AlertTitle className="text-sm font-semibold">
            {isFarsi
              ? `${allConflicts.length} مشکل شناسایی شد`
              : `${allConflicts.length} issues detected`}
          </AlertTitle>
        </div>

        <AlertDescription className="mt-2">
          <div className="flex items-center gap-3 text-xs">
            {errors.length > 0 && (
              <span className="flex items-center gap-1 text-red-600">
                <AlertCircle className="h-3 w-3" />
                {errors.length} {isFarsi ? 'خطا' : 'error(s)'}
              </span>
            )}
            {warnings.length > 0 && (
              <span className="flex items-center gap-1 text-amber-600">
                <AlertTriangle className="h-3 w-3" />
                {warnings.length} {isFarsi ? 'هشدار' : 'warning(s)'}
              </span>
            )}
          </div>

          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="mt-2 h-7 px-2 text-xs gap-1">
              {isExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  {isFarsi ? 'بستن جزئیات' : 'Hide details'}
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  {isFarsi ? 'نمایش جزئیات' : 'Show details'}
                </>
              )}
            </Button>
          </CollapsibleTrigger>
        </AlertDescription>

        <CollapsibleContent className="mt-3 space-y-2">
          {/* Show errors first */}
          {errors.map((c, idx) => (
            <ConflictItem
              key={`error-${idx}`}
              conflict={c}
              showResolution={showResolution}
              compact={compact}
            />
          ))}
          {/* Then warnings */}
          {warnings.map((c, idx) => (
            <ConflictItem
              key={`warning-${idx}`}
              conflict={c}
              showResolution={showResolution}
              compact={compact}
            />
          ))}
        </CollapsibleContent>
      </Alert>
    </Collapsible>
  );
}

export default ConflictAlert;
