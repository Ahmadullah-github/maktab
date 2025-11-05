/**
 * Utility functions for managing teacher availability based on dynamic period configuration
 */

/**
 * Normalizes teacher availability to match the current periods configuration
 * This ensures availability arrays have the correct length for each day
 * 
 * @param availability - Current availability object
 * @param daysPerWeek - Number of school days per week
 * @param periodsPerDay - Number of periods per day
 * @returns Normalized availability object
 */
export function normalizeTeacherAvailability(
  availability: Record<string, boolean[]> | undefined,
  daysPerWeek: number,
  periodsPerDay: number
): Record<string, boolean[]> {
  const DAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const normalized: Record<string, boolean[]> = {};
  
  const activeDays = DAYS.slice(0, daysPerWeek);
  
  activeDays.forEach(day => {
    const currentDayAvailability = availability?.[day] || [];
    
    // If current array is longer, truncate it
    // If current array is shorter, pad with true (available)
    const normalized_day: boolean[] = [];
    
    for (let i = 0; i < periodsPerDay; i++) {
      // Keep existing value if it exists, otherwise default to true (available)
      normalized_day.push(currentDayAvailability[i] !== undefined ? currentDayAvailability[i] : true);
    }
    
    normalized[day] = normalized_day;
  });
  
  return normalized;
}

/**
 * Validates that teacher availability matches the expected configuration
 * 
 * @param availability - Availability object to validate
 * @param daysPerWeek - Expected number of school days
 * @param periodsPerDay - Expected number of periods per day
 * @returns Validation result with any errors found
 */
export function validateTeacherAvailability(
  availability: Record<string, boolean[]> | undefined,
  daysPerWeek: number,
  periodsPerDay: number
): { isValid: boolean; errors: string[] } {
  const DAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const errors: string[] = [];
  
  if (!availability) {
    errors.push("Availability is missing");
    return { isValid: false, errors };
  }
  
  const activeDays = DAYS.slice(0, daysPerWeek);
  
  activeDays.forEach(day => {
    const dayAvailability = availability[day];
    
    if (!dayAvailability) {
      errors.push(`Missing availability for ${day}`);
    } else if (!Array.isArray(dayAvailability)) {
      errors.push(`${day} availability is not an array`);
    } else if (dayAvailability.length !== periodsPerDay) {
      errors.push(
        `${day} availability has incorrect length. Expected ${periodsPerDay} periods, but got ${dayAvailability.length}.`
      );
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Gets a summary of teacher availability across all days
 * 
 * @param availability - Availability object
 * @param daysPerWeek - Number of school days
 * @param periodsPerDay - Number of periods per day
 * @returns Summary statistics
 */
export function getAvailabilitySummary(
  availability: Record<string, boolean[]> | undefined,
  daysPerWeek: number,
  periodsPerDay: number
): {
  totalSlots: number;
  availableSlots: number;
  unavailableSlots: number;
  availabilityPercentage: number;
} {
  const DAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const activeDays = DAYS.slice(0, daysPerWeek);
  
  let availableSlots = 0;
  let totalSlots = 0;
  
  activeDays.forEach(day => {
    const dayAvailability = availability?.[day] || [];
    for (let i = 0; i < periodsPerDay; i++) {
      totalSlots++;
      if (dayAvailability[i] === true) {
        availableSlots++;
      }
    }
  });
  
  const unavailableSlots = totalSlots - availableSlots;
  const availabilityPercentage = totalSlots > 0 ? (availableSlots / totalSlots) * 100 : 0;
  
  return {
    totalSlots,
    availableSlots,
    unavailableSlots,
    availabilityPercentage,
  };
}

/**
 * Creates a default availability object (all periods available)
 * 
 * @param daysPerWeek - Number of school days
 * @param periodsPerDay - Number of periods per day
 * @returns Default availability object with all slots marked as available
 */
export function createDefaultAvailability(
  daysPerWeek: number,
  periodsPerDay: number
): Record<string, boolean[]> {
  const DAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const availability: Record<string, boolean[]> = {};
  
  const activeDays = DAYS.slice(0, daysPerWeek);
  
  activeDays.forEach(day => {
    availability[day] = Array(periodsPerDay).fill(true);
  });
  
  return availability;
}
