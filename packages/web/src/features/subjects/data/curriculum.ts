/**
 * Afghanistan Ministry of Education Official Curriculum
 * Frontend copy for preview purposes
 *
 * This mirrors the backend curriculum data to enable rich previews
 * in the CurriculumDialog without additional API calls.
 */

// ==============================================================================
// Types
// ==============================================================================

export interface SubjectDefinition {
  name: string;
  nameEn: string;
  code: string;
  periodsPerWeek: number;
  isDifficult?: boolean;
  requiredRoomType?: string;
  isCore?: boolean;
}

export interface GradeSubjects {
  [gradeKey: string]: SubjectDefinition[];
}

export type GradeCategory = 'Alpha-Primary' | 'Beta-Primary' | 'Middle' | 'High';

export interface GradeCategoryInfo {
  category: GradeCategory;
  grades: number[];
  totalPeriods: number;
  description: string;
  descriptionFa: string;
}

// ==============================================================================
// Grade Category Mapping
// ==============================================================================

export const GRADE_CATEGORIES: Record<GradeCategory, GradeCategoryInfo> = {
  'Alpha-Primary': {
    category: 'Alpha-Primary',
    grades: [1, 2, 3],
    totalPeriods: 24,
    description: 'Primary School (Grades 1-3)',
    descriptionFa: 'ابتدایی الف (صنف ۱-۳)',
  },
  'Beta-Primary': {
    category: 'Beta-Primary',
    grades: [4, 5, 6],
    totalPeriods: 32,
    description: 'Primary School (Grades 4-6)',
    descriptionFa: 'ابتدایی ب (صنف ۴-۶)',
  },
  Middle: {
    category: 'Middle',
    grades: [7, 8, 9],
    totalPeriods: 36,
    description: 'Middle School (Grades 7-9)',
    descriptionFa: 'متوسطه (صنف ۷-۹)',
  },
  High: {
    category: 'High',
    grades: [10, 11, 12],
    totalPeriods: 36,
    description: 'High School (Grades 10-12)',
    descriptionFa: 'لیسه (صنف ۱۰-۱۲)',
  },
};

export const getGradeCategory = (grade: number): GradeCategory | null => {
  if (grade >= 1 && grade <= 3) return 'Alpha-Primary';
  if (grade >= 4 && grade <= 6) return 'Beta-Primary';
  if (grade >= 7 && grade <= 9) return 'Middle';
  if (grade >= 10 && grade <= 12) return 'High';
  return null;
};

export const getExpectedTotalPeriods = (grade: number): number => {
  const category = getGradeCategory(grade);
  return category ? GRADE_CATEGORIES[category].totalPeriods : 42;
};

// ==============================================================================
// Official Ministry Curriculum
// ==============================================================================

export const MINISTRY_CURRICULUM: GradeSubjects = {
  grade_1: [
    { name: 'دری', nameEn: 'Dari Language', code: 'دری۱', periodsPerWeek: 6, isCore: true },
    { name: 'ریاضی', nameEn: 'Mathematics', code: 'ریض۱', periodsPerWeek: 5, isCore: true },
    {
      name: 'تعلیم و تربیه اسلامی',
      nameEn: 'Islamic Studies',
      code: 'اسل۱',
      periodsPerWeek: 5,
      isCore: true,
    },
    { name: 'قرآن‌کریم', nameEn: 'Holy Quran', code: 'قرآ۱', periodsPerWeek: 5, isCore: true },
    { name: 'تربیت بدنی', nameEn: 'Physical Education', code: 'ترب۱', periodsPerWeek: 1 },
    { name: 'رسم و خط', nameEn: 'Art & Calligraphy', code: 'رسم۱', periodsPerWeek: 2 },
  ],
  grade_2: [
    { name: 'دری', nameEn: 'Dari Language', code: 'دری۲', periodsPerWeek: 6, isCore: true },
    { name: 'ریاضی', nameEn: 'Mathematics', code: 'ریض۲', periodsPerWeek: 5, isCore: true },
    {
      name: 'تعلیم و تربیه اسلامی',
      nameEn: 'Islamic Studies',
      code: 'اسل۲',
      periodsPerWeek: 5,
      isCore: true,
    },
    { name: 'قرآن‌کریم', nameEn: 'Holy Quran', code: 'قرآ۲', periodsPerWeek: 5, isCore: true },
    { name: 'تربیت بدنی', nameEn: 'Physical Education', code: 'ترب۲', periodsPerWeek: 1 },
    { name: 'رسم و خط', nameEn: 'Art & Calligraphy', code: 'رسم۲', periodsPerWeek: 2 },
  ],
  grade_3: [
    { name: 'دری', nameEn: 'Dari Language', code: 'دری۳', periodsPerWeek: 6, isCore: true },
    { name: 'ریاضی', nameEn: 'Mathematics', code: 'ریض۳', periodsPerWeek: 5, isCore: true },
    {
      name: 'تعلیم و تربیه اسلامی',
      nameEn: 'Islamic Studies',
      code: 'اسل۳',
      periodsPerWeek: 5,
      isCore: true,
    },
    { name: 'قرآن‌کریم', nameEn: 'Holy Quran', code: 'قرآ۳', periodsPerWeek: 5, isCore: true },
    { name: 'تربیت بدنی', nameEn: 'Physical Education', code: 'ترب۳', periodsPerWeek: 1 },
    { name: 'رسم و خط', nameEn: 'Art & Calligraphy', code: 'رسم۳', periodsPerWeek: 2 },
  ],
  grade_4: [
    { name: 'دری', nameEn: 'Dari Language', code: 'دری۴', periodsPerWeek: 4, isCore: true },
    { name: 'پشتو', nameEn: 'Pashto Language', code: 'پشت۴', periodsPerWeek: 3, isCore: true },
    { name: 'انگلیسی', nameEn: 'English', code: 'انگ۴', periodsPerWeek: 2 },
    {
      name: 'ریاضی',
      nameEn: 'Mathematics',
      code: 'ریض۴',
      periodsPerWeek: 5,
      isDifficult: true,
      isCore: true,
    },
    {
      name: 'تعلیم و تربیه اسلامی',
      nameEn: 'Islamic Studies',
      code: 'اسل۴',
      periodsPerWeek: 4,
      isCore: true,
    },
    { name: 'قرآن‌کریم', nameEn: 'Holy Quran', code: 'قرآ۴', periodsPerWeek: 5, isCore: true },
    { name: 'ساینس', nameEn: 'Science', code: 'ساین۴', periodsPerWeek: 2 },
    { name: 'دروس اجتماعی', nameEn: 'Social Studies', code: 'اجت۴', periodsPerWeek: 2 },
    { name: 'رسم و خط', nameEn: 'Art & Calligraphy', code: 'رسم۴', periodsPerWeek: 2 },
    { name: 'تربیت بدنی', nameEn: 'Physical Education', code: 'ترب۴', periodsPerWeek: 1 },
    { name: 'حرفه', nameEn: 'Vocational Skills', code: 'حرف۴', periodsPerWeek: 2 },
  ],
  grade_5: [
    { name: 'دری', nameEn: 'Dari Language', code: 'دری۵', periodsPerWeek: 4, isCore: true },
    { name: 'پشتو', nameEn: 'Pashto Language', code: 'پشت۵', periodsPerWeek: 3, isCore: true },
    { name: 'انگلیسی', nameEn: 'English', code: 'انگ۵', periodsPerWeek: 2 },
    {
      name: 'ریاضی',
      nameEn: 'Mathematics',
      code: 'ریض۵',
      periodsPerWeek: 5,
      isDifficult: true,
      isCore: true,
    },
    {
      name: 'تعلیم و تربیه اسلامی',
      nameEn: 'Islamic Studies',
      code: 'اسل۵',
      periodsPerWeek: 4,
      isCore: true,
    },
    { name: 'قرآن‌کریم', nameEn: 'Holy Quran', code: 'قرآ۵', periodsPerWeek: 5, isCore: true },
    { name: 'ساینس', nameEn: 'Science', code: 'ساین۵', periodsPerWeek: 2 },
    { name: 'دروس اجتماعی', nameEn: 'Social Studies', code: 'اجت۵', periodsPerWeek: 2 },
    { name: 'رسم و خط', nameEn: 'Art & Calligraphy', code: 'رسم۵', periodsPerWeek: 2 },
    { name: 'تربیت بدنی', nameEn: 'Physical Education', code: 'ترب۵', periodsPerWeek: 1 },
    { name: 'حرفه', nameEn: 'Vocational Skills', code: 'حرف۵', periodsPerWeek: 2 },
  ],
  grade_6: [
    { name: 'دری', nameEn: 'Dari Language', code: 'دری۶', periodsPerWeek: 4, isCore: true },
    { name: 'پشتو', nameEn: 'Pashto Language', code: 'پشت۶', periodsPerWeek: 3, isCore: true },
    { name: 'انگلیسی', nameEn: 'English', code: 'انگ۶', periodsPerWeek: 2 },
    {
      name: 'ریاضی',
      nameEn: 'Mathematics',
      code: 'ریض۶',
      periodsPerWeek: 5,
      isDifficult: true,
      isCore: true,
    },
    {
      name: 'تعلیم و تربیه اسلامی',
      nameEn: 'Islamic Studies',
      code: 'اسل۶',
      periodsPerWeek: 4,
      isCore: true,
    },
    { name: 'قرآن‌کریم', nameEn: 'Holy Quran', code: 'قرآ۶', periodsPerWeek: 5, isCore: true },
    { name: 'ساینس', nameEn: 'Science', code: 'ساین۶', periodsPerWeek: 2 },
    { name: 'دروس اجتماعی', nameEn: 'Social Studies', code: 'اجت۶', periodsPerWeek: 2 },
    { name: 'رسم و خط', nameEn: 'Art & Calligraphy', code: 'رسم۶', periodsPerWeek: 2 },
    { name: 'تربیت بدنی', nameEn: 'Physical Education', code: 'ترب۶', periodsPerWeek: 1 },
    { name: 'حرفه', nameEn: 'Vocational Skills', code: 'حرف۶', periodsPerWeek: 2 },
  ],
  grade_7: [
    {
      name: 'ریاضی',
      nameEn: 'Mathematics',
      code: 'ریض۷',
      periodsPerWeek: 5,
      isDifficult: true,
      isCore: true,
    },
    { name: 'دری', nameEn: 'Dari Language', code: 'دری۷', periodsPerWeek: 3, isCore: true },
    { name: 'پشتو', nameEn: 'Pashto Language', code: 'پشت۷', periodsPerWeek: 3, isCore: true },
    { name: 'عربی', nameEn: 'Arabic Language', code: 'عرب۷', periodsPerWeek: 3 },
    { name: 'انگلیسی', nameEn: 'English', code: 'انگ۷', periodsPerWeek: 2 },
    {
      name: 'تعلیم و تربیه اسلامی',
      nameEn: 'Islamic Studies',
      code: 'اسل۷',
      periodsPerWeek: 3,
      isCore: true,
    },
    { name: 'قرآن‌کریم', nameEn: 'Holy Quran', code: 'قرآ۷', periodsPerWeek: 3, isCore: true },
    {
      name: 'فزیک',
      nameEn: 'Physics',
      code: 'فزی۷',
      periodsPerWeek: 3,
      isDifficult: true,
      requiredRoomType: 'lab',
    },
    {
      name: 'کیمیا',
      nameEn: 'Chemistry',
      code: 'کیم۷',
      periodsPerWeek: 3,
      isDifficult: true,
      requiredRoomType: 'lab',
    },
    {
      name: 'بیولوژی',
      nameEn: 'Biology',
      code: 'بیو۷',
      periodsPerWeek: 2,
      requiredRoomType: 'lab',
    },
    { name: 'تاریخ', nameEn: 'History', code: 'تار۷', periodsPerWeek: 2 },
    { name: 'جغرافیه', nameEn: 'Geography', code: 'جغر۷', periodsPerWeek: 2 },
    { name: 'تربیت بدنی', nameEn: 'Physical Education', code: 'ترب۷', periodsPerWeek: 1 },
    { name: 'حرفه', nameEn: 'Vocational Skills', code: 'حرف۷', periodsPerWeek: 1 },
  ],
  grade_8: [
    {
      name: 'ریاضی',
      nameEn: 'Mathematics',
      code: 'ریض۸',
      periodsPerWeek: 5,
      isDifficult: true,
      isCore: true,
    },
    { name: 'دری', nameEn: 'Dari Language', code: 'دری۸', periodsPerWeek: 3, isCore: true },
    { name: 'پشتو', nameEn: 'Pashto Language', code: 'پشت۸', periodsPerWeek: 3, isCore: true },
    { name: 'عربی', nameEn: 'Arabic Language', code: 'عرب۸', periodsPerWeek: 3 },
    { name: 'انگلیسی', nameEn: 'English', code: 'انگ۸', periodsPerWeek: 2 },
    {
      name: 'تعلیم و تربیه اسلامی',
      nameEn: 'Islamic Studies',
      code: 'اسل۸',
      periodsPerWeek: 3,
      isCore: true,
    },
    { name: 'قرآن‌کریم', nameEn: 'Holy Quran', code: 'قرآ۸', periodsPerWeek: 3, isCore: true },
    {
      name: 'فزیک',
      nameEn: 'Physics',
      code: 'فزی۸',
      periodsPerWeek: 3,
      isDifficult: true,
      requiredRoomType: 'lab',
    },
    {
      name: 'کیمیا',
      nameEn: 'Chemistry',
      code: 'کیم۸',
      periodsPerWeek: 3,
      isDifficult: true,
      requiredRoomType: 'lab',
    },
    {
      name: 'بیولوژی',
      nameEn: 'Biology',
      code: 'بیو۸',
      periodsPerWeek: 2,
      requiredRoomType: 'lab',
    },
    { name: 'تاریخ', nameEn: 'History', code: 'تار۸', periodsPerWeek: 2 },
    { name: 'جغرافیه', nameEn: 'Geography', code: 'جغر۸', periodsPerWeek: 2 },
    { name: 'تربیت بدنی', nameEn: 'Physical Education', code: 'ترب۸', periodsPerWeek: 1 },
    { name: 'حرفه', nameEn: 'Vocational Skills', code: 'حرف۸', periodsPerWeek: 1 },
  ],
  grade_9: [
    {
      name: 'ریاضی',
      nameEn: 'Mathematics',
      code: 'ریض۹',
      periodsPerWeek: 5,
      isDifficult: true,
      isCore: true,
    },
    { name: 'دری', nameEn: 'Dari Language', code: 'دری۹', periodsPerWeek: 3, isCore: true },
    { name: 'پشتو', nameEn: 'Pashto Language', code: 'پشت۹', periodsPerWeek: 3, isCore: true },
    { name: 'عربی', nameEn: 'Arabic Language', code: 'عرب۹', periodsPerWeek: 3 },
    { name: 'انگلیسی', nameEn: 'English', code: 'انگ۹', periodsPerWeek: 2 },
    {
      name: 'تعلیم و تربیه اسلامی',
      nameEn: 'Islamic Studies',
      code: 'اسل۹',
      periodsPerWeek: 3,
      isCore: true,
    },
    { name: 'قرآن‌کریم', nameEn: 'Holy Quran', code: 'قرآ۹', periodsPerWeek: 3, isCore: true },
    {
      name: 'فزیک',
      nameEn: 'Physics',
      code: 'فزی۹',
      periodsPerWeek: 3,
      isDifficult: true,
      requiredRoomType: 'lab',
    },
    {
      name: 'کیمیا',
      nameEn: 'Chemistry',
      code: 'کیم۹',
      periodsPerWeek: 3,
      isDifficult: true,
      requiredRoomType: 'lab',
    },
    {
      name: 'بیولوژی',
      nameEn: 'Biology',
      code: 'بیو۹',
      periodsPerWeek: 2,
      requiredRoomType: 'lab',
    },
    { name: 'تاریخ', nameEn: 'History', code: 'تار۹', periodsPerWeek: 2 },
    { name: 'جغرافیه', nameEn: 'Geography', code: 'جغر۹', periodsPerWeek: 2 },
    { name: 'تربیت بدنی', nameEn: 'Physical Education', code: 'ترب۹', periodsPerWeek: 1 },
    { name: 'حرفه', nameEn: 'Vocational Skills', code: 'حرف۹', periodsPerWeek: 1 },
  ],
  grade_10: [
    {
      name: 'ریاضی',
      nameEn: 'Mathematics',
      code: 'ریض۱۰',
      periodsPerWeek: 6,
      isDifficult: true,
      isCore: true,
    },
    {
      name: 'دری',
      nameEn: 'Dari Language',
      code: 'دری۱۰',
      periodsPerWeek: 3,
      isDifficult: true,
      isCore: true,
    },
    { name: 'پشتو', nameEn: 'Pashto Language', code: 'پشت۱۰', periodsPerWeek: 2, isCore: true },
    { name: 'انگلیسی', nameEn: 'English', code: 'انگ۱۰', periodsPerWeek: 2 },
    {
      name: 'تعلیم و تربیه اسلامی',
      nameEn: 'Islamic Studies',
      code: 'اسل۱۰',
      periodsPerWeek: 3,
      isCore: true,
    },
    { name: 'تفسیر', nameEn: 'Tafsir', code: 'تفس۱۰', periodsPerWeek: 3, isCore: true },
    {
      name: 'فزیک',
      nameEn: 'Physics',
      code: 'فزی۱۰',
      periodsPerWeek: 3,
      isDifficult: true,
      requiredRoomType: 'lab',
    },
    {
      name: 'کیمیا',
      nameEn: 'Chemistry',
      code: 'کیم۱۰',
      periodsPerWeek: 3,
      isDifficult: true,
      requiredRoomType: 'lab',
    },
    {
      name: 'بیولوژی',
      nameEn: 'Biology',
      code: 'بیو۱۰',
      periodsPerWeek: 2,
      requiredRoomType: 'lab',
    },
    {
      name: 'جیولوژی',
      nameEn: 'Geology',
      code: 'جیو۱۰',
      periodsPerWeek: 2,
      requiredRoomType: 'lab',
    },
    { name: 'تاریخ', nameEn: 'History', code: 'تار۱۰', periodsPerWeek: 2 },
    { name: 'جغرافیه', nameEn: 'Geography', code: 'جغر۱۰', periodsPerWeek: 2 },
    { name: 'تربیت بدنی', nameEn: 'Physical Education', code: 'ترب۱۰', periodsPerWeek: 1 },
    {
      name: 'کمپیوتر',
      nameEn: 'Computer',
      code: 'کمپ۱۰',
      periodsPerWeek: 2,
      requiredRoomType: 'computer_lab',
    },
  ],
  grade_11: [
    {
      name: 'ریاضی',
      nameEn: 'Mathematics',
      code: 'ریض۱۱',
      periodsPerWeek: 6,
      isDifficult: true,
      isCore: true,
    },
    {
      name: 'دری',
      nameEn: 'Dari Language',
      code: 'دری۱۱',
      periodsPerWeek: 3,
      isDifficult: true,
      isCore: true,
    },
    { name: 'پشتو', nameEn: 'Pashto Language', code: 'پشت۱۱', periodsPerWeek: 2, isCore: true },
    { name: 'انگلیسی', nameEn: 'English', code: 'انگ۱۱', periodsPerWeek: 2 },
    {
      name: 'تعلیم و تربیه اسلامی',
      nameEn: 'Islamic Studies',
      code: 'اسل۱۱',
      periodsPerWeek: 4,
      isCore: true,
    },
    { name: 'تفسیر', nameEn: 'Tafsir', code: 'تفس۱۱', periodsPerWeek: 3, isCore: true },
    {
      name: 'فزیک',
      nameEn: 'Physics',
      code: 'فزی۱۱',
      periodsPerWeek: 3,
      isDifficult: true,
      requiredRoomType: 'lab',
    },
    {
      name: 'کیمیا',
      nameEn: 'Chemistry',
      code: 'کیم۱۱',
      periodsPerWeek: 3,
      isDifficult: true,
      requiredRoomType: 'lab',
    },
    {
      name: 'بیولوژی',
      nameEn: 'Biology',
      code: 'بیو۱۱',
      periodsPerWeek: 3,
      requiredRoomType: 'lab',
    },
    { name: 'تاریخ', nameEn: 'History', code: 'تار۱۱', periodsPerWeek: 2 },
    { name: 'جغرافیه', nameEn: 'Geography', code: 'جغر۱۱', periodsPerWeek: 2 },
    { name: 'تربیت بدنی', nameEn: 'Physical Education', code: 'ترب۱۱', periodsPerWeek: 1 },
    {
      name: 'کمپیوتر',
      nameEn: 'Computer',
      code: 'کمپ۱۱',
      periodsPerWeek: 2,
      requiredRoomType: 'computer_lab',
    },
  ],
  grade_12: [
    {
      name: 'ریاضی',
      nameEn: 'Mathematics',
      code: 'ریض۱۲',
      periodsPerWeek: 6,
      isDifficult: true,
      isCore: true,
    },
    {
      name: 'دری',
      nameEn: 'Dari Language',
      code: 'دری۱۲',
      periodsPerWeek: 3,
      isDifficult: true,
      isCore: true,
    },
    { name: 'پشتو', nameEn: 'Pashto Language', code: 'پشت۱۲', periodsPerWeek: 2, isCore: true },
    { name: 'انگلیسی', nameEn: 'English', code: 'انگ۱۲', periodsPerWeek: 2 },
    {
      name: 'تعلیم و تربیه اسلامی',
      nameEn: 'Islamic Studies',
      code: 'اسل۱۲',
      periodsPerWeek: 4,
      isCore: true,
    },
    { name: 'تفسیر', nameEn: 'Tafsir', code: 'تفس۱۲', periodsPerWeek: 3, isCore: true },
    {
      name: 'فزیک',
      nameEn: 'Physics',
      code: 'فزی۱۲',
      periodsPerWeek: 3,
      isDifficult: true,
      requiredRoomType: 'lab',
    },
    {
      name: 'کیمیا',
      nameEn: 'Chemistry',
      code: 'کیم۱۲',
      periodsPerWeek: 3,
      isDifficult: true,
      requiredRoomType: 'lab',
    },
    {
      name: 'بیولوژی',
      nameEn: 'Biology',
      code: 'بیو۱۲',
      periodsPerWeek: 3,
      requiredRoomType: 'lab',
    },
    { name: 'تاریخ', nameEn: 'History', code: 'تار۱۲', periodsPerWeek: 2 },
    { name: 'جغرافیه', nameEn: 'Geography', code: 'جغر۱۲', periodsPerWeek: 2 },
    { name: 'تربیت بدنی', nameEn: 'Physical Education', code: 'ترب۱۲', periodsPerWeek: 1 },
    {
      name: 'کمپیوتر',
      nameEn: 'Computer',
      code: 'کمپ۱۲',
      periodsPerWeek: 2,
      requiredRoomType: 'computer_lab',
    },
  ],
};

// ==============================================================================
// Utility Functions
// ==============================================================================

/**
 * Get curriculum subjects for a specific grade
 */
export const getCurriculumForGrade = (grade: number): SubjectDefinition[] => {
  return MINISTRY_CURRICULUM[`grade_${grade}`] || [];
};

/**
 * Get available grades based on school settings
 */
export const getAvailableGrades = (settings: {
  enablePrimary: boolean;
  enableMiddle: boolean;
  enableHigh: boolean;
}): number[] => {
  const grades: number[] = [];
  if (settings.enablePrimary) grades.push(1, 2, 3, 4, 5, 6);
  if (settings.enableMiddle) grades.push(7, 8, 9);
  if (settings.enableHigh) grades.push(10, 11, 12);
  return grades;
};

/**
 * Get summary stats for a grade's curriculum
 */
export const getCurriculumStats = (grade: number) => {
  const subjects = getCurriculumForGrade(grade);
  const totalPeriods = subjects.reduce((sum, s) => sum + s.periodsPerWeek, 0);
  const coreCount = subjects.filter((s) => s.isCore).length;
  const labCount = subjects.filter((s) => s.requiredRoomType).length;
  return { subjectCount: subjects.length, totalPeriods, coreCount, labCount };
};
