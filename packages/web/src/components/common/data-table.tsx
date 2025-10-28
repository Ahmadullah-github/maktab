import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination } from "./pagination";
import { SearchBar } from "./search-bar";
import { cn } from "@/lib/utils/tailwaindMergeUtil";

interface Column<T> {
  key: string;
  title: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  onSearch?: (query: string) => void;

  // 👇 اینجا را تغییر دادیم تا event هم پاس شود
  onRowClick?: (item: T, e: React.MouseEvent<HTMLTableRowElement>) => void;

  className?: string;
}

export function DataTable<T extends { id: string | number }>({
  data,
  columns,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  onSearch,
  onRowClick,
  className,
}: DataTableProps<T>) {
  return (
    <div className={cn("space-y-4", className)}>
      {(onSearch || onPageChange) && (
        <div className="flex items-center justify-between">
          {onSearch && (
            <div className="w-64">
              <SearchBar placeholder="Search..." onSearch={onSearch} />
            </div>
          )}
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key}>{column.title}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results found
                </TableCell>
              </TableRow>
            ) : (
              data.map((item, index) => {
                const idKey =
                  item.id !== undefined && item.id !== null
                    ? String(item.id)
                    : `idx-${index}`;

                return (
                  <TableRow
                    key={`${idKey}-${index}`}
                    onClick={(e) => onRowClick?.(item, e)} // 👈 event را هم پاس می‌دهیم
                    className={onRowClick ? "cursor-pointer" : ""}
                  >
                    {columns.map((column) => (
                      <TableCell key={column.key}>
                        {column.render
                          ? column.render(item)
                          : String(item[column.key as keyof T])}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {onPageChange && totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}
