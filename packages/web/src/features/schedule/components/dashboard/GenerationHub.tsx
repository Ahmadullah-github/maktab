/**
 * GenerationHub Component
 * Hero section containing strategy selection, readiness, and generate action
 *
 * Features:
 * - Compose strategy selection, readiness, and generation controls
 * - Handle state transitions to ProgressView
 * - Apply gradient background
 *
 * Requirements: 1.1, 1.5, 1.6
 */

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ReadinessData, ValidationWarning } from '@/types/readiness';
import type { AffectedEntity, QualityScore, SolverErrorDetail, SolverResponse, SolverStatus } from '@/types/solver';
import { AnimatePresence, motion } from 'framer-motion';
import { Play, Sparkles } from 'lucide-react';
import type { SolverStrategy } from '../../types';
import { ErrorDisplay } from './ErrorDisplay';
import { ProgressView } from './ProgressView';
import { ReadinessChecklist } from './ReadinessChecklist';
import { StrategySelector } from './StrategySelector';
import { SuccessState } from './SuccessState';
import { WarningBanner } from './WarningBanner';

/**
 * Props for GenerationHub component
 */
export interface GenerationHubProps {
  /** Currently selected strategy */
  selectedStrategy: SolverStrategy;
  /** Callback when strategy is changed */
  onStrategyChange: (strategy: SolverStrategy) => void;
  /** Readiness data with entity counts */
  readinessData: ReadinessData;
  /** Whether readiness data is loading */
  isReadinessLoading: boolean;
  /** Validation warnings to display */
  validationWarnings?: ValidationWarning[];
  /** Callback to trigger generation */
  onGenerate: () => void;
  /** Whether generation is in progress */
  isGenerating: boolean;
  /** Elapsed time in seconds */
  elapsedTime: number;
  /** Generation errors */
  errors: SolverErrorDetail[];
  /** Generation warnings */
  warnings: SolverErrorDetail[];
  /** Quality score from successful generation */
  qualityScore: QualityScore | null;
  /** Full solver response */
  solverResponse: SolverResponse | null;
  /** Shared solver run status */
  solverStatus: SolverStatus | null;
  /** Callback to retry generation */
  onRetry: () => void;
  /** Callback to cancel generation */
  onCancel: () => void;
  /** Callback to close/reset after generation */
  onClose: () => void;
  onEntityClick: (entity: AffectedEntity) => void;
  /** Whether generation is allowed (license check) */
  canGenerate: boolean;
  /** Reason why generation is blocked */
  blockedReason: string | null;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Determine the current view state
 */
type ViewState = 'idle' | 'generating' | 'success' | 'error' | 'partial';

function getViewState(
  isGenerating: boolean,
  solverResponse: SolverResponse | null,
  errors: SolverErrorDetail[]
): ViewState {
  if (isGenerating) return 'generating';
  if (errors.length > 0) return 'error';
  if (solverResponse?.status === 'success') return 'success';
  if (solverResponse?.status === 'partial') return 'partial';
  return 'idle';
}

/**
 * Check if generation is ready based on readiness data
 */
function isGenerationReady(data: ReadinessData): boolean {
  return data.teacherCount > 0 && data.classCount > 0 && data.subjectCount > 0;
}

/**
 * GenerationHub component - Hero section for schedule generation
 *
 * Composes strategy selection, readiness checklist, and generate button.
 * Transitions to progress view during generation and shows results.
 *
 * Requirements: 1.1, 1.5, 1.6
 */
export function GenerationHub({
  selectedStrategy,
  onStrategyChange,
  readinessData,
  isReadinessLoading,
  validationWarnings = [],
  onGenerate,
  isGenerating,
  elapsedTime,
  errors,
  warnings,
  qualityScore,
  solverResponse,
  solverStatus,
  onRetry,
  onCancel,
  onClose,
  onEntityClick,
  canGenerate,
  blockedReason,
  className,
}: GenerationHubProps) {
  const viewState = getViewState(isGenerating, solverResponse, errors);
  const isReady = isGenerationReady(readinessData);
  const isDisabled = !isReady || !canGenerate || isGenerating;

  return (
    <Card
      className={cn(
        'relative overflow-hidden',
        'bg-linear-to-br from-primary/5 via-background to-primary/10',
        className
      )}
    >
      <div className="p-6 space-y-6">
        <AnimatePresence mode="wait">
          {/* Generating state - show progress view */}
          {viewState === 'generating' && (
            <motion.div
              key="generating"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <ProgressView
                strategy={solverStatus?.strategy || selectedStrategy}
                elapsedTime={elapsedTime}
                isGenerating={isGenerating}
                phaseText={solverStatus?.phaseFarsi}
                percentComplete={solverStatus?.percentComplete}
                estimatedSecondsRemaining={solverStatus?.estimatedSecondsRemaining}
                canCancel={solverStatus?.canCancel ?? isGenerating}
                onCancel={onCancel}
              />
            </motion.div>
          )}

          {/* Success state - show success animation */}
          {viewState === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <SuccessState qualityScore={qualityScore} onTransition={onClose} />
            </motion.div>
          )}

          {/* Partial success - show warnings */}
          {viewState === 'partial' && (
            <motion.div
              key="partial"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <SuccessState qualityScore={qualityScore} onTransition={onClose} />
              {warnings.length > 0 && <WarningBanner warnings={warnings} />}
            </motion.div>
          )}

          {/* Error state - show error display */}
          {viewState === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <ErrorDisplay
                errors={errors}
                warnings={warnings}
                onEntityClick={onEntityClick}
                onRetry={onRetry}
                onClose={onClose}
              />
            </motion.div>
          )}

          {/* Idle state - show strategy selection and generate button */}
          {viewState === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Header */}
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-semibold">تولید جدول زمانی</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  استراتژی مورد نظر را انتخاب کنید و جدول زمانی جدید تولید کنید
                </p>
              </div>

              {/* Strategy selector */}
              <StrategySelector
                selectedStrategy={selectedStrategy}
                onStrategyChange={onStrategyChange}
                disabled={isGenerating}
              />

              {/* Readiness checklist */}
              <ReadinessChecklist
                data={readinessData}
                isLoading={isReadinessLoading}
                validationWarnings={validationWarnings}
              />

              {/* Generate button */}
              <div className="flex flex-col items-center gap-3">
                <Button size="lg" onClick={onGenerate} disabled={isDisabled} className="gap-2 px-8">
                  <Play className="w-5 h-5" />
                  تولید جدول زمانی
                </Button>

                {/* Blocked reason message */}
                {blockedReason && (
                  <p className="text-sm text-destructive text-center">{blockedReason}</p>
                )}

                {/* Not ready message */}
                {!isReady && !blockedReason && (
                  <p className="text-sm text-muted-foreground text-center">
                    برای تولید جدول زمانی، حداقل یک استاد، یک صنف و یک مضمون اضافه کنید
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
}
