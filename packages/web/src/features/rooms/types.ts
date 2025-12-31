/**
 * Types for the Rooms feature module
 * Matches the API entity structure from packages/api/src/entity/Room.ts
 *
 * Requirements: 1.1, 3.2, 7.2
 */

/**
 * Room type classification
 * - classroom: Standard classroom
 * - lab: Laboratory (science, computer)
 * - gym: Gymnasium/sports hall
 * - library: Library
 * - '': No specific room type
 */
export type RoomType = 'classroom' | 'lab' | 'gym' | 'library' | '';

/**
 * Room type filter options (includes 'all' for showing all types)
 */
export type RoomTypeFilter = 'all' | RoomType;

/**
 * Unavailable time slot structure
 * Represents a period when the room cannot be used
 */
export interface UnavailableSlot {
  day: number; // 0-6 (Sunday-Saturday)
  period: number; // Period index
}

/**
 * Room entity matching the API response structure (deserialized)
 * Complex fields are parsed from JSON strings to proper types
 */
export interface Room {
  id: number;
  schoolId: number | null;
  name: string;
  capacity: number;
  type: RoomType;
  features: string[]; // Parsed from JSON
  unavailable: UnavailableSlot[]; // Parsed from JSON
  meta: Record<string, unknown>; // Parsed from JSON
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Raw API response for Room (with JSON strings)
 * This is the format received from the backend before deserialization
 */
export interface RoomResponse {
  id: number;
  schoolId: number | null;
  name: string;
  capacity: number;
  type: string;
  features: string; // JSON string
  unavailable: string; // JSON string
  meta: string; // JSON string
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Form values for creating/editing a room
 */
export interface RoomFormValues {
  name: string;
  capacity: number;
  type: RoomType;
  features: string[];
  unavailable: UnavailableSlot[];
}

/**
 * Filter state for the rooms list
 */
export interface RoomFiltersState {
  search: string;
  typeFilter: RoomTypeFilter;
}
