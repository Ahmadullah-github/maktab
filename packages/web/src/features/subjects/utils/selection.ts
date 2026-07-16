export function toggleVisibleSelection(
  selectedIds: ReadonlySet<number>,
  visibleIds: readonly number[]
): Set<number> {
  const next = new Set(selectedIds);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => next.has(id));
  for (const id of visibleIds) {
    if (allVisibleSelected) next.delete(id);
    else next.add(id);
  }
  return next;
}

export function getVisibleSelectionState(
  selectedIds: ReadonlySet<number>,
  visibleIds: readonly number[]
): { allSelected: boolean; someSelected: boolean; selectedCount: number } {
  const selectedCount = visibleIds.reduce(
    (count, id) => count + (selectedIds.has(id) ? 1 : 0),
    0
  );
  return {
    allSelected: visibleIds.length > 0 && selectedCount === visibleIds.length,
    someSelected: selectedCount > 0 && selectedCount < visibleIds.length,
    selectedCount,
  };
}
