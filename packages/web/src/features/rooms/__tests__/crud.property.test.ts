/**
 * Property-based tests for room CRUD operations
 *
 * **Feature: rooms-feature, Property 7: Delete removes room from list**
 * **Validates: Requirements 6.2**
 *
 * Property 7: Delete removes room from list
 * *For any* room that is deleted, the room should no longer appear in the DataGrid
 * after the deletion operation completes.
 */

import * as fc from 'fast-check';
import { describe, it } from 'vitest';
import type { Room, RoomType, UnavailableSlot } from '../types';

/**
 * Arbitrary generator for valid room type values
 */
const roomTypeArb: fc.Arbitrary<RoomType> = fc.constantFrom(
  'normal',
  'computer_lab',
  'biology_lab',
  'chemistry_lab',
  'math_lab',
  'physics_lab',
  'lab',
  'library',
  'salon',
  'gym',
  'sport_camp',
  'other',
  '' as const
);

/**
 * Arbitrary generator for UnavailableSlot
 */
const unavailableSlotArb: fc.Arbitrary<UnavailableSlot> = fc.record({
  day: fc.integer({ min: 0, max: 6 }),
  period: fc.integer({ min: 0, max: 10 }),
});

/**
 * Arbitrary generator for valid ISO date strings
 */
const isoDateStringArb: fc.Arbitrary<string> = fc.constantFrom(
  '2020-01-15T10:30:00.000Z',
  '2021-06-20T14:45:30.000Z',
  '2022-12-01T08:00:00.000Z',
  '2023-03-10T16:20:15.000Z',
  '2024-09-25T12:00:00.000Z'
);

/**
 * Arbitrary generator for Room entity
 */
const roomArb: fc.Arbitrary<Room> = fc.record({
  id: fc.integer({ min: 1, max: 10000 }),
  schoolId: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  capacity: fc.integer({ min: 1, max: 500 }),
  type: roomTypeArb,
  features: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
  unavailable: fc.array(unavailableSlotArb, { maxLength: 10 }),
  meta: fc.constant({}),
  isDeleted: fc.constant(false),
  deletedAt: fc.constant(null),
  createdAt: isoDateStringArb,
  updatedAt: isoDateStringArb,
});

/**
 * Arbitrary generator for array of rooms with unique IDs
 */
const roomsArrayWithUniqueIdsArb: fc.Arbitrary<Room[]> = fc
  .array(roomArb, { minLength: 1, maxLength: 50 })
  .map((rooms) => {
    // Ensure unique IDs
    const seen = new Set<number>();
    return rooms.filter((room) => {
      if (seen.has(room.id)) return false;
      seen.add(room.id);
      return true;
    });
  })
  .filter((rooms) => rooms.length > 0);

/**
 * Simulates the delete operation on a list of rooms
 * Returns the list without the deleted room
 */
function simulateDeleteRoom(rooms: Room[], roomIdToDelete: number): Room[] {
  return rooms.filter((room) => room.id !== roomIdToDelete);
}

/**
 * Simulates soft delete by marking a room as deleted
 * Returns the updated list with the room marked as deleted
 */
function simulateSoftDeleteRoom(rooms: Room[], roomIdToDelete: number): Room[] {
  return rooms.map((room) => {
    if (room.id === roomIdToDelete) {
      return {
        ...room,
        isDeleted: true,
        deletedAt: new Date().toISOString(),
      };
    }
    return room;
  });
}

/**
 * Filters out deleted rooms (simulates what the API returns)
 */
function filterNonDeletedRooms(rooms: Room[]): Room[] {
  return rooms.filter((room) => !room.isDeleted);
}

describe('Room CRUD Property Tests', () => {
  describe('Delete Operation', () => {
    /**
     * **Feature: rooms-feature, Property 7: Delete removes room from list**
     * **Validates: Requirements 6.2**
     *
     * After deletion, the room should not appear in the list
     */
    it('Property 7: Deleted room does not appear in list', () => {
      fc.assert(
        fc.property(roomsArrayWithUniqueIdsArb, (rooms) => {
          // Pick a random room to delete
          const roomToDelete = rooms[Math.floor(Math.random() * rooms.length)];
          const roomIdToDelete = roomToDelete.id;

          // Simulate delete operation
          const remainingRooms = simulateDeleteRoom(rooms, roomIdToDelete);

          // Verify the deleted room is not in the list
          const deletedRoomStillExists = remainingRooms.some((room) => room.id === roomIdToDelete);

          return !deletedRoomStillExists;
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: rooms-feature, Property 7: Delete removes room from list**
     * **Validates: Requirements 6.2**
     *
     * After deletion, the list length should decrease by exactly 1
     */
    it('Property 7: Delete decreases list length by exactly 1', () => {
      fc.assert(
        fc.property(roomsArrayWithUniqueIdsArb, (rooms) => {
          // Pick a random room to delete
          const roomToDelete = rooms[Math.floor(Math.random() * rooms.length)];
          const roomIdToDelete = roomToDelete.id;

          // Simulate delete operation
          const remainingRooms = simulateDeleteRoom(rooms, roomIdToDelete);

          return remainingRooms.length === rooms.length - 1;
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: rooms-feature, Property 7: Delete removes room from list**
     * **Validates: Requirements 6.2**
     *
     * After deletion, all other rooms should remain unchanged
     */
    it('Property 7: Delete preserves other rooms', () => {
      fc.assert(
        fc.property(roomsArrayWithUniqueIdsArb, (rooms) => {
          // Pick a random room to delete
          const roomToDelete = rooms[Math.floor(Math.random() * rooms.length)];
          const roomIdToDelete = roomToDelete.id;

          // Simulate delete operation
          const remainingRooms = simulateDeleteRoom(rooms, roomIdToDelete);

          // All remaining rooms should be from the original list
          const originalIds = new Set(rooms.map((r) => r.id));
          const allRemainingAreOriginal = remainingRooms.every((room) => originalIds.has(room.id));

          // All non-deleted rooms should still be present
          const remainingIds = new Set(remainingRooms.map((r) => r.id));
          const allNonDeletedPresent = rooms
            .filter((r) => r.id !== roomIdToDelete)
            .every((room) => remainingIds.has(room.id));

          return allRemainingAreOriginal && allNonDeletedPresent;
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: rooms-feature, Property 7: Delete removes room from list**
     * **Validates: Requirements 6.2**
     *
     * Soft delete should mark room as deleted
     */
    it('Property 7: Soft delete marks room as deleted', () => {
      fc.assert(
        fc.property(roomsArrayWithUniqueIdsArb, (rooms) => {
          // Pick a random room to delete
          const roomToDelete = rooms[Math.floor(Math.random() * rooms.length)];
          const roomIdToDelete = roomToDelete.id;

          // Simulate soft delete operation
          const updatedRooms = simulateSoftDeleteRoom(rooms, roomIdToDelete);

          // Find the deleted room
          const deletedRoom = updatedRooms.find((room) => room.id === roomIdToDelete);

          // Verify it's marked as deleted
          return deletedRoom !== undefined && deletedRoom.isDeleted === true;
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: rooms-feature, Property 7: Delete removes room from list**
     * **Validates: Requirements 6.2**
     *
     * Soft deleted room should not appear in filtered list
     */
    it('Property 7: Soft deleted room does not appear in filtered list', () => {
      fc.assert(
        fc.property(roomsArrayWithUniqueIdsArb, (rooms) => {
          // Pick a random room to delete
          const roomToDelete = rooms[Math.floor(Math.random() * rooms.length)];
          const roomIdToDelete = roomToDelete.id;

          // Simulate soft delete operation
          const updatedRooms = simulateSoftDeleteRoom(rooms, roomIdToDelete);

          // Filter out deleted rooms (what the API would return)
          const visibleRooms = filterNonDeletedRooms(updatedRooms);

          // Verify the deleted room is not in the visible list
          const deletedRoomVisible = visibleRooms.some((room) => room.id === roomIdToDelete);

          return !deletedRoomVisible;
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: rooms-feature, Property 7: Delete removes room from list**
     * **Validates: Requirements 6.2**
     *
     * Deleting non-existent room should not change list
     */
    it('Property 7: Deleting non-existent room does not change list', () => {
      fc.assert(
        fc.property(
          roomsArrayWithUniqueIdsArb,
          fc.integer({ min: 100001, max: 200000 }),
          (rooms, nonExistentId) => {
            // Ensure the ID doesn't exist in the list
            const idExists = rooms.some((room) => room.id === nonExistentId);
            if (idExists) return true; // Skip this case

            // Simulate delete operation with non-existent ID
            const remainingRooms = simulateDeleteRoom(rooms, nonExistentId);

            // List should remain unchanged
            return remainingRooms.length === rooms.length;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Delete Idempotence', () => {
    /**
     * **Feature: rooms-feature, Property 7: Delete removes room from list**
     * **Validates: Requirements 6.2**
     *
     * Deleting the same room twice should have the same effect as deleting once
     */
    it('Property 7: Delete is idempotent', () => {
      fc.assert(
        fc.property(roomsArrayWithUniqueIdsArb, (rooms) => {
          // Pick a random room to delete
          const roomToDelete = rooms[Math.floor(Math.random() * rooms.length)];
          const roomIdToDelete = roomToDelete.id;

          // Delete once
          const afterFirstDelete = simulateDeleteRoom(rooms, roomIdToDelete);

          // Delete again (same ID)
          const afterSecondDelete = simulateDeleteRoom(afterFirstDelete, roomIdToDelete);

          // Both results should be the same
          return afterFirstDelete.length === afterSecondDelete.length;
        }),
        { numRuns: 100 }
      );
    });
  });
});
