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
  allowConsecutivePeriodsForSameSubject: true,
}

function clampToRange(val: number, min = 0, max = 2, step = 0.1) {
  const clamped = Math.min(max, Math.max(min, val))
  const rounded = Math.round(clamped / step) * step
  return Number(rounded.toFixed(1))
}

export function ConstraintsStep({ onDataChange }: ConstraintsStepProps) {
  const { preferences, setPreferences } = useWizardStore()
  const [localPreferences, setLocalPreferences] = useState<Preferences>({
    ...defaultPreferences,
    ...(preferences as Partial<Preferences>),
  })

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
        <span className="text-sm text-muted-foreground">{value.toFixed(1)}</span>
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
    <div className="space-y-6 max-w-6xl mx-auto">
      <WizardStepContainer
        title="Constraint Preferences"
        description="Adjust the weights for different scheduling constraints. Higher values make the constraint more important."
        icon={<Settings className="h-6 w-6 text-blue-600" />}
      >
        <div className="space-y-6">
          <WeightControl
            label="Avoid Teacher Gaps"
            value={localPreferences.avoidTeacherGapsWeight}
            onChange={(val) => handleWeightChange("avoidTeacherGapsWeight", val)}
            description="Minimize gaps in teacher schedules"
            inputId="avoidTeacherGapsWeight"
          />

          <WeightControl
            label="Avoid Class Gaps"
            value={localPreferences.avoidClassGapsWeight}
            onChange={(val) => handleWeightChange("avoidClassGapsWeight", val)}
            description="Minimize gaps in class schedules"
            inputId="avoidClassGapsWeight"
          />

          <WeightControl
            label="Distribute Difficult Subjects"
            value={localPreferences.distributeDifficultSubjectsWeight}
            onChange={(val) => handleWeightChange("distributeDifficultSubjectsWeight", val)}
            description="Spread difficult subjects throughout the week"
            inputId="distributeDifficultSubjectsWeight"
          />

          <WeightControl
            label="Balance Teacher Load"
            value={localPreferences.balanceTeacherLoadWeight}
            onChange={(val) => handleWeightChange("balanceTeacherLoadWeight", val)}
            description="Distribute teaching periods evenly among teachers"
            inputId="balanceTeacherLoadWeight"
          />

          <WeightControl
            label="Minimize Room Changes"
            value={localPreferences.minimizeRoomChangesWeight}
            onChange={(val) => handleWeightChange("minimizeRoomChangesWeight", val)}
            description="Reduce the number of room changes for classes"
            inputId="minimizeRoomChangesWeight"
          />

          <WeightControl
            label="Prefer Morning for Difficult Subjects"
            value={localPreferences.preferMorningForDifficultWeight}
            onChange={(val) => handleWeightChange("preferMorningForDifficultWeight", val)}
            description="Schedule difficult subjects in the morning"
            inputId="preferMorningForDifficultWeight"
          />

          <WeightControl
            label="Respect Teacher Time Preferences"
            value={localPreferences.respectTeacherTimePreferenceWeight}
            onChange={(val) => handleWeightChange("respectTeacherTimePreferenceWeight", val)}
            description="Honor teacher preferences for morning/afternoon teaching"
            inputId="respectTeacherTimePreferenceWeight"
          />

          <WeightControl
            label="Respect Teacher Room Preferences"
            value={localPreferences.respectTeacherRoomPreferenceWeight}
            onChange={(val) => handleWeightChange("respectTeacherRoomPreferenceWeight", val)}
            description="Use rooms preferred by teachers when possible"
            inputId="respectTeacherRoomPreferenceWeight"
          />
          
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-4">Capability Settings</h3>
            <p className="text-sm text-muted-foreground mb-4">Configure scheduling capabilities and rules</p>
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
              Allow consecutive periods for the same subject
            </Label>
          </div>
          <p className="text-xs text-muted-foreground">
            When enabled, the scheduler can arrange the same subject in consecutive periods for better flow.
          </p>
          </div>
        </div>
      </WizardStepContainer>
    </div>
  )
}