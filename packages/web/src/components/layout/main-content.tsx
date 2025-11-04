import React from "react";
import { cn } from "@/lib/utils/tailwaindMergeUtil";
import { Breadcrumb } from "./breadcrumb";

interface MainContentProps {
  title?: string;
  breadcrumbItems?: { label: string; href?: string }[];
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function MainContent({
  title,
  breadcrumbItems,
  actions,
  children,
  className,
}: MainContentProps) {
  return (
    <section className={cn("flex w-full flex-col gap-4", className)}>
      {(title || breadcrumbItems || actions) && (
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between py-3 border-b">
          <div className="flex min-w-0 flex-col gap-1">
            {breadcrumbItems && breadcrumbItems.length > 0 && (
              <Breadcrumb items={breadcrumbItems} className="text-xs" />
            )}
            {title && <h1 className="truncate text-2xl font-semibold leading-tight">{title}</h1>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
          </div>
        </div>
      )}
      <div className="min-h-[60vh]">
        {children}
      </div>
    </section>
  );
}


