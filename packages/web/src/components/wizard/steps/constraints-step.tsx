import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
// Removed imports that don't exist in your project:
// import { Slider } from "@/components/ui/slider"
// import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { useWizardStore } from "@/stores/useWizardStore"
import { WizardStepContainer } from "@/components/wizard/shared/wizard-step-container"
import { Settings } from "lucide-react"
import { useLanguageCtx } from "@/i18n/provider"

interface ConstraintsStepProps {
  onDataChange?: () => void
}

type Preferences = {
  avoidTeacherGapsWeight: number
  avoidClassGapsWeight: number
  distributeDifficultSubjectsWeight: number
  balanceTeacherLoadWeight: number
  minimizeRoomChangesWeight: number
  preferMorningForDifficultWeight: number
  respectTeacherTimePreferenceWeight: number
  respectTeacherRoomPreferenceWeight: number
  avoidFirstLastPeriodWeight: number
  subjectSpreadWeight: number
  allowConsecutivePeriodsForSameSubject: boolean
}

const defaultPreferences: Preferences = {
  avoidTeacherGapsWeight: 1.0,
  avoidClassGapsWeight: 1.0,
  distributeDifficultSubjectsWeight: 0.8,
  balanceTeacherLoadWeight: 0.7,
  minimizeRoomChangesWeight: 0.3,
  preferMorningForDifficultWeight: 0.5,
  respectTeacherTimePreferenceWeight: 0.5,
  respectTeacherRoomPreferenceWeight: 0.2,
  avoidFirstLastPeriodWeight: 0.0,
  subjectSpreadWeight: 0.0,
  allowConsecutivePeriodsForSameSubject: true,
}

function clampToRange(val: number, min = 0, max = 2, step = 0.1) {
  const clamped = Math.min(max, Math.max(min, val))
  const rounded = Math.round(clamped / step) * step
  return Number(rounded.toFixed(1))
}

export function ConstraintsStep({ onDataChange }: ConstraintsStepProps) {
  const { t, isRTL } = useLanguageCtx()
  const { preferences, setPreferences } = useWizardStore()
  const [localPreferences, setLocalPreferences] = useState<Preferences>({
    ...defaultPreferences,
    ...(preferences as Partial<Preferences>),
  })
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    setLocalPreferences(prev => ({
      ...prev,
      ...(preferences as Partial<Preferences>),
    }))
  }, [preferences])

  const handleWeightChange = (key: keyof Preferences, value: number) => {
    const numeric = clampToRange(Number(value))
    const updatedPreferences = { ...localPreferences, [key]: numeric } as Preferences
    setLocalPreferences(updatedPreferences)
    setPreferences(updatedPreferences)
    onDataChange?.()
  }

  const handleCheckboxChange = (key: keyof Preferences, checked: boolean) => {
    const updatedPreferences = { ...localPreferences, [key]: checked } as Preferences
    setLocalPreferences(updatedPreferences)
    setPreferences(updatedPreferences)
    onDataChange?.()
  }

  const WeightControl = ({
    label,
    value,
    onChange,
    description,
    inputId,
  }: {
    label: string
    value: number
    onChange: (value: number) => void
    description: string
    inputId: string
  }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="font-medium" htmlFor={inputId}>
          {label}
        </Label>
        <span className="text-sm text-muted-foreground" title={description}>
          {value.toFixed(1)}
          <span className="ml-2 inline-flex items-center rounded px-2 py-0.5 text-xs bg-muted">
            {value === 0 ? (t.constraints?.off || "off") : value < 0.7 ? (t.constraints?.low || "low") : value < 1.4 ? (t.constraints?.med || "med") : (t.constraints?.high || "high")}
          </span>
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Native range input replaces missing Slider */}
        <input
          id={inputId}
          type="range"
          min={0}
          max={2}
          step={0.1}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
        />
        <Input
          type="number"
          inputMode="decimal"
          step={0.1}
          min={0}
          max={2}
          value={value.toFixed(1)}
          onChange={(e) => {
            const next = parseFloat(e.target.value)
            onChange(isNaN(next) ? value : next)
          }}
          className="w-20"
          aria-label={`${label} value`}
        />
      </div>

      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  )

  return (
    <div className="space-y-6 max-w-6xl mx-auto" dir={isRTL ? "rtl" : "ltr"}>
      <WizardStepContainer
        title={t.constraints?.title || "Constraint Preferences"}
        description={t.constraints?.description || "Adjust the weights for different scheduling constraints. Higher values make the constraint more important."}
        icon={<Settings className="h-6 w-6 text-blue-600" />}
        isRTL={isRTL}
      >
        <div className="space-y-6">
          {/* Presets row */}
          <div className="flex flex-wrap items-center gap-2">
            <Label className="mr-2">{t.constraints?.presets || "Presets"}:</Label>
            <button
              type="button"
              className="px-3 py-1 rounded border hover:bg-muted"
              onClick={() => {
                const next = {
                  ...localPreferences,
                  avoidTeacherGapsWeight: 1.0,
                  avoidClassGapsWeight: 1.0,
                  balanceTeacherLoadWeight: 0.8,
                  minimizeRoomChangesWeight: 0.3,
                  preferMorningForDifficultWeight: 0.5,
                  respectTeacherTimePreferenceWeight: 0.5,
                  respectTeacherRoomPreferenceWeight: 0.2,
                  avoidFirstLastPeriodWeight: 0.3,
                  subjectSpreadWeight: 0.4,
                }
                setLocalPreferences(next)
                setPreferences(next)
                onDataChange?.()
              }}
              title={t.constraints?.balancedPresetTooltip || "Balanced preset: a good general-purpose starting point"}
            >
              {t.constraints?.balanced || "Balanced"}
            </button>
            <button
              type="button"
              className="px-3 py-1 rounded border hover:bg-muted"
              onClick={() => {
                const next = {
                  ...localPreferences,
                  avoidTeacherGapsWeight: 1.2,
                  avoidClassGapsWeight: 1.0,
                  balanceTeacherLoadWeight: 0.6,
                  minimizeRoomChangesWeight: 0.2,
                  avoidFirstLastPeriodWeight: 0.8,
                  subjectSpreadWeight: 0.6,
                }
                setLocalPreferences(next)
                setPreferences(next)
                onDataChange?.()
              }}
              title={t.constraints?.compactPresetTooltip || "Compact schedules: fewer gaps and less first/last period usage"}
            >
              {t.constraints?.compact || "Compact"}
            </button>
            <button
              type="button"
              className="px-3 py-1 rounded border hover:bg-muted"
              onClick={() => {
                const next = {
                  ...localPreferences,
                  balanceTeacherLoadWeight: 1.2,
                  avoidTeacherGapsWeight: 0.8,
                  subjectSpreadWeight: 0.3,
                }
                setLocalPreferences(next)
                setPreferences(next)
                onDataChange?.()
              }}
              title={t.constraints?.fairLoadPresetTooltip || "Fair teacher load distribution"}
            >
              {t.constraints?.fairLoad || "Fair Load"}
            </button>
            <button
              type="button"
              className="px-3 py-1 rounded border hover:bg-muted"
              onClick={() => {
                const next = {
                  ...localPreferences,
                  subjectSpreadWeight: 1.0,
                  avoidFirstLastPeriodWeight: 0.3,
                  avoidTeacherGapsWeight: 0.8,
                }
                setLocalPreferences(next)
                setPreferences(next)
                onDataChange?.()
              }}
              title={t.constraints?.spreadSubjectsPresetTooltip || "Spread each subject across different days"}
            >
              {t.constraints?.spreadSubjects || "Spread Subjects"}
            </button>
            <button
              type="button"
              className="ml-auto px-3 py-1 rounded border hover:bg-muted"
              onClick={() => {
                setLocalPreferences(defaultPreferences)
                setPreferences(defaultPreferences)
                onDataChange?.()
              }}
              title={t.constraints?.resetTooltip || "Reset all weights to defaults"}
            >
              {t.constraints?.reset || "Reset"}
            </button>
          </div>

          {/* Mode toggle */}
          <div className="flex items-center gap-2">
            <Label>{t.constraints?.mode || "Mode"}:</Label>
            <button
              type="button"
              className={`px-3 py-1 rounded border ${!showAdvanced ? 'bg-muted' : ''}`}
              onClick={() => setShowAdvanced(false)}
            >
              {t.constraints?.simple || "Simple"}
            </button>
            <button
              type="button"
              className={`px-3 py-1 rounded border ${showAdvanced ? 'bg-muted' : ''}`}
              onClick={() => setShowAdvanced(true)}
            >
              {t.constraints?.advanced || "Advanced"}
            </button>
          </div>

          {/* Live summary */}
          <div className="text-sm text-muted-foreground">
            {(() => {
              const parts: string[] = []
              if ((localPreferences.avoidTeacherGapsWeight || 0) > 0) parts.push(t.constraints?.fewerTeacherGaps || "fewer teacher gaps")
              if ((localPreferences.avoidClassGapsWeight || 0) > 0) parts.push(t.constraints?.fewerClassGaps || "fewer class gaps")
              if ((localPreferences.avoidFirstLastPeriodWeight || 0) > 0) parts.push(t.constraints?.avoidFirstLastPeriodsShort || "avoid first/last periods")
              if ((localPreferences.subjectSpreadWeight || 0) > 0) parts.push(t.constraints?.spreadSubjectsAcrossDaysShort || "spread subjects across days")
              if ((localPreferences.balanceTeacherLoadWeight || 0) > 0.5) parts.push(t.constraints?.balanceTeacherLoadShort || "balance teacher load")
              if ((localPreferences.preferMorningForDifficultWeight || 0) > 0) parts.push(t.constraints?.morningForDifficultSubjects || "morning for difficult subjects")
              return parts.length ? `${t.constraints?.youPrefer || "You prefer"} ${parts.join(", ")}.` : (t.constraints?.neutralPreferences || "Using neutral preferences.")
            })()}
          </div>

          {/* Simple section */}
          {!showAdvanced && (
            <>
              <div className="space-y-6">
                <WeightControl
                  label={t.constraints?.avoidTeacherGaps || "Avoid Teacher Gaps"}
                  value={localPreferences.avoidTeacherGapsWeight}
                  onChange={(val) => handleWeightChange("avoidTeacherGapsWeight", val)}
                  description={t.constraints?.avoidTeacherGapsDescription || "Higher = fewer idle gaps between classes in a teacher's day."}
                  inputId="avoidTeacherGapsWeight"
                />
                <WeightControl
                  label={t.constraints?.avoidClassGaps || "Avoid Class Gaps"}
                  value={localPreferences.avoidClassGapsWeight}
                  onChange={(val) => handleWeightChange("avoidClassGapsWeight", val)}
                  description={t.constraints?.avoidClassGapsDescription || "Higher = fewer empty periods during a class's day."}
                  inputId="avoidClassGapsWeight"
                />
                <WeightControl
                  label={t.constraints?.balanceTeacherLoad || "Balance Teacher Load"}
                  value={localPreferences.balanceTeacherLoadWeight}
                  onChange={(val) => handleWeightChange("balanceTeacherLoadWeight", val)}
                  description={t.constraints?.balanceTeacherLoadDescription || "Higher = distribute teaching periods more evenly among teachers."}
                  inputId="balanceTeacherLoadWeight"
                />
                <WeightControl
                  label={t.constraints?.avoidFirstLastPeriods || "Avoid First/Last Periods"}
                  value={localPreferences.avoidFirstLastPeriodWeight}
                  onChange={(val) => handleWeightChange("avoidFirstLastPeriodWeight", val)}
                  description={t.constraints?.avoidFirstLastPeriodsDescription || "Higher = discourage scheduling in period 1 and the last period."}
                  inputId="avoidFirstLastPeriodWeight"
                />
                <WeightControl
                  label={t.constraints?.spreadSubjectsAcrossDays || "Spread Subjects Across Days"}
                  value={localPreferences.subjectSpreadWeight}
                  onChange={(val) => handleWeightChange("subjectSpreadWeight", val)}
                  description={t.constraints?.spreadSubjectsAcrossDaysDescription || "Higher = place the same subject on different days for a class."}
                  inputId="subjectSpreadWeight"
                />
              </div>
            </>
          )}

          {/* Advanced section (original full form + new items) */}
          {showAdvanced && (
            <>
              <WeightControl
                label={t.constraints?.avoidTeacherGaps || "Avoid Teacher Gaps"}
                value={localPreferences.avoidTeacherGapsWeight}
                onChange={(val) => handleWeightChange("avoidTeacherGapsWeight", val)}
                description={t.constraints?.minimizeTeacherGapsDescription || "Minimize gaps in teacher schedules"}
                inputId="avoidTeacherGapsWeight"
              />

              <WeightControl
                label={t.constraints?.avoidClassGaps || "Avoid Class Gaps"}
                value={localPreferences.avoidClassGapsWeight}
                onChange={(val) => handleWeightChange("avoidClassGapsWeight", val)}
                description={t.constraints?.minimizeClassGapsDescription || "Minimize gaps in class schedules"}
                inputId="avoidClassGapsWeight"
              />

              <WeightControl
                label={t.constraints?.distributeDifficultSubjects || "Distribute Difficult Subjects"}
                value={localPreferences.distributeDifficultSubjectsWeight}
                onChange={(val) => handleWeightChange("distributeDifficultSubjectsWeight", val)}
                description={t.constraints?.distributeDifficultSubjectsDescription || "Spread difficult subjects throughout the week"}
                inputId="distributeDifficultSubjectsWeight"
              />

              <WeightControl
                label={t.constraints?.balanceTeacherLoad || "Balance Teacher Load"}
                value={localPreferences.balanceTeacherLoadWeight}
                onChange={(val) => handleWeightChange("balanceTeacherLoadWeight", val)}
                description={t.constraints?.distributeTeacherLoadDescription || "Distribute teaching periods evenly among teachers"}
                inputId="balanceTeacherLoadWeight"
              />

              <WeightControl
                label={t.constraints?.minimizeRoomChanges || "Minimize Room Changes"}
                value={localPreferences.minimizeRoomChangesWeight}
                onChange={(val) => handleWeightChange("minimizeRoomChangesWeight", val)}
                description={t.constraints?.minimizeRoomChangesDescription || "Reduce the number of room changes for classes"}
                inputId="minimizeRoomChangesWeight"
              />

              <WeightControl
                label={t.constraints?.preferMorningForDifficultSubjects || "Prefer Morning for Difficult Subjects"}
                value={localPreferences.preferMorningForDifficultWeight}
                onChange={(val) => handleWeightChange("preferMorningForDifficultWeight", val)}
                description={t.constraints?.preferMorningForDifficultSubjectsDescription || "Schedule difficult subjects in the morning"}
                inputId="preferMorningForDifficultWeight"
              />

              <WeightControl
                label={t.constraints?.respectTeacherTimePreferences || "Respect Teacher Time Preferences"}
                value={localPreferences.respectTeacherTimePreferenceWeight}
                onChange={(val) => handleWeightChange("respectTeacherTimePreferenceWeight", val)}
                description={t.constraints?.respectTeacherTimePreferencesDescription || "Honor teacher preferences for morning/afternoon teaching"}
                inputId="respectTeacherTimePreferenceWeight"
              />

              <WeightControl
                label={t.constraints?.respectTeacherRoomPreferences || "Respect Teacher Room Preferences"}
                value={localPreferences.respectTeacherRoomPreferenceWeight}
                onChange={(val) => handleWeightChange("respectTeacherRoomPreferenceWeight", val)}
                description={t.constraints?.respectTeacherRoomPreferencesDescription || "Use rooms preferred by teachers when possible"}
                inputId="respectTeacherRoomPreferenceWeight"
              />

              <WeightControl
                label={t.constraints?.avoidFirstLastPeriods || "Avoid First/Last Periods"}
                value={localPreferences.avoidFirstLastPeriodWeight}
                onChange={(val) => handleWeightChange("avoidFirstLastPeriodWeight", val)}
                description={t.constraints?.avoidFirstLastPeriodsDescription || "Discourage scheduling in first or last period of the day"}
                inputId="avoidFirstLastPeriodWeight"
              />

              <WeightControl
                label={t.constraints?.spreadSubjectsAcrossDays || "Spread Subjects Across Days"}
                value={localPreferences.subjectSpreadWeight}
                onChange={(val) => handleWeightChange("subjectSpreadWeight", val)}
                description={t.constraints?.spreadSubjectsAcrossDaysDescription || "Encourage distributing a subject across different days"}
                inputId="subjectSpreadWeight"
              />

              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-4">{t.constraints?.capabilitySettings || "Capability Settings"}</h3>
                <p className="text-sm text-muted-foreground mb-4">{t.constraints?.capabilitySettingsDescription || "Configure scheduling capabilities and rules"}</p>
              <div className="flex items-center space-x-2">
                {/* Native checkbox replaces missing UI Checkbox component */}
                <input
                  id="allowConsecutivePeriods"
                  type="checkbox"
                  checked={!!localPreferences.allowConsecutivePeriodsForSameSubject}
                  onChange={(e) =>
                    handleCheckboxChange("allowConsecutivePeriodsForSameSubject", e.target.checked)
                  }
                  className="h-4 w-4 accent-primary"
                />
                <Label htmlFor="allowConsecutivePeriods">
                  {t.periods?.allowConsecutivePeriods || "Allow consecutive periods for the same subject"}
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                {t.periods?.allowConsecutivePeriodsDescription || "When enabled, the scheduler can arrange the same subject in consecutive periods for better flow."}
              </p>
              </div>
            </>
          )}
        </div>
      </WizardStepContainer>
    </div>
  )
}