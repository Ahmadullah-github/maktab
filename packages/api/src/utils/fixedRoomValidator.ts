/**
 * Fixed Room Validation Utilities
 * Provides pre-check validation for fixed room assignments to detect potential conflicts
 */

import { ClassGroup } from "../entity/ClassGroup";
import { Room } from "../entity/Room";

export interface FeasibilityWarning {
  type: "error" | "warning";
  message: string;
  affectedClasses: string[];
}

/**
 * Validates fixed room assignments and detects potential scheduling conflicts
 * @param classes Array of all classes
 * @param rooms Array of all rooms
 * @returns Array of warnings/errors found
 */
export async function validateFixedRoomAssignments(
  classes: ClassGroup[],
  rooms: Room[]
): Promise<FeasibilityWarning[]> {
  const warnings: FeasibilityWarning[] = [];
  
  // Group classes by their fixed room
  const roomAssignments = new Map<number, ClassGroup[]>();
  
  for (const cls of classes) {
    if (cls.fixedRoomId) {
      const existing = roomAssignments.get(cls.fixedRoomId) || [];
      existing.push(cls);
      roomAssignments.set(cls.fixedRoomId, existing);
    }
  }
  
  // Check each fixed room for potential issues
  for (const [roomId, assignedClasses] of roomAssignments) {
    const room = rooms.find(r => r.id === roomId);
    
    if (!room) {
      warnings.push({
        type: "error",
        message: `Room ID ${roomId} does not exist`,
        affectedClasses: assignedClasses.map(c => c.name),
      });
      continue;
    }
    
    // Check room capacity vs class sizes
    for (const cls of assignedClasses) {
      if (room.capacity < cls.studentCount) {
        warnings.push({
          type: "warning",
          message: `Room "${room.name}" capacity (${room.capacity}) is less than class "${cls.name}" size (${cls.studentCount})`,
          affectedClasses: [cls.name],
        });
      }
    }
    
    // Heuristic check: if too many classes locked to same room
    if (assignedClasses.length > 3) {
      const totalPeriods = assignedClasses.reduce((sum, cls) => {
        // Estimate total periods needed (rough calculation)
        const reqArray = Array.isArray(cls.subjectRequirements)
          ? cls.subjectRequirements
          : [];
        const totalPeriodsForClass = reqArray.reduce(
          (s: number, r: any) => s + (r.periodsPerWeek || 0),
          0
        );
        return sum + totalPeriodsForClass;
      }, 0);
      
      warnings.push({
        type: "warning",
        message: `${assignedClasses.length} classes are locked to room "${room.name}". This may cause scheduling conflicts. Total periods needed: ~${totalPeriods}`,
        affectedClasses: assignedClasses.map(c => c.name),
      });
    }
  }
  
  return warnings;
}

/**
 * Quick feasibility check before timetable generation
 * @param classes Array of all classes
 * @param rooms Array of all rooms
 * @param periodsPerDay Number of periods per day
 * @param daysPerWeek Number of days per week
 */
export async function quickFeasibilityCheck(
  classes: ClassGroup[],
  rooms: Room[],
  periodsPerDay: number,
  daysPerWeek: number
): Promise<{ feasible: boolean; warnings: FeasibilityWarning[] }> {
  const warnings = await validateFixedRoomAssignments(classes, rooms);
  
  // Additional checks
  const totalSlots = periodsPerDay * daysPerWeek;
  const roomAssignments = new Map<number, ClassGroup[]>();
  
  for (const cls of classes) {
    if (cls.fixedRoomId) {
      const existing = roomAssignments.get(cls.fixedRoomId) || [];
      existing.push(cls);
      roomAssignments.set(cls.fixedRoomId, existing);
    }
  }
  
  // Check if any room has more period requirements than available slots
  for (const [roomId, assignedClasses] of roomAssignments) {
    const room = rooms.find(r => r.id === roomId);
    if (!room) continue;
    
    const totalPeriods = assignedClasses.reduce((sum, cls) => {
      const reqArray = Array.isArray(cls.subjectRequirements)
        ? cls.subjectRequirements
        : [];
      return sum + reqArray.reduce((s: number, r: any) => s + (r.periodsPerWeek || 0), 0);
    }, 0);
    
    if (totalPeriods > totalSlots * 0.8) {
      // More than 80% of slots needed for one room
      warnings.push({
        type: "error",
        message: `Room "${room.name}" is overbooked. ${totalPeriods} periods needed but only ${totalSlots} slots available per week.`,
        affectedClasses: assignedClasses.map(c => c.name),
      });
    }
  }
  
  const hasErrors = warnings.some(w => w.type === "error");
  
  return {
    feasible: !hasErrors,
    warnings,
  };
}
