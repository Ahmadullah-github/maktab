/**
 * Subject Categorization Utility
 * Auto-detects subject categories based on name patterns
 */

export interface SubjectCategory {
  id: string;
  name: string;
  icon: string;
  keywords: string[];
}

export const defaultCategories: SubjectCategory[] = [
  {
    id: 'mathematics',
    name: 'Mathematics',
    icon: '🔢',
    keywords: ['math', 'ریاضی', 'algebra', 'geometry', 'calculus', 'رياضيات'],
  },
  {
    id: 'sciences',
    name: 'Sciences',
    icon: '🔬',
    keywords: ['science', 'physics', 'chemistry', 'biology', 'علوم', 'فزیک', 'فیزیک', 'کیمیا', 'بیالوژی', 'بيولوجي', 'فيزياء', 'كيمياء'],
  },
  {
    id: 'languages',
    name: 'Languages',
    icon: '🗣️',
    keywords: ['language', 'english', 'arabic', 'pashto', 'dari', 'انگلیسی', 'انګلیسي', 'عربی', 'پشتو', 'دری', 'لغة', 'عربي'],
  },
  {
    id: 'religious',
    name: 'Religious Studies',
    icon: '📿',
    keywords: ['religious', 'islamic', 'quran', 'دینی', 'دين', 'قرآن', 'تجوید', 'تجويد'],
  },
  {
    id: 'social',
    name: 'Social Studies',
    icon: '🌍',
    keywords: ['history', 'geography', 'civics', 'social', 'تاریخ', 'جغرافیه', 'جغرافيه', 'مدنی', 'وطندوستی', 'تاريخ'],
  },
  {
    id: 'arts',
    name: 'Arts & Physical',
    icon: '🎨',
    keywords: ['art', 'music', 'physical', 'sport', 'drawing', 'هنر', 'رسامی', 'رسم', 'حرفه', 'فن'],
  },
  {
    id: 'technical',
    name: 'Technical & Vocational',
    icon: '⚙️',
    keywords: ['computer', 'technical', 'vocational', 'technology', 'کمپیوتر', 'حرفه', 'تقني'],
  },
  {
    id: 'other',
    name: 'Other',
    icon: '📚',
    keywords: [],
  },
];

/**
 * Categorize a subject based on its name
 */
export function categorizeSubject(subjectName: string): string {
  const nameLower = subjectName.toLowerCase();
  
  for (const category of defaultCategories) {
    if (category.id === 'other') continue; // Skip 'other' for now
    
    for (const keyword of category.keywords) {
      if (nameLower.includes(keyword.toLowerCase())) {
        return category.id;
      }
    }
  }
  
  return 'other'; // Default to 'other' if no match
}

/**
 * Group subjects by category
 */
export function groupSubjectsByCategory(
  subjects: Array<{ id: string; name: string; code?: string }>
): Record<string, Array<{ id: string; name: string; code?: string }>> {
  const groups: Record<string, Array<{ id: string; name: string; code?: string }>> = {};
  
  // Initialize all categories
  defaultCategories.forEach(cat => {
    groups[cat.id] = [];
  });
  
  // Group subjects
  subjects.forEach(subject => {
    const categoryId = categorizeSubject(subject.name);
    groups[categoryId].push(subject);
  });
  
  // Remove empty categories
  Object.keys(groups).forEach(categoryId => {
    if (groups[categoryId].length === 0) {
      delete groups[categoryId];
    }
  });
  
  return groups;
}

/**
 * Get category info by ID
 */
export function getCategoryInfo(categoryId: string): SubjectCategory | undefined {
  return defaultCategories.find(cat => cat.id === categoryId);
}

