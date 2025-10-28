import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, Clock, Calendar, Save, RotateCcw, Loader2 } from "lucide-react";
import { Teacher } from "@/types";

interface AvailabilityEditorProps {
  teacher: Teacher;
  onSave: (availability: Record<string, boolean[]>) => void;
  onCancel: () => void;
  schoolInfo: {
    workingDays: string[];
  };
  periodsInfo: {
    periodsPerDay: number;
    schoolStartTime: string;
    periodDuration: number;
  };
  isLoading?: boolean;
}

export function AvailabilityEditor({ 
  teacher, 
  onSave, 
  onCancel,
  schoolInfo, 
  periodsInfo,
  isLoading = false
}: AvailabilityEditorProps) {
  // Safety check
  if (!teacher) {
    return (
      <div className="text-center py-4">
        <p className="text-muted-foreground">Teacher not found</p>
      </div>
    );
  }

  const days = schoolInfo.workingDays || [
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
  ];
  
  const periodsPerDay = periodsInfo.periodsPerDay || 8;
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [localAvailability, setLocalAvailability] = useState<Record<string, boolean[]>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize local availability from teacher data
  useEffect(() => {
    const initialAvailability: Record<string, boolean[]> = {};
    days.forEach(day => {
      initialAvailability[day] = teacher.availability?.[day] || new Array(periodsPerDay).fill(false);
    });
    setLocalAvailability(initialAvailability);
    setHasChanges(false);
  }, [teacher.id, days, periodsPerDay]);

  // Calculate time labels for periods
  const getTimeLabel = (periodIndex: number) => {
    const startHour = parseInt(periodsInfo.schoolStartTime.split(':')[0]);
    const startMinute = parseInt(periodsInfo.schoolStartTime.split(':')[1]);
    const periodDuration = periodsInfo.periodDuration || 45;
    
    const startMinutes = startHour * 60 + startMinute + (periodIndex * periodDuration);
    const endMinutes = startMinutes + periodDuration;
    
    const startHourFormatted = Math.floor(startMinutes / 60);
    const startMinuteFormatted = startMinutes % 60;
    const endHourFormatted = Math.floor(endMinutes / 60);
    const endMinuteFormatted = endMinutes % 60;
    
    return `${startHourFormatted.toString().padStart(2, '0')}:${startMinuteFormatted.toString().padStart(2, '0')}-${endHourFormatted.toString().padStart(2, '0')}:${endMinuteFormatted.toString().padStart(2, '0')}`;
  };

  const handleToggle = (day: string, periodIndex: number) => {
    setLocalAvailability(prev => {
      const newAvailability = { ...prev };
      newAvailability[day] = [...(newAvailability[day] || [])];
      newAvailability[day][periodIndex] = !newAvailability[day][periodIndex];
      return newAvailability;
    });
    setHasChanges(true);
  };

  const handleDayToggle = (day: string, isAvailable: boolean) => {
    setLocalAvailability(prev => {
      const newAvailability = { ...prev };
      newAvailability[day] = new Array(periodsPerDay).fill(isAvailable);
      return newAvailability;
    });
    setHasChanges(true);
  };

  const handlePeriodToggle = (periodIndex: number, isAvailable: boolean) => {
    setLocalAvailability(prev => {
      const newAvailability = { ...prev };
      days.forEach(day => {
        newAvailability[day] = [...(newAvailability[day] || [])];
        newAvailability[day][periodIndex] = isAvailable;
      });
      return newAvailability;
    });
    setHasChanges(true);
  };

  const clearAll = () => {
    days.forEach(day => handleDayToggle(day, false));
  };

  const selectAll = () => {
    days.forEach(day => handleDayToggle(day, true));
  };

  const getDayAvailability = (day: string) => {
    const dayAvailability = localAvailability[day] || [];
    const availablePeriods = dayAvailability.filter(Boolean).length;
    return { available: availablePeriods, total: periodsPerDay };
  };

  const getTotalAvailability = () => {
    let totalAvailable = 0;
    let totalPeriods = 0;
    days.forEach(day => {
      const dayAvailability = localAvailability[day] || [];
      totalAvailable += dayAvailability.filter(Boolean).length;
      totalPeriods += periodsPerDay;
    });
    return { available: totalAvailable, total: totalPeriods };
  };

  const handleSave = async () => {
    await onSave(localAvailability);
    setHasChanges(false);
    // Parent component handles closing the editor on success
  };

  const handleCancel = () => {
    // Reset to original availability
    const originalAvailability: Record<string, boolean[]> = {};
    days.forEach(day => {
      originalAvailability[day] = teacher.availability?.[day] || new Array(periodsPerDay).fill(false);
    });
    setLocalAvailability(originalAvailability);
    setHasChanges(false);
    onCancel();
  };

  const totalAvailability = getTotalAvailability();

  return (
    <div className="space-y-6">
      {/* Header with Stats and Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h4 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Weekly Availability
          </h4>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {totalAvailability.available}/{totalAvailability.total} periods
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              Grid
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              List
            </Button>
          </div>
          <div className="h-4 w-px bg-border mx-2" />
          <Button
            variant="outline"
            size="sm"
            onClick={selectAll}
            className="flex items-center gap-1"
          >
            <Check className="h-4 w-4" />
            Select All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearAll}
            className="flex items-center gap-1"
          >
            <X className="h-4 w-4" />
            Clear All
          </Button>
          <div className="h-4 w-px bg-border mx-2" />
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            className="flex items-center gap-1"
          >
            <X className="h-4 w-4" />
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || isLoading}
            className="flex items-center gap-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        /* Grid View */
        <div className="overflow-x-auto">
          <div className="min-w-full">
            {/* Header Row */}
            <div className="grid grid-cols-8 gap-2 mb-2">
              <div className="text-sm font-medium text-center p-2">Day</div>
              {Array.from({ length: periodsPerDay }, (_, i) => (
                <div key={i} className="text-xs text-center p-1">
                  <div className="font-medium">P{i + 1}</div>
                  <div className="text-muted-foreground">{getTimeLabel(i)}</div>
                </div>
              ))}
            </div>

            {/* Day Rows */}
            {days.map((day) => {
              const dayStats = getDayAvailability(day);
              return (
                <div key={day} className="grid grid-cols-8 gap-2 mb-1">
                  <div className="flex items-center justify-between p-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{day}</span>
                      <Badge variant="outline" className="text-xs">
                        {dayStats.available}/{dayStats.total}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDayToggle(day, true)}
                        className="h-6 px-2 text-xs"
                      >
                        All
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDayToggle(day, false)}
                        className="h-6 px-2 text-xs"
                      >
                        None
                      </Button>
                    </div>
                  </div>
                  {Array.from({ length: periodsPerDay }, (_, periodIndex) => (
                    <div key={periodIndex} className="flex justify-center">
                      <Button
                        variant={localAvailability[day]?.[periodIndex] ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleToggle(day, periodIndex)}
                        className="w-10 h-10 p-0 hover:scale-105 transition-transform"
                        title={`${day} Period ${periodIndex + 1} - ${getTimeLabel(periodIndex)}`}
                      >
                        {periodIndex + 1}
                      </Button>
                    </div>
                  ))}
                </div>
              );
            })}

            {/* Period Controls */}
            <div className="grid grid-cols-8 gap-2 mt-4">
              <div className="text-sm font-medium text-center p-2">Periods</div>
              {Array.from({ length: periodsPerDay }, (_, periodIndex) => (
                <div key={periodIndex} className="flex justify-center">
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePeriodToggle(periodIndex, true)}
                      className="h-6 px-2 text-xs"
                    >
                      All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePeriodToggle(periodIndex, false)}
                      className="h-6 px-2 text-xs"
                    >
                      None
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* List View */
        <div className="space-y-4">
          {days.map((day) => {
            const dayStats = getDayAvailability(day);
            return (
              <Card key={day}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{day}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {dayStats.available}/{dayStats.total} periods
                      </Badge>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDayToggle(day, true)}
                          className="h-6 px-2 text-xs"
                        >
                          All
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDayToggle(day, false)}
                          className="h-6 px-2 text-xs"
                        >
                          None
                        </Button>
                      </div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                    {Array.from({ length: periodsPerDay }, (_, periodIndex) => (
                      <Button
                        key={periodIndex}
                        variant={localAvailability[day]?.[periodIndex] ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleToggle(day, periodIndex)}
                        className="h-10 flex flex-col items-center justify-center p-1"
                        title={`Period ${periodIndex + 1} - ${getTimeLabel(periodIndex)}`}
                      >
                        <span className="text-xs font-medium">P{periodIndex + 1}</span>
                        <span className="text-xs text-muted-foreground">
                          {getTimeLabel(periodIndex).split('-')[0]}
                        </span>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
