/**
 * Unit tests for SwapConstraintGatherer
 *
 * Tests constraint gathering and transformation including:
 * - Parallel database queries
 * - Entity transformation
 * - JSON parsing
 * - Caching integration
 * - Error handling
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Room } from '../../entity/Room';
import { Subject } from '../../entity/Subject';
import { Teacher } from '../../entity/Teacher';
import { TeacherClassSubjectAssignment } from '../../entity/TeacherClassSubjectAssignment';
import { Timetable } from '../../entity/Timetable';
import { swapConstraintCache } from '../SwapConstraintCache';
import { SwapConstraintGatherer } from '../SwapConstraintGatherer';

// Mock TypeORM entities
vi.mock('../../entity/Teacher');
vi.mock('../../entity/Subject');
vi.mock('../../entity/Room');
vi.mock('../../entity/ClassGroup');
vi.mock('../../entity/TeacherClassSubjectAssignment');
vi.mock('../../entity/Timetable');

describe('SwapConstraintGatherer', () => {
  let gatherer: SwapConstraintGatherer;

  beforeEach(() => {
    gatherer = new SwapConstraintGatherer();
    swapConstraintCache.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    swapConstraintCache.clear();
  });

  // Mock data factories
  const createMockTeacher = (id: number): Partial<Teacher> => ({
    id,
    name: `Teacher ${id}`,
    availability: JSON.stringify({
      Saturday: [true, true, true, true, true, true, true],
      Sunday: [true, true, true, true, true, true, true],
    }),
    timePreference: 'Morning',
    maxConsecutivePeriods: 4,
    maxPeriodsPerWeek: 30,
    isDeleted: false,
  });

  const createMockSubject = (id: number): Partial<Subject> => ({
    id,
    name: `Subject ${id}`,
    requiredRoomType: null,
    isDifficult: false,
    minRoomCapacity: 0,
    isDeleted: false,
  });

  const createMockRoom = (id: number): Partial<Room> => ({
    id,
    name: `Room ${id}`,
    type: 'normal',
    capacity: 30,
    features: JSON.stringify(['whiteboard']),
    unavailable: JSON.stringify({}),
    isDeleted: false,
  });

  const createMockAssignment = (
    id: number,
    teacherId: number,
    classId: number,
    subjectId: number
  ): Partial<TeacherClassSubjectAssignment> => ({
    id,
    teacherId,
    classId,
    subjectId,
    periodsPerWeek: 2,
    isFixed: true,
    isDeleted: false,
  });

  const createMockTimetable = (id: number): Partial<Timetable> => ({
    id,
    name: `Timetable ${id}`,
    data: JSON.stringify({
      lessons: [
        {
          classId: '1',
          day: 'Saturday',
          periodIndex: 0,
          subjectId: '1',
          teacherId: '1',
          roomId: '1',
        },
      ],
      periodsPerDay: {
        Saturday: 7,
        Sunday: 7,
        Monday: 7,
        Tuesday: 7,
        Wednesday: 7,
        Thursday: 4,
      },
      daysOfWeek: ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
    }),
    isDeleted: false,
  });

  describe('gatherConstraints', () => {
    it('should gather and transform all constraint data', async () => {
      const timetableId = 1;

      // Mock database responses
      vi.mocked(Timetable.findOne).mockResolvedValue(createMockTimetable(timetableId) as Timetable);
      vi.mocked(Teacher.find).mockResolvedValue([createMockTeacher(1)] as Teacher[]);
      vi.mocked(Subject.find).mockResolvedValue([createMockSubject(1)] as Subject[]);
      vi.mocked(Room.find).mockResolvedValue([createMockRoom(1)] as Room[]);
      vi.mocked(TeacherClassSubjectAssignment.find).mockResolvedValue([
        createMockAssignment(1, 1, 1, 1),
      ] as TeacherClassSubjectAssignment[]);

      const result = await gatherer.gatherConstraints(timetableId);

      expect(result).toBeDefined();
      expect(result.teachers).toHaveLength(1);
      expect(result.subjects).toHaveLength(1);
      expect(result.rooms).toHaveLength(1);
      expect(result.assignments).toHaveLength(1);
      expect(result.scheduledLessons).toHaveLength(1);
      expect(result.timetableData.lessons).toHaveLength(1);
      expect(result.cachedAt).toBeInstanceOf(Date);
    });

    it('should use cached data on second call', async () => {
      const timetableId = 1;

      // Mock database responses
      vi.mocked(Timetable.findOne).mockResolvedValue(createMockTimetable(timetableId) as Timetable);
      vi.mocked(Teacher.find).mockResolvedValue([createMockTeacher(1)] as Teacher[]);
      vi.mocked(Subject.find).mockResolvedValue([createMockSubject(1)] as Subject[]);
      vi.mocked(Room.find).mockResolvedValue([createMockRoom(1)] as Room[]);
      vi.mocked(TeacherClassSubjectAssignment.find).mockResolvedValue([
        createMockAssignment(1, 1, 1, 1),
      ] as TeacherClassSubjectAssignment[]);

      // First call - should query database
      await gatherer.gatherConstraints(timetableId);

      // Second call - should use cache
      await gatherer.gatherConstraints(timetableId);

      // Database should only be queried once
      expect(Timetable.findOne).toHaveBeenCalledTimes(1);
      expect(Teacher.find).toHaveBeenCalledTimes(1);
    });

    it('should throw error if timetable not found', async () => {
      const timetableId = 999;

      vi.mocked(Timetable.findOne).mockResolvedValue(null);

      await expect(gatherer.gatherConstraints(timetableId)).rejects.toThrow(
        'Timetable 999 not found'
      );
    });

    it('should execute database queries in parallel', async () => {
      const timetableId = 1;
      const queryTimes: number[] = [];

      // Track when each query is called
      vi.mocked(Timetable.findOne).mockImplementation(async () => {
        queryTimes.push(Date.now());
        return createMockTimetable(timetableId) as Timetable;
      });
      vi.mocked(Teacher.find).mockImplementation(async () => {
        queryTimes.push(Date.now());
        return [createMockTeacher(1)] as Teacher[];
      });
      vi.mocked(Subject.find).mockImplementation(async () => {
        queryTimes.push(Date.now());
        return [createMockSubject(1)] as Subject[];
      });
      vi.mocked(Room.find).mockImplementation(async () => {
        queryTimes.push(Date.now());
        return [createMockRoom(1)] as Room[];
      });
      vi.mocked(TeacherClassSubjectAssignment.find).mockImplementation(async () => {
        queryTimes.push(Date.now());
        return [createMockAssignment(1, 1, 1, 1)] as TeacherClassSubjectAssignment[];
      });

      await gatherer.gatherConstraints(timetableId);

      // All queries should be called
      expect(queryTimes).toHaveLength(5);

      // Queries should start within a short time window (parallel execution)
      const maxTimeDiff = Math.max(...queryTimes) - Math.min(...queryTimes);
      expect(maxTimeDiff).toBeLessThan(100); // Within 100ms
    });
  });

  describe('Teacher Transformation', () => {
    it('should transform teacher with all fields', async () => {
      const timetableId = 1;

      vi.mocked(Timetable.findOne).mockResolvedValue(createMockTimetable(timetableId) as Timetable);
      vi.mocked(Teacher.find).mockResolvedValue([
        {
          ...createMockTeacher(1),
          availability: JSON.stringify({
            Saturday: [true, false, true, false, true, false, true],
          }),
          timePreference: 'Afternoon',
          maxConsecutivePeriods: 3,
          maxPeriodsPerWeek: 25,
        },
      ] as Teacher[]);
      vi.mocked(Subject.find).mockResolvedValue([]);
      vi.mocked(Room.find).mockResolvedValue([]);
      vi.mocked(TeacherClassSubjectAssignment.find).mockResolvedValue([]);

      const result = await gatherer.gatherConstraints(timetableId);

      expect(result.teachers[0]).toEqual(
        expect.objectContaining({
        id: '1',
        availability: {
          Saturday: [true, false, true, false, true, false, true],
        },
        timePreference: 'Afternoon',
        maxConsecutivePeriods: 3,
        maxPeriodsPerWeek: 25,
        })
      );
    });

    it('should use defaults for missing teacher fields', async () => {
      const timetableId = 1;

      vi.mocked(Timetable.findOne).mockResolvedValue(createMockTimetable(timetableId) as Timetable);
      vi.mocked(Teacher.find).mockResolvedValue([
        {
          id: 1,
          name: 'Teacher 1',
          availability: null,
          timePreference: null,
          maxConsecutivePeriods: null,
          maxPeriodsPerWeek: null,
          isDeleted: false,
        },
      ] as Teacher[]);
      vi.mocked(Subject.find).mockResolvedValue([]);
      vi.mocked(Room.find).mockResolvedValue([]);
      vi.mocked(TeacherClassSubjectAssignment.find).mockResolvedValue([]);

      const result = await gatherer.gatherConstraints(timetableId);

      expect(result.teachers[0].timePreference).toBe('None');
      expect(result.teachers[0].maxConsecutivePeriods).toBe(4);
      expect(result.teachers[0].maxPeriodsPerWeek).toBe(30);
      expect(result.teachers[0].availability).toBeDefined();
    });

    it('should handle invalid availability JSON', async () => {
      const timetableId = 1;

      vi.mocked(Timetable.findOne).mockResolvedValue(createMockTimetable(timetableId) as Timetable);
      vi.mocked(Teacher.find).mockResolvedValue([
        {
          ...createMockTeacher(1),
          availability: 'invalid json',
        },
      ] as Teacher[]);
      vi.mocked(Subject.find).mockResolvedValue([]);
      vi.mocked(Room.find).mockResolvedValue([]);
      vi.mocked(TeacherClassSubjectAssignment.find).mockResolvedValue([]);

      const result = await gatherer.gatherConstraints(timetableId);

      // Should use default availability
      expect(result.teachers[0].availability).toBeDefined();
      expect(result.teachers[0].availability.Saturday).toBeDefined();
    });
  });

  describe('Subject Transformation', () => {
    it('should transform subject with all fields', async () => {
      const timetableId = 1;

      vi.mocked(Timetable.findOne).mockResolvedValue(createMockTimetable(timetableId) as Timetable);
      vi.mocked(Teacher.find).mockResolvedValue([]);
      vi.mocked(Subject.find).mockResolvedValue([
        {
          ...createMockSubject(1),
          requiredRoomType: 'lab',
          isDifficult: true,
          minRoomCapacity: 25,
        },
      ] as Subject[]);
      vi.mocked(Room.find).mockResolvedValue([]);
      vi.mocked(TeacherClassSubjectAssignment.find).mockResolvedValue([]);

      const result = await gatherer.gatherConstraints(timetableId);

      expect(result.subjects[0]).toEqual(
        expect.objectContaining({
        id: '1',
        requiredRoomType: 'lab',
        isDifficult: true,
        minRoomCapacity: 25,
        })
      );
    });

    it('should use defaults for missing subject fields', async () => {
      const timetableId = 1;

      vi.mocked(Timetable.findOne).mockResolvedValue(createMockTimetable(timetableId) as Timetable);
      vi.mocked(Teacher.find).mockResolvedValue([]);
      vi.mocked(Subject.find).mockResolvedValue([
        {
          id: 1,
          name: 'Subject 1',
          requiredRoomType: null,
          isDifficult: null,
          minRoomCapacity: null,
          isDeleted: false,
        },
      ] as Subject[]);
      vi.mocked(Room.find).mockResolvedValue([]);
      vi.mocked(TeacherClassSubjectAssignment.find).mockResolvedValue([]);

      const result = await gatherer.gatherConstraints(timetableId);

      expect(result.subjects[0].requiredRoomType).toBeNull();
      expect(result.subjects[0].isDifficult).toBe(false);
      expect(result.subjects[0].minRoomCapacity).toBe(0);
    });
  });

  describe('Room Transformation', () => {
    it('should transform room with all fields', async () => {
      const timetableId = 1;

      vi.mocked(Timetable.findOne).mockResolvedValue(createMockTimetable(timetableId) as Timetable);
      vi.mocked(Teacher.find).mockResolvedValue([]);
      vi.mocked(Subject.find).mockResolvedValue([]);
      vi.mocked(Room.find).mockResolvedValue([
        {
          ...createMockRoom(1),
          type: 'lab',
          capacity: 25,
          features: JSON.stringify(['projector', 'computers']),
          unavailable: JSON.stringify({
            Saturday: [false, false, true, false, false, false, false],
          }),
        },
      ] as Room[]);
      vi.mocked(TeacherClassSubjectAssignment.find).mockResolvedValue([]);

      const result = await gatherer.gatherConstraints(timetableId);

      expect(result.rooms[0]).toEqual(
        expect.objectContaining({
        id: '1',
        type: 'lab',
        capacity: 25,
        features: ['projector', 'computers'],
        unavailable: { Saturday: [false, false, true, false, false, false, false] },
        })
      );
    });

    it('should handle invalid features JSON', async () => {
      const timetableId = 1;

      vi.mocked(Timetable.findOne).mockResolvedValue(createMockTimetable(timetableId) as Timetable);
      vi.mocked(Teacher.find).mockResolvedValue([]);
      vi.mocked(Subject.find).mockResolvedValue([]);
      vi.mocked(Room.find).mockResolvedValue([
        {
          ...createMockRoom(1),
          features: 'invalid json',
        },
      ] as Room[]);
      vi.mocked(TeacherClassSubjectAssignment.find).mockResolvedValue([]);

      const result = await gatherer.gatherConstraints(timetableId);

      expect(result.rooms[0].features).toEqual([]);
    });

    it('should handle invalid unavailable JSON', async () => {
      const timetableId = 1;

      vi.mocked(Timetable.findOne).mockResolvedValue(createMockTimetable(timetableId) as Timetable);
      vi.mocked(Teacher.find).mockResolvedValue([]);
      vi.mocked(Subject.find).mockResolvedValue([]);
      vi.mocked(Room.find).mockResolvedValue([
        {
          ...createMockRoom(1),
          unavailable: 'invalid json',
        },
      ] as Room[]);
      vi.mocked(TeacherClassSubjectAssignment.find).mockResolvedValue([]);

      const result = await gatherer.gatherConstraints(timetableId);

      expect(result.rooms[0].unavailable).toEqual({});
    });
  });

  describe('Assignment Transformation', () => {
    it('should transform assignment with all fields', async () => {
      const timetableId = 1;

      vi.mocked(Timetable.findOne).mockResolvedValue(createMockTimetable(timetableId) as Timetable);
      vi.mocked(Teacher.find).mockResolvedValue([]);
      vi.mocked(Subject.find).mockResolvedValue([]);
      vi.mocked(Room.find).mockResolvedValue([]);
      vi.mocked(TeacherClassSubjectAssignment.find).mockResolvedValue([
        {
          ...createMockAssignment(1, 5, 10, 15),
          isFixed: false,
        },
      ] as TeacherClassSubjectAssignment[]);

      const result = await gatherer.gatherConstraints(timetableId);

      expect(result.assignments[0]).toEqual({
        teacherId: '5',
        classId: '10',
        subjectId: '15',
        isFixed: false,
      });
    });
  });

  describe('Timetable Data Parsing', () => {
    it('should parse valid timetable data', async () => {
      const timetableId = 1;

      vi.mocked(Timetable.findOne).mockResolvedValue(createMockTimetable(timetableId) as Timetable);
      vi.mocked(Teacher.find).mockResolvedValue([]);
      vi.mocked(Subject.find).mockResolvedValue([]);
      vi.mocked(Room.find).mockResolvedValue([]);
      vi.mocked(TeacherClassSubjectAssignment.find).mockResolvedValue([]);

      const result = await gatherer.gatherConstraints(timetableId);

      expect(result.timetableData.lessons).toHaveLength(1);
      expect(result.timetableData.periodsPerDay.Saturday).toBe(7);
      expect(result.timetableData.daysOfWeek).toHaveLength(6);
    });

    it('should use defaults for invalid timetable JSON', async () => {
      const timetableId = 1;

      vi.mocked(Timetable.findOne).mockResolvedValue({
        ...createMockTimetable(timetableId),
        data: 'invalid json',
      } as Timetable);
      vi.mocked(Teacher.find).mockResolvedValue([]);
      vi.mocked(Subject.find).mockResolvedValue([]);
      vi.mocked(Room.find).mockResolvedValue([]);
      vi.mocked(TeacherClassSubjectAssignment.find).mockResolvedValue([]);

      const result = await gatherer.gatherConstraints(timetableId);

      expect(result.timetableData.lessons).toEqual([]);
      expect(result.timetableData.periodsPerDay).toBeDefined();
      expect(result.timetableData.daysOfWeek).toHaveLength(6);
    });
  });

  describe('Cache Management', () => {
    it('should invalidate cache for specific timetable', async () => {
      const timetableId = 1;

      vi.mocked(Timetable.findOne).mockResolvedValue(createMockTimetable(timetableId) as Timetable);
      vi.mocked(Teacher.find).mockResolvedValue([]);
      vi.mocked(Subject.find).mockResolvedValue([]);
      vi.mocked(Room.find).mockResolvedValue([]);
      vi.mocked(TeacherClassSubjectAssignment.find).mockResolvedValue([]);

      // First call - cache it
      await gatherer.gatherConstraints(timetableId);

      // Invalidate cache
      gatherer.invalidateCache(timetableId);

      // Second call - should query database again
      await gatherer.gatherConstraints(timetableId);

      expect(Timetable.findOne).toHaveBeenCalledTimes(2);
    });

    it('should clear all cache', async () => {
      const timetableId1 = 1;
      const timetableId2 = 2;

      vi.mocked(Timetable.findOne).mockResolvedValue(
        createMockTimetable(timetableId1) as Timetable
      );
      vi.mocked(Teacher.find).mockResolvedValue([]);
      vi.mocked(Subject.find).mockResolvedValue([]);
      vi.mocked(Room.find).mockResolvedValue([]);
      vi.mocked(TeacherClassSubjectAssignment.find).mockResolvedValue([]);

      // Cache both timetables
      await gatherer.gatherConstraints(timetableId1);
      await gatherer.gatherConstraints(timetableId2);

      // Clear all cache
      gatherer.clearCache();

      // Both should query database again
      await gatherer.gatherConstraints(timetableId1);
      await gatherer.gatherConstraints(timetableId2);

      expect(Timetable.findOne).toHaveBeenCalledTimes(4);
    });

    it('should get cache statistics', () => {
      const stats = gatherer.getCacheStats();

      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
    });
  });

  describe('Singleton Instance', () => {
    it('should export singleton instance', async () => {
      const { swapConstraintGatherer } = await import('../SwapConstraintGatherer');

      expect(swapConstraintGatherer).toBeInstanceOf(SwapConstraintGatherer);
    });
  });
});
