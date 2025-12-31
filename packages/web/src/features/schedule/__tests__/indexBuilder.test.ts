/**
 * Unit tests for index builder edge cases
 * _Requirements: 3.6_
 */

import { describe, expect, it } from 'vitest';

import { DayOfWeek, type ScheduledLesson } from '../types';
import { buildIndexes, createEntitySlotKey, createSlotKey } from '../utils/indexBuilder';

describe('Index Builder Unit Tests', () => {
  describe('createSlotKey', () => {
    it('creates correct slot key format', () => {
      expect(createSlotKey('Monday', 2)).toBe('Monday-2');
      expect(createSlotKey(DayOfWeek.Saturday, 0)).toBe('Saturday-0');
    });
  });

  describe('createEntitySlotKey', () => {
    it('creates correct entity-slot key format', () => {
      expect(createEntitySlotKey('t1', 'Monday', 2)).toBe('t1-Monday-2');
      expect(createEntitySlotKey('class-1', DayOfWeek.Sunday, 5)).toBe('class-1-Sunday-5');
    });
  });

  describe('buildIndexes', () => {
    it('returns empty Maps for empty lessons array', () => {
      const indexes = buildIndexes([]);

      expect(indexes.bySlot.size).toBe(0);
      expect(indexes.byTeacherAndSlot.size).toBe(0);
      expect(indexes.byRoomAndSlot.size).toBe(0);
      expect(indexes.byClassAndSlot.size).toBe(0);
      expect(indexes.byTeacher.size).toBe(0);
      expect(indexes.byClass.size).toBe(0);
      expect(indexes.byRoom.size).toBe(0);
    });

    it('indexes a single lesson correctly', () => {
      const lesson: ScheduledLesson = {
        day: DayOfWeek.Monday,
        periodIndex: 2,
        classId: 'c1',
        className: 'Class 1',
        subjectId: 's1',
        subjectName: 'Math',
        teacherIds: ['t1'],
        teacherNames: ['Teacher 1'],
        roomId: 'r1',
        roomName: 'Room 1',
        isFixed: false,
        periodsThisDay: 6,
      };

      const indexes = buildIndexes([lesson]);

      // bySlot
      expect(indexes.bySlot.get('Monday-2')).toEqual([lesson]);

      // byClassAndSlot
      expect(indexes.byClassAndSlot.get('c1-Monday-2')).toBe(lesson);

      // byClass
      expect(indexes.byClass.get('c1')).toEqual([lesson]);

      // byTeacherAndSlot
      expect(indexes.byTeacherAndSlot.get('t1-Monday-2')).toBe(lesson);

      // byTeacher
      expect(indexes.byTeacher.get('t1')).toEqual([lesson]);

      // byRoomAndSlot
      expect(indexes.byRoomAndSlot.get('r1-Monday-2')).toBe(lesson);

      // byRoom
      expect(indexes.byRoom.get('r1')).toEqual([lesson]);
    });

    it('does not add lesson with null roomId to byRoom index', () => {
      const lesson: ScheduledLesson = {
        day: DayOfWeek.Tuesday,
        periodIndex: 1,
        classId: 'c2',
        className: 'Class 2',
        subjectId: 's2',
        subjectName: 'Science',
        teacherIds: ['t2'],
        teacherNames: ['Teacher 2'],
        roomId: null,
        roomName: null,
        isFixed: true,
        periodsThisDay: 5,
      };

      const indexes = buildIndexes([lesson]);

      // byRoom should be empty
      expect(indexes.byRoom.size).toBe(0);

      // byRoomAndSlot should be empty
      expect(indexes.byRoomAndSlot.size).toBe(0);

      // Other indexes should still work
      expect(indexes.bySlot.get('Tuesday-1')).toEqual([lesson]);
      expect(indexes.byClass.get('c2')).toEqual([lesson]);
      expect(indexes.byTeacher.get('t2')).toEqual([lesson]);
    });

    it('handles multiple lessons in the same slot', () => {
      const lesson1: ScheduledLesson = {
        day: DayOfWeek.Wednesday,
        periodIndex: 3,
        classId: 'c1',
        className: 'Class 1',
        subjectId: 's1',
        subjectName: 'Math',
        teacherIds: ['t1'],
        teacherNames: ['Teacher 1'],
        roomId: 'r1',
        roomName: 'Room 1',
        isFixed: false,
        periodsThisDay: 6,
      };

      const lesson2: ScheduledLesson = {
        day: DayOfWeek.Wednesday,
        periodIndex: 3,
        classId: 'c2',
        className: 'Class 2',
        subjectId: 's2',
        subjectName: 'Science',
        teacherIds: ['t2'],
        teacherNames: ['Teacher 2'],
        roomId: 'r2',
        roomName: 'Room 2',
        isFixed: false,
        periodsThisDay: 6,
      };

      const indexes = buildIndexes([lesson1, lesson2]);

      // bySlot should contain both lessons
      const slotLessons = indexes.bySlot.get('Wednesday-3');
      expect(slotLessons).toHaveLength(2);
      expect(slotLessons).toContain(lesson1);
      expect(slotLessons).toContain(lesson2);
    });
  });
});
