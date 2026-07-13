/**
 * TeacherPasteImport Component
 *
 * Paste a list of teacher names (one per line) for bulk import.
 * - Textarea for pasting names
 * - Real-time parsing and preview
 * - Validation with error display
 * - Import with confirmation
 *
 * Follows the modern UI pattern from rooms feature.
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardPaste,
  FileText,
  Loader2,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  normalizeName,
  parseNamesFromText,
  useBulkImportTeachers,
  validatePersianName,
} from '../hooks/useBulkImportTeachers';
import type { Teacher } from '../types';

export interface TeacherPasteImportProps {
  /** Existing teachers for duplicate detection */
  existingTeachers: Teacher[];
  /** Callback when import is successful */
  onSuccess?: (count: number) => void;
  /** Callback to close the panel */
  onClose?: () => void;
  /** Optional className */
  className?: string;
}

interface ParsedName {
  name: string;
  valid: boolean;
  error?: string;
  isDuplicate?: boolean;
}

export function TeacherPasteImport({
  existingTeachers,
  onSuccess,
  onClose,
  className,
}: TeacherPasteImportProps) {
  const { t } = useTranslation();
  const [textValue, setTextValue] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const { validateFromText, importTeachers, isImporting, clearValidation } =
    useBulkImportTeachers();

  // Parse and validate names in real-time
  const parsedNames = useMemo((): ParsedName[] => {
    if (!textValue.trim()) return [];

    const names = parseNamesFromText(textValue);
    const existingNamesLower = new Set(
      existingTeachers.map((t) => normalizeName(t.fullName).toLowerCase())
    );
    const seenNames = new Set<string>();

    return names.map((name) => {
      const normalized = normalizeName(name);
      const lowerName = normalized.toLowerCase();

      // Check validation
      const validation = validatePersianName(normalized);
      if (!validation.valid) {
        return { name: normalized, valid: false, error: validation.error };
      }

      // Check duplicate in existing
      if (existingNamesLower.has(lowerName)) {
        return {
          name: normalized,
          valid: false,
          error: 'قبلاً ثبت شده',
          isDuplicate: true,
        };
      }

      // Check duplicate in current list
      if (seenNames.has(lowerName)) {
        return {
          name: normalized,
          valid: false,
          error: 'تکراری در لیست',
          isDuplicate: true,
        };
      }

      seenNames.add(lowerName);
      return { name: normalized, valid: true };
    });
  }, [textValue, existingTeachers]);

  // Stats
  const validCount = parsedNames.filter((n) => n.valid).length;
  const errorCount = parsedNames.filter((n) => !n.valid).length;
  const totalCount = parsedNames.length;

  // Handle preview
  const handlePreview = useCallback(() => {
    if (parsedNames.length === 0) return;
    setShowPreview(true);
  }, [parsedNames]);

  // Handle back to edit
  const handleBackToEdit = useCallback(() => {
    setShowPreview(false);
    clearValidation();
  }, [clearValidation]);

  // Handle import
  const handleImport = useCallback(async () => {
    if (validCount === 0) return;

    const validNames = parsedNames.filter((n) => n.valid).map((n) => n.name);
    const result = validateFromText(validNames.join('\n'), existingTeachers);

    if (result.valid.length === 0) return;

    try {
      await importTeachers(result.valid);
      onSuccess?.(result.valid.length);
      setTextValue('');
      setShowPreview(false);
      clearValidation();
    } catch {
      // Error handled by mutation
    }
  }, [
    parsedNames,
    validCount,
    existingTeachers,
    validateFromText,
    importTeachers,
    onSuccess,
    clearValidation,
  ]);

  // Handle paste from clipboard
  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setTextValue(text);
    } catch {
      // Clipboard access denied - user can paste manually
    }
  }, []);

  const canPreview = totalCount > 0;
  const canImport = validCount > 0 && !isImporting;

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="p-4 border-b-2 border-slate-100 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
            <ClipboardPaste className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-800">
              {t('teachers.pasteImport.title', 'وارد کردن از متن')}
            </h3>
            <p className="text-xs text-slate-500">
              {t('teachers.pasteImport.subtitle', 'لیست نام‌ها را کپی و پیست کنید')}
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

      {!showPreview ? (
        /* Input Mode */
        <>
          {/* Textarea Section */}
          <div className="flex-1 p-4 flex flex-col gap-3 overflow-hidden">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">
                {t('teachers.pasteImport.label', 'نام معلمین (هر خط یک نام)')}
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePasteFromClipboard}
                className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              >
                <ClipboardPaste className="h-3 w-3 me-1" />
                {t('common.paste', 'پیست')}
              </Button>
            </div>

            <Textarea
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              placeholder={t(
                'teachers.pasteImport.placeholder',
                'احمد احمدی\nمحمد محمدی\nفاطمه فاطمی\n...'
              )}
              className="flex-1 min-h-[200px] resize-none border-2 border-slate-200 focus:border-blue-400 text-base leading-relaxed"
              dir="rtl"
            />

            {/* Stats */}
            {totalCount > 0 && (
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-400" />
                  <span className="text-sm text-slate-600">
                    {t('teachers.pasteImport.found', 'یافت شد')}:
                  </span>
                </div>
                <Badge variant="secondary" className="bg-slate-200 text-slate-700">
                  {totalCount} {t('common.name', 'نام')}
                </Badge>
                {validCount > 0 && (
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                    {validCount} {t('common.valid', 'معتبر')}
                  </Badge>
                )}
                {errorCount > 0 && (
                  <Badge className="bg-red-100 text-red-700 border-red-200">
                    {errorCount} {t('common.invalid', 'نامعتبر')}
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t-2 border-slate-100 bg-white">
            <div className="flex gap-2">
              {onClose && (
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="flex-1 border-2 border-slate-200"
                >
                  {t('common.cancel', 'انصراف')}
                </Button>
              )}
              <Button
                onClick={handlePreview}
                disabled={!canPreview}
                className={cn(
                  'flex-1 gap-2 shadow-md',
                  canPreview
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-slate-300 text-slate-500'
                )}
              >
                <Users className="h-4 w-4" />
                {t('teachers.pasteImport.preview', 'پیش‌نمایش')}
              </Button>
            </div>
          </div>
        </>
      ) : (
        /* Preview Mode */
        <>
          {/* Preview Header */}
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-700">
                  {t('teachers.pasteImport.previewTitle', 'پیش‌نمایش وارد کردن')}
                </span>
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                  {validCount} {t('common.ready', 'آماده')}
                </Badge>
                {errorCount > 0 && (
                  <Badge className="bg-red-100 text-red-700 border-red-200">
                    {errorCount} {t('common.skipped', 'رد شده')}
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={handleBackToEdit} className="h-7 text-xs">
                {t('common.edit', 'ویرایش')}
              </Button>
            </div>
          </div>

          {/* Preview List */}
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-1">
              {parsedNames.map((item, index) => (
                <div
                  key={index}
                  className={cn(
                    'flex items-center gap-2 p-2.5 rounded-lg border-2 transition-colors',
                    item.valid ? 'bg-white border-slate-100' : 'bg-red-50/50 border-red-100'
                  )}
                >
                  {/* Index */}
                  <span
                    className={cn(
                      'w-6 h-6 rounded-md flex items-center justify-center text-xs font-medium',
                      item.valid ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                    )}
                  >
                    {index + 1}
                  </span>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        'font-medium truncate',
                        item.valid ? 'text-slate-800' : 'text-red-700'
                      )}
                    >
                      {item.name}
                    </p>
                  </div>

                  {/* Status */}
                  {item.valid ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  ) : (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs text-red-500">{item.error}</span>
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Import Footer */}
          <div className="p-4 border-t-2 border-slate-100 bg-white">
            {errorCount > 0 && (
              <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-700">
                  <AlertCircle className="h-3.5 w-3.5 inline me-1" />
                  {t('teachers.pasteImport.errorNote', 'موارد نامعتبر وارد نخواهند شد')}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleBackToEdit}
                disabled={isImporting}
                className="flex-1 border-2 border-slate-200"
              >
                {t('common.back', 'بازگشت')}
              </Button>
              <Button
                onClick={handleImport}
                disabled={!canImport}
                className={cn(
                  'flex-1 gap-2 shadow-md',
                  canImport
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-slate-300 text-slate-500'
                )}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('common.importing', 'در حال وارد کردن...')}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    {t('teachers.pasteImport.import', 'وارد کردن')}
                    <Badge variant="secondary" className="bg-white/20 text-white text-xs">
                      {validCount}
                    </Badge>
                  </>
                )}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default TeacherPasteImport;
