import { categoryLabelKey, type IssueAction } from '@/features/schedule/errors/issuePresentation';
import { cn } from '@/lib/utils';
import type {
  IssueCategory,
  OperationAffectedEntity,
  OperationIssue,
} from '@/types/operation';
import {
  AlertTriangle,
  BookOpen,
  DoorOpen,
  GraduationCap,
  Link2,
  Settings,
  ShieldAlert,
  User,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ErrorItem } from './ErrorItem';

export interface ErrorGroupProps {
  category: IssueCategory;
  errors: OperationIssue[];
  onEntityClick: (entity: OperationAffectedEntity) => void;
  onQuickAction?: (action: IssueAction) => void;
  className?: string;
}

const CATEGORY_ICONS: Record<IssueCategory, React.ComponentType<{ className?: string }>> = {
  assignment: Link2,
  teacher: User,
  class: GraduationCap,
  subject: BookOpen,
  room: DoorOpen,
  configuration: Settings,
  solver: AlertTriangle,
  system: ShieldAlert,
};

export function ErrorGroup({
  category,
  errors,
  onEntityClick,
  onQuickAction,
  className,
}: ErrorGroupProps) {
  const { t } = useTranslation();
  const Icon = CATEGORY_ICONS[category];
  if (errors.length === 0) return null;

  return (
    <section className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
        <Icon className="size-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold">{t(categoryLabelKey(category))}</h4>
        <span className="ms-auto rounded-full bg-background px-2 py-0.5 text-xs">{errors.length}</span>
      </div>
      <div className="space-y-2 ps-2">
        {errors.map((error, index) => (
          <ErrorItem
            key={`${error.code}-${index}`}
            error={error}
            onEntityClick={onEntityClick}
            onQuickAction={onQuickAction}
          />
        ))}
      </div>
    </section>
  );
}
