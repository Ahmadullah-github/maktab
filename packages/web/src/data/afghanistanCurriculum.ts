/**
 * Official Afghanistan Ministry of Education Curriculum
 * Grade-wise subjects for primary and secondary education
 */

export interface GradeSubjects {
  [key: string]: string[];
}

export const afghanistanCurriculum: GradeSubjects = {
  grade_1: ["علوم دینی ح", "علوم دینی ج", "ریاضی", "مهارت‌ها", "هنررسامی", "حسن‌خط", "دری", "قرآن‌کریم"],
  grade_2: ["علوم دینی ح", "علوم دینی ج", "ریاضی", "مهارت‌ها", "هنررسامی", "حسن‌خط", "دری", "قرآن‌کریم"],
  grade_3: ["علوم دینی ح", "علوم دینی ج", "ریاضی", "مهارت‌ها", "هنررسامی", "حسن‌خط", "دری", "قرآن‌کریم"],
  grade_4: ["علوم دینی ح", "علوم دینی ج", "ریاضی", "اجتماعیات", "هنررسامی", "حسن‌خط", "دری", "قرآن‌کریم", "پشتو", "ساینس", "انګلیسی"],
  grade_5: ["علوم دینی ح", "علوم دینی ج", "ریاضی", "اجتماعیات", "هنررسامی", "حسن‌خط", "دری", "قرآن‌کریم", "پشتو", "ساینس", "انګلیسی"],
  grade_6: ["علوم دینی ح", "علوم دینی ج", "ریاضی", "اجتماعیات", "هنررسامی", "حسن‌خط", "دری", "قرآن‌کریم", "پشتو", "ساینس", "انګلیسی"],
  grade_7: ["علوم دینی ح", "علوم دینی ج", "ریاضی", "حرفه", "هنررسامی", "عربی", "دری", "تجوید", "بیالوژی", "پشتو", "جغرافیه", "تاریخ", "فزیک", "کیمیا", "وطندوستی", "م.مدنی", "انګلیسي"],
  grade_8: ["علوم دینی ح", "علوم دینی ج", "ریاضی", "هنررسامی", "عربی", "دری", "بیالوژی", "پشتو", "جغرافیه", "تاریخ", "فزیک", "کیمیا", "م.مدنی", "انګلیسي"],
  grade_9: ["علوم دینی ح", "علوم دینی ج", "ریاضی", "حرفه", "هنررسامی", "عربی", "دری", "تجوید", "بیالوژی", "پشتو", "جغرافیه", "تاریخ", "فزیک", "کیمیا", "وطندوستی", "م.مدنی", "انګلیسي"],
  grade_10: ["تعلیمات اسلامی", "جعفری", "ریاضی", "كمپيوتر", "جيولوژي", "دری", "تفسیر", "بیالوژی", "پشتو", "جغرافیه", "تاریخ", "فزیک", "کیمیا", "م.مدنی", "انګلیسي"],
  grade_11: ["تعلیمات اسلامی", "جعفری", "ریاضی", "كمپيوتر", "دری", "تفسیر", "بیالوژی", "پشتو", "جغرافیه", "تاریخ", "فزیک", "کیمیا", "م.مدنی", "انګلیسي"],
  grade_12: ["تعلیمات اسلامی", "جعفری", "ریاضی", "كمپيوتر", "دری", "تفسیر", "بیالوژی", "پشتو", "جغرافیه", "تاریخ", "فزیک", "کیمیا", "م.مدنی", "انګلیسي"],
};

export const supplementaryMaterials = {
  new_books_grade_1_to_3: ["دری", "مشق و تمرین", "رهنمای معلم", "ارزیابی مداوم شاگردان"],
  language_subjects_grades_1_to_6: {
    grade_1: ["ازبکی", "بلوچی", "پشه‌یی"],
    grade_2: ["ازبکی", "بلوچی", "پشه‌یی"],
    grade_3: ["ازبکی", "بلوچی", "پشه‌یی"],
    grade_4: ["ازبکی", "بلوچی", "پشه‌یی"],
    grade_5: ["ازبکی", "بلوچی", "پشه‌یی"],
    grade_6: ["ازبکی", "بلوچی", "پشه‌یی"],
    grade_7: ["ازبکی", "بلوچی", "پشه‌یی"],
    grade_8: ["ازبکی", "بلوچی", "پشه‌یی"],
    grade_9: ["ازبکی", "بلوچی", "پشه‌یی"],
  },
};

/**
 * Get subjects for a specific grade
 */
export const getSubjectsForGrade = (grade: number): string[] => {
  const gradeKey = `grade_${grade}`;
  return afghanistanCurriculum[gradeKey] || [];
};

/**
 * Get all grades available in the curriculum
 */
export const getAllGrades = (): number[] => {
  return Object.keys(afghanistanCurriculum)
    .map(key => parseInt(key.replace('grade_', '')))
    .sort((a, b) => a - b);
};

/**
 * Get subjects for multiple grades (combined and unique)
 */
export const getSubjectsForGrades = (grades: number[]): string[] => {
  const allSubjects = new Set<string>();
  grades.forEach(grade => {
    const subjects = getSubjectsForGrade(grade);
    subjects.forEach(subject => allSubjects.add(subject));
  });
  return Array.from(allSubjects);
};

/**
 * Check if a subject is in the official curriculum
 */
export const isOfficialSubject = (subjectName: string, grade?: number): boolean => {
  if (grade) {
    const subjects = getSubjectsForGrade(grade);
    return subjects.includes(subjectName);
  }
  
  // Check all grades
  return Object.values(afghanistanCurriculum).some(subjects => 
    subjects.includes(subjectName)
  );
};

/**
 * Get the appropriate room type for a subject
 */
export const getRoomTypeForSubject = (subjectName: string): string => {
  // Map subjects to room types based on subject characteristics
  const labSubjects = ["بیالوژی", "فزیک", "کیمیا", "كمپيوتر"];
  const languageSubjects = ["دری", "پشتو", "عربی", "انګلیسي", "ازبکی", "بلوچی", "پشه‌یی"];
  
  if (labSubjects.some(s => subjectName.includes(s))) {
    if (subjectName.includes("کیمیا")) return "آزمایشگاه کیمیا";
    if (subjectName.includes("فزیک")) return "آزمایشگاه فزیک";
    if (subjectName.includes("كمپيوتر")) return "آزمایشگاه کمپیوتر";
    if (subjectName.includes("بیالوژی")) return "آزمایشگاه بیولوژی";
  }
  
  // Default to regular classroom
  return "عادی";
};

/**
 * Get curriculum compliance percentage
 */
export const getCompliancePercentage = (subjects: string[], grades: number[]): number => {
  const officialSubjects = getSubjectsForGrades(grades);
  const officialSet = new Set(officialSubjects);
  
  if (officialSet.size === 0) return 100;
  
  const matchingSubjects = subjects.filter(s => officialSet.has(s)).length;
  return Math.round((matchingSubjects / officialSet.size) * 100);
};
