import { describe, expect, it } from 'vitest';

import { DayOfWeek, type ScheduledLesson } from '../types';
import { checkRoomTypeMismatch } from './constraintChecker';

const lesson: ScheduledLesson = {
  day: DayOfWeek.Saturday,
  periodIndex: 0,
  classId: 'class-1',
  className: 'Class 1',
  subjectId: 'subject-1',
  subjectName: 'Science',
  teacherIds: ['teacher-1'],
  teacherNames: ['Teacher 1'],
  roomId: 'room-1',
  roomName: 'Room 1',
  isFixed: false,
  periodsThisDay: 1,
};

const subjects = new Map([
  [
    'subject-1',
    {
      id: 'subject-1',
      requiredRoomType: 'laboratory',
      isDifficult: false,
    },
  ],
]);

const room = { id: 'room-1', type: 'normal' };

describe('fixed room override', () => {
  it('ignores room type validation for a fixed-room class', () => {
    expect(
      checkRoomTypeMismatch(lesson, room, subjects, {
        id: 'class-1',
        fixedRoomId: 'room-1',
      })
    ).toBeNull();
  });

  it('keeps room type validation for a non-fixed class', () => {
    expect(
      checkRoomTypeMismatch(lesson, room, subjects, {
        id: 'class-1',
        fixedRoomId: null,
      })?.type
    ).toBe('ROOM_TYPE_MISMATCH');
  });
});
