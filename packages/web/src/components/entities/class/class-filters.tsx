import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils/tailwaindMergeUtil";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ClassFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedGrade: string;
  onGradeChange: (value: string) => void;
  selectedSection: string;
  onSectionChange: (value: string) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
  grades: number[];
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  isRTL?: boolean;
}

export function ClassFilters({
  searchTerm,
  onSearchChange,
  selectedGrade,
  onGradeChange,
  selectedSection,
  onSectionChange,
  sortBy,
  onSortChange,
  grades,
  onClearFilters,
  hasActiveFilters,
  isRTL = false,
}: ClassFiltersProps) {
  const sections = [
    { value: 'PRIMARY', label: isRTL ? 'ابتدایی' : 'Primary', color: 'bg-blue-500' },
    { value: 'MIDDLE', label: isRTL ? 'متوسطه' : 'Middle', color: 'bg-green-500' },
    { value: 'HIGH', label: isRTL ? 'دبیرستان' : 'High', color: 'bg-purple-500' },
  ];

  return (
    <div className="space-y-4 mb-6">
      {/* Search and Sort Row */}
      <div className={cn(
        "flex flex-col sm:flex-row gap-4",
        isRTL && "sm:flex-row"
      )}>
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className={cn(
            "absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400",
            isRTL ? "right-3" : "left-3"
          )} />
          <Input
            type="text"
            placeholder={isRTL ? "جستجوی صنف..." : "Search classes..."}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className={cn(
              "w-full",
              isRTL ? "pr-10 text-right" : "pl-10"
            )}
          />
          {searchTerm && (
            <button
              onClick={() => onSearchChange("")}
              className={cn(
                "absolute top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600",
                isRTL ? "left-3" : "right-3"
              )}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Sort Dropdown */}
        <Select value={sortBy} onValueChange={onSortChange}>
          <SelectTrigger className={cn(
            "w-full sm:w-[200px]",
            isRTL && "flex-row"
          )}>
            <ArrowUpDown className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
            <SelectValue placeholder={isRTL ? "مرتب‌سازی" : "Sort by"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name-asc">
              {isRTL ? "نام (الف-ی)" : "Name (A-Z)"}
            </SelectItem>
            <SelectItem value="name-desc">
              {isRTL ? "نام (ی-الف)" : "Name (Z-A)"}
            </SelectItem>
            <SelectItem value="grade-asc">
              {isRTL ? "پایه (کمترین)" : "Grade (Low-High)"}
            </SelectItem>
            <SelectItem value="grade-desc">
              {isRTL ? "پایه (بیشترین)" : "Grade (High-Low)"}
            </SelectItem>
            <SelectItem value="students-desc">
              {isRTL ? "دانش‌آموزان (بیشترین)" : "Students (High-Low)"}
            </SelectItem>
            <SelectItem value="students-asc">
              {isRTL ? "دانش‌آموزان (کمترین)" : "Students (Low-High)"}
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="default"
            onClick={onClearFilters}
            className={cn(
              "whitespace-nowrap",
              isRTL && "flex-row"
            )}
          >
            <X className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
            {isRTL ? "پاک کردن فیلترها" : "Clear Filters"}
          </Button>
        )}
      </div>

      {/* Section and Grade Filter Pills - Combined in one row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Section Filter */}
        <div className="space-y-2">
          <label className={cn(
            "text-sm font-medium text-gray-700 dark:text-gray-300",
            isRTL && "text-right block"
          )}>
            {isRTL ? "بخش:" : "Section:"}
          </label>
          <div className={cn(
            "flex flex-wrap gap-2",
            isRTL && "flex-row"
          )}>
            <Badge
              variant={selectedSection === "all" ? "default" : "outline"}
              className="cursor-pointer hover:bg-primary/90 transition-colors px-4 py-2"
              onClick={() => onSectionChange("all")}
            >
              {isRTL ? "همه" : "All"}
            </Badge>

            {sections.map((section) => (
              <Badge
                key={section.value}
                variant={selectedSection === section.value ? "default" : "outline"}
                className={cn(
                  "cursor-pointer hover:bg-primary/90 transition-colors px-4 py-2",
                  selectedSection === section.value && section.color + " text-white hover:opacity-90"
                )}
                onClick={() => onSectionChange(section.value)}
              >
                {section.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Grade Level Filter */}
        {grades.length > 0 && (
          <div className="space-y-2">
            <label className={cn(
              "text-sm font-medium text-gray-700 dark:text-gray-300",
              isRTL && "text-right block"
            )}>
              {isRTL ? "پایه:" : "Grade:"}
            </label>
            <div className={cn(
              "flex flex-wrap gap-2",
              isRTL && "flex-row"
            )}>
              <Badge
                variant={selectedGrade === "all" ? "default" : "outline"}
                className="cursor-pointer hover:bg-primary/90 transition-colors px-4 py-2"
                onClick={() => onGradeChange("all")}
              >
                {isRTL ? "همه" : "All"}
              </Badge>

              {grades.map((grade) => (
                <Badge
                  key={grade}
                  variant={selectedGrade === String(grade) ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/90 transition-colors px-4 py-2"
                  onClick={() => onGradeChange(String(grade))}
                >
                  {isRTL ? `پایه ${grade}` : `Grade ${grade}`}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

