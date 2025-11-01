/**
 * Error Parser for Python Solver Errors
 * Parses stderr JSON logs and extracts structured error information
 */

export interface ParsedError {
  errorType: "VALIDATION_ERROR" | "RUNTIME_ERROR" | "TIMEOUT" | "PARSE_ERROR" | "UNKNOWN";
  entityType: "Teacher" | "Class" | "Subject" | "Room" | "Period" | null;
  entityId: string | null;
  field: string | null;
  day?: string | null; // for availability errors
  expected?: string | null; // expected value
  actual?: string | null; // actual value
  details: string; // human-readable message
  suggestedStep: string | null; // wizard step key
  originalError: string; // raw error for logging
}

/**
 * Parse Python solver stderr to extract structured error information
 */
export function parseSolverError(stderr: string): ParsedError | null {
  if (!stderr || !stderr.trim()) {
    return null;
  }

  const originalError = stderr.trim();
  
  // Try to parse JSON logs from stderr
  const jsonLogs: any[] = [];
  const lines = stderr.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        jsonLogs.push(parsed);
      } catch (e) {
        // Not valid JSON, continue
      }
    }
  }

  // Look for error logs
  let errorMessage = '';
  let errorStatus = '';
  
  for (const log of jsonLogs) {
    if (log.error) {
      errorMessage = log.error;
    }
    if (log.status === 'VALIDATION_ERROR') {
      errorStatus = 'VALIDATION_ERROR';
    }
    if (log.event === 'Data validation failed' || log.event === 'Data validation failed.') {
      if (log.error) {
        errorMessage = log.error;
      }
    }
  }

  // If no structured error found, use the raw stderr
  if (!errorMessage) {
    // Try to extract error from raw text
    errorMessage = stderr;
  }

  // Determine error type
  let errorType: ParsedError["errorType"] = "UNKNOWN";
  if (errorStatus === 'VALIDATION_ERROR' || errorMessage.includes('validation error') || errorMessage.includes('Value error')) {
    errorType = "VALIDATION_ERROR";
  } else if (errorMessage.includes('timed out') || errorMessage.includes('timeout')) {
    errorType = "TIMEOUT";
  } else if (errorMessage.includes('parse') || errorMessage.includes('JSON')) {
    errorType = "PARSE_ERROR";
  } else if (errorMessage) {
    errorType = "RUNTIME_ERROR";
  }

  // Parse validation error patterns
  let entityType: ParsedError["entityType"] = null;
  let entityId: string | null = null;
  let field: string | null = null;
  let day: string | null = null;
  let expected: string | null = null;
  let actual: string | null = null;
  let suggestedStep: string | null = null;

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
    suggestedStep = "teachers";
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
      suggestedStep = "teachers";
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
      suggestedStep = "teachers";
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
      suggestedStep = "classes";
    }
  }

  // Pattern 5: Room-related errors (generic)
  if (!entityType && (errorMessage.includes('room') || errorMessage.includes('Room'))) {
    entityType = "Room";
    suggestedStep = "rooms";
  }

  // Pattern 6: Subject-related errors (generic)
  if (!entityType && (errorMessage.includes('subject') || errorMessage.includes('Subject'))) {
    if (!entityType || entityType !== "Teacher") {
      entityType = "Subject";
      suggestedStep = "subjects";
    }
  }

  // Pattern 7: Period/schedule errors
  if (!entityType && (errorMessage.includes('period') || errorMessage.includes('Period') || errorMessage.includes('schedule') || errorMessage.includes('Schedule'))) {
    entityType = "Period";
    suggestedStep = "periods";
  }

  // Generate user-friendly message
  let details = errorMessage;
  
  if (entityType && entityId) {
    if (entityType === "Teacher" && field === "availability" && day) {
      if (expected && actual) {
        details = `Teacher ${entityId}'s ${day} availability has incorrect length. Expected ${expected} periods, but got ${actual}.`;
      } else {
        details = `Teacher ${entityId} is missing availability for ${day}.`;
      }
    } else if (entityType === "Teacher" && field === "primarySubjectIds") {
      details = `Teacher ${entityId} has an invalid subject reference. Please check the teacher's assigned subjects.`;
    } else if (entityType === "Class" && field === "subjectRequirements") {
      details = `Class ${entityId} has an invalid subject requirement. Please check the class subject requirements.`;
    } else {
      details = `${entityType} ${entityId} has a validation error: ${errorMessage}`;
    }
  } else {
    // Fallback to a more readable version of the error
    details = errorMessage
      .replace(/\\n/g, ' ')
      .replace(/\\u2014/g, '—')
      .replace(/\\"/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return {
    errorType,
    entityType,
    entityId,
    field,
    day: day || null,
    expected: expected || null,
    actual: actual || null,
    details,
    suggestedStep,
    originalError: stderr,
  };
}

