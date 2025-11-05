import React from "react"
import { Button } from "@/components/ui/button"
import { useLanguageCtx } from "@/i18n/provider"
import { Languages, Settings, User, School } from "lucide-react"
import { cn } from "@/lib/utils/tailwaindMergeUtil"
import { DateTimeDisplay } from "./date-time-display"
import { LicenseStatus } from "./license-status"

interface HeaderProps {
  onMenuToggle?: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const { isRTL, language, toggleLanguage, t } = useLanguageCtx()

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className={cn(
        "flex h-16 items-center justify-between px-4 lg:px-6",
        isRTL && "flex-row"
      )}>
        {/* Logo & Title Section */}
        <div className={cn(
          "flex items-center gap-3",
          isRTL ? "flex-row" : "flex-row"
        )}>
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-600">
            <School className="h-5 w-5 text-white" />
          </div>
          <div className={cn("flex flex-col", isRTL ? "items-end" : "items-start")}>
            <h1 className="text-lg font-bold text-foreground">
              {t.app?.title ?? "School Timetable Generator"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {t.app?.subtitle ?? "Afghan Education System"}
            </p>
          </div>
        </div>

        {/* Center Section - Info Displays */}
        <div className="hidden md:flex items-center gap-4">
          <DateTimeDisplay />
          <LicenseStatus />
        </div>

        {/* Right Section - Controls */}
        <div className={cn(
          "flex items-center gap-2",
          isRTL ? "flex-row" : "flex-row"
        )}>
          {/* Language Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleLanguage}
            className={cn(
              "gap-2 h-9",
              isRTL ? "flex-row" : "flex-row"
            )}
          >
            <Languages className="h-4 w-4" />
            <span>{language === 'en' ? 'دری' : 'English'}</span>
          </Button>

          {/* Settings
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            title={t.header?.settings ?? "Settings"}
          >
            <Settings className="h-4 w-4" />
          </Button> */}

          {/* Profile */}
          {/* <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            title={t.header?.profile ?? "Profile"}
          >
            <User className="h-4 w-4" />
          </Button> */}
        </div>
      </div>

      {/* Mobile Info Section */}
      <div className="md:hidden border-t">
        <div className="flex items-center justify-between px-4 py-2">
          <DateTimeDisplay />
          <LicenseStatus />
        </div>
      </div>
    </header>
  )
}
