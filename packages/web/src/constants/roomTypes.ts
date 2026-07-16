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
  /** Transitional Persian label alias returned by older/newer APIs. */
  label: string;
  labelFa: string;
  labelEn: string;
  icon: string | null;
  sortOrder: number;
  isSystem: boolean;
  isDeleted?: boolean;
  deletedAt?: string | null;
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
  { value: 'normal', label: 'صنف عادی', labelFa: 'صنف عادی', labelEn: 'Classroom', icon: 'Building', sortOrder: 1, isSystem: true },
  {
    value: 'computer_lab',
    label: 'لابراتوار کمپیوتر',
    labelFa: 'لابراتوار کمپیوتر', labelEn: 'Computer Lab', icon: 'Beaker',
    sortOrder: 2,
    isSystem: true,
  },
  {
    value: 'biology_lab',
    label: 'لابراتوار بیولوژی',
    labelFa: 'لابراتوار بیولوژی', labelEn: 'Biology Lab', icon: 'Beaker',
    sortOrder: 3,
    isSystem: true,
  },
  {
    value: 'chemistry_lab',
    label: 'لابراتوار کیمیا',
    labelFa: 'لابراتوار کیمیا', labelEn: 'Chemistry Lab', icon: 'Beaker',
    sortOrder: 4,
    isSystem: true,
  },
  { value: 'math_lab', label: 'لابراتوار ریاضی', labelFa: 'لابراتوار ریاضی', labelEn: 'Math Lab', icon: 'Beaker', sortOrder: 5, isSystem: true },
  { value: 'physics_lab', label: 'لابراتوار فزیک', labelFa: 'لابراتوار فزیک', labelEn: 'Physics Lab', icon: 'Beaker', sortOrder: 6, isSystem: true },
  { value: 'lab', label: 'لابراتوار', labelFa: 'لابراتوار', labelEn: 'Laboratory', icon: 'Beaker', sortOrder: 7, isSystem: true },
  { value: 'library', label: 'کتابخانه', labelFa: 'کتابخانه', labelEn: 'Library', icon: 'Library', sortOrder: 8, isSystem: true },
  { value: 'salon', label: 'سالون', labelFa: 'سالون', labelEn: 'Hall', icon: 'Building', sortOrder: 9, isSystem: true },
  { value: 'gym', label: 'سالون ورزش', labelFa: 'سالون ورزش', labelEn: 'Gym', icon: 'Dumbbell', sortOrder: 10, isSystem: true },
  { value: 'sport_camp', label: 'میدان ورزشی', labelFa: 'میدان ورزشی', labelEn: 'Sports Ground', icon: 'Dumbbell', sortOrder: 11, isSystem: true },
  { value: 'other', label: 'سایر', labelFa: 'سایر', labelEn: 'Other', icon: 'Building', sortOrder: 99, isSystem: true },
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

export function localizeRoomType(roomType: RoomTypeOption, language: string): RoomTypeOption {
  const label = language.startsWith('fa')
    ? roomType.labelFa || roomType.label
    : roomType.labelEn || roomType.labelFa || roomType.label;
  return { ...roomType, label, labelFa: roomType.labelFa || roomType.label, labelEn: roomType.labelEn || roomType.labelFa || roomType.label };
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
