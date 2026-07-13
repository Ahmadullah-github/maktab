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
import { useCallback, useState } from 'react';
import * as XLSX from 'xlsx';
import type { Teacher, UnavailableSlot } from '../types';

/**
 * Raw teacher data from import (before validation)
 */
export interface RawTeacherImport {
  fullName: string;
  primarySubjects?: string; // Comma-separated subject names
  maxPeriodsPerWeek?: number;
  timePreference?: 'morning' | 'afternoon' | 'any';
}

/**
 * Validated teacher ready for import
 */
export interface ValidatedTeacher {
  fullName: string;
  primarySubjectIds: number[];
  allowedSubjectIds: number[];
  restrictToPrimarySubjects: boolean;
  unavailable: UnavailableSlot[];
  maxPeriodsPerWeek: number;
  maxPeriodsPerDay: number;
  maxConsecutivePeriods: number;
  timePreference: 'morning' | 'afternoon' | 'any';
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

  if (trimmed.length > 100) {
    return { valid: false, error: 'نام نباید بیشتر از ۱۰۰ حرف باشد' };
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
  return name.trim().normalize('NFC').replace(/\s+/g, ' ');
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
};

/**
 * Parse Excel file and extract teacher data
 */
export function parseExcelFile(file: File): Promise<RawTeacherImport[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
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
  subjectMap?: Map<string, number>
): ImportValidationResult {
  const errors: ImportValidationError[] = [];
  const valid: ValidatedTeacher[] = [];
  const duplicates: string[] = [];
  const seenNames = new Set<string>();
  const existingNames = new Set(
    existingTeachers.map((t) => normalizeName(t.fullName).toLowerCase())
  );

  rawTeachers.forEach((raw, index) => {
    const rowNum = index + 2; // Excel rows start at 1, plus header row
    const normalizedName = normalizeName(raw.fullName);

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

    // Check for duplicates in import
    const lowerName = normalizedName.toLowerCase();
    if (seenNames.has(lowerName)) {
      errors.push({
        row: rowNum,
        field: 'fullName',
        value: normalizedName,
        message: 'این نام در لیست تکراری است',
        suggestion: 'نام تکراری را حذف کنید',
      });
      duplicates.push(normalizedName);
      return;
    }
    seenNames.add(lowerName);

    // Check for existing teachers
    if (existingNames.has(lowerName)) {
      errors.push({
        row: rowNum,
        field: 'fullName',
        value: normalizedName,
        message: 'این معلم قبلاً ثبت شده است',
        suggestion: 'از ویرایش معلم موجود استفاده کنید',
      });
      duplicates.push(normalizedName);
      return;
    }

    // Parse subject IDs if subject map provided
    let primarySubjectIds: number[] = [];
    if (raw.primarySubjects && subjectMap) {
      const subjectNames = raw.primarySubjects.split(/[،,]/).map((s) => s.trim());
      primarySubjectIds = subjectNames
        .map((name) => subjectMap.get(name.toLowerCase()))
        .filter((id): id is number => id !== undefined);
    }

    // Validate maxPeriodsPerWeek
    let maxPeriodsPerWeek = raw.maxPeriodsPerWeek || DEFAULT_TEACHER_VALUES.maxPeriodsPerWeek;
    if (maxPeriodsPerWeek < 1 || maxPeriodsPerWeek > 50) {
      errors.push({
        row: rowNum,
        field: 'maxPeriodsPerWeek',
        value: String(raw.maxPeriodsPerWeek),
        message: 'ساعت هفتگی باید بین ۱ تا ۵۰ باشد',
        suggestion: 'مقدار پیش‌فرض ۳۵ استفاده می‌شود',
      });
      maxPeriodsPerWeek = DEFAULT_TEACHER_VALUES.maxPeriodsPerWeek;
    }

    // Create validated teacher
    valid.push({
      fullName: normalizedName,
      primarySubjectIds,
      allowedSubjectIds: [],
      restrictToPrimarySubjects: true,
      unavailable: [],
      maxPeriodsPerWeek,
      maxPeriodsPerDay: DEFAULT_TEACHER_VALUES.maxPeriodsPerDay,
      maxConsecutivePeriods: DEFAULT_TEACHER_VALUES.maxConsecutivePeriods,
      timePreference: raw.timePreference || 'any',
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
export function generateExcelTemplate(): void {
  // Header row
  const headers = ['نام کامل *', 'مضامین اصلی', 'حداکثر ساعت هفته', 'ترجیح زمانی'];

  // Sub-header with descriptions
  const subHeaders = ['(اجباری)', '(با کاما جدا کنید)', '(پیش‌فرض: ۳۵)', '(صبح/بعدازظهر/هر زمان)'];

  // Example data rows
  const exampleData = [
    ['احمد احمدی', 'ریاضی، فیزیک', 35, 'صبح'],
    ['محمد محمدی', 'کیمیا', 28, 'هر زمان'],
    ['فاطمه فاطمی', 'بیولوژی، کیمیا', 42, 'بعدازظهر'],
  ];

  // Empty rows for data entry
  const emptyRows = Array(20).fill(['', '', '', '']);

  // Combine all data
  const allData = [headers, subHeaders, ...exampleData, ...emptyRows];

  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(allData);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 25 }, // نام کامل
    { wch: 30 }, // مضامین اصلی
    { wch: 20 }, // حداکثر ساعت هفته
    { wch: 20 }, // ترجیح زمانی
  ];

  // Set row heights (basic - xlsx has limited styling)
  worksheet['!rows'] = [
    { hpt: 25 }, // Header row
    { hpt: 20 }, // Sub-header row
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
    ['۲. مضامین اصلی: مضامینی که معلم تدریس می‌کند (با کاما جدا کنید)'],
    ['۳. حداکثر ساعت هفته: تعداد ساعات کاری در هفته (پیش‌فرض: ۳۵)'],
    ['۴. ترجیح زمانی: صبح، بعدازظهر، یا هر زمان'],
    [''],
    ['نکات مهم:'],
    ['• ردیف‌های ۳ تا ۵ نمونه هستند - می‌توانید آنها را پاک کنید'],
    ['• فقط ستون "نام کامل" اجباری است'],
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

  // Bulk create mutation
  const bulkCreateMutation = useMutation({
    mutationFn: async (teachers: ValidatedTeacher[]) => {
      // Convert to API format (JSON strings for arrays)
      const apiTeachers = teachers.map((t) => ({
        fullName: t.fullName,
        primarySubjectIds: JSON.stringify(t.primarySubjectIds),
        allowedSubjectIds: JSON.stringify(t.allowedSubjectIds),
        restrictToPrimarySubjects: t.restrictToPrimarySubjects,
        unavailable: JSON.stringify(t.unavailable),
        maxPeriodsPerWeek: t.maxPeriodsPerWeek,
        maxPeriodsPerDay: t.maxPeriodsPerDay,
        maxConsecutivePeriods: t.maxConsecutivePeriods,
        timePreference: t.timePreference,
      }));

      return api.teachers.bulkCreate(apiTeachers);
    },
    onSuccess: () => {
      invalidateTeacherCaches(queryClient);
      setValidationResult(null);
    },
  });

  // Validate from Excel file
  const validateFromExcel = useCallback(
    async (file: File, existingTeachers: Teacher[], subjectMap?: Map<string, number>) => {
      const rawTeachers = await parseExcelFile(file);
      const result = validateImportedTeachers(rawTeachers, existingTeachers, subjectMap);
      setValidationResult(result);
      return result;
    },
    []
  );

  // Validate from pasted text
  const validateFromText = useCallback((text: string, existingTeachers: Teacher[]) => {
    const names = parseNamesFromText(text);
    const rawTeachers: RawTeacherImport[] = names.map((name) => ({ fullName: name }));
    const result = validateImportedTeachers(rawTeachers, existingTeachers);
    setValidationResult(result);
    return result;
  }, []);

  // Validate from quick add list
  const validateFromList = useCallback((names: string[], existingTeachers: Teacher[]) => {
    const rawTeachers: RawTeacherImport[] = names.map((name) => ({ fullName: name }));
    const result = validateImportedTeachers(rawTeachers, existingTeachers);
    setValidationResult(result);
    return result;
  }, []);

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
