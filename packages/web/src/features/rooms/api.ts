/**
 * API functions for Rooms CRUD operations
 *
 * Handles communication with the /api/rooms endpoint,
 * including serialization/deserialization of complex fields
 *
 * Requirements: 1.1, 4.2, 5.2, 6.2
 */

import { api } from '@/lib/api';
import type { Room, RoomFormValues, RoomResponse } from './types';
import { apiLogger, logger } from './utils/logger';
import { deserializeRoom, serializeRoomForApi } from './utils/serialization';

/**
 * Rooms API client
 *
 * Provides typed methods for all CRUD operations on rooms
 * with automatic serialization/deserialization and debug logging
 */
export const roomsApi = {
  /**
   * Fetches all non-deleted rooms
   * Requirements: 1.1
   */
  async getAll(): Promise<Room[]> {
    apiLogger.request('GET', '/rooms');

    try {
      const response = (await api.rooms.list()) as RoomResponse[];
      const rooms = response.map(deserializeRoom);

      apiLogger.response('GET', '/rooms', 200, { count: rooms.length });
      logger.debug('Fetched all rooms', { count: rooms.length });

      return rooms;
    } catch (error) {
      apiLogger.error('GET', '/rooms', error);
      throw error;
    }
  },

  /**
   * Fetches a single room by ID
   * Requirements: 1.1
   */
  async getById(id: number): Promise<Room> {
    apiLogger.request('GET', `/rooms/${id}`);

    try {
      const response = (await api.rooms.get(id)) as RoomResponse;
      const room = deserializeRoom(response);

      apiLogger.response('GET', `/rooms/${id}`, 200, { id: room.id });
      logger.debug('Fetched room', { id, name: room.name });

      return room;
    } catch (error) {
      apiLogger.error('GET', `/rooms/${id}`, error);
      throw error;
    }
  },

  /**
   * Creates a new room
   * Requirements: 4.2
   */
  async create(data: RoomFormValues): Promise<Room> {
    const payload = serializeRoomForApi(data);
    apiLogger.request('POST', '/rooms', payload);

    try {
      const response = (await api.rooms.create(payload)) as RoomResponse;
      const room = deserializeRoom(response);

      apiLogger.response('POST', '/rooms', 201, { id: room.id });
      logger.info('Room created', { id: room.id, name: room.name });

      return room;
    } catch (error) {
      apiLogger.error('POST', '/rooms', error);
      throw error;
    }
  },

  /**
   * Updates an existing room
   * Requirements: 5.2
   */
  async update(id: number, data: Partial<RoomFormValues>): Promise<Room> {
    const payload = serializeRoomForApi(data);
    apiLogger.request('PUT', `/rooms/${id}`, payload);

    try {
      const response = (await api.rooms.update(id, payload)) as RoomResponse;
      const room = deserializeRoom(response);

      apiLogger.response('PUT', `/rooms/${id}`, 200, { id: room.id });
      logger.info('Room updated', { id: room.id, name: room.name });

      return room;
    } catch (error) {
      apiLogger.error('PUT', `/rooms/${id}`, error);
      throw error;
    }
  },

  /**
   * Deletes a room (soft delete)
   * Requirements: 6.2
   */
  async delete(id: number): Promise<void> {
    apiLogger.request('DELETE', `/rooms/${id}`);

    try {
      await api.rooms.delete(id);

      apiLogger.response('DELETE', `/rooms/${id}`, 200);
      logger.info('Room deleted', { id });
    } catch (error) {
      apiLogger.error('DELETE', `/rooms/${id}`, error);
      throw error;
    }
  },

  async bulkDelete(ids: number[]): Promise<{ deletedIds: number[] }> {
    apiLogger.request('POST', '/rooms/bulk-delete', { ids });
    const response = await api.rooms.bulkDelete(ids);
    apiLogger.response('POST', '/rooms/bulk-delete', 200, response);
    return response;
  },

  /**
   * Bulk creates multiple rooms at once
   */
  async bulkCreate(rooms: RoomFormValues[]): Promise<Room[]> {
    const payload = rooms.map(serializeRoomForApi);
    apiLogger.request('POST', '/rooms/bulk', { count: payload.length });

    try {
      const response = (await api.rooms.bulkCreate(payload)) as RoomResponse[];
      const createdRooms = response.map(deserializeRoom);

      apiLogger.response('POST', '/rooms/bulk', 201, { count: createdRooms.length });
      logger.info('Rooms bulk created', { count: createdRooms.length });

      return createdRooms;
    } catch (error) {
      apiLogger.error('POST', '/rooms/bulk', error);
      throw error;
    }
  },
};
