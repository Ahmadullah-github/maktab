/**
 * Unit tests for schedule store
 * Requirements: 2.1, 2.6, 8.5
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_DISPLAY_SETTINGS } from '../constants';
import {
  createEmptyIndexes,
  getInitialScheduleState,
  useScheduleStore,
} from '../stores/scheduleStore';
import { DayOfWeek, type ScheduledLesson, type TimetableApiResponse } from '../types';

describe('Schedule Store Unit Tests', () => {
  // Reset store before each test
  beforeEach(() => {
    useScheduleStore.getState().clearSchedule();
  });

  /**
   * Test initial state has correct structure
   * Requirements: 2.1
   */
  describe('Initial State', () => {
    it('should have correct initial state structure', () => {
      const state = useScheduleStore.getState();

      expect(state.scheduleId).toBeNull();
      expect(state.scheduleName).toBe('');
      expect(state.lessons).toEqual([]);
      expect(state.indexes.bySlot).toBeInstanceOf(Map);
      expect(state.indexes.byTeacherAndSlot).toBeInstanceOf(Map);
      expect(state.indexes.byRoomAndSlot).toBeInstanceOf(Map);
      expect(state.indexes.byClassAndSlot).toBeInstanceOf(Map);
      expect(state.indexes.byTeacher).toBeInstanceOf(Map);
      expect(state.indexes.byClass).toBeInstanceOf(Map);
      expect(state.indexes.byRoom).toBeInstanceOf(Map);
      expect(state.metadata).toBeNull();
      expect(state.statistics).toBeNull();
      expect(state.teachers).toBeInstanceOf(Map);
      expect(state.rooms).toBeInstanceOf(Map);
      expect(state.classes).toBeInstanceOf(Map);
      expect(state.subjects).toBeInstanceOf(Map);
      expect(state.displaySettings).toEqual(DEFAULT_DISPLAY_SETTINGS);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('getInitialScheduleState should return correct initial state', () => {
      const initialState = getInitialScheduleState();

      expect(initialState.scheduleId).toBeNull();
      expect(initialState.scheduleName).toBe('');
      expect(initialState.lessons).toEqual([]);
      expect(initialState.displaySettings).toEqual(DEFAULT_DISPLAY_SETTINGS);
      expect(initialState.isLoading).toBe(false);
      expect(initialState.error).toBeNull();
    });

    it('createEmptyIndexes should return empty Maps', () => {
      const indexes = createEmptyIndexes();

      expect(indexes.bySlot.size).toBe(0);
      expect(indexes.byTeacherAndSlot.size).toBe(0);
      expect(indexes.byRoomAndSlot.size).toBe(0);
      expect(indexes.byClassAndSlot.size).toBe(0);
      expect(indexes.byTeacher.size).toBe(0);
      expect(indexes.byClass.size).toBe(0);
      expect(indexes.byRoom.size).toBe(0);
    });
  });

  /**
   * Test loadSchedule error handling
   * Requirements: 2.6
   */
  describe('loadSchedule Error Handling', () => {
    it('should set error field when fetch fails', async () => {
      const errorMessage = 'Network error';
      const mockFetch = vi.fn().mockRejectedValue(new Error(errorMessage));

      await useScheduleStore.getState().loadSchedule(1, mockFetch);

      const state = useScheduleStore.getState();
      expect(state.error).toBe(errorMessage);
      expect(state.isLoading).toBe(false);
    });

    it('should set error field when transform fails', async () => {
      const mockResponse: TimetableApiResponse = {
        id: 1,
        name: 'Test Schedule',
        description: 'Test',
        data: 'invalid json{',
        schoolId: null,
        academicYearId: null,
        termId: null,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };
      const mockFetch = vi.fn().mockResolvedValue(mockResponse);

      await useScheduleStore.getState().loadSchedule(1, mockFetch);

      const state = useScheduleStore.getState();
      expect(state.error).toContain('Failed to parse schedule data');
      expect(state.isLoading).toBe(false);
    });

    it('should set isLoading to true during fetch', async () => {
      let loadingDuringFetch = false;
      const mockFetch = vi.fn().mockImplementation(async () => {
        loadingDuringFetch = useScheduleStore.getState().isLoading;
        throw new Error('Test error');
      });

      await useScheduleStore.getState().loadSchedule(1, mockFetch);

      expect(loadingDuringFetch).toBe(true);
    });
  });

  /**
   * Test clearSchedule resets to initial state
   * Requirements: 2.3
   */
  describe('clearSchedule', () => {
    it('should reset all state fields to initial values', () => {
      // Set some state
      useScheduleStore.setState({
        scheduleId: 123,
        scheduleName: 'Test Schedule',
        isLoading: true,
        error: 'Some error',
      });

      // Clear the schedule
      useScheduleStore.getState().clearSchedule();

      // Verify reset
      const state = useScheduleStore.getState();
      expect(state.scheduleId).toBeNull();
      expect(state.scheduleName).toBe('');
      expect(state.lessons).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  /**
   * Test setDisplaySettings
   */
  describe('setDisplaySettings', () => {
    it('should update display settings partially', () => {
      useScheduleStore.getState().setDisplaySettings({ showRoomName: true });

      const state = useScheduleStore.getState();
      expect(state.displaySettings.showRoomName).toBe(true);
      expect(state.displaySettings.showSubjectName).toBe(true); // unchanged
      expect(state.displaySettings.showTeacherName).toBe(true); // unchanged
    });

    it('should update multiple display settings at once', () => {
      useScheduleStore.getState().setDisplaySettings({
        cellSize: 'large',
        fontSize: 'lg',
      });

      const state = useScheduleStore.getState();
      expect(state.displaySettings.cellSize).toBe('large');
      expect(state.displaySettings.fontSize).toBe('lg');
    });
  });

  /**
   * Test successful loadSchedule
   */
  describe('loadSchedule Success', () => {
    it('should load and transform schedule data correctly', async () => {
      const mockResponse: TimetableApiResponse = {
        id: 1,
        name: 'Test Schedule',
        description: 'Test',
        data: JSON.stringify({
          schedule: [
            {
              day: 'Monday',
              periodIndex: 0,
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
            },
          ],
          metadata: {
            classes: [
              {
                classId: 'c1',
                className: 'Class 1',
                gradeLevel: 1,
                category: 'ALPHA_PRIMARY',
                categoryDari: 'ابتدایی الف',
                studentCount: 30,
                singleTeacherMode: true,
                classTeacherId: 't1',
                classTeacherName: 'Teacher 1',
                classTeacherSubjects: ['s1'],
              },
            ],
            subjects: [
              {
                subjectId: 's1',
                subjectName: 'Math',
                isCustom: false,
                customCategory: null,
                customCategoryDari: null,
              },
            ],
            teachers: [
              {
                teacherId: 't1',
                teacherName: 'Teacher 1',
                primarySubjects: ['s1'],
                maxPeriodsPerWeek: 30,
                classTeacherOf: ['c1'],
              },
            ],
            periodConfiguration: {
              periodsPerDayMap: { Monday: 6 },
              totalPeriodsPerWeek: 30,
              daysOfWeek: ['Monday'],
              hasVariablePeriods: false,
            },
          },
          statistics: {
            totalClasses: 1,
            singleTeacherClasses: 1,
            multiTeacherClasses: 0,
            totalSubjects: 1,
            customSubjects: 0,
            standardSubjects: 1,
            totalTeachers: 1,
            totalRooms: 1,
            categoryCounts: { ALPHA_PRIMARY: 1 },
            customSubjectsByCategory: {},
            totalLessons: 1,
            periodsPerWeek: 30,
            solveTimeSeconds: 1.5,
            strategy: 'balanced',
            numConstraintsApplied: 10,
            qualityScore: 95,
          },
        }),
        schoolId: null,
        academicYearId: null,
        termId: null,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };
      const mockFetch = vi.fn().mockResolvedValue(mockResponse);

      await useScheduleStore.getState().loadSchedule(1, mockFetch);

      const state = useScheduleStore.getState();
      expect(state.scheduleId).toBe(1);
      expect(state.scheduleName).toBe('Test Schedule');
      expect(state.lessons).toHaveLength(1);
      expect(state.lessons[0].classId).toBe('c1');
      expect(state.metadata).not.toBeNull();
      expect(state.statistics).not.toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();

      // Check entity maps
      expect(state.teachers.has('t1')).toBe(true);
      expect(state.classes.has('c1')).toBe(true);
      expect(state.subjects.has('s1')).toBe(true);
      expect(state.rooms.has('r1')).toBe(true);

      // Check indexes
      expect(state.indexes.bySlot.has('Monday-0')).toBe(true);
      expect(state.indexes.byClass.has('c1')).toBe(true);
      expect(state.indexes.byTeacher.has('t1')).toBe(true);
      expect(state.indexes.byRoom.has('r1')).toBe(true);
    });
  });

  /**
   * Test interaction state actions
   * Requirements: 8.5
   */
  describe('Interaction State Actions', () => {
    // Sample lesson for testing
    const sampleLesson: ScheduledLesson = {
      day: DayOfWeek.Monday,
      periodIndex: 0,
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

    describe('setFocusedSlot', () => {
      it('should update focusedSlot state correctly', () => {
        const slot = { day: DayOfWeek.Monday, period: 2 };
        useScheduleStore.getState().setFocusedSlot(slot);

        const state = useScheduleStore.getState();
        expect(state.focusedSlot).toEqual(slot);
      });

      it('should set focusedSlot to null', () => {
        // First set a slot
        useScheduleStore.getState().setFocusedSlot({ day: DayOfWeek.Monday, period: 2 });
        // Then clear it
        useScheduleStore.getState().setFocusedSlot(null);

        const state = useScheduleStore.getState();
        expect(state.focusedSlot).toBeNull();
      });

      it('should update focusedSlot to different values', () => {
        useScheduleStore.getState().setFocusedSlot({ day: DayOfWeek.Monday, period: 0 });
        expect(useScheduleStore.getState().focusedSlot).toEqual({
          day: DayOfWeek.Monday,
          period: 0,
        });

        useScheduleStore.getState().setFocusedSlot({ day: DayOfWeek.Tuesday, period: 3 });
        expect(useScheduleStore.getState().focusedSlot).toEqual({
          day: DayOfWeek.Tuesday,
          period: 3,
        });
      });
    });

    describe('selectLesson', () => {
      it('should set selectedLesson and change mode to selecting', () => {
        useScheduleStore.getState().selectLesson(sampleLesson);

        const state = useScheduleStore.getState();
        expect(state.selectedLesson).toEqual(sampleLesson);
        expect(state.interactionMode).toBe('selecting');
      });

      it('should set selectedLesson to null and change mode to idle', () => {
        // First select a lesson
        useScheduleStore.getState().selectLesson(sampleLesson);
        // Then deselect
        useScheduleStore.getState().selectLesson(null);

        const state = useScheduleStore.getState();
        expect(state.selectedLesson).toBeNull();
        expect(state.interactionMode).toBe('idle');
      });

      it('should replace previous selection with new selection', () => {
        const anotherLesson: ScheduledLesson = {
          ...sampleLesson,
          classId: 'c2',
          subjectId: 's2',
        };

        useScheduleStore.getState().selectLesson(sampleLesson);
        useScheduleStore.getState().selectLesson(anotherLesson);

        const state = useScheduleStore.getState();
        expect(state.selectedLesson).toEqual(anotherLesson);
        expect(state.interactionMode).toBe('selecting');
      });
    });

    describe('cancelSelection', () => {
      it('should reset selectedLesson to null and mode to idle', () => {
        // First select a lesson
        useScheduleStore.getState().selectLesson(sampleLesson);
        // Then cancel
        useScheduleStore.getState().cancelSelection();

        const state = useScheduleStore.getState();
        expect(state.selectedLesson).toBeNull();
        expect(state.interactionMode).toBe('idle');
      });

      it('should work even when no lesson is selected', () => {
        useScheduleStore.getState().cancelSelection();

        const state = useScheduleStore.getState();
        expect(state.selectedLesson).toBeNull();
        expect(state.interactionMode).toBe('idle');
      });
    });

    describe('setLocked', () => {
      it('should set isLocked to true', () => {
        useScheduleStore.getState().setLocked(true);

        const state = useScheduleStore.getState();
        expect(state.isLocked).toBe(true);
      });

      it('should set isLocked to false', () => {
        // First lock
        useScheduleStore.getState().setLocked(true);
        // Then unlock
        useScheduleStore.getState().setLocked(false);

        const state = useScheduleStore.getState();
        expect(state.isLocked).toBe(false);
      });

      it('should toggle lock state correctly', () => {
        expect(useScheduleStore.getState().isLocked).toBe(false);

        useScheduleStore.getState().setLocked(true);
        expect(useScheduleStore.getState().isLocked).toBe(true);

        useScheduleStore.getState().setLocked(false);
        expect(useScheduleStore.getState().isLocked).toBe(false);
      });
    });

    describe('clearSchedule resets interaction state', () => {
      it('should reset all interaction state fields', () => {
        // Set up some interaction state
        useScheduleStore.getState().setFocusedSlot({ day: DayOfWeek.Monday, period: 2 });
        useScheduleStore.getState().selectLesson(sampleLesson);
        useScheduleStore.getState().setLocked(true);

        // Clear the schedule
        useScheduleStore.getState().clearSchedule();

        // Verify interaction state is reset
        const state = useScheduleStore.getState();
        expect(state.interactionMode).toBe('idle');
        expect(state.focusedSlot).toBeNull();
        expect(state.selectedLesson).toBeNull();
        expect(state.isLocked).toBe(false);
      });
    });

    describe('getInitialScheduleState includes interaction state', () => {
      it('should return initial interaction state values', () => {
        const initialState = getInitialScheduleState();

        expect(initialState.interactionMode).toBe('idle');
        expect(initialState.focusedSlot).toBeNull();
        expect(initialState.selectedLesson).toBeNull();
        expect(initialState.isLocked).toBe(false);
      });
    });
  });
});
