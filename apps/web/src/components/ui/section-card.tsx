/**
 * SectionCard Component
 *
 * Reusable card component for settings/configuration sections.
 * Used across school-settings, periods, and other configuration pages.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ElementType, ReactNode } from 'react';

export interface SectionCardProps {
  /** Icon component to display */
  icon: ElementType;
  /** Tailwind classes for icon background color */
  iconColor: string;
  /** Card title */
  title: string;
  /** Card description */
  description: string;
  /** Optional badge to display next to title */
  badge?: ReactNode;
  /** Optional action button/element */
  action?: ReactNode;
  /** Card content */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
}

export function SectionCard({
  icon: Icon,
  iconColor,
  title,
  description,
  badge,
  action,
  children,
  className,
}: SectionCardProps) {
  return (
    <Card
      className={cn(
        'border-2 border-border/50 shadow-sm hover:shadow-md transition-all duration-200',
        className
      )}
    >
      <CardHeader className="pb-4 bg-linear-to-r from-gray-50 to-slate-50 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center shadow-md',
                iconColor
              )}
            >
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold text-gray-800">{title}</CardTitle>
                {badge}
              </div>
              <CardDescription className="text-sm text-gray-600">{description}</CardDescription>
            </div>
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent className="pt-5 pb-6">{children}</CardContent>
    </Card>
  );
}

export default SectionCard;
