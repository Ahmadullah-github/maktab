import { describe, expect, it } from 'vitest';

describe('useEnhancedGenerateSchedule module', () => {
  it('exports the enhanced generation hook', async () => {
    const module = await import('../hooks/useEnhancedGenerateSchedule');
    expect(typeof module.useEnhancedGenerateSchedule).toBe('function');
  });
});
