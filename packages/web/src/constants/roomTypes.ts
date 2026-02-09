/**
 * Room type constants and utilities
 *
 * This file provides:
 * - Default room types (used as fallback when API is unavailable)
 * - Type definitions for room types
 * - Helper functions for room type lookups
 */

import { Beaker, Building, Dumbbell, Library, LucideIcon } from 'lucide-react';

/**
 * Room type definition
 */
export interface RoomTypeOption {
  id?: number;
  value: string;
  label: string;
  icon: string | null;
  sortOrder: number;
  isSystem: boolean;
}

/**
 * Room type with resolved icon component
 */
export interface RoomTypeWithIcon extends RoomTypeOption {
  IconComponent: LucideIcon;
}

/**
 * Special value for "no restriction" - used internally
 * Note: Radix Select doesn't allow empty strings, so we use this placeholder
 */
export const NONE_VALUE = '';

/**
 * Placeholder value for Radix Select (since it doesn't allow empty strings)
 */
export const SELECT_NONE_VALUE = '__none__';

/**
 * Icon name to component mapping
 */
export const ICON_MAP: Record<string, LucideIcon> = {
  Building,
  Beaker,
  Library,
  Dumbbell,
};

/**
 * Default room types (fallback when API unavailable)
 */
export const DEFAULT_ROOM_TYPES: RoomTypeOption[] = [
  { value: '', label: 'بدون محدودیت', icon: 'Building', sortOrder: 0, isSystem: true },
  { value: 'normal', label: 'صنف عادی', icon: 'Building', sortOrder: 1, isSystem: true },
  {
    value: 'computer_lab',
    label: 'لابراتوار کمپیوتر',
    icon: 'Beaker',
    sortOrder: 2,
    isSystem: true,
  },
  {
    value: 'biology_lab',
    label: 'لابراتوار بیولوژی',
    icon: 'Beaker',
    sortOrder: 3,
    isSystem: true,
  },
  {
    value: 'chemistry_lab',
    label: 'لابراتوار کیمیا',
    icon: 'Beaker',
    sortOrder: 4,
    isSystem: true,
  },
  { value: 'math_lab', label: 'لابراتوار ریاضی', icon: 'Beaker', sortOrder: 5, isSystem: true },
  { value: 'physics_lab', label: 'لابراتوار فزیک', icon: 'Beaker', sortOrder: 6, isSystem: true },
  { value: 'lab', label: 'لابراتوار', icon: 'Beaker', sortOrder: 7, isSystem: true },
  { value: 'library', label: 'کتابخانه', icon: 'Library', sortOrder: 8, isSystem: true },
  { value: 'salon', label: 'سالون', icon: 'Building', sortOrder: 9, isSystem: true },
  { value: 'gym', label: 'سالون ورزش', icon: 'Dumbbell', sortOrder: 10, isSystem: true },
  { value: 'sport_camp', label: 'میدان ورزشی', icon: 'Dumbbell', sortOrder: 11, isSystem: true },
  { value: 'other', label: 'سایر', icon: 'Building', sortOrder: 99, isSystem: true },
];

/**
 * Get icon component for a room type
 */
export function getRoomTypeIcon(iconName: string | null): LucideIcon {
  if (!iconName) return Building;
  return ICON_MAP[iconName] ?? Building;
}

/**
 * Get label for a room type value
 */
export function getRoomTypeLabel(
  value: string,
  roomTypes: RoomTypeOption[] = DEFAULT_ROOM_TYPES
): string {
  const found = roomTypes.find((rt) => rt.value === value);
  return found?.label ?? value;
}

/**
 * Convert room types to options with icon components
 */
export function withIcons(roomTypes: RoomTypeOption[]): RoomTypeWithIcon[] {
  return roomTypes.map((rt) => ({
    ...rt,
    IconComponent: getRoomTypeIcon(rt.icon),
  }));
}
