/**
 * Subject Presets Utility
 * Provides quick presets for common teacher subject combinations
 */

export interface SubjectPreset {
  id: string;
  name: string;
  description: string;
  subjectIds: string[];
  isCustom: boolean;
  icon?: string;
}

/**
 * Auto-detect presets based on subject names
 * This analyzes available subjects and suggests appropriate presets
 */
export function generateAutoPresets(
  subjects: Array<{ id: string; name: string; code?: string }>
): SubjectPreset[] {
  const presets: SubjectPreset[] = [];
  
  // Helper to find subjects by keyword
  const findSubjectsByKeyword = (keywords: string[]): string[] => {
    return subjects
      .filter(subject => 
        keywords.some(keyword => 
          subject.name.toLowerCase().includes(keyword.toLowerCase()) ||
          subject.code?.toLowerCase().includes(keyword.toLowerCase())
        )
      )
      .map(s => s.id);
  };
  
  // Science Teacher Preset
  const scienceSubjects = findSubjectsByKeyword(['physics', 'chemistry', 'biology', 'science', 'فزیک', 'فیزیک', 'کیمیا', 'بیالوژی', 'علوم']);
  if (scienceSubjects.length > 0) {
    presets.push({
      id: 'auto-science',
      name: 'Science Teacher',
      description: 'Physics, Chemistry, Biology, and other sciences',
      subjectIds: scienceSubjects,
      isCustom: false,
      icon: '🔬',
    });
  }
  
  // Language Teacher Preset
  const languageSubjects = findSubjectsByKeyword(['english', 'arabic', 'pashto', 'dari', 'language', 'انگلیسی', 'انګلیسي', 'عربی', 'پشتو', 'دری']);
  if (languageSubjects.length > 0) {
    presets.push({
      id: 'auto-language',
      name: 'Language Teacher',
      description: 'English, Arabic, Pashto, Dari',
      subjectIds: languageSubjects,
      isCustom: false,
      icon: '🗣️',
    });
  }
  
  // Math Teacher Preset
  const mathSubjects = findSubjectsByKeyword(['math', 'algebra', 'geometry', 'calculus', 'ریاضی']);
  if (mathSubjects.length > 0) {
    presets.push({
      id: 'auto-math',
      name: 'Mathematics Teacher',
      description: 'All mathematics subjects',
      subjectIds: mathSubjects,
      isCustom: false,
      icon: '🔢',
    });
  }
  
  // Religious Studies Teacher Preset
  const religiousSubjects = findSubjectsByKeyword(['religious', 'islamic', 'quran', 'دینی', 'تجوید']);
  if (religiousSubjects.length > 0) {
    presets.push({
      id: 'auto-religious',
      name: 'Religious Studies Teacher',
      description: 'Islamic studies, Quran, Tajweed',
      subjectIds: religiousSubjects,
      isCustom: false,
      icon: '📿',
    });
  }
  
  // Social Studies Teacher Preset
  const socialSubjects = findSubjectsByKeyword(['history', 'geography', 'civics', 'social', 'تاریخ', 'جغرافیه', 'مدنی', 'وطندوستی']);
  if (socialSubjects.length > 0) {
    presets.push({
      id: 'auto-social',
      name: 'Social Studies Teacher',
      description: 'History, Geography, Civics',
      subjectIds: socialSubjects,
      isCustom: false,
      icon: '🌍',
    });
  }
  
  // Arts Teacher Preset
  const artsSubjects = findSubjectsByKeyword(['art', 'music', 'physical', 'drawing', 'هنر', 'رسامی']);
  if (artsSubjects.length > 0) {
    presets.push({
      id: 'auto-arts',
      name: 'Arts Teacher',
      description: 'Art, Music, Physical Education',
      subjectIds: artsSubjects,
      isCustom: false,
      icon: '🎨',
    });
  }
  
  return presets;
}

/**
 * Load custom presets from localStorage
 */
export function loadCustomPresets(): SubjectPreset[] {
  try {
    const saved = localStorage.getItem('subjectPresets');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

/**
 * Save custom presets to localStorage
 */
export function saveCustomPresets(presets: SubjectPreset[]): void {
  try {
    localStorage.setItem('subjectPresets', JSON.stringify(presets));
  } catch (error) {
    console.error('Failed to save presets:', error);
  }
}

/**
 * Add a custom preset
 */
export function addCustomPreset(
  name: string,
  description: string,
  subjectIds: string[]
): SubjectPreset {
  const preset: SubjectPreset = {
    id: `custom-${Date.now()}`,
    name,
    description,
    subjectIds,
    isCustom: true,
  };
  
  const existingPresets = loadCustomPresets();
  const updatedPresets = [...existingPresets, preset];
  saveCustomPresets(updatedPresets);
  
  return preset;
}

/**
 * Delete a custom preset
 */
export function deleteCustomPreset(presetId: string): void {
  const existingPresets = loadCustomPresets();
  const updatedPresets = existingPresets.filter(p => p.id !== presetId);
  saveCustomPresets(updatedPresets);
}

/**
 * Get all presets (auto + custom)
 */
export function getAllPresets(
  subjects: Array<{ id: string; name: string; code?: string }>
): SubjectPreset[] {
  const autoPresets = generateAutoPresets(subjects);
  const customPresets = loadCustomPresets();
  
  return [...autoPresets, ...customPresets];
}

