import type { ReactNode } from 'react';

export interface ScheduleRouteStateProps {
  isLoading: boolean;
  error: string | null;
  children: ReactNode;
}

export function ScheduleRouteState({ isLoading, error, children }: ScheduleRouteStateProps) {
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
        </div>
      </div>
    );
  }

  return children;
}
