import * as fs from 'fs/promises';
import * as path from 'path';
import { Browser, chromium } from 'playwright';
import { ExportBranding } from '../types/exportBranding.types';
import { formatExportDateWithLunar } from '../utils/datePresentation';
import {
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

export interface PDFGenerationOptions {
  schedules: ScheduleData[];
  language: 'fa' | 'en';
  displaySettings: DisplaySettings;
  includeAnalysis: boolean;
  analysisSummary?: AnalysisSummary;
  branding: ExportBranding;
}

interface EmbeddedFontAsset {
  filename: string;
  fontWeight: string;
  base64: string;
}

interface SchedulePageDescriptor {
  type: 'schedule';
  schedule: ScheduleData;
  periods: number[];
  segment: number;
  segmentCount: number;
}

interface AnalysisPageDescriptor {
  type: 'analysis';
  summary: AnalysisSummary;
  scheduleCount: number;
}

type PageDescriptor = SchedulePageDescriptor | AnalysisPageDescriptor;

interface CellData {
  subjectName: string | null;
  className: string | null;
  teacherNames: string[];
  roomName: string | null;
  subjectId: string | null;
  teacherId: string | null;
}

const PERIODS_PER_PAGE = 10;

export class PDFGenerationService {
  private browser: Browser | null = null;
  private embeddedFontPromise: Promise<EmbeddedFontAsset | null> | null = null;
  private readonly fontCandidates = [
    { filename: 'Vazirmatn[wght].woff2', fontWeight: '100 900' },
    { filename: 'Vazirmatn-Regular.woff2', fontWeight: '400' },
    { filename: 'Vazirmatn-Medium.woff2', fontWeight: '500' },
    { filename: 'Vazirmatn-Bold.woff2', fontWeight: '700' },
  ] as const;

  async generatePDF(options: PDFGenerationOptions): Promise<Buffer> {
    try {
      await this.initializeBrowser();
      const page = await this.browser!.newPage();

      try {
        const htmlContent = await this.generateHTML(options);
        await page.setContent(htmlContent, { waitUntil: 'networkidle', timeout: 30000 });
        await page.emulateMedia({ media: 'print' });

        const pdfBuffer = await page.pdf({
          format: 'A4',
          landscape: true,
          printBackground: true,
          margin: { top: '0', right: '0', bottom: '0', left: '0' },
          preferCSSPageSize: true,
          displayHeaderFooter: false,
        });
        const buffer = Buffer.from(pdfBuffer);
        await this.validateFontEmbedding(buffer);
        return buffer;
      } finally {
        await page.close();
      }
    } catch (error) {
      console.error('PDF generation failed:', error);
      throw new Error(
        `PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async generateHTML(options: PDFGenerationOptions): Promise<string> {
    if (!options.branding.ministryLogoBase64 || options.branding.ministryLogoMimeType !== 'image/png') {
      throw new Error(
        'Ministry of Education logo is required for PDF exports. Restore photo/images.png and rebuild the web application.'
      );
    }

    const descriptors = this.buildPageDescriptors(options);
    const styles = await this.generateStyles(options.language, options.displaySettings);
    const pages = descriptors
      .map((descriptor, index) => {
        const pageNumber = index + 1;
        if (descriptor.type === 'analysis') {
          return this.generateAnalysisPage(
            descriptor,
            options.language,
            options.branding,
            pageNumber,
            descriptors.length
          );
        }
        return this.generateSchedulePage(
          descriptor,
          options.displaySettings,
          options.language,
          options.branding,
          pageNumber,
          descriptors.length
        );
      })
      .join('');

    return `<!DOCTYPE html>
<html lang="${options.language}" dir="${options.language === 'fa' ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(options.branding.schoolName)} — Schedule Export</title>
  ${styles}
</head>
<body>${pages}</body>
</html>`;
  }

  private buildPageDescriptors(options: PDFGenerationOptions): PageDescriptor[] {
    const pages: PageDescriptor[] = [];
    if (
      options.includeAnalysis &&
      options.analysisSummary &&
      options.schedules.length > 1
    ) {
      pages.push({
        type: 'analysis',
        summary: options.analysisSummary,
        scheduleCount: options.schedules.length,
      });
    }

    for (const schedule of options.schedules) {
      const chunks = this.getPeriodChunks(schedule);
      chunks.forEach((periods, segment) => {
        pages.push({
          type: 'schedule',
          schedule,
          periods,
          segment,
          segmentCount: chunks.length,
        });
      });
    }
    return pages;
  }

  private getPeriodChunks(schedule: ScheduleData): number[][] {
    const count = Math.max(getMaxPeriods(schedule.timetableData), 1);
    const periods = Array.from({ length: count }, (_, index) => index + 1);
    const chunks: number[][] = [];
    for (let index = 0; index < periods.length; index += PERIODS_PER_PAGE) {
      chunks.push(periods.slice(index, index + PERIODS_PER_PAGE));
    }
    return chunks;
  }

  private async initializeBrowser(): Promise<void> {
    if (this.browser) return;
    try {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown browser launch error';
      if (message.includes("Executable doesn't exist")) {
        throw new Error(
          'Playwright Chromium is not installed. Run `npx playwright install chromium` in packages/api and retry the export.'
        );
      }
      throw error;
    }
  }

  private async generateStyles(
    language: 'fa' | 'en',
    displaySettings: DisplaySettings
  ): Promise<string> {
    const isRTL = language === 'fa';
    const baseFontSize = this.getFontSizeValue(displaySettings.fontSize);
    const cellPadding =
      displaySettings.cellSize === 'compact'
        ? '0.8mm'
        : displaySettings.cellSize === 'large'
          ? '1.5mm'
          : '1.1mm';
    const fontFaceCss = await this.getFontFaceCss();

    return `<style>
${fontFaceCss}
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 297mm; background: #fff; }
body {
  font-family: ${isRTL ? "'Vazirmatn', Arial, sans-serif" : "Arial, 'Vazirmatn', sans-serif"};
  color: #111827;
  font-size: ${baseFontSize}px;
  font-weight: 500;
  line-height: 1.25;
}
.page {
  width: 297mm;
  height: 210mm;
  padding: 6mm;
  page-break-after: always;
  break-after: page;
  overflow: hidden;
}
.page:last-child { page-break-after: auto; break-after: auto; }
.page-frame {
  height: 100%;
  border: 0.45mm solid #1f2937;
  padding: 4.5mm;
  display: flex;
  flex-direction: column;
  background: #fff;
}
.document-header {
  direction: ltr;
  display: grid;
  grid-template-columns: 24mm minmax(0, 1fr) 24mm;
  align-items: center;
  min-height: 23mm;
  gap: 4mm;
}
.brand-mark {
  width: 21mm;
  height: 21mm;
  object-fit: contain;
  justify-self: center;
}
.school-icon-fallback {
  width: 19mm;
  height: 19mm;
  color: #1f2937;
  justify-self: center;
}
.school-icon-fallback svg { width: 100%; height: 100%; }
.official-school-name {
  direction: ${isRTL ? 'rtl' : 'ltr'};
  text-align: center;
  font-size: 22px;
  line-height: 1.15;
  font-weight: 850;
  letter-spacing: ${isRTL ? '0' : '0.04em'};
  overflow-wrap: anywhere;
}
.header-separator { border-top: 0.35mm solid #1f2937; margin: 2mm 0 2.5mm; }
.document-title {
  background: #172033;
  color: #fff;
  text-align: center;
  font-size: 16px;
  font-weight: 850;
  padding: 1.7mm 3mm;
  letter-spacing: ${isRTL ? '0' : '0.055em'};
}
.continuation { font-size: 10px; font-weight: 500; opacity: 0.86; margin-inline-start: 2mm; }
.metadata-strip {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border: 0.25mm solid #4b5563;
  border-top: 0;
  margin-bottom: 2.5mm;
  min-height: 9mm;
}
.metadata-item {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.5mm;
  padding: 1.4mm 3mm;
  text-align: center;
  border-inline-end: 0.25mm solid #9ca3af;
  overflow-wrap: anywhere;
}
.metadata-item:last-child { border-inline-end: 0; }
.teacher-metadata { grid-template-columns: minmax(0, 1fr); }
.teacher-metadata .metadata-item { border-inline-end: 0; }
.metadata-label { font-weight: 850; }
.metadata-value { font-size: ${baseFontSize + 0.75}px; font-weight: 750; }
.blank-value { display: inline-block; min-width: 34mm; border-bottom: 0.25mm solid #4b5563; height: 4mm; }
.schedule-wrap { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.schedule-table {
  direction: ${isRTL ? 'rtl' : 'ltr'};
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
.schedule-table th, .schedule-table td {
  border: 0.25mm solid #4b5563;
  text-align: center;
  vertical-align: middle;
  padding: ${cellPadding};
  overflow-wrap: anywhere;
}
.schedule-table thead tr { height: 12mm; }
.schedule-table tbody tr { height: calc(105mm / var(--day-count)); }
.schedule-table th {
  background: #eef1f5;
  color: #111827;
  font-weight: 850;
}
.day-column { width: 22mm; font-size: ${baseFontSize + 0.75}px; }
.day-name { font-size: ${baseFontSize + 0.5}px; font-weight: 850; background: #f7f8fa; }
.period-label { display: block; font-size: ${baseFontSize + 0.35}px; font-weight: 850; }
.period-time, .cell-time { display: block; margin-top: 0.5mm; font-size: ${Math.max(baseFontSize - 1.75, 8.25)}px; color: #374151; font-weight: 700; white-space: nowrap; }
.cell-content { display: flex; min-height: 12mm; flex-direction: column; align-items: center; justify-content: center; gap: 0.55mm; }
.subject-name, .teacher-name, .class-name { line-height: 1.12; }
.lesson-primary { color: #111827; font-size: ${baseFontSize + 1}px; font-weight: 850; }
.lesson-secondary { color: #374151; font-size: ${Math.max(baseFontSize - 0.25, 9)}px; font-weight: 700; }
.class-name.lesson-primary { letter-spacing: ${isRTL ? '0' : '0.015em'}; }
.room-name { color: #596273; font-size: ${Math.max(baseFontSize - 1, 8.5)}px; font-weight: 600; line-height: 1.1; }
.unavailable { background: #f3f4f6; color: #9ca3af; }
.break-note { margin-top: 1.8mm; color: #4b5563; font-size: ${Math.max(baseFontSize - 1.5, 8)}px; text-align: ${isRTL ? 'right' : 'left'}; }
.document-footer {
  direction: ltr;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(24mm, 0.45fr);
  align-items: center;
  gap: 3mm;
  border-top: 0.3mm solid #1f2937;
  margin-top: auto;
  padding-top: 2.2mm;
  min-height: 9mm;
  font-size: ${Math.max(baseFontSize - 1.5, 8)}px;
}
.footer-school { direction: ${isRTL ? 'rtl' : 'ltr'}; text-align: left; overflow-wrap: anywhere; }
.footer-date { direction: ${isRTL ? 'rtl' : 'ltr'}; text-align: center; white-space: nowrap; font-weight: 650; }
.footer-lunar { color: #6b7280; font-weight: 400; margin-inline-start: 2mm; }
.footer-page { direction: ${isRTL ? 'rtl' : 'ltr'}; text-align: right; font-weight: 750; white-space: nowrap; }
.analysis-content { flex: 1; min-height: 0; padding: 5mm 7mm 3mm; }
.analysis-subtitle { text-align: center; color: #4b5563; margin: 2mm 0 5mm; }
.analysis-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4mm; }
.stat-item { border: 0.25mm solid #cbd5e1; background: #f8fafc; padding: 5mm 3mm; text-align: center; }
.stat-label { color: #475569; font-size: ${Math.max(baseFontSize - 1, 9)}px; font-weight: 650; }
.stat-value { color: #172033; font-size: 22px; font-weight: 850; margin-top: 2mm; }
.conflict-warning { color: #991b1b; }
${this.generateColorStyles(displaySettings.colorBy)}
@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>`;
  }

  private generateSchedulePage(
    descriptor: SchedulePageDescriptor,
    displaySettings: DisplaySettings,
    language: 'fa' | 'en',
    branding: ExportBranding,
    pageNumber: number,
    totalPages: number
  ): string {
    const { schedule } = descriptor;
    const title =
      language === 'fa'
        ? schedule.type === 'class'
          ? 'تقسیم اوقات درسی'
          : 'تقسیم اوقات درسی'
        : schedule.type === 'class'
          ? 'WEEKLY CLASS TIMETABLE'
          : 'WEEKLY TEACHER TIMETABLE';
    const continuation =
      descriptor.segmentCount > 1
        ? `<span class="continuation">${language === 'fa' ? 'بخش' : 'Part'} ${this.localizeNumber(descriptor.segment + 1, language)}/${this.localizeNumber(descriptor.segmentCount, language)}</span>`
        : '';

    return `<section class="page">
  <div class="page-frame">
    ${this.generateDocumentHeader(branding, language)}
    <div class="header-separator"></div>
    <div class="document-title">${title}${continuation}</div>
    ${this.generateScheduleMetadata(schedule, language)}
    <div class="schedule-wrap">
      ${this.generateScheduleTable(schedule, descriptor.periods, displaySettings, language)}
    </div>
    ${this.generateDocumentFooter(branding, language, pageNumber, totalPages)}
  </div>
</section>`;
  }

  private generateScheduleMetadata(schedule: ScheduleData, language: 'fa' | 'en'): string {
    const targetLabel =
      language === 'fa'
        ? schedule.type === 'class'
          ? 'صنف'
          : 'استاد'
        : schedule.type === 'class'
          ? 'Class'
          : 'Teacher';
    const target = `<div class="metadata-item"><span class="metadata-label">${targetLabel}:</span><span class="metadata-value" dir="auto">${this.escapeHtml(schedule.name)}</span></div>`;

    if (schedule.type === 'teacher') {
      const teacherLabel = language === 'fa' ? 'نام استاد' : 'Teacher';
      const teacher = `<div class="metadata-item"><span class="metadata-label">${teacherLabel}:</span><span class="metadata-value" dir="auto">${this.escapeHtml(schedule.name)}</span></div>`;
      return `<div class="metadata-strip teacher-metadata">${teacher}</div>`;
    }

    const teacherLabel = language === 'fa' ? 'استاد نگران' : 'Class teacher';
    const teacherValue = schedule.classTeacherName
      ? `<span class="metadata-value" dir="auto">${this.escapeHtml(schedule.classTeacherName)}</span>`
      : '<span class="blank-value" aria-label="Unassigned class teacher"></span>';
    return `<div class="metadata-strip">${target}<div class="metadata-item"><span class="metadata-label">${teacherLabel}:</span>${teacherValue}</div></div>`;
  }

  private generateScheduleTable(
    schedule: ScheduleData,
    periods: number[],
    displaySettings: DisplaySettings,
    language: 'fa' | 'en'
  ): string {
    const dayKeys = getDaysOfWeek(schedule.timetableData);
    const periodsPerDay = getPeriodsPerDayMap(schedule.timetableData);
    const sharedTimes = new Map(
      periods.map((period) => [
        period,
        this.getSharedPeriodTime(schedule.timetableData, dayKeys, periodsPerDay, period),
      ])
    );

    let html = `<table class="schedule-table" style="--day-count:${Math.max(dayKeys.length, 1)}"><thead><tr>`;
    html += `<th class="day-column">${language === 'fa' ? 'روز' : 'Day'}</th>`;
    for (const period of periods) {
      const timing = sharedTimes.get(period);
      html += `<th><span class="period-label">${language === 'fa' ? 'ساعت' : 'Period'} ${this.localizeNumber(period, language)}</span>`;
      if (timing) {
        html += `<span class="period-time">${this.escapeHtml(timing.startTime)}–${this.escapeHtml(timing.endTime)}</span>`;
      }
      html += '</th>';
    }
    html += '</tr></thead><tbody>';

    dayKeys.forEach((day, dayIndex) => {
      html += `<tr><th class="day-name">${this.escapeHtml(this.getDayLabel(day, language))}</th>`;
      for (const period of periods) {
        const active = period <= (periodsPerDay[day] ?? getMaxPeriods(schedule.timetableData));
        if (!active) {
          html += '<td class="unavailable">—</td>';
          continue;
        }
        const cellData = this.getCellData(schedule.timetableData, dayIndex, period);
        const colorClass = this.getCellColorClass(cellData, displaySettings.colorBy);
        const timing = sharedTimes.get(period)
          ? null
          : getPeriodTimeRange(schedule.timetableData, day, period - 1);
        html += `<td class="${colorClass}">`;
        if (timing) {
          html += `<span class="cell-time">${this.escapeHtml(timing.startTime)}–${this.escapeHtml(timing.endTime)}</span>`;
        }
        html += this.generateCellContent(cellData, schedule.type, displaySettings, language);
        html += '</td>';
      }
      html += '</tr>';
    });
    html += '</tbody></table>';
    html += this.generateSpecialBreakNote(schedule, language);
    return html;
  }

  private getSharedPeriodTime(
    timetableData: any,
    dayKeys: string[],
    periodsPerDay: Record<string, number>,
    period: number
  ): { startTime: string; endTime: string } | null {
    const ranges = dayKeys
      .filter((day) => period <= (periodsPerDay[day] ?? 0))
      .map((day) => getPeriodTimeRange(timetableData, day, period - 1));
    if (ranges.length === 0 || ranges.some((range) => !range)) return null;
    const first = ranges[0]!;
    return ranges.every(
      (range) => range!.startTime === first.startTime && range!.endTime === first.endTime
    )
      ? first
      : null;
  }

  private getCellData(timetableData: any, day: number, period: number): CellData | null {
    try {
      const lesson = getLessonForSlot(timetableData, day, period);
      if (!lesson) return null;
      return {
        subjectName: lesson.subjectName,
        className: lesson.className,
        teacherNames: lesson.teacherNames ?? [],
        roomName: lesson.roomName,
        subjectId: lesson.subjectId,
        teacherId: lesson.teacherIds?.[0] ?? null,
      };
    } catch (error) {
      console.warn('Error parsing export cell data:', error);
      return null;
    }
  }

  private generateCellContent(
    cellData: CellData | null,
    scheduleType: 'class' | 'teacher',
    displaySettings: DisplaySettings,
    language: 'fa' | 'en'
  ): string {
    if (!cellData?.subjectName) return '<div class="cell-content"></div>';
    const subjectName = this.escapeHtml(cellData.subjectName);
    const parts: string[] = [];

    if (scheduleType === 'teacher') {
      if (cellData.className) {
        parts.push(
          `<div class="class-name lesson-primary" dir="auto">${this.escapeHtml(cellData.className)}</div>`,
          `<div class="subject-name lesson-secondary" dir="auto">${subjectName}</div>`
        );
      } else {
        parts.push(`<div class="subject-name lesson-primary" dir="auto">${subjectName}</div>`);
      }
    } else {
      parts.push(`<div class="subject-name lesson-primary" dir="auto">${subjectName}</div>`);
    }

    if (scheduleType === 'class' && displaySettings.showTeacherName && cellData.teacherNames.length) {
      parts.push(
        `<div class="teacher-name lesson-secondary" dir="auto">${this.escapeHtml(cellData.teacherNames.join(language === 'fa' ? '، ' : ', '))}</div>`
      );
    }
    if (displaySettings.showRoomName && cellData.roomName) {
      parts.push(`<div class="room-name" dir="auto">${this.escapeHtml(cellData.roomName)}</div>`);
    }
    return `<div class="cell-content">${parts.join('')}</div>`;
  }

  private generateSpecialBreakNote(schedule: ScheduleData, language: 'fa' | 'en'): string {
    const grouped = new Map<string, string[]>();
    for (const day of getDaysOfWeek(schedule.timetableData)) {
      const special = getBreakIntervals(schedule.timetableData, day).filter(
        (interval) => interval.kind === 'prayer' || Boolean(interval.name?.trim())
      );
      if (!special.length) continue;
      const description = special
        .map((interval) => {
          const label = interval.name || (language === 'fa' ? 'وقفه نماز' : 'Prayer break');
          return `${label}: ${interval.startTime}–${interval.endTime}`;
        })
        .join(' | ');
      const days = grouped.get(description) ?? [];
      days.push(this.getDayLabel(day, language));
      grouped.set(description, days);
    }
    if (!grouped.size) return '';
    const lines = Array.from(grouped.entries()).map(
      ([description, days]) =>
        `<span><strong>${this.escapeHtml(days.join(language === 'fa' ? '، ' : ', '))}:</strong> ${this.escapeHtml(description)}</span>`
    );
    return `<div class="break-note">${lines.join(' · ')}</div>`;
  }

  private generateAnalysisPage(
    descriptor: AnalysisPageDescriptor,
    language: 'fa' | 'en',
    branding: ExportBranding,
    pageNumber: number,
    totalPages: number
  ): string {
    const labels =
      language === 'fa'
        ? {
            title: 'خلاصه تحلیل برنامه درسی',
            subtitle: 'گزارش اداری برنامه‌های شامل در این فایل',
            classes: 'تعداد صنف‌ها',
            teachers: 'تعداد استادان',
            subjects: 'تعداد مضامین',
            rooms: 'تعداد اتاق‌ها',
            schedules: 'برنامه‌های شامل',
            utilization: 'نرخ استفاده',
            conflicts: 'تداخل‌ها',
          }
        : {
            title: 'SCHEDULE ANALYSIS SUMMARY',
            subtitle: 'Administrative summary for the schedules in this file',
            classes: 'Classes',
            teachers: 'Teachers',
            subjects: 'Subjects',
            rooms: 'Rooms',
            schedules: 'Schedules included',
            utilization: 'Utilization',
            conflicts: 'Conflicts',
          };
    const summary = descriptor.summary;
    const utilization = summary.utilizationRate > 1
      ? Math.round(summary.utilizationRate)
      : Math.round(summary.utilizationRate * 100);
    const stats = [
      [labels.classes, summary.totalClasses],
      [labels.teachers, summary.totalTeachers],
      [labels.subjects, summary.totalSubjects],
      [labels.rooms, summary.totalRooms],
      [labels.schedules, descriptor.scheduleCount],
      [labels.utilization, `${this.localizeNumber(utilization, language)}%`],
      [labels.conflicts, summary.conflictCount],
    ];

    return `<section class="page">
  <div class="page-frame">
    ${this.generateDocumentHeader(branding, language)}
    <div class="header-separator"></div>
    <div class="document-title">${labels.title}</div>
    <div class="analysis-content">
      <p class="analysis-subtitle">${labels.subtitle}</p>
      <div class="analysis-stats">${stats
        .map(
          ([label, value]) =>
            `<div class="stat-item"><div class="stat-label">${label}</div><div class="stat-value${label === labels.conflicts && Number(value) > 0 ? ' conflict-warning' : ''}">${typeof value === 'number' ? this.localizeNumber(value, language) : value}</div></div>`
        )
        .join('')}</div>
    </div>
    ${this.generateDocumentFooter(branding, language, pageNumber, totalPages)}
  </div>
</section>`;
  }

  private generateDocumentHeader(branding: ExportBranding, language: 'fa' | 'en'): string {
    const schoolLogo =
      branding.logoBase64 && branding.logoMimeType
        ? `<img class="brand-mark" src="data:${branding.logoMimeType};base64,${branding.logoBase64}" alt="" />`
        : `<div class="school-icon-fallback" aria-hidden="true"><svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 22 32 9l24 13-24 13L8 22Z" stroke="currentColor" stroke-width="3"/><path d="M16 29v16c9 7 23 7 32 0V29" stroke="currentColor" stroke-width="3"/><path d="M32 35v18" stroke="currentColor" stroke-width="3"/><path d="M22 53h20" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg></div>`;
    const ministryLogo = `<img class="brand-mark" src="data:image/png;base64,${branding.ministryLogoBase64}" alt="" />`;
    return `<header class="document-header">${schoolLogo}<div class="official-school-name" dir="${language === 'fa' ? 'rtl' : 'ltr'}">${this.escapeHtml(branding.schoolName)}</div>${ministryLogo}</header>`;
  }

  private generateDocumentFooter(
    branding: ExportBranding,
    language: 'fa' | 'en',
    pageNumber: number,
    totalPages: number
  ): string {
    const schoolInfo = [branding.address, branding.website]
      .filter((value): value is string => Boolean(value?.trim()))
      .map((value) => this.escapeHtml(value.trim()))
      .join(' · ');
    const dates = formatExportDateWithLunar(branding.generatedAt, language, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const dateLabel = language === 'fa' ? 'تاریخ' : 'Date';
    const lunarLabel = language === 'fa' ? 'هجری قمری' : 'Lunar Hijri';
    const pageLabel = language === 'fa' ? 'صفحه' : 'Page';
    const ofLabel = language === 'fa' ? 'از' : 'of';
    return `<footer class="document-footer">
  <div class="footer-school">${schoolInfo || '&nbsp;'}</div>
  <div class="footer-date">${dateLabel}: ${this.escapeHtml(dates.primary)}<span class="footer-lunar">${lunarLabel}: ${this.escapeHtml(dates.lunar)}</span></div>
  <div class="footer-page">${pageLabel} ${this.localizeNumber(pageNumber, language)} ${ofLabel} ${this.localizeNumber(totalPages, language)}</div>
</footer>`;
  }

  private getCellColorClass(cellData: CellData | null, colorBy: string): string {
    if (colorBy === 'none' || !cellData) return '';
    const key = colorBy === 'subject' ? cellData.subjectId : cellData.teacherId;
    return key ? `color-${this.hashStringToIndex(key, 20)}` : '';
  }

  private generateColorStyles(colorBy: string): string {
    if (colorBy === 'none') return '';
    const colors = [
      ['#fffaf0', '#d97706'], ['#f8fafc', '#475569'], ['#eff6ff', '#2563eb'],
      ['#f0fdf4', '#16a34a'], ['#fdf2f8', '#db2777'], ['#f5f3ff', '#7c3aed'],
      ['#ecfeff', '#0891b2'], ['#fff7ed', '#ea580c'], ['#fef2f2', '#dc2626'],
      ['#f7fee7', '#65a30d'], ['#eef2ff', '#4f46e5'], ['#faf5ff', '#9333ea'],
      ['#f0fdfa', '#0f766e'], ['#fffbeb', '#ca8a04'], ['#f8fafc', '#334155'],
      ['#fdf4ff', '#c026d3'], ['#eff6ff', '#1d4ed8'], ['#ecfdf5', '#047857'],
      ['#fff1f2', '#be123c'], ['#f5f5f4', '#57534e'],
    ];
    return colors
      .map(
        ([background, accent], index) =>
          `.color-${index}{background:${background};box-shadow:inset 0 0.8mm 0 ${accent};}`
      )
      .join('\n');
  }

  private hashStringToIndex(value: string, maxIndex: number): number {
    let hash = 0;
    for (let index = 0; index < value.length; index++) {
      hash = (hash << 5) - hash + value.charCodeAt(index);
      hash &= hash;
    }
    return Math.abs(hash) % maxIndex;
  }

  private getFontSizeValue(fontSize: string): number {
    if (fontSize === 'sm') return 9.5;
    if (fontSize === 'lg') return 11.5;
    return 10.5;
  }

  private async getFontFaceCss(): Promise<string> {
    const embeddedFont = await this.getEmbeddedFont();
    if (!embeddedFont) return '';
    return `@font-face{font-family:'Vazirmatn';src:url('data:font/woff2;base64,${embeddedFont.base64}') format('woff2');font-weight:${embeddedFont.fontWeight};font-style:normal;font-display:swap;}`;
  }

  private async getEmbeddedFont(): Promise<EmbeddedFontAsset | null> {
    if (!this.embeddedFontPromise) this.embeddedFontPromise = this.loadEmbeddedFont();
    return this.embeddedFontPromise;
  }

  private async loadEmbeddedFont(): Promise<EmbeddedFontAsset | null> {
    const roots = [
      path.join(__dirname, '../assets/fonts'),
      path.join(__dirname, '../../assets/fonts'),
      path.resolve(process.cwd(), 'assets/fonts'),
      path.resolve(process.cwd(), 'packages/api/assets/fonts'),
    ];
    for (const root of roots) {
      for (const candidate of this.fontCandidates) {
        try {
          const fontPath = path.join(root, candidate.filename);
          const stats = await fs.stat(fontPath);
          if (!stats.size) continue;
          const fontBuffer = await fs.readFile(fontPath);
          return {
            filename: candidate.filename,
            fontWeight: candidate.fontWeight,
            base64: fontBuffer.toString('base64'),
          };
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            console.warn(`Skipping unreadable font ${candidate.filename}:`, error);
          }
        }
      }
    }
    console.warn('No readable Vazirmatn font file found, using system fallback');
    return null;
  }

  private async validateFontEmbedding(pdfBuffer: Buffer): Promise<boolean> {
    try {
      const pdfString = pdfBuffer.toString('latin1');
      const embedded =
        pdfString.includes('/FontFile') ||
        pdfString.includes('/FontFile2') ||
        pdfString.includes('/FontFile3') ||
        pdfString.includes('Vazirmatn');
      if (!embedded) console.warn('Font embedding validation: No embedded fonts detected');
      return embedded;
    } catch (error) {
      console.warn('Font embedding validation failed:', error);
      return false;
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private localizeNumber(value: number, language: 'fa' | 'en'): string {
    return new Intl.NumberFormat(language === 'fa' ? 'fa-AF-u-nu-arabext' : 'en-US', {
      useGrouping: false,
    }).format(value);
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

  async generateBatchPDF(options: PDFGenerationOptions): Promise<Buffer> {
    if (options.schedules.length > 50) {
      throw new Error('Batch export limited to maximum 50 schedules');
    }
    return this.generatePDF(options);
  }

  getExpectedPageCount(options: PDFGenerationOptions): number {
    return this.buildPageDescriptors(options).length;
  }

  async cleanup(): Promise<void> {
    if (!this.browser) return;
    await this.browser.close();
    this.browser = null;
  }
}
