/**
 * AcademicStructureCard Component
 *
 * Displays grade level selection cards for Primary, Middle, and High school
 * with visual feedback and icons matching Afghan education system
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Baby, Backpack, Check, GraduationCap, School } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface GradeLevel {
  key: 'enablePrimary' | 'enableMiddle' | 'enableHigh';
  icon: React.ElementType;
  grades: string;
  color: {
    bg: string;
    bgSelected: string;
    border: string;
    borderSelected: string;
    icon: string;
    iconSelected: string;
    text: string;
    textSelected: string;
  };
}

const GRADE_LEVELS: GradeLevel[] = [
  {
    key: 'enablePrimary',
    icon: Baby,
    grades: '۱-۶',
    color: {
      bg: 'bg-sky-50',
      bgSelected: 'bg-sky-100',
      border: 'border-sky-200',
      borderSelected: 'border-sky-500',
      icon: 'text-sky-400',
      iconSelected: 'text-sky-600',
      text: 'text-sky-700',
      textSelected: 'text-sky-800',
    },
  },
  {
    key: 'enableMiddle',
    icon: Backpack,
    grades: '۷-۹',
    color: {
      bg: 'bg-violet-50',
      bgSelected: 'bg-violet-100',
      border: 'border-violet-200',
      borderSelected: 'border-violet-500',
      icon: 'text-violet-400',
      iconSelected: 'text-violet-600',
      text: 'text-violet-700',
      textSelected: 'text-violet-800',
    },
  },
  {
    key: 'enableHigh',
    icon: GraduationCap,
    grades: '۱۰-۱۲',
    color: {
      bg: 'bg-amber-50',
      bgSelected: 'bg-amber-100',
      border: 'border-amber-200',
      borderSelected: 'border-amber-500',
      icon: 'text-amber-400',
      iconSelected: 'text-amber-600',
      text: 'text-amber-700',
      textSelected: 'text-amber-800',
    },
  },
];

interface AcademicStructureCardProps {
  enablePrimary: boolean;
  enableMiddle: boolean;
  enableHigh: boolean;
  onToggle: (key: 'enablePrimary' | 'enableMiddle' | 'enableHigh') => void;
  disabled?: boolean;
  error?: string;
}

export function AcademicStructureCard({
  enablePrimary,
  enableMiddle,
  enableHigh,
  onToggle,
  disabled,
  error,
}: AcademicStructureCardProps) {
  const { t } = useTranslation();

  const values = {
    enablePrimary,
    enableMiddle,
    enableHigh,
  };

  return (
    <Card className="border-2 border-border/50 shadow-sm hover:shadow-md transition-all duration-200">
      <CardHeader className="pb-4 bg-linear-to-r from-indigo-50 to-purple-50 rounded-t-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
            <School className="w-5 h-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-gray-800">
              {t('schoolSettings.academicStructure.title')}
            </CardTitle>
            <CardDescription className="text-sm text-gray-600">
              {t('schoolSettings.academicStructure.description')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-5 pb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {GRADE_LEVELS.map((level) => {
            const Icon = level.icon;
            const isSelected = values[level.key];

            return (
              <button
                key={level.key}
                type="button"
                onClick={() => onToggle(level.key)}
                disabled={disabled}
                className={cn(
                  'relative flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all duration-200',
                  'hover:scale-[1.02] active:scale-[0.98]',
                  'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500',
                  isSelected
                    ? [level.color.bgSelected, level.color.borderSelected, 'shadow-md']
                    : [level.color.bg, level.color.border, 'hover:shadow-sm'],
                  disabled && 'opacity-50 cursor-not-allowed hover:scale-100'
                )}
              >
                {/* Selection indicator */}
                {isSelected && (
                  <div className="absolute top-2 end-2">
                    <div
                      className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center',
                        'bg-white shadow-sm border',
                        level.color.borderSelected
                      )}
                    >
                      <Check className={cn('w-4 h-4', level.color.iconSelected)} strokeWidth={3} />
                    </div>
                  </div>
                )}

                {/* Icon */}
                <div
                  className={cn(
                    'w-14 h-14 rounded-2xl flex items-center justify-center transition-colors',
                    isSelected ? 'bg-white shadow-sm' : 'bg-white/60'
                  )}
                >
                  <Icon
                    className={cn(
                      'w-7 h-7 transition-colors',
                      isSelected ? level.color.iconSelected : level.color.icon
                    )}
                  />
                </div>

                {/* Label */}
                <div className="text-center">
                  <p
                    className={cn(
                      'font-semibold text-sm transition-colors',
                      isSelected ? level.color.textSelected : level.color.text
                    )}
                  >
                    {t(`schoolSettings.academicStructure.${level.key}`)}
                  </p>
                  <p
                    className={cn(
                      'text-xs mt-0.5 transition-colors',
                      isSelected ? 'text-gray-600' : 'text-gray-500'
                    )}
                  >
                    {t('schoolSettings.academicStructure.grades', { grades: level.grades })}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Error message */}
        {error && (
          <p className="mt-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
            {t(error)}
          </p>
        )}

        {/* Helper text */}
        <p className="mt-4 text-xs text-gray-500 text-center">
          {t('schoolSettings.academicStructure.helperText')}
        </p>
      </CardContent>
    </Card>
  );
}
