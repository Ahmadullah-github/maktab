# Implementation Plan

- [x] 1. Update MainLayout to use Router Outlet
  - [x] 1.1 Modify MainLayout component to render Outlet instead of Workspace
    - Import `Outlet` from `@tanstack/react-router`
    - Remove `Workspace` component import and usage
    - Render `<Outlet />` in the main content area
    - Keep Header, Sidebar, and right panel structure
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 2. Update root route to render content properly
  - [x] 2.1 Modify \_\_root.tsx to show Outlet content
    - Remove the hidden div wrapper around Outlet
    - Ensure MainLayout contains the visible Outlet
    - _Requirements: 8.1, 8.3_

- [x] 3. Create route files for all pages
  - [x] 3.1 Update index.tsx to redirect to /dashboard
    - Use TanStack Router's redirect functionality
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 3.2 Create dashboard.tsx route file
    - Import and render DashboardPage from features/dashboard
    - _Requirements: 2.1_
  - [x] 3.3 Create school-settings.tsx route file
    - Create placeholder SchoolSettingsPage component
    - _Requirements: 2.2_
  - [x] 3.4 Create periods.tsx route file
    - Create placeholder PeriodsPage component
    - _Requirements: 2.3_
  - [x] 3.5 Create rooms.tsx route file
    - Create placeholder RoomsPage component
    - _Requirements: 2.4_
  - [x] 3.6 Create teachers.tsx route file
    - Create placeholder TeachersPage component
    - _Requirements: 2.5_
  - [x] 3.7 Create subjects.tsx route file
    - Create placeholder SubjectsPage component
    - _Requirements: 2.6_
  - [x] 3.8 Create classes.tsx route file
    - Import and render ClassesPage from existing features/classes
    - _Requirements: 2.7_
  - [x] 3.9 Create constraints.tsx route file
    - Create placeholder ConstraintsPage component
    - _Requirements: 2.8_
  - [x] 3.10 Create schedule-dashboard.tsx route file
    - Create placeholder ScheduleDashboardPage component
    - _Requirements: 2.9_
  - [x] 3.11 Create classes-schedule.tsx route file
    - Create placeholder ClassesSchedulePage component
    - _Requirements: 2.10_
  - [x] 3.12 Create teachers-schedule.tsx route file
    - Create placeholder TeachersSchedulePage component
    - _Requirements: 2.11_
  - [x] 3.13 Create guidance.tsx route file
    - Create placeholder GuidancePage component
    - _Requirements: 2.12_
  - [x] 3.14 Create about.tsx route file
    - Create placeholder AboutPage component
    - _Requirements: 2.13_
  - [x] 3.15 Create settings.tsx route file
    - Create placeholder SettingsPage component
    - _Requirements: 2.14_
  - [x] 3.16 Create logout.tsx route file
    - Create placeholder LogoutPage component
    - _Requirements: 2.15_

- [x] 4. Create placeholder page components in feature folders
  - [x] 4.1 Create shared PlaceholderPage component
    - Create reusable component with title, icon, and "under development"
      message
    - Use consistent layout pattern
    - Support i18n for all text
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [x] 4.2 Create feature folder structure for placeholder pages
    - Create folders: school-settings, periods, rooms, teachers, subjects,
      constraints, schedule-dashboard, classes-schedule, teachers-schedule,
      guidance, about, settings, logout
    - Each folder contains components/ subfolder and index.ts
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 4.3 Write property test for placeholder page consistency
  - **Property 5: Placeholder page consistency**
  - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**

- [x] 5. Update Sidebar to use TanStack Router Links
  - [x] 5.1 Refactor Sidebar to use Link components
    - Replace click handlers with TanStack Router `<Link>` components
    - Use `activeProps` for active state styling
    - Remove tab-based navigation logic
    - Keep section labels as non-clickable headers
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3_
  - [x] 5.2 Implement active route highlighting
    - Use TanStack Router's active state detection
    - Apply primary color background and border to active item
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 5.3 Ensure keyboard navigation works
    - Verify Tab navigation through items
    - Ensure Enter key activates navigation
    - Maintain visible focus indicators
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 5.4 Write property test for sidebar click navigation
  - **Property 3: Sidebar click navigation**
  - **Validates: Requirements 4.1, 4.2**

- [x] 5.5 Write property test for active route highlighting
  - **Property 4: Active route highlighting**
  - **Validates: Requirements 5.1, 5.3**

- [x] 5.6 Write property test for keyboard navigation activation
  - **Property 7: Keyboard navigation activation**
  - **Validates: Requirements 9.2**

- [-] 6. Add i18n translation keys
  - [x] 6.1 Update fa.json with placeholder translation keys
    - Add `placeholder.underDevelopment` key
    - Verify all sidebar keys exist
    - _Requirements: 3.4, 7.1, 7.2_
  - [ ] 6.2 Update en.json with corresponding English translations
    - Add English versions of all new keys
    - _Requirements: 3.4_

- [x] 7. Regenerate route tree
  - [x] 7.1 Run TanStack Router code generation
    - Execute route generation to update routeTree.gen.ts
    - Verify all routes are properly registered
    - _Requirements: 2.1-2.15_

- [x] 7.2 Write property test for route-to-component mapping
  - **Property 2: Route-to-component mapping**
  - **Validates: Requirements 2.1-2.15**

- [x] 7.3 Write property test for root path redirect
  - **Property 1: Root path redirect**
  - **Validates: Requirements 1.1, 1.2, 1.3**

- [x] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Final verification and cleanup
  - [x] 9.1 Verify browser back/forward navigation works
    - Test navigation history integration
    - Verify sidebar active state updates on browser navigation
    - _Requirements: 10.1, 10.2, 10.3_
  - [x] 9.2 Remove unused tab-based navigation code
    - Clean up uiStore tab-related state if no longer needed
    - Remove TabBar component usage if applicable
    - _Requirements: 8.2_
  - [x] 9.3 Run TypeScript type check and fix any errors
    - Execute `npm run type-check` in packages/web
    - Fix any TypeScript errors
    - _Requirements: All_

- [x] 10. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
