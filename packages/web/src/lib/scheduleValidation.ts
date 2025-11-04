// Validation utilities for schedule configuration

export interface BreakPeriodConfig {
  afterPeriod: number;
  duration: number;
}

export interface BreakValidation {
  isValid: boolean;
  severity: 'success' | 'warning' | 'error' | 'info';
  message: string;
  details?: string;
}

export interface ScheduleStats {
  totalTeachingHours: number;
  totalBreakHours: number;
  totalSchoolHours: number;
  teachingTimeRatio: number; // 0-1, percentage of teaching time
  breakCount: number;
  endTime: string;
  recommendedBreakPlacement: number[];
}

export interface BreakValidationResult {
  validation: BreakValidation;
  stats: ScheduleStats;
  recommendations: string[];
}

/**
 * Validate break period configuration and return feedback
 */
export function validateBreakPeriods(
  breakPeriods: BreakPeriodConfig[],
  totalPeriods: number,
  periodDuration: number
): BreakValidation {
  const breakCount = breakPeriods.filter(b => b.duration > 0).length;
  
  // Validate afterPeriod numbers are within range and not last period
  const invalidPeriods = breakPeriods.filter(b => 
    b.afterPeriod < 1 || b.afterPeriod >= totalPeriods
  );
  if (invalidPeriods.length > 0) {
    return {
      isValid: false,
      severity: 'error',
      message: 'Invalid break placement',
      details: `Cannot place breaks after periods ${invalidPeriods.map(b => b.afterPeriod).join(', ')}. Breaks must be after periods 1 through ${totalPeriods - 1}.`
    };
  }
  
  // Validate durations (0 is allowed for "no break")
  const invalidDurations = breakPeriods.filter(b => b.duration < 0 || b.duration > 120);
  if (invalidDurations.length > 0) {
    return {
      isValid: false,
      severity: 'error',
      message: 'Invalid break durations',
      details: 'Break durations must be between 0 and 120 minutes'
    };
  }
  
  // Check for duplicate afterPeriod numbers
  const afterPeriodNumbers = breakPeriods.map(b => b.afterPeriod);
  const duplicates = afterPeriodNumbers.filter((num, idx) => afterPeriodNumbers.indexOf(num) !== idx);
  if (duplicates.length > 0) {
    return {
      isValid: false,
      severity: 'error',
      message: 'Duplicate break configurations',
      details: `Break after period ${duplicates[0]} is configured multiple times`
    };
  }
  
  // Warning: No breaks for many periods
  if (breakCount === 0 && totalPeriods >= 7) {
    return {
      isValid: true,
      severity: 'warning',
      message: 'No breaks configured',
      details: `Consider adding breaks for a schedule with ${totalPeriods} periods. Students and teachers need rest time.`
    };
  }
  
  // Success: Valid break configuration
  return {
    isValid: true,
    severity: 'success',
    message: 'Valid break configuration',
    details: breakCount > 0 ? `${breakCount} break(s) configured.` : 'No breaks configured.'
  };
}

/**
 * Get recommended break placement based on Afghan school standards
 */
export function getRecommendedBreakPlacement(
  totalPeriods: number
): number[] {
  const recommendations: number[] = [];
  
  // For 6-7 periods: Recommend break after 3rd period (mid-morning)
  if (totalPeriods >= 6 && totalPeriods <= 7) {
    recommendations.push(3);
  }
  // For 8 periods: Recommend breaks at period 3 and 5
  else if (totalPeriods === 8) {
    recommendations.push(3, 5);
  }
  // For 9-10 periods: Recommend breaks at period 3, 5, and 7
  else if (totalPeriods >= 9 && totalPeriods <= 10) {
    recommendations.push(3, 5, 7);
  }
  // For 11-12 periods: Recommend breaks at period 3, 5, 7, and 9
  else if (totalPeriods >= 11) {
    recommendations.push(3, 5, 7, 9);
  }
  
  return recommendations;
}

/**
 * Calculate comprehensive schedule statistics
 */
export function calculateScheduleStats(
  totalPeriods: number,
  breakPeriods: BreakPeriodConfig[],
  periodDuration: number,
  startTime: string
): ScheduleStats {
  const teachingPeriods = totalPeriods; // All periods are teaching
  const teachingMinutes = teachingPeriods * periodDuration;
  
  // Sum breaks that occur after periods (excluding after last period)
  const breakMinutes = breakPeriods
    .filter(b => b.afterPeriod < totalPeriods)
    .reduce((sum, b) => sum + b.duration, 0);
  
  const totalMinutes = teachingMinutes + breakMinutes;
  
  const totalTeachingHours = Math.round((teachingMinutes / 60) * 100) / 100;
  const totalBreakHours = Math.round((breakMinutes / 60) * 100) / 100;
  const totalSchoolHours = Math.round((totalMinutes / 60) * 100) / 100;
  const teachingTimeRatio = totalMinutes > 0 ? teachingMinutes / totalMinutes : 1;
  
  // Calculate end time
  const endTime = calculateEndTime(startTime, totalMinutes);
  
  // Get recommendations
  const recommendedBreakPlacement = getRecommendedBreakPlacement(totalPeriods);
  
  return {
    totalTeachingHours,
    totalBreakHours,
    totalSchoolHours,
    teachingTimeRatio: Math.round(teachingTimeRatio * 100),
    breakCount: breakPeriods.filter(b => b.duration > 0).length,
    endTime,
    recommendedBreakPlacement
  };
}

/**
 * Helper to calculate end time from start time and total minutes
 */
function calculateEndTime(startTime: string, totalMinutes: number): string {
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMins = hours * 60 + minutes + totalMinutes;
  const newHours = Math.floor(totalMins / 60) % 24;
  const newMins = totalMins % 60;
  return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
}

/**
 * Get comprehensive validation result
 */
export function getBreakValidationResult(
  breakPeriods: BreakPeriodConfig[],
  totalPeriods: number,
  periodDuration: number,
  startTime: string
): BreakValidationResult {
  const validation = validateBreakPeriods(breakPeriods, totalPeriods, periodDuration);
  const stats = calculateScheduleStats(totalPeriods, breakPeriods, periodDuration, startTime);
  
  const recommendations: string[] = [];
  
  // Add recommendations based on validation
  if (validation.severity === 'warning' || validation.severity === 'error') {
    if (stats.recommendedBreakPlacement.length > 0) {
      recommendations.push(
        `Consider placing breaks at periods ${stats.recommendedBreakPlacement.join(', ')}`
      );
    }
  }
  
  // Check if current breaks match recommendations
  const breakAfterPeriods = breakPeriods.filter(b => b.duration > 0).map(b => b.afterPeriod);
  const matchesRecommendations = stats.recommendedBreakPlacement.every(rec => 
    breakAfterPeriods.includes(rec)
  );
  
  if (!matchesRecommendations && stats.recommendedBreakPlacement.length > 0 && breakAfterPeriods.length === 0) {
    recommendations.push(
      'Based on Afghan school standards, breaks are typically placed after every 3-4 teaching periods'
    );
  }
  
  return {
    validation,
    stats,
    recommendations
  };
}

/**
 * Get validation icon based on severity
 */
export function getValidationIcon(severity: BreakValidation['severity']) {
  switch (severity) {
    case 'success':
      return '✅';
    case 'warning':
      return '⚠️';
    case 'error':
      return '❌';
    case 'info':
      return 'ℹ️';
    default:
      return '❓';
  }
}

