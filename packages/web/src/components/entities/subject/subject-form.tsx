import React, { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Subject } from "@/types"
import { z } from "zod"
import { subjectFormSchema } from "@/schemas/subjectSchema"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils/tailwaindMergeUtil"
import { Save, X, Info } from "lucide-react"
import { useWizardStore } from "@/stores/useWizardStore"

interface SubjectFormProps {
  subject?: Subject
  onSubmit: (subject: Omit<Subject, 'id'> | Subject) => void
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

// Common room types for subjects
const COMMON_ROOM_TYPES = [
  "Regular",
  "Chemistry Lab",
  "Physics Lab",
  "Computer Lab",
  "Biology Lab",
  "Library",
  "Gymnasium",
];

export function SubjectForm({ subject, onSubmit, onCancel, isRTL = false }: SubjectFormProps) {
  const { schoolInfo, periodsInfo } = useWizardStore();
  
  const [formData, setFormData] = useState({
    name: subject?.name || "",
    code: subject?.code || "",
    grade: subject?.grade || undefined,
    periodsPerWeek: subject?.periodsPerWeek || undefined,
    isDifficult: subject?.isDifficult || false,
    requiredRoomType: subject?.requiredRoomType || "",
  })
  
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Auto-determine section from grade
  const section = useMemo(() => gradeToSection(formData.grade), [formData.grade]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target
    const checked = type === "checkbox" ? (e.target as HTMLInputElement).checked : undefined
    const newValue = name === "periodsPerWeek" ? (value ? Number(value) : undefined) : value
    
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : newValue
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
      subjectFormSchema.parse(submitData)
      
      // Submit form
      if (subject) {
        onSubmit({ ...submitData, id: subject.id })
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
        {/* Subject Name */}
          <div className="space-y-2">
          <Label htmlFor="name" className={cn(isRTL && "text-right block")}>
            {isRTL ? "نام ماده" : "Subject Name"} <span className="text-red-500">*</span>
          </Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
            placeholder={isRTL ? "مثال: ریاضیات" : "e.g., Mathematics"}
            className={cn(isRTL && "text-right")}
            />
            {errors.name && (
            <p className={cn("text-sm text-destructive", isRTL && "text-right")}>{errors.name}</p>
            )}
          </div>
          
        {/* Subject Code */}
          <div className="space-y-2">
          <Label htmlFor="code" className={cn(isRTL && "text-right block")}>
            {isRTL ? "کد ماده" : "Subject Code"}
          </Label>
            <Input
              id="code"
              name="code"
              value={formData.code}
              onChange={handleChange}
            placeholder={isRTL ? "مثال: MATH-7" : "e.g., MATH-7"}
            className={cn(isRTL && "text-right")}
          />
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
          
        {/* Auto-determined Section Info */}
        {formData.grade && section && (
          <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 rounded-lg border-2 border-blue-200 dark:border-blue-800">
            <div className={cn("flex items-start gap-2", isRTL && "flex-row")}>
              <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
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
              </div>
            </div>
          </div>
        )}

        {/* Periods Per Week */}
        <div className="space-y-2">
          <Label htmlFor="periodsPerWeek" className={cn(isRTL && "text-right block")}>
            {isRTL ? "دوره‌ها در هفته" : "Periods Per Week"}
          </Label>
          <Input
            id="periodsPerWeek"
            name="periodsPerWeek"
            type="number"
            value={formData.periodsPerWeek || ""}
            onChange={handleChange}
            placeholder={isRTL ? "تعداد دوره‌ها" : "Number of periods"}
            min="1"
            max="20"
            className={cn(isRTL && "text-right")}
          />
        </div>

        {/* Difficult Subject Toggle */}
        <div className={cn(
          "flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800",
          isRTL && "flex-row"
        )}>
          <Label htmlFor="isDifficult" className={cn("cursor-pointer", isRTL && "text-right")}>
            {isRTL ? "ماده دشوار" : "Difficult Subject"}
          </Label>
            <Switch
              id="isDifficult"
              name="isDifficult"
              checked={formData.isDifficult}
              onCheckedChange={(checked) => 
                setFormData(prev => ({ ...prev, isDifficult: checked }))
              }
            />
          </div>
          
        {/* Required Room Type */}
          <div className="space-y-2">
          <Label htmlFor="requiredRoomType" className={cn(isRTL && "text-right block")}>
            {isRTL ? "نوع کلاس مورد نیاز" : "Required Room Type"}
          </Label>
            <Input
              id="requiredRoomType"
              name="requiredRoomType"
              value={formData.requiredRoomType}
              onChange={handleChange}
            placeholder={isRTL ? "مثال: آزمایشگاه کیمیا" : "e.g., Chemistry Lab"}
            list="room-types"
            className={cn(isRTL && "text-right")}
          />
          <datalist id="room-types">
            {COMMON_ROOM_TYPES.map(type => (
              <option key={type} value={type} />
            ))}
          </datalist>
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
          {subject ? (isRTL ? "بروزرسانی" : "Update") : (isRTL ? "ذخیره" : "Save")}
          </Button>
      </div>
      </form>
  )
}