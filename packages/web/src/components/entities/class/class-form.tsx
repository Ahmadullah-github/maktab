import React, { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ClassGroup } from "@/types"
import { z } from "zod"
import { classFormSchema } from "@/schemas/classSchema"
import { cn } from "@/lib/utils/tailwaindMergeUtil"
import { Save, X, Info } from "lucide-react"
import { useWizardStore } from "@/stores/useWizardStore"

interface ClassFormProps {
  classGroup?: ClassGroup
  onSubmit: (classGroup: Omit<ClassGroup, 'id'> | ClassGroup) => void
  onCancel: () => void
  isRTL?: boolean
}

// Helper function to map grade to section
const gradeToSection = (grade: number | null | undefined): 'PRIMARY' | 'MIDDLE' | 'HIGH' | undefined => {
  if (!grade) return undefined;
  if (grade >= 1 && grade <= 6) return 'PRIMARY';
  if (grade >= 7 && grade <= 9) return 'MIDDLE';
  if (grade >= 10 && grade <= 12) return 'HIGH';
  return undefined;
};

// Helper to get section label
const getSectionLabel = (section: 'PRIMARY' | 'MIDDLE' | 'HIGH' | undefined, isRTL: boolean): string => {
  if (!section) return '';
  if (isRTL) {
    switch (section) {
      case 'PRIMARY': return 'ابتدایی';
      case 'MIDDLE': return 'متوسطه';
      case 'HIGH': return 'دبیرستان';
    }
  }
  return section;
};

export function ClassForm({ classGroup, onSubmit, onCancel, isRTL = false }: ClassFormProps) {
  const { schoolInfo, periodsInfo } = useWizardStore();
  
  const [formData, setFormData] = useState({
    name: classGroup?.name || "",
    studentCount: classGroup?.studentCount || 30,
    grade: classGroup?.grade || undefined,
    subjectRequirements: classGroup?.subjectRequirements || [],
  })
  
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Auto-determine section from grade
  const section = useMemo(() => gradeToSection(formData.grade), [formData.grade]);

  // Calculate periods per week for selected grade
  const periodsPerWeek = useMemo(() => {
    if (!section) return null;
    
    const daysPerWeek = schoolInfo?.daysPerWeek || 6;
    const commonPeriodsPerDay = schoolInfo?.periodsPerDay || periodsInfo?.periodsPerDay || 7;
    // Break periods are time gaps between teaching periods, not replacements
    // Total teaching periods per week = periods per day * days per week
    return commonPeriodsPerDay * daysPerWeek;
  }, [section, schoolInfo, periodsInfo]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    const newValue = name === "studentCount" ? Number(value) : value
    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }))
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  const handleGradeSelect = (grade: number) => {
    setFormData(prev => ({
      ...prev,
      grade
    }))
    // Clear grade error when selected
    if (errors.grade) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors.grade
        return newErrors
      })
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate grade is selected
    if (!formData.grade) {
      setErrors({ grade: isRTL ? 'لطفاً پایه را انتخاب کنید' : 'Please select a grade' });
      return;
    }
    
    try {
      // Prepare data with auto-determined section
      const submitData = {
        ...formData,
        section: section, // Auto-determined from grade
      };
      
      // Validate form data
      classFormSchema.parse(submitData)
      
      // Submit form
      if (classGroup) {
        onSubmit({ ...submitData, id: classGroup.id })
      } else {
        onSubmit(submitData)
      }
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        {/* Class Name */}
          <div className="space-y-2">
          <Label htmlFor="name" className={cn(isRTL && "text-right block")}>
            {isRTL ? "نام صنف" : "Class Name"} <span className="text-red-500">*</span>
          </Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
            placeholder={isRTL ? "مثال: صنف 7-A" : "e.g., Class 7-A"}
            className={cn(isRTL && "text-right")}
            />
            {errors.name && (
            <p className={cn("text-sm text-destructive", isRTL && "text-right")}>{errors.name}</p>
          )}
        </div>

        {/* Grade Selection - Visual Pills */}
        <div className="space-y-3">
          <Label className={cn(isRTL && "text-right block")}>
            {isRTL ? "پایه" : "Grade"} <span className="text-red-500">*</span>
          </Label>
          
          {/* PRIMARY Grades (1-6) */}
          <div className="space-y-2">
            <div className={cn("text-xs font-medium text-blue-600 dark:text-blue-400", isRTL && "text-right")}>
              {isRTL ? "ابتدایی" : "PRIMARY"}
            </div>
            <div className={cn("flex flex-wrap gap-2", isRTL && "flex-row")}>
              {[1, 2, 3, 4, 5, 6].map((grade) => (
                <Badge
                  key={grade}
                  variant={formData.grade === grade ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer px-4 py-2 text-base transition-all",
                    formData.grade === grade 
                      ? "bg-blue-500 text-white hover:bg-blue-600" 
                      : "hover:bg-blue-50 dark:hover:bg-blue-950"
                  )}
                  onClick={() => handleGradeSelect(grade)}
                >
                  {grade}
                </Badge>
              ))}
            </div>
          </div>

          {/* MIDDLE Grades (7-9) */}
          <div className="space-y-2">
            <div className={cn("text-xs font-medium text-green-600 dark:text-green-400", isRTL && "text-right")}>
              {isRTL ? "متوسطه" : "MIDDLE"}
            </div>
            <div className={cn("flex flex-wrap gap-2", isRTL && "flex-row")}>
              {[7, 8, 9].map((grade) => (
                <Badge
                  key={grade}
                  variant={formData.grade === grade ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer px-4 py-2 text-base transition-all",
                    formData.grade === grade 
                      ? "bg-green-500 text-white hover:bg-green-600" 
                      : "hover:bg-green-50 dark:hover:bg-green-950"
                  )}
                  onClick={() => handleGradeSelect(grade)}
                >
                  {grade}
                </Badge>
              ))}
            </div>
          </div>

          {/* HIGH Grades (10-12) */}
          <div className="space-y-2">
            <div className={cn("text-xs font-medium text-purple-600 dark:text-purple-400", isRTL && "text-right")}>
              {isRTL ? "دبیرستان" : "HIGH"}
            </div>
            <div className={cn("flex flex-wrap gap-2", isRTL && "flex-row")}>
              {[10, 11, 12].map((grade) => (
                <Badge
                  key={grade}
                  variant={formData.grade === grade ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer px-4 py-2 text-base transition-all",
                    formData.grade === grade 
                      ? "bg-purple-500 text-white hover:bg-purple-600" 
                      : "hover:bg-purple-50 dark:hover:bg-purple-950"
                  )}
                  onClick={() => handleGradeSelect(grade)}
                >
                  {grade}
                </Badge>
              ))}
            </div>
          </div>

          {errors.grade && (
            <p className={cn("text-sm text-destructive", isRTL && "text-right")}>{errors.grade}</p>
            )}
          </div>
          
        {/* Auto-determined Section & Periods Info */}
        {formData.grade && section && (
          <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 rounded-lg border-2 border-blue-200 dark:border-blue-800">
            <div className={cn("flex items-start gap-2", isRTL && "flex-row")}>
              <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className={cn("text-sm font-semibold text-blue-900 dark:text-blue-100", isRTL && "text-right")}>
                  {isRTL ? "اطلاعات خودکار:" : "Auto-determined:"}
                </p>
                <p className={cn("text-sm text-blue-800 dark:text-blue-200", isRTL && "text-right")}>
                  <span className="font-medium">{isRTL ? "بخش:" : "Section:"}</span>{" "}
                  <Badge className={cn(
                    "ml-1",
                    section === 'PRIMARY' ? "bg-blue-500" : 
                    section === 'MIDDLE' ? "bg-green-500" : "bg-purple-500"
                  )}>
                    {getSectionLabel(section, isRTL)}
                  </Badge>
                </p>
                {periodsPerWeek && (
                  <p className={cn("text-sm text-blue-800 dark:text-blue-200", isRTL && "text-right")}>
                    <span className="font-medium">{isRTL ? "دوره‌ها در هفته:" : "Periods per week:"}</span>{" "}
                    <span className="font-bold">{periodsPerWeek}</span>
                    {schoolInfo && (
                      <span className="text-xs ml-1">
                        ({isRTL 
                          ? `${schoolInfo.periodsPerDay || 7} دوره/روز × ${schoolInfo.daysPerWeek || 6} روز`
                          : `${schoolInfo.periodsPerDay || 7} periods/day × ${schoolInfo.daysPerWeek || 6} days`
                        })
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Student Count */}
          <div className="space-y-2">
          <Label htmlFor="studentCount" className={cn(isRTL && "text-right block")}>
            {isRTL ? "تعداد دانش‌آموزان" : "Student Count"} <span className="text-red-500">*</span>
          </Label>
            <Input
              id="studentCount"
              name="studentCount"
              type="number"
              value={formData.studentCount}
              onChange={handleChange}
            placeholder={isRTL ? "تعداد دانش‌آموزان" : "Number of students"}
            min="1"
            max="100"
            className={cn(isRTL && "text-right")}
            />
            {errors.studentCount && (
            <p className={cn("text-sm text-destructive", isRTL && "text-right")}>{errors.studentCount}</p>
            )}
          </div>

        {/* Help Text */}
        <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-md">
          <p className={cn("text-sm text-blue-900 dark:text-blue-100", isRTL && "text-right")}>
            {isRTL 
              ? "همه فیلدهای علامت‌دار با * الزامی هستند."
              : "All fields marked with * are required."}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className={cn(
        "flex gap-3 pt-4 border-t",
        isRTL ? "flex-row" : ""
      )}>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className={cn("flex-1", isRTL && "flex-row")}
        >
          <X className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
          {isRTL ? "لغو" : "Cancel"}
          </Button>
        <Button
          type="submit"
          className={cn("flex-1", isRTL && "flex-row")}
        >
          <Save className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
          {classGroup ? (isRTL ? "بروزرسانی" : "Update") : (isRTL ? "ذخیره" : "Save")}
          </Button>
      </div>
      </form>
  )
}