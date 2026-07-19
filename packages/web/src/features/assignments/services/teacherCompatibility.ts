/**
 * Smart Teacher Compatibility Service
 *
 * Provides intelligent teacher-subject compatibility detection using:
 * 1. Explicit assignments (primarySubjectIds, allowedSubjectIds)
 * 2. Implicit compatibility (empty subjects = generalist, can teach all)
 * 3. Inferred compatibility (teaches related subjects in same domain)
 * 4. Available capacity (has free periods)
 *
 * Uses universal subject domain categorization that works across curricula.
 */

import type { ClassGroup, SubjectRequirement } from '../../classes/types';
import type { Subject } from '../../subjects/types';
import type { Teacher, UnavailableSlot } from '../../teachers/types';

// ============================================================================
// Types
// ============================================================================

/**
 * Extended compatibility levels for smart matching
 */
export type SmartCompatibilityLevel =
  | 'primary' // Explicitly in primarySubjectIds
  | 'allowed' // Explicitly in allowedSubjectIds
  | 'generalist' // Empty subjects = can teach anything
  | 'inferred' // Teaches related subjects in same domain
  | 'available'; // Has capacity but no subject match

/**
 * Subject domain categories (universal, works worldwide)
 */
export type SubjectDomain =
  | 'mathematics' // Math, Statistics, Algebra, Geometry
  | 'sciences' // Physics, Chemistry, Biology, Geology
  | 'languages' // Dari, Pashto, Arabic, English, etc.
  | 'religious' // Islamic Studies, Quran, Tafsir
  | 'social_studies' // History, Geography, Civics
  | 'arts' // Art, Music, Calligraphy
  | 'physical' // Physical Education, Sports
  | 'technology' // Computer, IT, Technical
  | 'vocational' // Vocational Skills, Crafts
  | 'general'; // Uncategorized

/**
 * Teacher compatibility result with rich info
 */
export interface SmartTeacherCompatibility {
  teacherId: number;
  teacherName: string;
  compatibility: SmartCompatibilityLevel;
  compatibilityScore: number; // 0-100, higher = better match
  currentWorkload: number;
  maxWorkload: number;
  availableCapacity: number;
  canAcceptAssignment: boolean;
  /** Assignment UI must promote every non-primary subject before persisting. */
  requiresPrimaryAuthorization: boolean;
  // Availability info
  unavailableCount: number; // Number of unavailable slots
  hasLimitedAvailability: boolean; // True if unavailable slots might cause scheduling issues
  // Rich info for display
  currentAssignments: TeacherAssignmentSummary[];
  relatedSubjectsTaught: string[]; // Subjects in same domain
  reasonFa: string; // Farsi explanation of compatibility
  reasonEn: string; // English explanation
}

/**
 * Summary of a teacher's current assignment
 */
export interface TeacherAssignmentSummary {
  subjectId: number;
  subjectName: string;
  classCount: number;
  totalPeriods: number;
}

// ============================================================================
// Subject Domain Detection (Universal)
// ============================================================================

/**
 * Keywords for detecting subject domains (multilingual)
 * Works with Dari/Farsi, English, and common variations
 */
const DOMAIN_KEYWORDS: Record<SubjectDomain, string[]> = {
  mathematics: [
    'ریاضی',
    'ریاضیات',
    'math',
    'mathematics',
    'algebra',
    'geometry',
    'calculus',
    'statistics',
    'آمار',
    'هندسه',
    'جبر',
  ],
  sciences: [
    'فزیک',
    'فیزیک',
    'physics',
    'کیمیا',
    'شیمی',
    'chemistry',
    'بیولوژی',
    'زیست',
    'biology',
    'ساینس',
    'science',
    'علوم',
    'جیولوژی',
    'زمین‌شناسی',
    'geology',
    'طبیعی',
  ],
  languages: [
    'دری',
    'dari',
    'پشتو',
    'pashto',
    'عربی',
    'arabic',
    'انگلیسی',
    'english',
    'زبان',
    'language',
    'ادبیات',
    'literature',
    'لغت',
    'گرامر',
    'grammar',
  ],
  religious: [
    'اسلامی',
    'islamic',
    'قرآن',
    'quran',
    'تفسیر',
    'tafsir',
    'دینی',
    'religious',
    'فقه',
    'تعلیم و تربیه اسلامی',
    'حدیث',
  ],
  social_studies: [
    'تاریخ',
    'history',
    'جغرافیه',
    'جغرافیا',
    'geography',
    'اجتماعی',
    'social',
    'مدنی',
    'civics',
    'دروس اجتماعی',
  ],
  arts: [
    'رسم',
    'art',
    'خط',
    'calligraphy',
    'نقاشی',
    'drawing',
    'موسیقی',
    'music',
    'هنر',
    'خوشنویسی',
  ],
  physical: ['تربیت بدنی', 'physical', 'ورزش', 'sport', 'بدنی', 'education'],
  technology: [
    'کمپیوتر',
    'computer',
    'تکنالوژی',
    'technology',
    'آی‌تی',
    'it',
    'برنامه‌نویسی',
    'programming',
    'فناوری',
  ],
  vocational: ['حرفه', 'vocational', 'فنی', 'technical', 'کار', 'craft', 'صنایع', 'مهارت'],
  general: [], // Fallback
};

/**
 * Related domains that share teaching skills
 * Teachers in one domain can often teach related domains
 */
const RELATED_DOMAINS: Record<SubjectDomain, SubjectDomain[]> = {
  mathematics: ['sciences', 'technology'],
  sciences: ['mathematics', 'technology'],
  languages: ['social_studies', 'arts'],
  religious: ['languages', 'social_studies'],
  social_studies: ['languages', 'religious'],
  arts: ['languages', 'vocational'],
  physical: ['vocational'],
  technology: ['mathematics', 'sciences', 'vocational'],
  vocational: ['arts', 'technology', 'physical'],
  general: [],
};

/**
 * Detect the domain of a subject based on its name
 */
export function detectSubjectDomain(subjectName: string): SubjectDomain {
  const nameLower = subjectName.toLowerCase();

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    for (const keyword of keywords) {
      if (nameLower.includes(keyword.toLowerCase())) {
        return domain as SubjectDomain;
      }
    }
  }

  return 'general';
}

/**
 * Get domain display name in Farsi
 */
export function getDomainNameFa(domain: SubjectDomain): string {
  const names: Record<SubjectDomain, string> = {
    mathematics: 'ریاضیات',
    sciences: 'علوم طبیعی',
    languages: 'زبان‌ها',
    religious: 'علوم دینی',
    social_studies: 'علوم اجتماعی',
    arts: 'هنر',
    physical: 'تربیت بدنی',
    technology: 'تکنالوژی',
    vocational: 'حرفه‌ای',
    general: 'عمومی',
  };
  return names[domain];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse JSON array safely
 */
function parseJsonArray<T>(value: string | T[] | null | undefined): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Check if teacher is a generalist (empty subject lists)
 */
function isGeneralistTeacher(teacher: Teacher): boolean {
  const primaryIds = parseJsonArray<number>(teacher.primarySubjectIds);
  const allowedIds = parseJsonArray<number>(teacher.allowedSubjectIds);
  return primaryIds.length === 0 && allowedIds.length === 0;
}

/**
 * Get all subject IDs a teacher is assigned to (from classAssignments)
 */
function getTeacherAssignedSubjectIds(teacher: Teacher): number[] {
  const assignments = parseJsonArray<{ subjectId: number; classIds: number[] }>(
    teacher.classAssignments
  );
  return [...new Set(assignments.map((a) => a.subjectId))];
}

/**
 * Calculate teacher's current workload from assignments
 */
function calculateWorkload(
  teacher: Teacher,
  subjects: Subject[],
  classes: ClassGroup[]
): { total: number; breakdown: TeacherAssignmentSummary[] } {
  const assignments = parseJsonArray<{ subjectId: number; classIds: number[] }>(
    teacher.classAssignments
  );

  const breakdown: TeacherAssignmentSummary[] = [];
  let total = 0;

  for (const assignment of assignments) {
    const subject = subjects.find((s) => s.id === assignment.subjectId);
    if (!subject) continue;

    let assignmentPeriods = 0;
    for (const classId of assignment.classIds) {
      const classGroup = classes.find((c) => c.id === classId);
      if (classGroup) {
        const requirements = parseJsonArray<SubjectRequirement>(classGroup.subjectRequirements);
        const req = requirements.find((r) => r.subjectId === assignment.subjectId);
        assignmentPeriods += req?.periodsPerWeek || subject.periodsPerWeek || 1;
      }
    }

    if (assignmentPeriods > 0) {
      breakdown.push({
        subjectId: assignment.subjectId,
        subjectName: subject.name,
        classCount: assignment.classIds.length,
        totalPeriods: assignmentPeriods,
      });
      total += assignmentPeriods;
    }
  }

  return { total, breakdown };
}

// ============================================================================
// Main Compatibility Functions
// ============================================================================

/**
 * Get smart compatibility level for a teacher-subject pair
 *
 * NOTE: This returns compatibility LEVEL for UI hints and solver preferences.
 * Primary/allowed subjects are NOT hard restrictions - any teacher can be
 * assigned to any subject by an admin.
 */
export function getSmartCompatibility(
  teacher: Teacher,
  targetSubjectId: number,
  subjects: Subject[]
): { level: SmartCompatibilityLevel; score: number; relatedSubjects: string[] } {
  const primaryIds = parseJsonArray<number>(teacher.primarySubjectIds);
  const allowedIds = parseJsonArray<number>(teacher.allowedSubjectIds);
  const assignedSubjectIds = getTeacherAssignedSubjectIds(teacher);

  // 1. Check explicit primary
  if (primaryIds.includes(targetSubjectId)) {
    return { level: 'primary', score: 100, relatedSubjects: [] };
  }

  // 2. Check explicit allowed
  if (allowedIds.includes(targetSubjectId)) {
    return { level: 'allowed', score: 90, relatedSubjects: [] };
  }

  // 3. Check if generalist (empty subjects = can teach all)
  if (isGeneralistTeacher(teacher)) {
    return { level: 'generalist', score: 80, relatedSubjects: [] };
  }

  // 4. Check inferred compatibility (same domain)
  const targetSubject = subjects.find((s) => s.id === targetSubjectId);
  if (targetSubject) {
    const targetDomain = detectSubjectDomain(targetSubject.name);
    const relatedDomains = RELATED_DOMAINS[targetDomain] || [];

    // Get subjects teacher is assigned to
    const teacherSubjects = subjects.filter(
      (s) =>
        assignedSubjectIds.includes(s.id) || primaryIds.includes(s.id) || allowedIds.includes(s.id)
    );

    // Check if teacher teaches in same or related domain
    const relatedSubjects: string[] = [];
    let bestScore = 0;

    for (const teacherSubject of teacherSubjects) {
      const teacherDomain = detectSubjectDomain(teacherSubject.name);

      // Same domain = strong inference
      if (teacherDomain === targetDomain) {
        relatedSubjects.push(teacherSubject.name);
        bestScore = Math.max(bestScore, 70);
      }
      // Related domain = weaker inference
      else if (relatedDomains.includes(teacherDomain)) {
        relatedSubjects.push(teacherSubject.name);
        bestScore = Math.max(bestScore, 50);
      }
    }

    if (bestScore > 0) {
      return { level: 'inferred', score: bestScore, relatedSubjects };
    }
  }

  // 5. Available (has capacity but no match)
  return { level: 'available', score: 20, relatedSubjects: [] };
}

/**
 * Get all teachers with smart compatibility info for a subject
 * Returns ALL teachers, sorted by compatibility
 */
export function getSmartCompatibleTeachers(
  teachers: Teacher[],
  targetSubjectId: number,
  subjects: Subject[],
  classes: ClassGroup[]
): SmartTeacherCompatibility[] {
  const targetSubject = subjects.find((s) => s.id === targetSubjectId);

  return teachers
    .filter((t) => !t.isDeleted)
    .map((teacher) => {
      const { level, score, relatedSubjects } = getSmartCompatibility(
        teacher,
        targetSubjectId,
        subjects
      );

      const workload = calculateWorkload(teacher, subjects, classes);
      const availableCapacity = teacher.maxPeriodsPerWeek - workload.total;
      const canAccept = availableCapacity > 0;

      // Calculate unavailable slots
      const unavailableSlots = parseJsonArray<UnavailableSlot>(teacher.unavailable);
      const unavailableCount = unavailableSlots.length;

      // Check if limited availability might cause scheduling issues
      // Warning if: unavailable slots > 20% of max workload OR workload approaches available time
      const hasLimitedAvailability =
        unavailableCount > 0 &&
        (unavailableCount >= teacher.maxPeriodsPerWeek * 0.2 ||
          workload.total + unavailableCount > teacher.maxPeriodsPerWeek);

      // Generate explanation
      const { reasonFa, reasonEn } = getCompatibilityReason(
        level,
        relatedSubjects,
        targetSubject?.name || ''
      );

      return {
        teacherId: teacher.id,
        teacherName: teacher.fullName,
        compatibility: level,
        compatibilityScore: canAccept ? score : score - 50, // Penalize if no capacity
        currentWorkload: workload.total,
        maxWorkload: teacher.maxPeriodsPerWeek,
        availableCapacity: Math.max(0, availableCapacity),
        canAcceptAssignment: canAccept,
        requiresPrimaryAuthorization: level !== 'primary',
        unavailableCount,
        hasLimitedAvailability,
        currentAssignments: workload.breakdown,
        relatedSubjectsTaught: relatedSubjects,
        reasonFa,
        reasonEn,
      };
    })
    .sort((a, b) => {
      // Sort by: can accept > compatibility score > available capacity
      if (a.canAcceptAssignment !== b.canAcceptAssignment) {
        return a.canAcceptAssignment ? -1 : 1;
      }
      if (a.compatibilityScore !== b.compatibilityScore) {
        return b.compatibilityScore - a.compatibilityScore;
      }
      return b.availableCapacity - a.availableCapacity;
    });
}

/**
 * Generate human-readable compatibility reason
 */
export function getCompatibilityReason(
  level: SmartCompatibilityLevel,
  relatedSubjects: string[],
  _targetSubjectName: string
): { reasonFa: string; reasonEn: string } {
  switch (level) {
    case 'primary':
      return {
        reasonFa: `مضمون اصلی معلم`,
        reasonEn: `Teacher's primary subject`,
      };
    case 'allowed':
      return {
        reasonFa: `مضمون مجاز معلم`,
        reasonEn: `Teacher's allowed subject`,
      };
    case 'generalist':
      return {
        reasonFa: `مضمون اصلی ثبت نشده؛ هنگام تخصیص به مضامین اصلی افزوده می‌شود`,
        reasonEn: `No primary subject is registered; assignment requires primary authorization`,
      };
    case 'inferred': {
      const relatedList = relatedSubjects.slice(0, 2).join('، ');
      return {
        reasonFa: `تدریس مضامین مرتبط: ${relatedList}`,
        reasonEn: `Teaches related: ${relatedSubjects.slice(0, 2).join(', ')}`,
      };
    }
    case 'available':
      return {
        reasonFa: `تطابق ثبت‌شده با این مضمون ندارد؛ ظرفیت آزاد دارد`,
        reasonEn: `No registered subject match; has available capacity`,
      };
  }
}

/**
 * Get compatibility badge info for display
 */
export function getCompatibilityBadgeInfo(level: SmartCompatibilityLevel): {
  labelFa: string;
  labelEn: string;
  color: string;
  bgColor: string;
  borderColor: string;
} {
  switch (level) {
    case 'primary':
      return {
        labelFa: 'اصلی',
        labelEn: 'Primary',
        color: 'text-violet-700',
        bgColor: 'bg-violet-50',
        borderColor: 'border-violet-200',
      };
    case 'allowed':
      return {
        labelFa: 'مجاز',
        labelEn: 'Allowed',
        color: 'text-blue-700',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
      };
    case 'generalist':
      return {
        labelFa: 'ثبت‌نشده',
        labelEn: 'Not configured',
        color: 'text-amber-700',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
      };
    case 'inferred':
      return {
        labelFa: 'پیشنهادی',
        labelEn: 'Suggested',
        color: 'text-amber-700',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
      };
    case 'available':
      return {
        labelFa: 'بدون تطابق',
        labelEn: 'No subject match',
        color: 'text-amber-700',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
      };
  }
}

/**
 * Group teachers by compatibility level for organized display
 */
export function groupTeachersByCompatibility(
  teachers: SmartTeacherCompatibility[]
): Record<SmartCompatibilityLevel, SmartTeacherCompatibility[]> {
  const groups: Record<SmartCompatibilityLevel, SmartTeacherCompatibility[]> = {
    primary: [],
    allowed: [],
    generalist: [],
    inferred: [],
    available: [],
  };

  for (const teacher of teachers) {
    groups[teacher.compatibility].push(teacher);
  }

  return groups;
}

export default {
  detectSubjectDomain,
  getDomainNameFa,
  getSmartCompatibility,
  getSmartCompatibleTeachers,
  getCompatibilityBadgeInfo,
  groupTeachersByCompatibility,
};
