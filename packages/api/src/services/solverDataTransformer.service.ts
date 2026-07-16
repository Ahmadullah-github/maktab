/**
 * Solver Data Transformer Service
 *
 * Transforms database entities to the exact JSON format expected by the Python solver.
 * This service ensures clean, validated data is sent to the solver without any
 * database metadata or frontend serialization artifacts. Phase 7 makes the
 * canonical assignment tables the only solver authority for requirements,
 * capabilities, and fixed assignments.
 *
 * Requirements: 7.2, 11.1
 */

import { DataSource } from 'typeorm';
import { CacheManager } from '../database/cache/cacheManager';
import { ClassRepository } from '../database/repositories/class.repository';
import { ConfigRepository } from '../database/repositories/config.repository';
import { RoomRepository } from '../database/repositories/room.repository';
import {
  SchoolConfigRepository,
  SolverConfigInput,
} from '../database/repositories/schoolConfig.repository';
import { SubjectRepository } from '../database/repositories/subject.repository';
import { TeacherRepository } from '../database/repositories/teacher.repository';
import { ClassSubjectRequirement } from '../entity/ClassSubjectRequirement';
import { TeacherSubjectCapability } from '../entity/TeacherSubjectCapability';
import { TeachingAssignment } from '../entity/TeachingAssignment';
import { safeJsonParse } from '../utils/jsonTransformer';
import { logger } from '../utils/logger';
import { buildCanonicalPeriodConfiguration } from '../utils/periodConfiguration';
import {
  assertOperationalScopeIsConsistent,
  SchoolScopeConflictError,
} from '../utils/schoolScopeGuard';
import {
  clearDataSourceScopedInstances,
  getDataSourceScopedInstance,
} from '../utils/dataSourceScope';

/**
 * Default Afghan school week days (matching solver's DayOfWeek enum)
 */
const DEFAULT_DAYS_OF_WEEK = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

/**
 * Solver input structure matching Pydantic models
 */
export interface SolverInput {
  meta?: {
    academicYear?: string;
    term?: string;
    createdAt?: string;
    version?: string;
  };
  config: {
    daysOfWeek: string[];
    periodsPerDay: number;
    periodsPerDayMap?: Record<string, number>;
    categoryPeriodsPerDayMap?: Record<string, Record<string, number>>;
    schoolStartTime?: string;
    periodDurationMinutes?: number;
    breakPeriods?: Array<{ afterPeriod: number; duration: number }>;
    breakPeriodsByDay?: Record<string, Array<{ afterPeriod: number; duration: number }>>;
    solverTimeLimitSeconds?: number;
    solverOptimizationLevel?: number;
    enableGracefulDegradation?: boolean;
    enforceGenderSeparation?: boolean;
    [key: string]: any;
  };
  preferences?: {
    avoidTeacherGapsWeight?: number;
    avoidClassGapsWeight?: number;
    distributeDifficultSubjectsWeight?: number;
    balanceTeacherLoadWeight?: number;
    minimizeRoomChangesWeight?: number;
    preferMorningForDifficultWeight?: number;
    respectTeacherTimePreferenceWeight?: number;
    respectTeacherRoomPreferenceWeight?: number;
    respectTeacherAssignmentPreferenceWeight?: number;
    respectPreferredColleaguesWeight?: number;
    preferClassHomeRoomWeight?: number;
    respectSubjectDesiredFeaturesWeight?: number;
    allowConsecutivePeriodsForSameSubject?: boolean;
    avoidFirstLastPeriodWeight?: number;
    subjectSpreadWeight?: number;
  };
  teachers: any[];
  subjects: any[];
  classes: any[];
  rooms: any[];
  fixedLessons?: any[];
  fixedTeacherAssignments?: any[];
  schoolEvents?: any[];
}

/**
 * Solver Data Transformer Service
 * Singleton service that transforms database entities to solver input format
 */
export class SolverDataTransformerService {
  private constructor(
    private dataSource: DataSource,
    private cacheManager?: CacheManager
  ) {}

  /**
   * Get singleton instance
   */
  static getInstance(
    dataSource: DataSource,
    cacheManager?: CacheManager
  ): SolverDataTransformerService {
    return getDataSourceScopedInstance(
      dataSource,
      SolverDataTransformerService,
      () => new SolverDataTransformerService(dataSource, cacheManager)
    );
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    clearDataSourceScopedInstances(SolverDataTransformerService);
  }

  // =========================================================================
  // Main Transformation Method
  // =========================================================================

  /**
   * Transform all database entities to solver input format
   *
   * @param options - Transformation options
   * @returns Complete solver input matching Pydantic schema
   */
  async transformToSolverInput(options?: {
    schoolId?: number | null;
    strategy?: string;
  }): Promise<SolverInput> {
    logger.info('Starting solver data transformation', { schoolId: options?.schoolId });

    // 1. Enforce the dormant school scope before reading operational data.
    const activeScope = await assertOperationalScopeIsConsistent(this.dataSource);
    const requestedScope = options?.schoolId ?? null;
    const scopeRows = await this.dataSource.query(
      `SELECT 1 FROM room WHERE isDeleted = 0
       UNION ALL SELECT 1 FROM class_group WHERE isDeleted = 0
       UNION ALL SELECT 1 FROM teacher WHERE isDeleted = 0
       UNION ALL SELECT 1 FROM subject WHERE isDeleted = 0
       LIMIT 1`
    );
    if (scopeRows.length > 0 && activeScope !== requestedScope) {
      throw new SchoolScopeConflictError({
        nullScoped: [],
        schoolIds: activeScope === null ? [] : [activeScope],
        requestedSchoolId: requestedScope,
        activeSchoolId: activeScope,
      });
    }

    const entities = await this.fetchAllEntities(activeScope);
    logger.info('Fetched entities from database', {
      teachers: entities.teachers.length,
      subjects: entities.subjects.length,
      classes: entities.classes.length,
      rooms: entities.rooms.length,
    });

    // 2. Load school configuration
    const schoolConfig = await this.loadSchoolConfig(options?.schoolId);
    const daysOfWeek = schoolConfig?.daysOfWeek || DEFAULT_DAYS_OF_WEEK;
    const defaultPeriodsPerDay = schoolConfig?.defaultPeriodsPerDay || 7;

    // 3. Build the period contract before resources so availability arrays
    // exactly match the solver grid for every active day.
    const config = this.buildConfig(
      schoolConfig,
      defaultPeriodsPerDay,
      daysOfWeek,
      options?.strategy
    );

    // 4. Transform each entity type
    const teachers = this.transformTeachers(
      entities.teachers,
      entities.capabilities,
      daysOfWeek,
      config.periodsPerDayMap
    );
    const subjects = this.transformSubjects(entities.subjects);
    const classes = this.transformClasses(entities.classes, entities.requirements);
    const rooms = this.transformRooms(entities.rooms, daysOfWeek);

    // 5. Build fixed teacher assignments from canonical tables
    const fixedTeacherAssignments = this.transformFixedTeacherAssignments(
      entities.assignments,
      entities.requirements
    );

    // 6. Build preferences (now async)
    const preferences = await this.buildPreferences();

    // 7. Assemble final input
    const solverInput: SolverInput = {
      meta: {
        academicYear: new Date().getFullYear().toString(),
        term: 'Current',
        createdAt: new Date().toISOString(),
        version: '1.0',
      },
      config,
      preferences,
      teachers,
      subjects,
      classes,
      rooms,
      fixedTeacherAssignments:
        fixedTeacherAssignments.length > 0 ? fixedTeacherAssignments : undefined,
    };

    logger.info('Solver data transformation complete', {
      totalSize: JSON.stringify(solverInput).length,
    });

    return solverInput;
  }

  // =========================================================================
  // Entity Fetching
  // =========================================================================

  /**
   * Fetch all entities from database repositories
   */
  private async fetchAllEntities(scope: number | null) {
    const teacherRepo = TeacherRepository.getInstance(this.dataSource, this.cacheManager);
    const subjectRepo = SubjectRepository.getInstance(this.dataSource, this.cacheManager);
    const classRepo = ClassRepository.getInstance(this.dataSource, this.cacheManager);
    const roomRepo = RoomRepository.getInstance(this.dataSource, this.cacheManager);
    const requirementRepo = this.dataSource.getRepository(ClassSubjectRequirement);
    const capabilityRepo = this.dataSource.getRepository(TeacherSubjectCapability);
    const assignmentRepo = this.dataSource.getRepository(TeachingAssignment);

    const [
      teachersResult,
      subjectsResult,
      classesResult,
      roomsResult,
      requirements,
      capabilities,
      assignments,
    ] = await Promise.all([
      teacherRepo.findAll({ page: 1, limit: 10000 }),
      subjectRepo.findAll({ page: 1, limit: 10000 }),
      classRepo.findAll({ page: 1, limit: 10000 }),
      roomRepo.findAll({ page: 1, limit: 10000 }),
      requirementRepo.find({
        where: { isDeleted: false },
        order: { classId: 'ASC', subjectId: 'ASC' },
      }),
      capabilityRepo.find({
        where: { isDeleted: false },
        order: { teacherId: 'ASC', subjectId: 'ASC' },
      }),
      assignmentRepo.find({
        where: { isDeleted: false },
        order: { teacherId: 'ASC', classSubjectRequirementId: 'ASC' },
      }),
    ]);

    const inScope = (row: { schoolId?: number | null }) => (row.schoolId ?? null) === scope;
    const teachers = teachersResult.data.filter(inScope);
    const subjects = subjectsResult.data.filter(inScope);
    const classes = classesResult.data.filter(inScope);
    const rooms = roomsResult.data.filter(inScope);
    const teacherIds = new Set(teachers.map((row) => row.id));
    const subjectIds = new Set(subjects.map((row) => row.id));
    const classIds = new Set(classes.map((row) => row.id));
    const scopedRequirements = requirements.filter(
      (row) => classIds.has(row.classId) && subjectIds.has(row.subjectId)
    );
    const requirementIds = new Set(scopedRequirements.map((row) => row.id));

    return {
      teachers,
      subjects,
      classes,
      rooms,
      requirements: scopedRequirements,
      capabilities: capabilities.filter(
        (row) => teacherIds.has(row.teacherId) && subjectIds.has(row.subjectId)
      ),
      assignments: assignments.filter(
        (row) => teacherIds.has(row.teacherId) && requirementIds.has(row.classSubjectRequirementId)
      ),
    };
  }

  /**
   * Load school configuration for solver
   */
  private async loadSchoolConfig(schoolId?: number | null): Promise<SolverConfigInput | null> {
    const schoolConfigRepo = SchoolConfigRepository.getInstance(
      this.dataSource,
      this.cacheManager
    );
    return schoolConfigRepo.getForSolver(schoolId ?? null);
  }

  // =========================================================================
  // Entity Transformers
  // =========================================================================

  /**
   * Transform teachers to solver format
   */
  private transformTeachers(
    teachers: any[],
    capabilities: TeacherSubjectCapability[],
    daysOfWeek: string[],
    periodsPerDayMap: Record<string, number>
  ) {
    const capabilitiesByTeacherId = new Map<
      number,
      { primarySubjectIds: number[]; allowedSubjectIds: number[] }
    >();

    for (const capability of capabilities) {
      const existing = capabilitiesByTeacherId.get(capability.teacherId) ?? {
        primarySubjectIds: [],
        allowedSubjectIds: [],
      };

      if (capability.capabilityLevel === 'primary') {
        existing.primarySubjectIds.push(capability.subjectId);
      } else {
        existing.allowedSubjectIds.push(capability.subjectId);
      }

      capabilitiesByTeacherId.set(capability.teacherId, existing);
    }

    return teachers.map((t) => {
      const teacherCapabilities = capabilitiesByTeacherId.get(t.id) ?? {
        primarySubjectIds: [],
        allowedSubjectIds: [],
      };
      const preferredRoomIds = this.parseJsonField(t.preferredRoomIds, []);
      const preferredColleagues = this.parseJsonField(t.preferredColleagues, []);
      const unavailable = this.parseJsonField(t.unavailable, []);

      return {
        id: String(t.id),
        fullName: t.fullName,
        primarySubjectIds: teacherCapabilities.primarySubjectIds.map(String),
        allowedSubjectIds: teacherCapabilities.allowedSubjectIds.map(String),
        restrictToPrimarySubjects: t.restrictToPrimarySubjects ?? true,
        // Sparse unavailable slots are authoritative. The full matrix is a
        // deterministic solver projection of the current SchoolConfig.
        availability: this.convertAvailabilityFormat({}, daysOfWeek, periodsPerDayMap),
        unavailable: this.transformUnavailableSlots(unavailable, daysOfWeek),
        maxPeriodsPerWeek: t.maxPeriodsPerWeek ?? 0,
        maxPeriodsPerDay: t.maxPeriodsPerDay ?? undefined,
        maxConsecutivePeriods: t.maxConsecutivePeriods ?? undefined,
        timePreference: this.normalizeTimePreference(t.timePreference),
        preferredRoomIds: preferredRoomIds.map(String),
        preferredColleagues: preferredColleagues.map(String),
        gender: t.gender || undefined,
      };
    });
  }

  /**
   * Transform subjects to solver format
   */
  private transformSubjects(subjects: any[]) {
    return subjects.map((s) => {
      // Parse JSON string fields from database
      const requiredFeatures = this.parseJsonField(s.requiredFeatures, []);
      const desiredFeatures = this.parseJsonField(s.desiredFeatures, []);

      return {
        id: String(s.id),
        name: s.name,
        code: s.code || undefined,
        requiredRoomType: s.requiredRoomType || s.roomType || undefined,
        requiredFeatures: requiredFeatures.length > 0 ? requiredFeatures : undefined,
        desiredFeatures: desiredFeatures.length > 0 ? desiredFeatures : undefined,
        isDifficult: s.isDifficult || false,
        minRoomCapacity: s.minRoomCapacity || undefined,
        isCustom: s.isCustom || false,
        customCategory: s.customCategory || undefined,
      };
    });
  }

  /**
   * Transform classes to solver format
   */
  private transformClasses(classes: any[], requirements: ClassSubjectRequirement[]) {
    const requirementsByClassId = new Map<number, ClassSubjectRequirement[]>();

    for (const requirement of requirements) {
      const existing = requirementsByClassId.get(requirement.classId) ?? [];
      existing.push(requirement);
      requirementsByClassId.set(requirement.classId, existing);
    }

    return classes.map((c) => {
      const subjectRequirements =
        requirementsByClassId.get(c.id)?.map((requirement) => ({
          subjectId: requirement.subjectId,
          periodsPerWeek: requirement.requiredPeriodsPerWeek,
        })) ?? [];

      return {
        id: String(c.id),
        name: c.name,
        studentCount: c.studentCount || 0,
        gradeLevel: c.grade || undefined, // Fixed: use 'grade' field from entity
        category: c.category || undefined,
        singleTeacherMode: c.singleTeacherMode || false,
        classTeacherId: c.classTeacherId ? String(c.classTeacherId) : undefined,
        fixedRoomId: c.fixedRoomId ? String(c.fixedRoomId) : undefined,
        homeRoomId: c.homeRoomId ? String(c.homeRoomId) : undefined,
        gender: c.gender || undefined,
        subjectRequirements: this.transformSubjectRequirements(subjectRequirements),
      };
    });
  }

  /**
   * Transform canonical teaching assignments to solver fixed-assignment rows.
   */
  private transformFixedTeacherAssignments(
    assignments: TeachingAssignment[],
    requirements: ClassSubjectRequirement[]
  ) {
    const requirementById = new Map(
      requirements.map((requirement) => [requirement.id, requirement])
    );

    return assignments.flatMap((assignment) => {
      const requirement = requirementById.get(assignment.classSubjectRequirementId);
      if (!requirement) {
        return [];
      }

      return [
        {
          teacherId: String(assignment.teacherId),
          classId: String(requirement.classId),
          subjectId: String(requirement.subjectId),
          periodsPerWeek: assignment.assignedPeriodsPerWeek,
          isFixed: assignment.isFixed,
        },
      ];
    });
  }

  /**
   * Transform rooms to solver format
   */
  private transformRooms(rooms: any[], daysOfWeek: string[]) {
    return rooms.map((r) => {
      // Parse JSON string fields from database
      const features = this.parseJsonField(r.features, []);
      const unavailable = this.parseJsonField(r.unavailable, []);

      return {
        id: String(r.id),
        name: r.name,
        capacity: r.capacity || 0,
        type: r.type || 'normal',
        features: features,
        unavailable: this.transformUnavailableSlots(unavailable, daysOfWeek),
      };
    });
  }

  // =========================================================================
  // Helper Methods
  // =========================================================================

  /**
   * Parse JSON string field from database
   * Handles both string (JSON) and already-parsed values
   * Also handles double-encoded JSON strings (e.g., """[]""")
   */
  private parseJsonField<T>(field: any, defaultValue: T): T {
    if (!field) return defaultValue;

    if (typeof field === 'string') {
      // Empty string should return default
      if (field.trim() === '') return defaultValue;

      try {
        let parsed = JSON.parse(field);

        // Handle double-encoded JSON: if result is still a string, parse again
        if (typeof parsed === 'string') {
          try {
            parsed = JSON.parse(parsed);
          } catch (e) {
            // If second parse fails, return the first parsed result
            logger.debug('Field was single-encoded JSON string', { field });
          }
        }

        return parsed;
      } catch (e) {
        logger.warn('Failed to parse JSON field', { field, error: e });
        return defaultValue;
      }
    }

    // Already parsed (object or array)
    return field;
  }

  /**
   * Convert availability from database format to solver format
   * Database: Record<string, unknown> or empty object
   * Solver: { "Saturday": [true, true, ...], "Sunday": [...], ... }
   */
  private convertAvailabilityFormat(
    availability: any,
    daysOfWeek: string[],
    periodsPerDayMap: Record<string, number>
  ): Record<string, boolean[]> {
    const result: Record<string, boolean[]> = {};

    const normalizeDay = (value: unknown, day: string): boolean[] => {
      const expectedLength = periodsPerDayMap[day];
      const source = Array.isArray(value) ? value : [];
      return Array.from({ length: expectedLength }, (_, index) =>
        index < source.length ? source[index] === true : true
      );
    };

    // If null, undefined, or empty object, return default availability (all available)
    if (
      !availability ||
      (typeof availability === 'object' && Object.keys(availability).length === 0)
    ) {
      for (const day of daysOfWeek) {
        result[day] = normalizeDay(undefined, day);
      }
      return result;
    }

    // If already in dict format with day names, normalize the keys
    if (typeof availability === 'object' && !Array.isArray(availability)) {
      for (const [key, value] of Object.entries(availability)) {
        // Normalize key to proper case (e.g., "saturday" -> "Saturday")
        const normalizedKey = key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
        if (Array.isArray(value)) {
          if (daysOfWeek.includes(normalizedKey)) {
            result[normalizedKey] = normalizeDay(value, normalizedKey);
          }
        }
      }

      // Ensure all days are present
      for (const day of daysOfWeek) {
        if (!result[day]) {
          result[day] = normalizeDay(undefined, day);
        }
      }
      return result;
    }

    // If it's a 2D array, convert to dict format
    if (Array.isArray(availability)) {
      for (let dayIndex = 0; dayIndex < daysOfWeek.length; dayIndex++) {
        const dayName = daysOfWeek[dayIndex];
        result[dayName] = normalizeDay(availability[dayIndex], dayName);
      }
      return result;
    }

    // Fallback: return default availability for all days
    for (const day of daysOfWeek) {
      result[day] = normalizeDay(undefined, day);
    }
    return result;
  }

  /**
   * Transform unavailable slots to solver format
   */
  private transformUnavailableSlots(unavailable: any[], daysOfWeek: string[]): any[] {
    if (!Array.isArray(unavailable) || unavailable.length === 0) {
      return [];
    }

    // Group by day and collect periods
    const byDay: Record<string, number[]> = {};

    for (const slot of unavailable) {
      let dayName: string;

      // Handle different formats
      if (typeof slot.day === 'number') {
        dayName = daysOfWeek[slot.day] || daysOfWeek[0];
      } else if (typeof slot.day === 'string') {
        // Normalize day name
        dayName = slot.day.charAt(0).toUpperCase() + slot.day.slice(1).toLowerCase();
      } else {
        continue; // Skip invalid entries
      }

      if (!byDay[dayName]) {
        byDay[dayName] = [];
      }

      // Handle both 'period' (single) and 'periods' (array) formats
      if (typeof slot.period === 'number') {
        byDay[dayName].push(slot.period);
      } else if (Array.isArray(slot.periods)) {
        byDay[dayName].push(...slot.periods);
      }
    }

    // Convert to solver format: [{day: "Saturday", periods: [1, 2, 3]}, ...]
    return Object.entries(byDay).map(([day, periods]) => ({
      day,
      periods: [...new Set(periods)].sort((a, b) => a - b), // Dedupe and sort
    }));
  }

  /**
   * Transform subject requirements to solver format
   */
  private transformSubjectRequirements(requirements: any): Record<string, any> {
    if (!requirements) {
      return {};
    }

    // If already an object (dict format), convert IDs to strings
    if (typeof requirements === 'object' && !Array.isArray(requirements)) {
      const result: Record<string, any> = {};
      for (const [subjectId, req] of Object.entries(requirements)) {
        result[String(subjectId)] = {
          periodsPerWeek: (req as any).periodsPerWeek || 0,
          minConsecutive: (req as any).minConsecutive || undefined,
          maxConsecutive: (req as any).maxConsecutive || undefined,
          minDaysPerWeek: (req as any).minDaysPerWeek || undefined,
          maxDaysPerWeek: (req as any).maxDaysPerWeek || undefined,
        };
      }
      return result;
    }

    // If array format, convert to dict
    if (Array.isArray(requirements)) {
      if (requirements.length === 0) {
        return {};
      }

      const result: Record<string, any> = {};
      for (const req of requirements) {
        result[String(req.subjectId)] = {
          periodsPerWeek: req.periodsPerWeek || 0,
          minConsecutive: req.minConsecutive || undefined,
          maxConsecutive: req.maxConsecutive || undefined,
          minDaysPerWeek: req.minDaysPerWeek || undefined,
          maxDaysPerWeek: req.maxDaysPerWeek || undefined,
        };
      }
      return result;
    }

    return {};
  }

  /**
   * Normalize time preference to solver enum values
   */
  private normalizeTimePreference(pref: string | null | undefined): string {
    if (!pref) return 'None';
    const lower = pref.toLowerCase();
    if (lower === 'morning') return 'Morning';
    if (lower === 'afternoon') return 'Afternoon';
    return 'None'; // 'any' or anything else becomes 'None'
  }

  /**
   * Build config object for solver
   */
  private buildConfig(
    schoolConfig: SolverConfigInput | null,
    defaultPeriodsPerDay: number,
    daysOfWeek: string[],
    strategy?: string
  ) {
    const canonicalPeriods = buildCanonicalPeriodConfiguration({
      enablePrimary: schoolConfig?.enablePrimary ?? true,
      enableMiddle: schoolConfig?.enableMiddle ?? true,
      enableHigh: schoolConfig?.enableHigh ?? true,
      daysOfWeek,
      defaultPeriodsPerDay,
      dynamicPeriodsEnabled: schoolConfig?.dynamicPeriodsEnabled ?? false,
      periodsPerDayMap: schoolConfig?.periodsPerDayMap,
      categoryPeriodsEnabled: schoolConfig?.categoryPeriodsEnabled ?? false,
      categoryPeriodsMap: schoolConfig?.categoryPeriodsMap,
    });

    return {
      daysOfWeek,
      periodsPerDay: defaultPeriodsPerDay,
      periodsPerDayMap: canonicalPeriods.periodsPerDayMap,
      categoryPeriodsPerDayMap: canonicalPeriods.categoryPeriodsPerDayMap,
      schoolStartTime: schoolConfig?.schoolStartTime || '07:30',
      periodDurationMinutes: schoolConfig?.periodDuration || 45,
      timezone: schoolConfig?.timezone || 'Asia/Kabul',
      strategy: strategy || 'balanced',
      solverTimeLimitSeconds: 600,
      solverOptimizationLevel: 2,
      enableGracefulDegradation: true,
      enforceGenderSeparation: false,
      breakPeriods: schoolConfig?.breakPeriods || undefined,
      breakPeriodsByDay: schoolConfig?.breakPeriodsByDay || undefined,
      ramadanModeEnabled: schoolConfig?.ramadanModeEnabled ?? false,
      ramadanPeriodDuration: schoolConfig?.ramadanPeriodDuration ?? 35,
      ramadanBreakConfig: schoolConfig?.ramadanBreakConfig ?? undefined,
      enableMinistryValidation: schoolConfig?.enableMinistryValidation ?? false,
      ministryValidationMode: schoolConfig?.ministryValidationMode ?? 'warn',
      customCurriculumMode: schoolConfig?.customCurriculumMode ?? false,
      lowResourceMode: schoolConfig?.lowResourceMode ?? false,
    };
  }

  /**
   * Build preferences object for solver
   */
  private async buildPreferences(): Promise<SolverInput['preferences']> {
    try {
      const configRepo = ConfigRepository.getInstance(this.dataSource, this.cacheManager);
      const configValue = await configRepo.getConfiguration('optimization-preferences');

      if (configValue) {
        // Parse the stored preferences
        const storedPrefs = safeJsonParse<any>(configValue, null);

        if (storedPrefs) {
          return {
            avoidTeacherGapsWeight: storedPrefs.avoidTeacherGapsWeight ?? 1.0,
            avoidClassGapsWeight: storedPrefs.avoidClassGapsWeight ?? 1.0,
            distributeDifficultSubjectsWeight: storedPrefs.distributeDifficultSubjectsWeight ?? 0.8,
            balanceTeacherLoadWeight: storedPrefs.balanceTeacherLoadWeight ?? 0.7,
            minimizeRoomChangesWeight: storedPrefs.minimizeRoomChangesWeight ?? 0.3,
            preferMorningForDifficultWeight: storedPrefs.preferMorningForDifficultWeight ?? 0.5,
            respectTeacherTimePreferenceWeight:
              storedPrefs.respectTeacherTimePreferenceWeight ?? 0.5,
            respectTeacherRoomPreferenceWeight:
              storedPrefs.respectTeacherRoomPreferenceWeight ?? 0.2,
            respectTeacherAssignmentPreferenceWeight:
              storedPrefs.respectTeacherAssignmentPreferenceWeight ?? 0.8,
            respectPreferredColleaguesWeight:
              storedPrefs.respectPreferredColleaguesWeight ?? 0.3,
            preferClassHomeRoomWeight: storedPrefs.preferClassHomeRoomWeight ?? 5.0,
            respectSubjectDesiredFeaturesWeight:
              storedPrefs.respectSubjectDesiredFeaturesWeight ?? 0.3,
            allowConsecutivePeriodsForSameSubject:
              storedPrefs.allowConsecutivePeriodsForSameSubject ?? true,
            avoidFirstLastPeriodWeight: storedPrefs.avoidFirstLastPeriodWeight ?? 0.0,
            subjectSpreadWeight: storedPrefs.subjectSpreadWeight ?? 0.0,
          };
        }
      }
    } catch (error) {
      logger.error(
        'Failed to load optimization preferences from config',
        error instanceof Error ? error : new Error(String(error))
      );
    }

    // Fallback to defaults if config not found or error occurred
    return {
      avoidTeacherGapsWeight: 1.0,
      avoidClassGapsWeight: 1.0,
      distributeDifficultSubjectsWeight: 0.8,
      balanceTeacherLoadWeight: 0.7,
      minimizeRoomChangesWeight: 0.3,
      preferMorningForDifficultWeight: 0.5,
      respectTeacherTimePreferenceWeight: 0.5,
      respectTeacherRoomPreferenceWeight: 0.2,
      respectTeacherAssignmentPreferenceWeight: 0.8,
      respectPreferredColleaguesWeight: 0.3,
      preferClassHomeRoomWeight: 5.0,
      respectSubjectDesiredFeaturesWeight: 0.3,
      allowConsecutivePeriodsForSameSubject: true,
      avoidFirstLastPeriodWeight: 0.0,
      subjectSpreadWeight: 0.0,
    };
  }
}
