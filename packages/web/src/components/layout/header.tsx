import React from "react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/hooks/useLanguage"
import { Languages } from "lucide-react"
import { cn } from "@/lib/utils/tailwaindMergeUtil"

export function Header() {
  const { isRTL, language, toggleLanguage } = useLanguage()

  return (
    <header className="border-b">
      <div className={cn("flex h-16 items-center px-6", isRTL && "flex-row-reverse")}>
        <div className={cn("flex items-center gap-2", isRTL && "ml-auto")}>
          <h1 className="text-xl font-bold">Maktab Timetable Generator</h1>
        </div>
        <div className={cn("flex items-center gap-4", isRTL ? "mr-auto" : "ml-auto")}>
          <Button 
            variant="ghost" 
            onClick={toggleLanguage}
            className="flex items-center gap-2"
          >
            <Languages className="h-4 w-4" />
            {language === 'en' ? 'Dari' : 'English'}
          </Button>
          <Button variant="ghost">Settings</Button>
          <Button variant="ghost">Profile</Button>
        </div>
      </div>
    </header>
  )
}