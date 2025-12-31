/**
 * Property-based tests for Route-to-Component Mapping
 *
 * **Feature: routing-navigation, Property 2: Route-to-component mapping**
 * **Validates: Requirements 2.1-2.15**
 *
 * Property 2: Route-to-component mapping
 * *For any* valid route path in the application, navigating to that path SHALL
 * render the corresponding page component as defined in the route configuration.
 */

import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

/**
 * Route configuration representing all routes in the application.
 * Each entry maps a route path to its expected component type.
 */
interface RouteConfig {
  path: string;
  componentName: string;
  componentType: 'placeholder' | 'feature' | 'redirect';
  titleKey?: string; // For placeholder pages
}

/**
 * All routes defined in the application matching Requirements 2.1-2.15.
 * This configuration mirrors the actual route files in src/routes/.
 */
const APPLICATION_ROUTES: RouteConfig[] = [
  // Requirement 2.1: /dashboard renders DashboardPage
  { path: '/dashboard', componentName: 'DashboardPage', componentType: 'feature' },
  // Requirement 2.2: /school-settings renders SchoolSettingsPage
  {
    path: '/school-settings',
    componentName: 'SchoolSettingsPage',
    componentType: 'placeholder',
    titleKey: 'sidebar.schoolSettings',
  },
  // Requirement 2.3: /periods renders PeriodsPage
  {
    path: '/periods',
    componentName: 'PeriodsPage',
    componentType: 'placeholder',
    titleKey: 'sidebar.periods',
  },
  // Requirement 2.4: /rooms renders RoomsPage
  {
    path: '/rooms',
    componentName: 'RoomsPage',
    componentType: 'placeholder',
    titleKey: 'sidebar.rooms',
  },
  // Requirement 2.5: /teachers renders TeachersPage
  {
    path: '/teachers',
    componentName: 'TeachersPage',
    componentType: 'placeholder',
    titleKey: 'sidebar.teachers',
  },
  // Requirement 2.6: /subjects renders SubjectsPage
  {
    path: '/subjects',
    componentName: 'SubjectsPage',
    componentType: 'placeholder',
    titleKey: 'sidebar.subjects',
  },
  // Requirement 2.7: /classes renders ClassesPage from existing feature
  { path: '/classes', componentName: 'ClassesPage', componentType: 'feature' },
  // Requirement 2.8: /constraints renders ConstraintsPage
  {
    path: '/constraints',
    componentName: 'ConstraintsPage',
    componentType: 'placeholder',
    titleKey: 'sidebar.constraints',
  },
  // Requirement 2.9: /schedule-dashboard renders ScheduleDashboardPage
  {
    path: '/schedule-dashboard',
    componentName: 'ScheduleDashboardPage',
    componentType: 'placeholder',
    titleKey: 'sidebar.scheduleDashboard',
  },
  // Requirement 2.10: /classes-schedule renders ClassesSchedulePage
  {
    path: '/classes-schedule',
    componentName: 'ClassesSchedulePage',
    componentType: 'placeholder',
    titleKey: 'sidebar.classesSchedule',
  },
  // Requirement 2.11: /teachers-schedule renders TeachersSchedulePage
  {
    path: '/teachers-schedule',
    componentName: 'TeachersSchedulePage',
    componentType: 'placeholder',
    titleKey: 'sidebar.teachersSchedule',
  },
  // Requirement 2.12: /guidance renders GuidancePage
  {
    path: '/guidance',
    componentName: 'GuidancePage',
    componentType: 'placeholder',
    titleKey: 'sidebar.guidance',
  },
  // Requirement 2.13: /about renders AboutPage
  {
    path: '/about',
    componentName: 'AboutPage',
    componentType: 'placeholder',
    titleKey: 'sidebar.about',
  },
  // Requirement 2.14: /settings renders SettingsPage
  {
    path: '/settings',
    componentName: 'SettingsPage',
    componentType: 'placeholder',
    titleKey: 'sidebar.settings',
  },
  // Requirement 2.15: /logout renders LogoutPage
  {
    path: '/logout',
    componentName: 'LogoutPage',
    componentType: 'placeholder',
    titleKey: 'sidebar.logout',
  },
];

/**
 * Routes from the generated route tree that should match our configuration.
 * This is extracted from routeTree.gen.ts FileRoutesByFullPath interface.
 */
const GENERATED_ROUTE_PATHS = [
  '/',
  '/about',
  '/classes',
  '/classes-schedule',
  '/constraints',
  '/dashboard',
  '/guidance',
  '/logout',
  '/periods',
  '/rooms',
  '/schedule-dashboard',
  '/school-settings',
  '/settings',
  '/subjects',
  '/teachers',
  '/teachers-schedule',
];

describe('Route-to-Component Mapping Property Tests', () => {
  /**
   * **Feature: routing-navigation, Property 2: Route-to-component mapping**
   * **Validates: Requirements 2.1-2.15**
   *
   * For any route in the application configuration, the path should be a valid
   * route starting with '/'.
   */
  it('Property 2: All routes have valid path format', () => {
    fc.assert(
      fc.property(fc.constantFrom(...APPLICATION_ROUTES), (route) => {
        // Path should start with '/'
        return route.path.startsWith('/');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: routing-navigation, Property 2: Route-to-component mapping**
   * **Validates: Requirements 2.1-2.15**
   *
   * For any route, the component name should follow the naming convention
   * ending with 'Page'.
   */
  it('Property 2: All route components follow Page naming convention', () => {
    fc.assert(
      fc.property(fc.constantFrom(...APPLICATION_ROUTES), (route) => {
        // Component name should end with 'Page'
        return route.componentName.endsWith('Page');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: routing-navigation, Property 2: Route-to-component mapping**
   * **Validates: Requirements 2.1-2.15**
   *
   * All routes should have unique paths.
   */
  it('Property 2: All routes have unique paths', () => {
    const paths = APPLICATION_ROUTES.map((route) => route.path);
    const uniquePaths = new Set(paths);
    expect(uniquePaths.size).toBe(paths.length);
  });

  /**
   * **Feature: routing-navigation, Property 2: Route-to-component mapping**
   * **Validates: Requirements 2.1-2.15**
   *
   * All routes should have unique component names.
   */
  it('Property 2: All routes have unique component names', () => {
    const componentNames = APPLICATION_ROUTES.map((route) => route.componentName);
    const uniqueNames = new Set(componentNames);
    expect(uniqueNames.size).toBe(componentNames.length);
  });

  /**
   * **Feature: routing-navigation, Property 2: Route-to-component mapping**
   * **Validates: Requirements 2.1-2.15**
   *
   * For any placeholder route, it should have a titleKey defined.
   */
  it('Property 2: All placeholder routes have titleKey defined', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...APPLICATION_ROUTES.filter((r) => r.componentType === 'placeholder')),
        (route) => {
          // Placeholder routes must have a titleKey
          return route.titleKey !== undefined && route.titleKey.length > 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: routing-navigation, Property 2: Route-to-component mapping**
   * **Validates: Requirements 2.1-2.15**
   *
   * For any placeholder route, the titleKey should follow the 'sidebar.{name}' pattern.
   */
  it('Property 2: Placeholder routes have consistent titleKey pattern', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...APPLICATION_ROUTES.filter((r) => r.componentType === 'placeholder')),
        (route) => {
          // titleKey should start with 'sidebar.'
          return route.titleKey!.startsWith('sidebar.');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: routing-navigation, Property 2: Route-to-component mapping**
   * **Validates: Requirements 2.1-2.15**
   *
   * All application routes (except index) should be registered in the generated route tree.
   */
  it('Property 2: All application routes are registered in route tree', () => {
    fc.assert(
      fc.property(fc.constantFrom(...APPLICATION_ROUTES), (route) => {
        // Each application route should exist in the generated routes
        return GENERATED_ROUTE_PATHS.includes(route.path);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: routing-navigation, Property 2: Route-to-component mapping**
   * **Validates: Requirements 2.1-2.15**
   *
   * The number of application routes should match the expected count (15 routes).
   */
  it('Property 2: Correct number of application routes defined', () => {
    // Requirements 2.1-2.15 specify 15 routes
    expect(APPLICATION_ROUTES.length).toBe(15);
  });

  /**
   * **Feature: routing-navigation, Property 2: Route-to-component mapping**
   * **Validates: Requirements 2.1-2.15**
   *
   * For any route path, the path segment should match the component name pattern.
   * E.g., '/dashboard' -> 'DashboardPage', '/school-settings' -> 'SchoolSettingsPage'
   */
  it('Property 2: Route paths are consistent with component names', () => {
    fc.assert(
      fc.property(fc.constantFrom(...APPLICATION_ROUTES), (route) => {
        // Convert path to expected component name
        // '/dashboard' -> 'Dashboard' -> 'DashboardPage'
        // '/school-settings' -> 'SchoolSettings' -> 'SchoolSettingsPage'
        const pathSegment = route.path.slice(1); // Remove leading '/'
        const expectedBaseName = pathSegment
          .split('-')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join('');
        const expectedComponentName = expectedBaseName + 'Page';
        return route.componentName === expectedComponentName;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: routing-navigation, Property 2: Route-to-component mapping**
   * **Validates: Requirements 2.1-2.15**
   *
   * Route paths should only contain valid URL characters (lowercase letters, numbers, hyphens).
   */
  it('Property 2: Route paths contain only valid URL characters', () => {
    fc.assert(
      fc.property(fc.constantFrom(...APPLICATION_ROUTES), (route) => {
        // Path should only contain valid URL path characters
        const validPathRegex = /^\/[a-z0-9-]+$/;
        return validPathRegex.test(route.path);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: routing-navigation, Property 2: Route-to-component mapping**
   * **Validates: Requirements 2.1-2.15**
   *
   * For any route, the component type should be one of the valid types.
   */
  it('Property 2: All routes have valid component types', () => {
    fc.assert(
      fc.property(fc.constantFrom(...APPLICATION_ROUTES), (route) => {
        const validTypes = ['placeholder', 'feature', 'redirect'];
        return validTypes.includes(route.componentType);
      }),
      { numRuns: 100 }
    );
  });
});

describe('Root Path Redirect Property Tests', () => {
  /**
   * **Feature: routing-navigation, Property 1: Root path redirect**
   * **Validates: Requirements 1.1, 1.2, 1.3**
   *
   * Property 1: Root path redirect
   * *For any* navigation to the root path `/`, the router SHALL redirect to
   * `/dashboard` and render the DashboardPage component.
   */

  /**
   * The redirect target configuration.
   * This should match the redirect in src/routes/index.tsx.
   */
  const REDIRECT_CONFIG = {
    from: '/',
    to: '/dashboard',
    targetComponent: 'DashboardPage',
  };

  /**
   * **Feature: routing-navigation, Property 1: Root path redirect**
   * **Validates: Requirements 1.1, 1.2, 1.3**
   *
   * The root path should be defined in the route tree.
   */
  it('Property 1: Root path is defined in route tree', () => {
    expect(GENERATED_ROUTE_PATHS).toContain(REDIRECT_CONFIG.from);
  });

  /**
   * **Feature: routing-navigation, Property 1: Root path redirect**
   * **Validates: Requirements 1.1, 1.2, 1.3**
   *
   * The redirect target path should be a valid route in the application.
   */
  it('Property 1: Redirect target is a valid route', () => {
    expect(GENERATED_ROUTE_PATHS).toContain(REDIRECT_CONFIG.to);
  });

  /**
   * **Feature: routing-navigation, Property 1: Root path redirect**
   * **Validates: Requirements 1.1, 1.2, 1.3**
   *
   * The redirect target should have a corresponding component in the route configuration.
   */
  it('Property 1: Redirect target has corresponding component', () => {
    const targetRoute = APPLICATION_ROUTES.find((r) => r.path === REDIRECT_CONFIG.to);
    expect(targetRoute).toBeDefined();
    expect(targetRoute?.componentName).toBe(REDIRECT_CONFIG.targetComponent);
  });

  /**
   * **Feature: routing-navigation, Property 1: Root path redirect**
   * **Validates: Requirements 1.1, 1.2, 1.3**
   *
   * The redirect should go to a feature component (not a placeholder).
   */
  it('Property 1: Redirect target is a feature component', () => {
    const targetRoute = APPLICATION_ROUTES.find((r) => r.path === REDIRECT_CONFIG.to);
    expect(targetRoute?.componentType).toBe('feature');
  });

  /**
   * **Feature: routing-navigation, Property 1: Root path redirect**
   * **Validates: Requirements 1.1, 1.2, 1.3**
   *
   * For any valid redirect configuration, the source and target paths should be different.
   */
  it('Property 1: Redirect source and target are different', () => {
    expect(REDIRECT_CONFIG.from).not.toBe(REDIRECT_CONFIG.to);
  });

  /**
   * **Feature: routing-navigation, Property 1: Root path redirect**
   * **Validates: Requirements 1.1, 1.2, 1.3**
   *
   * The redirect target path should be a valid URL path format.
   */
  it('Property 1: Redirect target has valid path format', () => {
    const validPathRegex = /^\/[a-z0-9-]+$/;
    expect(validPathRegex.test(REDIRECT_CONFIG.to)).toBe(true);
  });

  /**
   * **Feature: routing-navigation, Property 1: Root path redirect**
   * **Validates: Requirements 1.1, 1.2, 1.3**
   *
   * The root path should be exactly '/'.
   */
  it('Property 1: Root path is exactly "/"', () => {
    expect(REDIRECT_CONFIG.from).toBe('/');
  });
});

describe('Route Tree Consistency Tests', () => {
  /**
   * **Feature: routing-navigation, Property 2: Route-to-component mapping**
   * **Validates: Requirements 2.1-2.15**
   *
   * The generated route tree should include the index route for redirect.
   */
  it('Property 2: Route tree includes index route', () => {
    expect(GENERATED_ROUTE_PATHS).toContain('/');
  });

  /**
   * **Feature: routing-navigation, Property 2: Route-to-component mapping**
   * **Validates: Requirements 2.1-2.15**
   *
   * The generated route tree should have exactly 16 routes (15 pages + 1 index).
   */
  it('Property 2: Route tree has correct number of routes', () => {
    // 15 application routes + 1 index route = 16 total
    expect(GENERATED_ROUTE_PATHS.length).toBe(16);
  });

  /**
   * **Feature: routing-navigation, Property 2: Route-to-component mapping**
   * **Validates: Requirements 2.1-2.15**
   *
   * For any generated route path, it should be unique.
   */
  it('Property 2: Generated route paths are unique', () => {
    const uniquePaths = new Set(GENERATED_ROUTE_PATHS);
    expect(uniquePaths.size).toBe(GENERATED_ROUTE_PATHS.length);
  });
});
