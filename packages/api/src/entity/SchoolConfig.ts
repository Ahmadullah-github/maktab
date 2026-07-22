import { BaseEntity, Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Break period configuration. */
export interface BreakPeriodConfig {
  afterPeriod: number;
  duration: number;
}

export interface BreakPeriodsByDayConfig {
  [day: string]: BreakPeriodConfig[];
}

/**
 * Shift configuration for multi-shift schools
 */
export interface ShiftConfig {
  morning: { start: string; end: string };
  afternoon: { start: string; end: string };
}

/**
 * Prayer break configuration
 */
export interface PrayerBreakConfig {
  name: string;
  time: string; // HH:mm format
  duration: number; // minutes
}

/**
 * SchoolConfig entity for storing school-wide configuration settings
 *
 * Requirements: 1.4, 7.1
 * - Stores day/period configuration
 * - Stores low-resource mode settings
 * - Supports future multi-tenancy via schoolId
 */
@Entity('school_config')
@Index(['schoolId'])
export class SchoolConfig extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer', nullable: true })
  schoolId: number | null = null; // For future multi-tenancy

  @Column({ type: 'integer', default: 1 })
  revision: number = 1;

  @Column({ type: 'text', nullable: true })
  schoolName: string | null = null;

  @Column({ type: 'boolean', default: true })
  enablePrimary: boolean = true; // Grades 1–6

  @Column({ type: 'boolean', default: true })
  enableMiddle: boolean = true; // Grades 7–9

  @Column({ type: 'boolean', default: true })
  enableHigh: boolean = true; // Grades 10–12

  @Column({ type: 'integer', default: 6 })
  daysPerWeek: number = 6;

  @Column({ type: 'integer', default: 7 })
  periodsPerDay: number = 7;

  @Column({ type: 'text', nullable: true })
  breakPeriods: string = '[]'; // JSON string: [{afterPeriod: number, duration: number}]

  @Column({ type: 'boolean', default: true })
  autoPopulateCurriculum: boolean = true; // Auto-populate subject requirements on class creation

  // =========================================================================
  // Resource Settings (Requirements: 4.1, 4.2, 4.3, 4.4, 4.5)
  // =========================================================================

  @Column({ type: 'boolean', default: false })
  lowResourceMode: boolean = false;

  /** Canonical, revisioned soft-objective profile for this school. */
  @Column({ type: 'text', nullable: true })
  optimizationPreferencesJson: string | null = null;

  // =========================================================================
  // Day Configuration (Requirements: 5.1, 5.2, 5.3, 5.4)
  // =========================================================================

  @Column({ type: 'text', nullable: true })
  daysOfWeekJson: string | null = null; // JSON array of day names

  @Column({ type: 'text', nullable: true })
  periodsPerDayMapJson: string | null = null; // JSON object {day: periods}

  @Column({ type: 'integer', default: 7 })
  defaultPeriodsPerDay: number = 7;

  // =========================================================================
  // School Settings (Requirements: 1.4, 1.5, 1.6)
  // =========================================================================

  @Column({ type: 'text', default: '07:30' })
  schoolStartTime: string = '07:30';

  @Column({ type: 'text', default: 'Asia/Kabul' })
  timezone: string = 'Asia/Kabul';

  @Column({ type: 'text', default: 'single' })
  shiftMode: string = 'single'; // 'single' | 'multi'

  @Column({ type: 'text', nullable: true })
  shiftsConfigJson: string | null = null; // JSON for shift times

  // =========================================================================
  // Period Structure Settings (Requirements: 2.3, 2.4, 3.5)
  // =========================================================================

  @Column({ type: 'integer', default: 45 })
  periodDuration: number = 45; // minutes

  @Column({ type: 'boolean', default: false })
  dynamicPeriodsEnabled: boolean = false;

  @Column({ type: 'boolean', default: false })
  categoryPeriodsEnabled: boolean = false;

  @Column({ type: 'text', nullable: true })
  categoryPeriodsMapJson: string | null = null; // JSON for category-based periods

  @Column({ type: 'text', nullable: true })
  breakPeriodsByDayJson: string | null = null; // JSON for per-day break overrides

  @Column({ type: 'text', nullable: true })
  prayerBreaksJson: string | null = null; // JSON for prayer break configs

  @Column({ type: 'boolean', default: false })
  prayerBreaksEnabled: boolean = false;

  // =========================================================================
  // Timestamps
  // =========================================================================

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date = new Date();

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date = new Date();

  // =========================================================================
  // Helper Methods for JSON Fields
  // =========================================================================

  /**
   * Get days of week as parsed array
   * Defaults to Afghan school week (Saturday-Thursday) if not set
   */
  get daysOfWeek(): string[] {
    if (!this.daysOfWeekJson) {
      return ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
    }
    try {
      return JSON.parse(this.daysOfWeekJson);
    } catch {
      return ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
    }
  }

  /**
   * Set days of week from array
   */
  set daysOfWeek(days: string[]) {
    this.daysOfWeekJson = JSON.stringify(days);
  }

  /**
   * Get periods per day map as parsed object
   */
  get periodsPerDayMap(): Record<string, number> | null {
    if (!this.periodsPerDayMapJson) return null;
    try {
      return JSON.parse(this.periodsPerDayMapJson);
    } catch {
      return null;
    }
  }

  /**
   * Set periods per day map from object
   */
  set periodsPerDayMap(map: Record<string, number> | null) {
    this.periodsPerDayMapJson = map ? JSON.stringify(map) : null;
  }

  /**
   * Get shifts configuration as parsed object
   */
  get shiftsConfig(): ShiftConfig | null {
    if (!this.shiftsConfigJson) return null;
    try {
      return JSON.parse(this.shiftsConfigJson);
    } catch {
      return null;
    }
  }

  /**
   * Set shifts configuration from object
   */
  set shiftsConfig(config: ShiftConfig | null) {
    this.shiftsConfigJson = config ? JSON.stringify(config) : null;
  }

  /**
   * Get category periods map as parsed object
   * Structure: { categoryKey: { day: periods } }
   */
  get categoryPeriodsMap(): Record<string, Record<string, number>> | null {
    if (!this.categoryPeriodsMapJson) return null;
    try {
      return JSON.parse(this.categoryPeriodsMapJson);
    } catch {
      return null;
    }
  }

  /**
   * Set category periods map from object
   */
  set categoryPeriodsMap(map: Record<string, Record<string, number>> | null) {
    this.categoryPeriodsMapJson = map ? JSON.stringify(map) : null;
  }

  /**
   * Get per-day break overrides as parsed object
   * Structure: { day: [{ afterPeriod, duration }] }
   */
  get breakPeriodsByDay(): BreakPeriodsByDayConfig | null {
    if (!this.breakPeriodsByDayJson) return null;
    try {
      return JSON.parse(this.breakPeriodsByDayJson);
    } catch {
      return null;
    }
  }

  /**
   * Set per-day break overrides from object
   */
  set breakPeriodsByDay(config: BreakPeriodsByDayConfig | null) {
    this.breakPeriodsByDayJson = config ? JSON.stringify(config) : null;
  }

  /**
   * Get prayer breaks configuration as parsed array
   */
  get prayerBreaks(): PrayerBreakConfig[] | null {
    if (!this.prayerBreaksJson) return null;
    try {
      return JSON.parse(this.prayerBreaksJson);
    } catch {
      return null;
    }
  }

  /**
   * Set prayer breaks configuration from array
   */
  set prayerBreaks(config: PrayerBreakConfig[] | null) {
    this.prayerBreaksJson = config ? JSON.stringify(config) : null;
  }
}
