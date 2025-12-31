/**
 * CellContentToggles component for display settings
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface CellContentTogglesProps {
  showTeacherName: boolean;
  showRoomName: boolean;
  onShowTeacherNameChange: (value: boolean) => void;
  onShowRoomNameChange: (value: boolean) => void;
}

export function CellContentToggles({
  showTeacherName,
  showRoomName,
  onShowTeacherNameChange,
  onShowRoomNameChange,
}: CellContentTogglesProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label htmlFor="show-teacher-name" className="text-sm font-medium">
          نام استاد
        </Label>
        <Switch
          id="show-teacher-name"
          checked={showTeacherName}
          onCheckedChange={onShowTeacherNameChange}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="show-room-name" className="text-sm font-medium">
          نام اتاق
        </Label>
        <Switch id="show-room-name" checked={showRoomName} onCheckedChange={onShowRoomNameChange} />
      </div>
    </div>
  );
}
