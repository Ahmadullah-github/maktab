import * as fs from 'fs/promises';
import * as path from 'path';
import { Browser, chromium } from 'playwright';

/**
 * Display settings for export
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
 * Schedule data structure for PDF generation
 */
export interface ScheduleData {
  id: number;
  name: string;
  type: 'class' | 'teacher';
  targetId: string;
  timetableData: any;
}

/**
 * Analysis summary data for batch exports
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
 * PDF generation options
 * Requirements: 1.4, 5.3
 */
export interface PDFGenerationOptions {
  schedules: ScheduleData[];
  language: 'fa' | 'en';
  displaySettings: DisplaySettings;
  includeAnalysis: boolean;
  analysisSummary?: AnalysisSummary;
}

/**
 * PDF Generation Service using Playwright
 * Requirements: 1.4, 5.1, 5.2, 5.3, 5.4, 7.2, 7.4
 *
 * Handles PDF generation with RTL support, Persian font embedding,
 * and display settings integration
 */
export class PDFGenerationService {
  private browser: Browser | null = null;
  private readonly fontsPath: string;

  constructor() {
    // Path to font assets
    this.fontsPath = path.join(__dirname, '../../assets/fonts');
  }

  /**
   * Generate PDF from schedule data
   * Requirements: 1.4, 5.3, 3.1, 3.2, 3.4
   */
  async generatePDF(options: PDFGenerationOptions): Promise<Buffer> {
    try {
      await this.initializeBrowser();

      const page = await this.browser!.newPage();

      // Generate HTML content
      const htmlContent = await this.generateHTMLContent(options);

      // Set content with proper encoding
      await page.setContent(htmlContent, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      // Generate PDF with A4 paper size (Requirements: 1.4)
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm',
        },
        preferCSSPageSize: false,
        displayHeaderFooter: true,
        headerTemplate: this.generateHeaderTemplate(options.language),
        footerTemplate: this.generateFooterTemplate(options.language),
      });

      await page.close();

      const buffer = Buffer.from(pdfBuffer);

      // Validate font embedding (Requirements: 5.1)
      await this.validateFontEmbedding(buffer);

      return buffer;
    } catch (error) {
      console.error('PDF generation failed:', error);
      throw new Error(
        `PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Initialize Playwright browser instance
   */
  private async initializeBrowser(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
  }

  /**
   * Generate complete HTML content for PDF
   * Requirements: 5.1, 5.2, 7.2, 7.4
   */
  private async generateHTMLContent(options: PDFGenerationOptions): Promise<string> {
    const { schedules, language, displaySettings, includeAnalysis, analysisSummary } = options;

    // Generate CSS styles
    const styles = await this.generateStyles(language, displaySettings);

    // Generate pages content
    let pagesContent = '';

    // Add analysis page for batch exports (Requirements: 3.1, 3.2)
    if (includeAnalysis && analysisSummary && schedules.length > 1) {
      pagesContent += this.generateAnalysisPage(analysisSummary, language, schedules.length);
      pagesContent += '<div class="page-break"></div>';
    }

    // Add individual schedule pages (Requirements: 3.4)
    for (let i = 0; i < schedules.length; i++) {
      pagesContent += this.generateSchedulePage(schedules[i], displaySettings, language);
      if (i < schedules.length - 1) {
        pagesContent += '<div class="page-break"></div>';
      }
    }

    return `
<!DOCTYPE html>
<html lang="${language}" dir="${language === 'fa' ? 'rtl' : 'ltr'}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Schedule Export</title>
    ${styles}
</head>
<body>
    ${pagesContent}
</body>
</html>`;
  }

  /**
   * Generate CSS styles with RTL support and font embedding
   * Requirements: 5.1, 5.2, 7.4
   */
  private async generateStyles(
    language: 'fa' | 'en',
    displaySettings: DisplaySettings
  ): Promise<string> {
    const isRTL = language === 'fa';
    const fontSize = this.getFontSizeValue(displaySettings.fontSize);

    return `
<style>
    /* Font embedding for Persian text (Requirements: 5.1, 5.4) */
    @font-face {
        font-family: 'Vazirmatn';
        src: url('data:font/woff2;base64,${await this.getFontBase64()}') format('woff2');
        font-weight: normal;
        font-style: normal;
        font-display: swap;
    }

    /* Base styles with RTL support (Requirements: 5.2) */
    * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
    }

    html {
        direction: ${isRTL ? 'rtl' : 'ltr'};
    }

    body {
        font-family: ${isRTL ? "'Vazirmatn', Arial, sans-serif" : 'Arial, sans-serif'};
        font-size: ${fontSize}px;
        line-height: 1.4;
        color: #333;
        background: white;
    }

    /* Page layout */
    .page {
        width: 100%;
        min-height: 100vh;
        padding: 20px;
        page-break-after: always;
    }

    .page:last-child {
        page-break-after: avoid;
    }

    .page-break {
        page-break-before: always;
    }

    /* Analysis page styles */
    .analysis-page {
        text-align: ${isRTL ? 'right' : 'left'};
    }

    .analysis-header {
        text-align: center;
        margin-bottom: 40px;
        padding-bottom: 20px;
        border-bottom: 3px solid #2563eb;
    }

    .analysis-title {
        font-size: 28px;
        font-weight: bold;
        margin-bottom: 10px;
        color: #1e3a8a;
    }

    .analysis-subtitle {
        font-size: 16px;
        color: #64748b;
        margin-bottom: 10px;
    }

    .school-name {
        font-size: 18px;
        font-weight: 600;
        color: #334155;
    }

    .analysis-section {
        margin-bottom: 30px;
    }

    .section-title {
        font-size: 18px;
        font-weight: bold;
        margin-bottom: 15px;
        padding-bottom: 8px;
        border-bottom: 1px solid #e2e8f0;
        color: #334155;
    }

    .analysis-stats {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 20px;
        margin-bottom: 30px;
    }

    .stat-item {
        padding: 20px;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }

    .stat-label {
        font-weight: 600;
        margin-bottom: 8px;
        color: #64748b;
        font-size: ${fontSize - 1}px;
    }

    .stat-value {
        font-size: 24px;
        font-weight: bold;
        color: #2563eb;
    }

    .stat-value.conflict-warning {
        color: #dc2626;
    }

    /* Schedule page styles */
    .schedule-page {
        text-align: ${isRTL ? 'right' : 'left'};
    }

    .schedule-title {
        font-size: 20px;
        font-weight: bold;
        margin-bottom: 20px;
        text-align: center;
        padding: 10px;
        background: #f3f4f6;
        border-radius: 5px;
    }

    /* Schedule table styles */
    .schedule-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 20px;
        direction: ${isRTL ? 'rtl' : 'ltr'};
    }

    .schedule-table th,
    .schedule-table td {
        border: 1px solid #333;
        padding: 8px;
        text-align: center;
        vertical-align: middle;
        font-size: ${fontSize - 1}px;
    }

    .schedule-table th {
        background: #e5e7eb;
        font-weight: bold;
    }

    .schedule-table .time-header {
        background: #d1d5db;
        font-weight: bold;
        min-width: 80px;
    }

    .schedule-table .day-header {
        background: #d1d5db;
        font-weight: bold;
        min-width: 100px;
    }

    /* Cell content styles based on display settings */
    .cell-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        min-height: 40px;
        justify-content: center;
        padding: 4px;
    }

    .subject-name {
        font-weight: bold;
        font-size: ${fontSize}px;
        line-height: 1.2;
        text-align: center;
    }

    .teacher-name {
        font-size: ${fontSize - 2}px;
        color: #666;
        line-height: 1.1;
        text-align: center;
        ${!displaySettings.showTeacherName ? 'display: none !important;' : ''}
    }

    .room-name {
        font-size: ${fontSize - 2}px;
        color: #888;
        line-height: 1.1;
        text-align: center;
        ${!displaySettings.showRoomName ? 'display: none !important;' : ''}
    }

    /* Adjust cell content layout based on what's visible */
    ${
      !displaySettings.showTeacherName && !displaySettings.showRoomName
        ? `
        .cell-content {
            min-height: 30px;
        }
        .subject-name {
            font-size: ${fontSize + 1}px;
        }
    `
        : ''
    }

    ${
      displaySettings.showTeacherName && !displaySettings.showRoomName
        ? `
        .cell-content {
            min-height: 35px;
        }
    `
        : ''
    }

    ${
      !displaySettings.showTeacherName && displaySettings.showRoomName
        ? `
        .cell-content {
            min-height: 35px;
        }
    `
        : ''
    }

    /* Color coding styles (Requirements: 7.4) */
    ${this.generateColorStyles(displaySettings.colorBy)}

    /* Print-specific styles */
    @media print {
        body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        .page-break {
            page-break-before: always;
        }
    }

    /* RTL-specific adjustments */
    ${
      isRTL
        ? `
        .schedule-table {
            text-align: right;
        }

        .cell-content {
            text-align: right;
        }

        .analysis-stats {
            text-align: right;
        }
    `
        : ''
    }
</style>`;
  }

  /**
   * Generate color coding styles based on display settings
   * Requirements: 7.4
   */
  private generateColorStyles(colorBy: string): string {
    if (colorBy === 'none') return '';

    // Enhanced color palette that matches UI colors more closely
    const subjectColors = [
      '#fef3c7',
      '#fde68a',
      '#fcd34d',
      '#f59e0b', // Yellow family
      '#dbeafe',
      '#bfdbfe',
      '#93c5fd',
      '#3b82f6', // Blue family
      '#d1fae5',
      '#a7f3d0',
      '#6ee7b7',
      '#10b981', // Green family
      '#fce7f3',
      '#fbcfe8',
      '#f9a8d4',
      '#ec4899', // Pink family
      '#e0e7ff',
      '#c7d2fe',
      '#a5b4fc',
      '#6366f1', // Indigo family
    ];

    const teacherColors = [
      '#fef2f2',
      '#fecaca',
      '#f87171',
      '#dc2626', // Red family
      '#fff7ed',
      '#fed7aa',
      '#fb923c',
      '#ea580c', // Orange family
      '#f0fdf4',
      '#bbf7d0',
      '#4ade80',
      '#16a34a', // Emerald family
      '#f0f9ff',
      '#bae6fd',
      '#0ea5e9',
      '#0284c7', // Sky family
      '#faf5ff',
      '#e9d5ff',
      '#a855f7',
      '#9333ea', // Purple family
    ];

    const colors = colorBy === 'subject' ? subjectColors : teacherColors;

    let styles = '';
    for (let i = 0; i < colors.length; i++) {
      styles += `
        .color-${i} {
          background-color: ${colors[i]} !important;
          border-color: ${this.darkenColor(colors[i], 0.2)} !important;
        }
      `;
    }

    // Add hover effects for better visual feedback
    if (colorBy !== 'none') {
      styles += `
        .schedule-table td:not(:empty) {
          transition: all 0.2s ease;
        }
      `;
    }

    return styles;
  }

  /**
   * Darken a hex color by a given factor
   * Requirements: 7.4
   */
  private darkenColor(hex: string, factor: number): string {
    // Remove # if present
    hex = hex.replace('#', '');

    // Parse RGB values
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Darken by factor
    const newR = Math.round(r * (1 - factor));
    const newG = Math.round(g * (1 - factor));
    const newB = Math.round(b * (1 - factor));

    // Convert back to hex
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  }

  /**
   * Get font size value in pixels
   */
  private getFontSizeValue(fontSize: string): number {
    switch (fontSize) {
      case 'sm':
        return 12;
      case 'lg':
        return 16;
      default:
        return 14; // 'md'
    }
  }

  /**
   * Get base64 encoded font data
   * Requirements: 5.1, 5.4
   */
  private async getFontBase64(): Promise<string> {
    try {
      const fontPath = path.join(this.fontsPath, 'Vazirmatn-Regular.woff2');

      try {
        // Check if font file exists and has content
        const stats = await fs.stat(fontPath);
        if (stats.size === 0) {
          console.warn('Vazirmatn font file is empty, using system fallback');
          return this.getSystemFontFallback();
        }

        const fontBuffer = await fs.readFile(fontPath);
        console.log(`Loaded Vazirmatn font: ${fontBuffer.length} bytes`);
        return fontBuffer.toString('base64');
      } catch (error) {
        // Font file not found or unreadable
        console.warn(
          'Vazirmatn font file not found, using system fallback:',
          (error as Error).message
        );
        return this.getSystemFontFallback();
      }
    } catch (error) {
      console.warn('Font loading failed:', error);
      return this.getSystemFontFallback();
    }
  }

  /**
   * Get system font fallback for Persian text
   * Requirements: 5.4
   */
  private getSystemFontFallback(): string {
    // Return empty string to use CSS font-family fallback
    // The CSS will fall back to system fonts that support Persian
    return '';
  }

  /**
   * Validate font embedding in generated PDF
   * Requirements: 5.1
   */
  private async validateFontEmbedding(pdfBuffer: Buffer): Promise<boolean> {
    try {
      // Basic validation - check if PDF contains font references
      const pdfString = pdfBuffer.toString('latin1');

      // Look for font embedding indicators in PDF structure
      const hasFontEmbedding =
        pdfString.includes('/FontFile') ||
        pdfString.includes('/FontFile2') ||
        pdfString.includes('/FontFile3') ||
        pdfString.includes('Vazirmatn');

      if (hasFontEmbedding) {
        console.log('Font embedding validation: PASSED');
      } else {
        console.warn('Font embedding validation: No embedded fonts detected');
      }

      return hasFontEmbedding;
    } catch (error) {
      console.warn('Font embedding validation failed:', error);
      return false;
    }
  }

  /**
   * Generate analysis summary page for batch exports
   * Requirements: 3.1, 3.2, 3.3
   *
   * Creates a comprehensive analysis page that appears at the beginning
   * of batch PDF exports, summarizing school statistics and schedule metrics
   */
  private generateAnalysisPage(
    summary: AnalysisSummary,
    language: 'fa' | 'en',
    scheduleCount: number = 0
  ): string {
    const labels =
      language === 'fa'
        ? {
            title: 'خلاصه تحلیل برنامه درسی',
            subtitle: 'گزارش جامع برنامه‌های درسی مدرسه',
            schoolStats: 'آمار مدرسه',
            scheduleStats: 'آمار برنامه‌ها',
            totalClasses: 'تعداد کل کلاس‌ها',
            totalTeachers: 'تعداد کل اساتید',
            totalSubjects: 'تعداد کل دروس',
            totalRooms: 'تعداد کل اتاق‌ها',
            utilizationRate: 'نرخ استفاده',
            conflictCount: 'تعداد تداخل‌ها',
            generatedAt: 'تاریخ تولید',
            schedulesIncluded: 'تعداد برنامه‌های شامل',
            schoolName: 'نام مدرسه',
          }
        : {
            title: 'Schedule Analysis Summary',
            subtitle: 'Comprehensive School Schedule Report',
            schoolStats: 'School Statistics',
            scheduleStats: 'Schedule Statistics',
            totalClasses: 'Total Classes',
            totalTeachers: 'Total Teachers',
            totalSubjects: 'Total Subjects',
            totalRooms: 'Total Rooms',
            utilizationRate: 'Utilization Rate',
            conflictCount: 'Conflicts',
            generatedAt: 'Generated At',
            schedulesIncluded: 'Schedules Included',
            schoolName: 'School Name',
          };

    // Format utilization rate properly (it's already a percentage 0-100)
    const utilizationDisplay =
      summary.utilizationRate > 1
        ? `${Math.round(summary.utilizationRate)}%`
        : `${Math.round(summary.utilizationRate * 100)}%`;

    return `
<div class="page analysis-page">
    <div class="analysis-header">
        <h1 class="analysis-title">${labels.title}</h1>
        <p class="analysis-subtitle">${labels.subtitle}</p>
        ${summary.schoolName ? `<p class="school-name">${summary.schoolName}</p>` : ''}
    </div>

    <div class="analysis-section">
        <h2 class="section-title">${labels.schoolStats}</h2>
        <div class="analysis-stats">
            <div class="stat-item">
                <div class="stat-label">${labels.totalClasses}</div>
                <div class="stat-value">${summary.totalClasses}</div>
            </div>

            <div class="stat-item">
                <div class="stat-label">${labels.totalTeachers}</div>
                <div class="stat-value">${summary.totalTeachers}</div>
            </div>

            <div class="stat-item">
                <div class="stat-label">${labels.totalSubjects}</div>
                <div class="stat-value">${summary.totalSubjects}</div>
            </div>

            <div class="stat-item">
                <div class="stat-label">${labels.totalRooms}</div>
                <div class="stat-value">${summary.totalRooms}</div>
            </div>
        </div>
    </div>

    <div class="analysis-section">
        <h2 class="section-title">${labels.scheduleStats}</h2>
        <div class="analysis-stats">
            <div class="stat-item">
                <div class="stat-label">${labels.schedulesIncluded}</div>
                <div class="stat-value">${scheduleCount}</div>
            </div>

            <div class="stat-item">
                <div class="stat-label">${labels.utilizationRate}</div>
                <div class="stat-value">${utilizationDisplay}</div>
            </div>

            <div class="stat-item">
                <div class="stat-label">${labels.conflictCount}</div>
                <div class="stat-value ${summary.conflictCount > 0 ? 'conflict-warning' : ''}">${summary.conflictCount}</div>
            </div>

            <div class="stat-item">
                <div class="stat-label">${labels.generatedAt}</div>
                <div class="stat-value">${new Date(summary.generatedAt).toLocaleDateString(language === 'fa' ? 'fa-IR' : 'en-US')}</div>
            </div>
        </div>
    </div>
</div>`;
  }

  /**
   * Generate individual schedule page
   * Requirements: 7.2, 7.4
   */
  private generateSchedulePage(
    schedule: ScheduleData,
    displaySettings: DisplaySettings,
    language: 'fa' | 'en'
  ): string {
    const title =
      language === 'fa'
        ? `برنامه درسی ${schedule.type === 'class' ? 'کلاس' : 'استاد'} ${schedule.name}`
        : `${schedule.type === 'class' ? 'Class' : 'Teacher'} ${schedule.name} Schedule`;

    // Generate schedule table
    const tableContent = this.generateScheduleTable(schedule, displaySettings, language);

    return `
<div class="page schedule-page">
    <h2 class="schedule-title">${title}</h2>
    ${tableContent}
</div>`;
  }

  /**
   * Generate schedule table HTML
   * Requirements: 7.2, 7.4
   */
  private generateScheduleTable(
    schedule: ScheduleData,
    displaySettings: DisplaySettings,
    language: 'fa' | 'en'
  ): string {
    const days =
      language === 'fa'
        ? ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه']
        : ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

    const periods = 8; // Assuming 8 periods per day

    // Generate table header
    let tableHTML = '<table class="schedule-table">';
    tableHTML += '<thead><tr>';
    tableHTML += `<th class="time-header">${language === 'fa' ? 'زمان' : 'Time'}</th>`;

    for (const day of days) {
      tableHTML += `<th class="day-header">${day}</th>`;
    }
    tableHTML += '</tr></thead>';

    // Generate table body
    tableHTML += '<tbody>';
    for (let period = 1; period <= periods; period++) {
      tableHTML += '<tr>';
      tableHTML += `<td class="time-header">${language === 'fa' ? `ساعت ${period}` : `Period ${period}`}</td>`;

      for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
        const cellData = this.getCellData(schedule.timetableData, dayIndex, period);
        const cellContent = this.generateCellContent(cellData, displaySettings, language);
        const colorClass = this.getCellColorClass(cellData, displaySettings.colorBy);

        tableHTML += `<td class="${colorClass}">`;
        tableHTML += cellContent;
        tableHTML += '</td>';
      }
      tableHTML += '</tr>';
    }
    tableHTML += '</tbody></table>';

    return tableHTML;
  }

  /**
   * Get cell data from timetable
   */
  private getCellData(timetableData: any, day: number, period: number): any {
    if (!timetableData || typeof timetableData !== 'object') {
      return null;
    }

    // Handle different timetable data structures
    // This could be from solver output or normalized schedule data
    try {
      // Try to access nested structure: timetableData[classId][day][period]
      if (timetableData.lessons && Array.isArray(timetableData.lessons)) {
        // Find lesson for this day/period
        const lesson = timetableData.lessons.find(
          (l: any) => l.day === day && l.periodIndex === period
        );

        if (lesson) {
          return {
            subjectName: lesson.subjectName || lesson.subject?.name || `Subject ${day}-${period}`,
            teacherName:
              lesson.teacherNames?.[0] || lesson.teacher?.name || `Teacher ${day}-${period}`,
            roomName: lesson.roomName || lesson.room?.name || `Room ${day}-${period}`,
            subjectId: lesson.subjectId || `subj_${day}_${period}`,
            teacherId: lesson.teacherIds?.[0] || lesson.teacherId || `teacher_${day}_${period}`,
            roomId: lesson.roomId || `room_${day}_${period}`,
          };
        }
      }

      // Fallback: try direct object access
      const dayKey = day.toString();
      const periodKey = period.toString();

      if (timetableData[dayKey] && timetableData[dayKey][periodKey]) {
        const cellData = timetableData[dayKey][periodKey];
        return {
          subjectName: cellData.subjectName || cellData.subject || `Subject ${day}-${period}`,
          teacherName: cellData.teacherName || cellData.teacher || `Teacher ${day}-${period}`,
          roomName: cellData.roomName || cellData.room || `Room ${day}-${period}`,
          subjectId: cellData.subjectId || `subj_${day}_${period}`,
          teacherId: cellData.teacherId || `teacher_${day}_${period}`,
          roomId: cellData.roomId || `room_${day}_${period}`,
        };
      }

      // Return null for empty cells
      return null;
    } catch (error) {
      console.warn('Error parsing cell data:', error);
      return null;
    }
  }

  /**
   * Generate cell content based on display settings
   * Requirements: 7.2
   */
  private generateCellContent(
    cellData: any,
    displaySettings: DisplaySettings,
    language: 'fa' | 'en'
  ): string {
    if (!cellData || !cellData.subjectName) {
      return '<div class="cell-content"></div>';
    }

    let content = '<div class="cell-content">';

    // Always show subject name if available (showSubjectName is always true)
    if (cellData.subjectName) {
      content += `<div class="subject-name">${this.escapeHtml(cellData.subjectName)}</div>`;
    }

    // Show teacher name only if enabled in display settings (Requirements: 7.2)
    if (displaySettings.showTeacherName && cellData.teacherName) {
      content += `<div class="teacher-name">${this.escapeHtml(cellData.teacherName)}</div>`;
    }

    // Show room name only if enabled in display settings (Requirements: 7.2)
    if (displaySettings.showRoomName && cellData.roomName) {
      content += `<div class="room-name">${this.escapeHtml(cellData.roomName)}</div>`;
    }

    content += '</div>';
    return content;
  }

  /**
   * Get CSS color class for cell based on color coding setting
   * Requirements: 7.4
   */
  private getCellColorClass(cellData: any, colorBy: string): string {
    if (colorBy === 'none' || !cellData) return '';

    let colorIndex = 0;
    if (colorBy === 'subject' && cellData.subjectId) {
      // Use consistent hashing for subject colors
      colorIndex = this.hashStringToIndex(cellData.subjectId.toString(), 20);
    } else if (colorBy === 'teacher' && cellData.teacherId) {
      // Use consistent hashing for teacher colors
      colorIndex = this.hashStringToIndex(cellData.teacherId.toString(), 20);
    }

    return `color-${colorIndex}`;
  }

  /**
   * Hash string to consistent index for color assignment
   * Requirements: 7.4
   */
  private hashStringToIndex(str: string, maxIndex: number): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % maxIndex;
  }

  /**
   * Escape HTML special characters to prevent XSS
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Generate header template for PDF with page-specific information
   * Requirements: 3.2 - Page numbering and headers
   */
  private generateHeaderTemplate(language: 'fa' | 'en'): string {
    const headerText = language === 'fa' ? 'برنامه درسی مکتب' : 'Maktab Schedule';
    return `
<div style="font-size: 10px; text-align: center; width: 100%; margin: 0 15mm; padding: 5px 0; border-bottom: 1px solid #e2e8f0;">
    <span style="color: #64748b;">${headerText}</span>
</div>`;
  }

  /**
   * Generate footer template for PDF with page numbering
   * Requirements: 3.2 - Page numbering
   */
  private generateFooterTemplate(language: 'fa' | 'en'): string {
    const pageText = language === 'fa' ? 'صفحه' : 'Page';
    const ofText = language === 'fa' ? 'از' : 'of';
    return `
<div style="font-size: 10px; text-align: center; width: 100%; margin: 0 15mm; padding: 5px 0; border-top: 1px solid #e2e8f0;">
    <span style="color: #64748b;">${pageText} <span class="pageNumber"></span> ${ofText} <span class="totalPages"></span></span>
</div>`;
  }

  /**
   * Generate batch PDF with multiple schedules
   * Requirements: 3.1, 3.2, 3.4
   *
   * Creates a multi-page PDF document containing:
   * - Analysis summary page (first page for batch exports)
   * - One page per schedule
   * - Consistent page numbering and headers throughout
   */
  async generateBatchPDF(options: PDFGenerationOptions): Promise<Buffer> {
    // Validate batch size
    if (options.schedules.length > 50) {
      throw new Error('Batch export limited to maximum 50 schedules');
    }

    // Use the main generatePDF method which handles batch generation
    return this.generatePDF(options);
  }

  /**
   * Get page count for batch PDF
   * Requirements: 3.4
   *
   * Returns the total number of pages that will be generated:
   * - 1 analysis page (if includeAnalysis is true and multiple schedules)
   * - 1 page per schedule
   */
  getExpectedPageCount(options: PDFGenerationOptions): number {
    const schedulePages = options.schedules.length;
    const analysisPage =
      options.includeAnalysis && options.analysisSummary && options.schedules.length > 1 ? 1 : 0;
    return schedulePages + analysisPage;
  }

  /**
   * Clean up browser instance
   */
  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
