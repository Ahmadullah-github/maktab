/**
 * QualityScoreDisplay Component
 * Displays quality score with visual indicator and suggestions
 *
 * Features:
 * - Display overall score (0-100) with visual indicator
 * - Color code: green >= 80, amber 60-79, red < 60
 * - Show suggestions when score < 80
 * - Make suggestions clickable with navigation
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
 */

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { AffectedEntity, QualityScore, QualitySuggestion } from '@/types/solver';
import {
  getQualityBgClass,
  getQualityColorClass,
  getQualityLevel,
} from '@/types/solver';
import { motion } from 'framer-motion';
import { ArrowLeft, Lightbulb, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Props for QualityScoreDisplay component
 */
export interface QualityScoreDisplayProps {
  /** Quality score from solver */
  qualityScore: QualityScore;
  /** Callback when a suggestion is clicked */
  onSuggestionClick?: (suggestion: QualitySuggestion) => void;
  /** Callback when an entity in a suggestion is clicked */
  onEntityClick?: (entity: AffectedEntity) => void;
  /** Whether to show suggestions (default: true when score < 80) */
  showSuggestions?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Quality level labels in Persian
 */
const QUALITY_LABELS: Record<ReturnType<typeof getQualityLevel>, string> = {
  excellent: 'عالی',
  good: 'خوب',
  fair: 'متوسط',
  poor: 'نیاز به بهبود',
};

/**
 * Quality level descriptions in Persian
 */
const QUALITY_DESCRIPTIONS: Record<ReturnType<typeof getQualityLevel>, string> = {
  excellent: 'جدول زمانی بهینه با کمترین تداخل',
  good: 'جدول زمانی قابل قبول با چند نقطه قابل بهبود',
  fair: 'جدول زمانی نیاز به بررسی دارد',
  poor: 'پیشنهاد می‌شود تنظیمات را بررسی کنید',
};

/**
 * QualityScoreDisplay component for showing quality metrics
 *
 * Displays the overall quality score with color coding and
 * provides actionable suggestions for improvement.
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
 */
export function QualityScoreDisplay({
  qualityScore,
  onSuggestionClick,
  onEntityClick,
  showSuggestions = true,
  className,
}: QualityScoreDisplayProps) {
  const { t, i18n } = useTranslation();
  const score = qualityScore.overall;
  const level = getQualityLevel(score);
  const colorClass = getQualityColorClass(score);
  const bgClass = getQualityBgClass(score);
  const genericSuggestion =
    i18n.language === 'fa'
      ? 'برای بهبود کیفیت، ترجیحات و داده‌های مربوط را بررسی کنید.'
      : 'Review the related preferences and data to improve timetable quality.';

  // Show suggestions when score < 80 (Requirement: 13.3)
  const shouldShowSuggestions = showSuggestions && qualityScore.suggestions.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn('w-full', className)}
    >
      <Card className="p-6">
        {/* Score header */}
        <div className="flex items-start gap-4 mb-6">
          {/* Score circle */}
          <div
            className={cn(
              'relative w-20 h-20 rounded-full flex items-center justify-center',
              bgClass
            )}
          >
            <span className={cn('text-2xl font-bold tabular-nums', colorClass)}>{score}</span>
            <span className="absolute -bottom-1 text-xs text-muted-foreground">/ ۱۰۰</span>
          </div>

          {/* Score info */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className={cn('text-lg font-semibold', colorClass)}>{QUALITY_LABELS[level]}</h3>
              <TrendingUp className={cn('w-5 h-5', colorClass)} />
            </div>
            <p className="text-sm text-muted-foreground">{QUALITY_DESCRIPTIONS[level]}</p>
          </div>
        </div>

        {/* Progress bar (Requirement: 13.1) */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>کیفیت جدول</span>
            <span>{score}%</span>
          </div>
          <Progress value={score} className="h-2" />
        </div>

        {qualityScore.objective_results?.length > 0 && (
          <div className="grid grid-cols-1 gap-3 mb-6 sm:grid-cols-2">
            {qualityScore.objective_results.map((result) => (
              <MetricItem
                key={result.key}
                label={t(`constraints.constraints.${result.key}.label`, { defaultValue: result.key })}
                count={result.violation_units}
                penalty={100 - result.satisfaction_percent}
              />
            ))}
          </div>
        )}

        {/* Suggestions (Requirements: 13.3, 13.4, 13.5) */}
        {shouldShowSuggestions && (
          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <h4 className="text-sm font-medium">پیشنهادات بهبود</h4>
            </div>
            <div className="space-y-2">
              {qualityScore.suggestions.map((suggestion, index) => (
                <SuggestionItem
                  key={`${suggestion.suggestion_code ?? 'quality-suggestion'}-${index}`}
                  suggestion={suggestion}
                  onClick={() => onSuggestionClick?.(suggestion)}
                  onEntityClick={onEntityClick}
                  message={t(suggestion.message_key ?? 'quality.suggestions.generic', {
                    ...(suggestion.message_params ?? {}),
                    defaultValue:
                      (i18n.language === 'fa'
                        ? suggestion.message_farsi
                        : suggestion.message_english) ?? genericSuggestion,
                  })}
                />
              ))}
            </div>
          </div>
        )}
      </Card>
    </motion.div>
  );
}

/**
 * MetricItem component for displaying a single quality metric
 */
interface MetricItemProps {
  label: string;
  count: number;
  penalty: number;
}

function MetricItem({ label, count, penalty }: MetricItemProps) {
  const isGood = count === 0;

  return (
    <div className={cn('p-2 rounded-lg text-xs', isGood ? 'bg-green-50' : 'bg-amber-50')}>
      <p className="text-muted-foreground mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className={cn('font-semibold', isGood ? 'text-green-600' : 'text-amber-600')}>
          {count}
        </span>
        {penalty > 0 && <span className="text-muted-foreground">(-{penalty})</span>}
      </div>
    </div>
  );
}

/**
 * SuggestionItem component for displaying a single suggestion
 */
interface SuggestionItemProps {
  suggestion: QualitySuggestion;
  message: string;
  onClick?: () => void;
  onEntityClick?: (entity: AffectedEntity) => void;
}

function SuggestionItem({ suggestion, message, onClick, onEntityClick }: SuggestionItemProps) {
  return (
    <div className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      {/* Suggestion message (Requirement: 13.4) */}
      <p className="text-sm text-foreground mb-2">{message}</p>

      {/* Expected improvement */}
      {suggestion.expected_improvement > 0 && (
        <p className="text-xs text-green-600 mb-2">
          بهبود مورد انتظار: +{suggestion.expected_improvement} امتیاز
        </p>
      )}

      {/* Affected entities */}
      {suggestion.affected_entities.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {suggestion.affected_entities.map((entity, index) => (
            <button
              key={`${entity.entity_type}-${entity.entity_id}-${index}`}
              onClick={() =>
                onEntityClick?.({
                  type: entity.entity_type,
                  id: entity.entity_id,
                  name: entity.entity_name,
                })
              }
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded text-xs',
                'bg-primary/10 text-primary hover:bg-primary/20',
                'transition-colors cursor-pointer'
              )}
            >
              {entity.entity_name}
            </button>
          ))}
        </div>
      )}

      {/* Action button (Requirement: 13.5) */}
      {onClick && (
        <Button variant="ghost" size="sm" onClick={onClick} className="h-7 text-xs">
          اعمال پیشنهاد
          <ArrowLeft className="w-3 h-3 ms-1" />
        </Button>
      )}
    </div>
  );
}
