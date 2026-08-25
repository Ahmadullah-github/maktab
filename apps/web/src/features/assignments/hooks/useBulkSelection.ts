/**
 * useBulkSelection Hook
 *
 * Manages multi-select state for bulk assignment operations.
 * Tracks selected class-subject cells and provides selection utilities.
 *
 * Requirements: Phase 5.1
 */

import { useCallback, useMemo, useState } from 'react';
import type { AssignmentCellSelection } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface UseBulkSelectionOptions {
  /** Maximum number of cells that can be selected */
  maxSelection?: number;
  /** Callback when selection changes */
  onSelectionChange?: (cells: AssignmentCellSelection[]) => void;
}

export interface UseBulkSelectionResult {
  /** Currently selected cells */
  selectedCells: AssignmentCellSelection[];
  /** Set of selected cell keys for quick lookup */
  selectedKeys: Set<string>;
  /** Number of selected cells */
  selectionCount: number;
  /** Whether bulk selection mode is active */
  isSelectionMode: boolean;
  /** Toggle a single cell selection */
  toggleCell: (cell: AssignmentCellSelection) => void;
  /** Select multiple cells at once */
  selectCells: (cells: AssignmentCellSelection[]) => void;
  /** Select all unassigned cells in a class */
  selectAllInClass: (classId: number, cells: AssignmentCellSelection[]) => void;
  /** Select all cells for a subject across multiple classes */
  selectAllForSubject: (subjectId: number, cells: AssignmentCellSelection[]) => void;
  /** Clear all selections */
  clearSelection: () => void;
  /** Check if a cell is selected */
  isSelected: (classId: number, subjectId: number) => boolean;
  /** Enter selection mode */
  enterSelectionMode: () => void;
  /** Exit selection mode */
  exitSelectionMode: () => void;
  /** Remove specific cells from selection */
  deselectCells: (cells: AssignmentCellSelection[]) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique key for a cell
 */
function getCellKey(classId: number, subjectId: number): string {
  return `${classId}:${subjectId}`;
}

/**
 * Parse a cell key back to IDs
 * @internal Reserved for future use
 */
function _parseCellKey(key: string): { classId: number; subjectId: number } {
  const [classId, subjectId] = key.split(':').map(Number);
  return { classId, subjectId };
}

// Suppress unused warning - reserved for future use
void _parseCellKey;

// ============================================================================
// Hook Implementation
// ============================================================================

export function useBulkSelection(options: UseBulkSelectionOptions = {}): UseBulkSelectionResult {
  const { maxSelection = 100, onSelectionChange } = options;

  // Selection state
  const [selectedCells, setSelectedCells] = useState<AssignmentCellSelection[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Computed values
  const selectedKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const cell of selectedCells) {
      keys.add(getCellKey(cell.classId, cell.subjectId));
    }
    return keys;
  }, [selectedCells]);

  const selectionCount = selectedCells.length;

  // ============================================================================
  // Selection Methods
  // ============================================================================

  const isSelected = useCallback(
    (classId: number, subjectId: number): boolean => {
      return selectedKeys.has(getCellKey(classId, subjectId));
    },
    [selectedKeys]
  );

  const toggleCell = useCallback(
    (cell: AssignmentCellSelection) => {
      setSelectedCells((prev) => {
        const key = getCellKey(cell.classId, cell.subjectId);
        const isCurrentlySelected = prev.some((c) => getCellKey(c.classId, c.subjectId) === key);

        let next: AssignmentCellSelection[];
        if (isCurrentlySelected) {
          // Remove from selection
          next = prev.filter((c) => getCellKey(c.classId, c.subjectId) !== key);
        } else {
          // Add to selection (if under max)
          if (prev.length >= maxSelection) {
            return prev; // Don't add if at max
          }
          next = [...prev, cell];
        }

        onSelectionChange?.(next);
        return next;
      });
    },
    [maxSelection, onSelectionChange]
  );

  const selectCells = useCallback(
    (cells: AssignmentCellSelection[]) => {
      setSelectedCells((prev) => {
        // Merge with existing, avoiding duplicates
        const existingKeys = new Set(prev.map((c) => getCellKey(c.classId, c.subjectId)));
        const newCells = cells.filter((c) => !existingKeys.has(getCellKey(c.classId, c.subjectId)));

        // Limit to max selection
        const availableSlots = maxSelection - prev.length;
        const cellsToAdd = newCells.slice(0, availableSlots);

        const next = [...prev, ...cellsToAdd];
        onSelectionChange?.(next);
        return next;
      });
    },
    [maxSelection, onSelectionChange]
  );

  const selectAllInClass = useCallback(
    (classId: number, cells: AssignmentCellSelection[]) => {
      const classCells = cells.filter((c) => c.classId === classId);
      selectCells(classCells);
    },
    [selectCells]
  );

  const selectAllForSubject = useCallback(
    (subjectId: number, cells: AssignmentCellSelection[]) => {
      const subjectCells = cells.filter((c) => c.subjectId === subjectId);
      selectCells(subjectCells);
    },
    [selectCells]
  );

  const deselectCells = useCallback(
    (cells: AssignmentCellSelection[]) => {
      const keysToRemove = new Set(cells.map((c) => getCellKey(c.classId, c.subjectId)));

      setSelectedCells((prev) => {
        const next = prev.filter((c) => !keysToRemove.has(getCellKey(c.classId, c.subjectId)));
        onSelectionChange?.(next);
        return next;
      });
    },
    [onSelectionChange]
  );

  const clearSelection = useCallback(() => {
    setSelectedCells([]);
    setIsSelectionMode(false);
    onSelectionChange?.([]);
  }, [onSelectionChange]);

  const enterSelectionMode = useCallback(() => {
    setIsSelectionMode(true);
  }, []);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    clearSelection();
  }, [clearSelection]);

  return {
    selectedCells,
    selectedKeys,
    selectionCount,
    isSelectionMode,
    toggleCell,
    selectCells,
    selectAllInClass,
    selectAllForSubject,
    clearSelection,
    isSelected,
    enterSelectionMode,
    exitSelectionMode,
    deselectCells,
  };
}

export default useBulkSelection;
