/**
 * ScheduleList Component
 * Table displaying saved schedules with actions.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

import { Button } from '@/components/ui/button';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { TimetableApiResponse } from '../../types';
import { ScheduleListItem } from './ScheduleListItem';

export interface ScheduleListProps {
  schedules: TimetableApiResponse[];
  isLoading: boolean;
  onLoad: (schedule: TimetableApiResponse) => void;
  onDelete: (schedule: TimetableApiResponse) => void;
  onRename: (id: number, newName: string) => void;
}

const ITEMS_PER_PAGE = 10;

/**
 * Sort schedules by createdAt descending (newest first)
 */
export function sortSchedulesByDate(schedules: TimetableApiResponse[]): TimetableApiResponse[] {
  return [...schedules].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return dateB - dateA;
  });
}

export function ScheduleList({
  schedules,
  isLoading,
  onLoad,
  onDelete,
  onRename,
}: ScheduleListProps) {
  const [currentPage, setCurrentPage] = useState(1);

  // Sort schedules by createdAt descending
  const sortedSchedules = useMemo(() => sortSchedulesByDate(schedules), [schedules]);

  // Calculate pagination
  const totalPages = Math.ceil(sortedSchedules.length / ITEMS_PER_PAGE);
  const showPagination = sortedSchedules.length > ITEMS_PER_PAGE;

  // Get current page items
  const paginatedSchedules = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return sortedSchedules.slice(startIndex, endIndex);
  }, [sortedSchedules, currentPage]);

  // Reset to page 1 when schedules change
  useMemo(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="text-muted-foreground">در حال بارگذاری...</span>
      </div>
    );
  }

  if (schedules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-lg text-muted-foreground">هیچ جدول زمانی ذخیره شده‌ای وجود ندارد</p>
        <p className="text-sm text-muted-foreground">برای شروع، یک جدول زمانی جدید تولید کنید</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">نام</TableHead>
              <TableHead className="text-right">تاریخ ایجاد</TableHead>
              <TableHead className="text-right">تعداد صنف‌ها</TableHead>
              <TableHead className="text-right">عملیات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedSchedules.map((schedule) => (
              <ScheduleListItem
                key={schedule.id}
                schedule={schedule}
                onLoad={() => onLoad(schedule)}
                onDelete={() => onDelete(schedule)}
                onRename={(newName) => onRename(schedule.id, newName)}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {showPagination && (
        <div className="flex items-center justify-between px-2" data-testid="pagination-controls">
          <div className="text-sm text-muted-foreground">
            صفحه {currentPage} از {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
            >
              <ChevronRight className="h-4 w-4" />
              قبلی
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
            >
              بعدی
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
