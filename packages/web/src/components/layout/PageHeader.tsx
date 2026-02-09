// packages/web/src/components/layout/PageHeader.tsx

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  /** Icon component from lucide-react */
  icon: LucideIcon;
  /** Page title (i18n key result) */
  title: string;
  /** Page subtitle (i18n key result) */
  subtitle: string;
  /** Action buttons to render on the right side */
  actions?: ReactNode;
}

export function PageHeader({ icon: Icon, title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm px-4 sm:px-6 py-3 sm:py-4">
      <div className="flex items-center justify-between gap-4">
        {/* Title Section */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-linear-to-br from-[#003366] to-[#004488] flex items-center justify-center shadow-lg shrink-0">
            <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-[#003366] truncate">{title}</h1>
            <p className="text-muted-foreground text-xs sm:text-sm truncate">{subtitle}</p>
          </div>
        </div>

        {/* Actions Section */}
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
