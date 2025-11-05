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

      // Load Persian fonts if needed
      if (isPersian) {
        await loadPersianFonts(pdf);
        // Set Vazir as default font for this PDF instance (critical for autoTable)
        pdf.setFont("Vazir", "normal");
      }

      // Page dimensions
      const pageWidth = orientation === "landscape" ? 297 : 210;
      const pageHeight = orientation === "landscape" ? 210 : 297;
      const margin = 10;
      const contentWidth = pageWidth - 2 * margin;
      const headerHeight = 20;
      const footerHeight = 15;
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
              // Ensure UTF-8 encoding for Persian text
              const subjectName = String(lesson.subjectName || "-");
              cellContent.push(subjectName);
              if (lesson.teacherNames.length > 0) {
                const teacherNames = lesson.teacherNames.map(t => String(t)).join(", ");
                cellContent.push(teacherNames);
              }
              if (lesson.roomName) {
                const roomLabel = isPersian ? "اتاق: " : "Room: ";
                const roomName = String(lesson.roomName);
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
          schoolName,
          title: schedule.className,
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
            ...(isPersian ? { font: "Vazir", fontStyle: "normal" } : {}),
          };
        }
        
        // Also set font for day column if Persian
        if (isPersian) {
          columnStyles[0] = {
            ...columnStyles[0],
            font: "Vazir",
          };
        }

        // Ensure font is set before autoTable (critical for Persian)
        if (isPersian) {
          pdf.setFont("Vazir", "normal");
        }

        // Draw table with support for multi-page headers/footers
        autoTable(pdf, {
          head: [headers],
          body: tableData,
          startY: tableStartY,
          margin: { left: margin, right: margin, top: margin + headerHeight, bottom: margin + footerHeight },
          styles: {
            fontSize: compact ? 8 : 9,
            cellPadding: compact ? { top: 4, bottom: 4, left: 4, right: 4 } : { top: 5, bottom: 5, left: 5, right: 5 },
            textColor: [17, 17, 17], // #111
            lineColor: [17, 17, 17], // #111
            lineWidth: 0.5,
            halign: isPersian ? "right" : "left",
            valign: "top",
            ...(isPersian ? { font: "Vazir", fontStyle: "normal" } : {}),
          },
          headStyles: {
            fillColor: [17, 17, 17], // #111
            textColor: [255, 255, 255], // white
            fontStyle: "bold",
            fontSize: compact ? 8 : 9,
            halign: "center",
            cellPadding: { top: 5, bottom: 5, left: 5, right: 5 },
            ...(isPersian ? { font: "Vazir" } : {}),
          },
          columnStyles,
          alternateRowStyles: {
            fillColor: [255, 255, 255],
          },
          willDrawCell: (data: any) => {
            // Set font BEFORE drawing the cell (critical for Persian text)
            if (isPersian) {
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

      // Load Persian fonts if needed
      if (isPersian) {
        await loadPersianFonts(pdf);
        // Set Vazir as default font for this PDF instance (critical for autoTable)
        pdf.setFont("Vazir", "normal");
      }

      // Page dimensions
      const pageWidth = orientation === "landscape" ? 297 : 210;
      const pageHeight = orientation === "landscape" ? 210 : 297;
      const margin = 10;
      const contentWidth = pageWidth - 2 * margin;
      const headerHeight = 20;
      const footerHeight = 15;
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
              // Ensure UTF-8 encoding for Persian text
              const className = String(lesson.className || "-");
              const subjectName = String(lesson.subjectName || "-");
              cellContent.push(className);
              cellContent.push(subjectName);
              if (lesson.roomName) {
                const roomLabel = isPersian ? "اتاق: " : "Room: ";
                const roomName = String(lesson.roomName);
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
          schoolName,
          title: schedule.teacherName,
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
            ...(isPersian ? { font: "Vazir", fontStyle: "normal" } : {}),
          };
        }
        
        // Also set font for day column if Persian
        if (isPersian) {
          columnStyles[0] = {
            ...columnStyles[0],
            font: "Vazir",
          };
        }

        // Ensure font is set before autoTable (critical for Persian)
        if (isPersian) {
          pdf.setFont("Vazir", "normal");
        }

        // Draw table with support for multi-page headers/footers
        autoTable(pdf, {
          head: [headers],
          body: tableData,
          startY: tableStartY,
          margin: { left: margin, right: margin, top: margin + headerHeight, bottom: margin + footerHeight },
          styles: {
            fontSize: compact ? 8 : 9,
            cellPadding: compact ? { top: 4, bottom: 4, left: 4, right: 4 } : { top: 5, bottom: 5, left: 5, right: 5 },
            textColor: [17, 17, 17], // #111
            lineColor: [17, 17, 17], // #111
            lineWidth: 0.5,
            halign: isPersian ? "right" : "left",
            valign: "top",
            ...(isPersian ? { font: "Vazir", fontStyle: "normal" } : {}),
          },
          headStyles: {
            fillColor: [17, 17, 17], // #111
            textColor: [255, 255, 255], // white
            fontStyle: "bold",
            fontSize: compact ? 8 : 9,
            halign: "center",
            cellPadding: { top: 5, bottom: 5, left: 5, right: 5 },
            ...(isPersian ? { font: "Vazir" } : {}),
          },
          columnStyles,
          alternateRowStyles: {
            fillColor: [255, 255, 255],
          },
          willDrawCell: (data: any) => {
            // Set font BEFORE drawing the cell (critical for Persian text)
            if (isPersian) {
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
  const logoText = schoolName ? schoolName.charAt(0).toUpperCase() : "S";
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
  if (schoolName) {
    pdf.text(schoolName, textX, currentY, { align: isRTL ? "right" : "left" });
    currentY += 5;
  }

  if (isRTL) {
    setPersianFont(pdf, "bold");
  } else {
    pdf.setFont("helvetica", "bold");
  }
  pdf.setFontSize(12);
  pdf.text(title, textX, currentY, { align: isRTL ? "right" : "left" });
  currentY += 5;

  if (isRTL) {
    setPersianFont(pdf, "normal");
  } else {
    pdf.setFont("helvetica", "normal");
  }
  pdf.setFontSize(9);
  pdf.setTextColor(102, 102, 102); // #666
  pdf.text(date, textX, currentY, { align: isRTL ? "right" : "left" });

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
  const pageText = isRTL ? `صفحه ${formatNumber(pageNumber, true)}` : `Page ${pageNumber}`;
  pdf.text(pageText, isRTL ? margin : pageWidth - margin, y + 10, {
    align: isRTL ? "left" : "right",
  });

  // Draw statistics if available
  if (statistics) {
    const statsText: string[] = [];
    if (isRTL) {
      statsText.push(`کل دروس: ${formatNumber(statistics.totalLessons, true)}`);
      statsText.push(`موضوعات: ${formatNumber(statistics.uniqueSubjects, true)}`);
      statsText.push(`معلمان: ${formatNumber(statistics.uniqueTeachers, true)}`);
      statsText.push(`اتاق‌ها: ${formatNumber(statistics.uniqueRooms, true)}`);
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

