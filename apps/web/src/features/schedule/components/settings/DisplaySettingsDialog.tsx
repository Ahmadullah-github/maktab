/**
 * DisplaySettingsDialog component - Main settings modal
 *
 * Requirements: 1.1, 1.2, 1.5, 2.1, 2.2, 2.5, 3.1, 4.1, 6.3, 6.4, 7.4
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useDisplaySettings } from '../../hooks/useDisplaySettings';
import type { DisplaySettingsDialogProps } from '../../types';
import { CellContentToggles } from './CellContentToggles';
import { ColorCodingSelector } from './ColorCodingSelector';
import { PresetButtons } from './PresetButtons';
import { SizeSelector } from './SizeSelector';

export function DisplaySettingsDialog({ open, onOpenChange }: DisplaySettingsDialogProps) {
  const { settings, updateSettings, applyPreset } = useDisplaySettings();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>تنظیمات نمایش</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Cell Content Section */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">محتوای سلول</Label>
            <CellContentToggles
              showTeacherName={settings.showTeacherName}
              showRoomName={settings.showRoomName}
              onShowTeacherNameChange={(value) => updateSettings({ showTeacherName: value })}
              onShowRoomNameChange={(value) => updateSettings({ showRoomName: value })}
            />
          </div>

          <Separator />

          {/* Size Section */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">اندازه</Label>
            <SizeSelector
              cellSize={settings.cellSize}
              fontSize={settings.fontSize}
              onCellSizeChange={(value) => updateSettings({ cellSize: value })}
              onFontSizeChange={(value) => updateSettings({ fontSize: value })}
            />
          </div>

          <Separator />

          {/* Color Coding Section */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">رنگ‌بندی</Label>
            <ColorCodingSelector
              colorBy={settings.colorBy}
              onColorByChange={(value) => updateSettings({ colorBy: value })}
            />
          </div>

          <Separator />

          {/* Presets Section */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">پیش‌تنظیمات</Label>
            <PresetButtons onApplyPreset={applyPreset} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
