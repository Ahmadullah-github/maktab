/**
 * SettingsToggles Component
 * Checkboxes for display settings integration with Phase 4
 *
 * Requirements: 1.5, 7.5
 */

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Eye, MapPin, Palette, User } from 'lucide-react';

import { useTranslation } from 'react-i18next';
import type { DisplaySettings } from '../../types';

export interface SettingsTogglesProps {
  displaySettings: DisplaySettings;
  onChange: (settings: Partial<DisplaySettings>) => void;
}

/**
 * SettingsToggles - Checkboxes for display settings
 *
 * Features:
 * - Teacher name visibility toggle
 * - Room name visibility toggle
 * - Color coding toggle
 * - Integration with Phase 4 useDisplaySettings hook
 * - Icons for visual identification
 * - RTL layout support
 * - Accessible checkbox implementation
 *
 * Requirements: 1.5, 7.5
 */
export function SettingsToggles({ displaySettings, onChange }: SettingsTogglesProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {/* Teacher Name Toggle */}
      <div className="flex items-center space-x-2 space-x-reverse">
        <Checkbox
          id="show-teacher-name"
          checked={displaySettings.showTeacherName}
          onCheckedChange={(checked) => onChange({ showTeacherName: checked === true })}
        />
        <Label
          htmlFor="show-teacher-name"
          className="flex items-center gap-2 cursor-pointer font-normal"
        >
          <User className="h-4 w-4" />
          {t('schedule.export.includeTeacherNames', 'نام اساتید')}
        </Label>
      </div>

      {/* Room Name Toggle */}
      <div className="flex items-center space-x-2 space-x-reverse">
        <Checkbox
          id="show-room-name"
          checked={displaySettings.showRoomName}
          onCheckedChange={(checked) => onChange({ showRoomName: checked === true })}
        />
        <Label
          htmlFor="show-room-name"
          className="flex items-center gap-2 cursor-pointer font-normal"
        >
          <MapPin className="h-4 w-4" />
          {t('schedule.export.includeRoomNames', 'نام اتاق‌ها')}
        </Label>
      </div>

      {/* Color Coding Toggle */}
      <div className="flex items-center space-x-2 space-x-reverse">
        <Checkbox
          id="show-color-coding"
          checked={displaySettings.colorBy !== 'none'}
          onCheckedChange={(checked) =>
            onChange({ colorBy: checked === true ? 'subject' : 'none' })
          }
        />
        <Label
          htmlFor="show-color-coding"
          className="flex items-center gap-2 cursor-pointer font-normal"
        >
          <Palette className="h-4 w-4" />
          {t('schedule.export.includeColorCoding', 'رنگ‌بندی')}
        </Label>
      </div>

      {/* Subject Name (Always Shown - Informational) */}
      <div className="flex items-center space-x-2 space-x-reverse opacity-60">
        <Checkbox
          id="show-subject-name"
          checked={true}
          disabled={true}
          aria-label={t('schedule.settings.showSubjectName', 'نام درس همیشه نمایش داده می‌شود')}
        />
        <Label
          htmlFor="show-subject-name"
          className="flex items-center gap-2 cursor-not-allowed font-normal text-muted-foreground"
        >
          <Eye className="h-4 w-4" />
          {t('schedule.settings.showSubjectName', 'نام درس')} (
          {t('common.alwaysShown', 'همیشه نمایش داده می‌شود')})
        </Label>
      </div>
    </div>
  );
}
