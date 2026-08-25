import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useScheduleStore } from '../../stores/scheduleStore';
import { ScheduleStorage } from '../../utils/scheduleStorage';
import { useNavigate } from '@tanstack/react-router';

export interface ScheduleRouteStateProps {
  isLoading: boolean;
  error: string | null;
  children: ReactNode;
}

export function ScheduleRouteState({ isLoading, error, children }: ScheduleRouteStateProps) {
  const navigate = useNavigate();
  const scheduleId = useScheduleStore((state) => state.scheduleId);
  const pendingDraft = useScheduleStore((state) => state.pendingRecoveryDraft);
  const recoverDraft = useScheduleStore((state) => state.recoverDraft);
  const discardDraftRecovery = useScheduleStore((state) => state.discardDraftRecovery);
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">در حال بارگذاری...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <p className="text-destructive mb-2">خطا در بارگذاری جدول زمانی</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button onClick={() => window.location.reload()}>تلاش دوباره</Button>
            <Button variant="outline" onClick={() => navigate({ to: '/schedule-dashboard' })}>
              بازگشت
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      <AlertDialog open={pendingDraft !== null}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>بازیابی تغییرات ذخیره‌نشده</AlertDialogTitle>
            <AlertDialogDescription>
              یک نسخهٔ محلی جدیدتر پیدا شد. می‌خواهید تغییرات ذخیره‌نشده را بازیابی کنید؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                if (scheduleId !== null) ScheduleStorage.clear(scheduleId);
                discardDraftRecovery();
              }}
            >
              نادیده گرفتن
            </AlertDialogCancel>
            <AlertDialogAction onClick={recoverDraft}>بازیابی تغییرات</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
