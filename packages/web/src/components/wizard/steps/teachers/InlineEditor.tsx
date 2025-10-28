import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Loader2 } from "lucide-react";

interface InlineEditorProps {
  field: string;
  teacherId: string;
  currentValue: any;
  onSave: (value: any) => void;
  onClose: () => void;
  isLoading?: boolean;
}

export function InlineEditor({ field, teacherId, currentValue, onSave, onClose, isLoading = false }: InlineEditorProps) {
  const [value, setValue] = React.useState(currentValue);

  // Update value when currentValue prop changes
  React.useEffect(() => {
    setValue(currentValue);
  }, [currentValue]);

  // Safety check
  if (currentValue === undefined || currentValue === null) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
          <div className="text-center">
            <p className="text-muted-foreground">Invalid data for editing</p>
            <Button onClick={onClose} className="mt-4">
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    await onSave(value);
    // Parent component will handle closing on success
  };

  const getFieldLabel = (field: string) => {
    switch (field) {
      case "maxPeriodsPerWeek":
        return "Max Periods per Week";
      case "timePreference":
        return "Time Preference";
      case "maxPeriodsPerDay":
        return "Max Periods per Day";
      case "maxConsecutivePeriods":
        return "Max Consecutive Periods";
      default:
        return field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    }
  };

  const renderField = () => {
    switch (field) {
      case "maxPeriodsPerWeek":
        return (
          <Input
            type="number"
            min="1"
            max="40"
            value={value}
            onChange={(e) => setValue(parseInt(e.target.value) || 20)}
          />
        );
      
      case "timePreference":
        return (
          <Select
            value={value}
            onValueChange={(newValue: "Morning" | "Afternoon" | "None") => setValue(newValue)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="None">No Preference</SelectItem>
              <SelectItem value="Morning">Morning</SelectItem>
              <SelectItem value="Afternoon">Afternoon</SelectItem>
            </SelectContent>
          </Select>
        );
      
      case "maxPeriodsPerDay":
        return (
          <Input
            type="number"
            min="1"
            max="10"
            value={value || ""}
            onChange={(e) => setValue(parseInt(e.target.value) || undefined)}
            placeholder="6"
          />
        );
      
      case "maxConsecutivePeriods":
        return (
          <Input
            type="number"
            min="1"
            max="8"
            value={value || ""}
            onChange={(e) => setValue(parseInt(e.target.value) || undefined)}
            placeholder="4"
          />
        );
      
      default:
        return (
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            Edit {getFieldLabel(field)}
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="space-y-4">
          <div>
            <Label>{getFieldLabel(field)}</Label>
            {renderField()}
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <Button
            onClick={handleSave}
            className="flex-1"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
            disabled={isLoading}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
