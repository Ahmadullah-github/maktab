import ExcelJS from 'exceljs';
import { ExportBranding } from '../types/exportBranding.types';
import { formatExportDateWithLunar } from '../utils/datePresentation';
import {
  getBreakIntervals,
  getDaysOfWeek,
  getLessonForSlot,
  getMaxPeriods,
  getPeriodTimeRange,
} from './exportTimetableNormalizer';

/**
 * Display settings for export
 * Requirements: 7.2
 */
export interface DisplaySettings {
  showSubjectName: boolean;
  showTeacherName: boolean;
  showRoomName: boolean;
  cellSize: 'compact' | 'normal' | 'large';
  fontSize: 'sm' | 'md' | 'lg';
  colorBy: 'none' | 'subject' | 'teacher';
}

/**
 * Schedule data structure for Excel generation
 */
export interface ScheduleData {
  id: number;
  name: string;
  type: 'class' | 'teacher';
  targetId: string;
  classTeacherName?: string | null;
  timetableData: any;
}

/**
 * Excel generation options
 * Requirements: 6.1, 6.2, 6.3, 6.5
 */
export interface ExcelGenerationOptions {
  schedules: ScheduleData[];
  language: 'fa' | 'en';
  displaySettings: DisplaySettings;
  branding: ExportBranding;
}

/**
 * Excel Generation Service using ExcelJS
 * Requirements: 6.1, 6.2, 6.3, 6.5, 7.2
 *
 * Handles Excel generation with RTL support, styled headers,
 * and display settings integration
 */
export class ExcelGenerationService {
  // Color palettes for subject and teacher color coding
  private readonly subjectColors = [
    'FEF3C7',
    'FDE68A',
    'FCD34D',
    'F59E0B', // Yellow family
    'DBEAFE',
    'BFDBFE',
    '93C5FD',
    '3B82F6', // Blue family
    'D1FAE5',
    'A7F3D0',
    '6EE7B7',
    '10B981', // Green family
    'FCE7F3',
    'FBCFE8',
    'F9A8D4',
    'EC4899', // Pink family
    'E0E7FF',
    'C7D2FE',
    'A5B4FC',
    '6366F1', // Indigo family
  ];

  private readonly teacherColors = [
    'FEF2F2',
    'FECACA',
    'F87171',
    'DC2626', // Red family
    'FFF7ED',
    'FED7AA',
    'FB923C',
    'EA580C', // Orange family
    'F0FDF4',
    'BBF7D0',
    '4ADE80',
    '16A34A', // Emerald family
    'F0F9FF',
    'BAE6FD',
    '0EA5E9',
    '0284C7', // Sky family
    'FAF5FF',
    'E9D5FF',
    'A855F7',
    '9333EA', // Purple family
  ];

  /**
   * Generate Excel file from schedule data
   * Requirements: 6.1, 6.2, 6.3, 6.5
   */
  async generateExcel(options: ExcelGenerationOptions): Promise<Buffer> {
    const { schedules, language, displaySettings, branding } = options;

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = branding.schoolName;
    workbook.created = new Date();

    // Track used worksheet names to avoid duplicates
    const usedNames = new Set<string>();

    // Add worksheets for each schedule (Requirements: 6.3)
    for (const schedule of schedules) {
      await this.addScheduleWorksheet(
        workbook,
        schedule,
        language,
        displaySettings,
        usedNames,
        branding
      );
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Add a worksheet for a single schedule
   * Requirements: 6.1, 6.2, 6.3, 6.5
   */
  private async addScheduleWorksheet(
    workbook: ExcelJS.Workbook,
    schedule: ScheduleData,
    language: 'fa' | 'en',
    displaySettings: DisplaySettings,
    usedNames: Set<string>,
    branding: ExportBranding
  ): Promise<void> {
    const dayKeys = getDaysOfWeek(schedule.timetableData);

    // Create worksheet with sanitized unique name (max 31 chars for Excel)
    const worksheetName = this.getUniqueWorksheetName(schedule.name, usedNames);
    usedNames.add(worksheetName);
    const worksheet = workbook.addWorksheet(worksheetName);

    // Configure RTL for worksheet (Requirements: 6.1)
    this.configureRTL(worksheet, language);

    // Set up column widths
    this.setupColumns(worksheet, dayKeys.length);

    // Add title row
    this.addTitleRow(worksheet, schedule, language, dayKeys.length, branding);
    this.addBrandingMetadata(workbook, worksheet, language, dayKeys.length, branding);

    // Add header row (Requirements: 6.2)
    this.addHeaderRow(worksheet, language, dayKeys);

    // Add schedule data rows (Requirements: 6.5)
    this.addScheduleData(worksheet, schedule, displaySettings, language);
    this.addBreakIntervals(worksheet, schedule, language);

    // Apply styling
    this.applyWorksheetStyling(worksheet);
  }

  /**
   * Configure RTL settings for worksheet
   * Requirements: 6.1
   * Sets worksheet.views[0].rightToLeft = true for RTL support
   */
  private configureRTL(worksheet: ExcelJS.Worksheet, language: 'fa' | 'en'): void {
    // Set RTL view for all worksheets (Requirements: 6.1)
    worksheet.views = [
      {
        rightToLeft: true, // Always set RTL for proper Persian support
        state: 'normal',
      },
    ];
  }

  /**
   * Set up column widths for the schedule grid
   */
  private setupColumns(worksheet: ExcelJS.Worksheet, dayCount: number): void {
    // First column for period/time
    worksheet.getColumn(1).width = 15;

    for (let index = 0; index < dayCount; index++) {
      worksheet.getColumn(index + 2).width = 20;
    }
  }

  /**
   * Add title row to worksheet
   */
  private addTitleRow(
    worksheet: ExcelJS.Worksheet,
    schedule: ScheduleData,
    language: 'fa' | 'en',
    dayCount: number,
    branding: ExportBranding
  ): void {
    const title =
      language === 'fa'
        ? `برنامه درسی ${schedule.type === 'class' ? 'کلاس' : 'استاد'} ${schedule.name}`
        : `${schedule.type === 'class' ? 'Class' : 'Teacher'} ${schedule.name} Schedule`;

    // Merge cells for title
    worksheet.mergeCells(1, 1, 1, dayCount + 1);
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `${branding.schoolName} — ${title}`;
    titleCell.font = {
      bold: true,
      size: 16,
      color: { argb: '1E3A8A' },
    };
    titleCell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'F3F4F6' },
    };
    worksheet.getRow(1).height = 38;
  }

  private addBrandingMetadata(
    workbook: ExcelJS.Workbook,
    worksheet: ExcelJS.Worksheet,
    language: 'fa' | 'en',
    dayCount: number,
    branding: ExportBranding
  ): void {
    const dates = formatExportDateWithLunar(branding.generatedAt, language, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    worksheet.mergeCells(2, 1, 2, dayCount + 1);
    const metadataCell = worksheet.getCell('A2');
    metadataCell.value =
      language === 'fa'
        ? `تاریخ تولید: ${dates.primary} | هجری قمری محاسبه‌شده: ${dates.lunar}`
        : `Generated At: ${dates.primary} | Calculated Lunar Hijri: ${dates.lunar}`;
    metadataCell.font = { size: 10, color: { argb: '64748B' } };
    metadataCell.alignment = { horizontal: 'center', vertical: 'middle' };

    if (
      branding.logoBase64 &&
      (branding.logoMimeType === 'image/png' || branding.logoMimeType === 'image/jpeg')
    ) {
      const imageId = workbook.addImage({
        base64: `data:${branding.logoMimeType};base64,${branding.logoBase64}`,
        extension: branding.logoMimeType === 'image/png' ? 'png' : 'jpeg',
      });
      worksheet.addImage(imageId, {
        tl: { col: 0.1, row: 0.1 },
        ext: { width: 32, height: 32 },
      });
    }
  }

  /**
   * Add header row with day names
   * Requirements: 6.2
   */
  private addHeaderRow(
    worksheet: ExcelJS.Worksheet,
    language: 'fa' | 'en',
    dayKeys: string[]
  ): void {
    const headerRow = worksheet.getRow(3);

    // Time/Period header
    const timeHeader = headerRow.getCell(1);
    timeHeader.value = language === 'fa' ? 'زمان' : 'Time';
    this.applyHeaderStyle(timeHeader);

    // Day headers
    for (let i = 0; i < dayKeys.length; i++) {
      const cell = headerRow.getCell(i + 2);
      cell.value = this.getDayLabel(dayKeys[i], language);
      this.applyHeaderStyle(cell);
    }

    headerRow.height = 25;
  }

  /**
   * Apply header cell styling
   * Requirements: 6.2
   */
  private applyHeaderStyle(cell: ExcelJS.Cell): void {
    cell.font = {
      bold: true,
      size: 12,
      color: { argb: '1F2937' },
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'D1D5DB' },
    };
    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    cell.border = {
      top: { style: 'thin', color: { argb: '374151' } },
      left: { style: 'thin', color: { argb: '374151' } },
      bottom: { style: 'thin', color: { argb: '374151' } },
      right: { style: 'thin', color: { argb: '374151' } },
    };
  }

  /**
   * Add schedule data to worksheet
   * Requirements: 6.5, 7.2
   */
  private addScheduleData(
    worksheet: ExcelJS.Worksheet,
    schedule: ScheduleData,
    displaySettings: DisplaySettings,
    language: 'fa' | 'en'
  ): void {
    const dayKeys = getDaysOfWeek(schedule.timetableData);
    const periods = Math.max(getMaxPeriods(schedule.timetableData), 1);

    for (let period = 1; period <= periods; period++) {
      const rowIndex = period + 3; // Start after title and header rows
      const row = worksheet.getRow(rowIndex);

      // Period/Time cell
      const timeCell = row.getCell(1);
      timeCell.value = language === 'fa' ? `ساعت ${period}` : `Period ${period}`;
      this.applyTimeCellStyle(timeCell);

      // Day cells
      for (let day = 0; day < dayKeys.length; day++) {
        const cell = row.getCell(day + 2);
        const cellData = this.getCellData(schedule.timetableData, day, period);
        const cellContent = this.formatCellContent(cellData, displaySettings, language);
        const timing = getPeriodTimeRange(schedule.timetableData, dayKeys[day], period - 1);

        cell.value = timing
          ? `${timing.startTime}–${timing.endTime}${cellContent ? `\n${cellContent}` : ''}`
          : cellContent;
        this.applyDataCellStyle(cell, cellData, displaySettings);
        cell.alignment = { ...cell.alignment, wrapText: true };
      }

      row.height = this.getRowHeight(displaySettings);
    }
  }

  private addBreakIntervals(
    worksheet: ExcelJS.Worksheet,
    schedule: ScheduleData,
    language: 'fa' | 'en'
  ): void {
    const days = getDaysOfWeek(schedule.timetableData);
    let rowIndex = Math.max(getMaxPeriods(schedule.timetableData), 1) + 5;
    for (const day of days) {
      const intervals = getBreakIntervals(schedule.timetableData, day);
      if (intervals.length === 0) continue;
      const row = worksheet.getRow(rowIndex++);
      row.getCell(1).value = language === 'fa' ? `وقفه‌های ${day}` : `${day} breaks`;
      worksheet.mergeCells(row.number, 2, row.number, days.length + 1);
      row.getCell(2).value = intervals
        .map((interval) => {
          const label =
            interval.kind === 'prayer'
              ? interval.name || (language === 'fa' ? 'وقفه نماز' : 'Prayer break')
              : language === 'fa'
                ? 'تفریح'
                : 'Break';
          return `${label}: ${interval.startTime}–${interval.endTime}`;
        })
        .join(' | ');
      row.getCell(1).font = { bold: true };
      row.getCell(2).alignment = { wrapText: true };
    }
  }

  /**
   * Get cell data from timetable
   */
  private getCellData(timetableData: any, day: number, period: number): any {
    try {
      const lesson = getLessonForSlot(timetableData, day, period);
      if (lesson) {
        return {
          subjectName: lesson.subjectName || `Subject ${day}-${period}`,
          teacherName: lesson.teacherNames?.[0] || `Teacher ${day}-${period}`,
          roomName: lesson.roomName || `Room ${day}-${period}`,
          subjectId: lesson.subjectId || `subj_${day}_${period}`,
          teacherId: lesson.teacherIds?.[0] || `teacher_${day}_${period}`,
        };
      }

      return null;
    } catch (error) {
      console.warn('Error parsing cell data:', error);
      return null;
    }
  }

  /**
   * Format cell content based on display settings
   * Requirements: 7.2
   */
  private formatCellContent(
    cellData: any,
    displaySettings: DisplaySettings,
    language: 'fa' | 'en'
  ): string {
    if (!cellData || !cellData.subjectName) {
      return '';
    }

    const parts: string[] = [];

    // Always show subject name
    parts.push(cellData.subjectName);

    // Show teacher name only if enabled (Requirements: 7.2)
    if (displaySettings.showTeacherName && cellData.teacherName) {
      parts.push(cellData.teacherName);
    }

    // Show room name only if enabled (Requirements: 7.2)
    if (displaySettings.showRoomName && cellData.roomName) {
      parts.push(cellData.roomName);
    }

    return parts.join('\n');
  }

  /**
   * Apply styling to time/period cells
   */
  private applyTimeCellStyle(cell: ExcelJS.Cell): void {
    cell.font = {
      bold: true,
      size: 11,
      color: { argb: '374151' },
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'E5E7EB' },
    };
    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    cell.border = {
      top: { style: 'thin', color: { argb: '374151' } },
      left: { style: 'thin', color: { argb: '374151' } },
      bottom: { style: 'thin', color: { argb: '374151' } },
      right: { style: 'thin', color: { argb: '374151' } },
    };
  }

  /**
   * Apply styling to data cells with color coding
   * Requirements: 7.2
   */
  private applyDataCellStyle(
    cell: ExcelJS.Cell,
    cellData: any,
    displaySettings: DisplaySettings
  ): void {
    cell.font = {
      size: 10,
      color: { argb: '1F2937' },
    };
    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
    };
    cell.border = {
      top: { style: 'thin', color: { argb: '9CA3AF' } },
      left: { style: 'thin', color: { argb: '9CA3AF' } },
      bottom: { style: 'thin', color: { argb: '9CA3AF' } },
      right: { style: 'thin', color: { argb: '9CA3AF' } },
    };

    // Apply color coding based on display settings
    if (cellData && displaySettings.colorBy !== 'none') {
      const color = this.getCellColor(cellData, displaySettings.colorBy);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: color },
      };
    }
  }

  /**
   * Get color for cell based on color coding setting
   */
  private getCellColor(cellData: any, colorBy: string): string {
    if (colorBy === 'none' || !cellData) return 'FFFFFF';

    let colorIndex = 0;
    if (colorBy === 'subject' && cellData.subjectId) {
      colorIndex = this.hashStringToIndex(cellData.subjectId.toString(), this.subjectColors.length);
      return this.subjectColors[colorIndex];
    } else if (colorBy === 'teacher' && cellData.teacherId) {
      colorIndex = this.hashStringToIndex(cellData.teacherId.toString(), this.teacherColors.length);
      return this.teacherColors[colorIndex];
    }

    return 'FFFFFF';
  }

  /**
   * Hash string to consistent index for color assignment
   */
  private hashStringToIndex(str: string, maxIndex: number): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash) % maxIndex;
  }

  /**
   * Get row height based on display settings
   */
  private getRowHeight(displaySettings: DisplaySettings): number {
    const baseHeight =
      displaySettings.cellSize === 'compact' ? 25 : displaySettings.cellSize === 'large' ? 45 : 35;

    // Add extra height if showing multiple lines
    let extraLines = 0;
    if (displaySettings.showTeacherName) extraLines++;
    if (displaySettings.showRoomName) extraLines++;

    return baseHeight + extraLines * 10;
  }

  /**
   * Apply final worksheet styling
   */
  private applyWorksheetStyling(worksheet: ExcelJS.Worksheet): void {
    // Freeze the header row while preserving RTL setting
    const currentView = worksheet.views[0] || {};
    worksheet.views = [
      {
        rightToLeft: currentView.rightToLeft ?? true,
        state: 'frozen' as const,
        ySplit: 3, // Freeze title and header rows
      },
    ];
  }

  /**
   * Sanitize worksheet name for Excel compatibility
   * Excel worksheet names have max 31 characters and cannot contain: \ / * ? : [ ]
   * Also cannot start or end with single quote (')
   */
  private sanitizeWorksheetName(name: string): string {
    let sanitized = name
      .replace(/[\\/*?:\[\]]/g, '-')
      .substring(0, 31)
      .trim();

    // Remove leading/trailing single quotes (Excel restriction)
    while (sanitized.startsWith("'")) {
      sanitized = sanitized.substring(1);
    }
    while (sanitized.endsWith("'")) {
      sanitized = sanitized.substring(0, sanitized.length - 1);
    }

    // Trim again after removing quotes
    sanitized = sanitized.trim();

    return sanitized || 'Sheet';
  }

  /**
   * Get a unique worksheet name, appending a number if necessary
   */
  private getUniqueWorksheetName(name: string, usedNames: Set<string>): string {
    let sanitized = this.sanitizeWorksheetName(name);

    // If name is empty after sanitization, use default
    if (!sanitized) {
      sanitized = 'Sheet';
    }

    // If name is already unique, return it
    if (!usedNames.has(sanitized)) {
      return sanitized;
    }

    // Otherwise, append a number to make it unique
    let counter = 1;
    let uniqueName = sanitized;

    // Truncate base name to leave room for counter suffix
    const maxBaseLength = 28; // Leave room for " (99)"
    const baseName = sanitized.substring(0, maxBaseLength);

    while (usedNames.has(uniqueName)) {
      uniqueName = `${baseName} (${counter})`;
      counter++;

      // Safety check to prevent infinite loop
      if (counter > 999) {
        uniqueName = `Sheet ${Date.now()}`.substring(0, 31);
        break;
      }
    }

    return uniqueName;
  }

  /**
   * Check if worksheet has RTL configuration
   * Requirements: 6.1
   * Used for property testing
   */
  isRTLConfigured(worksheet: ExcelJS.Worksheet): boolean {
    return worksheet.views.length > 0 && worksheet.views[0].rightToLeft === true;
  }

  private getDayLabel(day: string, language: 'fa' | 'en'): string {
    if (language === 'en') {
      return day;
    }

    const labels: Record<string, string> = {
      Saturday: 'شنبه',
      Sunday: 'یکشنبه',
      Monday: 'دوشنبه',
      Tuesday: 'سه‌شنبه',
      Wednesday: 'چهارشنبه',
      Thursday: 'پنج‌شنبه',
      Friday: 'جمعه',
    };

    return labels[day] ?? day;
  }
}
