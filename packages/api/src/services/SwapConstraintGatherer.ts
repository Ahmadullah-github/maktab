/**
 * SwapConstraintGatherer - Service to gather constraint data from database entities
 *
 * Extracts and transforms data from Teacher, Subject, Room, ClassGroup, and
 * TeacherClassSubjectAssignment entities into the format required by the
 * Python constraint solver for swap validation.
 *
 * Requirements: Phase 0.2
 * - Parallel database queries (5 queries)
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
import {
  AssignmentConstraintData,
  CachedConstraintData,
  RoomConstraintData,
  SubjectConstraintData,
  swapConstraintCache,
  TeacherConstraintData,
  TimetableData,
} from './SwapConstraintCache';

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
  async gatherConstraints(timetableId: number): Promise<any> {
    // Check cache first
    const cached = swapConstraintCache.get(timetableId);
    if (cached) {
      // Return in format expected by Python solver
      return {
        teachers: cached.teachers,
        subjects: cached.subjects,
        rooms: cached.rooms,
        classes: [], // Will be populated from timetable data
        assignments: cached.timetableData.lessons || [],
        timetableData: cached.timetableData,
        config: {
          daysOfWeek: cached.timetableData.daysOfWeek,
          periodsPerDay: cached.timetableData.periodsPerDay,
        },
      };
    }

    // Parallel database queries (5 queries)
    const [timetable, teachers, subjects, rooms, assignments] = await Promise.all([
      Timetable.findOne({ where: { id: timetableId, isDeleted: false } }),
      Teacher.find({ where: { isDeleted: false } }),
      Subject.find({ where: { isDeleted: false } }),
      Room.find({ where: { isDeleted: false } }),
      TeacherClassSubjectAssignment.find({ where: { isDeleted: false } }),
    ]);

    if (!timetable) {
      throw new Error(`Timetable ${timetableId} not found`);
    }

    // Transform entities to constraint format
    const constraintData: CachedConstraintData = {
      teachers: this.transformTeachers(teachers),
      subjects: this.transformSubjects(subjects),
      rooms: this.transformRooms(rooms),
      assignments: this.transformAssignments(assignments),
      timetableData: this.parseTimetableData(timetable),
      cachedAt: new Date(),
    };

    // Cache the result
    swapConstraintCache.set(timetableId, constraintData);

    // Return in format expected by Python solver
    return {
      teachers: constraintData.teachers,
      subjects: constraintData.subjects,
      rooms: constraintData.rooms,
      classes: [], // Will be populated from timetable data
      assignments: constraintData.timetableData.lessons || [],
      timetableData: constraintData.timetableData,
      config: {
        daysOfWeek: constraintData.timetableData.daysOfWeek,
        periodsPerDay: constraintData.timetableData.periodsPerDay,
      },
    };
  }

  /**
   * Transform Teacher entities to constraint format
   *
   * Extracts availability, preferences, and limits from Teacher entity
   *
   * @param teachers - Array of Teacher entities
   * @returns Array of TeacherConstraintData
   */
  private transformTeachers(teachers: Teacher[]): TeacherConstraintData[] {
    return teachers.map((teacher) => {
      const transformed: any = {
        id: teacher.id.toString(),
        fullName: teacher.fullName || `Teacher ${teacher.id}`,
        availability: this.parseAvailability(teacher.availability),
        timePreference: (teacher.timePreference as 'Morning' | 'Afternoon' | 'None') || 'None',
        maxConsecutivePeriods: teacher.maxConsecutivePeriods || 4,
        maxPeriodsPerWeek: teacher.maxPeriodsPerWeek || 30,
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
      const data = JSON.parse(timetable.data);

      return {
        lessons: data.lessons || [],
        periodsPerDay: data.periodsPerDay || this.getDefaultPeriodsPerDay(),
        daysOfWeek: data.daysOfWeek || this.getDefaultDaysOfWeek(),
      };
    } catch (error) {
      // If parsing fails, return defaults
      return {
        lessons: [],
        periodsPerDay: this.getDefaultPeriodsPerDay(),
        daysOfWeek: this.getDefaultDaysOfWeek(),
      };
    }
  }

  /**
   * Parse teacher availability from JSON string
   *
   * Format: { "Saturday": [true, true, false, ...], "Sunday": [...], ... }
   *
   * @param availabilityJson - JSON string of availability
   * @returns Parsed availability map or empty object
   */
  private parseAvailability(availabilityJson: string | null): Record<string, boolean[]> {
    if (!availabilityJson) {
      return this.getDefaultAvailability();
    }

    try {
      const parsed = JSON.parse(availabilityJson);
      // Validate structure
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed;
      }
      return this.getDefaultAvailability();
    } catch {
      return this.getDefaultAvailability();
    }
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
  private parseUnavailability(unavailableJson: string | null): Record<string, boolean[]> {
    if (!unavailableJson) {
      return {};
    }

    try {
      const parsed = JSON.parse(unavailableJson);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed;
      }
      return {};
    } catch {
      return {};
    }
  }

  /**
   * Get default availability (all periods available for all days)
   *
   * @returns Default availability map
   */
  private getDefaultAvailability(): Record<string, boolean[]> {
    const days = this.getDefaultDaysOfWeek();
    const availability: Record<string, boolean[]> = {};

    for (const day of days) {
      // Default: 7 periods per day, all available
      availability[day] = Array(7).fill(true);
    }

    return availability;
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
    swapConstraintCache.invalidate(timetableId);
  }

  /**
   * Clear all cached constraint data
   *
   * Call this when global data changes (e.g., teacher/subject/room updates)
   */
  clearCache(): void {
    swapConstraintCache.clear();
  }

  /**
   * Get cache statistics
   *
   * @returns Cache statistics
   */
  getCacheStats() {
    return swapConstraintCache.getStats();
  }
}

/**
 * Singleton instance of SwapConstraintGatherer
 *
 * Use this instance throughout the application for consistent caching
 */
export const swapConstraintGatherer = new SwapConstraintGatherer();
