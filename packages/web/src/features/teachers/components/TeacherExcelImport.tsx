/**
 * TeacherExcelImport Component
 *
 * Import teachers from Excel file with:
 * - Download styled template
 * - File upload (drag & drop or click)
 * - Parse and validate Excel data
 * - Error display with suggestions
 * - Preview table
 * - Confirm import
 *
 * Follows the modern UI pattern from rooms feature.
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  generateExcelTemplate,
  useBulkImportTeachers,
  type ImportValidationError,
  type ValidatedTeacher,
} from '../hooks/useBulkImportTeachers';
import type { Teacher } from '../types';

export interface TeacherExcelImportProps {
  /** Existing teachers for duplicate detection */
  existingTeachers: Teacher[];
  /** Callback when import is successful */
  onSuccess?: (count: number) => void;
  /** Callback to close the panel */
  onClose?: () => void;
  /** Optional className */
  className?: string;
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'success' | 'error';

export function TeacherExcelImport({
  existingTeachers,
  onSuccess,
  onClose,
  className,
}: TeacherExcelImportProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<ImportStep>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [validTeachers, setValidTeachers] = useState<ValidatedTeacher[]>([]);
  const [validationErrors, setValidationErrors] = useState<ImportValidationError[]>([]);
  const [importedCount, setImportedCount] = useState(0);

  const { validateFromExcel, importTeachers, isImporting } = useBulkImportTeachers();

  // Handle file selection
  const handleFileSelect = useCallback(
    async (file: File) => {
      // Validate file type
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ];
      if (
        !validTypes.includes(file.type) &&
        !file.name.endsWith('.xlsx') &&
        !file.name.endsWith('.xls')
      ) {
        setParseError(
          t('teachers.excelImport.invalidFileType', 'فقط فایل‌های Excel (.xlsx) پشتیبانی می‌شوند')
        );
        return;
      }

      setFileName(file.name);
      setParseError(null);

      try {
        const result = await validateFromExcel(file, existingTeachers);
        setValidTeachers(result.valid);
        setValidationErrors(result.errors);
        setStep('preview');
      } catch (error) {
        setParseError(
          error instanceof Error
            ? error.message
            : t('teachers.excelImport.parseError', 'خطا در خواندن فایل')
        );
      }
    },
    [existingTeachers, validateFromExcel, t]
  );

  // Handle drag events
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  // Handle file input change
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  // Handle import
  const handleImport = useCallback(async () => {
    if (validTeachers.length === 0) return;

    setStep('importing');
    try {
      await importTeachers(validTeachers);
      setImportedCount(validTeachers.length);
      setStep('success');
      onSuccess?.(validTeachers.length);
    } catch (error) {
      setParseError(
        error instanceof Error
          ? error.message
          : t('teachers.excelImport.importError', 'خطا در وارد کردن')
      );
      setStep('error');
    }
  }, [validTeachers, importTeachers, onSuccess, t]);

  // Handle reset
  const handleReset = useCallback(() => {
    setStep('upload');
    setFileName(null);
    setParseError(null);
    setValidTeachers([]);
    setValidationErrors([]);
    setImportedCount(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Handle download template
  const handleDownloadTemplate = useCallback(() => {
    generateExcelTemplate();
  }, []);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="p-4 border-b-2 border-slate-100 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-green-500 to-green-600 flex items-center justify-center shadow-md">
            <FileSpreadsheet className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-800">
              {t('teachers.excelImport.title', 'وارد کردن از اکسل')}
            </h3>
            <p className="text-xs text-slate-500">
              {t('teachers.excelImport.subtitle', 'فایل Excel معلمین را بارگذاری کنید')}
            </p>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Content based on step */}
      {step === 'upload' && (
        <>
          {/* Download Template Section */}
          <div className="p-4 bg-slate-50 border-b border-slate-100">
            <div className="flex items-center justify-between p-3 bg-white rounded-xl border-2 border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
                  <Download className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    {t('teachers.excelImport.templateTitle', 'قالب Excel')}
                  </p>
                  <p className="text-xs text-slate-500">
                    {t('teachers.excelImport.templateDesc', 'ابتدا قالب را دانلود و پر کنید')}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                className="gap-2 border-2 border-green-200 text-green-700 hover:bg-green-50"
              >
                <Download className="h-4 w-4" />
                {t('common.download', 'دانلود')}
              </Button>
            </div>
          </div>

          {/* Upload Area */}
          <div className="flex-1 p-4">
            <div
              className={cn(
                'h-full border-2 border-dashed rounded-xl transition-all duration-200 flex flex-col items-center justify-center gap-4 cursor-pointer',
                isDragging
                  ? 'border-green-400 bg-green-50'
                  : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50'
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleInputChange}
                className="hidden"
              />

              <div
                className={cn(
                  'w-16 h-16 rounded-2xl flex items-center justify-center transition-colors',
                  isDragging ? 'bg-green-100' : 'bg-slate-100'
                )}
              >
                <Upload
                  className={cn(
                    'w-8 h-8 transition-colors',
                    isDragging ? 'text-green-600' : 'text-slate-400'
                  )}
                />
              </div>

              <div className="text-center">
                <p className="text-sm font-medium text-slate-700">
                  {isDragging
                    ? t('teachers.excelImport.dropHere', 'فایل را رها کنید')
                    : t('teachers.excelImport.dragOrClick', 'فایل را بکشید یا کلیک کنید')}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {t('teachers.excelImport.supportedFormats', 'فرمت‌های پشتیبانی: .xlsx')}
                </p>
              </div>

              {fileName && (
                <Badge variant="secondary" className="gap-1.5 bg-slate-200">
                  <FileSpreadsheet className="h-3 w-3" />
                  {fileName}
                </Badge>
              )}
            </div>

            {/* Parse Error */}
            {parseError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-600 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {parseError}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t-2 border-slate-100 bg-white">
            {onClose && (
              <Button
                variant="outline"
                onClick={onClose}
                className="w-full border-2 border-slate-200"
              >
                {t('common.cancel', 'انصراف')}
              </Button>
            )}
          </div>
        </>
      )}

      {step === 'preview' && (
        <>
          {/* Preview Header */}
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="gap-1.5 bg-slate-200">
                  <FileSpreadsheet className="h-3 w-3" />
                  {fileName}
                </Badge>
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                  {validTeachers.length} {t('common.valid', 'معتبر')}
                </Badge>
                {validationErrors.length > 0 && (
                  <Badge className="bg-red-100 text-red-700 border-red-200">
                    {validationErrors.length} {t('common.error', 'خطا')}
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 text-xs">
                {t('common.changeFile', 'تغییر فایل')}
              </Button>
            </div>
          </div>

          {/* Errors Section */}
          {validationErrors.length > 0 && (
            <div className="p-3 bg-red-50 border-b border-red-100">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium text-red-700">
                  {t('teachers.excelImport.errorsFound', 'خطاهای یافت شده')}
                </span>
              </div>
              <ScrollArea className="max-h-[120px]">
                <div className="space-y-1">
                  {validationErrors.map((error, index) => (
                    <div
                      key={index}
                      className="text-xs p-2 bg-white rounded-lg border border-red-200"
                    >
                      <span className="font-medium text-red-600">
                        {t('teachers.excelImport.row', 'ردیف')} {error.row}:
                      </span>{' '}
                      <span className="text-red-700">{error.message}</span>
                      {error.suggestion && (
                        <span className="text-slate-500 block mt-0.5">💡 {error.suggestion}</span>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Valid Teachers Preview */}
          <ScrollArea className="flex-1">
            <div className="p-3">
              {validTeachers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                  <AlertCircle className="h-10 w-10 mb-2" />
                  <p className="text-sm">
                    {t('teachers.excelImport.noValidData', 'هیچ داده معتبری یافت نشد')}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {validTeachers.map((teacher, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2.5 bg-white rounded-lg border-2 border-slate-100"
                    >
                      <span className="w-6 h-6 rounded-md bg-emerald-100 flex items-center justify-center text-xs font-medium text-emerald-700">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 truncate">{teacher.fullName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-slate-500">
                            {teacher.maxPeriodsPerWeek} {t('common.hoursPerWeek', 'ساعت/هفته')}
                          </span>
                          {teacher.timePreference !== 'any' && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1">
                              {teacher.timePreference === 'morning'
                                ? t('common.morning', 'صبح')
                                : t('common.afternoon', 'بعدازظهر')}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Import Footer */}
          <div className="p-4 border-t-2 border-slate-100 bg-white">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleReset}
                className="flex-1 border-2 border-slate-200"
              >
                {t('common.back', 'بازگشت')}
              </Button>
              <Button
                onClick={handleImport}
                disabled={validTeachers.length === 0 || isImporting}
                className={cn(
                  'flex-1 gap-2 shadow-md',
                  validTeachers.length > 0
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-slate-300 text-slate-500'
                )}
              >
                <CheckCircle2 className="h-4 w-4" />
                {t('teachers.excelImport.import', 'وارد کردن')}
                {validTeachers.length > 0 && (
                  <Badge variant="secondary" className="bg-white/20 text-white text-xs">
                    {validTeachers.length}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </>
      )}

      {step === 'importing' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <Loader2 className="h-12 w-12 text-emerald-500 animate-spin mb-4" />
          <p className="text-lg font-medium text-slate-700">
            {t('teachers.excelImport.importing', 'در حال وارد کردن...')}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            {validTeachers.length} {t('common.teacher', 'معلم')}
          </p>
        </div>
      )}

      {step === 'success' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <p className="text-lg font-medium text-slate-700">
            {t('teachers.excelImport.success', 'با موفقیت وارد شد!')}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            {importedCount} {t('common.teacherAdded', 'معلم اضافه شد')}
          </p>
          <div className="flex gap-2 mt-6">
            <Button variant="outline" onClick={handleReset} className="border-2">
              {t('teachers.excelImport.importMore', 'وارد کردن بیشتر')}
            </Button>
            {onClose && (
              <Button onClick={onClose} className="bg-emerald-600 hover:bg-emerald-700">
                {t('common.done', 'تمام')}
              </Button>
            )}
          </div>
        </div>
      )}

      {step === 'error' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <p className="text-lg font-medium text-slate-700">
            {t('teachers.excelImport.failed', 'خطا در وارد کردن')}
          </p>
          {parseError && <p className="text-sm text-red-500 mt-1">{parseError}</p>}
          <div className="flex gap-2 mt-6">
            <Button variant="outline" onClick={handleReset} className="border-2">
              {t('common.tryAgain', 'تلاش مجدد')}
            </Button>
            {onClose && (
              <Button variant="ghost" onClick={onClose}>
                {t('common.close', 'بستن')}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default TeacherExcelImport;
