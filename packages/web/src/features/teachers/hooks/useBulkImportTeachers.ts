/**
 * useBulkImportTeachers Hook
 *
 * Provides bulk import functionality for teachers including:
 * - Validation of teacher data
 * - Persian/Dari name validation
 * - Duplicate detection
 * - Excel parsing utilities
 * - Bulk create mutation
 */

import { api } from '@/lib/api';
import { invalidateTeacherCaches } from '@/lib/queryKeys';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Teacher, UnavailableSlot } from '../types';
import { useSchoolConfig, calculateMaxPeriodsPerWeek, getMaxPeriodsPerDay } from '@/features/school-settings/hooks/useSchoolSettings';
import { useSubjects } from '@/features/subjects/hooks/useSubjects';

/**
 * Raw teacher data from import (before validation)
 */
export interface RawTeacherImport {
  fullName: string;
  staffCode?: string;
  primarySubjects?: string; // Comma-separated subject names
  maxPeriodsPerWeek?: number;
  timePreference?: 'morning' | 'afternoon' | 'any';
  employmentType?: 'full_time' | 'part_time';
}

/**
 * Validated teacher ready for import
 */
export interface ValidatedTeacher {
  fullName: string;
  staffCode: string;
  employmentType: 'full_time' | 'part_time';
  primarySubjectIds: number[];
  allowedSubjectIds: number[];
  restrictToPrimarySubjects: boolean;
  unavailable: UnavailableSlot[];
  maxPeriodsPerWeek: number;
  maxPeriodsPerDay: number;
  maxConsecutivePeriods: number;
  timePreference: 'morning' | 'afternoon' | 'any';
  preferredRoomIds: number[];
  preferredColleagues: number[];
}

/**
 * Validation error for a single row
 */
export interface ImportValidationError {
  row: number;
  field: string;
  value: string;
  message: string;
  suggestion?: string;
}

/**
 * Import validation result
 */
export interface ImportValidationResult {
  valid: ValidatedTeacher[];
  errors: ImportValidationError[];
  duplicates: string[];
  totalRows: number;
}

/**
 * Persian/Dari character range regex
 * Includes: Arabic, Persian, Dari characters and spaces
 */
const PERSIAN_NAME_REGEX = /^[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF\s\u200C]+$/;

/**
 * Validates a Persian/Dari name
 */
export function validatePersianName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'نام خالی است' };
  }

  const trimmed = name.trim();

  if (trimmed.length < 2) {
    return { valid: false, error: 'نام باید حداقل ۲ حرف باشد' };
  }

  if (trimmed.length > 255) {
    return { valid: false, error: 'نام نباید بیشتر از ۲۵۵ حرف باشد' };
  }

  // Check for numbers
  if (/\d/.test(trimmed)) {
    return { valid: false, error: 'نام نباید شامل عدد باشد' };
  }

  // Allow Persian/Arabic OR Latin characters (for mixed names)
  const hasValidChars = PERSIAN_NAME_REGEX.test(trimmed) || /^[a-zA-Z\s]+$/.test(trimmed);
  if (!hasValidChars) {
    return { valid: false, error: 'نام شامل کاراکترهای غیرمجاز است' };
  }

  return { valid: true };
}

/**
 * Normalizes a name (trim, normalize unicode, collapse spaces)
 */
export function normalizeName(name: string): string {
  return name.trim().normalize('NFKC').replace(/\s+/g, ' ');
}

/**
 * Default values for new teachers
 */
const DEFAULT_TEACHER_VALUES = {
  primarySubjectIds: [] as number[],
  allowedSubjectIds: [] as number[],
  restrictToPrimarySubjects: true,
  unavailable: [] as UnavailableSlot[],
  maxPeriodsPerWeek: 35,
  maxPeriodsPerDay: 7,
  maxConsecutivePeriods: 2,
  timePreference: 'any' as const,
  employmentType: 'full_time' as const,
  preferredRoomIds: [] as number[],
  preferredColleagues: [] as number[],
};

interface ImportLimits {
  maxPeriodsPerWeek: number;
  maxPeriodsPerDay: number;
}

function normalizeStaffCode(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, '-').toUpperCase();
}

function generatedStaffCode(existing: Set<string>, rowIndex: number): string {
  let sequence = rowIndex + 1;
  while (existing.has(`T-${String(sequence).padStart(5, '0')}`)) sequence += 1;
  return `T-${String(sequence).padStart(5, '0')}`;
}

/**
 * Parse Excel file and extract teacher data
 */
export function parseExcelFile(file: File): Promise<RawTeacherImport[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      void (async () => {
        try {
          const XLSX = await import('xlsx');
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });

        // Get first sheet
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          reject(new Error('فایل اکسل خالی است'));
          return;
        }

        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: '',
        });

        if (jsonData.length === 0) {
          reject(new Error('هیچ داده‌ای در فایل یافت نشد'));
          return;
        }

        // Map Excel columns to our format
        // Support both Persian and English column names
        const teachers: RawTeacherImport[] = jsonData.map((row) => ({
          fullName: String(row['نام کامل'] || row['fullName'] || row['name'] || row['نام'] || ''),
          staffCode: String(row['کد کارمند'] || row['staffCode'] || row['code'] || ''),
          primarySubjects: String(
            row['مضامین اصلی'] || row['primarySubjects'] || row['subjects'] || row['مضامین'] || ''
          ),
          maxPeriodsPerWeek: Number(
            row['حداکثر ساعت هفته'] || row['maxPeriodsPerWeek'] || row['ساعت'] || 35
          ),
          timePreference: parseTimePreference(
            String(row['ترجیح زمانی'] || row['timePreference'] || row['زمان'] || 'any')
          ),
        }));

          resolve(teachers);
        } catch {
          reject(new Error('خطا در خواندن فایل اکسل'));
        }
      })();
    };

    reader.onerror = () => {
      reject(new Error('خطا در بارگذاری فایل'));
    };

    reader.readAsBinaryString(file);
  });
}

/**
 * Parse time preference from various formats
 */
function parseTimePreference(value: string): 'morning' | 'afternoon' | 'any' {
  const normalized = value.toLowerCase().trim();
  if (normalized === 'morning' || normalized === 'صبح') return 'morning';
  if (normalized === 'afternoon' || normalized === 'بعدازظهر' || normalized === 'عصر')
    return 'afternoon';
  return 'any';
}

/**
 * Parse names from pasted text (one name per line)
 */
export function parseNamesFromText(text: string): string[] {
  return text
    .split(/[\n\r]+/)
    .map((line) => normalizeName(line))
    .filter((name) => name.length > 0);
}

/**
 * Validate imported teachers against existing teachers
 */
export function validateImportedTeachers(
  rawTeachers: RawTeacherImport[],
  existingTeachers: Teacher[],
  subjectMap: Map<string, number | null> = new Map(),
  limits: ImportLimits = { maxPeriodsPerWeek: 35, maxPeriodsPerDay: 7 }
): ImportValidationResult {
  const errors: ImportValidationError[] = [];
  const valid: ValidatedTeacher[] = [];
  const duplicates: string[] = [];
  const existingCodes = new Set(existingTeachers.map((teacher) => normalizeStaffCode(teacher.staffCode)));
  const usedCodes = new Set(existingCodes);

  rawTeachers.forEach((raw, index) => {
    const rowNum = index + 2; // Excel rows start at 1, plus header row
    const normalizedName = normalizeName(raw.fullName);
    const staffCode = normalizeStaffCode(raw.staffCode || generatedStaffCode(usedCodes, index));

    // Validate name
    const nameValidation = validatePersianName(normalizedName);
    if (!nameValidation.valid) {
      errors.push({
        row: rowNum,
        field: 'fullName',
        value: raw.fullName,
        message: nameValidation.error || 'نام نامعتبر است',
        suggestion: 'نام را بررسی و اصلاح کنید',
      });
      return;
    }

    if (usedCodes.has(staffCode)) {
      errors.push({
        row: rowNum,
        field: 'staffCode',
        value: staffCode,
        message: 'کد کارمند تکراری است',
        suggestion: 'یک کد یکتای دیگر وارد کنید',
      });
      duplicates.push(staffCode);
      return;
    }
    usedCodes.add(staffCode);

    // Parse subject IDs if subject map provided
    const primarySubjectIds: number[] = [];
    if (raw.primarySubjects) {
      const subjectNames = raw.primarySubjects.split(/[،,]/).map((s) => s.trim());
      for (const name of subjectNames) {
        const mapped = subjectMap.get(name.normalize('NFKC').toLowerCase());
        if (mapped === undefined || mapped === null) {
          errors.push({
            row: rowNum,
            field: 'primarySubjects',
            value: name,
            message: mapped === null ? 'نام یا کد مضمون مبهم است' : 'مضمون یافت نشد',
            suggestion: 'نام یا کد دقیق یک مضمون فعال را وارد کنید',
          });
        } else {
          primarySubjectIds.push(mapped);
        }
      }
      if (errors.some((error) => error.row === rowNum && error.field === 'primarySubjects')) return;
    }

    // Validate maxPeriodsPerWeek
    let maxPeriodsPerWeek = raw.maxPeriodsPerWeek ?? limits.maxPeriodsPerWeek;
    if (maxPeriodsPerWeek < 0 || maxPeriodsPerWeek > limits.maxPeriodsPerWeek) {
      errors.push({
        row: rowNum,
        field: 'maxPeriodsPerWeek',
        value: String(raw.maxPeriodsPerWeek),
        message: `ساعت هفتگی باید بین ۰ تا ${limits.maxPeriodsPerWeek} باشد`,
        suggestion: `مقدار پیش‌فرض ${limits.maxPeriodsPerWeek} استفاده می‌شود`,
      });
      maxPeriodsPerWeek = limits.maxPeriodsPerWeek;
    }

    // Create validated teacher
    valid.push({
      fullName: normalizedName,
      staffCode,
      employmentType: raw.employmentType ?? DEFAULT_TEACHER_VALUES.employmentType,
      primarySubjectIds,
      allowedSubjectIds: [],
      restrictToPrimarySubjects: true,
      unavailable: [],
      maxPeriodsPerWeek,
      maxPeriodsPerDay: limits.maxPeriodsPerDay,
      maxConsecutivePeriods: DEFAULT_TEACHER_VALUES.maxConsecutivePeriods,
      timePreference: raw.timePreference || 'any',
      preferredRoomIds: [],
      preferredColleagues: [],
    });
  });

  return {
    valid,
    errors,
    duplicates,
    totalRows: rawTeachers.length,
  };
}

/**
 * Generate Excel template for teacher import
 * Creates a basic template - can be replaced with a pre-designed file later
 */
export async function generateExcelTemplate(): Promise<void> {
  const XLSX = await import('xlsx');
  // Header row
  const headers = ['نام کامل *', 'کد کارمند *', 'مضامین اصلی', 'حداکثر ساعت هفته', 'ترجیح زمانی'];

  // Empty rows for data entry
  const emptyRows = Array(20).fill(['', '', '', '', '']);

  // Combine all data
  const allData = [headers, ...emptyRows];

  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(allData);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 25 }, // نام کامل
    { wch: 18 }, // کد کارمند
    { wch: 30 }, // مضامین اصلی
    { wch: 20 }, // حداکثر ساعت هفته
    { wch: 20 }, // ترجیح زمانی
  ];

  // Set row heights (basic - xlsx has limited styling)
  worksheet['!rows'] = [
    { hpt: 25 }, // Header row
  ];

  // Create workbook
  const workbook = XLSX.utils.book_new();

  // Add main data sheet
  XLSX.utils.book_append_sheet(workbook, worksheet, 'معلمین');

  // Create instructions sheet
  const instructionsData = [
    ['راهنمای پر کردن فایل'],
    [''],
    ['ستون‌ها:'],
    ['۱. نام کامل: نام و نام خانوادگی معلم (اجباری)'],
    ['۲. کد کارمند: کد یکتای معلم (اجباری)'],
    ['۳. مضامین اصلی: نام یا کد مضمون، با کاما جدا شود'],
    ['۴. حداکثر ساعت هفته: از تنظیمات مکتب اعتبارسنجی می‌شود'],
    ['۵. ترجیح زمانی: صبح، بعدازظهر، یا هر زمان'],
    [''],
    ['نکات مهم:'],
    ['نمونه: احمد احمدی | T-00001 | ریاضی، فیزیک | ۳۰ | صبح'],
    ['• نام کامل و کد کارمند اجباری هستند'],
    ['• سایر تنظیمات را می‌توانید بعداً در برنامه ویرایش کنید'],
  ];

  const instructionsSheet = XLSX.utils.aoa_to_sheet(instructionsData);
  instructionsSheet['!cols'] = [{ wch: 60 }];
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'راهنما');

  // Download file
  XLSX.writeFile(workbook, 'قالب_وارد_کردن_معلمین.xlsx');
}

/**
 * Hook for bulk importing teachers
 */
export function useBulkImportTeachers() {
  const queryClient = useQueryClient();
  const [validationResult, setValidationResult] = useState<ImportValidationResult | null>(null);
  const { data: schoolConfig } = useSchoolConfig();
  const { data: subjects = [] } = useSubjects();
  const limits = useMemo(
    () => ({
      maxPeriodsPerWeek: schoolConfig ? calculateMaxPeriodsPerWeek(schoolConfig) : 35,
      maxPeriodsPerDay: schoolConfig ? getMaxPeriodsPerDay(schoolConfig) : 7,
    }),
    [schoolConfig]
  );
  const subjectMap = useMemo(() => {
    const result = new Map<string, number | null>();
    for (const subject of subjects.filter((item) => !item.isDeleted)) {
      for (const key of [subject.name, subject.code].filter(
        (value): value is string => Boolean(value)
      )) {
        const normalized = key.normalize('NFKC').trim().toLowerCase();
        result.set(normalized, result.has(normalized) ? null : subject.id);
      }
    }
    return result;
  }, [subjects]);

  // Bulk create mutation
  const bulkCreateMutation = useMutation({
    mutationFn: async (teachers: ValidatedTeacher[]) => {
      // Convert to API format (JSON strings for arrays)
      const apiTeachers = teachers.map((t) => ({
        fullName: t.fullName,
        staffCode: t.staffCode,
        employmentType: t.employmentType,
        primarySubjectIds: t.primarySubjectIds,
        allowedSubjectIds: t.allowedSubjectIds,
        restrictToPrimarySubjects: t.restrictToPrimarySubjects,
        unavailable: t.unavailable,
        maxPeriodsPerWeek: t.maxPeriodsPerWeek,
        maxPeriodsPerDay: t.maxPeriodsPerDay,
        maxConsecutivePeriods: t.maxConsecutivePeriods,
        timePreference: t.timePreference,
        preferredRoomIds: t.preferredRoomIds,
        preferredColleagues: t.preferredColleagues,
      }));

      return api.teachers.bulkCreate(apiTeachers);
    },
    onSuccess: () => {
      invalidateTeacherCaches(queryClient);
      setValidationResult(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Validate from Excel file
  const validateFromExcel = useCallback(
    async (file: File, existingTeachers: Teacher[]) => {
      const rawTeachers = await parseExcelFile(file);
      const result = validateImportedTeachers(rawTeachers, existingTeachers, subjectMap, limits);
      setValidationResult(result);
      return result;
    },
    [subjectMap, limits]
  );

  // Validate from pasted text
  const validateFromText = useCallback((text: string, existingTeachers: Teacher[]) => {
    const names = parseNamesFromText(text);
    const rawTeachers: RawTeacherImport[] = names.map((name) => ({ fullName: name }));
    const result = validateImportedTeachers(rawTeachers, existingTeachers, subjectMap, limits);
    setValidationResult(result);
    return result;
  }, [subjectMap, limits]);

  // Validate from quick add list
  const validateFromList = useCallback((names: string[], existingTeachers: Teacher[]) => {
    const rawTeachers: RawTeacherImport[] = names.map((name) => ({ fullName: name }));
    const result = validateImportedTeachers(rawTeachers, existingTeachers, subjectMap, limits);
    setValidationResult(result);
    return result;
  }, [subjectMap, limits]);

  // Import validated teachers
  const importTeachers = useCallback(
    async (teachers?: ValidatedTeacher[]) => {
      const toImport = teachers || validationResult?.valid || [];
      if (toImport.length === 0) {
        throw new Error('هیچ معلمی برای وارد کردن وجود ندارد');
      }
      return bulkCreateMutation.mutateAsync(toImport);
    },
    [validationResult, bulkCreateMutation]
  );

  // Clear validation result
  const clearValidation = useCallback(() => {
    setValidationResult(null);
  }, []);

  return {
    // State
    validationResult,
    isImporting: bulkCreateMutation.isPending,
    importError: bulkCreateMutation.error,
    isSuccess: bulkCreateMutation.isSuccess,

    // Actions
    validateFromExcel,
    validateFromText,
    validateFromList,
    importTeachers,
    clearValidation,
    generateTemplate: generateExcelTemplate,

    // Utilities
    validatePersianName,
    normalizeName,
    parseNamesFromText,
  };
}

export default useBulkImportTeachers;
