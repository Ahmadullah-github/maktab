/**
 * ScopeSelector Component
 * Radio button selection for export scope (Current/All Classes/All Teachers)
 *
 * Requirements: 1.2
 */

import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { GraduationCap, User, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { ExportScope } from '@/schemas/export.schema';

export interface ScopeSelectorProps {
  value: ExportScope;
  onChange: (scope: ExportScope) => void;
  currentType: 'class' | 'teacher';
}

/**
 * ScopeSelector - Radio button selection for export scope
 *
 * Features:
 * - Current class/teacher option
 * - All classes option
 * - All teachers option
 * - Adapts labels based on current schedule type
 * - Icons for visual identification
 * - RTL layout support
 *
 * Requirements: 1.2
 */
export function ScopeSelector({ value, onChange, currentType }: ScopeSelectorProps) {
  const { t } = useTranslation();

  // Determine the label for the "current" option based on schedule type
  const currentLabel = t('schedule.export.scopeCurrent', 'کلاس/استاد فعلی');
  const currentIcon = currentType === 'class' ? GraduationCap : User;
  const CurrentIcon = currentIcon;

  return (
    <RadioGroup
      value={value}
      onValueChange={(newValue: string) => onChange(newValue as ExportScope)}
      className="space-y-3"
      dir="rtl"
    >
      {/* Current Class/Teacher Option */}
      <div className="flex items-center space-x-2 space-x-reverse">
        <RadioGroupItem value="current" id="scope-current" />
        <Label
          htmlFor="scope-current"
          className="flex items-center gap-2 cursor-pointer font-normal"
        >
          <CurrentIcon className="h-4 w-4" />
          {currentLabel}
        </Label>
      </div>

      {/* All Classes Option */}
      <div className="flex items-center space-x-2 space-x-reverse">
        <RadioGroupItem value="all-classes" id="scope-all-classes" />
        <Label
          htmlFor="scope-all-classes"
          className="flex items-center gap-2 cursor-pointer font-normal"
        >
          <GraduationCap className="h-4 w-4" />
          {t('schedule.export.scopeAllClasses', 'همه کلاس‌ها')}
        </Label>
      </div>

      {/* All Teachers Option */}
      <div className="flex items-center space-x-2 space-x-reverse">
        <RadioGroupItem value="all-teachers" id="scope-all-teachers" />
        <Label
          htmlFor="scope-all-teachers"
          className="flex items-center gap-2 cursor-pointer font-normal"
        >
          <Users className="h-4 w-4" />
          {t('schedule.export.scopeAllTeachers', 'همه اساتید')}
        </Label>
      </div>
    </RadioGroup>
  );
}
