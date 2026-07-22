/**
 * SwapConstraintGatherer - Service to gather constraint data from database entities
 *
 * Extracts and transforms data from Teacher, Subject, Room, ClassGroup, and
 * TeacherClassSubjectAssignment entities into the format required by the
 * Python constraint solver for swap validation.
 *
 * Requirements: Phase 0.2
 * - Parallel database queries (6 queries)
 * - Transform entities to constraint format
 * - Parse JSON fields correctly
 * - Cache results automatically
 * - Performance: <100ms for first request, <1ms for cached
 */

import { Room } from '../entity/Room';
import { Subject } from '../entity/Subject';
import { Teacher } from '../entity/Teacher';
import { TeacherClassSubjectAssignment } from '../entity/TeacherClassSubjectAssignment';
import { Timetable } from '../entity/Timetable';
import { ClassGroup } from '../entity/ClassGroup';
import {
  AssignmentConstraintData,
  CachedConstraintData,
  RoomConstraintData,
  SubjectConstraintData,
  SwapConstraintCache,
  TeacherConstraintData,
  TimetableData,
} from './SwapConstraintCache';
import { DataSource } from 'typeorm';
import { CacheManager } from '../database/cache/cacheManager';
import {
  clearDataSourceScopedInstances,
  getDataSourceScopedInstance,
} from '../utils/dataSourceScope';
import {
  assertOperationalScopeIsConsistent,
  SchoolScopeConflictError,
} from '../utils/schoolScopeGuard';

/**
 * SwapConstraintGatherer - Gathers and transforms constraint data
 *
 * Features:
 * - Parallel database queries for optimal performance
 * - Automatic caching with 5-minute TTL
 * - JSON field parsing with error handling
 * - Type-safe transformations
 * - Comprehensive error handling
 */
export class SwapConstraintGatherer {
  private constructor(
    private readonly dataSource: DataSource,
    private readonly cache: SwapConstraintCache
  ) {}

  static getInstance(dataSource: DataSource, cacheManager?: CacheManager): SwapConstraintGatherer {
    return getDataSourceScopedInstance(
      dataSource,
      SwapConstraintGatherer,
      () =>
        new SwapConstraintGatherer(
          dataSource,
          new SwapConstraintCache(cacheManager ?? CacheManager.getInstance())
        )
    );
  }

  static resetInstance(): void {
    clearDataSourceScopedInstances(SwapConstraintGatherer);
  }

  /**
   * Gathers all constraint data for a timetable
   *
   * Uses cache if available, otherwise queries database in parallel
   * and transforms entities to constraint format.
   *
   * @param timetableId - Timetable ID
   * @returns Complete constraint data for swap validation
   * @throws Error if timetable not found
   */
  async gatherConstraints(
    timetableId: number,
    options: { skipCache?: boolean } = {}
  ): Promise<any> {
    // Check cache first
    const cached = options.skipCache ? undefined : this.cache.get(timetableId);
    if (cached) {
      // Return in format expected by Python solver
      return {
        teachers: cached.teachers,
        subjects: cached.subjects,
        rooms: cached.rooms,
        classes: cached.classes,
        assignments: cached.assignments,
        scheduledLessons: cached.timetableData.lessons || [],
        timetableData: cached.timetableData,
        config: {
          daysOfWeek: cached.timetableData.daysOfWeek,
          periodsPerDay: cached.timetableData.periodsPerDay,
        },
        cachedAt: cached.cachedAt,
      };
    }

    const activeScope = await assertOperationalScopeIsConsistent(this.dataSource);

    const [timetable, teachers, subjects, rooms, classes, assignments] = await Promise.all([
      this.dataSource.getRepository(Timetable).findOne({
        where: { id: timetableId, isDeleted: false },
      }),
      this.dataSource.getRepository(Teacher).find({ where: { isDeleted: false } }),
      this.dataSource.getRepository(Subject).find({ where: { isDeleted: false } }),
      this.dataSource.getRepository(Room).find({ where: { isDeleted: false } }),
      this.dataSource.getRepository(ClassGroup).find({ where: { isDeleted: false } }),
      this.dataSource
        .getRepository(TeacherClassSubjectAssignment)
        .find({ where: { isDeleted: false } }),
    ]);

    if (!timetable) {
      throw new Error(`Timetable ${timetableId} not found`);
    }

    const hasOperationalData =
      teachers.length > 0 || subjects.length > 0 || rooms.length > 0 || classes.length > 0;
    if (hasOperationalData && activeScope !== (timetable.schoolId ?? null)) {
      throw new SchoolScopeConflictError({
        nullScoped: [],
        schoolIds: activeScope === null ? [] : [activeScope],
        requestedSchoolId: timetable.schoolId ?? null,
        activeSchoolId: activeScope,
      });
    }

    // Transform entities to constraint format
    const constraintData: CachedConstraintData = {
      teachers: this.transformTeachers(teachers),
      subjects: this.transformSubjects(subjects),
      rooms: this.transformRooms(rooms),
      classes: this.transformClasses(classes),
      assignments: this.transformAssignments(assignments),
      timetableData: this.parseTimetableData(timetable),
      cachedAt: new Date(),
    };

    // Cache the result
    this.cache.set(timetableId, constraintData);

    // Return in format expected by Python solver
    return {
      teachers: constraintData.teachers,
      subjects: constraintData.subjects,
      rooms: constraintData.rooms,
      classes: constraintData.classes,
      assignments: constraintData.assignments,
      scheduledLessons: constraintData.timetableData.lessons || [],
      timetableData: constraintData.timetableData,
      config: {
        daysOfWeek: constraintData.timetableData.daysOfWeek,
        periodsPerDay: constraintData.timetableData.periodsPerDay,
      },
      cachedAt: constraintData.cachedAt,
    };
  }

  /**
   * Transform Teacher entities to constraint format
   *
   * Extracts canonical unavailable slots, preferences, and weekly limit.
   *
   * @param teachers - Array of Teacher entities
   * @returns Array of TeacherConstraintData
   */
  private transformTeachers(teachers: Teacher[]): TeacherConstraintData[] {
    return teachers.map((teacher) => {
      const transformed: any = {
        id: teacher.id.toString(),
        fullName: teacher.fullName || `Teacher ${teacher.id}`,
        unavailable: this.parseUnavailableSlots(teacher.unavailable),
        timePreference: (teacher.timePreference as 'Morning' | 'Afternoon' | 'None') || 'None',
        maxPeriodsPerWeek: teacher.maxPeriodsPerWeek ?? 30,
      };
      return transformed;
    });
  }

  /**
   * Transform Subject entities to constraint format
   *
   * Extracts room requirements and difficulty flags from Subject entity
   *
   * @param subjects - Array of Subject entities
   * @returns Array of SubjectConstraintData
   */
  private transformSubjects(subjects: Subject[]): SubjectConstraintData[] {
    return subjects.map((subject) => {
      const transformed: any = {
        id: subject.id.toString(),
        name: subject.name || `Subject ${subject.id}`,
        requiredRoomType: subject.requiredRoomType || null,
        isDifficult: subject.isDifficult || false,
        minRoomCapacity: subject.minRoomCapacity || 0,
        requiredFeatures: this.parseFeatures(subject.requiredFeatures),
      };
      return transformed;
    });
  }

  /**
   * Transform Room entities to constraint format
   *
   * Extracts room type, capacity, features, and unavailability from Room entity
   *
   * @param rooms - Array of Room entities
   * @returns Array of RoomConstraintData
   */
  private transformRooms(rooms: Room[]): RoomConstraintData[] {
    return rooms.map((room) => {
      const transformed: any = {
        id: room.id.toString(),
        name: room.name || `Room ${room.id}`,
        type: room.type || 'normal',
        capacity: room.capacity || 0,
        features: this.parseFeatures(room.features),
        unavailable: this.parseUnavailability(room.unavailable),
      };
      return transformed;
    });
  }

  private transformClasses(
    classes: ClassGroup[]
  ): Array<{ id: string; studentCount: number; fixedRoomId: string | null }> {
    return classes.map((classGroup) => ({
      id: classGroup.id.toString(),
      studentCount: classGroup.studentCount || 0,
      fixedRoomId: classGroup.fixedRoomId?.toString() ?? null,
    }));
  }

  /**
   * Transform TeacherClassSubjectAssignment entities to constraint format
   *
   * Extracts assignment relationships and fixed flags
   *
   * @param assignments - Array of TeacherClassSubjectAssignment entities
   * @returns Array of AssignmentConstraintData
   */
  private transformAssignments(
    assignments: TeacherClassSubjectAssignment[]
  ): AssignmentConstraintData[] {
    return assignments.map((assignment) => ({
      teacherId: assignment.teacherId.toString(),
      classId: assignment.classId.toString(),
      subjectId: assignment.subjectId.toString(),
      isFixed: assignment.isFixed,
    }));
  }

  /**
   * Parse timetable data from Timetable entity
   *
   * Extracts lessons, periods per day, and days of week from JSON data field
   *
   * @param timetable - Timetable entity
   * @returns Parsed timetable data
   */
  private parseTimetableData(timetable: Timetable): TimetableData {
    try {
      const data = this.parseTimetablePayload(timetable.data);
      const lessons = this.extractLessonsFromPayload(data);
      const periodConfiguration =
        typeof data.metadata === 'object' && data.metadata !== null
          ? (data.metadata as Record<string, unknown>).periodConfiguration
          : null;
      const periodConfigRecord =
        typeof periodConfiguration === 'object' && periodConfiguration !== null
          ? (periodConfiguration as Record<string, unknown>)
          : null;
      const periodsPerDay =
        typeof data.periodsPerDay === 'object' && data.periodsPerDay !== null
          ? this.normalizePeriodsPerDayMap(data.periodsPerDay as Record<string, unknown>)
          : periodConfigRecord &&
              typeof periodConfigRecord.periodsPerDayMap === 'object' &&
              periodConfigRecord.periodsPerDayMap !== null
            ? this.normalizePeriodsPerDayMap(
                periodConfigRecord.periodsPerDayMap as Record<string, unknown>
              )
            : this.getDefaultPeriodsPerDay();
      const daysOfWeek = Array.isArray(data.daysOfWeek)
        ? data.daysOfWeek.map(String)
        : Array.isArray(periodConfigRecord?.daysOfWeek)
          ? (periodConfigRecord.daysOfWeek as unknown[]).map(String)
          : this.getDefaultDaysOfWeek();

      return {
        lessons,
        periodsPerDay,
        daysOfWeek,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown parsing error';
      throw new Error(`Timetable ${timetable.id} contains invalid schedule data: ${message}`);
    }
  }

  private parseTimetablePayload(payload: string): Record<string, unknown> {
    const parsed = JSON.parse(payload);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('Invalid timetable payload');
    }

    return parsed as Record<string, unknown>;
  }

  private extractLessonsFromPayload(data: Record<string, unknown>): TimetableData['lessons'] {
    const rawLessons = Array.isArray(data.schedule)
      ? data.schedule
      : Array.isArray(data.lessons)
        ? data.lessons
        : [];

    return rawLessons.map((rawLesson, index) => {
      const lesson = this.normalizeLesson(rawLesson);
      if (!lesson) {
        throw new Error(`Timetable lesson ${index} is malformed`);
      }
      return lesson;
    });
  }

  private normalizeLesson(rawLesson: unknown): TimetableData['lessons'][number] | null {
    if (typeof rawLesson !== 'object' || rawLesson === null) {
      return null;
    }

    const lesson = rawLesson as Record<string, unknown>;
    const classId = lesson.classId != null ? String(lesson.classId) : null;
    const subjectId = lesson.subjectId != null ? String(lesson.subjectId) : null;
    const day = lesson.day != null ? String(lesson.day) : null;
    const periodIndex = Number(lesson.periodIndex);
    const teacherIds = Array.isArray(lesson.teacherIds)
      ? lesson.teacherIds.map(String).filter(Boolean)
      : lesson.teacherId != null
        ? [String(lesson.teacherId)]
        : [];
    const teacherId = teacherIds[0] ?? null;

    if (!classId || !subjectId || !day || Number.isNaN(periodIndex) || !teacherId) {
      return null;
    }

    return {
      classId,
      subjectId,
      teacherId,
      teacherIds,
      roomId: lesson.roomId != null ? String(lesson.roomId) : null,
      day,
      periodIndex,
      duration: Number(lesson.duration ?? 1),
    };
  }

  private normalizePeriodsPerDayMap(
    rawPeriodsPerDayMap: Record<string, unknown>
  ): Record<string, number> {
    const periodsPerDayMap: Record<string, number> = {};

    for (const [day, periods] of Object.entries(rawPeriodsPerDayMap)) {
      const normalizedPeriods = Number(periods);
      if (!Number.isNaN(normalizedPeriods) && normalizedPeriods > 0) {
        periodsPerDayMap[day] = normalizedPeriods;
      }
    }

    return Object.keys(periodsPerDayMap).length > 0
      ? periodsPerDayMap
      : this.getDefaultPeriodsPerDay();
  }

  private extractClassesFromLessons(lessons: TimetableData['lessons']): Array<{ id: string }> {
    return Array.from(new Set(lessons.map((lesson) => lesson.classId))).map((classId) => ({
      id: classId,
    }));
  }

  /**
   * Parse room features from JSON string
   *
   * Format: ["projector", "whiteboard", "computers"]
   *
   * @param featuresJson - JSON string of features
   * @returns Parsed features array or empty array
   */
  private parseFeatures(featuresJson: string | null): string[] {
    if (!featuresJson) {
      return [];
    }

    try {
      const parsed = JSON.parse(featuresJson);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Parse room unavailability from JSON string
   *
   * Format: { "Saturday": [false, false, true, ...], "Sunday": [...], ... }
   *
   * @param unavailableJson - JSON string of unavailability
   * @returns Parsed unavailability map or empty object
   */
  private parseUnavailability(
    unavailableJson: string | null
  ): Array<{ day: string; period: number }> {
    if (!unavailableJson) {
      return [];
    }

    const parsed: unknown = JSON.parse(unavailableJson);
    if (!Array.isArray(parsed)) {
      throw new Error('Room availability must be a canonical array');
    }
    return parsed.map((slot, index) => {
      if (
        typeof slot !== 'object' ||
        slot === null ||
        typeof (slot as { day?: unknown }).day !== 'string' ||
        !Number.isInteger((slot as { period?: unknown }).period)
      ) {
        throw new Error(`Room availability slot ${index} is malformed`);
      }
      return {
        day: (slot as { day: string }).day,
        period: (slot as { period: number }).period,
      };
    });
  }

  private parseUnavailableSlots(
    unavailableJson: string | null
  ): Array<{ day: string; period: number }> {
    if (!unavailableJson) return [];
    try {
      const parsed = JSON.parse(unavailableJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * Get default periods per day (Afghan school week)
   *
   * @returns Default periods per day map
   */
  private getDefaultPeriodsPerDay(): Record<string, number> {
    return {
      Saturday: 7,
      Sunday: 7,
      Monday: 7,
      Tuesday: 7,
      Wednesday: 7,
      Thursday: 4, // Half day
    };
  }

  /**
   * Get default days of week (Afghan school week)
   *
   * @returns Default days of week array
   */
  private getDefaultDaysOfWeek(): string[] {
    return ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
  }

  /**
   * Invalidate cached constraint data for a timetable
   *
   * Call this when timetable or related entities are modified
   *
   * @param timetableId - Timetable ID to invalidate
   */
  invalidateCache(timetableId: number): void {
    this.cache.invalidate(timetableId);
  }

  /**
   * Clear all cached constraint data
   *
   * Call this when global data changes (e.g., teacher/subject/room updates)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   *
   * @returns Cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }
}
