

import React, { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils/tailwaindMergeUtil";
import { useLanguageCtx } from "@/i18n/provider";
import { getCalendarStrings } from "@/lib/calendar-converter";

interface DateTimeDisplayProps {
  className?: string;
}

export function DateTimeDisplay({ className }: DateTimeDisplayProps) {
  const { isRTL } = useLanguageCtx();
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const strings = useMemo(() => getCalendarStrings(now, isRTL), [now, isRTL]);

  return (
    <div
      className={cn(
        "flex items-center text-xs rounded-md border bg-background/60 backdrop-blur divide-x",
        isRTL ? "flex-row divide-x-reverse" : "flex-row",
        className
      )}
      title={`${strings.gregorian} • ${strings.jalali} • ${strings.hijri}`}
    >
      <span className="px-2 py-1 font-medium text-foreground">{strings.time}</span>
      <span className="px-2 py-1 text-muted-foreground">{strings.gregorian}</span>
      <span className="px-2 py-1 text-muted-foreground">{strings.jalali}</span>
      <span className="px-2 py-1 text-muted-foreground">{strings.hijri}</span>
    </div>
  );
}


