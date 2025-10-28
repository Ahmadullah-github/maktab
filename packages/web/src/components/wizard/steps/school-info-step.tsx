import React, { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { WizardStepContainer } from "@/components/wizard/shared/wizard-step-container"
import { useLanguage } from "@/hooks/useLanguage"
import { School, Globe, Clock, Calendar } from "lucide-react"
import { cn } from "@/lib/utils/tailwaindMergeUtil"
import { z } from "zod"
import { schoolInfoFormSchema } from "@/schemas/wizardSchema"

interface SchoolInfoStepProps {
  data: {
    schoolName: string
    timezone: string
    startTime: string
    workingDays: string[]
  }
  onUpdate: (data: any) => void
}

const TIMEZONES = [
  { value: "Asia/Kabul", label: "Asia/Kabul (Afghanistan)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (UAE)" },
  { value: "Asia/Tehran", label: "Asia/Tehran (Iran)" },
  { value: "Asia/Karachi", label: "Asia/Karachi (Pakistan)" },
  { value: "Asia/Dhaka", label: "Asia/Dhaka (Bangladesh)" },
]

const DAYS_OF_WEEK = [
  { value: "Monday", label: "Mon" },
  { value: "Tuesday", label: "Tue" },
  { value: "Wednesday", label: "Wed" },
  { value: "Thursday", label: "Thu" },
  { value: "Friday", label: "Fri" },
  { value: "Saturday", label: "Sat" },
  { value: "Sunday", label: "Sun" },
]

export function SchoolInfoStep({ data, onUpdate }: SchoolInfoStepProps) {
  const [formData, setFormData] = useState(data)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({})
  const { isRTL, t } = useLanguage()

  useEffect(() => {
    setFormData(data)
  }, [data])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    const newData = { ...formData, [name]: value }
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

  const toggleDay = (day: string) => {
    const newDays = formData.workingDays.includes(day)
      ? formData.workingDays.filter(d => d !== day)
      : [...formData.workingDays, day]
    const newData = { ...formData, workingDays: newDays }
    setFormData(newData)
    onUpdate(newData)
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
        title={t.school.name || "School Name"}
        description={t.school.namePlaceholder || "Enter your school's basic information"}
        icon={<School className="h-6 w-6 text-blue-600" />}
        isRTL={isRTL}
      >
        <div className="grid grid-cols-2 gap-6">
          {/* School Name */}
          <div className="space-y-2 col-span-2">
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

          {/* Timezone */}
          <div className="space-y-2">
            <Label htmlFor="timezone" className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Globe className="h-4 w-4" />
              {t.school.timezone || "Timezone"} <span className="text-red-500">*</span>
            </Label>
            <select
              id="timezone"
              name="timezone"
              value={formData.timezone}
              onChange={handleChange}
              onBlur={() => handleBlur("timezone")}
              className={cn(
                "flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all",
                isFieldValid("timezone") && "border-green-500 ring-2 ring-green-200",
                isFieldInvalid("timezone") && "border-red-500 ring-2 ring-red-200"
              )}
            >
              {TIMEZONES.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
            {errors.timezone && touchedFields.timezone && (
              <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.timezone}
              </p>
            )}
          </div>

          {/* Start Time */}
          <div className="space-y-2">
            <Label htmlFor="startTime" className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {t.school.startTime || "School Start Time"} <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="startTime"
                name="startTime"
                type="time"
                value={formData.startTime}
                onChange={handleChange}
                onBlur={() => handleBlur("startTime")}
                className={cn(
                  "h-11 text-base pr-10 transition-all",
                  isFieldValid("startTime") && "border-green-500 ring-2 ring-green-200",
                  isFieldInvalid("startTime") && "border-red-500 ring-2 ring-red-200"
                )}
              />
              <Clock className="absolute top-1/2 -translate-y-1/2 right-3 h-5 w-5 text-gray-400 pointer-events-none" />
            </div>
            {errors.startTime && touchedFields.startTime && (
              <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errors.startTime}
              </p>
            )}
          </div>
        </div>
      </WizardStepContainer>

      {/* Working Days Card */}
      <WizardStepContainer
        title={t.school.workingDays || "Working Days"}
        description="Select the days your school operates throughout the week"
        icon={<Calendar className="h-5 w-5 text-blue-600" />}
        isRTL={isRTL}
      >
        <div className="grid grid-cols-7 gap-4">
          {DAYS_OF_WEEK.map((day) => {
            const isSelected = formData.workingDays.includes(day.value)
            return (
              <button
                key={day.value}
                type="button"
                onClick={() => toggleDay(day.value)}
                className={cn(
                  "flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200 transform hover:scale-105",
                  isSelected
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950 shadow-md"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center mb-2 transition-all",
                  isSelected
                    ? "bg-blue-500"
                    : "bg-gray-200 dark:bg-gray-700"
                )}>
                  {isSelected && (
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className={cn(
                  "text-sm font-medium",
                  isSelected
                    ? "text-blue-700 dark:text-blue-300"
                    : "text-gray-700 dark:text-gray-300"
                )}>
                  {day.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Selected days summary */}
        {formData.workingDays.length > 0 && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
              Selected Days: {formData.workingDays.length}
            </p>
            <div className="flex flex-wrap gap-2">
              {formData.workingDays.map(day => (
                <Badge key={day} variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  {day}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </WizardStepContainer>
    </div>
  )
}