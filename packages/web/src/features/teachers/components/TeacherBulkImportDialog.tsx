/**
 * TeacherBulkImportDialog Component
 *
 * Main dialog for bulk importing teachers with three methods:
 * 1. Quick Add - Type names one by one
 * 2. Paste Import - Copy/paste a list of names
 * 3. Excel Import - Upload Excel file
 *
 * Uses Sheet component for a slide-in panel from the right (RTL).
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { ClipboardPaste, FileSpreadsheet, UserPlus, Users } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Teacher } from '../types';
import { TeacherExcelImport } from './TeacherExcelImport';
import { TeacherPasteImport } from './TeacherPasteImport';
import { TeacherQuickAdd } from './TeacherQuickAdd';

export interface TeacherBulkImportDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Existing teachers for duplicate detection */
  existingTeachers: Teacher[];
  /** Callback when import is successful */
  onSuccess?: (count: number) => void;
}

type ImportMethod = 'quick' | 'paste' | 'excel';

interface MethodConfig {
  id: ImportMethod;
  icon: React.ElementType;
  label: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export function TeacherBulkImportDialog({
  open,
  onOpenChange,
  existingTeachers,
  onSuccess,
}: TeacherBulkImportDialogProps) {
  const { t } = useTranslation();
  const [activeMethod, setActiveMethod] = useState<ImportMethod>('quick');

  const methods: MethodConfig[] = [
    {
      id: 'quick',
      icon: UserPlus,
      label: t('teachers.bulkImport.quickAdd', 'افزودن سریع'),
      description: t('teachers.bulkImport.quickAddDesc', 'تایپ نام + Enter'),
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
    },
    {
      id: 'paste',
      icon: ClipboardPaste,
      label: t('teachers.bulkImport.pasteImport', 'کپی و پیست'),
      description: t('teachers.bulkImport.pasteImportDesc', 'لیست نام‌ها'),
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
    },
    {
      id: 'excel',
      icon: FileSpreadsheet,
      label: t('teachers.bulkImport.excelImport', 'فایل اکسل'),
      description: t('teachers.bulkImport.excelImportDesc', 'آپلود فایل'),
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
    },
  ];

  const handleSuccess = useCallback(
    (count: number) => {
      onSuccess?.(count);
      onOpenChange(false);
    },
    [onOpenChange, onSuccess]
  );

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[520px] p-0 flex flex-col bg-linear-to-br from-slate-50 to-white"
      >
        {/* Header */}
        <SheetHeader className="p-5 pb-4 border-b-2 border-slate-100 bg-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-linear-to-br from-[#003366] to-[#004488] flex items-center justify-center shadow-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <SheetTitle className="text-lg font-bold text-slate-800">
                {t('teachers.bulkImport.title', 'وارد کردن گروهی معلمین')}
              </SheetTitle>
              <SheetDescription className="text-sm text-slate-500 mt-0.5">
                {t('teachers.bulkImport.subtitle', 'چندین معلم را به صورت یکجا اضافه کنید')}
              </SheetDescription>
            </div>
            <Badge variant="secondary" className="bg-slate-100 text-slate-600">
              {existingTeachers.length} {t('common.existing', 'موجود')}
            </Badge>
          </div>
        </SheetHeader>

        {/* Method Tabs */}
        <div className="px-4 py-3 bg-white border-b border-slate-100">
          <div className="flex gap-2">
            {methods.map((method) => {
              const Icon = method.icon;
              const isActive = activeMethod === method.id;

              return (
                <Button
                  key={method.id}
                  variant="ghost"
                  onClick={() => setActiveMethod(method.id)}
                  className={cn(
                    'flex-1 h-auto py-2.5 px-3 flex flex-col items-center gap-1 rounded-xl border-2 transition-all',
                    isActive
                      ? `${method.bgColor} ${method.borderColor} ${method.color}`
                      : 'border-transparent hover:bg-slate-50 text-slate-600'
                  )}
                >
                  <Icon className={cn('h-5 w-5', isActive ? method.color : 'text-slate-400')} />
                  <span className="text-xs font-medium">{method.label}</span>
                </Button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          {activeMethod === 'quick' && (
            <TeacherQuickAdd
              existingTeachers={existingTeachers}
              onSuccess={handleSuccess}
              onClose={handleClose}
              className="h-full"
            />
          )}
          {activeMethod === 'paste' && (
            <TeacherPasteImport
              existingTeachers={existingTeachers}
              onSuccess={handleSuccess}
              onClose={handleClose}
              className="h-full"
            />
          )}
          {activeMethod === 'excel' && (
            <TeacherExcelImport
              existingTeachers={existingTeachers}
              onSuccess={handleSuccess}
              onClose={handleClose}
              className="h-full"
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default TeacherBulkImportDialog;
