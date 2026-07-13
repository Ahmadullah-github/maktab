/**
 * MinistryValidationCard Component
 *
 * Configure Ministry of Education curriculum validation settings
 * with three modes: off, warn, strict
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  BookOpen,
  Check,
  FileCheck,
  Shield,
  ShieldAlert,
  ShieldOff,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { MinistryValidationMode } from '../schemas/schoolSettings.schema';

interface ValidationModeOption {
  value: MinistryValidationMode;
  icon: React.ElementType;
  color: {
    bg: string;
    bgSelected: string;
    border: string;
    borderSelected: string;
    icon: string;
    iconBg: string;
    text: string;
  };
}

const VALIDATION_MODES: ValidationModeOption[] = [
  {
    value: 'off',
    icon: ShieldOff,
    color: {
      bg: 'bg-gray-50',
      bgSelected: 'bg-gray-100',
      border: 'border-gray-200',
      borderSelected: 'border-gray-400',
      icon: 'text-gray-500',
      iconBg: 'bg-gray-200',
      text: 'text-gray-700',
    },
  },
  {
    value: 'warn',
    icon: AlertTriangle,
    color: {
      bg: 'bg-amber-50',
      bgSelected: 'bg-amber-100',
      border: 'border-amber-200',
      borderSelected: 'border-amber-400',
      icon: 'text-amber-600',
      iconBg: 'bg-amber-200',
      text: 'text-amber-700',
    },
  },
  {
    value: 'strict',
    icon: ShieldAlert,
    color: {
      bg: 'bg-red-50',
      bgSelected: 'bg-red-100',
      border: 'border-red-200',
      borderSelected: 'border-red-400',
      icon: 'text-red-600',
      iconBg: 'bg-red-200',
      text: 'text-red-700',
    },
  },
];

interface MinistryValidationCardProps {
  enabled: boolean;
  mode: MinistryValidationMode;
  customCurriculumMode: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onModeChange: (mode: MinistryValidationMode) => void;
  onCustomCurriculumChange: (enabled: boolean) => void;
  disabled?: boolean;
}

export function MinistryValidationCard({
  enabled,
  mode,
  customCurriculumMode,
  onEnabledChange,
  onModeChange,
  onCustomCurriculumChange,
  disabled,
}: MinistryValidationCardProps) {
  const { t } = useTranslation();

  return (
    <Card
      className={cn(
        'border-2 transition-all duration-300',
        enabled
          ? 'border-blue-300 bg-linear-to-br from-blue-50 via-indigo-50 to-violet-50 shadow-lg shadow-blue-100/50'
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
                  ? 'bg-linear-to-br from-blue-500 to-indigo-600'
                  : 'bg-linear-to-br from-gray-400 to-gray-500'
              )}
            >
              <FileCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                {t('schoolSettings.ministryValidation.title')}
                {enabled && (
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs',
                      mode === 'warn' && 'border-amber-300 bg-amber-50 text-amber-700',
                      mode === 'strict' && 'border-red-300 bg-red-50 text-red-700',
                      mode === 'off' && 'border-gray-300 bg-gray-50 text-gray-700'
                    )}
                  >
                    {t(`schoolSettings.ministryValidation.modes.${mode}.badge`)}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-sm">
                {t('schoolSettings.ministryValidation.description')}
              </CardDescription>
            </div>
          </div>

          {/* Toggle Switch */}
          <div className="flex items-center gap-2">
            <Label
              htmlFor="ministry-toggle"
              className={cn(
                'text-sm font-medium transition-colors',
                enabled ? 'text-blue-700' : 'text-gray-500'
              )}
            >
              {enabled
                ? t('schoolSettings.ministryValidation.enabled')
                : t('schoolSettings.ministryValidation.disabled')}
            </Label>
            <Switch
              id="ministry-toggle"
              checked={enabled}
              onCheckedChange={onEnabledChange}
              disabled={disabled}
              className="data-[state=checked]:bg-blue-500 focus-visible:ring-blue-500"
            />
          </div>
        </div>
      </CardHeader>

      {/* Expanded content when enabled */}
      <div
        className={cn(
          'grid transition-all duration-300 ease-in-out',
          enabled ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="overflow-hidden">
          <CardContent className="pt-0 pb-6">
            {/* Decorative divider */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-linear-to-r from-transparent via-blue-300 to-transparent" />
              <Shield className="w-4 h-4 text-blue-400" />
              <div className="flex-1 h-px bg-linear-to-r from-transparent via-blue-300 to-transparent" />
            </div>

            {/* Validation Mode Selection */}
            <div className="space-y-4">
              <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                {t('schoolSettings.ministryValidation.modeLabel')}
              </Label>

              <div className="grid grid-cols-3 gap-3">
                {VALIDATION_MODES.map((option) => {
                  const Icon = option.icon;
                  const isSelected = mode === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onModeChange(option.value)}
                      disabled={disabled || customCurriculumMode}
                      className={cn(
                        'relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200',
                        'hover:scale-[1.02] active:scale-[0.98]',
                        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
                        isSelected
                          ? [option.color.bgSelected, option.color.borderSelected, 'shadow-md']
                          : [option.color.bg, option.color.border, 'hover:shadow-sm'],
                        (disabled || customCurriculumMode) &&
                          'opacity-50 cursor-not-allowed hover:scale-100'
                      )}
                    >
                      {/* Selection indicator */}
                      {isSelected && (
                        <div className="absolute top-1.5 end-1.5">
                          <div
                            className={cn(
                              'w-5 h-5 rounded-full flex items-center justify-center',
                              'bg-white shadow-sm border',
                              option.color.borderSelected
                            )}
                          >
                            <Check className={cn('w-3 h-3', option.color.icon)} strokeWidth={3} />
                          </div>
                        </div>
                      )}

                      {/* Icon */}
                      <div
                        className={cn(
                          'w-10 h-10 rounded-xl flex items-center justify-center',
                          option.color.iconBg
                        )}
                      >
                        <Icon className={cn('w-5 h-5', option.color.icon)} />
                      </div>

                      {/* Label */}
                      <span className={cn('text-sm font-medium', option.color.text)}>
                        {t(`schoolSettings.ministryValidation.modes.${option.value}.label`)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Mode description */}
              <div
                className={cn(
                  'p-3 rounded-lg border text-xs leading-relaxed',
                  mode === 'off' && 'bg-gray-50 border-gray-200 text-gray-600',
                  mode === 'warn' && 'bg-amber-50 border-amber-200 text-amber-700',
                  mode === 'strict' && 'bg-red-50 border-red-200 text-red-700'
                )}
              >
                {t(`schoolSettings.ministryValidation.modes.${mode}.description`)}
              </div>

              {/* Custom Curriculum Toggle */}
              <div
                className={cn(
                  'flex items-center justify-between p-4 rounded-xl border-2 transition-all',
                  customCurriculumMode
                    ? 'border-violet-300 bg-violet-50'
                    : 'border-gray-200 bg-gray-50'
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center',
                      customCurriculumMode ? 'bg-violet-200' : 'bg-gray-200'
                    )}
                  >
                    <BookOpen
                      className={cn(
                        'w-4 h-4',
                        customCurriculumMode ? 'text-violet-600' : 'text-gray-500'
                      )}
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="custom-curriculum"
                      className={cn(
                        'text-sm font-medium cursor-pointer',
                        customCurriculumMode ? 'text-violet-700' : 'text-gray-700'
                      )}
                    >
                      {t('schoolSettings.ministryValidation.customCurriculum.label')}
                    </Label>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {t('schoolSettings.ministryValidation.customCurriculum.description')}
                    </p>
                  </div>
                </div>
                <Switch
                  id="custom-curriculum"
                  checked={customCurriculumMode}
                  onCheckedChange={onCustomCurriculumChange}
                  disabled={disabled}
                  className="data-[state=checked]:bg-violet-500"
                />
              </div>
            </div>
          </CardContent>
        </div>
      </div>

      {/* Collapsed hint */}
      {!enabled && (
        <CardContent className="pt-0 pb-4">
          <p className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
            {t('schoolSettings.ministryValidation.hint')}
          </p>
        </CardContent>
      )}
    </Card>
  );
}
