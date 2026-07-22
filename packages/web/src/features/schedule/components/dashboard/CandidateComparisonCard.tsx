import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeftRight, Check, Loader2, PauseCircle, Trash2 } from 'lucide-react';
import { useGenerationCandidate } from '../../hooks/useGenerationCandidate';

export interface CandidateComparisonCardProps {
  candidateId: number;
  onAccepted: (timetableId: number) => void;
  onDiscarded: () => void;
}

function scoreLabel(value: number | null): string {
  return value === null ? 'نامشخص' : `${Math.round(value)} / ۱۰۰`;
}

export function CandidateComparisonCard({
  candidateId,
  onAccepted,
  onDiscarded,
}: CandidateComparisonCardProps) {
  const { candidateQuery, acceptMutation, discardMutation } =
    useGenerationCandidate(candidateId);
  const candidate = candidateQuery.data;

  if (candidateQuery.isLoading) {
    return (
      <Card className="flex items-center justify-center p-6" aria-label="در حال بارگذاری پیشنهاد">
        <Loader2 className="h-5 w-5 animate-spin" />
      </Card>
    );
  }
  if (!candidate || candidate.status !== 'available') return null;

  const gapPercent =
    candidate.relativeGap === null ? null : Math.max(0, candidate.relativeGap * 100);

  return (
    <Card className="overflow-hidden rounded-3xl border-primary/20 bg-linear-to-l from-primary/8 via-white to-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {candidate.interrupted ? (
              <PauseCircle className="h-5 w-5 text-amber-600" />
            ) : (
              <ArrowLeftRight className="h-5 w-5 text-primary" />
            )}
            <h3 className="font-semibold">
              {candidate.interrupted ? 'آخرین راه حل معتبر حفظ شد' : 'پیشنهاد بهبود آماده است'}
            </h3>
          </div>
          <p className="text-sm text-muted-foreground">
            جدول فعلی تغییر نکرده است. نتیجه را مقایسه کنید و فقط در صورت رضایت بپذیرید.
          </p>
          <div className="flex flex-wrap gap-4 text-sm">
            <span>کیفیت فعلی: {scoreLabel(candidate.sourceQualityScore)}</span>
            <span className="font-medium text-primary">
              کیفیت پیشنهاد: {scoreLabel(candidate.qualityScore)}
            </span>
            {gapPercent !== null ? <span>فاصله تا حد بهینه: {gapPercent.toFixed(1)}٪</span> : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Button
            onClick={() =>
              acceptMutation.mutate(undefined, {
                onSuccess: (result) => onAccepted(result.timetable.id),
              })
            }
            disabled={acceptMutation.isPending || discardMutation.isPending}
            className="gap-2"
          >
            {acceptMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            پذیرش به‌عنوان جدول جدید
          </Button>
          <Button
            variant="outline"
            onClick={() => discardMutation.mutate(undefined, { onSuccess: onDiscarded })}
            disabled={acceptMutation.isPending || discardMutation.isPending}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            رد کردن
          </Button>
        </div>
      </div>
    </Card>
  );
}
