import React, { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { WizardStepContainer } from "@/components/wizard/shared/wizard-step-container"
import { useLanguageCtx } from "@/i18n/provider"
import { School, Users, Calendar } from "lucide-react"
import { cn } from "@/lib/utils/tailwaindMergeUtil"
import { z } from "zod"
import { schoolInfoFormSchema } from "@/schemas/wizardSchema"

import { BreakPeriodConfig } from "@/types"

interface SchoolInfoStepProps {
  data: {
    schoolName: string
    enablePrimary: boolean
    enableMiddle: boolean
    enableHigh: boolean
    daysPerWeek: number
    periodsPerDay: number
    breakPeriods: BreakPeriodConfig[]
  }
  onUpdate: (data: any) => void
}

const PERIOD_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1)

export function SchoolInfoStep({ data, onUpdate }: SchoolInfoStepProps) {
  const [formData, setFormData] = useState(data)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({})
  const { isRTL, t } = useLanguageCtx()

  // Sync with parent data
  useEffect(() => {
    setFormData(data)
  }, [data])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    const casted = name === 'daysPerWeek' || name === 'periodsPerDay' ? Number(value) : (value as any)
    const newData = { ...formData, [name]: casted }
    setFormData(newData)
    onUpdate(newData)
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  const handleSectionToggle = (section: 'enablePrimary' | 'enableMiddle' | 'enableHigh', checked: boolean) => {
    const newData: any = { ...formData, [section]: checked }
    setFormData(newData)
    onUpdate(newData)
  }

  const handleBlur = (fieldName: string) => {
    setTouchedFields(prev => ({ ...prev, [fieldName]: true }))
    
    try {
      schoolInfoFormSchema.parse(formData)
      setErrors({})
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {}
        error.errors.forEach(err => {
          if (err.path[0]) {
            fieldErrors[err.path[0]] = err.message
          }
        })
        setErrors(fieldErrors)
      }
    }
  }

  const isFieldValid = (fieldName: string) => {
    return !errors[fieldName] && touchedFields[fieldName]
  }

  const isFieldInvalid = (fieldName: string) => {
    return errors[fieldName] && touchedFields[fieldName]
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto" dir={isRTL ? "rtl" : "ltr"}>
      {/* School Information Card */}
      <WizardStepContainer
        title={t.school.name || "School Information"}
        description={t.school.basicDescription}
        icon={<School className="h-6 w-6 text-blue-600" />}
        isRTL={isRTL}
      >
        <div className="space-y-8">
          {/* School Name */}
          <div className="space-y-2">
            <Label htmlFor="schoolName" className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <School className="h-4 w-4" />
              {t.school.name || "School Name"} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="schoolName"
              name="schoolName"
              value={formData.schoolName}
              onChange={handleChange}
              onBlur={() => handleBlur("schoolName")}
              placeholder={t.school.namePlaceholder || "e.g. Springfield High School"}
              className={cn(
                "h-11 text-base transition-all",
                isFieldValid("schoolName") && "border-green-500 ring-2 ring-green-200",
                isFieldInvalid("schoolName") && "border-red-500 ring-2 ring-red-200"
              )}
            />
            {errors.schoolName && touchedFields.schoolName && (
              <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.schoolName}
              </p>
            )}
          </div>

          {/* Enabled Sections */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Users className="h-4 w-4" />
              {t.school.enabledSections}
            </Label>
            <p className="text-xs text-gray-500 mb-3">
              {t.school.enabledSectionsDescription}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { key: 'enablePrimary', label: t.school.primaryGrades, description: t.school.primaryDescription },
                { key: 'enableMiddle', label: t.school.middleGrades, description: t.school.middleDescription },
                { key: 'enableHigh', label: t.school.highGrades, description: t.school.highDescription },
              ].map(({ key, label, description }) => (
                <div key={key} className="flex items-center justify-between rounded-md border border-gray-200 p-4 bg-white dark:bg-gray-900 hover:border-blue-300 transition-colors">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-900">{label}</span>
                    <span className="text-xs text-gray-500">{description}</span>
                  </div>
                  <Switch
                    checked={(formData as any)[key]}
                    onCheckedChange={(checked) => handleSectionToggle(key as any, checked)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Schedule Framework */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {t.school.scheduleFramework}
            </Label>
            <p className="text-xs text-gray-500 mb-3">
              {t.school.scheduleFrameworkDescription}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Days per week */}
              <div className="space-y-2">
                <Label htmlFor="daysPerWeek" className="text-sm font-medium">{t.school.daysPerWeek}</Label>
                <select 
                  id="daysPerWeek" 
                  name="daysPerWeek" 
                  value={formData.daysPerWeek} 
                  onChange={handleChange}
                  className="h-11 px-3 border rounded-md w-full bg-white dark:bg-gray-900"
                >
                  {[5, 6, 7].map(d => (
                    <option key={d} value={d}>{d} {t.common.days || "days"}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">{t.school.daysPerWeekDescription}</p>
              </div>

              {/* Periods per day */}
              <div className="space-y-2">
                <Label htmlFor="periodsPerDay" className="text-sm font-medium">{t.school.periodsPerDay}</Label>
                <select 
                  id="periodsPerDay" 
                  name="periodsPerDay" 
                  value={formData.periodsPerDay} 
                  onChange={handleChange}
                  className="h-11 px-3 border rounded-md w-full bg-white dark:bg-gray-900"
                >
                  {PERIOD_OPTIONS.map(p => (
                    <option key={p} value={p}>{p} {t.common.periods || "periods"}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">{t.school.periodsPerDayDescription}</p>
              </div>
            </div>
          </div>
        </div>
      </WizardStepContainer>
    </div>
  )
}
