/**
 * RamadanModeCard Component
 *
 * Toggle and configure Ramadan mode with shorter period durations
 * Features beautiful Islamic-inspired design with moon/star motifs
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { Clock, Minus, Moon, Plus, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface RamadanModeCardProps {
  enabled: boolean;
  periodDuration: number;
  onEnabledChange: (enabled: boolean) => void;
  onDurationChange: (duration: number) => void;
  disabled?: boolean;
}

export function RamadanModeCard({
  enabled,
  periodDuration,
  onEnabledChange,
  onDurationChange,
  disabled,
}: RamadanModeCardProps) {
  const { t } = useTranslation();

  const handleIncrement = () => {
    if (periodDuration < 60) {
      onDurationChange(periodDuration + 5);
    }
  };

  const handleDecrement = () => {
    if (periodDuration > 20) {
      onDurationChange(periodDuration - 5);
    }
  };

  return (
    <Card
      className={cn(
        'border-2 transition-all duration-300',
        enabled
          ? 'border-emerald-300 bg-linear-to-br from-emerald-50 via-teal-50 to-cyan-50 shadow-lg shadow-emerald-100/50'
          : 'border-border/50 shadow-sm hover:shadow-md'
      )}
    >
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center shadow-md transition-all duration-300',
                enabled
                  ? 'bg-linear-to-br from-emerald-500 to-teal-600'
                  : 'bg-linear-to-br from-gray-400 to-gray-500'
              )}
            >
              <Moon className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                {t('schoolSettings.ramadanMode.title')}
                {enabled && <Sparkles className="w-4 h-4 text-emerald-500 animate-pulse" />}
              </CardTitle>
              <CardDescription className="text-sm">
                {t('schoolSettings.ramadanMode.description')}
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Label
              htmlFor="ramadan-toggle"
              className={cn(
                'text-sm font-medium transition-colors',
                enabled ? 'text-emerald-700' : 'text-gray-500'
              )}
            >
              {enabled
                ? t('schoolSettings.ramadanMode.enabled')
                : t('schoolSettings.ramadanMode.disabled')}
            </Label>
            <Switch
              id="ramadan-toggle"
              checked={enabled}
              onCheckedChange={onEnabledChange}
              disabled={disabled}
              className="data-[state=checked]:bg-emerald-500 focus-visible:ring-emerald-500"
            />
          </div>
        </div>
      </CardHeader>

      <div
        className={cn(
          'grid transition-all duration-300 ease-in-out',
          enabled ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="overflow-hidden">
          <CardContent className="pt-0 pb-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-linear-to-r from-transparent via-emerald-300 to-transparent" />
              <Moon className="w-4 h-4 text-emerald-400" />
              <div className="flex-1 h-px bg-linear-to-r from-transparent via-emerald-300 to-transparent" />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-600" />
                  <Label className="text-sm font-medium text-gray-700">
                    {t('schoolSettings.ramadanMode.periodDuration')}
                  </Label>
                </div>
                <span className="text-xs text-gray-500">
                  {t('schoolSettings.ramadanMode.durationRange')}
                </span>
              </div>

              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={handleDecrement}
                  disabled={disabled || periodDuration <= 20}
                  className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center transition-all',
                    'border-2 border-emerald-200 bg-white hover:bg-emerald-50',
                    'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2',
                    'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white'
                  )}
                >
                  <Minus className="w-4 h-4 text-emerald-600" />
                </button>

                <div className="flex-1 h-14 rounded-xl border-2 border-emerald-200 bg-white flex items-center justify-center">
                  <span className="text-3xl font-bold text-emerald-700">{periodDuration}</span>
                  <span className="text-sm text-emerald-600 ms-2">
                    {t('schoolSettings.ramadanMode.minutes')}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleIncrement}
                  disabled={disabled || periodDuration >= 60}
                  className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center transition-all',
                    'border-2 border-emerald-200 bg-white hover:bg-emerald-50',
                    'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2',
                    'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white'
                  )}
                >
                  <Plus className="w-4 h-4 text-emerald-600" />
                </button>
              </div>

              <div className="mt-4 p-3 rounded-lg bg-emerald-100/50 border border-emerald-200">
                <p className="text-xs text-emerald-700 leading-relaxed">
                  {t('schoolSettings.ramadanMode.infoText')}
                </p>
              </div>
            </div>
          </CardContent>
        </div>
      </div>

      {!enabled && (
        <CardContent className="pt-0 pb-4">
          <p className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
            {t('schoolSettings.ramadanMode.hint')}
          </p>
        </CardContent>
      )}
    </Card>
  );
}
