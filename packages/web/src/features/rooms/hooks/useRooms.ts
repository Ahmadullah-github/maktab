/**
 * TanStack Query hooks for Rooms data management
 *
 * Provides hooks for fetching, creating, updating, and deleting rooms
 * with automatic cache invalidation and Farsi toast notifications
 *
 * Requirements: 1.1, 4.2, 5.2, 6.2
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { roomsApi } from '../api';
import type { RoomFormValues } from '../types';
import { logger } from '../utils/logger';
import { useTranslation } from 'react-i18next';

/**
 * Query key for rooms data
 * Used for cache management and invalidation
 */
export const ROOMS_QUERY_KEY = ['rooms'] as const;

/**
 * Hook for fetching all rooms
 *
 * @returns Query result with rooms array
 *
 * Requirements: 1.1
 */
export function useRooms() {
  return useQuery({
    queryKey: ROOMS_QUERY_KEY,
    queryFn: roomsApi.getAll,
  });
}

/**
 * Hook for fetching a single room by ID
 *
 * @param id - Room ID to fetch, or null to disable the query
 * @returns Query result with room data
 *
 * Requirements: 1.1
 */
export function useRoom(id: number | null) {
  return useQuery({
    queryKey: [...ROOMS_QUERY_KEY, id],
    queryFn: () => roomsApi.getById(id!),
    enabled: id !== null,
  });
}

/**
 * Hook for creating a new room
 *
 * Automatically invalidates the rooms cache on success
 * and shows Farsi toast notifications for success/error
 *
 * @returns Mutation result with create function
 *
 * Requirements: 4.2
 */
export function useCreateRoom() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (data: RoomFormValues) => roomsApi.create(data),
    onSuccess: (newRoom) => {
      logger.debug('Invalidating rooms cache after create');
      queryClient.invalidateQueries({ queryKey: ROOMS_QUERY_KEY });
      toast.success(t('rooms.success.created'), {
        description: newRoom.name,
      });
    },
    onError: (error: Error) => {
      logger.error('Failed to create room', { error: error.message });
      toast.error(t('rooms.errors.createFailed'), {
        description: error.message,
      });
    },
  });
}

/**
 * Hook for updating an existing room
 *
 * Automatically invalidates the rooms cache on success
 * and shows Farsi toast notifications for success/error
 *
 * @returns Mutation result with update function
 *
 * Requirements: 5.2
 */
export function useUpdateRoom() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<RoomFormValues> }) =>
      roomsApi.update(id, data),
    onSuccess: (updatedRoom) => {
      logger.debug('Invalidating rooms cache after update');
      queryClient.invalidateQueries({ queryKey: ROOMS_QUERY_KEY });
      toast.success(t('rooms.success.updated'), {
        description: updatedRoom.name,
      });
    },
    onError: (error: Error) => {
      logger.error('Failed to update room', { error: error.message });
      toast.error(t('rooms.errors.updateFailed'), {
        description: error.message,
      });
    },
  });
}

/**
 * Hook for deleting a room
 *
 * Automatically invalidates the rooms cache on success
 * and shows Farsi toast notifications for success/error
 *
 * @returns Mutation result with delete function
 *
 * Requirements: 6.2
 */
export function useDeleteRoom() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (id: number) => roomsApi.delete(id),
    onSuccess: () => {
      logger.debug('Invalidating rooms cache after delete');
      queryClient.invalidateQueries({ queryKey: ROOMS_QUERY_KEY });
      toast.success(t('rooms.success.deleted'));
    },
    onError: (error: Error) => {
      logger.error('Failed to delete room', { error: error.message });
      toast.error(t('rooms.errors.deleteFailed'), {
        description: error.message,
      });
    },
  });
}

/**
 * Hook for bulk creating rooms
 *
 * Creates multiple rooms at once with automatic cache invalidation
 * and Farsi toast notifications
 *
 * @returns Mutation result with bulk create function
 */
export function useBulkCreateRooms() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (rooms: RoomFormValues[]) => roomsApi.bulkCreate(rooms),
    onSuccess: (_, variables) => {
      logger.debug('Invalidating rooms cache after bulk create');
      queryClient.invalidateQueries({ queryKey: ROOMS_QUERY_KEY });
      toast.success(t('rooms.success.bulkCreated', { count: variables.length }));
    },
    onError: (error: Error) => {
      logger.error('Failed to bulk create rooms', { error: error.message });
      toast.error(t('rooms.errors.bulkCreateFailed'), {
        description: error.message,
      });
    },
  });
}

export function useBulkDeleteRooms() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (ids: number[]) => roomsApi.bulkDelete(ids),
    onSuccess: ({ deletedIds }) => {
      queryClient.invalidateQueries({ queryKey: ROOMS_QUERY_KEY });
      toast.success(t('rooms.success.bulkDeleted', { count: deletedIds.length }));
    },
    onError: (error: Error) => {
      toast.error(t('rooms.errors.bulkDeleteFailed'), { description: error.message });
    },
  });
}
