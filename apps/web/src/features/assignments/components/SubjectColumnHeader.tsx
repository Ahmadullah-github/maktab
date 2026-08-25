/**
 * SubjectColumnHeader Component
 *
 * Header row showing subject names as column headers.
 * Used above the class assignment rows to identify each subject column.
 *
 * Requirements: Phase 3.3
 */

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Subject } from '@/features/subjects/types';
import { cn } from '@/lib/utils';
import { BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// ============================================================================
// Types
// ============================================================================

export interface SubjectColumnHeaderProps {
  /** Subjects to display as columns */
  subjects: Subject[];
  /** Subject IDs that are required by at least one class in the current view */
  activeSubjectIds: Set<number>;
  /** Click handler for subject column */
  onSubjectClick?: (subjectId: number) => void;
  /** Compact mode when drawer is open */
  compact?: boolean;
  /** Class info column width to match */
  classColumnWidth?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get abbreviated subject name (first 3 characters)
 */
function getSubjectAbbreviation(name: string): string {
  return name.substring(0, 3);
}

/**
 * Check if subject requires a special room (lab, gym, etc.)
 */
function requiresSpecialRoom(subject: Subject): boolean {
  return subject.requiredRoomType !== 'normal' && subject.requiredRoomType !== '';
}

// ============================================================================
// Component
// ============================================================================

export function SubjectColumnHeader({
  subjects,
  activeSubjectIds,
  onSubjectClick,
  compact = false,
  classColumnWidth = 180,
}: SubjectColumnHeaderProps) {
  const { t } = useTranslation();

  // Filter to only show subjects that are actually used
  const activeSubjects = subjects.filter((s) => activeSubjectIds.has(s.id));

  if (activeSubjects.length === 0) {
    return null;
  }

  return (
    <div className="flex items-stretch border-b bg-slate-50/80 sticky top-0 z-10">
      {/* Class Column Placeholder */}
      <div
        className={cn(
          'flex items-center gap-2 p-2 border-e bg-slate-100/50',
          compact ? 'w-[140px]' : `w-[${classColumnWidth}px]`
        )}
        style={{ width: compact ? 140 : classColumnWidth }}
      >
        <BookOpen className="w-4 h-4 text-slate-400" />
        <span className="text-xs font-medium text-slate-500">
          {t('assignments.headers.class', 'صنف')}
        </span>
      </div>

      {/* Subject Headers */}
      <div className="flex-1 flex items-center gap-1 p-2 overflow-x-auto">
        {activeSubjects.map((subject) => (
          <SubjectHeaderCell
            key={subject.id}
            subject={subject}
            onClick={onSubjectClick ? () => onSubjectClick(subject.id) : undefined}
            compact={compact}
          />
        ))}
      </div>

      {/* Actions Column Placeholder */}
      <div className="flex items-center p-2 border-s bg-slate-100/50 min-w-[100px]">
        <span className="text-xs font-medium text-slate-500">
          {t('assignments.headers.actions', 'عملیات')}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// SubjectHeaderCell Sub-component
// ============================================================================

interface SubjectHeaderCellProps {
  subject: Subject;
  onClick?: () => void;
  compact?: boolean;
}

function SubjectHeaderCell({ subject, onClick, compact = false }: SubjectHeaderCellProps) {
  const { t } = useTranslation();
  const hasSpecialRoom = requiresSpecialRoom(subject);

  const cellContent = (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-md border bg-white',
        'transition-all hover:shadow-sm',
        onClick && 'cursor-pointer hover:border-purple-300',
        compact ? 'w-10 h-10 p-1' : 'w-12 h-12 p-1.5'
      )}
      onClick={onClick}
    >
      <span className="text-[10px] font-medium text-slate-700 truncate max-w-full">
        {getSubjectAbbreviation(subject.name)}
      </span>
      {hasSpecialRoom && (
        <Badge variant="outline" className="h-3 px-0.5 text-[8px] mt-0.5">
          {t('assignments.specialRoom', 'خاص')}
        </Badge>
      )}
    </div>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{cellContent}</TooltipTrigger>
      <TooltipContent side="top">
        <div className="space-y-1">
          <p className="font-medium">{subject.name}</p>
          {subject.code && <p className="text-xs text-slate-400">{subject.code}</p>}
          {hasSpecialRoom && (
            <p className="text-xs text-amber-600">
              {t('assignments.requiresRoom', 'نیاز به {{room}}', {
                room: subject.requiredRoomType,
              })}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export default SubjectColumnHeader;
