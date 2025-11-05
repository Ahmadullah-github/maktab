import React, { useState, useEffect, useMemo, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { WizardStepContainer } from "@/components/wizard/shared/wizard-step-container"
import { useLanguageCtx } from "@/i18n/provider"
import { 
  Clock, 
  Coffee, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp,
  Calendar,
  Info
} from "lucide-react"
import { cn } from "@/lib/utils/tailwaindMergeUtil"
import { SchoolInfo, BreakPeriodConfig } from "@/types"
import { useWizardStore } from "@/stores/useWizardStore"
import { toast } from "sonner"
import { 
  validateBreakPeriods, 
  calculateScheduleStats,
  getBreakValidationResult,
  getRecommendedBreakPlacement,
  getValidationIcon
} from "@/lib/scheduleValidation"

interface PeriodsStepProps {
  data: {
    periodsPerDay: number
    periodDuration: number
    schoolStartTime: string
    periods: any[]
    breakPeriods: BreakPeriodConfig[]
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
  const [periodDuration, setPeriodDuration] = useState(data.periodDuration || 45)
  const [schoolStartTime, setSchoolStartTime] = useState(data.schoolStartTime || "08:00")
  const [breakPeriods, setBreakPeriods] = useState<BreakPeriodConfig[]>(data.breakPeriods || [])
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  
  const { isRTL, t, language } = useLanguageCtx()
  const { setSchoolInfo, saveSchoolInfo } = useWizardStore()

  // Use values from schoolInfo - periods per day is read-only here
  const periodsPerDay = schoolInfo.periodsPerDay || 7

  // Debounced auto-save (define first to avoid circular dependency)
  const handleAutoSave = useCallback(async () => {
    setIsSaving(true)
    try {
      await saveSchoolInfo()
      setLastSaved(new Date())
      toast.success(t.common.saved || "Saved")
    } catch (error) {
      console.error("Failed to save breaks:", error)
      toast.error(t.common.failedToSave || "Failed to save")
    } finally {
      setIsSaving(false)
    }
  }, [saveSchoolInfo, language])

  // Update break duration after a specific period
  const updateBreakDuration = useCallback((afterPeriod: number, duration: number) => {
    setBreakPeriods(current => {
      // Find if break exists after this period
      const existing = current.find(b => b.afterPeriod === afterPeriod)
      
      let updatedBreaks: BreakPeriodConfig[]
      if (existing) {
        if (duration === 0) {
          // Remove break by filtering out
          updatedBreaks = current.filter(b => b.afterPeriod !== afterPeriod)
        } else {
          // Update duration
          updatedBreaks = current.map(b => 
            b.afterPeriod === afterPeriod ? { ...b, duration } : b
          )
        }
      } else {
        if (duration > 0) {
          // Add new break
          updatedBreaks = [...current, { afterPeriod, duration }]
          updatedBreaks.sort((a, b) => a.afterPeriod - b.afterPeriod)
        } else {
          // No change needed
          updatedBreaks = current
        }
      }
      
      // Update periods data
      const updatedData = {
        ...data,
        breakPeriods: updatedBreaks
      }
      onUpdate(updatedData)
      
      // Update SchoolInfo
      setSchoolInfo({
        ...schoolInfo,
        breakPeriods: updatedBreaks
      })
      
      // Auto-save
      setTimeout(() => handleAutoSave(), 0)
      
      return updatedBreaks
    })
  }, [data, onUpdate, schoolInfo, setSchoolInfo, handleAutoSave])

  // Sync with data prop
  useEffect(() => {
    setPeriodDuration(data.periodDuration || 45)
    setSchoolStartTime(data.schoolStartTime || "08:00")
    setBreakPeriods(data.breakPeriods || [])
  }, [data])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle shortcuts when not typing in an input
      if (document.activeElement?.tagName === 'INPUT') return
      
      // Number keys disabled for now (old toggle behavior not applicable)
      
      // Ctrl+S / Cmd+S to manual save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleAutoSave()
      }
    }
    
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [periodsPerDay, handleAutoSave])

  // Calculate validation and stats
  const validation = useMemo(() => 
    validateBreakPeriods(breakPeriods, periodsPerDay, periodDuration),
    [breakPeriods, periodsPerDay, periodDuration]
  )

  const stats = useMemo(() => 
    calculateScheduleStats(periodsPerDay, breakPeriods, periodDuration, schoolStartTime),
    [periodsPerDay, breakPeriods, periodDuration, schoolStartTime]
  )

  const validationResult = useMemo(() => 
    getBreakValidationResult(breakPeriods, periodsPerDay, periodDuration, schoolStartTime),
    [breakPeriods, periodsPerDay, periodDuration, schoolStartTime]
  )

  // Quick break presets
  const applyBreakPreset = useCallback((preset: 'morning' | 'lunch' | 'afternoon' | 'clear') => {
    let newBreaks: BreakPeriodConfig[] = []
    
    switch (preset) {
      case 'morning':
        // Break after 3rd period
        if (periodsPerDay >= 3) newBreaks = [{ afterPeriod: 3, duration: 10 }]
        break
      case 'lunch':
        // Middle breaks for lunch
        if (periodsPerDay >= 6) newBreaks = [
          { afterPeriod: 5, duration: 50 },
          { afterPeriod: 6, duration: 50 }
        ]
        else if (periodsPerDay >= 4) newBreaks = [{ afterPeriod: Math.floor(periodsPerDay / 2), duration: 30 }]
        break
      case 'afternoon':
        // Break after 6th period
        if (periodsPerDay >= 6) newBreaks = [{ afterPeriod: 6, duration: 15 }]
        break
      case 'clear':
        newBreaks = []
        break
    }
    
    // Set breaks directly
    const sortedBreaks = newBreaks.sort((a, b) => a.afterPeriod - b.afterPeriod)
    setBreakPeriods(sortedBreaks)
    
    // Update periods data
    const updatedData = {
      ...data,
      breakPeriods: sortedBreaks
    }
    onUpdate(updatedData)
    
    // Update SchoolInfo
    setSchoolInfo({
      ...schoolInfo,
      breakPeriods: sortedBreaks
    })
    
    // Auto-save
    setTimeout(() => handleAutoSave(), 0)
  }, [periodsPerDay, data, onUpdate, schoolInfo, setSchoolInfo, handleAutoSave])

  // Calculate periods dynamically
  const calculatedPeriods = useMemo(() => {
    const periods: any[] = []
    let currentTime = schoolStartTime

    for (let i = 0; i < periodsPerDay; i++) {
      const periodNum = i + 1
      
      // Teaching period
      periods.push({
        index: i,
        startTime: currentTime,
        endTime: addMinutes(currentTime, periodDuration),
        isBreak: false,
        duration: periodDuration
      })
      
      currentTime = addMinutes(currentTime, periodDuration)
      
      // Break AFTER this period (if not last period)
      if (i < periodsPerDay - 1) {
        const breakConfig = breakPeriods.find(b => b.afterPeriod === periodNum)
        const breakDuration = breakConfig?.duration || 0
        
        if (breakDuration > 0) {
          currentTime = addMinutes(currentTime, breakDuration)
        }
      }
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto" dir={isRTL ? "rtl" : "ltr"}>
      {/* Single Container with Two-Column Layout */}
      <WizardStepContainer
        title={t.periods.title || "Period Configuration"}
        description={t.periods.description || "Configure timing and breaks for your daily schedule"}
        icon={<Clock className="h-6 w-6 text-blue-600" />}
        isRTL={isRTL}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Configuration (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Compact Info Bar */}
            <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center gap-4 text-sm">
                <Badge variant="outline" className="bg-white border-blue-300" aria-label="Days per week">
                  <Calendar className={cn("h-3 w-3", isRTL ? "ml-1" : "mr-1")} />
                  {schoolInfo.daysPerWeek} {t.periods.daysPerWeek || "days/week"}
                </Badge>
                <Badge variant="outline" className="bg-white border-blue-300" aria-label="Periods per day">
                  <Clock className={cn("h-3 w-3", isRTL ? "ml-1" : "mr-1")} />
                  {periodsPerDay} {t.periods.periodsPerDayLabel || "periods/day"}
                </Badge>
              </div>
              {lastSaved && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  {isSaving ? (
                    <span>{t.common.saving || "Saving..."}</span>
                  ) : (
                    <span>{t.common.saved || "Saved"}</span>
                  )}
                </div>
              )}
            </div>

            {/* Configuration Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* School Start Time */}
          <div className="space-y-2">
            <Label htmlFor="schoolStartTime" className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {t.periods.schoolStartTime || "School Start Time"} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="schoolStartTime"
              type="time"
              value={schoolStartTime}
              onChange={(e) => setSchoolStartTime(e.target.value)}
              className="h-11 text-base"
                  aria-label="School start time"
                  aria-required="true"
            />
            <p className="text-xs text-gray-500">
              {t.periods.whenDoesFirstStart || "When does the first period start?"}
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
                  aria-label="Period duration in minutes"
                  aria-required="true"
            >
              {DURATION_OPTIONS.map(duration => (
                <option key={duration} value={duration}>
                  {duration} {t.periods.min || "min"}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500">
              {t.periods.howLongIsPeriod || "How long is each period?"}
            </p>
          </div>
        </div>

            {/* Break Period Selection */}
            <div className="space-y-4">
            <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Coffee className="h-4 w-4" />
                  {t.periods.breakPeriods || "Break Periods"}
                </Label>
                
                {/* Quick Preset Buttons */}
                <div className="flex gap-2" role="group" aria-label="Quick break presets">
                  {periodsPerDay >= 3 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => applyBreakPreset('morning')}
                      className="text-xs h-7"
                      aria-label="Set morning break at period 3"
                    >
                      {t.periods.morning || "Morning"}
                    </Button>
                  )}
                  {periodsPerDay >= 4 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => applyBreakPreset('lunch')}
                      className="text-xs h-7"
                      aria-label="Set lunch break"
                    >
                      {t.periods.lunch || "Lunch"}
                    </Button>
                  )}
                  {periodsPerDay >= 6 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => applyBreakPreset('afternoon')}
                      className="text-xs h-7"
                      aria-label="Set afternoon break at period 6"
                    >
                      {t.periods.afternoon || "Afternoon"}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => applyBreakPreset('clear')}
                    className="text-xs h-7 text-red-600 hover:text-red-700"
                    aria-label="Clear all breaks"
                  >
                    {t.periods.clear || "Clear"}
                  </Button>
                </div>
              </div>

              <p className="text-xs text-gray-500">
                {t.periods.configureBreakDescription || "Configure break duration after each teaching period"}
              </p>

              {/* Break Configuration Grid */}
              <div 
                className="grid grid-cols-1 gap-4"
                role="group"
                aria-label="Break configuration"
              >
                {Array.from({ length: periodsPerDay }, (_, i) => i + 1).map(p => {
                  const breakConfig = breakPeriods.find(b => b.afterPeriod === p)
                  const periodInfo = calculatedPeriods[p - 1]
                  const hasBreak = breakConfig && breakConfig.duration > 0
                  
                  return (
                    <div key={`break-after-${p}`} className={cn(
                      "p-4 rounded-lg border-2 transition-all",
                      hasBreak 
                        ? "bg-gradient-to-br from-orange-50 to-amber-50 border-orange-300 dark:from-orange-950 dark:to-amber-950 dark:border-orange-700"
                        : "bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700"
                    )}>
                      <div className="flex items-center gap-4">
                        {/* Period Number & Time */}
                        <div className="flex-shrink-0">
                          <div className={cn(
                            "text-xl font-bold transition-all",
                            hasBreak ? "text-orange-700 dark:text-orange-300" : "text-gray-700 dark:text-gray-300"
                          )}>
                            {t.periods.period || "Period"} {p}
                          </div>
                          {periodInfo && (
                            <div className="text-xs font-mono text-gray-600 dark:text-gray-400">
                              {formatTime(periodInfo.startTime)} - {formatTime(periodInfo.endTime)}
                            </div>
                          )}
                        </div>
                        
                        {/* Break Duration Selector */}
                        <div className="flex-1">
                          <Label className="text-xs mb-1 block">
                            {t.periods.breakAfterP || "Break after P"}{p}:
                          </Label>
                          <select
                            value={breakConfig?.duration || 0}
                            onChange={(e) => {
                              updateBreakDuration(p, Number(e.target.value))
                            }}
                            className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                            aria-label={`Break duration after period ${p}`}
                          >
                            <option value={0}>{t.periods.noBreak || "No break"}</option>
                            <option value={5}>5 {t.periods.min || "min"}</option>
                            <option value={10}>10 {t.periods.min || "min"}</option>
                            <option value={15}>15 {t.periods.min || "min"}</option>
                            <option value={20}>20 {t.periods.min || "min"}</option>
                            <option value={30}>30 {t.periods.min || "min"}</option>
                            <option value={45}>45 {t.periods.min || "min"}</option>
                            <option value={50}>50 {t.periods.min || "min"}</option>
                            <option value={60}>60 {t.periods.min || "min"}</option>
                          </select>
                        </div>
                        
                        {/* Visual Indicator */}
                        {hasBreak && (
                          <div className="flex-shrink-0">
                            <div className="p-2 bg-orange-200 dark:bg-orange-900 rounded-full">
                              <Coffee className="h-4 w-4 text-orange-700 dark:text-orange-300" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Validation Alert */}
              {validation.severity !== 'success' && (
                <Alert variant={validation.severity === 'error' ? 'destructive' : 'default'} className="border-2">
                  <div className="flex items-start gap-3">
                    {validation.severity === 'error' ? (
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    ) : (
                      <Info className="h-5 w-5 text-amber-600" />
                    )}
                    <div className="flex-1">
                      <AlertTitle className="text-sm font-semibold">
                        {validation.message}
                      </AlertTitle>
                      {validation.details && (
                        <AlertDescription className="text-sm mt-1">
                          {validation.details}
                        </AlertDescription>
                      )}
                    </div>
                  </div>
                </Alert>
              )}
            </div>

            {/* Recommendations */}
            {validationResult.recommendations.length > 0 && (
              <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-sm font-semibold text-blue-900">
                  {t.common.recommendations || "Recommendations"}
                </AlertTitle>
                <AlertDescription className="text-sm">
                  <ul className="list-disc list-inside space-y-1 mt-2">
                    {validationResult.recommendations.map((rec, idx) => (
                      <li key={idx}>{rec}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Right Column: Preview & Stats (1/3 width, sticky) */}
          <div className="lg:col-span-1 space-y-6">
            {/* Stats Dashboard */}
            <Card className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-2 border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  {t.periods.scheduleSummary || "Schedule Summary"}
                </h3>
                <span className={cn(
                  "text-xs font-bold px-2 py-1 rounded-full",
                  validation.severity === 'success' && "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
                  validation.severity === 'warning' && "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
                  validation.severity === 'error' && "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                )}>
                  {getValidationIcon(validation.severity)} {validation.severity.toUpperCase()}
                </span>
              </div>

              <div className="space-y-4">
                {/* Teaching Time */}
                <div className="flex items-center justify-between pb-2 border-b border-blue-200 dark:border-blue-700">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                      <Clock className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400">{t.periods.teachingTime || "Teaching Time"}</p>
                      <p className="text-2xl font-bold text-blue-600 tabular-nums">{stats.totalTeachingHours}h</p>
                    </div>
                  </div>
                  <div className="flex-1 ml-4 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${stats.teachingTimeRatio}%` }}
                    />
            </div>
        </div>

                {/* Break Time */}
                <div className="flex items-center justify-between pb-2 border-b border-blue-200 dark:border-blue-700">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                      <Coffee className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400">{t.periods.breakTime || "Break Time"}</p>
                      <p className="text-2xl font-bold text-green-600 tabular-nums">{stats.totalBreakHours}h</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {stats.breakCount} {stats.breakCount !== 1 ? (t.periods.breaks || "breaks") : (t.periods.break || "break")}
                  </Badge>
                  </div>
                  
                {/* Total School Day */}
                <div className="flex items-center justify-between pb-2 border-b border-blue-200 dark:border-blue-700">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                      <Calendar className="h-4 w-4 text-purple-600" />
                    </div>
                  <div>
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400">{t.periods.schoolDay || "School Day"}</p>
                      <p className="text-2xl font-bold text-purple-600 tabular-nums">{stats.totalSchoolHours}h</p>
                    </div>
                  </div>
                </div>

                {/* End Time */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
                      <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400">{t.periods.endTimeLabel || "End Time"}</p>
                      <p className="text-2xl font-bold text-indigo-600 tabular-nums">{stats.endTime}</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Compact Period Preview Table */}
            <Card className="p-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {t.periods.dailySchedule || "Daily Schedule"}
              </h3>
              <div className="space-y-1">
              {calculatedPeriods.map((period) => {
                return (
                  <div
                    key={period.index}
                    className="flex items-center justify-between p-2 rounded text-xs transition-all hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold w-6 text-center text-gray-700">
                        P{period.index + 1}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-gray-600 dark:text-gray-400 font-mono">
                          {formatTime(period.startTime)}-{formatTime(period.endTime)}
                        </span>
                        <span className="text-gray-500 text-[10px]">
                          {period.duration}{t.periods.min || "min"}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            </Card>
          </div>
        </div>
      </WizardStepContainer>
    </div>
  )
}





// import React, { useState, useEffect, useMemo, useCallback } from "react"
// import { Input } from "@/components/ui/input"
// import { Label } from "@/components/ui/label"
// import { Badge } from "@/components/ui/badge"
// import { Card } from "@/components/ui/card"
// import { Button } from "@/components/ui/button"
// import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
// import { WizardStepContainer } from "@/components/wizard/shared/wizard-step-container"
// import { useLanguageCtx } from "@/i18n/provider"
// import { 
//   Clock, 
//   Coffee, 
//   CheckCircle2, 
//   AlertTriangle, 
//   TrendingUp,
//   Calendar,
//   Info
// } from "lucide-react"
// import { cn } from "@/lib/utils/tailwaindMergeUtil"
// import { SchoolInfo, BreakPeriodConfig } from "@/types"
// import { useWizardStore } from "@/stores/useWizardStore"
// import { toast } from "sonner"
// import { 
//   validateBreakPeriods, 
//   calculateScheduleStats,
//   getBreakValidationResult,
//   getRecommendedBreakPlacement,
//   getValidationIcon
// } from "@/lib/scheduleValidation"

// interface PeriodsStepProps {
//   data: {
//     periodsPerDay: number
//     periodDuration: number
//     schoolStartTime: string
//     periods: any[]
//     breakPeriods: BreakPeriodConfig[]
//   }
//   schoolInfo: SchoolInfo
//   onUpdate: (data: any) => void
// }

// const DURATION_OPTIONS = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90]

// // Helper to calculate time
// function addMinutes(time: string, minutes: number): string {
//   const [hours, mins] = time.split(':').map(Number)
//   const totalMinutes = hours * 60 + mins + minutes
//   const newHours = Math.floor(totalMinutes / 60) % 24
//   const newMins = totalMinutes % 60
//   return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`
// }

// function formatTime(time: string): string {
//   const [hours, minutes] = time.split(':')
//   return `${hours}:${minutes}`
// }

// export function PeriodsStep({ data, schoolInfo, onUpdate }: PeriodsStepProps) {
//   const [periodDuration, setPeriodDuration] = useState(data.periodDuration || 45)
//   const [schoolStartTime, setSchoolStartTime] = useState(data.schoolStartTime || "08:00")
//   const [breakPeriods, setBreakPeriods] = useState<BreakPeriodConfig[]>(data.breakPeriods || [])
//   const [isSaving, setIsSaving] = useState(false)
//   const [lastSaved, setLastSaved] = useState<Date | null>(null)
  
//   const { isRTL, t, language } = useLanguageCtx()
//   const { setSchoolInfo, saveSchoolInfo, setPeriodsInfo, saveStepData } = useWizardStore()

//   // Use values from schoolInfo - periods per day is read-only here
//   const periodsPerDay = schoolInfo.periodsPerDay || 7

//   // Debounced auto-save (define first to avoid circular dependency)
//   const handleAutoSave = useCallback(async () => {
//     setIsSaving(true)
//     try {
//       // Save school info (for break periods) and periods step data
//       await Promise.all([
//         saveSchoolInfo(),
//         saveStepData("periods", payload)
//       ])
//       setLastSaved(new Date())
//       toast.success(t.common.saved || "Saved")
//     } catch (error) {
//       console.error("Failed to save periods config:", error)
//       toast.error(t.common.failedToSave || "Failed to save")
//     } finally {
//       setIsSaving(false)
//     }
//   }, [saveSchoolInfo, saveStepData, payload, language])

//   // Update break duration after a specific period
//   const updateBreakDuration = useCallback((afterPeriod: number, duration: number) => {
//     setBreakPeriods(current => {
//       // Find if break exists after this period
//       const existing = current.find(b => b.afterPeriod === afterPeriod)
      
//       let updatedBreaks: BreakPeriodConfig[]
//       if (existing) {
//         if (duration === 0) {
//           // Remove break by filtering out
//           updatedBreaks = current.filter(b => b.afterPeriod !== afterPeriod)
//         } else {
//           // Update duration
//           updatedBreaks = current.map(b => 
//             b.afterPeriod === afterPeriod ? { ...b, duration } : b
//           )
//         }
//       } else {
//         if (duration > 0) {
//           // Add new break
//           updatedBreaks = [...current, { afterPeriod, duration }]
//           updatedBreaks.sort((a, b) => a.afterPeriod - b.afterPeriod)
//         } else {
//           // No change needed
//           updatedBreaks = current
//         }
//       }
      
//       // Update periods data
//       const updatedData = {
//         ...data,
//         breakPeriods: updatedBreaks
//       }
//       onUpdate(updatedData)
      
//       // Update SchoolInfo
//       setSchoolInfo({
//         ...schoolInfo,
//         breakPeriods: updatedBreaks
//       })
      
//       // Auto-save
//       setTimeout(() => handleAutoSave(), 0)
      
//       return updatedBreaks
//     })
//   }, [data, onUpdate, schoolInfo, setSchoolInfo, handleAutoSave])

//   // Sync with data prop
//   useEffect(() => {
//     setPeriodDuration(data.periodDuration || 45)
//     setSchoolStartTime(data.schoolStartTime || "08:00")
//     setBreakPeriods(data.breakPeriods || [])
//   }, [data])

//   // Sync periodsInfo with schoolInfo when periodsPerDay changes
//   useEffect(() => {
//     const currentPeriodsPerDay = data.periodsPerDay || 7
//     if (periodsPerDay !== currentPeriodsPerDay) {
//       console.log(`[PeriodsStep] Syncing periodsPerDay from ${currentPeriodsPerDay} to ${periodsPerDay}`)
//       // Update the periodsInfo in wizard store to match schoolInfo
//       const updatedPeriodsInfo = {
//         ...data,
//         periodsPerDay: periodsPerDay
//       }
//       setPeriodsInfo(updatedPeriodsInfo)
//       onUpdate(updatedPeriodsInfo)
//     }
//   }, [periodsPerDay, data, setPeriodsInfo, onUpdate])

//   // Keyboard shortcuts
//   useEffect(() => {
//     const handleKeyPress = (e: KeyboardEvent) => {
//       // Only handle shortcuts when not typing in an input
//       if (document.activeElement?.tagName === 'INPUT') return
      
//       // Number keys disabled for now (old toggle behavior not applicable)
      
//       // Ctrl+S / Cmd+S to manual save
//       if ((e.ctrlKey || e.metaKey) && e.key === 's') {
//         e.preventDefault()
//         handleAutoSave()
//       }
//     }
    
//     window.addEventListener('keydown', handleKeyPress)
//     return () => window.removeEventListener('keydown', handleKeyPress)
//   }, [periodsPerDay, handleAutoSave])

//   // Calculate validation and stats
//   const validation = useMemo(() => 
//     validateBreakPeriods(breakPeriods, periodsPerDay, periodDuration),
//     [breakPeriods, periodsPerDay, periodDuration]
//   )

//   const stats = useMemo(() => 
//     calculateScheduleStats(periodsPerDay, breakPeriods, periodDuration, schoolStartTime),
//     [periodsPerDay, breakPeriods, periodDuration, schoolStartTime]
//   )

//   const validationResult = useMemo(() => 
//     getBreakValidationResult(breakPeriods, periodsPerDay, periodDuration, schoolStartTime),
//     [breakPeriods, periodsPerDay, periodDuration, schoolStartTime]
//   )

//   // Quick break presets
//   const applyBreakPreset = useCallback((preset: 'morning' | 'lunch' | 'afternoon' | 'clear') => {
//     let newBreaks: BreakPeriodConfig[] = []
    
//     switch (preset) {
//       case 'morning':
//         // Break after 3rd period
//         if (periodsPerDay >= 3) newBreaks = [{ afterPeriod: 3, duration: 10 }]
//         break
//       case 'lunch':
//         // Middle breaks for lunch
//         if (periodsPerDay >= 6) newBreaks = [
//           { afterPeriod: 5, duration: 50 },
//           { afterPeriod: 6, duration: 50 }
//         ]
//         else if (periodsPerDay >= 4) newBreaks = [{ afterPeriod: Math.floor(periodsPerDay / 2), duration: 30 }]
//         break
//       case 'afternoon':
//         // Break after 6th period
//         if (periodsPerDay >= 6) newBreaks = [{ afterPeriod: 6, duration: 15 }]
//         break
//       case 'clear':
//         newBreaks = []
//         break
//     }
    
//     // Set breaks directly
//     const sortedBreaks = newBreaks.sort((a, b) => a.afterPeriod - b.afterPeriod)
//     setBreakPeriods(sortedBreaks)
    
//     // Update periods data
//     const updatedData = {
//       ...data,
//       breakPeriods: sortedBreaks
//     }
//     onUpdate(updatedData)
    
//     // Update SchoolInfo
//     setSchoolInfo({
//       ...schoolInfo,
//       breakPeriods: sortedBreaks
//     })
    
//     // Auto-save
//     setTimeout(() => handleAutoSave(), 0)
//   }, [periodsPerDay, data, onUpdate, schoolInfo, setSchoolInfo, handleAutoSave])

//   // Calculate periods dynamically
//   const calculatedPeriods = useMemo(() => {
//     const periods: any[] = []
//     let currentTime = schoolStartTime

//     for (let i = 0; i < periodsPerDay; i++) {
//       const periodNum = i + 1
      
//       // Teaching period
//       periods.push({
//         index: i,
//         startTime: currentTime,
//         endTime: addMinutes(currentTime, periodDuration),
//         isBreak: false,
//         duration: periodDuration
//       })
      
//       currentTime = addMinutes(currentTime, periodDuration)
      
//       // Break AFTER this period (if not last period)
//       if (i < periodsPerDay - 1) {
//         const breakConfig = breakPeriods.find(b => b.afterPeriod === periodNum)
//         const breakDuration = breakConfig?.duration || 0
        
//         if (breakDuration > 0) {
//           currentTime = addMinutes(currentTime, breakDuration)
//         }
//       }
//     }

//     return periods
//   }, [periodsPerDay, periodDuration, schoolStartTime, breakPeriods])

//   const payload = useMemo(() => ({
//     periodsPerDay,
//     periodDuration,
//     schoolStartTime,
//     periods: calculatedPeriods,
//     breakPeriods,
//   }), [periodsPerDay, periodDuration, schoolStartTime, calculatedPeriods, breakPeriods])

//   useEffect(() => {
//     try {
//       const current = JSON.stringify(data || {})
//       const next = JSON.stringify(payload)
//       if (current !== next) {
//         onUpdate(payload)
//       }
//     } catch {
//       onUpdate(payload)
//     }
//   }, [payload, data, onUpdate])

//   return (
//     <div className="space-y-6 max-w-7xl mx-auto" dir={isRTL ? "rtl" : "ltr"}>
//       {/* Single Container with Two-Column Layout */}
//       <WizardStepContainer
//         title={t.periods.title || "Period Configuration"}
//         description={t.periods.description || "Configure timing and breaks for your daily schedule"}
//         icon={<Clock className="h-6 w-6 text-blue-600" />}
//         isRTL={isRTL}
//       >
//         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
//           {/* Left Column: Configuration (2/3 width) */}
//           <div className="lg:col-span-2 space-y-6">
//             {/* Compact Info Bar */}
//             <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
//               <div className="flex items-center gap-4 text-sm">
//                 <Badge variant="outline" className="bg-white border-blue-300" aria-label="Days per week">
//                   <Calendar className={cn("h-3 w-3", isRTL ? "ml-1" : "mr-1")} />
//                   {schoolInfo.daysPerWeek} {t.periods.daysPerWeek || "days/week"}
//                 </Badge>
//                 <Badge variant="outline" className="bg-white border-blue-300" aria-label="Periods per day">
//                   <Clock className={cn("h-3 w-3", isRTL ? "ml-1" : "mr-1")} />
//                   {periodsPerDay} {t.periods.periodsPerDayLabel || "periods/day"}
//                 </Badge>
//               </div>
//               {lastSaved && (
//                 <div className="flex items-center gap-2 text-xs text-gray-500">
//                   <CheckCircle2 className="h-3 w-3 text-green-600" />
//                   {isSaving ? (
//                     <span>{t.common.saving || "Saving..."}</span>
//                   ) : (
//                     <span>{t.common.saved || "Saved"}</span>
//                   )}
//                 </div>
//               )}
//             </div>

//             {/* Configuration Form */}
//             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//           {/* School Start Time */}
//           <div className="space-y-2">
//             <Label htmlFor="schoolStartTime" className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
//               <Clock className="h-4 w-4" />
//               {t.periods.schoolStartTime || "School Start Time"} <span className="text-red-500">*</span>
//             </Label>
//             <Input
//               id="schoolStartTime"
//               type="time"
//               value={schoolStartTime}
//               onChange={(e) => setSchoolStartTime(e.target.value)}
//               className="h-11 text-base"
//                   aria-label="School start time"
//                   aria-required="true"
//             />
//             <p className="text-xs text-gray-500">
//               {t.periods.whenDoesFirstStart || "When does the first period start?"}
//             </p>
//           </div>

//           {/* Period Duration */}
//           <div className="space-y-2">
//             <Label htmlFor="periodDuration" className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
//               <Clock className="h-4 w-4" />
//               {t.periods.duration || "Duration (minutes)"} <span className="text-red-500">*</span>
//             </Label>
//             <select
//               id="periodDuration"
//               value={periodDuration}
//               onChange={(e) => setPeriodDuration(Number(e.target.value))}
//               className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-all"
//                   aria-label="Period duration in minutes"
//                   aria-required="true"
//             >
//               {DURATION_OPTIONS.map(duration => (
//                 <option key={duration} value={duration}>
//                   {duration} {t.periods.min || "min"}
//                 </option>
//               ))}
//             </select>
//             <p className="text-xs text-gray-500">
//               {t.periods.howLongIsPeriod || "How long is each period?"}
//             </p>
//           </div>
//         </div>

//             {/* Break Period Selection */}
//             <div className="space-y-4">
//             <div className="flex items-center justify-between">
//                 <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
//                   <Coffee className="h-4 w-4" />
//                   {t.periods.breakPeriods || "Break Periods"}
//                 </Label>
                
//                 {/* Quick Preset Buttons */}
//                 <div className="flex gap-2" role="group" aria-label="Quick break presets">
//                   {periodsPerDay >= 3 && (
//                     <Button
//                       size="sm"
//                       variant="outline"
//                       onClick={() => applyBreakPreset('morning')}
//                       className="text-xs h-7"
//                       aria-label="Set morning break at period 3"
//                     >
//                       {t.periods.morning || "Morning"}
//                     </Button>
//                   )}
//                   {periodsPerDay >= 4 && (
//                     <Button
//                       size="sm"
//                       variant="outline"
//                       onClick={() => applyBreakPreset('lunch')}
//                       className="text-xs h-7"
//                       aria-label="Set lunch break"
//                     >
//                       {t.periods.lunch || "Lunch"}
//                     </Button>
//                   )}
//                   {periodsPerDay >= 6 && (
//                     <Button
//                       size="sm"
//                       variant="outline"
//                       onClick={() => applyBreakPreset('afternoon')}
//                       className="text-xs h-7"
//                       aria-label="Set afternoon break at period 6"
//                     >
//                       {t.periods.afternoon || "Afternoon"}
//                     </Button>
//                   )}
//                   <Button
//                     size="sm"
//                     variant="outline"
//                     onClick={() => applyBreakPreset('clear')}
//                     className="text-xs h-7 text-red-600 hover:text-red-700"
//                     aria-label="Clear all breaks"
//                   >
//                     {t.periods.clear || "Clear"}
//                   </Button>
//                 </div>
//               </div>

//               <p className="text-xs text-gray-500">
//                 {t.periods.configureBreakDescription || "Configure break duration after each teaching period"}
//               </p>

//               {/* Break Configuration Grid */}
//               <div 
//                 className="grid grid-cols-1 gap-4"
//                 role="group"
//                 aria-label="Break configuration"
//               >
//                 {Array.from({ length: periodsPerDay }, (_, i) => i + 1).map(p => {
//                   const breakConfig = breakPeriods.find(b => b.afterPeriod === p)
//                   const periodInfo = calculatedPeriods[p - 1]
//                   const hasBreak = breakConfig && breakConfig.duration > 0
                  
//                   return (
//                     <div key={`break-after-${p}`} className={cn(
//                       "p-4 rounded-lg border-2 transition-all",
//                       hasBreak 
//                         ? "bg-gradient-to-br from-orange-50 to-amber-50 border-orange-300 dark:from-orange-950 dark:to-amber-950 dark:border-orange-700"
//                         : "bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700"
//                     )}>
//                       <div className="flex items-center gap-4">
//                         {/* Period Number & Time */}
//                         <div className="flex-shrink-0">
//                           <div className={cn(
//                             "text-xl font-bold transition-all",
//                             hasBreak ? "text-orange-700 dark:text-orange-300" : "text-gray-700 dark:text-gray-300"
//                           )}>
//                             {t.periods.period || "Period"} {p}
//                           </div>
//                           {periodInfo && (
//                             <div className="text-xs font-mono text-gray-600 dark:text-gray-400">
//                               {formatTime(periodInfo.startTime)} - {formatTime(periodInfo.endTime)}
//                             </div>
//                           )}
//                         </div>
                        
//                         {/* Break Duration Selector */}
//                         <div className="flex-1">
//                           <Label className="text-xs mb-1 block">
//                             {t.periods.breakAfterP || "Break after P"}{p}:
//                           </Label>
//                           <select
//                             value={breakConfig?.duration || 0}
//                             onChange={(e) => {
//                               updateBreakDuration(p, Number(e.target.value))
//                             }}
//                             className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
//                             aria-label={`Break duration after period ${p}`}
//                           >
//                             <option value={0}>{t.periods.noBreak || "No break"}</option>
//                             <option value={5}>5 {t.periods.min || "min"}</option>
//                             <option value={10}>10 {t.periods.min || "min"}</option>
//                             <option value={15}>15 {t.periods.min || "min"}</option>
//                             <option value={20}>20 {t.periods.min || "min"}</option>
//                             <option value={30}>30 {t.periods.min || "min"}</option>
//                             <option value={45}>45 {t.periods.min || "min"}</option>
//                             <option value={50}>50 {t.periods.min || "min"}</option>
//                             <option value={60}>60 {t.periods.min || "min"}</option>
//                           </select>
//                         </div>
                        
//                         {/* Visual Indicator */}
//                         {hasBreak && (
//                           <div className="flex-shrink-0">
//                             <div className="p-2 bg-orange-200 dark:bg-orange-900 rounded-full">
//                               <Coffee className="h-4 w-4 text-orange-700 dark:text-orange-300" />
//                             </div>
//                           </div>
//                         )}
//                       </div>
//                     </div>
//                   )
//                 })}
//               </div>

//               {/* Validation Alert */}
//               {validation.severity !== 'success' && (
//                 <Alert variant={validation.severity === 'error' ? 'destructive' : 'default'} className="border-2">
//                   <div className="flex items-start gap-3">
//                     {validation.severity === 'error' ? (
//                       <AlertTriangle className="h-5 w-5 text-red-600" />
//                     ) : (
//                       <Info className="h-5 w-5 text-amber-600" />
//                     )}
//                     <div className="flex-1">
//                       <AlertTitle className="text-sm font-semibold">
//                         {validation.message}
//                       </AlertTitle>
//                       {validation.details && (
//                         <AlertDescription className="text-sm mt-1">
//                           {validation.details}
//                         </AlertDescription>
//                       )}
//                     </div>
//                   </div>
//                 </Alert>
//               )}
//             </div>

//             {/* Recommendations */}
//             {validationResult.recommendations.length > 0 && (
//               <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200">
//                 <Info className="h-4 w-4 text-blue-600" />
//                 <AlertTitle className="text-sm font-semibold text-blue-900">
//                   {t.common.recommendations || "Recommendations"}
//                 </AlertTitle>
//                 <AlertDescription className="text-sm">
//                   <ul className="list-disc list-inside space-y-1 mt-2">
//                     {validationResult.recommendations.map((rec, idx) => (
//                       <li key={idx}>{rec}</li>
//                     ))}
//                   </ul>
//                 </AlertDescription>
//               </Alert>
//             )}
//           </div>

//           {/* Right Column: Preview & Stats (1/3 width, sticky) */}
//           <div className="lg:col-span-1 space-y-6">
//             {/* Stats Dashboard */}
//             <Card className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-2 border-blue-200 dark:border-blue-800">
//               <div className="flex items-center justify-between mb-4">
//                 <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
//                   <TrendingUp className="h-5 w-5 text-blue-600" />
//                   {t.periods.scheduleSummary || "Schedule Summary"}
//                 </h3>
//                 <span className={cn(
//                   "text-xs font-bold px-2 py-1 rounded-full",
//                   validation.severity === 'success' && "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
//                   validation.severity === 'warning' && "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
//                   validation.severity === 'error' && "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
//                 )}>
//                   {getValidationIcon(validation.severity)} {validation.severity.toUpperCase()}
//                 </span>
//               </div>

//               <div className="space-y-4">
//                 {/* Teaching Time */}
//                 <div className="flex items-center justify-between pb-2 border-b border-blue-200 dark:border-blue-700">
//                   <div className="flex items-center gap-2">
//                     <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
//                       <Clock className="h-4 w-4 text-blue-600" />
//                     </div>
//                     <div>
//                       <p className="text-xs font-medium text-gray-600 dark:text-gray-400">{t.periods.teachingTime || "Teaching Time"}</p>
//                       <p className="text-2xl font-bold text-blue-600 tabular-nums">{stats.totalTeachingHours}h</p>
//                     </div>
//                   </div>
//                   <div className="flex-1 ml-4 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
//                     <div 
//                       className="bg-blue-600 h-2 rounded-full transition-all duration-300"
//                       style={{ width: `${stats.teachingTimeRatio}%` }}
//                     />
//             </div>
//         </div>

//                 {/* Break Time */}
//                 <div className="flex items-center justify-between pb-2 border-b border-blue-200 dark:border-blue-700">
//                   <div className="flex items-center gap-2">
//                     <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
//                       <Coffee className="h-4 w-4 text-green-600" />
//                     </div>
//                     <div>
//                       <p className="text-xs font-medium text-gray-600 dark:text-gray-400">{t.periods.breakTime || "Break Time"}</p>
//                       <p className="text-2xl font-bold text-green-600 tabular-nums">{stats.totalBreakHours}h</p>
//                     </div>
//                   </div>
//                   <Badge variant="outline" className="text-xs">
//                     {stats.breakCount} {stats.breakCount !== 1 ? (t.periods.breaks || "breaks") : (t.periods.break || "break")}
//                   </Badge>
//                   </div>
                  
//                 {/* Total School Day */}
//                 <div className="flex items-center justify-between pb-2 border-b border-blue-200 dark:border-blue-700">
//                   <div className="flex items-center gap-2">
//                     <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
//                       <Calendar className="h-4 w-4 text-purple-600" />
//                     </div>
//                   <div>
//                       <p className="text-xs font-medium text-gray-600 dark:text-gray-400">{t.periods.schoolDay || "School Day"}</p>
//                       <p className="text-2xl font-bold text-purple-600 tabular-nums">{stats.totalSchoolHours}h</p>
//                     </div>
//                   </div>
//                 </div>

//                 {/* End Time */}
//                 <div className="flex items-center justify-between">
//                   <div className="flex items-center gap-2">
//                     <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
//                       <CheckCircle2 className="h-4 w-4 text-indigo-600" />
//                     </div>
//                     <div>
//                       <p className="text-xs font-medium text-gray-600 dark:text-gray-400">{t.periods.endTimeLabel || "End Time"}</p>
//                       <p className="text-2xl font-bold text-indigo-600 tabular-nums">{stats.endTime}</p>
//                     </div>
//                   </div>
//                 </div>
//               </div>
//             </Card>

//             {/* Compact Period Preview Table */}
//             <Card className="p-4">
//               <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
//                 <CheckCircle2 className="h-4 w-4" />
//                 {t.periods.dailySchedule || "Daily Schedule"}
//               </h3>
//               <div className="space-y-1">
//               {calculatedPeriods.map((period) => {
//                 return (
//                   <div
//                     key={period.index}
//                     className="flex items-center justify-between p-2 rounded text-xs transition-all hover:bg-gray-50 dark:hover:bg-gray-800"
//                   >
//                     <div className="flex items-center gap-2">
//                       <span className="font-bold w-6 text-center text-gray-700">
//                         P{period.index + 1}
//                       </span>
//                       <div className="flex flex-col">
//                         <span className="text-gray-600 dark:text-gray-400 font-mono">
//                           {formatTime(period.startTime)}-{formatTime(period.endTime)}
//                         </span>
//                         <span className="text-gray-500 text-[10px]">
//                           {period.duration}{t.periods.min || "min"}
//                         </span>
//                       </div>
//                     </div>
//                   </div>
//                 )
//               })}
//             </div>
//             </Card>
//           </div>
//         </div>
//       </WizardStepContainer>
//     </div>
//   )
// }
