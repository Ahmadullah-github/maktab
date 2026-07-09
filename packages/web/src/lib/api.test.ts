import { describe, expect, it } from 'vitest';
import { extractApiErrorMessage } from './api';

describe('extractApiErrorMessage', () => {
  it('returns top-level string errors', () => {
    expect(
      extractApiErrorMessage({ error: 'Subject already exists' }, 'fallback message')
    ).toBe('Subject already exists');
  });

  it('returns nested validation details when available', () => {
    expect(
      extractApiErrorMessage(
        {
          error: {
            message: 'Request validation failed',
            details: {
              requiredFeatures: ['Must be an array of strings or a JSON string array'],
            },
          },
        },
        'fallback message'
      )
    ).toBe('Request validation failed: Must be an array of strings or a JSON string array');
  });

  it('falls back cleanly when payload is unusable', () => {
    expect(extractApiErrorMessage({}, 'fallback message')).toBe('fallback message');
  });
});
