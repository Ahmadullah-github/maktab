/**
 * Helper functions for auto-assigning subjects to classes based on grade
 */

import { ClassGroup, Subject } from "@/types";
import { getSubjectsForGrade } from "@/data/afghanistanCurriculum";

/**
 * Extract grade number from class name
 * Examples:
 *   "Grade7-A" → 7
 *   "صنف هفتم الف" → 7
 *   "Grade 10 B" → 10
 */
export function extractGradeFromClassName(className: string): number | null {
  // Try English format: "Grade7-A", "Grade 10-B", "Grade7A"
  const englishMatch = className.match(/grade\s*(\d{1,2})/i);
  if (englishMatch) {
    return parseInt(englishMatch[1]);
  }
  
  // Try direct number: "7A", "10-B"
  const directMatch = className.match(/^(\d{1,2})/);
  if (directMatch) {
    return parseInt(directMatch[1]);
  }
  
  // Try Persian grade names
  const persianGrades: { [key: string]: number } = {
    'اول': 1, 'دوم': 2, 'سوم': 3, 'چهارم': 4, 'پنجم': 5,
    'ششم': 6, 'هفتم': 7, 'هشتم': 8, 'نهم': 9,
    'دهم': 10, 'یازدهم': 11, 'دوازدهم': 12
  };
  
  for (const [persianName, grade] of Object.entries(persianGrades)) {
    if (className.includes(persianName)) {
      return grade;
    }
  }
  
  return null;
}

export function gradeToSection(grade: number): 'PRIMARY'|'MIDDLE'|'HIGH' {
  if (grade >= 1 && grade <= 6) return 'PRIMARY'
  if (grade >= 7 && grade <= 9) return 'MIDDLE'
  return 'HIGH'
}

/**
 * Auto-assign subjects to a class based on its grade
 * Returns subject requirements for the class
 */
export function autoAssignSubjectsToClass(
  className: string,
  allSubjects: Subject[]
): ClassGroup['subjectRequirements'] {
  const grade = extractGradeFromClassName(className);
  
  if (!grade) {
    console.warn(`Could not extract grade from class name: ${className}`);
    return [];
  }
  
  // Get official subjects for this grade
  const officialSubjects = getSubjectsForGrade(grade);
  
  // Find matching subjects in the database for this grade
  const section = gradeToSection(grade);
  const gradeSubjects = allSubjects.filter(s => s.grade === grade && (!s.section || s.section === section));
  
  // Create subject requirements
  const requirements = officialSubjects.map(official => {
    // Find the saved subject for this grade
    const savedSubject = gradeSubjects.find(s => s.name === official.name);
    
    if (savedSubject) {
      return {
        subjectId: savedSubject.id,
        periodsPerWeek: savedSubject.periodsPerWeek || official.periodsPerWeek,
        minConsecutive: 1,
        maxConsecutive: 2,
      };
    } else {
      // Subject not in database yet - this shouldn't happen if subjects step was completed
      console.warn(`Subject "${official.name}" for grade ${grade} not found in database`);
      return null;
    }
  }).filter(req => req !== null) as ClassGroup['subjectRequirements'];
  
  return requirements;
}

/**
 * Check if a class has all required subjects assigned
 */
export function validateClassSubjects(
  cls: ClassGroup,
  allSubjects: Subject[],
  expectedPeriodsPerWeek: number
): {
  isValid: boolean;
  totalPeriods: number;
  missingPeriods: number;
  grade: number | null;
} {
  const grade = extractGradeFromClassName(cls.name);
  
  if (!grade) {
    return {
      isValid: false,
      totalPeriods: 0,
      missingPeriods: expectedPeriodsPerWeek,
      grade: null
    };
  }
  
  const requirements = Array.isArray(cls.subjectRequirements) 
    ? cls.subjectRequirements 
    : [];
    
  const totalPeriods = requirements.reduce((sum, req) => sum + (req.periodsPerWeek || 0), 0);
  
  return {
    isValid: totalPeriods === expectedPeriodsPerWeek,
    totalPeriods,
    missingPeriods: expectedPeriodsPerWeek - totalPeriods,
    grade
  };
}

/**
 * Get a display name for a grade in the appropriate language
 */
export function getGradeDisplayName(grade: number, language: string = "en"): string {
  if (language === "fa") {
    const persianNames: { [key: number]: string } = {
      1: "اول", 2: "دوم", 3: "سوم", 4: "چهارم", 5: "پنجم",
      6: "ششم", 7: "هفتم", 8: "هشتم", 9: "نهم",
      10: "دهم", 11: "یازدهم", 12: "دوازدهم"
    };
    return `صنف ${persianNames[grade] || grade}`;
  }
  
  return `Grade ${grade}`;
}

