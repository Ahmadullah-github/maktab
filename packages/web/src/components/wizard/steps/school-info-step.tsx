import React, { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { WizardStepContainer } from "@/components/wizard/shared/wizard-step-container"
import { useLanguage } from "@/hooks/useLanguage"
import { School, Layers, Calendar, ListChecks } from "lucide-react"
import { cn } from "@/lib/utils/tailwaindMergeUtil"
import { z } from "zod"
import { schoolInfoFormSchema } from "@/schemas/wizardSchema"

interface SchoolInfoStepProps {
  data: {
    schoolName: string
    enablePrimary: boolean
    enableMiddle: boolean
    enableHigh: boolean
    daysPerWeek: number
    periodsPerDay: number
    breakPeriods: number[]
    // Optional per-section overrides
    primaryPeriodsPerDay?: number | null
    primaryPeriodDuration?: number | null
    primaryStartTime?: string | null
    primaryBreakPeriods?: number[] | null
    middlePeriodsPerDay?: number | null
    middlePeriodDuration?: number | null
    middleStartTime?: string | null
    middleBreakPeriods?: number[] | null
    highPeriodsPerDay?: number | null
    highPeriodDuration?: number | null
    highStartTime?: string | null
    highBreakPeriods?: number[] | null
  }
  onUpdate: (data: any) => void
}

const PERIOD_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1)

export function SchoolInfoStep({ data, onUpdate }: SchoolInfoStepProps) {
  const [formData, setFormData] = useState(data)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({})
  const { isRTL, t } = useLanguage()
  const [useSectionOverrides, setUseSectionOverrides] = useState<boolean>(true)

  const didInitRef = useRef(false)

  useEffect(() => {
    // Prefill reasonable defaults for section overrides if missing
    if (!didInitRef.current) {
      const next: any = { ...data }
      const ensure = (
        keyPd: string,
        keyDur: string,
        keyStart: string,
        keyBreaks: string
      ) => {
        if (next[keyPd] == null) next[keyPd] = next.periodsPerDay ?? 7
        if (next[keyDur] == null) next[keyDur] = 45
        if (next[keyStart] == null) next[keyStart] = "08:00"
        if (next[keyBreaks] == null) next[keyBreaks] = Array.isArray(next.breakPeriods) ? next.breakPeriods : []
      }
      ensure('primaryPeriodsPerDay','primaryPeriodDuration','primaryStartTime','primaryBreakPeriods')
      ensure('middlePeriodsPerDay','middlePeriodDuration','middleStartTime','middleBreakPeriods')
      ensure('highPeriodsPerDay','highPeriodDuration','highStartTime','highBreakPeriods')

      setFormData(next)
      setUseSectionOverrides(true)
      const changed = JSON.stringify(next) !== JSON.stringify(data)
      if (changed) onUpdate(next)
      didInitRef.current = true
      return
    }
    // Subsequent updates: sync without forcing Separate
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

  const toggleBreak = (idx: number) => {
    const selected = new Set(formData.breakPeriods)
    if (selected.has(idx)) selected.delete(idx)
    else selected.add(idx)
    const newData = { ...formData, breakPeriods: Array.from(selected).sort((a,b)=>a-b) }
    setFormData(newData)
    onUpdate(newData)
  }

  const toggleSectionBreak = (sectionKey: 'primary' | 'middle' | 'high', idx: number) => {
    const key = `${sectionKey}BreakPeriods` as const
    const current = (formData as any)[key] as number[] | null | undefined
    const arr = Array.isArray(current) ? current.slice() : []
    const i = arr.indexOf(idx)
    if (i >= 0) arr.splice(i,1); else arr.push(idx)
    const newData: any = { ...formData, [key]: arr.sort((a,b)=>a-b) }
    setFormData(newData)
    onUpdate(newData)
  }

  const renderSectionCard = (
    sectionKey: 'primary' | 'middle' | 'high',
    title: string,
    enabled: boolean,
  ) => {
    const periodsPerDayKey = `${sectionKey}PeriodsPerDay`
    const periodDurationKey = `${sectionKey}PeriodDuration`
    const startTimeKey = `${sectionKey}StartTime`
    const breakKey = `${sectionKey}BreakPeriods`
    const sectionPeriodsPerDay = (formData as any)[periodsPerDayKey] as number | null | undefined
    const sectionPeriodDuration = (formData as any)[periodDurationKey] as number | null | undefined
    const sectionStartTime = (formData as any)[startTimeKey] as string | null | undefined
    const sectionBreaks = (formData as any)[breakKey] as number[] | null | undefined
    return (
      <Card key={sectionKey}>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>
            {enabled ? 'Configure overrides for this section' : 'Section disabled'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Periods per day (override)</Label>
              <select
                name={periodsPerDayKey}
                value={(sectionPeriodsPerDay ?? '') as any}
                onChange={(e) => {
                  const v = e.target.value === '' ? null : Number(e.target.value)
                  const newData: any = { ...formData, [periodsPerDayKey]: v }
                  setFormData(newData); onUpdate(newData)
                }}
                className="h-11 px-3 border rounded-md"
                disabled={!enabled || !useSectionOverrides}
              >
                <option value="">Inherit ({formData.periodsPerDay} per day)</option>
                {PERIOD_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Period duration (min)</Label>
              <Input
                type="number"
                name={periodDurationKey}
                value={(sectionPeriodDuration ?? '') as any}
                onChange={(e)=>{
                  const v = e.target.value === '' ? null : Number(e.target.value)
                  const newData: any = { ...formData, [periodDurationKey]: v }
                  setFormData(newData); onUpdate(newData)
                }}
                placeholder="e.g. 45"
                disabled={!enabled || !useSectionOverrides}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Start time</Label>
              <Input
                type="time"
                name={startTimeKey}
                value={(sectionStartTime ?? '') as any}
                onChange={(e)=>{
                  const v = e.target.value === '' ? null : e.target.value
                  const newData: any = { ...formData, [startTimeKey]: v }
                  setFormData(newData); onUpdate(newData)
                }}
                disabled={!enabled || !useSectionOverrides}
              />
            </div>
            <div className="space-y-2 col-span-3">
              <Label className="text-sm font-semibold flex items-center gap-2"><ListChecks className="h-4 w-4"/>Break periods (override)</Label>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: Number(sectionPeriodsPerDay ?? formData.periodsPerDay) || 0 }, (_, i) => i + 1).map(p => {
                  const selected = Array.isArray(sectionBreaks) && sectionBreaks.includes(p)
                  return (
                    <button
                      key={`${sectionKey}-p-${p}`}
                      type="button"
                      onClick={() => toggleSectionBreak(sectionKey, p)}
                      disabled={!enabled || !useSectionOverrides}
                      className={cn(
                        "px-3 py-2 rounded-md border text-sm",
                        selected ? "bg-amber-100 border-amber-300" : "bg-white"
                      )}
                    >
                      P{p}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
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
        <div className="grid gap-6">
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

          {/* Sections modern switches (enabled sections only) */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Sections</Label>
            <div className="flex gap-3 " >
              {[
                { key: 'enablePrimary', label: 'Primary (1–6)' },
                { key: 'enableMiddle', label: 'Middle (7–9)' },
                { key: 'enableHigh', label: 'High (10–12)' },
              ].map(({ key, label }) => (
                <div key={key} style={{width:'330px'}} className="flex items-center justify-between rounded-md border p-3 bg-white dark:bg-gray-900">
                  <span className="text-sm font-medium">{label}</span>
                  <Switch
                    checked={(formData as any)[key]}
                    onCheckedChange={(checked) => {
                      const newData: any = { ...formData, [key]: checked }
                      setFormData(newData); onUpdate(newData)
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </WizardStepContainer>

      {/* Schedule Structure (hidden when using section overrides) */}
      {!useSectionOverrides && (
      <WizardStepContainer
          title="Schedule Structure"
          description="Set days per week, periods per day, and breaks"
        icon={<Calendar className="h-5 w-5 text-blue-600" />}
        isRTL={isRTL}
      >
          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="daysPerWeek" className="text-sm font-semibold">Days per week</Label>
              <select id="daysPerWeek" name="daysPerWeek" value={formData.daysPerWeek as any} onChange={handleChange} className="h-11 px-3 border rounded-md">
                {[5,6,7].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="periodsPerDay" className="text-sm font-semibold">Periods per day</Label>
              <select id="periodsPerDay" name="periodsPerDay" value={formData.periodsPerDay as any} onChange={handleChange} className="h-11 px-3 border rounded-md">
                {Array.from({ length: 12 }, (_, i) => i + 1).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="space-y-2 col-span-3">
              <Label className="text-sm font-semibold flex items-center gap-2"><ListChecks className="h-4 w-4"/>Break periods</Label>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: Number(formData.periodsPerDay) || 0 }, (_, i) => i + 1).map(p => {
                  const selected = (formData.breakPeriods as any)?.includes(p)
            return (
                    <button key={p} type="button" onClick={() => toggleBreak(p)} className={cn(
                      "px-3 py-2 rounded-md border text-sm",
                      selected ? "bg-amber-100 border-amber-300" : "bg-white"
                    )}>
                      P{p}
              </button>
            )
          })}
        </div>
            </div>
          </div>
        </WizardStepContainer>
      )}

      {/* Section-specific Overrides */}
      <WizardStepContainer
        title="Section-specific schedule overrides"
        description="Optionally override periods/day, duration, start time and breaks per section"
        icon={<Layers className="h-5 w-5 text-blue-600" />}
        isRTL={isRTL}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-gray-600">Use separate schedule per section</div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">Same for all</span>
            <Switch
              checked={useSectionOverrides}
              onCheckedChange={(checked) => {
                // Only update the toggle state, don't clear the data
                // Data is preserved so it can be restored when toggling back
                setUseSectionOverrides(checked)
                // When enabling, restore defaults if all values are null
                if (checked) {
                  const needsDefaults = !formData.primaryPeriodsPerDay && !formData.primaryPeriodDuration && !formData.primaryStartTime &&
                                       !formData.middlePeriodsPerDay && !formData.middlePeriodDuration && !formData.middleStartTime &&
                                       !formData.highPeriodsPerDay && !formData.highPeriodDuration && !formData.highStartTime
                  if (needsDefaults) {
                    const next: any = { ...formData }
                    const ensure = (
                      keyPd: string,
                      keyDur: string,
                      keyStart: string,
                      keyBreaks: string
                    ) => {
                      if (next[keyPd] == null) next[keyPd] = next.periodsPerDay ?? 7
                      if (next[keyDur] == null) next[keyDur] = 45
                      if (next[keyStart] == null) next[keyStart] = "08:00"
                      if (next[keyBreaks] == null) next[keyBreaks] = Array.isArray(next.breakPeriods) ? next.breakPeriods : []
                    }
                    ensure('primaryPeriodsPerDay','primaryPeriodDuration','primaryStartTime','primaryBreakPeriods')
                    ensure('middlePeriodsPerDay','middlePeriodDuration','middleStartTime','middleBreakPeriods')
                    ensure('highPeriodsPerDay','highPeriodDuration','highStartTime','highBreakPeriods')
                    setFormData(next)
                    onUpdate(next)
                  }
                }
              }}
            />
            <span className="text-xs text-gray-800 font-medium">Separate</span>
          </div>
        </div>
        {useSectionOverrides && (
          <div className="grid grid-cols-1 gap-6">
            {formData.enablePrimary && renderSectionCard('primary', 'Primary (Grades 1–6)', formData.enablePrimary)}
            {formData.enableMiddle && renderSectionCard('middle', 'Middle (Grades 7–9)', formData.enableMiddle)}
            {formData.enableHigh && renderSectionCard('high', 'High (Grades 10–12)', formData.enableHigh)}
          </div>
        )}
        {!useSectionOverrides && (
          <div className="text-sm text-gray-600">All sections will use the common schedule above.</div>
        )}
      </WizardStepContainer>
    </div>
  )
}