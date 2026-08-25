/**
 * Rooms feature exports
 *
 * Requirements: 1.1
 */

// Types
export * from './types';

// API
export { roomsApi } from './api';

// Hooks
export {
  applyRoomFilters,
  filterRoomsBySearch,
  filterRoomsByType,
  useRoomFilters,
} from './hooks/useRoomFilters';
export {
  ROOMS_QUERY_KEY,
  useCreateRoom,
  useDeleteRoom,
  useRoom,
  useRooms,
  useUpdateRoom,
} from './hooks/useRooms';

// Serialization utilities
export {
  deserializeRoom,
  parseJsonArray,
  parseJsonObject,
  parseUnavailableSlots,
  serializeRoomForApi,
} from './utils/serialization';

// Logger utilities
export { apiLogger, componentLogger, logger } from './utils/logger';

// Components
export { RoomDataGrid } from './components/RoomDataGrid';
export type { RoomDataGridProps } from './components/RoomDataGrid';
export { RoomEditDrawer } from './components/RoomEditDrawer';
export type { RoomEditDrawerProps } from './components/RoomEditDrawer';
export { RoomFilters } from './components/RoomFilters';
export type { RoomFiltersProps } from './components/RoomFilters';
export { RoomForm } from './components/RoomForm';
export type { RoomFormProps } from './components/RoomForm';
export { RoomFormDrawer } from './components/RoomFormDrawer';
export type { RoomFormDrawerProps } from './components/RoomFormDrawer';
export { RoomsPage } from './components/RoomsPage';
export type { RoomsPageProps } from './components/RoomsPage';
export { RoomStatsCard } from './components/RoomStatsCard';
export type { RoomStatsCardProps } from './components/RoomStatsCard';
