import * as React from 'react';

export type GapMode = 'padding' | 'margin';

export const zeroRightClassName = 'right-scroll-bar-position';
export const fullWidthClassName = 'width-before-scroll-bar';
export const noScrollbarsClassName = 'with-scroll-bars-hidden';
export const removedBarSizeVariable = '--removed-body-scroll-bar-size';
export const lockAttribute = 'data-scroll-locked';

const zeroGap = { left: 0, top: 0, right: 0, gap: 0 };
const managedProperties = [
  'overflow',
  'overscroll-behavior',
  'position',
  'padding-left',
  'padding-top',
  'padding-right',
  'margin-left',
  'margin-top',
  'margin-right',
  removedBarSizeVariable,
] as const;

type SavedStyle = { property: string; value: string; priority: string };
let savedStyles: SavedStyle[] | null = null;

function numberFromStyle(value: string): number {
  return Number.parseInt(value || '', 10) || 0;
}

export function getGapWidth(gapMode: GapMode = 'margin') {
  if (typeof window === 'undefined') return zeroGap;
  const styles = window.getComputedStyle(document.body);
  const prefix = gapMode === 'padding' ? 'padding' : 'margin';
  const left = numberFromStyle(styles.getPropertyValue(`${prefix}-left`));
  const top = numberFromStyle(styles.getPropertyValue(`${prefix}-top`));
  const right = numberFromStyle(styles.getPropertyValue(`${prefix}-right`));
  return {
    left,
    top,
    right,
    gap: Math.max(0, window.innerWidth - document.documentElement.clientWidth + right - left),
  };
}

function currentLockCount(): number {
  const count = Number.parseInt(document.body.getAttribute(lockAttribute) || '0', 10);
  return Number.isFinite(count) ? count : 0;
}

function restoreBodyStyles() {
  if (!savedStyles) return;
  for (const { property, value, priority } of savedStyles) {
    if (value) document.body.style.setProperty(property, value, priority);
    else document.body.style.removeProperty(property);
  }
  savedStyles = null;
}

export function useLockAttribute(
  gapMode: GapMode = 'margin',
  noRelative = false,
  noImportant = false
) {
  React.useLayoutEffect(() => {
    const body = document.body;
    const count = currentLockCount();
    if (count === 0) {
      savedStyles = managedProperties.map((property) => ({
        property,
        value: body.style.getPropertyValue(property),
        priority: body.style.getPropertyPriority(property),
      }));
      const { left, top, right, gap } = getGapWidth(gapMode);
      const priority = noImportant ? '' : 'important';
      body.style.setProperty('overflow', 'hidden', priority);
      body.style.setProperty('overscroll-behavior', 'contain');
      body.style.setProperty(removedBarSizeVariable, `${gap}px`);
      if (!noRelative) body.style.setProperty('position', 'relative', priority);
      if (gapMode === 'padding') {
        body.style.setProperty('padding-right', `${gap}px`, priority);
      } else {
        body.style.setProperty('padding-left', `${left}px`);
        body.style.setProperty('padding-top', `${top}px`);
        body.style.setProperty('padding-right', `${right}px`);
        body.style.setProperty('margin-left', '0');
        body.style.setProperty('margin-top', '0');
        body.style.setProperty('margin-right', `${gap}px`, priority);
      }
    }
    body.setAttribute(lockAttribute, String(count + 1));
    return () => {
      const nextCount = currentLockCount() - 1;
      if (nextCount > 0) {
        body.setAttribute(lockAttribute, String(nextCount));
        return;
      }
      body.removeAttribute(lockAttribute);
      restoreBodyStyles();
    };
  }, [gapMode, noImportant, noRelative]);
}

export interface BodyScroll {
  noRelative?: boolean;
  noImportant?: boolean;
  gapMode?: GapMode;
}

export const RemoveScrollBar: React.FC<BodyScroll> = ({
  noRelative = false,
  noImportant = false,
  gapMode = 'margin',
}) => {
  useLockAttribute(gapMode, noRelative, noImportant);
  return null;
};
