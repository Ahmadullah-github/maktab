/**
 * ErrorItem Component
 * Displays a single error with entity links and quick actions
 *
 * Features:
 * - Display message_farsi from error
 * - Render clickable links for each affected_entity
 * - Show context data (required vs available periods, etc.)
 * - Display quick action button when applicable
 * - Show suggestion prominently with lightbulb icon
 *
 * Requirements: 11.3, 11.4, 11.8, 11.9, 15.1, 15.2, 15.3, 15.4
 */

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AffectedEntity, ErrorQuickAction, SolverErrorDetail } from '@/types/solver';
import { motion } from 'framer-motion';
import { ArrowLeft, ExternalLink, Lightbulb } from 'lucide-react';

/**
 * Props for ErrorItem component
 */
export interface ErrorItemProps {
  /** Error detail from solver */
  error: SolverErrorDetail;
  /** Callback when an entity link is clicked */
  onEntityClick: (entity: AffectedEntity) => void;
  /** Quick action for this error (if available) */
  quickAction?: ErrorQuickAction | null;
  /** Callback when quick action is clicked */
  onQuickAction?: (action: { type: string; entityId?: string }) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Entity type labels in Persian
 */
const ENTITY_TYPE_LABELS: Record<AffectedEntity['entity_type'], string> = {
  teacher: 'استاد',
  class: 'صنف',
  room: 'اتاق',
  subject: 'مضمون',
};

/**
 * Parsed context data with separate suggestion and details
 */
interface ParsedContextData {
  /** Suggestion text (most important - shown prominently) */
  suggestion: string | null;
  /** Additional details (shown in muted style) */
  details: string | null;
}

/**
 * Format context data for display
 * Separates suggestion from other details for better UX
 */
function formatContextData(context: Record<string, unknown>): ParsedContextData {
  const detailParts: string[] = [];

  // Extract suggestion separately (most important for user)
  const suggestion = context.suggestion_farsi ? String(context.suggestion_farsi) : null;

  // Required vs available periods (Requirement: 11.8)
  if (context.required_periods !== undefined && context.available_periods !== undefined) {
    detailParts.push(
      `ساعات مورد نیاز: ${context.required_periods}، ساعات موجود: ${context.available_periods}`
    );
  }

  // Teacher capacity info (for TEACHER_OVERLOAD)
  if (context.availablePeriods !== undefined && context.requiredPeriods !== undefined) {
    detailParts.push(
      `ظرفیت: ${context.availablePeriods} ساعت، نیاز: ${context.requiredPeriods} ساعت`
    );
  }

  // Teacher max periods (for SINGLE_TEACHER_MAX_PERIODS)
  if (context.teacherMaxPeriods !== undefined && context.classRequiredPeriods !== undefined) {
    detailParts.push(
      `حداکثر ساعات استاد: ${context.teacherMaxPeriods}، نیاز صنف: ${context.classRequiredPeriods} ساعت`
    );
  }

  // Max periods per day
  if (context.max_periods_per_day !== undefined) {
    detailParts.push(`حداکثر ساعات روزانه: ${context.max_periods_per_day}`);
  }

  // Room type info
  if (context.roomType) {
    detailParts.push(`نوع اتاق مورد نیاز: ${context.roomType}`);
  }

  // Subject names list (for MISSING_ROOM_TYPE)
  if (context.subjectNames && Array.isArray(context.subjectNames)) {
    const names = context.subjectNames as string[];
    if (names.length > 0) {
      detailParts.push(`مضامین: ${names.join('، ')}`);
    }
  }

  // Missing subjects list (for SINGLE_TEACHER_MISSING_SUBJECTS)
  if (context.missingSubjects && Array.isArray(context.missingSubjects)) {
    const names = context.missingSubjects as string[];
    if (names.length > 0) {
      detailParts.push(`مضامین ناموجود: ${names.join('، ')}`);
    }
  }

  // Subject/class combination (Requirement: 11.9)
  if (context.subject_name && context.class_name) {
    detailParts.push(`مضمون: ${context.subject_name}، صنف: ${context.class_name}`);
  }

  // Subject and class names (alternative format)
  if (context.subjectName && context.className) {
    detailParts.push(`مضمون: ${context.subjectName}، صنف: ${context.className}`);
  }

  // Teacher and class names (for single-teacher errors)
  if (context.teacherName && context.className && !context.subjectName) {
    detailParts.push(`استاد: ${context.teacherName}، صنف: ${context.className}`);
  }

  // Gap/excess info (for EMPTY_PERIODS_ERROR / OVER_ALLOCATION_ERROR)
  if (context.gap !== undefined) {
    detailParts.push(`تفاوت: ${context.gap} ساعت`);
  }
  if (context.excess !== undefined) {
    detailParts.push(`اضافه: ${context.excess} ساعت`);
  }

  // Day and period info
  if (context.day !== undefined && context.period !== undefined) {
    detailParts.push(`روز: ${context.day}، ساعت: ${context.period}`);
  }

  // Room conflict info
  if (context.dayName !== undefined && context.periodNumber !== undefined) {
    detailParts.push(`روز: ${context.dayName}، ساعت: ${context.periodNumber}`);
  }

  // Class conflict info (for ROOM_CONFLICT)
  if (context.class1Name && context.class2Name) {
    detailParts.push(`صنف‌ها: ${context.class1Name} و ${context.class2Name}`);
  }

  if (Array.isArray(context.issues)) {
    const issues = context.issues
      .map((issue) =>
        typeof issue === 'string'
          ? issue
          : issue && typeof issue === 'object' && 'message' in issue
            ? String((issue as { message: unknown }).message)
            : null
      )
      .filter((issue): issue is string => Boolean(issue));
    if (issues.length > 0) detailParts.push(issues.join(' • '));
  }

  return {
    suggestion,
    details: detailParts.length > 0 ? detailParts.join(' | ') : null,
  };
}

/**
 * ErrorItem component for displaying a single error
 *
 * Shows the error message in Persian, suggestion prominently,
 * clickable entity links, context data, and a quick action button.
 *
 * Requirements: 11.3, 11.4, 11.8, 11.9, 15.1, 15.2, 15.3, 15.4
 */
export function ErrorItem({
  error,
  onEntityClick,
  quickAction,
  onQuickAction,
  className,
}: ErrorItemProps) {
  const context = error.context && typeof error.context === 'object' ? error.context : {};
  const { suggestion, details } = formatContextData(context);
  const displayMessage =
    (typeof error.message_farsi === 'string' && error.message_farsi.trim()) ||
    (typeof error.message_english === 'string' && error.message_english.trim()) ||
    'خطا در تولید جدول زمانی';
  const affectedEntities = Array.isArray(error.affected_entities) ? error.affected_entities : [];

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        'p-3 rounded-lg bg-muted/30 border border-muted',
        'hover:bg-muted/50 transition-colors',
        className
      )}
    >
      {/* Error message (Requirement: 11.3) */}
      <p className="text-sm text-foreground mb-2">{displayMessage}</p>

      {/* Suggestion - prominently displayed with lightbulb icon */}
      {suggestion && (
        <div className="flex items-start gap-2 mb-2 p-2 rounded-md bg-primary/5 border border-primary/20">
          <Lightbulb className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <p className="text-sm text-primary font-medium">{suggestion}</p>
        </div>
      )}

      {/* Context details (Requirements: 11.8, 11.9) */}
      {details && (
        <p className="text-xs text-muted-foreground mb-2 bg-muted/50 px-2 py-1 rounded">
          {details}
        </p>
      )}

      {/* Affected entities (Requirement: 11.4) */}
      {affectedEntities.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {affectedEntities.map((entity, index) => (
            <button
              key={`${entity.entity_type}-${entity.entity_id}-${index}`}
              onClick={() => onEntityClick(entity)}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-1 rounded-md',
                'text-xs font-medium',
                'bg-primary/10 text-primary hover:bg-primary/20',
                'transition-colors cursor-pointer',
                'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1'
              )}
            >
              <span className="text-muted-foreground">
                {ENTITY_TYPE_LABELS[entity.entity_type]}:
              </span>
              <span>{entity.entity_name}</span>
              <ExternalLink className="w-3 h-3 ms-1" />
            </button>
          ))}
        </div>
      )}

      {/* Quick action button (Requirements: 15.1, 15.2, 15.3, 15.4) */}
      {quickAction && onQuickAction && (
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            onQuickAction({
              type: quickAction.type,
              entityId: quickAction.entityId,
            })
          }
          className="mt-1 h-7 text-xs"
        >
          {quickAction.labelFa}
          <ArrowLeft className="w-3 h-3 ms-1" />
        </Button>
      )}
    </motion.div>
  );
}
