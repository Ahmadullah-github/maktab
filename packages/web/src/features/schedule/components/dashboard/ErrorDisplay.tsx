import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  groupIssues,
  prioritizeIssues,
  type IssueAction,
} from '@/features/schedule/errors/issuePresentation';
import { cn } from '@/lib/utils';
import type { OperationAffectedEntity, OperationIssue } from '@/types/operation';
import { motion } from 'framer-motion';
import { AlertCircle, RefreshCw, X } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorGroup } from './ErrorGroup';
import { ErrorItem } from './ErrorItem';
import { WarningBanner } from './WarningBanner';

export interface ErrorDisplayProps {
  errors: OperationIssue[];
  warnings?: OperationIssue[];
  diagnosticId: string;
  onEntityClick: (entity: OperationAffectedEntity) => void;
  onQuickAction?: (action: IssueAction) => void;
  onRetry: () => void;
  onClose: () => void;
  className?: string;
}

export function ErrorDisplay({
  errors,
  warnings = [],
  diagnosticId,
  onEntityClick,
  onQuickAction,
  onRetry,
  onClose,
  className,
}: ErrorDisplayProps) {
  const { t } = useTranslation();
  const prioritized = useMemo(() => prioritizeIssues(errors), [errors]);
  const primary = prioritized[0];
  const groups = useMemo(() => groupIssues(prioritized.slice(1)), [prioritized]);
  const canRetry = errors.some((issue) => issue.retryable);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn('w-full', className)}
    >
      <Card className="border-red-200 bg-gradient-to-br from-red-50/50 via-background to-red-50/30 p-6">
        <div className="mb-5 flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-red-100">
            <AlertCircle className="size-6 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-red-700">{t('errors.title')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('errors.summary', { count: errors.length })}
            </p>
          </div>
        </div>

        <ScrollArea className="max-h-[440px] pe-4">
          <div className="space-y-4">
            {primary && (
              <ErrorItem
                error={primary}
                emphasized
                onEntityClick={onEntityClick}
                onQuickAction={onQuickAction}
              />
            )}
            {groups.map((group) => (
              <ErrorGroup
                key={group.category}
                category={group.category}
                errors={group.issues}
                onEntityClick={onEntityClick}
                onQuickAction={onQuickAction}
              />
            ))}
            <WarningBanner warnings={warnings} onEntityClick={onEntityClick} />
          </div>
        </ScrollArea>

        <p className="mt-4 text-xs text-muted-foreground">
          {t('errors.referenceId', { id: diagnosticId })}
        </p>
        <div className="mt-4 flex items-center gap-3 border-t pt-4">
          {canRetry && (
            <Button onClick={onRetry} className="flex-1">
              <RefreshCw className="me-2 size-4" />
              {t('errors.retry')}
            </Button>
          )}
          <Button variant="outline" onClick={onClose} className="flex-1">
            <X className="me-2 size-4" />
            {t('errors.close')}
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
