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
import type { IssueAction } from '@/features/schedule/errors/issuePresentation';
import type { OperationAffectedEntity, OperationIssue } from '@/types/operation';
import type { QualityScore, SolverResponse, SolverStatus } from '@/types/solver';
import type { GenerationJob } from '../../hooks/useGenerateSchedule';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Cpu, Play, ShieldCheck, Sparkles } from 'lucide-react';
import { ErrorDisplay } from './ErrorDisplay';
import { ProgressView } from './ProgressView';
import { ReadinessChecklist } from './ReadinessChecklist';
import { SuccessState } from './SuccessState';
import { WarningBanner } from './WarningBanner';

/**
 * Props for GenerationHub component
 */
export interface GenerationHubProps {
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
  errors: OperationIssue[];
  /** Generation warnings */
  warnings: OperationIssue[];
  /** Reference ID for support and logs */
  diagnosticId?: string;
  /** Quality score from successful generation */
  qualityScore: QualityScore | null;
  /** Full solver response */
  solverResponse: SolverResponse | null;
  /** Shared solver run status */
  solverStatus: SolverStatus | null;
  generationJob: GenerationJob | null;
  /** Callback to retry generation */
  onRetry: () => void;
  /** Callback to cancel generation */
  onCancel: () => void;
  /** Callback to close/reset after generation */
  onClose: () => void;
  onEntityClick: (entity: OperationAffectedEntity) => void;
  onQuickAction?: (action: IssueAction) => void;
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
  generationJob: GenerationJob | null,
  errors: OperationIssue[]
): ViewState {
  if (isGenerating) return 'generating';
  if (errors.length > 0) return 'error';
  if (generationJob?.status === 'completed' && generationJob.resultTimetableId) return 'success';
  if (solverResponse?.outcome === 'success') return 'success';
  if (solverResponse?.outcome === 'partial') return 'partial';
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
  readinessData,
  isReadinessLoading,
  validationWarnings = [],
  onGenerate,
  isGenerating,
  elapsedTime,
  errors,
  warnings,
  diagnosticId,
  qualityScore,
  solverResponse,
  solverStatus,
  generationJob,
  onRetry,
  onCancel,
  onClose,
  onEntityClick,
  onQuickAction,
  canGenerate,
  blockedReason,
  className,
}: GenerationHubProps) {
  const viewState = getViewState(isGenerating, solverResponse, generationJob, errors);
  const isReady = isGenerationReady(readinessData);
  const isDisabled = !isReady || !canGenerate || isGenerating;

  return (
    <Card
      className={cn(
        'relative overflow-hidden rounded-3xl border-slate-200/80 shadow-[0_20px_60px_-35px_rgba(0,51,102,0.35)]',
        'bg-linear-to-br from-white via-white to-primary/5',
        className
      )}
    >
      <div aria-hidden="true" className="absolute -start-24 -top-28 h-64 w-64 rounded-full bg-primary/8 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-32 -end-20 h-72 w-72 rounded-full bg-sky-200/30 blur-3xl" />

      <div className="relative space-y-6 p-5 sm:p-7 lg:p-8">
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
                strategy={solverStatus?.strategy || 'quick'}
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
                diagnosticId={diagnosticId ?? 'unavailable'}
                onEntityClick={onEntityClick}
                onQuickAction={onQuickAction}
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
              className="grid items-center gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(520px,1.25fr)] lg:gap-10"
            >
              <div className="space-y-5 text-start">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary">
                  <Sparkles className="h-4 w-4" />
                  ساخت هوشمند و سریع
                </div>

                <div className="space-y-2">
                  <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                    جدول معتبر خود را بسازید
                  </h2>
                  <p className="max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
                  ابتدا یک جدول معتبر سریع ساخته می‌شود؛ سپس می‌توانید هر جدول را جداگانه بهبود دهید
                  </p>
                </div>

                <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600 sm:text-sm">
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    حفظ محدودیت‌های ضروری
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Cpu className="h-4 w-4 text-primary" />
                    استفادهٔ متعادل از پردازنده
                  </span>
                </div>

                <div className="space-y-2.5">
                  <Button
                    size="lg"
                    onClick={onGenerate}
                    disabled={isDisabled}
                    className="h-12 w-full gap-2 rounded-xl bg-linear-to-l from-[#003366] to-[#07508f] px-7 text-sm shadow-lg shadow-primary/20 hover:from-[#00284f] hover:to-[#003f73] sm:w-auto"
                  >
                    <Play className="h-5 w-5" />
                    تولید سریع جدول معتبر
                    <ArrowLeft className="h-4 w-4" />
                  </Button>

                  <p className="max-w-lg text-xs leading-5 text-muted-foreground">
                    دو هسته برای کارهای روزمرهٔ دستگاه آزاد می‌ماند؛ می‌توانید این صفحه را ببندید و بعداً برگردید.
                  </p>

                  {blockedReason ? (
                    <p className="text-sm font-medium text-destructive">{blockedReason}</p>
                  ) : null}

                  {!isReady && !blockedReason ? (
                    <p className="text-sm text-muted-foreground">
                      برای تولید جدول، حداقل یک استاد، یک صنف و یک مضمون اضافه کنید.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/90 bg-white/80 p-3 shadow-sm backdrop-blur-sm sm:p-5">
                <div className="mb-2 flex items-center justify-between px-1">
                  <div>
                    <h3 className="font-semibold text-slate-900">آمادگی داده‌ها</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">برای ویرایش هر بخش روی آن کلیک کنید</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                    آماده
                  </span>
                </div>
                <ReadinessChecklist
                  data={readinessData}
                  isLoading={isReadinessLoading}
                  validationWarnings={validationWarnings}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
}
