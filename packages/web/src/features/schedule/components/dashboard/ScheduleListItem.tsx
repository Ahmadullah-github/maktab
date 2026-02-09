/**
 * ScheduleListItem Component
 * Individual row in the schedule list table.
 *
 * Requirements: 2.1, 2.7
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TableCell, TableRow } from '@/components/ui/table';
import { Check, Pencil, Play, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TimetableApiResponse } from '../../types';

export interface ScheduleListItemProps {
  schedule: TimetableApiResponse;
  onLoad: () => void;
  onDelete: () => void;
  onRename: (newName: string) => void;
}

export function ScheduleListItem({ schedule, onLoad, onDelete, onRename }: ScheduleListItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(schedule.name);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Parse the schedule data to get class count
  const getClassCount = (): number => {
    try {
      const data = JSON.parse(schedule.data);
      return data?.statistics?.totalClasses ?? 0;
    } catch {
      return 0;
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  const handleStartEdit = useCallback(() => {
    setEditName(schedule.name);
    setIsEditing(true);
  }, [schedule.name]);

  const handleCancelEdit = useCallback(() => {
    setEditName(schedule.name);
    setIsEditing(false);
  }, [schedule.name]);

  const handleConfirmEdit = useCallback(() => {
    const trimmedName = editName.trim();
    if (trimmedName && trimmedName !== schedule.name) {
      onRename(trimmedName);
    }
    setIsEditing(false);
  }, [editName, schedule.name, onRename]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleConfirmEdit();
      } else if (e.key === 'Escape') {
        handleCancelEdit();
      }
    },
    [handleConfirmEdit, handleCancelEdit]
  );

  return (
    <TableRow className="group">
      <TableCell className="font-medium">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleCancelEdit}
              className="h-8 w-48"
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleConfirmEdit}
            >
              <Check className="h-4 w-4 text-green-600" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleCancelEdit}
            >
              <X className="h-4 w-4 text-red-600" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span>{schedule.name}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleStartEdit}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
        )}
      </TableCell>
      <TableCell>{formatDate(schedule.createdAt)}</TableCell>
      <TableCell>{getClassCount()}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onLoad}>
            <Play className="me-1 h-4 w-4" />
            بارگذاری
          </Button>
          <Button variant="outline" size="sm" onClick={onDelete}>
            <Trash2 className="me-1 h-4 w-4" />
            حذف
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
