/**
 * Shared types for generate routes
 */

export interface PreValidationError {
  error_code: string;
  severity: 'error' | 'warning';
  message_farsi: string;
  message_english: string;
  affected_entities: Array<{
    entity_type: string;
    entity_id: string;
    entity_name: string;
  }>;
  suggestion_farsi: string;
  suggestion_english: string;
}

export interface TransformOptions {
  daysOfWeek?: string[];
  defaultPeriodsPerDay?: number;
}

export interface GenerateRequestBody {
  config?: {
    schoolId?: number | null;
    daysOfWeek?: string[];
    periodsPerDay?: number;
    periodsPerDayMap?: Record<string, number>;
    [key: string]: any;
  };
  strategy?: 'fast' | 'balanced' | 'thorough';
  teachers?: any[];
  subjects?: any[];
  classes?: any[];
  rooms?: any[];
  preferences?: any;
}
