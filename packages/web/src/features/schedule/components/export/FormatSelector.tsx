/**
 * FormatSelector Component
 * Radio button selection for PDF/Excel export formats
 *
 * Requirements: 1.1
 */

import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FileText, Table } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { ExportFormat } from '@/schemas/export.schema';

export interface FormatSelectorProps {
  value: ExportFormat;
  onChange: (format: ExportFormat) => void;
}

/**
 * FormatSelector - Radio button selection for export formats
 *
 * Features:
 * - PDF and Excel format options
 * - Icons for visual identification
 * - RTL layout support
 * - Accessible radio group implementation
 *
 * Requirements: 1.1
 */
export function FormatSelector({ value, onChange }: FormatSelectorProps) {
  const { t } = useTranslation();

  return (
    <RadioGroup
      value={value}
      onValueChange={(newValue) => onChange(newValue as ExportFormat)}
      className="grid grid-cols-2 gap-4"
      dir="rtl"
    >
      {/* PDF Option */}
      <div className="flex items-center space-x-2 space-x-reverse">
        <RadioGroupItem value="pdf" id="format-pdf" />
        <Label htmlFor="format-pdf" className="flex items-center gap-2 cursor-pointer font-normal">
          <FileText className="h-4 w-4" />
          {t('schedule.export.formatPdf', 'PDF')}
        </Label>
      </div>

      {/* Excel Option */}
      <div className="flex items-center space-x-2 space-x-reverse">
        <RadioGroupItem value="excel" id="format-excel" />
        <Label
          htmlFor="format-excel"
          className="flex items-center gap-2 cursor-pointer font-normal"
        >
          <Table className="h-4 w-4" />
          {t('schedule.export.formatExcel', 'Excel')}
        </Label>
      </div>
    </RadioGroup>
  );
}
