/**
 * Types for the Rooms feature module
 * Matches the API entity structure from packages/api/src/entity/Room.ts
 *
 * Requirements: 1.1, 3.2, 7.2
 */

/**
 * Room type classification
 * Extended to support specific lab types for better scheduling constraints
 */
export type RoomType =
  | 'normal'
  | 'computer_lab'
  | 'biology_lab'
  | 'chemistry_lab'
  | 'math_lab'
  | 'physics_lab'
  | 'lab'
  | 'library'
  | 'salon'
  | 'gym'
  | 'sport_camp'
  | 'other'
  | '';

/**
 * Room type filter options (includes 'all' for showing all types)
 */
export type RoomTypeFilter = 'all' | RoomType;

/**
 * Unavailable time slot structure
 * Represents a period when the room cannot be used
 */
export interface UnavailableSlot {
  day: WeekDay;
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
import type { WeekDay } from '@/features/school-settings/constants/defaults';
