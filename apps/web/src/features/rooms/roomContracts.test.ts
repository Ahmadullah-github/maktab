import { describe, expect, it } from 'vitest';

import { DEFAULT_ROOM_TYPES } from '@/constants/roomTypes';
import { roomSchema } from '@/schemas/room.schema';
import {
  RoomAvailabilityDataError,
  deserializeRoom,
  parseUnavailableSlots,
  serializeRoomForApi,
} from './utils/serialization';

describe('room client contracts', () => {
  it('keeps the physical room type required and accepts dynamic slugs', () => {
    expect(DEFAULT_ROOM_TYPES).toHaveLength(12);
    expect(DEFAULT_ROOM_TYPES.some((roomType) => roomType.value === '')).toBe(false);

    expect(
      roomSchema.safeParse({
        name: 'Robotics Hall',
        capacity: 20,
        type: 'robotics_lab',
        features: [],
      }).success
    ).toBe(true);
    expect(
      roomSchema.safeParse({
        name: 'Missing type',
        capacity: 20,
        type: '',
        features: [],
      }).success
    ).toBe(false);
  });

  it('decodes numeric legacy weekdays into canonical weekday strings', () => {
    expect(parseUnavailableSlots('[{"day":0,"period":2}]')).toEqual([
      { day: 'Saturday', period: 2 },
    ]);
  });

  it('surfaces corrupt persisted availability instead of silently erasing it', () => {
    expect(() => parseUnavailableSlots('{"day":"Saturday"}')).toThrow(
      RoomAvailabilityDataError
    );
    expect(() => parseUnavailableSlots('[{"day":"Funday","period":1}]')).toThrow(
      /valid weekday/
    );
    expect(() =>
      deserializeRoom({
        id: 1,
        schoolId: null,
        name: 'Corrupt room',
        normalizedName: 'corrupt room',
        capacity: 20,
        type: 'normal',
        features: [],
        unavailable: 'not-json',
        meta: {},
        isDeleted: false,
        deletedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    ).toThrow(RoomAvailabilityDataError);
  });

  it('writes canonical arrays and weekday strings to the API', () => {
    expect(
      serializeRoomForApi({
        name: 'Room 1',
        capacity: 20,
        type: 'normal',
        features: ['projector'],
        unavailable: [{ day: 'Sunday', period: 1 }],
      })
    ).toEqual({
      name: 'Room 1',
      capacity: 20,
      type: 'normal',
      features: ['projector'],
      unavailable: [{ day: 'Sunday', period: 1 }],
    });
  });
});
