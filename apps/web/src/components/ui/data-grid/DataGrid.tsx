import { cn } from '@/lib/utils';
import { ChevronDown, Plus } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

export type DataGridRow = Record<string, unknown> & { id?: string | number };

export interface Column<Row extends DataGridRow = DataGridRow> {
  id: string;
  title: string;
  type: 'text' | 'select' | 'tags' | 'boolean' | 'custom';
  width?: string;
  options?: string[]; // For select type
  render?: (value: unknown, row: Row) => React.ReactNode;
}

interface DataGridProps<Row extends DataGridRow> {
  columns: Column<Row>[];
  data: Row[];
  onDataChange?: (newData: Row[]) => void;
}

function EditableCell<Row extends DataGridRow>({
  value,
  row,
  column,
  onSave,
  isEditing,
  onEditStart,
}: {
  value: unknown;
  row: Row;
  column: Column<Row>;
  onSave: (val: unknown) => void;
  isEditing: boolean;
  onEditStart: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      inputRef.current?.blur();
    }
  };

  if (column.render) {
    return <div className="h-full w-full px-2 flex items-center">{column.render(value, row)}</div>;
  }

  if (isEditing) {
    if (column.type === 'boolean') {
      // Toggle immediately for boolean, no need for input
      return (
        <div className="h-full w-full flex items-center px-2 cursor-pointer bg-primary/10">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onSave(e.target.checked)}
            className="h-4 w-4"
          />
        </div>
      );
    }

    if (column.type === 'select') {
      return (
        <select
          className="w-full h-full px-2 bg-background border-none focus:ring-2 focus:ring-inset focus:ring-primary outline-none"
          value={typeof value === 'string' || typeof value === 'number' ? value : ''}
          onChange={(e) => onSave(e.target.value)}
          onBlur={() => onSave(value)} // Save on blur? Or keep open?
          autoFocus
        >
          <option value="">Select...</option>
          {column.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        ref={inputRef}
        className="w-full h-full px-2 bg-background border-none focus:ring-2 focus:ring-inset focus:ring-primary outline-none"
        value={typeof value === 'string' || typeof value === 'number' ? value : ''}
        onChange={(e) => onSave(e.target.value)}
        onBlur={() => onEditStart()} // Actually we want to stop editing, parent handles this via click outside usually, but here simplicity
        onKeyDown={handleKeyDown}
      />
    );
  }

  // Display Mode
  let displayValue: React.ReactNode =
    typeof value === 'string' || typeof value === 'number' ? value : '';
  if (column.type === 'boolean') {
    displayValue = value ? 'Yes' : 'No';
  } else if (Array.isArray(value)) {
    displayValue = value.join(', ');
  }

  return (
    <div
      className={cn(
        'h-full w-full px-2 flex items-center truncate cursor-pointer hover:bg-muted/50 min-h-[32px]',
        column.type === 'boolean' && 'justify-center'
      )}
      onClick={onEditStart}
    >
      {column.type === 'tags' && Array.isArray(value) ? (
        <div className="flex gap-1 flex-wrap">
          {value.map((tag: string, i: number) => (
            <span
              key={i}
              className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px] font-medium border border-primary/20"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-sm">{displayValue}</span>
      )}
    </div>
  );
}

export function DataGrid<Row extends DataGridRow>({ columns, data, onDataChange }: DataGridProps<Row>) {
  const [editingCell, setEditingCell] = useState<{ rowIdx: number; colId: string } | null>(null);

  const handleCellSave = (rowIdx: number, colId: string, newValue: unknown) => {
    if (!onDataChange) return;
    const newData = [...data];
    newData[rowIdx] = { ...newData[rowIdx], [colId]: newValue } as Row;
    onDataChange(newData);
    // Optionally move to next cell?
  };

  const handleAddRow = () => {
    if (!onDataChange) return;
    const newRow = columns.reduce<Record<string, unknown>>(
      (acc, col) => ({ ...acc, [col.id]: '' }),
      { id: Math.random().toString() }
    ) as Row;
    onDataChange([...data, newRow]);
  };

  // Close editor when clicking outside (simplified)
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.data-grid-cell')) return;
      setEditingCell(null);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="flex flex-col h-full border rounded-md overflow-hidden bg-background">
      {/* Header */}
      <div className="flex border-b bg-muted/40 font-medium text-xs text-muted-foreground">
        <div className="w-10 border-r flex items-center justify-center shrink-0">#</div>
        {columns.map((col) => (
          <div
            key={col.id}
            className="px-2 py-2 border-r last:border-r-0 flex items-center gap-1 hover:bg-muted/60 cursor-pointer"
            style={{ width: col.width || '150px', flex: col.width ? 'none' : 1 }}
          >
            {col.title}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </div>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        {data.map((row, rowIdx) => (
          <div
            key={row.id || rowIdx}
            className="flex border-b last:border-b-0 hover:bg-muted/20 group"
          >
            <div className="w-10 border-r flex items-center justify-center shrink-0 text-xs text-muted-foreground bg-muted/10">
              {rowIdx + 1}
            </div>
            {columns.map((col) => (
              <div
                key={col.id}
                className="border-r last:border-r-0 data-grid-cell relative"
                style={{ width: col.width || '150px', flex: col.width ? 'none' : 1 }}
              >
                <EditableCell
                  value={row[col.id]}
                  row={row}
                  column={col}
                  isEditing={editingCell?.rowIdx === rowIdx && editingCell?.colId === col.id}
                  onEditStart={() => onDataChange && setEditingCell({ rowIdx, colId: col.id })}
                  onSave={(val) => handleCellSave(rowIdx, col.id, val)}
                />
              </div>
            ))}
          </div>
        ))}

        {/* Add Row Button */}
        {onDataChange && (
          <div
            onClick={handleAddRow}
            className="flex items-center gap-2 p-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer hover:bg-muted/30 border-b border-dashed transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add New Record
          </div>
        )}
      </div>

      {/* Footer / Stats */}
      <div className="border-t p-2 text-xs text-muted-foreground bg-muted/20 flex justify-between">
        <span>{data.length} records</span>
        <span>Ready</span>
      </div>
    </div>
  );
}
