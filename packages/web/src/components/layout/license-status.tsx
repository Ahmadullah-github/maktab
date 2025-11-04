import React from "react";
import { cn } from "@/lib/utils/tailwaindMergeUtil";
import { Badge } from "@/components/ui/badge";
import { useLanguageCtx } from "@/i18n/provider";
import { Shield, Clock, AlertTriangle, CheckCircle } from "lucide-react";

interface LicenseStatusProps {
  className?: string;
}

export function LicenseStatus({ className }: LicenseStatusProps) {
  const { t, isRTL } = useLanguageCtx();
  
  // Mock license data - replace with real API
  const licenseInfo = {
    type: "annual", // 'annual', 'semiannual', 'trial'
    status: "active", // 'active', 'expiring', 'expired'
    expiresIn: 45, // days until expiration
    school: "Kabul High School"
  };

  const getLicenseConfig = () => {
    const base = {
      annual: { label: isRTL ? "سالانه" : "Annual", color: "text-blue-600" },
      semiannual: { label: isRTL ? "شش ماهه" : "6-Month", color: "text-green-600" },
      trial: { label: isRTL ? "آزمایشی" : "Trial", color: "text-orange-600" }
    };

    const statusIcons = {
      active: { icon: CheckCircle, color: "text-green-600", badge: "default" },
      expiring: { icon: Clock, color: "text-orange-600", badge: "secondary" },
      expired: { icon: AlertTriangle, color: "text-red-600", badge: "destructive" }
    };

    return {
      ...base[licenseInfo.type],
      ...statusIcons[licenseInfo.status]
    };
  };

  const config = getLicenseConfig();
  const StatusIcon = config.icon;

  return (
    <div
      className={cn(
        "flex flex-row items-center gap-3 px-3 py-1 rounded-lg border bg-background",
        isRTL && "flex-row",
        className
      )}
    >
      <div className="flex flex-row items-center gap-2">
        <Shield className={cn("h-4 w-4", config.color)} />
        <div className={cn("flex flex-row gap-2 items-center")}>
          <span className="text-xs text-muted-foreground">
            {isRTL ? "مجوز" : "License"}
          </span>
          <span className="text-sm font-medium">{config.label}</span>
        </div>
      </div>

      <div className="w-px h-4 bg-border" />

      <div className="flex items-center gap-2">
        <StatusIcon className={cn("h-4 w-4", config.color)} />
        <div className={cn("flex flex-row gap-2 items-center")}>
          <span className="text-xs text-muted-foreground">
            {isRTL ? "وضعیت" : "Status"}
          </span>
          <div className="flex items-center gap-1">
            <Badge variant={config.badge as any} className="text-xs">
              {licenseInfo.status === "expiring" 
                ? `${licenseInfo.expiresIn} ${isRTL ? "روز" : "days"}`
                : isRTL ? "فعال" : "Active"
              }
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}