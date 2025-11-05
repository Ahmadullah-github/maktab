/**
 * PDF Generation Utility using jsPDF + AutoTable
 * 
 * Generates timetable PDFs directly in the renderer process without
 * requiring hidden BrowserWindows or complex IPC communication.
 * 
 * Persian/Arabic text support:
 * - Uses Vazir font family for Persian content (loaded from public/assets/fonts)
 * - Automatically loads Persian fonts when language is "fa"
 * - Supports both normal and bold weights
 * - Proper RTL alignment for Persian text
 * - Falls back to helvetica if font loading fails
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ClassSchedule, TeacherSchedule, getTimetableStatistics } from "./timetableTransform";
import { formatJalali, formatNumber } from "./calendar-converter";
import { PeriodsInfo } from "@/types";
import { loadPersianFonts, setPersianFont } from "./fontLoader";

/**
 * Detect if a string contains Persian/Dari characters
 * Persian/Dari Unicode ranges:
 * - Arabic: U+0600 to U+06FF
 * - Arabic Supplement: U+0750 to U+077F
 * - Arabic Extended-A: U+08A0 to U+08FF
 */
function containsPersianText(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  // Persian/Dari character range regex
  const persianRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
  return persianRegex.test(text);
}

/**
 * Detect if schedule data contains any Persian/Dari text
 */
function scheduleContainsPersianText(
  schedules: (ClassSchedule | TeacherSchedule)[],
  schoolName?: string
): boolean {
  // Check school name
  if (schoolName && containsPersianText(schoolName)) {
    return true;
  }

  // Check schedule data
  for (const schedule of schedules) {
    // Check schedule title/name
    const scheduleName = 'className' in schedule ? schedule.className : schedule.teacherName;
    if (containsPersianText(scheduleName)) {
      return true;
    }

    // Check schedule content
    for (const day in schedule.schedule) {
      const daySchedule = schedule.schedule[day];
      for (const periodIndex in daySchedule) {
        const lesson = daySchedule[periodIndex];
        
        // Check subject name
        if (lesson.subjectName && containsPersianText(lesson.subjectName)) {
          return true;
        }

        // Check room name
        if (lesson.roomName && containsPersianText(lesson.roomName)) {
          return true;
        }

        // Check teacher names (for class schedules)
        if ('teacherNames' in lesson && lesson.teacherNames) {
          for (const teacherName of lesson.teacherNames) {
            if (containsPersianText(teacherName)) {
              return true;
            }
          }
        }

        // Check class name (for teacher schedules)
        if ('className' in lesson && lesson.className && containsPersianText(lesson.className)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Normalize Persian text for PDF generation
 * Ensures proper UTF-8 encoding and handles Persian characters correctly
 */
function normalizePersianText(text: string): string {
  if (!text || typeof text !== 'string') return text;

  // Trim whitespace and normalize Unicode characters
  let normalized = text.trim();

  // Replace common Arabic/Persian character variations to ensure consistency
  // This helps with font rendering issues
  const charMap: { [key: string]: string } = {
    'ك': 'ک', // Arabic Kaf to Persian Keh
    'ي': 'ی', // Arabic Yeh to Persian Yeh
    'ة': 'ه', // Arabic Teh Marbuta to Persian Heh
  };

  // Apply character mapping
  normalized = normalized.split('').map(char => charMap[char] || char).join('');

  return normalized;
}

export interface PdfGenerationOptions {
  orientation?: "landscape" | "portrait";
  compact?: boolean;
  includeEmpty?: boolean;
  schoolName?: string;
  periodsInfo?: PeriodsInfo | null;
  language?: "en" | "fa";
  statistics?: ReturnType<typeof getTimetableStatistics> | null;
}

/**
 * Calculate period times from periodsInfo
 */
function calculatePeriodTimes(
  periodsInfo: PeriodsInfo | null,
  periodsPerDay: number
): Array<{ start: string; end: string }> {
  const calculateTimeFromMinutes = (totalMinutes: number): string => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  };

  const calculateTimeFromString = (timeString: string, duration: number) => {
    const [hours, minutes] = timeString.split(":").map(Number);
    const totalMinutes = hours * 60 + minutes;
    const start = calculateTimeFromMinutes(totalMinutes);
    const end = calculateTimeFromMinutes(totalMinutes + duration);
    return { start, end };
  };

  const calculateDefaultTimes = (periodsPerDay: number) => {
    const times = [];
    const schoolStartTime = "08:00";
    const periodDuration = 45;
    const [startHour, startMin] = schoolStartTime.split(":").map(Number);
    let currentMin = startHour * 60 + startMin;
    
    for (let i = 0; i < periodsPerDay; i++) {
      const start = calculateTimeFromMinutes(currentMin);
      currentMin += periodDuration;
      const end = calculateTimeFromMinutes(currentMin);
      times.push({ start, end });
    }
    return times;
  };

  const calculateFromExplicitTimes = (
    periods: any[],
    periodsPerDay: number,
    schoolStartTime: string,
    periodDuration: number
  ) => {
    const times = [];
    let lastEnd = schoolStartTime;
    
    for (let i = 0; i < periodsPerDay; i++) {
      const period = periods[i];
      if (period?.startTime && period?.endTime) {
        times.push({ start: period.startTime, end: period.endTime });
        lastEnd = period.endTime;
      } else {
        const time = calculateTimeFromString(lastEnd, periodDuration);
        times.push(time);
        lastEnd = time.end;
      }
    }
    return times;
  };

  const calculateFromStartTime = (
    periods: any[],
    periodsPerDay: number,
    schoolStartTime: string,
    periodDuration: number
  ) => {
    const times = [];
    const [startHour, startMin] = schoolStartTime.split(":").map(Number);
    let currentMin = startHour * 60 + startMin;
    
    for (let i = 0; i < periodsPerDay; i++) {
      const period = periods[i];
      const isBreak = period?.isBreak || false;
      const duration = isBreak ? (period?.duration || 15) : periodDuration;
      
      const start = calculateTimeFromMinutes(currentMin);
      currentMin += duration;
      const end = calculateTimeFromMinutes(currentMin);
      times.push({ start, end });
    }
    return times;
  };

  if (!periodsInfo) {
    return calculateDefaultTimes(periodsPerDay);
  }

  const periods = periodsInfo.periods || [];
  const schoolStartTime = periodsInfo.schoolStartTime || "08:00";
  const periodDuration = periodsInfo.periodDuration || 45;

  if (periods.length > 0 && periods[0].startTime) {
    return calculateFromExplicitTimes(periods, periodsPerDay, schoolStartTime, periodDuration);
  } else {
    return calculateFromStartTime(periods, periodsPerDay, schoolStartTime, periodDuration);
  }
}

/**
 * Format period label (e.g., "P1 (08:00-08:45)" or "ساعت 1 (08:00-08:45)")
 */
function formatPeriodLabel(
  index: number,
  periodTimes: Array<{ start: string; end: string }>,
  language: "en" | "fa"
): string {
  const periodNum = index + 1;
  const isPersian = language === "fa";
  const periodLabel = isPersian ? `ساعت ${formatNumber(periodNum, true)}` : `P${periodNum}`;
  
  if (periodTimes[index]) {
    const { start, end } = periodTimes[index];
    const startFormatted = isPersian ? formatNumber(start, true) : start;
    const endFormatted = isPersian ? formatNumber(end, true) : end;
    return `${periodLabel} (${startFormatted}-${endFormatted})`;
  }
  return periodLabel;
}

/**
 * Get day abbreviations
 */
function getDayAbbreviations(language: "en" | "fa") {
  const isPersian = language === "fa";
  return {
    Saturday: isPersian ? "شنبه" : "Sat",
    Sunday: isPersian ? "1شنبه" : "Sun",
    Monday: isPersian ? "2شنبه" : "Mon",
    Tuesday: isPersian ? "3شنبه" : "Tue",
    Wednesday: isPersian ? "4شنبه" : "Wed",
    Thursday: isPersian ? "5شنبه" : "Thu",
  };
}

/**
 * Generate PDF for class schedules
 */
export function generateClassSchedulePDF(
  schedules: ClassSchedule[],
  options: PdfGenerationOptions
): Promise<Blob> {
  return new Promise(async (resolve, reject) => {
    try {
      const {
        orientation = "landscape",
        compact = false,
        includeEmpty = true,
        schoolName = "",
        periodsInfo = null,
        language = "en",
        statistics = null,
      } = options;

      const isPersian = language === "fa";
      const days = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];
      const dayAbbreviations = getDayAbbreviations(language);
      const periodsPerDay = periodsInfo?.periodsPerDay || 6;
      const periodTimes = calculatePeriodTimes(periodsInfo, periodsPerDay);

      // Create PDF document
      const pdf = new jsPDF({
        orientation: orientation === "landscape" ? "landscape" : "portrait",
        unit: "mm",
        format: "a4",
      });

      // Auto-detect if data contains Persian text and load fonts if needed
      // This ensures Persian text renders properly regardless of UI language
      const hasPersianData = scheduleContainsPersianText(schedules, schoolName);
      const needsPersianFonts = isPersian || hasPersianData;
      
      if (needsPersianFonts) {
        console.log(`[PDF] Loading Persian fonts (UI language: ${language}, Has Persian data: ${hasPersianData})`);
        await loadPersianFonts(pdf);
        // Set Vazir as default font for this PDF instance (critical for autoTable)
        pdf.setFont("Vazir", "normal");
      }

      // Page dimensions with improved margins for better print quality
      const pageWidth = orientation === "landscape" ? 297 : 210;
      const pageHeight = orientation === "landscape" ? 210 : 297;
      const margin = 12; // Increased from 10 for better print margins
      const contentWidth = pageWidth - 2 * margin;
      const headerHeight = 25; // Increased from 20 for better header spacing
      const footerHeight = 18; // Increased from 15 for better footer spacing
      const tableStartY = margin + headerHeight;
      const tableEndY = pageHeight - margin - footerHeight;

      // Process each schedule
      schedules.forEach((schedule, scheduleIndex) => {
        if (scheduleIndex > 0) {
          pdf.addPage();
        }

        let currentY = tableStartY;

        // Prepare table data
        const tableData: any[][] = [];

        days.forEach((day) => {
          const row: any[] = [dayAbbreviations[day as keyof typeof dayAbbreviations] || day];

          for (let periodIndex = 0; periodIndex < periodsPerDay; periodIndex++) {
            const lesson = schedule.schedule[day]?.[periodIndex];
            if (lesson) {
              const cellContent: string[] = [];
              // Ensure proper UTF-8 encoding for Persian text
              const subjectName = lesson.subjectName ? normalizePersianText(String(lesson.subjectName)) : "-";
              cellContent.push(subjectName);

              if (lesson.teacherNames.length > 0) {
                const teacherNames = lesson.teacherNames
                  .filter(name => name && name.trim())
                  .map(name => normalizePersianText(String(name)))
                  .join(", ");
                if (teacherNames) {
                  cellContent.push(teacherNames);
                }
              }

              if (lesson.roomName) {
                const roomLabel = isPersian ? normalizePersianText("اتاق: ") : "Room: ";
                const roomName = normalizePersianText(String(lesson.roomName));
                cellContent.push(roomLabel + roomName);
              }

              // Join with newline for better spacing
              row.push(cellContent.join("\n"));
            } else if (includeEmpty) {
              row.push("-");
            } else {
              row.push("");
            }
          }
          tableData.push(row);
        });

        // Prepare table headers
        const headers = [
          isPersian ? "روز" : "Day",
          ...Array.from({ length: periodsPerDay }, (_, i) =>
            formatPeriodLabel(i, periodTimes, language)
          ),
        ];

        // Store header/footer info for this schedule
        const scheduleHeaderInfo = {
          schoolName: schoolName ? normalizePersianText(schoolName) : "",
          title: normalizePersianText(schedule.className),
          date: formatJalali(new Date(), isPersian),
          statistics,
          language,
        };

        // Calculate column widths - day column smaller, period columns equal
        const dayColumnWidth = contentWidth * 0.12;
        const periodColumnWidth = (contentWidth - dayColumnWidth) / periodsPerDay;
        
        // Create column styles for better RTL support
        const columnStyles: any = {
          0: {
            fillColor: [255, 255, 255], // white
            textColor: [17, 17, 17], // #111
            fontStyle: "bold",
            cellWidth: dayColumnWidth,
            halign: "center",
          },
        };
        
        // Set period column styles with RTL alignment for Persian
        for (let i = 1; i <= periodsPerDay; i++) {
          columnStyles[i] = {
            cellWidth: periodColumnWidth,
            halign: isPersian ? "right" : "left",
            valign: "top",
            ...(needsPersianFonts ? { font: "Vazir", fontStyle: "normal" } : {}),
          };
        }
        
        // Also set font for day column if Persian fonts are needed (use Vazir-Bold for bold)
        if (needsPersianFonts) {
          columnStyles[0] = {
            ...columnStyles[0],
            font: "Vazir-Bold",
            fontStyle: "normal", // Bold font is registered as 'Vazir-Bold' with style 'normal'
          };
        }

        // Ensure font is set before autoTable (critical for Persian)
        if (needsPersianFonts) {
          pdf.setFont("Vazir", "normal");
        }

        // Draw table with support for multi-page headers/footers
        autoTable(pdf, {
          head: [headers],
          body: tableData,
          startY: tableStartY,
          margin: { left: margin, right: margin, top: margin + headerHeight, bottom: margin + footerHeight },
          styles: {
            fontSize: compact ? 8 : 10, // Increased from 9 to 10 for better readability
            cellPadding: compact ? { top: 4, bottom: 4, left: 4, right: 4 } : { top: 6, bottom: 6, left: 5, right: 5 }, // Increased vertical padding
            textColor: [17, 17, 17], // #111
            lineColor: [102, 102, 102], // #666 - lighter gray for softer borders
            lineWidth: 0.3, // Reduced from 0.5 for cleaner look
            halign: isPersian ? "right" : "left",
            valign: "top",
            minCellHeight: 12, // Minimum cell height for better spacing
            ...(needsPersianFonts ? { font: "Vazir", fontStyle: "normal" } : {}),
          },
          headStyles: {
            fillColor: [51, 51, 51], // #333 - slightly lighter black for softer header
            textColor: [255, 255, 255], // white
            fontStyle: "bold",
            fontSize: compact ? 9 : 10, // Increased from 8/9 to 9/10
            halign: "center",
            cellPadding: { top: 6, bottom: 6, left: 5, right: 5 }, // Increased vertical padding
            ...(needsPersianFonts ? { font: "Vazir-Bold", fontStyle: "normal" } : {}), // Bold font is registered as 'Vazir-Bold' with style 'normal'
          },
          columnStyles,
          alternateRowStyles: {
            fillColor: [255, 255, 255],
          },
          willDrawCell: (data: any) => {
            // Set font BEFORE drawing the cell (critical for Persian text)
            try {
              if (needsPersianFonts) {
                if (data.section === "head") {
                  // Header cells use bold
                  setPersianFont(pdf, "bold");
                } else if (data.section === "body") {
                  if (data.column.index === 0) {
                    // Day column uses bold
                    setPersianFont(pdf, "bold");
                  } else {
                    // Other columns use normal
                    setPersianFont(pdf, "normal");
                  }
                }
              } else {
                // English text uses helvetica
                if (data.section === "head" || data.column.index === 0) {
                  pdf.setFont("helvetica", "bold");
                } else {
                  pdf.setFont("helvetica", "normal");
                }
              }
            } catch (error) {
              console.warn("[PDF] Font setting error:", error);
              // Fallback to helvetica
              pdf.setFont("helvetica", data.section === "head" || data.column.index === 0 ? "bold" : "normal");
            }
          },
          didDrawCell: (data: any) => {
            // Style colors AFTER drawing (for visual effects only)
            if (data.section === "head" && data.column.index === 0) {
              pdf.setFillColor(17, 17, 17); // #111
              pdf.setTextColor(255, 255, 255);
            }
            if (data.section === "body" && data.column.index === 0) {
              pdf.setFillColor(255, 255, 255);
              pdf.setTextColor(17, 17, 17);
            }
          },
          didDrawPage: (data: any) => {
            // Draw header on every page
            drawHeader(pdf, {
              schoolName: scheduleHeaderInfo.schoolName,
              title: scheduleHeaderInfo.title,
              date: scheduleHeaderInfo.date,
              pageWidth,
              margin,
              y: margin,
              language: scheduleHeaderInfo.language,
            });

            // Draw footer on every page
            drawFooter(pdf, {
              pageNumber: pdf.getCurrentPageInfo().pageNumber,
              statistics: scheduleHeaderInfo.statistics,
              pageWidth,
              margin,
              y: pageHeight - footerHeight,
              language: scheduleHeaderInfo.language,
            });
          },
        });
      });

      // Generate blob
      const pdfBlob = pdf.output("blob");
      resolve(pdfBlob);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Test function to generate a simple PDF with Persian text for testing
 */
export async function generateTestPDF(language: "en" | "fa" = "fa"): Promise<Blob> {
  const jsPDF = (await import("jspdf")).default;
  const pdf = new jsPDF();

  if (language === "fa") {
    await loadPersianFonts(pdf);
    setPersianFont(pdf, "normal");
  }

  pdf.setFontSize(16);
  const testText = language === "fa"
    ? "تست فونت فارسی - این یک متن آزمایشی است"
    : "Persian Font Test - This is a test text";

  pdf.text(testText, 20, 30);

  if (language === "fa") {
    setPersianFont(pdf, "bold");
  } else {
    pdf.setFont("helvetica", "bold");
  }

  pdf.setFontSize(14);
  const boldText = language === "fa"
    ? "متن پررنگ - تست فونت ضخیم"
    : "Bold Text - Bold font test";

  pdf.text(boldText, 20, 50);

  return pdf.output("blob");
}

/**
 * Generate PDF for teacher schedules
 */
export function generateTeacherSchedulePDF(
  schedules: TeacherSchedule[],
  options: PdfGenerationOptions
): Promise<Blob> {
  return new Promise(async (resolve, reject) => {
    try {
      const {
        orientation = "landscape",
        compact = false,
        includeEmpty = true,
        schoolName = "",
        periodsInfo = null,
        language = "en",
        statistics = null,
      } = options;

      const isPersian = language === "fa";
      const days = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];
      const dayAbbreviations = getDayAbbreviations(language);
      const periodsPerDay = periodsInfo?.periodsPerDay || 6;
      const periodTimes = calculatePeriodTimes(periodsInfo, periodsPerDay);

      // Create PDF document
      const pdf = new jsPDF({
        orientation: orientation === "landscape" ? "landscape" : "portrait",
        unit: "mm",
        format: "a4",
      });

      // Auto-detect if data contains Persian text and load fonts if needed
      // This ensures Persian text renders properly regardless of UI language
      const hasPersianData = scheduleContainsPersianText(schedules, schoolName);
      const needsPersianFonts = isPersian || hasPersianData;
      
      if (needsPersianFonts) {
        console.log(`[PDF] Loading Persian fonts (UI language: ${language}, Has Persian data: ${hasPersianData})`);
        await loadPersianFonts(pdf);
        // Set Vazir as default font for this PDF instance (critical for autoTable)
        pdf.setFont("Vazir", "normal");
      }

      // Page dimensions with improved margins for better print quality
      const pageWidth = orientation === "landscape" ? 297 : 210;
      const pageHeight = orientation === "landscape" ? 210 : 297;
      const margin = 12; // Increased from 10 for better print margins
      const contentWidth = pageWidth - 2 * margin;
      const headerHeight = 25; // Increased from 20 for better header spacing
      const footerHeight = 18; // Increased from 15 for better footer spacing
      const tableStartY = margin + headerHeight;
      const tableEndY = pageHeight - margin - footerHeight;

      // Process each schedule
      schedules.forEach((schedule, scheduleIndex) => {
        if (scheduleIndex > 0) {
          pdf.addPage();
        }

        let currentY = tableStartY;

        // Prepare table data
        const tableData: any[][] = [];

        days.forEach((day) => {
          const row: any[] = [dayAbbreviations[day as keyof typeof dayAbbreviations] || day];

          for (let periodIndex = 0; periodIndex < periodsPerDay; periodIndex++) {
            const lesson = schedule.schedule[day]?.[periodIndex];
            if (lesson) {
              const cellContent: string[] = [];
              // Ensure proper UTF-8 encoding for Persian text
              const className = lesson.className ? normalizePersianText(String(lesson.className)) : "-";
              const subjectName = lesson.subjectName ? normalizePersianText(String(lesson.subjectName)) : "-";
              cellContent.push(className);
              cellContent.push(subjectName);

              if (lesson.roomName) {
                const roomLabel = isPersian ? normalizePersianText("اتاق: ") : "Room: ";
                const roomName = normalizePersianText(String(lesson.roomName));
                cellContent.push(roomLabel + roomName);
              }

              // Join with newline for better spacing
              row.push(cellContent.join("\n"));
            } else if (includeEmpty) {
              row.push("-");
            } else {
              row.push("");
            }
          }
          tableData.push(row);
        });

        // Prepare table headers
        const headers = [
          isPersian ? "روز" : "Day",
          ...Array.from({ length: periodsPerDay }, (_, i) =>
            formatPeriodLabel(i, periodTimes, language)
          ),
        ];

        // Store header/footer info for this schedule
        const scheduleHeaderInfo = {
          schoolName: schoolName ? normalizePersianText(schoolName) : "",
          title: normalizePersianText(schedule.teacherName),
          date: formatJalali(new Date(), isPersian),
          statistics,
          language,
        };

        // Calculate column widths - day column smaller, period columns equal
        const dayColumnWidth = contentWidth * 0.12;
        const periodColumnWidth = (contentWidth - dayColumnWidth) / periodsPerDay;
        
        // Create column styles for better RTL support
        const columnStyles: any = {
          0: {
            fillColor: [255, 255, 255], // white
            textColor: [17, 17, 17], // #111
            fontStyle: "bold",
            cellWidth: dayColumnWidth,
            halign: "center",
          },
        };
        
        // Set period column styles with RTL alignment for Persian
        for (let i = 1; i <= periodsPerDay; i++) {
          columnStyles[i] = {
            cellWidth: periodColumnWidth,
            halign: isPersian ? "right" : "left",
            valign: "top",
            ...(needsPersianFonts ? { font: "Vazir", fontStyle: "normal" } : {}),
          };
        }
        
        // Also set font for day column if Persian fonts are needed (use Vazir-Bold for bold)
        if (needsPersianFonts) {
          columnStyles[0] = {
            ...columnStyles[0],
            font: "Vazir-Bold",
            fontStyle: "normal", // Bold font is registered as 'Vazir-Bold' with style 'normal'
          };
        }

        // Ensure font is set before autoTable (critical for Persian)
        if (needsPersianFonts) {
          pdf.setFont("Vazir", "normal");
        }

        // Draw table with support for multi-page headers/footers
        autoTable(pdf, {
          head: [headers],
          body: tableData,
          startY: tableStartY,
          margin: { left: margin, right: margin, top: margin + headerHeight, bottom: margin + footerHeight },
          styles: {
            fontSize: compact ? 8 : 10, // Increased from 9 to 10 for better readability
            cellPadding: compact ? { top: 4, bottom: 4, left: 4, right: 4 } : { top: 6, bottom: 6, left: 5, right: 5 }, // Increased vertical padding
            textColor: [17, 17, 17], // #111
            lineColor: [102, 102, 102], // #666 - lighter gray for softer borders
            lineWidth: 0.3, // Reduced from 0.5 for cleaner look
            halign: isPersian ? "right" : "left",
            valign: "top",
            minCellHeight: 12, // Minimum cell height for better spacing
            ...(needsPersianFonts ? { font: "Vazir", fontStyle: "normal" } : {}),
          },
          headStyles: {
            fillColor: [51, 51, 51], // #333 - slightly lighter black for softer header
            textColor: [255, 255, 255], // white
            fontStyle: "bold",
            fontSize: compact ? 9 : 10, // Increased from 8/9 to 9/10
            halign: "center",
            cellPadding: { top: 6, bottom: 6, left: 5, right: 5 }, // Increased vertical padding
            ...(needsPersianFonts ? { font: "Vazir-Bold", fontStyle: "normal" } : {}), // Bold font is registered as 'Vazir-Bold' with style 'normal'
          },
          columnStyles,
          alternateRowStyles: {
            fillColor: [255, 255, 255],
          },
          willDrawCell: (data: any) => {
            // Set font BEFORE drawing the cell (critical for Persian text)
            try {
              if (needsPersianFonts) {
                if (data.section === "head") {
                  // Header cells use bold
                  setPersianFont(pdf, "bold");
                } else if (data.section === "body") {
                  if (data.column.index === 0) {
                    // Day column uses bold
                    setPersianFont(pdf, "bold");
                  } else {
                    // Other columns use normal
                    setPersianFont(pdf, "normal");
                  }
                }
              } else {
                // English text uses helvetica
                if (data.section === "head" || data.column.index === 0) {
                  pdf.setFont("helvetica", "bold");
                } else {
                  pdf.setFont("helvetica", "normal");
                }
              }
            } catch (error) {
              console.warn("[PDF] Font setting error:", error);
              // Fallback to helvetica
              pdf.setFont("helvetica", data.section === "head" || data.column.index === 0 ? "bold" : "normal");
            }
          },
          didDrawCell: (data: any) => {
            // Style colors AFTER drawing (for visual effects only)
            if (data.section === "head" && data.column.index === 0) {
              pdf.setFillColor(17, 17, 17); // #111
              pdf.setTextColor(255, 255, 255);
            }
            if (data.section === "body" && data.column.index === 0) {
              pdf.setFillColor(255, 255, 255);
              pdf.setTextColor(17, 17, 17);
            }
          },
          didDrawPage: (data: any) => {
            // Draw header on every page
            drawHeader(pdf, {
              schoolName: scheduleHeaderInfo.schoolName,
              title: scheduleHeaderInfo.title,
              date: scheduleHeaderInfo.date,
              pageWidth,
              margin,
              y: margin,
              language: scheduleHeaderInfo.language,
            });

            // Draw footer on every page
            drawFooter(pdf, {
              pageNumber: pdf.getCurrentPageInfo().pageNumber,
              statistics: scheduleHeaderInfo.statistics,
              pageWidth,
              margin,
              y: pageHeight - footerHeight,
              language: scheduleHeaderInfo.language,
            });
          },
        });
      });

      // Generate blob
      const pdfBlob = pdf.output("blob");
      resolve(pdfBlob);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Draw header with logo, school name, title, and date
 */
function drawHeader(
  pdf: jsPDF,
  options: {
    schoolName: string;
    title: string;
    date: string;
    pageWidth: number;
    margin: number;
    y: number;
    language: "en" | "fa";
  }
): number {
  const { schoolName, title, date, pageWidth, margin, y, language } = options;
  const normalizedSchoolName = schoolName ? normalizePersianText(schoolName) : "";
  const normalizedTitle = normalizePersianText(title);
  const normalizedDate = normalizePersianText(date);
  const isRTL = language === "fa";
  const headerY = y + 5;

  // Draw logo placeholder (circle with first letter)
  const logoSize = 15;
  const logoX = isRTL ? pageWidth - margin - logoSize : margin;
  const logoY = y;

  pdf.setFillColor(17, 17, 17); // #111
  pdf.circle(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, "F");
  
  pdf.setTextColor(255, 255, 255);
  if (isRTL) {
    setPersianFont(pdf, "bold");
  } else {
    pdf.setFont("helvetica", "bold");
  }
  pdf.setFontSize(10);
  const logoText = normalizedSchoolName ? normalizedSchoolName.charAt(0).toUpperCase() : "S";
  pdf.text(logoText, logoX + logoSize / 2, logoY + logoSize / 2, {
    align: "center",
    baseline: "middle",
  });

  // Draw school name, title, and date
  const textX = isRTL ? logoX - 5 : logoX + logoSize + 5;
  let currentY = headerY;

  pdf.setTextColor(17, 17, 17); // #111
  if (isRTL) {
    setPersianFont(pdf, "bold");
  } else {
    pdf.setFont("helvetica", "bold");
  }
  pdf.setFontSize(11);
  if (normalizedSchoolName) {
    pdf.text(normalizedSchoolName, textX, currentY, { align: isRTL ? "right" : "left" });
    currentY += 5;
  }

  if (isRTL) {
    setPersianFont(pdf, "bold");
  } else {
    pdf.setFont("helvetica", "bold");
  }
  pdf.setFontSize(12);
  pdf.text(normalizedTitle, textX, currentY, { align: isRTL ? "right" : "left" });
  currentY += 5;

  if (isRTL) {
    setPersianFont(pdf, "normal");
  } else {
    pdf.setFont("helvetica", "normal");
  }
  pdf.setFontSize(9);
  pdf.setTextColor(102, 102, 102); // #666
  pdf.text(normalizedDate, textX, currentY, { align: isRTL ? "right" : "left" });

  // Draw border line
  pdf.setDrawColor(17, 17, 17); // #111
  pdf.setLineWidth(0.5);
  const lineY = currentY + 5;
  pdf.line(margin, lineY, pageWidth - margin, lineY);

  return lineY + 5;
}

/**
 * Draw footer with page number and statistics
 */
function drawFooter(
  pdf: jsPDF,
  options: {
    pageNumber: number;
    statistics: ReturnType<typeof getTimetableStatistics> | null;
    pageWidth: number;
    margin: number;
    y: number;
    language: "en" | "fa";
  }
): void {
  const { pageNumber, statistics, pageWidth, margin, y, language } = options;
  const normalizedPageNumber = normalizePersianText(formatNumber(pageNumber, language === "fa"));
  const isRTL = language === "fa";

  // Draw border line
  pdf.setDrawColor(102, 102, 102); // #666
  pdf.setLineWidth(0.5);
  pdf.line(margin, y, pageWidth - margin, y);

  // Draw page number
  if (isRTL) {
    setPersianFont(pdf, "normal");
  } else {
    pdf.setFont("helvetica", "normal");
  }
  pdf.setFontSize(8);
  pdf.setTextColor(17, 17, 17); // #111
  const pageText = isRTL ? `صفحه ${normalizedPageNumber}` : `Page ${pageNumber}`;
  pdf.text(pageText, isRTL ? margin : pageWidth - margin, y + 10, {
    align: isRTL ? "left" : "right",
  });

  // Draw statistics if available
  if (statistics) {
    const statsText: string[] = [];
    if (isRTL) {
      statsText.push(`کل دروس: ${normalizePersianText(formatNumber(statistics.totalLessons, true))}`);
      statsText.push(`موضوعات: ${normalizePersianText(formatNumber(statistics.uniqueSubjects, true))}`);
      statsText.push(`معلمان: ${normalizePersianText(formatNumber(statistics.uniqueTeachers, true))}`);
      statsText.push(`اتاق‌ها: ${normalizePersianText(formatNumber(statistics.uniqueRooms, true))}`);
    } else {
      statsText.push(`Lessons: ${statistics.totalLessons}`);
      statsText.push(`Subjects: ${statistics.uniqueSubjects}`);
      statsText.push(`Teachers: ${statistics.uniqueTeachers}`);
      statsText.push(`Rooms: ${statistics.uniqueRooms}`);
    }

    if (isRTL) {
      setPersianFont(pdf, "normal");
    } else {
      pdf.setFont("helvetica", "normal");
    }
    pdf.setFontSize(7);
    pdf.setTextColor(102, 102, 102); // #666
    pdf.text(statsText.join(" | "), isRTL ? pageWidth - margin : margin, y + 10, {
      align: isRTL ? "right" : "left",
    });
  }
}

