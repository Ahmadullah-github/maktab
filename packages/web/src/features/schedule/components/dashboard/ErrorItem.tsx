import { Button } from '@/components/ui/button';
import {
  getIssueAction,
  issueDescriptionKey,
  issueTitleKey,
  type IssueAction,
} from '@/features/schedule/errors/issuePresentation';
import { cn } from '@/lib/utils';
import type { OperationAffectedEntity, OperationIssue } from '@/types/operation';
import { motion } from 'framer-motion';
import { ArrowLeft, ExternalLink, Lightbulb } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface ErrorItemProps {
  error: OperationIssue;
  onEntityClick: (entity: OperationAffectedEntity) => void;
  onQuickAction?: (action: IssueAction) => void;
  emphasized?: boolean;
  className?: string;
}

export function ErrorItem({
  error,
  onEntityClick,
  onQuickAction,
  emphasized = false,
  className,
}: ErrorItemProps) {
  const { t } = useTranslation();
  const action = getIssueAction(error);
  const title = t(issueTitleKey(error.code), {
    ...error.messageParams,
    defaultValue: t('errors.codes.UNKNOWN_ERROR.title'),
  });
  const description = t(issueDescriptionKey(error.code), {
    ...error.messageParams,
    defaultValue: t('errors.codes.UNKNOWN_ERROR.description'),
  });

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        'rounded-lg border p-3 transition-colors',
        emphasized ? 'border-destructive/40 bg-destructive/5' : 'border-muted bg-muted/30',
        className
      )}
    >
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <div className="mt-2 flex items-start gap-2 rounded-md bg-primary/5 p-2 text-primary">
        <Lightbulb className="mt-0.5 size-4 shrink-0" />
        <p className="text-sm">{description}</p>
      </div>

      {error.fieldIssues && error.fieldIssues.length > 0 && (
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          {error.fieldIssues.slice(0, 4).map((field) => (
            <p key={`${field.path}:${field.code}`}>
              {t('errors.fieldIssue', { field: field.path })}
            </p>
          ))}
        </div>
      )}

      {error.affectedEntities.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {error.affectedEntities.map((entity) => (
            <button
              key={`${entity.type}-${entity.id}`}
              type="button"
              onClick={() => onEntityClick(entity)}
              className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span>{entity.name ?? t(`errors.entities.${entity.type}`)}</span>
              <ExternalLink className="size-3" />
            </button>
          ))}
        </div>
      )}

      {action && onQuickAction && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onQuickAction(action)}
          className="mt-3 h-8 text-xs"
        >
          {t(action.labelKey)}
          <ArrowLeft className="ms-1 size-3" />
        </Button>
      )}
    </motion.div>
  );
}
