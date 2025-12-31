/**
 * Vitest test setup file
 *
 * Configures testing-library matchers and global test utilities
 */

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import type { ComponentType } from 'react';
import { afterEach, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string | Record<string, unknown>) => {
      if (typeof defaultValue === 'string') return defaultValue;
      if (typeof defaultValue === 'object' && 'defaultValue' in defaultValue) {
        return defaultValue.defaultValue;
      }
      // Return the key for translation lookup
      return key;
    },
    i18n: {
      language: 'fa',
      changeLanguage: vi.fn(),
    },
  }),
  withTranslation:
    () =>
    <P extends object>(Component: ComponentType<P>) => {
      const t = (key: string, defaultValue?: string | Record<string, unknown>) => {
        if (typeof defaultValue === 'string') return defaultValue;
        if (typeof defaultValue === 'object' && 'defaultValue' in defaultValue) {
          return defaultValue.defaultValue;
        }
        return key;
      };
      const WrappedComponent = (props: P) => (
        <Component {...props} t={t} i18n={{ language: 'fa' }} />
      );
      WrappedComponent.displayName = `withTranslation(${Component.displayName || Component.name || 'Component'})`;
      return WrappedComponent;
    },
  Trans: ({ children }: { children: React.ReactNode }) => children,
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverMock,
});

// Mock IntersectionObserver
class IntersectionObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: IntersectionObserverMock,
});
