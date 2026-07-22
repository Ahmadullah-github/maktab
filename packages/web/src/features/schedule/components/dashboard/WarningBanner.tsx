import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { issueDescriptionKey, issueTitleKey } from '@/features/schedule/errors/issuePresentation';
import { cn } from '@/lib/utils';
import type { OperationAffectedEntity, OperationIssue } from '@/types/operation';
import { AlertTriangle, ChevronDown, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface WarningBannerProps {
  warnings: OperationIssue[];
  onEntityClick?: (entity: OperationAffectedEntity) => void;
  className?: string;
}

export function WarningBanner({ warnings, onEntityClick, className }: WarningBannerProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  if (warnings.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
      <div className={cn('rounded-lg border border-amber-200 bg-amber-50', isOpen && 'rounded-b-none')}>
        <CollapsibleTrigger className="flex w-full items-center justify-between p-4 hover:bg-amber-100/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500">
          <span className="flex items-center gap-2 font-medium text-amber-800">
            <AlertTriangle className="size-5" />
            {t('errors.warningCount', { count: warnings.length })}
          </span>
          <ChevronDown className={cn('size-5 text-amber-600 transition-transform', isOpen && 'rotate-180')} />
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="rounded-b-lg border border-t-0 border-amber-200 bg-amber-50/50 p-4">
        <div className="max-h-[300px] space-y-3 overflow-y-auto">
          {warnings.map((warning, index) => (
            <div key={`${warning.code}-${index}`} className="rounded-lg border border-amber-100 bg-white/60 p-3">
              <p className="text-sm font-medium text-amber-900">
                {t(issueTitleKey(warning.code), {
                  ...warning.messageParams,
                  defaultValue: t('errors.codes.UNKNOWN_WARNING.title'),
                })}
              </p>
              <p className="mt-1 text-xs text-amber-800">
                {t(issueDescriptionKey(warning.code), {
                  ...warning.messageParams,
                  defaultValue: t('errors.codes.UNKNOWN_WARNING.description'),
                })}
              </p>
              {warning.affectedEntities.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {warning.affectedEntities.map((entity) => (
                    <button
                      key={`${entity.type}-${entity.id}`}
                      type="button"
                      onClick={() => onEntityClick?.(entity)}
                      className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800 hover:bg-amber-200"
                    >
                      {entity.name ?? t(`errors.entities.${entity.type}`)}
                      <ExternalLink className="size-3" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
