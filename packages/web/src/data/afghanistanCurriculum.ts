

export interface SubjectInfo {
  name: string;
  nameEn: string;  // English translation
  code: string;
  periodsPerWeek: number;  // Mandated by Ministry
  isDifficult?: boolean;
  requiredRoomType?: string;
}

export interface GradeSubjects {
  [key: string]: SubjectInfo[];
}

// Official Afghan Ministry of Education curriculum with periods
// For 8 periods/day × 6 days - 6 breaks = 42 periods required
export const afghanistanCurriculumWithPeriods: GradeSubjects = {
  grade_1: [
    { name: "دری", nameEn: "Dari Language", code: "دری۱", periodsPerWeek: 5 },
    { name: "پشتو", nameEn: "Pashto Language", code: "پشت۱", periodsPerWeek: 4 },
    { name: "ریاضی", nameEn: "Mathematics", code: "ریض۱", periodsPerWeek: 4 },
    { name: "علوم دینی", nameEn: "Islamic Studies", code: "اسل۱", periodsPerWeek: 2 },
    { name: "قرآن‌کریم", nameEn: "Holy Quran", code: "قرآ۱", periodsPerWeek: 3 },
    { name: "ساینس", nameEn: "Science", code: "سای۱", periodsPerWeek: 4 },
    { name: "مطالعات اجتماعی", nameEn: "Social Studies", code: "مطال۱", periodsPerWeek: 3 },
    { name: "جسمانی تربیه", nameEn: "Physical Education", code: "جسم۱", periodsPerWeek: 2 },
    { name: "هنر", nameEn: "Art", code: "هنر۱", periodsPerWeek: 2 },
    { name: "حرفه‌ای", nameEn: "Vocational Skills", code: "حرف۱", periodsPerWeek: 2 },
  ], // Total: 31 periods (flexible for primary)
  
  grade_2: [
    { name: "دری", nameEn: "Dari Language", code: "دری۲", periodsPerWeek: 5 },
    { name: "پشتو", nameEn: "Pashto Language", code: "پشت۲", periodsPerWeek: 4 },
    { name: "ریاضی", nameEn: "Mathematics", code: "ریض۲", periodsPerWeek: 5 },
    { name: "علوم دینی", nameEn: "Islamic Studies", code: "اسل۲", periodsPerWeek: 2 },
    { name: "قرآن‌کریم", nameEn: "Holy Quran", code: "قرآ۲", periodsPerWeek: 3 },
    { name: "ساینس", nameEn: "Science", code: "سای۲", periodsPerWeek: 4 },
    { name: "مطالعات اجتماعی", nameEn: "Social Studies", code: "مطال۲", periodsPerWeek: 3 },
    { name: "جسمانی تربیه", nameEn: "Physical Education", code: "جسم۲", periodsPerWeek: 2 },
    { name: "هنر", nameEn: "Art", code: "هنر۲", periodsPerWeek: 2 },
    { name: "حرفه‌ای", nameEn: "Vocational Skills", code: "حرف۲", periodsPerWeek: 2 },
  ], // Total: 32 periods
  
  grade_3: [
    { name: "دری", nameEn: "Dari Language", code: "دری۳", periodsPerWeek: 5 },
    { name: "پشتو", nameEn: "Pashto Language", code: "پشت۳", periodsPerWeek: 4 },
    { name: "ریاضی", nameEn: "Mathematics", code: "ریض۳", periodsPerWeek: 5 },
    { name: "علوم دینی", nameEn: "Islamic Studies", code: "اسل۳", periodsPerWeek: 2 },
    { name: "قرآن‌کریم", nameEn: "Holy Quran", code: "قرآ۳", periodsPerWeek: 3 },
    { name: "ساینس", nameEn: "Science", code: "سای۳", periodsPerWeek: 4 },
    { name: "مطالعات اجتماعی", nameEn: "Social Studies", code: "مطال۳", periodsPerWeek: 3 },
    { name: "جسمانی تربیه", nameEn: "Physical Education", code: "جسم۳", periodsPerWeek: 2 },
    { name: "هنر", nameEn: "Art", code: "هنر۳", periodsPerWeek: 2 },
    { name: "حرفه‌ای", nameEn: "Vocational Skills", code: "حرف۳", periodsPerWeek: 2 },
  ], // Total: 32 periods
  
  grade_4: [
    { name: "دری", nameEn: "Dari Language", code: "دری۴", periodsPerWeek: 5 },
    { name: "پشتو", nameEn: "Pashto Language", code: "پشت۴", periodsPerWeek: 4 },
    { name: "ریاضی", nameEn: "Mathematics", code: "ریض۴", periodsPerWeek: 5, isDifficult: true },
    { name: "علوم دینی", nameEn: "Islamic Studies", code: "اسل۴", periodsPerWeek: 2 },
    { name: "قرآن‌کریم", nameEn: "Holy Quran", code: "قرآ۴", periodsPerWeek: 3 },
    { name: "ساینس", nameEn: "Science", code: "سای۴", periodsPerWeek: 4 },
    { name: "مطالعات اجتماعی", nameEn: "Social Studies", code: "مطال۴", periodsPerWeek: 3 },
    { name: "جسمانی تربیه", nameEn: "Physical Education", code: "جسم۴", periodsPerWeek: 2 },
    { name: "هنر", nameEn: "Art", code: "هنر۴", periodsPerWeek: 2 },
    { name: "حرفه‌ای", nameEn: "Vocational Skills", code: "حرف۴", periodsPerWeek: 2 },
  ], // Total: 32 periods
  
  grade_5: [
    { name: "دری", nameEn: "Dari Language", code: "دری۵", periodsPerWeek: 5 },
    { name: "پشتو", nameEn: "Pashto Language", code: "پشت۵", periodsPerWeek: 4 },
    { name: "ریاضی", nameEn: "Mathematics", code: "ریض۵", periodsPerWeek: 5, isDifficult: true },
    { name: "علوم دینی", nameEn: "Islamic Studies", code: "اسل۵", periodsPerWeek: 2 },
    { name: "قرآن‌کریم", nameEn: "Holy Quran", code: "قرآ۵", periodsPerWeek: 3 },
    { name: "ساینس", nameEn: "Science", code: "سای۵", periodsPerWeek: 4 },
    { name: "مطالعات اجتماعی", nameEn: "Social Studies", code: "مطال۵", periodsPerWeek: 3 },
    { name: "جسمانی تربیه", nameEn: "Physical Education", code: "جسم۵", periodsPerWeek: 2 },
    { name: "هنر", nameEn: "Art", code: "هنر۵", periodsPerWeek: 2 },
    { name: "حرفه‌ای", nameEn: "Vocational Skills", code: "حرف۵", periodsPerWeek: 2 },
  ], // Total: 32 periods
  
  grade_6: [
    { name: "دری", nameEn: "Dari Language", code: "دری۶", periodsPerWeek: 5 },
    { name: "پشتو", nameEn: "Pashto Language", code: "پشت۶", periodsPerWeek: 4 },
    { name: "ریاضی", nameEn: "Mathematics", code: "ریض۶", periodsPerWeek: 5, isDifficult: true },
    { name: "علوم دینی", nameEn: "Islamic Studies", code: "اسل۶", periodsPerWeek: 2 },
    { name: "قرآن‌کریم", nameEn: "Holy Quran", code: "قرآ۶", periodsPerWeek: 3 },
    { name: "ساینس", nameEn: "Science", code: "سای۶", periodsPerWeek: 4 },
    { name: "مطالعات اجتماعی", nameEn: "Social Studies", code: "مطال۶", periodsPerWeek: 3 },
    { name: "جسمانی تربیه", nameEn: "Physical Education", code: "جسم۶", periodsPerWeek: 2 },
    { name: "هنر", nameEn: "Art", code: "هنر۶", periodsPerWeek: 2 },
    { name: "حرفه‌ای", nameEn: "Vocational Skills", code: "حرف۶", periodsPerWeek: 2 },
  ], // Total: 32 periods

  grade_7: [
    { name: "ریاضی", nameEn: "Mathematics", code: "ریض۷", periodsPerWeek: 5, isDifficult: true },
    { name: "دری", nameEn: "Dari Language", code: "دری۷", periodsPerWeek: 4 },
    { name: "پشتو", nameEn: "Pashto Language", code: "پشت۷", periodsPerWeek: 4 },
    { name: "انګلیسي", nameEn: "English", code: "انګ۷", periodsPerWeek: 4 },
    { name: "علوم دینی ح", nameEn: "Islamic Studies (Hanafi)", code: "اسح۷", periodsPerWeek: 2 },
    { name: "علوم دینی ج", nameEn: "Islamic Studies (Jafari)", code: "اسج۷", periodsPerWeek: 1 },
    { name: "قرآن‌کریم", nameEn: "Holy Quran", code: "قرآ۷", periodsPerWeek: 3 },
    { name: "فزیک", nameEn: "Physics", code: "فزی۷", periodsPerWeek: 3, isDifficult: true, requiredRoomType: "Science Lab" },
    { name: "کیمیا", nameEn: "Chemistry", code: "کیم۷", periodsPerWeek: 3, isDifficult: true, requiredRoomType: "Science Lab" },
    { name: "بیالوژی", nameEn: "Biology", code: "بیو۷", periodsPerWeek: 3, requiredRoomType: "Science Lab" },
    { name: "تاریخ", nameEn: "History", code: "تار۷", periodsPerWeek: 2 },
    { name: "جغرافیه", nameEn: "Geography", code: "جغر۷", periodsPerWeek: 2 },
    { name: "م.مدنی", nameEn: "Civic Education", code: "مدن۷", periodsPerWeek: 2 },
    { name: "هنررسامی", nameEn: "Art", code: "هنر۷", periodsPerWeek: 2 },
    { name: "حرفه", nameEn: "Vocational Skills", code: "حرف۷", periodsPerWeek: 2 },
  ], // Total: 42 periods

  grade_8: [
    { name: "ریاضی", nameEn: "Mathematics", code: "ریض۸", periodsPerWeek: 5, isDifficult: true },
    { name: "دری", nameEn: "Dari Language", code: "دری۸", periodsPerWeek: 4 },
    { name: "پشتو", nameEn: "Pashto Language", code: "پشت۸", periodsPerWeek: 4 },
    { name: "انګلیسي", nameEn: "English", code: "انګ۸", periodsPerWeek: 4 },
    { name: "علوم دینی ح", nameEn: "Islamic Studies (Hanafi)", code: "اسح۸", periodsPerWeek: 2 },
    { name: "علوم دینی ج", nameEn: "Islamic Studies (Jafari)", code: "اسج۸", periodsPerWeek: 1 },
    { name: "قرآن‌کریم", nameEn: "Holy Quran", code: "قرآ۸", periodsPerWeek: 3 },
    { name: "فزیک", nameEn: "Physics", code: "فزی۸", periodsPerWeek: 4, isDifficult: true, requiredRoomType: "Science Lab" },
    { name: "کیمیا", nameEn: "Chemistry", code: "کیم۸", periodsPerWeek: 4, isDifficult: true, requiredRoomType: "Science Lab" },
    { name: "بیالوژی", nameEn: "Biology", code: "بیو۸", periodsPerWeek: 3, requiredRoomType: "Science Lab" },
    { name: "تاریخ", nameEn: "History", code: "تار۸", periodsPerWeek: 2 },
    { name: "جغرافیه", nameEn: "Geography", code: "جغر۸", periodsPerWeek: 2 },
    { name: "م.مدنی", nameEn: "Civic Education", code: "مدن۸", periodsPerWeek: 2 },
    { name: "هنررسامی", nameEn: "Art", code: "هنر۸", periodsPerWeek: 2 },
  ], // Total: 42 periods

  grade_9: [
    { name: "ریاضی", nameEn: "Mathematics", code: "ریض۹", periodsPerWeek: 5, isDifficult: true },
    { name: "دری", nameEn: "Dari Language", code: "دری۹", periodsPerWeek: 4 },
    { name: "پشتو", nameEn: "Pashto Language", code: "پشت۹", periodsPerWeek: 4 },
    { name: "انګلیسي", nameEn: "English", code: "انګ۹", periodsPerWeek: 4 },
    { name: "علوم دینی ح", nameEn: "Islamic Studies (Hanafi)", code: "اسح۹", periodsPerWeek: 2 },
    { name: "علوم دینی ج", nameEn: "Islamic Studies (Jafari)", code: "اسج۹", periodsPerWeek: 1 },
    { name: "قرآن‌کریم", nameEn: "Holy Quran", code: "قرآ۹", periodsPerWeek: 3 },
    { name: "فزیک", nameEn: "Physics", code: "فزی۹", periodsPerWeek: 4, isDifficult: true, requiredRoomType: "Science Lab" },
    { name: "کیمیا", nameEn: "Chemistry", code: "کیم۹", periodsPerWeek: 4, isDifficult: true, requiredRoomType: "Science Lab" },
    { name: "بیالوژی", nameEn: "Biology", code: "بیو۹", periodsPerWeek: 3, requiredRoomType: "Science Lab" },
    { name: "تاریخ", nameEn: "History", code: "تار۹", periodsPerWeek: 2 },
    { name: "جغرافیه", nameEn: "Geography", code: "جغر۹", periodsPerWeek: 2 },
    { name: "م.مدنی", nameEn: "Civic Education", code: "مدن۹", periodsPerWeek: 2 },
    { name: "هنررسامی", nameEn: "Art", code: "هنر۹", periodsPerWeek: 2 },
  ], // Total: 42 periods

  grade_10: [
    { name: "ریاضی", nameEn: "Mathematics", code: "ریض۱۰", periodsPerWeek: 5, isDifficult: true },
    { name: "دری", nameEn: "Dari Language", code: "دری۱۰", periodsPerWeek: 4 , isDifficult: true },
    { name: "پشتو", nameEn: "Pashto Language", code: "پشت۱۰", periodsPerWeek: 4 },
    { name: "انګلیسي", nameEn: "English", code: "انګ۱۰", periodsPerWeek: 4 },
    { name: "تعلیمات اسلامی", nameEn: "Islamic Education", code: "اسل۱۰", periodsPerWeek: 3 },
    { name: "جعفری", nameEn: "Jafari Jurisprudence", code: "جعف۱۰", periodsPerWeek: 1 },
    { name: "تفسیر", nameEn: "Tafsir (Quranic Interpretation)", code: "تفس۱۰", periodsPerWeek: 2 },
    { name: "فزیک", nameEn: "Physics", code: "فزی۱۰", periodsPerWeek: 4, isDifficult: true, requiredRoomType: "Science Lab" },
    { name: "کیمیا", nameEn: "Chemistry", code: "کیم۱۰", periodsPerWeek: 4, isDifficult: true, requiredRoomType: "Science Lab" },
    { name: "بیالوژی", nameEn: "Biology", code: "بیو۱۰", periodsPerWeek: 3, requiredRoomType: "Science Lab" },
    { name: "جيولوژي", nameEn: "Geology", code: "جیو۱۰", periodsPerWeek: 2, requiredRoomType: "Science Lab" }, // ONLY for Grade 10!
    { name: "تاریخ", nameEn: "History", code: "تار۱۰", periodsPerWeek: 2 },
    { name: "جغرافیه", nameEn: "Geography", code: "جغر۱۰", periodsPerWeek: 2 },
    { name: "م.مدنی", nameEn: "Civic Education", code: "مدن۱۰", periodsPerWeek: 2 },
  ], // Total: 42 periods

  grade_11: [
    { name: "ریاضی", nameEn: "Mathematics", code: "ریض۱۱", periodsPerWeek: 5, isDifficult: true },
    { name: "دری", nameEn: "Dari Language", code: "دری۱۱", periodsPerWeek: 4 },
    { name: "پشتو", nameEn: "Pashto Language", code: "پشت۱۱", periodsPerWeek: 4 },
    { name: "انګلیسي", nameEn: "English", code: "انګ۱۱", periodsPerWeek: 4 },
    { name: "تعلیمات اسلامی", nameEn: "Islamic Education", code: "اسل۱۱", periodsPerWeek: 3 },
    { name: "جعفری", nameEn: "Jafari Jurisprudence", code: "جعف۱۱", periodsPerWeek: 1 },
    { name: "تفسیر", nameEn: "Tafsir (Quranic Interpretation)", code: "تفس۱۱", periodsPerWeek: 2 },
    { name: "فزیک", nameEn: "Physics", code: "فزی۱۱", periodsPerWeek: 4, isDifficult: true, requiredRoomType: "Science Lab" },
    { name: "کیمیا", nameEn: "Chemistry", code: "کیم۱۱", periodsPerWeek: 4, isDifficult: true, requiredRoomType: "Science Lab" },
    { name: "بیالوژی", nameEn: "Biology", code: "بیو۱۱", periodsPerWeek: 3, requiredRoomType: "Science Lab" },
    { name: "تاریخ", nameEn: "History", code: "تار۱۱", periodsPerWeek: 2 },
    { name: "جغرافیه", nameEn: "Geography", code: "جغر۱۱", periodsPerWeek: 2 },
    { name: "م.مدنی", nameEn: "Civic Education", code: "مدن۱۱", periodsPerWeek: 2 },
    { name: "كمپيوتر", nameEn: "Computer Science", code: "کمپ۱۱", periodsPerWeek: 2 },
  ], // Total: 42 periods

  grade_12: [
    { name: "ریاضی", nameEn: "Mathematics", code: "ریض۱۲", periodsPerWeek: 5, isDifficult: true },
    { name: "دری", nameEn: "Dari Language", code: "دری۱۲", periodsPerWeek: 4 },
    { name: "پشتو", nameEn: "Pashto Language", code: "پشت۱۲", periodsPerWeek: 4 },
    { name: "انګلیسي", nameEn: "English", code: "انګ۱۲", periodsPerWeek: 4 },
    { name: "تعلیمات اسلامی", nameEn: "Islamic Education", code: "اسل۱۲", periodsPerWeek: 3 },
    { name: "جعفری", nameEn: "Jafari Jurisprudence", code: "جعف۱۲", periodsPerWeek: 1 },
    { name: "تفسیر", nameEn: "Tafsir (Quranic Interpretation)", code: "تفس۱۲", periodsPerWeek: 2 },
    { name: "فزیک", nameEn: "Physics", code: "فزی۱۲", periodsPerWeek: 4, isDifficult: true, requiredRoomType: "Science Lab" },
    { name: "کیمیا", nameEn: "Chemistry", code: "کیم۱۲", periodsPerWeek: 4, isDifficult: true, requiredRoomType: "Science Lab" },
    { name: "بیالوژی", nameEn: "Biology", code: "بیو۱۲", periodsPerWeek: 3, requiredRoomType: "Science Lab" },
    { name: "تاریخ", nameEn: "History", code: "تار۱۲", periodsPerWeek: 2 },
    { name: "جغرافیه", nameEn: "Geography", code: "جغر۱۲", periodsPerWeek: 2 },
    { name: "م.مدنی", nameEn: "Civic Education", code: "مدن۱۲", periodsPerWeek: 2 },
    { name: "كمپيوتر", nameEn: "Computer Science", code: "کمپ۱۲", periodsPerWeek: 2 },
  ], // Total: 42 periods
};

// Legacy format for backward compatibility (names only)
export const afghanistanCurriculum: { [key: string]: string[] } = {
  grade_1: afghanistanCurriculumWithPeriods.grade_1.map(s => s.name),
  grade_2: afghanistanCurriculumWithPeriods.grade_2.map(s => s.name),
  grade_3: afghanistanCurriculumWithPeriods.grade_3.map(s => s.name),
  grade_4: afghanistanCurriculumWithPeriods.grade_4.map(s => s.name),
  grade_5: afghanistanCurriculumWithPeriods.grade_5.map(s => s.name),
  grade_6: afghanistanCurriculumWithPeriods.grade_6.map(s => s.name),
  grade_7: afghanistanCurriculumWithPeriods.grade_7.map(s => s.name),
  grade_8: afghanistanCurriculumWithPeriods.grade_8.map(s => s.name),
  grade_9: afghanistanCurriculumWithPeriods.grade_9.map(s => s.name),
  grade_10: afghanistanCurriculumWithPeriods.grade_10.map(s => s.name),
  grade_11: afghanistanCurriculumWithPeriods.grade_11.map(s => s.name),
  grade_12: afghanistanCurriculumWithPeriods.grade_12.map(s => s.name),
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
 * Get subjects with periods for a specific grade
 */
export const getSubjectsForGrade = (grade: number): SubjectInfo[] => {
  const gradeKey = `grade_${grade}`;
  return afghanistanCurriculumWithPeriods[gradeKey] || [];
};

/**
 * Get subject names only for a specific grade (legacy compatibility)
 */
export const getSubjectNamesForGrade = (grade: number): string[] => {
  const gradeKey = `grade_${grade}`;
  return afghanistanCurriculum[gradeKey] || [];
};

/**
 * Get all grades available in the curriculum (1-12)
 */
export const getAllGrades = (): number[] => {
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
};

/**
 * Get total periods for a grade
 */
export const getTotalPeriodsForGrade = (grade: number): number => {
  const subjects = getSubjectsForGrade(grade);
  return subjects.reduce((sum, s) => sum + s.periodsPerWeek, 0);
};

/**
 * Validate that grade has correct number of periods
 */
export const validateGradePeriods = (grade: number, expectedTotal: number = 42): {
  isValid: boolean;
  actual: number;
  expected: number;
  difference: number;
} => {
  const actual = getTotalPeriodsForGrade(grade);
  return {
    isValid: actual === expectedTotal,
    actual,
    expected: expectedTotal,
    difference: expectedTotal - actual
  };
};

/**
 * Get subjects for multiple grades (each subject tagged with its grade)
 */
export const getSubjectsForGrades = (grades: number[]): SubjectInfo[] => {
  const allSubjects: SubjectInfo[] = [];
  grades.forEach(grade => {
    const subjects = getSubjectsForGrade(grade);
    allSubjects.push(...subjects);
  });
  return allSubjects;
};

/**
 * Check if a subject exists for a specific grade
 */
export const isOfficialSubject = (subjectName: string, grade?: number): boolean => {
  if (grade) {
    const subjects = getSubjectsForGrade(grade);
    return subjects.some(s => s.name === subjectName);
  }
  
  // Check all grades
  return getAllGrades().some(g => {
    const subjects = getSubjectsForGrade(g);
    return subjects.some(s => s.name === subjectName);
  });
};

/**
 * Get the appropriate room type for a subject
 */
export const getRoomTypeForSubject = (subjectName: string): string => {
  // Check if subject has specified room type in curriculum
  for (const grade of getAllGrades()) {
    const subject = getSubjectsForGrade(grade).find(s => s.name === subjectName);
    if (subject?.requiredRoomType) {
      return subject.requiredRoomType;
    }
  }
  
  // Default to regular classroom
  return "عادی";
};

/**
 * Get curriculum compliance percentage for a grade
 */
export const getCompliancePercentageForGrade = (subjectNames: string[], grade: number): number => {
  const officialSubjects = getSubjectsForGrade(grade);
  if (officialSubjects.length === 0) return 100;
  
  const officialNames = new Set(officialSubjects.map(s => s.name));
  const matchingCount = subjectNames.filter(name => officialNames.has(name)).length;
  
  return Math.round((matchingCount / officialSubjects.length) * 100);
};
