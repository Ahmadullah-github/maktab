import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Check, HelpCircle, Clock, Save } from "lucide-react"
import { useLanguage, rtlRow } from "@/hooks/useLanguage"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"
import { cn } from "@/lib/utils/tailwaindMergeUtil"

interface WizardContainerProps {
  title: string
  description: string
  steps: {
    key: string
    title: string
    description: string
  }[]
  currentStep: number
  onNext: () => void
  onBack: () => void
  onFinish: () => void
  children: React.ReactNode
  onSave?: () => Promise<void>
}

export function WizardContainer({
  title,
  description,
  steps,
  currentStep,
  onNext,
  onBack,
  onFinish,
  children,
  onSave,
}: WizardContainerProps) {
  const isLastStep = currentStep === steps.length - 1
  const isFirstStep = currentStep === 0
  const [isAnimating, setIsAnimating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const { isRTL, t } = useLanguage()
  
  const progress = ((currentStep + 1) / steps.length) * 100

  const handleNext = () => {
    setIsAnimating(true)
    setTimeout(() => {
      onNext()
      setIsAnimating(false)
    }, 200)
  }

  const handleBack = () => {
    setIsAnimating(true)
    setTimeout(() => {
      onBack()
      setIsAnimating(false)
    }, 200)
  }

  const handleSave = async () => {
    if (!onSave) return
    setIsSaving(true)
    try {
      await onSave()
      toast.success(t.actions.save || "Saved successfully")
    } catch (error) {
      toast.error("Failed to save")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="w-full h-full flex flex-col" dir={isRTL ? "rtl" : "ltr"}>
      <Card className="flex-1 overflow-hidden border-none shadow-lg min-h-[600px]">
        {/* Enhanced Header */}
        <CardHeader className="pb-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
          <div className="flex flex-col space-y-4">
            {/* Title and Actions */}
            <div className={cn("flex flex-row justify-between items-center gap-6", isRTL && "flex-row-reverse")}>
              <div className={cn("flex-1", isRTL ? "text-right" : "text-left")}>
                <CardTitle className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                  {title}
                </CardTitle>
                <CardDescription className="text-lg text-gray-600 dark:text-gray-300">
                  {description}
                </CardDescription>
              </div>
              
              <div className={cn("flex items-center gap-3", isRTL ? "flex-row-reverse" : "")}>
                {/* Save button */}
                {onSave && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="border-blue-200 hover:bg-blue-50"
                  >
                    <Save className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
                    {isSaving ? "Saving..." : t.actions.save || "Save"}
                  </Button>
                )}
                
                {/* Step counter */}
                <div className="flex items-center rounded-full bg-white dark:bg-gray-800 px-4 py-2 border border-blue-200 shadow-sm">
                  <Clock className={cn("w-4 h-4 text-blue-600", isRTL ? "ml-2" : "mr-2")} />
                  <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                    {t.wizard.steps[currentStep]?.school || currentStep + 1} / {steps.length}
                  </span>
                </div>
                
                {/* Help button */}
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-blue-50">
                  <HelpCircle className="h-5 w-5 text-gray-600" />
                </Button>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                <span>Progress</span>
                <span className="font-medium">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </div>
        </CardHeader>

        {/* Steps Indicator */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-b">
          <div className="flex items-center overflow-x-auto pb-2">
            {steps.map((step, index) => {
              const isCurrent = index === currentStep
              const isCompleted = index < currentStep
              const isFuture = index > currentStep

              return (
                <React.Fragment key={step.key}>
                  <div className="flex flex-col items-center flex-shrink-0">
                    {/* Step Circle */}
                    <div
                      className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all duration-300 relative",
                        isCompleted
                          ? "bg-green-500 border-green-600 shadow-md scale-110"
                          : isCurrent
                            ? "bg-blue-500 border-blue-600 shadow-lg scale-110 ring-4 ring-blue-200"
                            : "bg-white dark:bg-gray-800 border-gray-300"
                      )}
                    >
                      {isCompleted ? (
                        <Check className="h-6 w-6 text-white" strokeWidth={3} />
                      ) : (
                        <span
                          className={cn(
                            "text-sm font-bold",
                            isCurrent
                              ? "text-white"
                              : "text-gray-500 dark:text-gray-400"
                          )}
                        >
                          {index + 1}
                        </span>
                      )}
                    </div>
                    
                    {/* Step Label */}
                    <div className="mt-2 text-center max-w-[100px]">
                      <p
                        className={cn(
                          "text-xs font-medium transition-all duration-300",
                          isCurrent
                            ? "text-blue-600 dark:text-blue-400 font-bold"
                            : isCompleted
                              ? "text-green-600 dark:text-green-400"
                              : "text-gray-500 dark:text-gray-400"
                        )}
                      >
                        {step.title}
                      </p>
                    </div>
                  </div>
                  
                  {/* Connector Line */}
                  {index < steps.length - 1 && (
                    <div
                      className={cn(
                        "flex-1 h-1 mx-2 transition-all duration-300 rounded-full mt-6",
                        isCompleted
                          ? "bg-green-500"
                          : isCurrent
                            ? "bg-blue-300"
                            : "bg-gray-300 dark:bg-gray-700"
                      )}
                    />
                  )}
                </React.Fragment>
              )
            })}
          </div>
        </div>

        {/* Content Area */}
        <CardContent className="pt-6 px-6 min-h-[500px] relative">
          <div
            className={cn(
              "transition-all duration-300",
              isAnimating ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"
            )}
          >
            {children}
          </div>
        </CardContent>

        {/* Footer */}
        <CardFooter className="flex justify-between px-6 py-4 border-t bg-gray-50 dark:bg-gray-900">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={isFirstStep}
            className={cn(
              "min-w-[120px]",
              isRTL && "ml-auto"
            )}
          >
            <ChevronLeft className={cn("h-4 w-4", isRTL && "ml-2 rotate-180")} />
            {t.wizard.previous || "Previous"}
          </Button>

          {isLastStep ? (
            <Button
              onClick={onFinish}
              className="min-w-[120px] bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-md"
            >
              {t.wizard.generate || "Generate"}
              <ChevronRight className={cn("h-4 w-4", isRTL ? "mr-2 rotate-180" : "ml-2")} />
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              className="min-w-[120px] bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md"
            >
              {t.wizard.next || "Next"}
              <ChevronRight className={cn("h-4 w-4", isRTL ? "mr-2 rotate-180" : "ml-2")} />
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}