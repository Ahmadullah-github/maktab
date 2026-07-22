import { describe, expect, it } from 'vitest';

import { resolveExportTargetType } from './ExportDialog';

describe('resolveExportTargetType', () => {
  it('uses the current schedule type for a current export', () => {
    expect(resolveExportTargetType('current', 'class')).toBe('class');
    expect(resolveExportTargetType('current', 'teacher')).toBe('teacher');
  });

  it('uses the selected batch scope regardless of the current view', () => {
    expect(resolveExportTargetType('all-classes', 'teacher')).toBe('class');
    expect(resolveExportTargetType('all-teachers', 'class')).toBe('teacher');
  });
});
