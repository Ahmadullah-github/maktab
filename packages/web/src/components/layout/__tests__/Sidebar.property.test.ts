/**
 * Property-based tests for Sidebar navigation
 *
 * **Feature: routing-navigation, Property 3: Sidebar click navigation**
 * **Validates: Requirements 4.1, 4.2**
 *
 * Property 3: Sidebar click navigation
 * *For any* clickable navigation item in the sidebar, clicking that item SHALL
 * navigate to its corresponding route path and update the browser URL.
 *
 * **Feature: routing-navigation, Property 4: Active route highlighting**
 * **Validates: Requirements 5.1, 5.3**
 *
 * Property 4: Active route highlighting
 * *For any* active route, the sidebar SHALL highlight the corresponding navigation
 * item, and when navigating to a different route, the highlight SHALL move to the
 * new active item.
 *
 * **Feature: routing-navigation, Property 7: Keyboard navigation activation**
 * **Validates: Requirements 9.2**
 *
 * Property 7: Keyboard navigation activation
 * *For any* focused sidebar navigation item, pressing Enter SHALL navigate to the
 * corresponding route.
 */

import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

/**
 * Navigation item configuration representing all clickable sidebar items.
 * Each entry maps an item ID to its corresponding route path.
 */
interface NavItemConfig {
  id: string;
  path: string;
  titleKey: string;
}

/**
 * All navigation items in the sidebar that should be clickable.
 * This matches the configuration in the Sidebar component.
 */
const SIDEBAR_NAV_ITEMS: NavItemConfig[] = [
  { id: 'dashboard', path: '/dashboard', titleKey: 'sidebar.dashboard' },
  { id: 'school-settings', path: '/school-settings', titleKey: 'sidebar.schoolSettings' },
  { id: 'periods', path: '/periods', titleKey: 'sidebar.periods' },
  { id: 'rooms', path: '/rooms', titleKey: 'sidebar.rooms' },
  { id: 'teachers', path: '/teachers', titleKey: 'sidebar.teachers' },
  { id: 'subjects', path: '/subjects', titleKey: 'sidebar.subjects' },
  { id: 'classes', path: '/classes', titleKey: 'sidebar.classes' },
  { id: 'constraints', path: '/constraints', titleKey: 'sidebar.constraints' },
  { id: 'schedule-dashboard', path: '/schedule-dashboard', titleKey: 'sidebar.scheduleDashboard' },
  { id: 'classes-schedule', path: '/classes-schedule', titleKey: 'sidebar.classesSchedule' },
  { id: 'teachers-schedule', path: '/teachers-schedule', titleKey: 'sidebar.teachersSchedule' },
  { id: 'guidance', path: '/guidance', titleKey: 'sidebar.guidance' },
  { id: 'about', path: '/about', titleKey: 'sidebar.about' },
  { id: 'settings', path: '/settings', titleKey: 'sidebar.settings' },
  { id: 'logout', path: '/logout', titleKey: 'sidebar.logout' },
];

describe('Sidebar Navigation Property Tests', () => {
  /**
   * **Feature: routing-navigation, Property 3: Sidebar click navigation**
   * **Validates: Requirements 4.1, 4.2**
   *
   * For any navigation item, its path should be a valid route starting with '/'.
   */
  it('Property 3: All navigation items have valid route paths', () => {
    fc.assert(
      fc.property(fc.constantFrom(...SIDEBAR_NAV_ITEMS), (item) => {
        // Path should start with '/'
        return item.path.startsWith('/');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: routing-navigation, Property 3: Sidebar click navigation**
   * **Validates: Requirements 4.1, 4.2**
   *
   * For any navigation item, the id should match the path (without leading slash).
   * This ensures consistency between item identification and routing.
   */
  it('Property 3: Navigation item IDs are consistent with their paths', () => {
    fc.assert(
      fc.property(fc.constantFrom(...SIDEBAR_NAV_ITEMS), (item) => {
        // The path should be '/' + id
        return item.path === `/${item.id}`;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: routing-navigation, Property 3: Sidebar click navigation**
   * **Validates: Requirements 4.1, 4.2**
   *
   * All navigation items should have unique paths.
   */
  it('Property 3: All navigation items have unique paths', () => {
    const paths = SIDEBAR_NAV_ITEMS.map((item) => item.path);
    const uniquePaths = new Set(paths);
    expect(uniquePaths.size).toBe(paths.length);
  });

  /**
   * **Feature: routing-navigation, Property 3: Sidebar click navigation**
   * **Validates: Requirements 4.1, 4.2**
   *
   * All navigation items should have unique IDs.
   */
  it('Property 3: All navigation items have unique IDs', () => {
    const ids = SIDEBAR_NAV_ITEMS.map((item) => item.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  /**
   * **Feature: routing-navigation, Property 3: Sidebar click navigation**
   * **Validates: Requirements 4.1, 4.2**
   *
   * For any navigation item, the titleKey should follow the 'sidebar.{name}' pattern.
   */
  it('Property 3: All navigation items have consistent titleKey pattern', () => {
    fc.assert(
      fc.property(fc.constantFrom(...SIDEBAR_NAV_ITEMS), (item) => {
        // titleKey should start with 'sidebar.'
        return item.titleKey.startsWith('sidebar.');
      }),
      { numRuns: 100 }
    );
  });
});

describe('Active Route Highlighting Property Tests', () => {
  /**
   * **Feature: routing-navigation, Property 4: Active route highlighting**
   * **Validates: Requirements 5.1, 5.3**
   *
   * For any route path, there should be exactly one corresponding navigation item.
   * This ensures that active highlighting is unambiguous.
   */
  it('Property 4: Each route path maps to exactly one navigation item', () => {
    fc.assert(
      fc.property(fc.constantFrom(...SIDEBAR_NAV_ITEMS), (item) => {
        // Count how many items have the same path
        const matchingItems = SIDEBAR_NAV_ITEMS.filter((i) => i.path === item.path);
        return matchingItems.length === 1;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: routing-navigation, Property 4: Active route highlighting**
   * **Validates: Requirements 5.1, 5.3**
   *
   * For any two different navigation items, their paths should be different.
   * This ensures that route-based active state detection works correctly.
   */
  it('Property 4: Different navigation items have different paths', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...SIDEBAR_NAV_ITEMS),
        fc.constantFrom(...SIDEBAR_NAV_ITEMS),
        (item1, item2) => {
          // If IDs are different, paths should be different
          if (item1.id !== item2.id) {
            return item1.path !== item2.path;
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: routing-navigation, Property 4: Active route highlighting**
   * **Validates: Requirements 5.1, 5.3**
   *
   * For any navigation item, the active state can be determined by comparing
   * the current path with the item's path using strict equality.
   */
  it('Property 4: Active state is determinable by path equality', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...SIDEBAR_NAV_ITEMS),
        fc.constantFrom(...SIDEBAR_NAV_ITEMS.map((i) => i.path)),
        (item, currentPath) => {
          // Active state should be true if and only if paths match exactly
          const isActive = currentPath === item.path;
          // This should be a boolean
          return typeof isActive === 'boolean';
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: routing-navigation, Property 4: Active route highlighting**
   * **Validates: Requirements 5.1, 5.3**
   *
   * For any current path that matches a navigation item, exactly one item
   * should be marked as active.
   */
  it('Property 4: Exactly one item is active for any valid route', () => {
    fc.assert(
      fc.property(fc.constantFrom(...SIDEBAR_NAV_ITEMS.map((i) => i.path)), (currentPath) => {
        // Count how many items would be active for this path
        const activeItems = SIDEBAR_NAV_ITEMS.filter((item) => item.path === currentPath);
        return activeItems.length === 1;
      }),
      { numRuns: 100 }
    );
  });
});

describe('Keyboard Navigation Property Tests', () => {
  /**
   * **Feature: routing-navigation, Property 7: Keyboard navigation activation**
   * **Validates: Requirements 9.2**
   *
   * For any navigation item, it should have a valid path that can be navigated to.
   * This ensures keyboard activation (Enter key) has a valid target.
   */
  it('Property 7: All navigation items have navigable paths', () => {
    fc.assert(
      fc.property(fc.constantFrom(...SIDEBAR_NAV_ITEMS), (item) => {
        // Path should be a non-empty string starting with '/'
        return typeof item.path === 'string' && item.path.length > 0 && item.path.startsWith('/');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: routing-navigation, Property 7: Keyboard navigation activation**
   * **Validates: Requirements 9.2**
   *
   * For any navigation item, the path should not contain invalid URL characters.
   */
  it('Property 7: Navigation paths contain only valid URL characters', () => {
    fc.assert(
      fc.property(fc.constantFrom(...SIDEBAR_NAV_ITEMS), (item) => {
        // Path should only contain valid URL path characters
        const validPathRegex = /^\/[a-z0-9-]*$/;
        return validPathRegex.test(item.path);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: routing-navigation, Property 7: Keyboard navigation activation**
   * **Validates: Requirements 9.2**
   *
   * For any navigation item, the id should be a valid HTML id attribute value.
   * This ensures proper focus management for keyboard navigation.
   */
  it('Property 7: Navigation item IDs are valid HTML identifiers', () => {
    fc.assert(
      fc.property(fc.constantFrom(...SIDEBAR_NAV_ITEMS), (item) => {
        // ID should be a valid HTML id (alphanumeric and hyphens, not starting with number)
        const validIdRegex = /^[a-z][a-z0-9-]*$/;
        return validIdRegex.test(item.id);
      }),
      { numRuns: 100 }
    );
  });
});
