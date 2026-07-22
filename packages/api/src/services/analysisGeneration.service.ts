import { DataSource } from 'typeorm';
import { ClassGroup } from '../entity/ClassGroup';
import { Room } from '../entity/Room';
import { Subject } from '../entity/Subject';
import { Teacher } from '../entity/Teacher';
import { SchoolProfile } from '../entity/SchoolProfile';
import { formatExportDateWithLunar } from '../utils/datePresentation';
import { getExportLessons, getPeriodsPerDayMap } from './exportTimetableNormalizer';

/**
 * Analysis summary data structure
 * Requirements: 3.3
 */
export interface AnalysisSummary {
  totalClasses: number;
  totalTeachers: number;
  totalSubjects: number;
  totalRooms: number;
  utilizationRate: number;
  conflictCount: number;
  generatedAt: string;
  schoolName?: string;
}

/**
 * Schedule data structure for analysis
 */
export interface ScheduleData {
  id: number;
  name: string;
  type: 'class' | 'teacher';
  targetId: string;
  timetableData: any;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function calculateAvailableClassPeriods(
  timetableData: Record<string, any> | null | undefined,
  fallbackClassIds: Iterable<string>
): number {
  const globalMap = getPeriodsPerDayMap(timetableData);
  const globalPeriodsPerWeek = Object.values(globalMap).reduce((sum, count) => sum + count, 0);
  const metadata = asRecord(timetableData?.metadata);
  const periodConfiguration =
    asRecord(metadata?.periodConfiguration) ?? asRecord(timetableData?.periodConfiguration);
  const rawCategoryMap = asRecord(periodConfiguration?.categoryPeriodsPerDayMap);
  const classes = Array.isArray(metadata?.classes) ? metadata.classes : [];

  if (classes.length === 0) {
    return Math.max(new Set(fallbackClassIds).size, 1) * globalPeriodsPerWeek;
  }

  return classes.reduce((total, rawClass) => {
    const classMetadata = asRecord(rawClass);
    const category = typeof classMetadata?.category === 'string' ? classMetadata.category : null;
    const categoryDayMap = category ? asRecord(rawCategoryMap?.[category]) : null;
    const categoryPeriods = categoryDayMap
      ? Object.values(categoryDayMap).reduce(
          (sum: number, value) => sum + (typeof value === 'number' ? value : 0),
          0
        )
      : 0;
    return total + (categoryPeriods > 0 ? categoryPeriods : globalPeriodsPerWeek);
  }, 0);
}

/**
 * Analysis Generation Service
 * Requirements: 3.3
 *
 * Generates comprehensive analysis summaries for batch exports
 * including school statistics and schedule utilization metrics
 */
export class AnalysisGenerationService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Generate analysis summary for batch exports
   * Requirements: 3.3
   */
  async generateAnalysisSummary(schedules: ScheduleData[]): Promise<AnalysisSummary> {
    try {
      // Get school statistics from database
      const [totalClasses, totalTeachers, totalSubjects, totalRooms] = await Promise.all([
        this.dataSource.getRepository(ClassGroup).count({ where: { isDeleted: false } }),
        this.dataSource.getRepository(Teacher).count({ where: { isDeleted: false } }),
        this.dataSource.getRepository(Subject).count({ where: { isDeleted: false } }),
        this.dataSource.getRepository(Room).count({ where: { isDeleted: false } }),
      ]);

      // Calculate utilization rate from schedule data
      const utilizationRate = this.calculateUtilizationRate(schedules);

      // Count conflicts in schedules
      const conflictCount = this.countConflicts(schedules);

      // Get school name from configuration (simplified)
      const schoolName = await this.getSchoolName();

      return {
        totalClasses,
        totalTeachers,
        totalSubjects,
        totalRooms,
        utilizationRate,
        conflictCount,
        generatedAt: new Date().toISOString(),
        schoolName,
      };
    } catch (error) {
      console.error('Failed to generate analysis summary:', error);
      throw new Error(
        `Analysis generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Calculate schedule utilization rate
   * Requirements: 3.3
   *
   * Utilization rate = (filled periods / total available periods) * 100
   */
  private calculateUtilizationRate(schedules: ScheduleData[]): number {
    if (schedules.length === 0) {
      return 0;
    }

    const uniqueFilledSlots = new Set<string>();

    for (const schedule of schedules) {
      for (const lesson of getExportLessons(schedule.timetableData)) {
        uniqueFilledSlots.add(
          `${lesson.classId ?? 'unknown'}:${String(lesson.day)}:${lesson.periodIndex}`
        );
      }
    }

    const uniqueClassIds = new Set(
      schedules.flatMap((schedule) =>
        getExportLessons(schedule.timetableData)
          .map((lesson) => lesson.classId)
          .filter((classId): classId is string => Boolean(classId))
      )
    );
    const totalPeriods = calculateAvailableClassPeriods(
      schedules[0].timetableData,
      uniqueClassIds
    );
    const filledPeriods = uniqueFilledSlots.size;

    return totalPeriods > 0 ? Math.round((filledPeriods / totalPeriods) * 100) : 0;
  }

  /**
   * Count scheduling conflicts across all schedules
   * Requirements: 3.3
   *
   * Conflicts include:
   * - Teacher double-booking (same teacher in multiple classes at same time)
   * - Room double-booking (same room assigned to multiple classes at same time)
   */
  private countConflicts(schedules: ScheduleData[]): number {
    let conflictCount = 0;
    const teacherSchedule = new Map<string, Set<string>>(); // teacherId -> Set of "day-period"
    const roomSchedule = new Map<string, Set<string>>(); // roomId -> Set of "day-period"
    const seenLessons = new Set<string>();

    for (const schedule of schedules) {
      for (const lesson of getExportLessons(schedule.timetableData)) {
        const lessonKey = [
          lesson.classId ?? 'unknown',
          String(lesson.day),
          lesson.periodIndex,
          lesson.subjectId ?? 'unknown',
          lesson.teacherIds.join(','),
          lesson.roomId ?? 'unknown',
        ].join(':');

        if (seenLessons.has(lessonKey)) {
          continue;
        }
        seenLessons.add(lessonKey);

        const timeSlot = `${String(lesson.day)}-${lesson.periodIndex}`;

        for (const teacherId of lesson.teacherIds) {
          if (!teacherSchedule.has(teacherId)) {
            teacherSchedule.set(teacherId, new Set());
          }
          const teacherSlots = teacherSchedule.get(teacherId)!;
          if (teacherSlots.has(timeSlot)) {
            conflictCount++;
          } else {
            teacherSlots.add(timeSlot);
          }
        }

        if (lesson.roomId) {
          if (!roomSchedule.has(lesson.roomId)) {
            roomSchedule.set(lesson.roomId, new Set());
          }
          const roomSlots = roomSchedule.get(lesson.roomId)!;
          if (roomSlots.has(timeSlot)) {
            conflictCount++;
          } else {
            roomSlots.add(timeSlot);
          }
        }
      }
    }

    return conflictCount;
  }

  /** Get the canonical school name from the installation profile. */
  private async getSchoolName(): Promise<string | undefined> {
    const profile = await this.dataSource.getRepository(SchoolProfile).findOne({ where: { id: 1 } });
    return profile?.officialName.trim() || undefined;
  }

  /**
   * Generate detailed analysis content for PDF inclusion
   * Requirements: 3.3
   *
   * Returns formatted analysis content suitable for PDF generation
   */
  async generateAnalysisContent(
    summary: AnalysisSummary,
    language: 'fa' | 'en' = 'fa'
  ): Promise<string> {
    const isRTL = language === 'fa';

    if (isRTL) {
      return `
        <div dir="rtl" style="font-family: 'Vazirmatn', sans-serif; text-align: right;">
          <h1 style="text-align: center; margin-bottom: 30px;">گزارش تحلیلی برنامه درسی</h1>

          <div style="margin-bottom: 20px;">
            <h2>آمار کلی مدرسه</h2>
            <ul>
              <li>تعداد کل کلاس‌ها: ${summary.totalClasses}</li>
              <li>تعداد کل اساتید: ${summary.totalTeachers}</li>
              <li>تعداد کل مواد درسی: ${summary.totalSubjects}</li>
              <li>تعداد کل اتاق‌ها: ${summary.totalRooms}</li>
            </ul>
          </div>

          <div style="margin-bottom: 20px;">
            <h2>تحلیل برنامه درسی</h2>
            <ul>
              <li>نرخ استفاده از برنامه: ${summary.utilizationRate}%</li>
              <li>تعداد تداخل‌ها: ${summary.conflictCount}</li>
            </ul>
          </div>

          <div style="margin-bottom: 20px;">
            <h2>اطلاعات تولید گزارش</h2>
            <ul>
              <li>تاریخ تولید: ${formatExportDateWithLunar(summary.generatedAt, 'fa').primary}</li>
              <li>هجری قمری محاسبه‌شده: ${formatExportDateWithLunar(summary.generatedAt, 'fa').lunar}</li>
              ${summary.schoolName ? `<li>نام مدرسه: ${summary.schoolName}</li>` : ''}
            </ul>
          </div>
        </div>
      `;
    } else {
      return `
        <div dir="ltr" style="font-family: 'Inter', sans-serif; text-align: left;">
          <h1 style="text-align: center; margin-bottom: 30px;">Schedule Analysis Report</h1>

          <div style="margin-bottom: 20px;">
            <h2>School Statistics</h2>
            <ul>
              <li>Total Classes: ${summary.totalClasses}</li>
              <li>Total Teachers: ${summary.totalTeachers}</li>
              <li>Total Subjects: ${summary.totalSubjects}</li>
              <li>Total Rooms: ${summary.totalRooms}</li>
            </ul>
          </div>

          <div style="margin-bottom: 20px;">
            <h2>Schedule Analysis</h2>
            <ul>
              <li>Utilization Rate: ${summary.utilizationRate}%</li>
              <li>Conflict Count: ${summary.conflictCount}</li>
            </ul>
          </div>

          <div style="margin-bottom: 20px;">
            <h2>Report Information</h2>
            <ul>
              <li>Generated At: ${formatExportDateWithLunar(summary.generatedAt, 'en').primary}</li>
              <li>Calculated Lunar Hijri: ${formatExportDateWithLunar(summary.generatedAt, 'en').lunar}</li>
              ${summary.schoolName ? `<li>School Name: ${summary.schoolName}</li>` : ''}
            </ul>
          </div>
        </div>
      `;
    }
  }
}
