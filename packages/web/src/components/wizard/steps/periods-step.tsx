import React, { useState, useEffect, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { WizardStepContainer } from "@/components/wizard/shared/wizard-step-container"
import { useLanguage } from "@/hooks/useLanguage"
import { Clock, Coffee, Minus, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils/tailwaindMergeUtil"

interface PeriodsStepProps {
  data: {
    periodsPerDay: number
    periodDuration: number
    schoolStartTime: string
    periods: any[]
    breakPeriods: number[]
  }
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

export function PeriodsStep({ data, onUpdate }: PeriodsStepProps) {
  const [periodsPerDay, setPeriodsPerDay] = useState(data.periodsPerDay || 6)
  const [periodDuration, setPeriodDuration] = useState(data.periodDuration || 45)
  const [breakPeriods, setBreakPeriods] = useState<number[]>(data.breakPeriods || [])
  const [schoolStartTime, setSchoolStartTime] = useState(data.schoolStartTime || "08:00")
  const { isRTL, t } = useLanguage()

  // Calculate periods dynamically
  const calculatedPeriods = useMemo(() => {
    const periods = []
    let currentTime = schoolStartTime

    for (let i = 0; i < periodsPerDay; i++) {
      const isBreak = breakPeriods.includes(i)
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

  useEffect(() => {
    onUpdate({
      periodsPerDay,
      periodDuration,
      schoolStartTime,
      periods: calculatedPeriods,
      breakPeriods,
    })
  }, [periodsPerDay, periodDuration, schoolStartTime, breakPeriods, calculatedPeriods])

  const toggleBreakPeriod = (index: number) => {
    if (breakPeriods.includes(index)) {
      setBreakPeriods(breakPeriods.filter(i => i !== index))
    } else {
      setBreakPeriods([...breakPeriods, index].sort((a, b) => a - b))
    }
  }

  // Calculate total hours
  const totalHours = Math.round((periodsPerDay * periodDuration - breakPeriods.length * periodDuration) / 60 * 10) / 10
  const totalBreakMinutes = breakPeriods.length * periodDuration

  return (
    <div className="space-y-6 max-w-6xl mx-auto" dir={isRTL ? "rtl" : "ltr"}>
      {/* Configuration Card */}
      <WizardStepContainer
        title={t.periods.title || "Period Configuration"}
        description="Configure your daily class schedule structure"
        icon={<Clock className="h-6 w-6 text-blue-600" />}
        isRTL={isRTL}
      >
        <div className="grid grid-cols-2 gap-6">
          {/* Periods Per Day */}
          <div className="space-y-2">
            <Label htmlFor="periodsPerDay" className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Minus className="h-4 w-4" />
              {t.periods.periodsPerDay || "Periods Per Day"} <span className="text-red-500">*</span>
            </Label>
            <select
              id="periodsPerDay"
              value={periodsPerDay}
              onChange={(e) => setPeriodsPerDay(Number(e.target.value))}
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-all"
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map(num => (
                <option key={num} value={num}>{num} {num === 1 ? 'period' : 'periods'}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500">
              Total of {periodsPerDay} periods per day
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
              Increments of 5 minutes
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

      {/* Break Periods Selection */}
      <WizardStepContainer
        title="Break Periods (Lunch/Prayer)"
        description="Select which periods are designated as breaks (lunch or prayer time)"
        icon={<Coffee className="h-5 w-5 text-blue-600" />}
        isRTL={isRTL}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {calculatedPeriods.map((period) => {
            const isBreak = breakPeriods.includes(period.index)
            return (
              <button
                key={period.index}
                type="button"
                onClick={() => toggleBreakPeriod(period.index)}
                className={cn(
                  "flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200 transform hover:scale-105",
                  isBreak
                    ? "border-orange-500 bg-orange-50 dark:bg-orange-950 shadow-md"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center mb-2 font-bold text-sm transition-all",
                  isBreak
                    ? "bg-orange-500 text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                )}>
                  P{period.index + 1}
                </div>
                <span className={cn(
                  "text-xs font-medium text-center",
                  isBreak
                    ? "text-orange-700 dark:text-orange-300"
                    : "text-gray-700 dark:text-gray-300"
                )}>
                  {formatTime(period.startTime)}
                </span>
                {isBreak && (
                  <Coffee className="h-4 w-4 text-orange-600 mt-1" />
                )}
              </button>
            )
          })}
        </div>

        {breakPeriods.length > 0 && (
          <div className="mt-4 p-4 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
            <p className="text-sm font-medium text-orange-900 dark:text-orange-100 mb-2">
              Break Periods Selected: {breakPeriods.length}
            </p>
            <div className="flex flex-wrap gap-2">
              {breakPeriods.map(index => (
                <Badge key={index} className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                  Period {index + 1}
                </Badge>
              ))}
            </div>
          </div>
        )}
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
            const isBreak = breakPeriods.includes(period.index)
            
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
                const isBreak = breakPeriods.includes(period.index)
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