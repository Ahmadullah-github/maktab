import React from "react";
import { ClassSchedule, TeacherSchedule } from "@/lib/timetableTransform";

interface PDFScheduleViewProps {
  type: "class" | "teacher";
  schedule: ClassSchedule | TeacherSchedule;
  days: string[];
  periodsPerDay: number;
  schoolName: string;
  academicYear: string;
  generatedDate: string;
}

/**
 * Print-optimized hidden component for PDF rendering
 * This component is styled specifically for PDF export with:
 * - Persian font support (Vazirmatn)
 * - Black and white styling
 * - Proper cell layout without overlap
 * - Landscape layout optimized for A4
 */
export function PDFScheduleView({
  type,
  schedule,
  days,
  periodsPerDay,
  schoolName,
  academicYear,
  generatedDate,
}: PDFScheduleViewProps) {
  const isClass = type === "class";
  const classSchedule = isClass ? (schedule as ClassSchedule) : null;
  const teacherSchedule = !isClass ? (schedule as TeacherSchedule) : null;

  // Calculate statistics
  const totalLessons = isClass
    ? Object.values(classSchedule!.schedule).reduce(
        (acc, daySchedule) => acc + Object.keys(daySchedule).length,
        0
      )
    : Object.values(teacherSchedule!.schedule).reduce(
        (acc, daySchedule) => acc + Object.keys(daySchedule).length,
        0
      );

  const totalPeriods = days.length * periodsPerDay;
  const freePeriods = totalPeriods - totalLessons;
  const scheduleName = isClass ? classSchedule!.className : teacherSchedule!.teacherName;

  return (
    <div
      id={`pdf-schedule-${type}-${scheduleName}`}
      style={{
        width: "297mm", // Landscape A4 width
        minHeight: "210mm", // Landscape A4 height
        backgroundColor: "#ffffff",
        fontFamily: "Vazirmatn, Arial, sans-serif",
        padding: "20mm",
        boxSizing: "border-box",
        direction: "ltr", // Force LTR for table layout
      }}
    >
      {/* Header Section */}
      <div
        style={{
          borderBottom: "2px solid #000000",
          paddingBottom: "8px",
          marginBottom: "15px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "5px",
          }}
        >
          <div style={{ fontSize: "12pt", fontWeight: "bold", color: "#000000" }}>
            {schoolName}
          </div>
          <div style={{ fontSize: "14pt", fontWeight: "bold", color: "#000000" }}>
            {scheduleName} {isClass ? "- Weekly Schedule" : "'s Schedule"}
          </div>
          <div style={{ fontSize: "10pt", color: "#000000" }}>
            Academic Year: {academicYear}
          </div>
        </div>
        <div
          style={{
            fontSize: "9pt",
            color: "#000000",
            textAlign: "center",
            marginTop: "5px",
          }}
        >
          {isClass
            ? `Total Lessons: ${totalLessons} per week`
            : `Lessons: ${totalLessons} | Free Periods: ${freePeriods}`}{" "}
          | Generated: {generatedDate}
        </div>
      </div>

      {/* Schedule Table */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "8pt",
          color: "#000000",
          marginTop: "10px",
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                border: "1px solid #000000",
                padding: "6px 4px",
                backgroundColor: "#000000",
                color: "#ffffff",
                fontWeight: "bold",
                textAlign: "center",
                width: "40px",
              }}
            >
              Period
            </th>
            {days.map((day) => (
              <th
                key={day}
                style={{
                  border: "1px solid #000000",
                  padding: "6px 4px",
                  backgroundColor: "#000000",
                  color: "#ffffff",
                  fontWeight: "bold",
                  textAlign: "center",
                }}
              >
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: periodsPerDay }, (_, periodIndex) => {
            // For class schedules, skip empty periods
            if (isClass) {
              const hasLessons = days.some(
                (day) => classSchedule!.schedule[day]?.[periodIndex]
              );
              if (!hasLessons) return null;
            }

            return (
              <tr key={periodIndex}>
                {/* Period Column */}
                <td
                  style={{
                    border: "1px solid #000000",
                    padding: "4px",
                    backgroundColor: "#f0f0f0",
                    fontWeight: "bold",
                    textAlign: "center",
                    verticalAlign: "middle",
                  }}
                >
                  P{periodIndex + 1}
                </td>
                {/* Day Columns */}
                {days.map((day) => {
                  const lesson = isClass
                    ? classSchedule!.schedule[day]?.[periodIndex]
                    : teacherSchedule!.schedule[day]?.[periodIndex];

                  if (!lesson) {
                    return (
                      <td
                        key={day}
                        style={{
                          border: "1px solid #000000",
                          padding: "6px 4px",
                          backgroundColor: "#ffffff",
                          textAlign: "center",
                          verticalAlign: "middle",
                          minHeight: "40px",
                        }}
                      >
                        {!isClass && (
                          <span style={{ color: "#666666", fontSize: "7pt" }}>Free</span>
                        )}
                        {isClass && (
                          <span style={{ color: "#999999" }}>—</span>
                        )}
                      </td>
                    );
                  }

                  return (
                    <td
                      key={day}
                      style={{
                        border: "1px solid #000000",
                        padding: "6px 4px",
                        backgroundColor: "#ffffff",
                        textAlign: "left",
                        verticalAlign: "top",
                        minHeight: "40px",
                        wordWrap: "break-word",
                      }}
                    >
                      {/* Proper HTML structure instead of newlines */}
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "2px",
                          lineHeight: "1.3",
                        }}
                      >
                        {/* Subject Name (for class) or Class Name (for teacher) */}
                        <div
                          style={{
                            fontWeight: "bold",
                            fontSize: "8pt",
                            color: "#000000",
                            marginBottom: "2px",
                          }}
                        >
                          {isClass
                            ? (lesson as any).subjectName
                            : (lesson as any).className}
                        </div>
                        {/* Teacher Names (for class) or Subject Name (for teacher) */}
                        <div
                          style={{
                            fontSize: "7pt",
                            color: "#333333",
                            marginBottom: "2px",
                          }}
                        >
                          {isClass
                            ? (lesson as any).teacherNames.join(", ")
                            : (lesson as any).subjectName}
                        </div>
                        {/* Room Name */}
                        <div
                          style={{
                            fontSize: "7pt",
                            color: "#666666",
                          }}
                        >
                          {(lesson as any).roomName}
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

