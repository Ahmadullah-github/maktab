import ExcelJS from 'exceljs';
import { ExportBranding } from '../types/exportBranding.types';
import { formatExportDateWithLunar } from '../utils/datePresentation';
import { ExportError, ExportErrorHandler } from './exportError.service';
import {
  ExportLesson,
  getBreakIntervals,
  getDaysOfWeek,
  getLessonForSlot,
  getMaxPeriods,
  getPeriodTimeRange,
  getPeriodsPerDayMap,
} from './exportTimetableNormalizer';

export interface DisplaySettings {
  showSubjectName: boolean;
  showTeacherName: boolean;
  showRoomName: boolean;
  cellSize: 'compact' | 'normal' | 'large';
  fontSize: 'sm' | 'md' | 'lg';
  colorBy: 'none' | 'subject' | 'teacher';
}

export interface ScheduleData {
  id: number;
  name: string;
  type: 'class' | 'teacher';
  targetId: string;
  classTeacherName?: string | null;
  timetableData: any;
}

export interface ExcelGenerationOptions {
  schedules: ScheduleData[];
  language: 'fa' | 'en';
  displaySettings: DisplaySettings;
  branding: ExportBranding;
}

interface WorkbookImageIds {
  school?: number;
  ministry?: number;
}

interface ScheduleCellData {
  lesson: ExportLesson | null;
  content: string;
  hasVariableTime: boolean;
  timeRange: string | null;
}

/**
 * Generates portable, editable OOXML workbooks. The workbook deliberately uses
 * plain cell values and standard formatting only: no macros, formulas, external
 * links, form controls, or protected worksheets.
 */
export class ExcelGenerationService {
  private readonly subjectColors = [
    'FFF7D6',
    'EAF3FF',
    'EAF8EF',
    'FCEEF5',
    'F1EFFF',
    'FFF0E6',
    'EAF8F8',
    'F3F4F6',
  ];

  private readonly teacherColors = [
    'FDECEC',
    'FFF2DE',
    'EAF8EF',
    'EAF5FC',
    'F3EDFF',
    'FCEEF5',
    'EDF5E8',
    'F3F4F6',
  ];

  async generateExcel(options: ExcelGenerationOptions): Promise<Buffer> {
    const { schedules, language, displaySettings, branding } = options;
    if (!Array.isArray(schedules) || schedules.length === 0) {
      throw ExportErrorHandler.validationError('At least one schedule is required', {
        field: 'schedules',
      });
    }

    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = branding.schoolName;
      workbook.company = branding.schoolName;
      workbook.created = new Date(branding.generatedAt);
      workbook.modified = new Date(branding.generatedAt);
      workbook.subject = language === 'fa' ? 'برنامه درسی هفتگی' : 'Weekly timetable';
      workbook.title = language === 'fa' ? 'برنامه درسی مکتب' : 'School timetable';

      const imageIds = this.registerWorkbookImages(workbook, branding);
      const usedNames = new Set<string>();
      this.addGuideWorksheet(workbook, usedNames, branding);

      for (const schedule of schedules) {
        this.addScheduleWorksheet(
          workbook,
          schedule,
          language,
          displaySettings,
          usedNames,
          branding,
          imageIds
        );
      }

      const buffer = await workbook.xlsx.writeBuffer();
      return Buffer.from(buffer);
    } catch (error) {
      if (error instanceof ExportError) throw error;
      throw ExportErrorHandler.excelGenerationError(
        error instanceof Error ? error : new Error(String(error)),
        { scheduleCount: schedules.length, language, stage: 'workbook-generation' }
      );
    }
  }

  private registerWorkbookImages(
    workbook: ExcelJS.Workbook,
    branding: ExportBranding
  ): WorkbookImageIds {
    const ids: WorkbookImageIds = {};

    if (
      branding.logoBase64 &&
      (branding.logoMimeType === 'image/png' || branding.logoMimeType === 'image/jpeg')
    ) {
      ids.school = workbook.addImage({
        base64: `data:${branding.logoMimeType};base64,${branding.logoBase64}`,
        extension: branding.logoMimeType === 'image/png' ? 'png' : 'jpeg',
      });
    }

    if (branding.ministryLogoBase64 && branding.ministryLogoMimeType === 'image/png') {
      ids.ministry = workbook.addImage({
        base64: `data:image/png;base64,${branding.ministryLogoBase64}`,
        extension: 'png',
      });
    }

    return ids;
  }

  private addGuideWorksheet(
    workbook: ExcelJS.Workbook,
    usedNames: Set<string>,
    branding: ExportBranding
  ): void {
    const name = 'Guide - راهنما';
    const worksheet = workbook.addWorksheet(name);
    usedNames.add(name);
    worksheet.properties.defaultRowHeight = 24;
    worksheet.views = [{ rightToLeft: false, showGridLines: false, state: 'frozen', ySplit: 3 }];
    worksheet.columns = [{ width: 8 }, { width: 58 }, { width: 58 }];

    worksheet.mergeCells('A1:C1');
    const title = worksheet.getCell('A1');
    title.value = `${branding.schoolName} — Workbook Guide / راهنمای فایل`;
    title.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    title.fill = this.solidFill('18243A');
    title.alignment = { horizontal: 'center', vertical: 'middle' };
    title.protection = { locked: false };
    worksheet.getRow(1).height = 34;

    const subtitle = worksheet.getCell('A2');
    worksheet.mergeCells('A2:C2');
    subtitle.value =
      'This workbook is editable in modern spreadsheet applications. این فایل در برنامه‌های صفحه‌گسترده قابل ویرایش است.';
    subtitle.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF475569' } };
    subtitle.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    subtitle.protection = { locked: false };

    const header = worksheet.getRow(3);
    header.values = ['#', 'English guidance', 'راهنمای فارسی'];
    header.eachCell((cell) => this.applyGuideHeader(cell));
    header.getCell(3).alignment = {
      horizontal: 'right',
      vertical: 'middle',
      readingOrder: 'rtl',
    };

    const guidance: Array<[string, string]> = [
      [
        'Editing: click any timetable cell and change its text. Worksheets are intentionally not protected.',
        'ویرایش: روی هر خانه برنامه کلیک کرده و متن آن را تغییر دهید. برگه‌ها عمداً قفل نشده‌اند.',
      ],
      [
        'Class schedule cells: subject, teacher name(s), then room when room display is enabled.',
        'خانه‌های برنامه صنف: مضمون، نام استاد یا استادان، و سپس اتاق در صورت فعال بودن نمایش اتاق.',
      ],
      [
        'Teacher schedule cells: class first, then subject, then room when room display is enabled.',
        'خانه‌های برنامه استاد: نخست صنف، سپس مضمون، و بعد اتاق در صورت فعال بودن نمایش اتاق.',
      ],
      [
        'Blank or grey cells mean that no lesson is scheduled or that the period is unavailable on that day.',
        'خانه خالی یا خاکستری یعنی درسی تعیین نشده یا آن ساعت در آن روز موجود نیست.',
      ],
      [
        'Printing: each schedule sheet is set to A4 landscape and scaled to one page. Review Print Preview before printing.',
        'چاپ: هر برگه برنامه روی A4 افقی و یک‌صفحه‌ای تنظیم شده است. پیش از چاپ، پیش‌نمایش چاپ را بررسی کنید.',
      ],
      [
        'Compatibility: use the .xlsx file in Microsoft Excel, LibreOffice Calc, Google Sheets import, Apple Numbers, or a modern mobile spreadsheet app.',
        'سازگاری: فایل xlsx را در Microsoft Excel، LibreOffice Calc، واردسازی Google Sheets، Apple Numbers یا برنامه جدید موبایل باز کنید.',
      ],
      [
        'Important: edits remain only in this file. They are not imported back into Maktab.',
        'مهم: تغییرات فقط در همین فایل باقی می‌ماند و دوباره به سیستم مکتب وارد نمی‌شود.',
      ],
    ];

    guidance.forEach(([english, persian], index) => {
      const row = worksheet.getRow(index + 4);
      row.getCell(1).value = index + 1;
      row.getCell(2).value = english;
      row.getCell(3).value = persian;
      row.height = index === guidance.length - 1 ? 46 : 40;

      row.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 10.5, color: { argb: 'FF1F2937' } };
        cell.fill = this.solidFill(index % 2 === 0 ? 'FFFDF9' : 'F8FAFC');
        cell.border = this.standardBorder('D8DEE8');
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        cell.protection = { locked: false };
      });
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(3).alignment = {
        horizontal: 'right',
        vertical: 'middle',
        wrapText: true,
        readingOrder: 'rtl',
      };
    });

    this.configurePage(worksheet, 1, guidance.length + 3, 3);
    worksheet.headerFooter.oddFooter =
      '&LWorkbook Guide / راهنما&C' +
      this.escapeHeaderFooter(branding.schoolName) +
      '&RPage &P of &N';
  }

  private addScheduleWorksheet(
    workbook: ExcelJS.Workbook,
    schedule: ScheduleData,
    language: 'fa' | 'en',
    displaySettings: DisplaySettings,
    usedNames: Set<string>,
    branding: ExportBranding,
    imageIds: WorkbookImageIds
  ): void {
    const dayKeys = getDaysOfWeek(schedule.timetableData);
    const periodCount = Math.min(Math.max(getMaxPeriods(schedule.timetableData), 1), 12);
    const totalColumns = periodCount + 1;
    const worksheetName = this.getUniqueWorksheetName(schedule.name, usedNames);
    usedNames.add(worksheetName);
    const worksheet = workbook.addWorksheet(worksheetName);

    this.configureRTL(worksheet, language);
    this.setupColumns(worksheet, periodCount);
    this.addBrandHeader(worksheet, branding, imageIds, totalColumns, language);
    this.addScheduleHeading(worksheet, schedule, language, branding, totalColumns);
    this.addGridHeader(worksheet, schedule, language, periodCount);
    let lastRow = this.addScheduleRows(
      worksheet,
      schedule,
      language,
      displaySettings,
      dayKeys,
      periodCount
    );
    lastRow = this.addBreakNotes(worksheet, schedule, language, dayKeys, totalColumns, lastRow + 2);

    worksheet.properties.defaultRowHeight = 20;
    this.configurePage(worksheet, 1, lastRow, totalColumns);
    worksheet.pageSetup.printTitlesRow = '1:7';
    worksheet.headerFooter.oddFooter = this.getSheetFooter(branding, language);
  }

  private configureRTL(worksheet: ExcelJS.Worksheet, language: 'fa' | 'en'): void {
    worksheet.views = [
      {
        rightToLeft: language === 'fa',
        showGridLines: false,
        state: 'frozen',
        ySplit: 7,
        xSplit: 1,
        topLeftCell: 'B8',
      },
    ];
  }

  private setupColumns(worksheet: ExcelJS.Worksheet, periodCount: number): void {
    worksheet.getColumn(1).width = 15;
    const periodWidth = Math.max(10.5, Math.min(18, 116 / periodCount));
    for (let period = 1; period <= periodCount; period++) {
      worksheet.getColumn(period + 1).width = periodWidth;
    }
  }

  private addBrandHeader(
    worksheet: ExcelJS.Worksheet,
    branding: ExportBranding,
    imageIds: WorkbookImageIds,
    totalColumns: number,
    language: 'fa' | 'en'
  ): void {
    const hasSeparateRegions = totalColumns >= 4;
    if (hasSeparateRegions) {
      worksheet.mergeCells(1, 1, 3, 1);
      worksheet.mergeCells(1, 2, 3, totalColumns - 1);
      worksheet.mergeCells(1, totalColumns, 3, totalColumns);
    } else {
      worksheet.mergeCells(1, 1, 3, totalColumns);
    }

    const centerCell = worksheet.getCell(1, hasSeparateRegions ? 2 : 1);
    centerCell.value = branding.schoolName;
    centerCell.font = { name: 'Arial', size: 17, bold: true, color: { argb: 'FF111827' } };
    centerCell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
      readingOrder: language === 'fa' ? 'rtl' : 'ltr',
    };
    centerCell.protection = { locked: false };

    if (hasSeparateRegions) {
      const schoolCell = worksheet.getCell(1, 1);
      const ministryCell = worksheet.getCell(1, totalColumns);
      schoolCell.value =
        imageIds.school !== undefined ? '' : language === 'fa' ? 'نشان مکتب' : 'School icon';
      ministryCell.value =
        imageIds.ministry !== undefined ? '' : language === 'fa' ? 'وزارت معارف' : 'Ministry';
      for (const cell of [schoolCell, ministryCell]) {
        cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FF475569' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.protection = { locked: false };
      }
    }

    for (let row = 1; row <= 3; row++) worksheet.getRow(row).height = 22;

    if (imageIds.school !== undefined) {
      worksheet.addImage(imageIds.school, {
        tl: { col: 0.12, row: 0.12 },
        ext: { width: 50, height: 50 },
        editAs: 'oneCell',
      });
    }
    if (imageIds.ministry !== undefined) {
      worksheet.addImage(imageIds.ministry, {
        tl: { col: Math.max(totalColumns - 0.86, 0.2), row: 0.1 },
        ext: { width: 52, height: 52 },
        editAs: 'oneCell',
      });
    }

    const separatorRow = worksheet.getRow(3);
    for (let column = 1; column <= totalColumns; column++) {
      separatorRow.getCell(column).border = {
        bottom: { style: 'medium', color: { argb: 'FF18243A' } },
      };
    }
  }

  private addScheduleHeading(
    worksheet: ExcelJS.Worksheet,
    schedule: ScheduleData,
    language: 'fa' | 'en',
    branding: ExportBranding,
    totalColumns: number
  ): void {
    worksheet.mergeCells(4, 1, 4, totalColumns);
    const title = worksheet.getCell(4, 1);
    title.value =
      language === 'fa'
        ? schedule.type === 'class'
          ? `برنامه درسی هفتگی صنف ${schedule.name}`
          : `برنامه درسی هفتگی استاد ${schedule.name}`
        : schedule.type === 'class'
          ? `WEEKLY CLASS TIMETABLE — ${schedule.name}`
          : `WEEKLY TEACHER TIMETABLE — ${schedule.name}`;
    title.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    title.fill = this.solidFill('18243A');
    title.alignment = { horizontal: 'center', vertical: 'middle' };
    title.protection = { locked: false };
    worksheet.getRow(4).height = 31;

    const splitColumn = Math.max(1, Math.ceil(totalColumns / 2));
    if (schedule.type === 'class' && splitColumn < totalColumns) {
      worksheet.mergeCells(5, 1, 5, splitColumn);
      worksheet.mergeCells(5, splitColumn + 1, 5, totalColumns);
      worksheet.getCell(5, 1).value =
        language === 'fa' ? `صنف: ${schedule.name}` : `Class: ${schedule.name}`;
      worksheet.getCell(5, splitColumn + 1).value =
        language === 'fa'
          ? `معلم راهنما: ${schedule.classTeacherName || '________________'}`
          : `Class teacher: ${schedule.classTeacherName || '________________'}`;
      this.styleMetadataCell(worksheet.getCell(5, 1), language);
      this.styleMetadataCell(worksheet.getCell(5, splitColumn + 1), language);
    } else {
      worksheet.mergeCells(5, 1, 5, totalColumns);
      worksheet.getCell(5, 1).value =
        language === 'fa' ? `استاد: ${schedule.name}` : `Teacher: ${schedule.name}`;
      this.styleMetadataCell(worksheet.getCell(5, 1), language);
    }
    worksheet.getRow(5).height = 26;

    const dates = formatExportDateWithLunar(branding.generatedAt, language, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    worksheet.mergeCells(6, 1, 6, totalColumns);
    const infoParts = [branding.address, branding.website].filter(Boolean);
    const info = infoParts.length > 0 ? `${infoParts.join(' · ')}  |  ` : '';
    const details = worksheet.getCell(6, 1);
    details.value =
      language === 'fa'
        ? `${info}تاریخ: ${dates.primary}  ·  هجری قمری محاسبه‌شده: ${dates.lunar}`
        : `${info}Date: ${dates.primary}  ·  Calculated Lunar Hijri: ${dates.lunar}`;
    details.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF475569' } };
    details.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
      readingOrder: language === 'fa' ? 'rtl' : 'ltr',
    };
    details.protection = { locked: false };
    worksheet.getRow(6).height = 23;
  }

  private styleMetadataCell(cell: ExcelJS.Cell, language: 'fa' | 'en'): void {
    cell.font = { name: 'Arial', size: 11.5, bold: true, color: { argb: 'FF111827' } };
    cell.fill = this.solidFill('F4F6F9');
    cell.border = this.standardBorder('9AA5B4');
    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      readingOrder: language === 'fa' ? 'rtl' : 'ltr',
    };
    cell.protection = { locked: false };
  }

  private addGridHeader(
    worksheet: ExcelJS.Worksheet,
    schedule: ScheduleData,
    language: 'fa' | 'en',
    periodCount: number
  ): void {
    const row = worksheet.getRow(7);
    row.height = 34;
    row.getCell(1).value = language === 'fa' ? 'روز' : 'Day';
    this.applyGridHeaderStyle(row.getCell(1), language);

    const days = getDaysOfWeek(schedule.timetableData);
    for (let period = 1; period <= periodCount; period++) {
      const commonTime = this.getCommonPeriodTime(schedule.timetableData, days, period);
      row.getCell(period + 1).value = `${language === 'fa' ? 'ساعت' : 'Period'} ${period}${
        commonTime ? `\n${commonTime}` : ''
      }`;
      this.applyGridHeaderStyle(row.getCell(period + 1), language);
    }
  }

  private addScheduleRows(
    worksheet: ExcelJS.Worksheet,
    schedule: ScheduleData,
    language: 'fa' | 'en',
    displaySettings: DisplaySettings,
    dayKeys: string[],
    periodCount: number
  ): number {
    const periodsPerDay = getPeriodsPerDayMap(schedule.timetableData);
    const rowHeight = this.getScheduleRowHeight(displaySettings, schedule.type);

    dayKeys.forEach((dayKey, dayIndex) => {
      const row = worksheet.getRow(dayIndex + 8);
      row.height = rowHeight;
      const dayCell = row.getCell(1);
      dayCell.value = this.getDayLabel(dayKey, language);
      dayCell.font = { name: 'Arial', size: 11.5, bold: true, color: { argb: 'FF111827' } };
      dayCell.fill = this.solidFill('EDF1F5');
      dayCell.border = this.standardBorder('7D8998');
      dayCell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true,
        readingOrder: language === 'fa' ? 'rtl' : 'ltr',
      };
      dayCell.protection = { locked: false };

      for (let period = 1; period <= periodCount; period++) {
        const cell = row.getCell(period + 1);
        const available = period <= (periodsPerDay[dayKey] ?? periodCount);
        if (!available) {
          cell.value = '—';
          this.applyUnavailableCellStyle(cell, language);
          continue;
        }

        const cellData = this.getScheduleCellData(
          schedule,
          dayIndex,
          dayKey,
          period,
          dayKeys,
          displaySettings,
          language
        );
        cell.value = [cellData.hasVariableTime ? cellData.timeRange : null, cellData.content]
          .filter(Boolean)
          .join('\n');
        this.applyScheduleCellStyle(cell, cellData.lesson, displaySettings, language);
      }
    });

    return dayKeys.length + 7;
  }

  private getScheduleCellData(
    schedule: ScheduleData,
    dayIndex: number,
    dayKey: string,
    period: number,
    dayKeys: string[],
    displaySettings: DisplaySettings,
    language: 'fa' | 'en'
  ): ScheduleCellData {
    const lesson = getLessonForSlot(schedule.timetableData, dayIndex, period);
    const time = getPeriodTimeRange(schedule.timetableData, dayKey, period - 1);
    const timeRange = time ? `${time.startTime}–${time.endTime}` : null;
    return {
      lesson,
      content: this.formatCellContent(schedule, lesson, displaySettings, language),
      hasVariableTime: this.getCommonPeriodTime(schedule.timetableData, dayKeys, period) === null,
      timeRange,
    };
  }

  private formatCellContent(
    schedule: ScheduleData,
    lesson: ExportLesson | null,
    displaySettings: DisplaySettings,
    language: 'fa' | 'en'
  ): string {
    if (!lesson) return '';
    const lines: string[] = [];

    if (schedule.type === 'teacher') {
      if (lesson.className) lines.push(lesson.className);
      if (displaySettings.showSubjectName && lesson.subjectName) lines.push(lesson.subjectName);
    } else {
      if (displaySettings.showSubjectName && lesson.subjectName) lines.push(lesson.subjectName);
      if (displaySettings.showTeacherName && lesson.teacherNames.length > 0) {
        lines.push(lesson.teacherNames.join(language === 'fa' ? '، ' : ', '));
      }
    }

    if (displaySettings.showRoomName && lesson.roomName) lines.push(lesson.roomName);
    return lines.join('\n');
  }

  private addBreakNotes(
    worksheet: ExcelJS.Worksheet,
    schedule: ScheduleData,
    language: 'fa' | 'en',
    dayKeys: string[],
    totalColumns: number,
    startRow: number
  ): number {
    let rowIndex = startRow;
    for (const day of dayKeys) {
      const relevant = getBreakIntervals(schedule.timetableData, day).filter(
        (interval) => interval.kind === 'prayer' || Boolean(interval.name?.trim())
      );
      if (relevant.length === 0) continue;

      worksheet.mergeCells(rowIndex, 1, rowIndex, totalColumns);
      const cell = worksheet.getCell(rowIndex, 1);
      const entries = relevant.map((interval) => {
        const label =
          interval.name?.trim() || (language === 'fa' ? 'وقفه نماز' : 'Prayer break');
        return `${label}: ${interval.startTime}–${interval.endTime}`;
      });
      cell.value = `${this.getDayLabel(day, language)} — ${entries.join('  ·  ')}`;
      cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF334155' } };
      cell.fill = this.solidFill('F8FAFC');
      cell.border = this.standardBorder('CBD5E1');
      cell.alignment = {
        horizontal: language === 'fa' ? 'right' : 'left',
        vertical: 'middle',
        wrapText: true,
        readingOrder: language === 'fa' ? 'rtl' : 'ltr',
      };
      cell.protection = { locked: false };
      worksheet.getRow(rowIndex).height = 22;
      rowIndex++;
    }

    return Math.max(rowIndex - 1, startRow - 1);
  }

  private getCommonPeriodTime(timetableData: any, days: string[], period: number): string | null {
    const values = days
      .map((day) => getPeriodTimeRange(timetableData, day, period - 1))
      .filter((value): value is { startTime: string; endTime: string } => Boolean(value))
      .map((value) => `${value.startTime}–${value.endTime}`);
    if (values.length === 0) return null;
    return values.every((value) => value === values[0]) ? values[0] : null;
  }

  private applyGridHeaderStyle(cell: ExcelJS.Cell, language: 'fa' | 'en'): void {
    cell.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FF111827' } };
    cell.fill = this.solidFill('DDE4EC');
    cell.border = this.standardBorder('64748B');
    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
      readingOrder: language === 'fa' ? 'rtl' : 'ltr',
    };
    cell.protection = { locked: false };
  }

  private applyScheduleCellStyle(
    cell: ExcelJS.Cell,
    lesson: ExportLesson | null,
    settings: DisplaySettings,
    language: 'fa' | 'en'
  ): void {
    const size = settings.fontSize === 'sm' ? 9 : settings.fontSize === 'lg' ? 11.5 : 10.25;
    cell.font = { name: 'Arial', size, bold: true, color: { argb: 'FF1F2937' } };
    cell.border = this.standardBorder('A6AFBA');
    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
      shrinkToFit: true,
      readingOrder: language === 'fa' ? 'rtl' : 'ltr',
    };
    cell.protection = { locked: false };
    if (lesson && settings.colorBy !== 'none') {
      cell.fill = this.solidFill(this.getCellColor(lesson, settings.colorBy));
    } else {
      cell.fill = this.solidFill('FFFFFF');
    }
  }

  private applyUnavailableCellStyle(cell: ExcelJS.Cell, language: 'fa' | 'en'): void {
    cell.font = { name: 'Arial', size: 10, color: { argb: 'FF94A3B8' } };
    cell.fill = this.solidFill('ECEFF3');
    cell.border = this.standardBorder('B8C0CA');
    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      readingOrder: language === 'fa' ? 'rtl' : 'ltr',
    };
    cell.protection = { locked: false };
  }

  private applyGuideHeader(cell: ExcelJS.Cell): void {
    cell.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = this.solidFill('334155');
    cell.border = this.standardBorder('334155');
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.protection = { locked: false };
  }

  private getCellColor(lesson: ExportLesson, colorBy: DisplaySettings['colorBy']): string {
    if (colorBy === 'subject' && lesson.subjectId) {
      return this.subjectColors[this.hashStringToIndex(lesson.subjectId, this.subjectColors.length)];
    }
    if (colorBy === 'teacher' && lesson.teacherIds.length > 0) {
      return this.teacherColors[
        this.hashStringToIndex(lesson.teacherIds[0], this.teacherColors.length)
      ];
    }
    return 'FFFFFF';
  }

  private getScheduleRowHeight(settings: DisplaySettings, type: ScheduleData['type']): number {
    const base = settings.cellSize === 'compact' ? 38 : settings.cellSize === 'large' ? 61 : 49;
    const roomExtra = settings.showRoomName ? 7 : 0;
    const teacherExtra = type === 'class' && settings.showTeacherName ? 4 : 0;
    return base + roomExtra + teacherExtra;
  }

  private configurePage(
    worksheet: ExcelJS.Worksheet,
    firstRow: number,
    lastRow: number,
    lastColumn: number
  ): void {
    const endCell = worksheet.getCell(lastRow, lastColumn).address;
    const startCell = worksheet.getCell(firstRow, 1).address;
    worksheet.pageSetup = {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      horizontalCentered: true,
      verticalCentered: false,
      margins: {
        left: 0.25,
        right: 0.25,
        top: 0.35,
        bottom: 0.35,
        header: 0.15,
        footer: 0.15,
      },
      printArea: `${startCell}:${endCell}`,
    };
  }

  private getSheetFooter(branding: ExportBranding, language: 'fa' | 'en'): string {
    const info = [branding.address, branding.website].filter(Boolean).join(' · ');
    const page = language === 'fa' ? 'صفحه &P از &N' : 'Page &P of &N';
    return `&L${this.escapeHeaderFooter(info)}&C${this.escapeHeaderFooter(
      branding.schoolName
    )}&R${page}`;
  }

  private escapeHeaderFooter(value: string): string {
    return value.replace(/&/g, '&&');
  }

  private solidFill(color: string): ExcelJS.Fill {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${color}` } };
  }

  private standardBorder(color: string): Partial<ExcelJS.Borders> {
    const side: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: `FF${color}` } };
    return { top: side, left: side, bottom: side, right: side };
  }

  private hashStringToIndex(value: string, maxIndex: number): number {
    let hash = 0;
    for (let index = 0; index < value.length; index++) {
      hash = (hash << 5) - hash + value.charCodeAt(index);
      hash |= 0;
    }
    return Math.abs(hash) % maxIndex;
  }

  private sanitizeWorksheetName(name: string): string {
    let sanitized = name.replace(/[\\/*?:\[\]]/g, '-').substring(0, 31).trim();
    while (sanitized.startsWith("'")) sanitized = sanitized.substring(1);
    while (sanitized.endsWith("'")) sanitized = sanitized.substring(0, sanitized.length - 1);
    return sanitized.trim() || 'Sheet';
  }

  private getUniqueWorksheetName(name: string, usedNames: Set<string>): string {
    const sanitized = this.sanitizeWorksheetName(name);
    if (!usedNames.has(sanitized)) return sanitized;
    let counter = 1;
    while (counter <= 999) {
      const suffix = ` (${counter})`;
      const candidate = `${sanitized.substring(0, 31 - suffix.length)}${suffix}`;
      if (!usedNames.has(candidate)) return candidate;
      counter++;
    }
    return `Sheet-${Date.now()}`.substring(0, 31);
  }

  isRTLConfigured(worksheet: ExcelJS.Worksheet): boolean {
    return worksheet.views.length > 0 && worksheet.views[0].rightToLeft === true;
  }

  private getDayLabel(day: string, language: 'fa' | 'en'): string {
    if (language === 'en') return day;
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
