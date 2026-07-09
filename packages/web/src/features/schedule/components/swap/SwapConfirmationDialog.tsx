/**
 * SwapConfirmationDialog Component
 *
 * Dialog showing swap validation results with affected lessons.
 * Displays hard constraint errors and soft constraint warnings,
 * with a detailed table of all lessons that will be moved.
 *
 * Design follows BulkClassDialog pattern with emerald accent colors.
 *
 * Phase 4: Frontend Swap UI Components
 */

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { AlertTriangle, ArrowRightLeft, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SwapValidationResult } from '../../types';
import { canExecuteSwap, getSwapValidationStatus } from '../../utils/swapValidation';

export interface SwapConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  validationResult: SwapValidationResult | null;
  onConfirm: () => void;
  onCancel: () => void;
  isExecuting: boolean;
}

export function SwapConfirmationDialog({
  open,
  onOpenChange,
  validationResult,
  onConfirm,
  onCancel,
  isExecuting,
}: SwapConfirmationDialogProps) {
  const { t } = useTranslation();

  if (!validationResult) return null;

  const { errors, warnings } = validationResult;
  const status = getSwapValidationStatus(validationResult);
  const canProceed = canExecuteSwap(validationResult);
  const affectedLessons = validationResult.affectedLessons ?? [];
  const totalMoves = validationResult.totalMoves ?? affectedLessons.length;

  // Handle confirm with execution
  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] p-0 gap-0 overflow-hidden bg-white border-0 shadow-2xl max-h-[85vh]">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b bg-linear-to-br from-emerald-50 to-white">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center shadow-md',
                status === 'valid'
                  ? 'bg-linear-to-br from-emerald-500 to-emerald-600'
                  : status === 'warning'
                    ? 'bg-linear-to-br from-amber-500 to-amber-600'
                    : 'bg-linear-to-br from-rose-500 to-rose-600'
              )}
            >
              {status === 'valid' ? (
                <CheckCircle2 className="w-5 h-5 text-white" />
              ) : status === 'warning' ? (
                <AlertTriangle className="w-5 h-5 text-white" />
              ) : (
                <XCircle className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-slate-800">
                {status === 'valid'
                  ? t('swap.dialog.title.valid', 'تأیید تبادل')
                  : status === 'warning'
                    ? t('swap.dialog.title.warning', 'تبادل با هشدار')
                    : t('swap.dialog.title.invalid', 'تبادل غیرممکن است')}
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500">
                {status === 'valid'
                  ? t('swap.dialog.description.valid', 'این تبادل قابل اجرا است')
                  : status === 'warning'
                    ? t('swap.dialog.description.warning', 'این تبادل دارای هشدارهایی است')
                    : t(
                        'swap.dialog.description.invalid',
                        'این تبادل به دلیل محدودیت‌ها امکان‌پذیر نیست'
                      )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <ScrollArea className="max-h-[calc(85vh-180px)]">
          <div className="px-6 py-4 space-y-4">
            {/* Summary Badge */}
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <ArrowRightLeft className="h-4 w-4 text-emerald-600" />
              <span className="text-sm text-slate-700">
                {t('swap.dialog.summary', 'تعداد دروس تحت تأثیر:')}
              </span>
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                {totalMoves} {t('swap.dialog.lessons', 'درس')}
              </Badge>
            </div>

            {/* Validation Status Alert */}
            {status === 'valid' && (
              <Alert className="border-emerald-200 bg-emerald-50">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <AlertDescription className="text-emerald-800">
                  {t('swap.dialog.valid', 'این تبادل قابل اجرا است و هیچ محدودیتی ندارد')}
                </AlertDescription>
              </Alert>
            )}

            {/* Hard Constraint Errors */}
            {errors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-rose-600" />
                  <h3 className="font-semibold text-sm text-rose-800">
                    {t('swap.dialog.errors', 'خطاها')} ({errors.length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {errors.map((error, idx) => (
                    <Alert key={idx} variant="destructive" className="border-rose-200 bg-rose-50">
                      <AlertDescription className="text-rose-800 text-sm">
                        {error.message}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>
            )}

            {/* Soft Constraint Warnings */}
            {warnings.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <h3 className="font-semibold text-sm text-amber-800">
                    {t('swap.dialog.warnings', 'هشدارها')} ({warnings.length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {warnings.map((warning, idx) => (
                    <Alert key={idx} className="border-amber-200 bg-amber-50">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-800 text-sm">
                        {warning.message}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>
            )}

            {/* Affected Lessons Table */}
            {canProceed && affectedLessons.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-slate-800">
                  {t('swap.dialog.affected', 'دروس تحت تأثیر')}
                </h3>
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                  <ScrollArea className="max-h-[240px]">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="p-2.5 text-right font-medium text-slate-700">
                            {t('swap.table.class', 'کلاس')}
                          </th>
                          <th className="p-2.5 text-right font-medium text-slate-700">
                            {t('swap.table.subject', 'درس')}
                          </th>
                          <th className="p-2.5 text-right font-medium text-slate-700">
                            {t('swap.table.from', 'از')}
                          </th>
                          <th className="p-2.5 text-center font-medium text-slate-700">
                            <ArrowRightLeft className="h-3.5 w-3.5 inline" />
                          </th>
                          <th className="p-2.5 text-right font-medium text-slate-700">
                            {t('swap.table.to', 'به')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {affectedLessons.map((lesson, idx) => (
                          <tr
                            key={idx}
                            className={cn(
                              'border-b border-slate-100 last:border-0',
                              idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                            )}
                          >
                            <td className="p-2.5 text-slate-700">{lesson.classId}</td>
                            <td className="p-2.5 text-slate-700">{lesson.subjectId}</td>
                            <td className="p-2.5">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-slate-700 text-xs">{lesson.fromDay}</span>
                                <span className="text-slate-500 text-[10px]">
                                  {t('period', 'پریود')} {lesson.fromPeriod}
                                </span>
                              </div>
                            </td>
                            <td className="p-2.5 text-center">
                              <ArrowRightLeft className="h-3 w-3 text-emerald-600 inline" />
                            </td>
                            <td className="p-2.5">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-slate-700 text-xs">{lesson.toDay}</span>
                                <span className="text-slate-500 text-[10px]">
                                  {t('period', 'پریود')} {lesson.toPeriod}
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t bg-slate-50">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isExecuting}
            className="border-slate-300"
          >
            {t('common.cancel', 'لغو')}
          </Button>
          {canProceed && (
            <Button
              onClick={onConfirm}
              disabled={isExecuting}
              className={cn(
                'gap-2 text-white',
                status === 'valid'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-amber-600 hover:bg-amber-700'
              )}
            >
              {isExecuting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isExecuting
                ? t('swap.executing', 'در حال اجرا...')
                : t('swap.confirm', 'تأیید تبادل')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SwapConfirmationDialog;
