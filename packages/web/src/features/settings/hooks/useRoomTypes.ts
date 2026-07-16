/**
 * Hook for fetching and managing room types
 */

import {
  DEFAULT_ROOM_TYPES,
  RoomTypeOption,
  RoomTypeWithIcon,
  localizeRoomType,
  withIcons,
} from '@/constants/roomTypes';
import { api } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

export const ROOM_TYPES_KEY = ['room-types'] as const;
const ARCHIVED_ROOM_TYPES_KEY = ['room-types', 'archived'] as const;

function normalizeRoomType(value: Partial<RoomTypeOption> & { value: string }): RoomTypeOption {
  const labelFa = value.labelFa || value.label || value.value;
  return {
    id: value.id,
    value: value.value,
    label: labelFa,
    labelFa,
    labelEn: value.labelEn || labelFa,
    icon: value.icon || 'Building',
    sortOrder: value.sortOrder ?? 0,
    isSystem: value.isSystem ?? false,
    isDeleted: value.isDeleted ?? false,
    deletedAt: value.deletedAt ?? null,
  };
}

/**
 * Fetch room types from API
 */
async function fetchRoomTypes(): Promise<RoomTypeOption[]> {
  const response = await api.roomTypes.list();
  return (response as Array<Partial<RoomTypeOption> & { value: string }>).map(normalizeRoomType);
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
  const { i18n } = useTranslation();
  const { data, isLoading, error } = useRoomTypes();
  return {
    data: withIcons((data ?? DEFAULT_ROOM_TYPES).map((roomType) => localizeRoomType(roomType, i18n.language))),
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
  const { i18n } = useTranslation();
  const { data, isLoading } = useRoomTypes();
  const roomTypes = (data ?? DEFAULT_ROOM_TYPES).map((roomType) => localizeRoomType(roomType, i18n.language));

  return {
    options: roomTypes.map((rt) => ({
      value: rt.value,
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
  labelFa: string;
  labelEn: string;
  icon?: string;
  sortOrder?: number;
}

interface UpdateRoomTypeInput {
  labelFa?: string;
  labelEn?: string;
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
      queryClient.invalidateQueries({ queryKey: ARCHIVED_ROOM_TYPES_KEY });
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
      queryClient.invalidateQueries({ queryKey: ARCHIVED_ROOM_TYPES_KEY });
    },
  });
}

export function useArchivedRoomTypes() {
  return useQuery({
    queryKey: ARCHIVED_ROOM_TYPES_KEY,
    queryFn: async () => {
      const response = await api.roomTypes.listArchived();
      return (response as Array<Partial<RoomTypeOption> & { value: string }>).map(normalizeRoomType);
    },
  });
}

export function useRestoreRoomType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.roomTypes.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROOM_TYPES_KEY });
      queryClient.invalidateQueries({ queryKey: ARCHIVED_ROOM_TYPES_KEY });
    },
  });
}
