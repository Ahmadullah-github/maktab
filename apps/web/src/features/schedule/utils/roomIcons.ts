/**
 * Room Type Icon Mapping Utility
 * Maps room types to Lucide React icons for visual indicators
 */

import { Beaker, Building2, Dumbbell, Library, Palette, type LucideIcon } from 'lucide-react';

/**
 * Room type to icon mapping
 * Covers common room types in Afghan schools
 */
export const ROOM_TYPE_ICONS: Record<string, LucideIcon> = {
  normal: Building2,
  classroom: Building2,
  lab: Beaker,
  computer_lab: Beaker,
  science_lab: Beaker,
  gym: Dumbbell,
  sport: Dumbbell,
  art: Palette,
  music: Palette,
  library: Library,
};

/**
 * Gets the appropriate Lucide icon component for a room type
 * @param roomType - The type of room (e.g., 'lab', 'gym', 'normal')
 * @returns Lucide icon component
 */
export function getRoomIcon(roomType?: string | null): LucideIcon {
  if (!roomType) return Building2;

  // Normalize: lowercase and remove underscores/hyphens
  const normalized = roomType.toLowerCase().replace(/[_-]/g, '');

  // Find matching icon
  for (const [key, Icon] of Object.entries(ROOM_TYPE_ICONS)) {
    const normalizedKey = key.replace('_', '');
    if (normalized.includes(normalizedKey)) {
      return Icon;
    }
  }

  // Default to classroom icon
  return Building2;
}
