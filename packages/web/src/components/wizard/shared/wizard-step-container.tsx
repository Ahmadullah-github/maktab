import React, { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils/tailwaindMergeUtil";

interface WizardStepContainerProps {
  title: string;
  description: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  isRTL?: boolean;
}

export function WizardStepContainer({
  title,
  description,
  icon,
  children,
  className,
  isRTL = false,
}: WizardStepContainerProps) {
  return (
    <Card
      className={cn(
        "border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 min-h-[300px]",
        className
      )}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <CardHeader className="pb-4 px-6 pt-6">
        <div className={cn("flex items-center gap-3", isRTL ? "flex-row-reverse" : "")}>
          {icon && (
            <div className="bg-blue-100 p-2 rounded-lg flex-shrink-0">
              {icon}
            </div>
          )}
          <div className={isRTL ? "text-right" : "text-left"}>
            <CardTitle className="text-xl font-semibold text-gray-800">{title}</CardTitle>
            <CardDescription className="text-gray-600 mt-1 text-base">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2 px-6 pb-6">{children}</CardContent>
    </Card>
  );
}
