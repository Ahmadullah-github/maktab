/**
 * LowResourceModeCard Component
 *
 * Toggle low-resource mode for older computers
 * Shows resource limits and optimization info
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { Cpu, HardDrive, Leaf, MemoryStick, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ResourceLimit {
  icon: React.ElementType;
  labelKey: string;
  normalValue: string;
  lowResourceValue: string;
}

const RESOURCE_LIMITS: ResourceLimit[] = [
  {
    icon: Cpu,
    labelKey: 'workerThreads',
    normalValue: '8',
    lowResourceValue: '2',
  },
  {
    icon: MemoryStick,
    labelKey: 'maxMemory',
    normalValue: 'نامحدود',
    lowResourceValue: '512 MB',
  },
  {
    icon: Zap,
    labelKey: 'strategy',
    normalValue: 'بهینه‌سازی کامل',
    lowResourceValue: 'اولین جواب',
  },
];

interface LowResourceModeCardProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  disabled?: boolean;
}

export function LowResourceModeCard({
  enabled,
  onEnabledChange,
  disabled,
}: LowResourceModeCardProps) {
  const { t } = useTranslation();

  return (
    <Card
      className={cn(
        'border-2 transition-all duration-300',
        enabled
          ? 'border-lime-300 bg-linear-to-br from-lime-50 via-green-50 to-emerald-50 shadow-lg shadow-lime-100/50'
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
                  ? 'bg-linear-to-br from-lime-500 to-green-600'
                  : 'bg-linear-to-br from-gray-400 to-gray-500'
              )}
            >
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                {t('schoolSettings.lowResourceMode.title')}
                {enabled && (
                  <Badge
                    variant="outline"
                    className="text-xs border-lime-300 bg-lime-100 text-lime-700"
                  >
                    {t('schoolSettings.lowResourceMode.activeBadge')}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-sm">
                {t('schoolSettings.lowResourceMode.description')}
              </CardDescription>
            </div>
          </div>

          {/* Toggle Switch */}
          <div className="flex items-center gap-2">
            <Label
              htmlFor="low-resource-toggle"
              className={cn(
                'text-sm font-medium transition-colors',
                enabled ? 'text-lime-700' : 'text-gray-500'
              )}
            >
              {enabled
                ? t('schoolSettings.lowResourceMode.enabled')
                : t('schoolSettings.lowResourceMode.disabled')}
            </Label>
            <Switch
              id="low-resource-toggle"
              checked={enabled}
              onCheckedChange={onEnabledChange}
              disabled={disabled}
              className="data-[state=checked]:bg-lime-500 focus-visible:ring-lime-500"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 pb-5">
        {/* Resource comparison table */}
        <div
          className={cn(
            'rounded-xl border-2 overflow-hidden transition-all duration-300',
            enabled ? 'border-lime-200 bg-white' : 'border-gray-200 bg-gray-50'
          )}
        >
          {/* Header */}
          <div
            className={cn(
              'grid grid-cols-3 gap-2 px-4 py-2.5 text-xs font-medium border-b',
              enabled
                ? 'bg-lime-100 border-lime-200 text-lime-800'
                : 'bg-gray-100 border-gray-200 text-gray-600'
            )}
          >
            <span>{t('schoolSettings.lowResourceMode.table.resource')}</span>
            <span className="text-center">{t('schoolSettings.lowResourceMode.table.normal')}</span>
            <span className="text-center">
              {t('schoolSettings.lowResourceMode.table.lowResource')}
            </span>
          </div>

          {/* Rows */}
          {RESOURCE_LIMITS.map((limit, index) => {
            const Icon = limit.icon;
            return (
              <div
                key={limit.labelKey}
                className={cn(
                  'grid grid-cols-3 gap-2 px-4 py-3 items-center',
                  index !== RESOURCE_LIMITS.length - 1 && 'border-b',
                  enabled ? 'border-lime-100' : 'border-gray-100'
                )}
              >
                {/* Resource name */}
                <div className="flex items-center gap-2">
                  <Icon className={cn('w-4 h-4', enabled ? 'text-lime-600' : 'text-gray-400')} />
                  <span className="text-sm text-gray-700">
                    {t(`schoolSettings.lowResourceMode.limits.${limit.labelKey}`)}
                  </span>
                </div>

                {/* Normal value */}
                <div className="text-center">
                  <span
                    className={cn(
                      'text-sm px-2 py-0.5 rounded',
                      !enabled ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-500'
                    )}
                  >
                    {limit.normalValue}
                  </span>
                </div>

                {/* Low resource value */}
                <div className="text-center">
                  <span
                    className={cn(
                      'text-sm px-2 py-0.5 rounded',
                      enabled ? 'bg-lime-100 text-lime-700 font-medium' : 'text-gray-500'
                    )}
                  >
                    {limit.lowResourceValue}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Info/Warning box */}
        <div
          className={cn(
            'mt-4 p-3 rounded-lg border text-xs leading-relaxed flex items-start gap-2',
            enabled
              ? 'bg-lime-50 border-lime-200 text-lime-700'
              : 'bg-gray-50 border-gray-200 text-gray-600'
          )}
        >
          <HardDrive
            className={cn('w-4 h-4 mt-0.5 shrink-0', enabled ? 'text-lime-500' : 'text-gray-400')}
          />
          <p>
            {enabled
              ? t('schoolSettings.lowResourceMode.enabledInfo')
              : t('schoolSettings.lowResourceMode.disabledInfo')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
