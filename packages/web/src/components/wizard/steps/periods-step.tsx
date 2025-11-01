import React, { useState, useEffect, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { WizardStepContainer } from "@/components/wizard/shared/wizard-step-container"
import { useLanguage } from "@/hooks/useLanguage"
import { Clock, Coffee, Minus, CheckCircle2, Info } from "lucide-react"
import { cn } from "@/lib/utils/tailwaindMergeUtil"
import { SchoolInfo } from "@/types"

interface PeriodsStepProps {
  data: {
    periodsPerDay: number
    periodDuration: number
    schoolStartTime: string
    periods: any[]
    breakPeriods: number[]
  }
  schoolInfo: SchoolInfo
  onUpdate: (data: any) => void
}

const DURATION_OPTIONS = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90]

// Helper to calculate time
function addMinutes(time: string, minutes: number): string {
  const [hours, mins] = time.split(':').map(Number)
  const totalMinutes = hours * 60 + mins + minutes
  const newHours = Math.floor(totalMinutes / 60) % 24
  const newMins = totalMinutes % 60
  return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':')
  return `${hours}:${minutes}`
}

export function PeriodsStep({ data, schoolInfo, onUpdate }: PeriodsStepProps) {
  const useSectionOverrides = !!(
    schoolInfo.primaryPeriodDuration || schoolInfo.primaryStartTime || schoolInfo.primaryPeriodsPerDay ||
    schoolInfo.middlePeriodDuration || schoolInfo.middleStartTime || schoolInfo.middlePeriodsPerDay ||
    schoolInfo.highPeriodDuration || schoolInfo.highStartTime || schoolInfo.highPeriodsPerDay
  )
  const [selectedSection, setSelectedSection] = React.useState<'PRIMARY' | 'MIDDLE' | 'HIGH'>(() => {
    if (useSectionOverrides) {
      if (schoolInfo.enablePrimary) return 'PRIMARY'
      if (schoolInfo.enableMiddle) return 'MIDDLE'
      if (schoolInfo.enableHigh) return 'HIGH'
    }
    return 'PRIMARY'
  })

  const initialDuration = useSectionOverrides
    ? (selectedSection === 'PRIMARY' ? (schoolInfo.primaryPeriodDuration || data.periodDuration) : selectedSection === 'MIDDLE' ? (schoolInfo.middlePeriodDuration || data.periodDuration) : (schoolInfo.highPeriodDuration || data.periodDuration))
    : data.periodDuration
  const initialStart = useSectionOverrides
    ? (selectedSection === 'PRIMARY' ? (schoolInfo.primaryStartTime || data.schoolStartTime) : selectedSection === 'MIDDLE' ? (schoolInfo.middleStartTime || data.schoolStartTime) : (schoolInfo.highStartTime || data.schoolStartTime))
    : data.schoolStartTime

  const [periodDuration, setPeriodDuration] = useState(initialDuration || 45)
  const [schoolStartTime, setSchoolStartTime] = useState(initialStart || "08:00")
  const { isRTL, t } = useLanguage()

  // Use values from schoolInfo (set in School Info step)
  const periodsPerDay = useSectionOverrides
    ? (selectedSection === 'PRIMARY'
        ? (schoolInfo.primaryPeriodsPerDay || schoolInfo.periodsPerDay || 7)
        : selectedSection === 'MIDDLE'
          ? (schoolInfo.middlePeriodsPerDay || schoolInfo.periodsPerDay || 7)
          : (schoolInfo.highPeriodsPerDay || schoolInfo.periodsPerDay || 7))
    : (schoolInfo.periodsPerDay || 7)
  const breakPeriods = useSectionOverrides
    ? (selectedSection === 'PRIMARY'
        ? (schoolInfo.primaryBreakPeriods || schoolInfo.breakPeriods || [])
        : selectedSection === 'MIDDLE'
          ? (schoolInfo.middleBreakPeriods || schoolInfo.breakPeriods || [])
          : (schoolInfo.highBreakPeriods || schoolInfo.breakPeriods || [])) as any
    : (schoolInfo.breakPeriods || [])

  // Keep timing in sync with School Info when overrides/common change or section preview switches
  useEffect(() => {
    const nextDuration = useSectionOverrides
      ? (selectedSection === 'PRIMARY' ? (schoolInfo.primaryPeriodDuration || data.periodDuration) : selectedSection === 'MIDDLE' ? (schoolInfo.middlePeriodDuration || data.periodDuration) : (schoolInfo.highPeriodDuration || data.periodDuration))
      : (data.periodDuration)
    const nextStart = useSectionOverrides
      ? (selectedSection === 'PRIMARY' ? (schoolInfo.primaryStartTime || data.schoolStartTime) : selectedSection === 'MIDDLE' ? (schoolInfo.middleStartTime || data.schoolStartTime) : (schoolInfo.highStartTime || data.schoolStartTime))
      : (data.schoolStartTime)
    if ((nextDuration || 45) !== periodDuration) setPeriodDuration(nextDuration || 45)
    if ((nextStart || "08:00") !== schoolStartTime) setSchoolStartTime(nextStart || "08:00")
  }, [useSectionOverrides, selectedSection, schoolInfo.primaryPeriodDuration, schoolInfo.middlePeriodDuration, schoolInfo.highPeriodDuration, schoolInfo.primaryStartTime, schoolInfo.middleStartTime, schoolInfo.highStartTime, data.periodDuration, data.schoolStartTime])

  // Calculate periods dynamically
  const calculatedPeriods = useMemo(() => {
    const periods = []
    let currentTime = schoolStartTime

    for (let i = 0; i < periodsPerDay; i++) {
      const isBreak = breakPeriods.includes(i + 1) // breakPeriods uses 1-indexed
      periods.push({
        index: i,
        startTime: currentTime,
        endTime: addMinutes(currentTime, periodDuration),
        isBreak: isBreak
      })
      
      // Move to next period start time
      currentTime = addMinutes(currentTime, periodDuration)
    }

    return periods
  }, [periodsPerDay, periodDuration, schoolStartTime, breakPeriods])

  const payload = useMemo(() => ({
    periodsPerDay,
    periodDuration,
    schoolStartTime,
    periods: calculatedPeriods,
    breakPeriods,
  }), [periodsPerDay, periodDuration, schoolStartTime, calculatedPeriods, breakPeriods])

  useEffect(() => {
    try {
      const current = JSON.stringify(data || {})
      const next = JSON.stringify(payload)
      if (current !== next) {
        onUpdate(payload)
      }
    } catch {
      onUpdate(payload)
    }
  }, [payload, data, onUpdate])

  // Calculate total hours
  const totalHours = Math.round((periodsPerDay * periodDuration - breakPeriods.length * periodDuration) / 60 * 10) / 10
  const totalBreakMinutes = breakPeriods.length * periodDuration

  return (
    <div className="space-y-6 max-w-6xl mx-auto" dir={isRTL ? "rtl" : "ltr"}>
      {/* Read-only summary from School Info */}
      <Card className="p-4 bg-blue-50 dark:bg-blue-950 border-blue-200">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
              Schedule Configuration (from School Info)
            </h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-blue-700 dark:text-blue-300 font-medium">Days per week:</span>
                <span className="ml-2 font-bold">{schoolInfo.daysPerWeek}</span>
              </div>
              <div>
                <span className="text-blue-700 dark:text-blue-300 font-medium">Periods per day:</span>
                <span className="ml-2 font-bold">{periodsPerDay}</span>
              </div>
              <div>
                <span className="text-blue-700 dark:text-blue-300 font-medium">Break periods:</span>
                <span className="ml-2 font-bold">{(breakPeriods as any).length > 0 ? (breakPeriods as any).join(', ') : 'None'}</span>
              </div>
              {useSectionOverrides && (
                <div className="col-span-3 text-xs text-blue-700 dark:text-blue-300 flex items-center gap-3">
                  <span>Preview section:</span>
                  <div className="inline-flex rounded-md overflow-hidden border">
                    {(['PRIMARY','MIDDLE','HIGH'] as const).map(sec => (
                      <button
                        key={sec}
                        type="button"
                        disabled={(sec === 'PRIMARY' && !schoolInfo.enablePrimary) || (sec === 'MIDDLE' && !schoolInfo.enableMiddle) || (sec === 'HIGH' && !schoolInfo.enableHigh)}
                        onClick={() => setSelectedSection(sec)}
                        className={cn(
                          "px-3 py-1 text-xs border-r last:border-r-0",
                          selectedSection === sec ? "bg-blue-100 text-blue-700" : "bg-white hover:bg-gray-50"
                        )}
                      >
                        {sec}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Configuration Card */}
      <WizardStepContainer
        title={t.periods.title || "Period Timing"}
        description="Configure start time and duration for each period"
        icon={<Clock className="h-6 w-6 text-blue-600" />}
        isRTL={isRTL}
      >
        <div className="grid grid-cols-2 gap-6">
          {/* School Start Time */}
          <div className="space-y-2">
            <Label htmlFor="schoolStartTime" className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              School Start Time <span className="text-red-500">*</span>
            </Label>
            <Input
              id="schoolStartTime"
              type="time"
              value={schoolStartTime}
              onChange={(e) => setSchoolStartTime(e.target.value)}
              className="h-11 text-base"
            />
            <p className="text-xs text-gray-500">
              When does the first period start?
            </p>
          </div>

          {/* Period Duration */}
          <div className="space-y-2">
            <Label htmlFor="periodDuration" className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {t.periods.duration || "Duration (minutes)"} <span className="text-red-500">*</span>
            </Label>
            <select
              id="periodDuration"
              value={periodDuration}
              onChange={(e) => setPeriodDuration(Number(e.target.value))}
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-all"
            >
              {DURATION_OPTIONS.map(duration => (
                <option key={duration} value={duration}>
                  {duration} min
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500">
              How long is each period?
            </p>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 bg-blue-50 dark:bg-blue-950 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Total Hours</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{totalHours}h</p>
              </div>
              <Clock className="h-8 w-8 text-blue-400" />
            </div>
          </Card>
          
          <Card className="p-4 bg-green-50 dark:bg-green-950 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-600 dark:text-green-400 font-medium">Break Time</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                  {Math.round(totalBreakMinutes / 60 * 10) / 10}h
                </p>
              </div>
              <Coffee className="h-8 w-8 text-green-400" />
            </div>
          </Card>

          <Card className="p-4 bg-purple-50 dark:bg-purple-950 border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">End Time</p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                  {formatTime(calculatedPeriods[calculatedPeriods.length - 1]?.endTime || "00:00")}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-purple-400" />
            </div>
          </Card>
        </div>
      </WizardStepContainer>

      {/* Dynamic Period List */}
      <WizardStepContainer
        title="Daily Schedule Preview"
        description="Preview of your complete daily schedule"
        icon={<CheckCircle2 className="h-5 w-5 text-blue-600" />}
        isRTL={isRTL}
      >
        <div className="space-y-2">
          {calculatedPeriods.map((period, idx) => {
            const isBreak = breakPeriods.includes(period.index + 1)
            
            return (
              <div
                key={period.index}
                className={cn(
                  "flex items-center justify-between p-4 rounded-lg border-2 transition-all",
                  isBreak
                    ? "border-orange-200 bg-orange-50 dark:bg-orange-950"
                    : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "flex items-center justify-center w-12 h-12 rounded-full font-bold text-lg",
                    isBreak
                      ? "bg-orange-500 text-white"
                      : "bg-blue-500 text-white"
                  )}>
                    P{period.index + 1}
                  </div>
                  
                  <div>
                    <p className={cn(
                      "font-semibold text-lg",
                      isBreak
                        ? "text-orange-900 dark:text-orange-100"
                        : "text-gray-900 dark:text-gray-100"
                    )}>
                      {formatTime(period.startTime)} - {formatTime(period.endTime)}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Duration: {periodDuration} minutes
                    </p>
                  </div>
                </div>

                {isBreak && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-orange-100 dark:bg-orange-900 rounded-full">
                    <Coffee className="h-4 w-4 text-orange-600" />
                    <span className="text-sm font-medium text-orange-800 dark:text-orange-200">
                      Break
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Timeline visualization */}
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Timeline Overview
          </p>
          <div className="relative">
            <div className="flex gap-1 overflow-x-auto pb-2">
              {calculatedPeriods.map((period) => {
                const isBreak = breakPeriods.includes(period.index + 1)
                return (
                  <div
                    key={period.index}
                    className={cn(
                      "flex-shrink-0 rounded-lg p-2 text-center min-w-[80px] transition-all",
                      isBreak
                        ? "bg-orange-200 dark:bg-orange-900"
                        : "bg-blue-200 dark:bg-blue-900"
                    )}
                  >
                    <p className="text-xs font-bold">
                      P{period.index + 1}
                    </p>
                    <p className="text-xs mt-1">
                      {formatTime(period.startTime)}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </WizardStepContainer>
    </div>
  )
}