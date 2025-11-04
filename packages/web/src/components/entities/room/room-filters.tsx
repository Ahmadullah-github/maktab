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

interface RoomFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedType: string;
  onTypeChange: (value: string) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
  roomTypes: string[];
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  isRTL?: boolean;
}

export function RoomFilters({
  searchTerm,
  onSearchChange,
  selectedType,
  onTypeChange,
  sortBy,
  onSortChange,
  roomTypes,
  onClearFilters,
  hasActiveFilters,
  isRTL = false,
}: RoomFiltersProps) {
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
            placeholder={isRTL ? "جستجوی کلاس..." : "Search rooms..."}
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
            <SelectItem value="capacity-desc">
              {isRTL ? "ظرفیت (بیشترین)" : "Capacity (High-Low)"}
            </SelectItem>
            <SelectItem value="capacity-asc">
              {isRTL ? "ظرفیت (کمترین)" : "Capacity (Low-High)"}
            </SelectItem>
            <SelectItem value="type-asc">
              {isRTL ? "نوع (الف-ی)" : "Type (A-Z)"}
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

      {/* Room Type Filter Pills */}
      <div className={cn(
        "flex flex-wrap gap-2",
        isRTL && "flex-row"
      )}>
        <Badge
          variant={selectedType === "all" ? "default" : "outline"}
          className="cursor-pointer hover:bg-primary/90 transition-colors px-4 py-2"
          onClick={() => onTypeChange("all")}
        >
          {isRTL ? "همه" : "All"}
          <span className={cn("ml-1.5 font-bold", isRTL && "mr-1.5 ml-0")}>
            ({roomTypes.length})
          </span>
        </Badge>

        {roomTypes.map((type) => (
          <Badge
            key={type}
            variant={selectedType === type ? "default" : "outline"}
            className="cursor-pointer hover:bg-primary/90 transition-colors px-4 py-2"
            onClick={() => onTypeChange(type)}
          >
            {type}
          </Badge>
        ))}
      </div>
    </div>
  );
}

