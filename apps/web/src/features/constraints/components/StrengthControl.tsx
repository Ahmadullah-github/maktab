import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ConstraintInfo, OptimizationStrength } from '../types';

const LEVELS: OptimizationStrength[] = [0, 0.5, 1, 2];

interface StrengthControlProps {
  constraint: ConstraintInfo;
  value: OptimizationStrength;
  onChange: (value: OptimizationStrength) => void;
}

export function StrengthControl({ constraint, value, onChange }: StrengthControlProps) {
  const { t } = useTranslation();
  const base = `constraints.constraints.${constraint.translationKey}`;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium">{t(`${base}.label`)}</h3>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="rounded-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={t('constraints.strength.helpLabel', { name: t(`${base}.label`) })}
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs"><p>{t(`${base}.tooltip`)}</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-xs text-muted-foreground">{t(`${base}.description`)}</p>
        </div>
        <div
          role="group"
          aria-label={t('constraints.strength.groupLabel', { name: t(`${base}.label`) })}
          className="grid shrink-0 grid-cols-4 gap-1 rounded-lg bg-muted p-1"
        >
          {LEVELS.map((level) => (
            <Button
              key={level}
              type="button"
              size="sm"
              variant={value === level ? 'default' : 'ghost'}
              aria-pressed={value === level}
              onClick={() => onChange(level)}
              className="h-8 px-2 text-xs"
            >
              {t(`constraints.strength.${level === 0 ? 'disabled' : level === 0.5 ? 'low' : level === 1 ? 'medium' : 'high'}`)}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
