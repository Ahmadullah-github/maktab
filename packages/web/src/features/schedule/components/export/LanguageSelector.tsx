/**
 * LanguageSelector Component
 * Radio button selection for Persian/English export language
 *
 * Requirements: 1.3
 */

import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Globe, Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { ExportLanguage } from '@/schemas/export.schema';

export interface LanguageSelectorProps {
  value: ExportLanguage;
  onChange: (language: ExportLanguage) => void;
}

/**
 * LanguageSelector - Radio button selection for export language
 *
 * Features:
 * - Persian (Farsi) option
 * - English option
 * - Icons for visual identification
 * - RTL layout support
 * - Accessible radio group implementation
 *
 * Requirements: 1.3
 */
export function LanguageSelector({ value, onChange }: LanguageSelectorProps) {
  const { t } = useTranslation();

  return (
    <RadioGroup
      value={value}
      onValueChange={(newValue) => onChange(newValue as ExportLanguage)}
      className="grid grid-cols-2 gap-4"
      dir="rtl"
    >
      {/* Persian Option */}
      <div className="flex items-center space-x-2 space-x-reverse">
        <RadioGroupItem value="fa" id="language-fa" />
        <Label htmlFor="language-fa" className="flex items-center gap-2 cursor-pointer font-normal">
          <Languages className="h-4 w-4" />
          {t('schedule.export.languagePersian', 'فارسی')}
        </Label>
      </div>

      {/* English Option */}
      <div className="flex items-center space-x-2 space-x-reverse">
        <RadioGroupItem value="en" id="language-en" />
        <Label htmlFor="language-en" className="flex items-center gap-2 cursor-pointer font-normal">
          <Globe className="h-4 w-4" />
          {t('schedule.export.languageEnglish', 'انگلیسی')}
        </Label>
      </div>
    </RadioGroup>
  );
}
