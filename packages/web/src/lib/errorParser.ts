/**
 * Error Parser for Timetable Errors
 * Parses API error responses and extracts structured error information
 */

export interface ParsedTimetableError {
  entityType: "Teacher" | "Class" | "Subject" | "Room" | "Period" | null;
  entityId: string | null;
  field: string | null;
  day?: string | null;
  expected?: string | null;
  actual?: string | null;
  userMessage?: string;
}

/**
 * Parse error from various sources (API response, Error object, string)
 */
export function parseTimetableError(error: any): ParsedTimetableError | null {
  if (!error) {
    return null;
  }

  // Case 1: Already structured error object from API response
  // Format: { error: { type, entityType, entityId, field, day, expected, actual, details, message } }
  if (error?.error && typeof error.error === 'object') {
    const structuredError = error.error;
    if (structuredError.type || structuredError.entityType) {
      return {
        entityType: structuredError.entityType || null,
        entityId: structuredError.entityId || null,
        field: structuredError.field || null,
        day: structuredError.day || null,
        expected: structuredError.expected || null,
        actual: structuredError.actual || null,
        userMessage: structuredError.message || structuredError.details || null,
      };
    }
  }

  // Case 2: Direct structured error object
  if (error?.entityType || error?.type) {
    return {
      entityType: error.entityType || null,
      entityId: error.entityId || null,
      field: error.field || null,
      day: error.day || null,
      expected: error.expected || null,
      actual: error.actual || null,
      userMessage: error.message || error.details || error.userMessage || null,
    };
  }

  // Case 3: Error in response.data.error
  if (error?.response?.error && typeof error.response.error === 'object') {
    const structuredError = error.response.error;
    if (structuredError.type || structuredError.entityType) {
      return {
        entityType: structuredError.entityType || null,
        entityId: structuredError.entityId || null,
        field: structuredError.field || null,
        day: structuredError.day || null,
        expected: structuredError.expected || null,
        actual: structuredError.actual || null,
        userMessage: structuredError.message || structuredError.details || null,
      };
    }
  }

  // Case 4: String error - try to parse common patterns
  const errorMessage = typeof error === 'string' 
    ? error 
    : error?.message || '';

  if (!errorMessage) {
    return null;
  }

  // Try to extract structured information from error message patterns
  let entityType: ParsedTimetableError["entityType"] = null;
  let entityId: string | null = null;
  let field: string | null = null;
  let day: string | null = null;
  let expected: string | null = null;
  let actual: string | null = null;

  // Pattern 1: Teacher availability length error
  // Example: "Teacher '36' availability for 'Saturday' has incorrect length — expected 7, got 6"
  const teacherAvailabilityPattern = /Teacher\s+'([^']+)'\s+availability\s+for\s+'([^']+)'\s+has\s+incorrect\s+length\s*[—\-]\s*expected\s+(\d+),\s+got\s+(\d+)/i;
  const teacherAvailabilityMatch = errorMessage.match(teacherAvailabilityPattern);
  if (teacherAvailabilityMatch) {
    entityType = "Teacher";
    entityId = teacherAvailabilityMatch[1];
    field = "availability";
    day = teacherAvailabilityMatch[2];
    expected = teacherAvailabilityMatch[3];
    actual = teacherAvailabilityMatch[4];
  }

  // Pattern 2: Teacher missing availability for day
  // Example: "Teacher '36' is missing availability for 'Saturday' — expected length 7"
  if (!entityType) {
    const teacherMissingAvailabilityPattern = /Teacher\s+'([^']+)'\s+is\s+missing\s+availability\s+for\s+'([^']+)'\s*[—\-]\s*expected\s+length\s+(\d+)/i;
    const teacherMissingMatch = errorMessage.match(teacherMissingAvailabilityPattern);
    if (teacherMissingMatch) {
      entityType = "Teacher";
      entityId = teacherMissingMatch[1];
      field = "availability";
      day = teacherMissingMatch[2];
      expected = teacherMissingMatch[3];
    }
  }

  // Pattern 3: Teacher unknown subject ID
  // Example: "Teacher '36' has unknown primarySubjectId '123' — please check subject definitions"
  if (!entityType) {
    const teacherSubjectPattern = /Teacher\s+'([^']+)'\s+has\s+unknown\s+(primarySubjectId|subjectId)\s+'([^']+)'/i;
    const teacherSubjectMatch = errorMessage.match(teacherSubjectPattern);
    if (teacherSubjectMatch) {
      entityType = "Teacher";
      entityId = teacherSubjectMatch[1];
      field = "primarySubjectIds";
    }
  }

  // Pattern 4: Class unknown subject ID
  // Example: "Class '7A' requires unknown subjectId '456' — please check subject definitions"
  if (!entityType) {
    const classSubjectPattern = /Class\s+'([^']+)'\s+requires\s+unknown\s+subjectId\s+'([^']+)'/i;
    const classSubjectMatch = errorMessage.match(classSubjectPattern);
    if (classSubjectMatch) {
      entityType = "Class";
      entityId = classSubjectMatch[1];
      field = "subjectRequirements";
    }
  }

  // Pattern 5: Room-related errors (generic)
  if (!entityType && (errorMessage.includes('room') || errorMessage.includes('Room'))) {
    entityType = "Room";
  }

  // Pattern 6: Subject-related errors (generic)
  if (!entityType && (errorMessage.includes('subject') || errorMessage.includes('Subject'))) {
    if (entityType !== "Teacher") {
      entityType = "Subject";
    }
  }

  // Pattern 7: Period/schedule errors
  if (!entityType && (errorMessage.includes('period') || errorMessage.includes('Period') || errorMessage.includes('schedule') || errorMessage.includes('Schedule'))) {
    entityType = "Period";
  }

  // If we found some structure, return it
  if (entityType || entityId || field) {
    return {
      entityType,
      entityId,
      field,
      day,
      expected,
      actual,
      userMessage: errorMessage,
    };
  }

  // Fallback: return null if we can't parse it
  // The component will handle this gracefully
  return null;
}

