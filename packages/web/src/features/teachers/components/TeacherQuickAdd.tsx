/**
 * TeacherQuickAdd Component
 *
 * Quick add mode for rapidly adding multiple teachers by name.
 * - Type name + Enter to add to pending list
 * - Remove individual items
 * - Real-time validation (Persian/Dari names)
 * - Duplicate detection
 * - Save All to bulk import
 *
 * Follows the modern UI pattern from rooms feature.
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, Loader2, Plus, Trash2, UserPlus, Users, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  normalizeName,
  useBulkImportTeachers,
  validatePersianName,
} from '../hooks/useBulkImportTeachers';
import type { Teacher } from '../types';

export interface TeacherQuickAddProps {
  /** Existing teachers for duplicate detection */
  existingTeachers: Teacher[];
  /** Callback when import is successful */
  onSuccess?: (count: number) => void;
  /** Callback to close the panel */
  onClose?: () => void;
  /** Optional className */
  className?: string;
}

interface PendingTeacher {
  id: string;
  name: string;
  error?: string;
}

/**
 * Generate unique ID for pending items
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function TeacherQuickAdd({
  existingTeachers,
  onSuccess,
  onClose,
  className,
}: TeacherQuickAddProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [pendingTeachers, setPendingTeachers] = useState<PendingTeacher[]>([]);
  const [inputError, setInputError] = useState<string | null>(null);

  const { validateFromList, importTeachers, isImporting, validationResult, clearValidation } =
    useBulkImportTeachers();

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Check for duplicates
  const isDuplicate = useCallback(
    (name: string): boolean => {
      const normalized = normalizeName(name).toLowerCase();
      // Check existing teachers
      const existsInDb = existingTeachers.some(
        (t) => normalizeName(t.fullName).toLowerCase() === normalized
      );
      // Check pending list
      const existsInPending = pendingTeachers.some(
        (t) => normalizeName(t.name).toLowerCase() === normalized
      );
      return existsInDb || existsInPending;
    },
    [existingTeachers, pendingTeachers]
  );

  // Handle adding a teacher
  const handleAdd = useCallback(() => {
    const name = normalizeName(inputValue);

    if (!name) {
      setInputError(null);
      return;
    }

    // Validate name
    const validation = validatePersianName(name);
    if (!validation.valid) {
      setInputError(validation.error || 'نام نامعتبر است');
      return;
    }

    // Check duplicates
    if (isDuplicate(name)) {
      setInputError('این نام قبلاً اضافه شده است');
      return;
    }

    // Add to pending list
    setPendingTeachers((prev) => [...prev, { id: generateId(), name }]);
    setInputValue('');
    setInputError(null);
    inputRef.current?.focus();
  }, [inputValue, isDuplicate]);

  // Handle key press
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAdd();
      }
    },
    [handleAdd]
  );

  // Handle removing a teacher
  const handleRemove = useCallback((id: string) => {
    setPendingTeachers((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Handle clear all
  const handleClearAll = useCallback(() => {
    setPendingTeachers([]);
    clearValidation();
    inputRef.current?.focus();
  }, [clearValidation]);

  // Handle save all
  const handleSaveAll = useCallback(async () => {
    if (pendingTeachers.length === 0) return;

    const names = pendingTeachers.map((t) => t.name);
    const result = validateFromList(names, existingTeachers);

    if (result.errors.length > 0) {
      // Mark items with errors
      setPendingTeachers((prev) =>
        prev.map((t, index) => {
          const error = result.errors.find((e) => e.row === index + 2);
          return error ? { ...t, error: error.message } : t;
        })
      );
      return;
    }

    try {
      await importTeachers(result.valid);
      onSuccess?.(result.valid.length);
      setPendingTeachers([]);
      clearValidation();
    } catch {
      // Error handled by mutation
    }
  }, [
    pendingTeachers,
    existingTeachers,
    validateFromList,
    importTeachers,
    onSuccess,
    clearValidation,
  ]);

  const hasErrors = pendingTeachers.some((t) => t.error);
  const canSave = pendingTeachers.length > 0 && !isImporting;

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="p-4 border-b-2 border-slate-100 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-md">
            <UserPlus className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-800">
              {t('teachers.quickAdd.title', 'افزودن سریع')}
            </h3>
            <p className="text-xs text-slate-500">
              {t('teachers.quickAdd.subtitle', 'نام معلمین را وارد کنید')}
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

      {/* Input Section */}
      <div className="p-4 bg-slate-50 border-b border-slate-100">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setInputError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder={t('teachers.quickAdd.placeholder', 'نام معلم را وارد کنید...')}
              className={cn(
                'h-11 text-base border-2 bg-white',
                inputError
                  ? 'border-red-300 focus:border-red-400'
                  : 'border-slate-200 focus:border-emerald-400'
              )}
              disabled={isImporting}
            />
            {inputError && (
              <div className="absolute -bottom-5 start-0 text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {inputError}
              </div>
            )}
          </div>
          <Button
            onClick={handleAdd}
            disabled={!inputValue.trim() || isImporting}
            className="h-11 px-4 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-slate-400 mt-3">
          {t('teachers.quickAdd.hint', 'Enter را فشار دهید یا دکمه + را کلیک کنید')}
        </p>
      </div>

      {/* Pending List */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {pendingTeachers.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-6">
            <Users className="h-12 w-12 mb-3 opacity-50" />
            <p className="text-sm font-medium">{t('teachers.quickAdd.empty', 'لیست خالی است')}</p>
            <p className="text-xs mt-1">
              {t('teachers.quickAdd.emptyHint', 'نام معلمین را در بالا وارد کنید')}
            </p>
          </div>
        ) : (
          <>
            {/* List Header */}
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className="bg-emerald-100 text-emerald-700 border-emerald-200"
                >
                  {pendingTeachers.length}
                </Badge>
                <span className="text-xs text-slate-600">
                  {t('teachers.quickAdd.pending', 'در انتظار ذخیره')}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                disabled={isImporting}
                className="h-7 text-xs text-slate-500 hover:text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3 w-3 me-1" />
                {t('common.clearAll', 'پاک کردن همه')}
              </Button>
            </div>

            {/* List Items */}
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {pendingTeachers.map((teacher, index) => (
                  <div
                    key={teacher.id}
                    className={cn(
                      'flex items-center gap-2 p-2.5 rounded-lg border-2 transition-colors',
                      teacher.error
                        ? 'bg-red-50 border-red-200'
                        : 'bg-white border-slate-100 hover:border-slate-200'
                    )}
                  >
                    {/* Index */}
                    <span className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center text-xs font-medium text-slate-500">
                      {index + 1}
                    </span>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 truncate">{teacher.name}</p>
                      {teacher.error && (
                        <p className="text-xs text-red-500 flex items-center gap-1 mt-0.5">
                          <AlertCircle className="h-3 w-3" />
                          {teacher.error}
                        </p>
                      )}
                    </div>

                    {/* Status Icon */}
                    {teacher.error ? (
                      <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    )}

                    {/* Remove Button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemove(teacher.id)}
                      disabled={isImporting}
                      className="h-7 w-7 hover:bg-red-100 hover:text-red-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t-2 border-slate-100 bg-white">
        {validationResult?.errors && validationResult.errors.length > 0 && (
          <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-xs text-red-600 font-medium flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" />
              {t('teachers.quickAdd.hasErrors', 'برخی موارد خطا دارند')}
            </p>
          </div>
        )}

        <div className="flex gap-2">
          {onClose && (
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isImporting}
              className="flex-1 border-2 border-slate-200"
            >
              {t('common.cancel', 'انصراف')}
            </Button>
          )}
          <Button
            onClick={handleSaveAll}
            disabled={!canSave || hasErrors}
            className={cn(
              'flex-1 gap-2 shadow-md',
              canSave && !hasErrors
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-slate-300 text-slate-500'
            )}
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('common.saving', 'در حال ذخیره...')}
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                {t('teachers.quickAdd.saveAll', 'ذخیره همه')}
                {pendingTeachers.length > 0 && (
                  <Badge variant="secondary" className="bg-white/20 text-white text-xs">
                    {pendingTeachers.length}
                  </Badge>
                )}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default TeacherQuickAdd;
