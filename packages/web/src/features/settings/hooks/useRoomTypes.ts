/**
 * Hook for fetching and managing room types
 */

import {
  DEFAULT_ROOM_TYPES,
  RoomTypeOption,
  RoomTypeWithIcon,
  SELECT_NONE_VALUE,
  withIcons,
} from '@/constants/roomTypes';
import { api } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const ROOM_TYPES_KEY = ['room-types'];

/**
 * Fetch room types from API
 */
async function fetchRoomTypes(): Promise<RoomTypeOption[]> {
  const response = await api.roomTypes.list();
  return response as RoomTypeOption[];
}

/**
 * Hook to get all active room types
 * Falls back to defaults if API fails
 */
export function useRoomTypes() {
  return useQuery({
    queryKey: ROOM_TYPES_KEY,
    queryFn: fetchRoomTypes,
    staleTime: 1000 * 60 * 30, // 30 minutes - room types rarely change
    gcTime: 1000 * 60 * 60, // 1 hour
    placeholderData: DEFAULT_ROOM_TYPES,
    retry: 2,
  });
}

/**
 * Hook to get room types with icon components resolved
 */
export function useRoomTypesWithIcons(): {
  data: RoomTypeWithIcon[];
  isLoading: boolean;
  error: Error | null;
} {
  const { data, isLoading, error } = useRoomTypes();
  return {
    data: withIcons(data ?? DEFAULT_ROOM_TYPES),
    isLoading,
    error,
  };
}

/**
 * Hook to get room type options for dropdowns (value + label only)
 * Converts empty values to SELECT_NONE_VALUE for Radix Select compatibility
 */
export function useRoomTypeOptions(): {
  options: { value: string; label: string }[];
  isLoading: boolean;
} {
  const { data, isLoading } = useRoomTypes();
  const roomTypes = data ?? DEFAULT_ROOM_TYPES;

  return {
    options: roomTypes.map((rt) => ({
      value: rt.value === '' ? SELECT_NONE_VALUE : rt.value,
      label: rt.label,
    })),
    isLoading,
  };
}

// ============================================================================
// Mutations (for settings page - to be implemented later)
// ============================================================================

interface CreateRoomTypeInput {
  value: string;
  label: string;
  icon?: string;
  sortOrder?: number;
}

interface UpdateRoomTypeInput {
  value?: string;
  label?: string;
  icon?: string;
  sortOrder?: number;
}

export function useCreateRoomType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateRoomTypeInput) => {
      return api.roomTypes.create(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROOM_TYPES_KEY });
    },
  });
}

export function useUpdateRoomType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateRoomTypeInput & { id: number }) => {
      return api.roomTypes.update(id, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROOM_TYPES_KEY });
    },
  });
}

export function useDeleteRoomType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      return api.roomTypes.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROOM_TYPES_KEY });
    },
  });
}
