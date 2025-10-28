import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EditableCellProps {
  value: any;
  field: string;
  type: "text" | "number" | "select";
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  onSave: (value: any) => Promise<boolean>;
  isLoading?: boolean;
  displayValue?: string; // Optional custom display value
}

export function EditableCell({
  value,
  field,
  type,
  options,
  min,
  max,
  onSave,
  isLoading = false,
  displayValue,
}: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevValueRef = useRef(value);

  useEffect(() => {
    // Always update editValue when prop changes, even if editing
    if (prevValueRef.current !== value) {
      setEditValue(value);
      prevValueRef.current = value;
    }
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (editValue === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    const success = await onSave(editValue);
    setIsSaving(false);

    if (success) {
      setIsEditing(false);
    } else {
      // Revert on failure
      setEditValue(value);
    }
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1 min-w-[150px]">
        {type === "text" && (
          <Input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            className="h-8 text-sm"
          />
        )}
        
        {type === "number" && (
          <Input
            ref={inputRef}
            type="number"
            min={min}
            max={max}
            value={editValue}
            onChange={(e) => setEditValue(parseInt(e.target.value) || min || 0)}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            className="h-8 text-sm w-20"
          />
        )}
        
        {type === "select" && (
          <Select
            value={editValue}
            onValueChange={setEditValue}
            disabled={isSaving}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSave}
            disabled={isSaving}
            className="h-7 w-7 p-0 hover:bg-green-50 hover:text-green-600"
            title="Save (Enter)"
          >
            {isSaving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCancel}
            disabled={isSaving}
            className="h-7 w-7 p-0 hover:bg-red-50 hover:text-red-600"
            title="Cancel (Esc)"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/20 px-2 py-1 rounded transition-colors group flex items-center gap-2"
      title="Click to edit"
    >
      <span className="font-medium">
        {displayValue !== undefined ? displayValue : value}
      </span>
      {isLoading && (
        <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
      )}
      <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
        ✎
      </span>
    </div>
  );
}

