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

interface TeacherFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedSubject: string;
  onSubjectChange: (value: string) => void;
  selectedPeriodsFilter: string;
  onPeriodsFilterChange: (value: string) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
  subjects: Array<{ id: string; name: string }>;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  isRTL?: boolean;
}

export function TeacherFilters({
  searchTerm,
  onSearchChange,
  selectedSubject,
  onSubjectChange,
  selectedPeriodsFilter,
  onPeriodsFilterChange,
  sortBy,
  onSortChange,
  subjects,
  onClearFilters,
  hasActiveFilters,
  isRTL = false,
}: TeacherFiltersProps) {
  const periodsFilters = [
    { value: 'all', label: isRTL ? 'همه' : 'All' },
    { value: 'overloaded', label: isRTL ? 'بیش از حد' : 'Overloaded' },
    { value: 'underloaded', label: isRTL ? 'کم‌بار' : 'Underloaded' },
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
            placeholder={isRTL ? "جستجوی معلم..." : "Search teachers..."}
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
            <SelectItem value="periods-asc">
              {isRTL ? "دوره‌ها (کمترین)" : "Periods (Low-High)"}
            </SelectItem>
            <SelectItem value="periods-desc">
              {isRTL ? "دوره‌ها (بیشترین)" : "Periods (High-Low)"}
            </SelectItem>
            <SelectItem value="classes-asc">
              {isRTL ? "صنف‌ها (کمترین)" : "Classes (Low-High)"}
            </SelectItem>
            <SelectItem value="classes-desc">
              {isRTL ? "صنف‌ها (بیشترین)" : "Classes (High-Low)"}
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

      {/* Subject and Periods Filter Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Subject Filter */}
        <div className="space-y-2">
          <label className={cn(
            "text-sm font-medium text-gray-700 dark:text-gray-300",
            isRTL && "text-right block"
          )}>
            {isRTL ? "ماده تخصصی:" : "Expert Subject:"}
          </label>
          <Select value={selectedSubject} onValueChange={onSubjectChange}>
            <SelectTrigger className={cn(
              "w-full",
              isRTL && "flex-row"
            )}>
              <SelectValue placeholder={isRTL ? "همه مواد" : "All Subjects"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {isRTL ? "همه مواد" : "All Subjects"}
              </SelectItem>
              {subjects.map((subject) => (
                <SelectItem key={subject.id} value={subject.id}>
                  {subject.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Periods Filter */}
        <div className="space-y-2">
        <label className={cn(
          "text-sm font-medium text-gray-700 dark:text-gray-300",
          isRTL && "text-right block"
        )}>
          {isRTL ? "بار دوره‌ها:" : "Periods Load:"}
        </label>
        <div className={cn(
          "flex flex-wrap gap-2",
          isRTL && "flex-row"
        )}>
          {periodsFilters.map((filter) => (
            <Badge
              key={filter.value}
              variant={selectedPeriodsFilter === filter.value ? "default" : "outline"}
              className={cn(
                "cursor-pointer hover:bg-primary/90 transition-colors px-4 py-2",
                selectedPeriodsFilter === filter.value && 
                (filter.value === 'overloaded' ? "bg-red-500 text-white hover:opacity-90" :
                 filter.value === 'underloaded' ? "bg-amber-500 text-white hover:opacity-90" :
                 "hover:opacity-90")
              )}
              onClick={() => onPeriodsFilterChange(filter.value)}
            >
              {filter.label}
            </Badge>
          ))}
        </div>
      </div>
    </div>
    </div>
  );
}

