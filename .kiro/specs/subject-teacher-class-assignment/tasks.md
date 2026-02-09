# Implementation Plan: Subject-Teacher-Class Assignment System

## Overview

This implementation plan transforms the Subject-Teacher-Class Assignment System
design into a series of incremental coding tasks. The approach enhances existing
TeacherEditDrawer, ClassEditDrawer, and SubjectEditDrawer components with
assignment management capabilities while maintaining consistency with
established patterns.

The implementation follows the integration strategy, building upon existing data
structures (Teacher.classAssignments, ClassGroup.subjectRequirements) and UI
patterns (TanStack Query, React Hook Form, Shadcn/ui components).

## Tasks

- [x] 1. Set up shared assignment services and types
  - Create shared assignment types and interfaces
  - Implement assignment validation service
  - Set up conflict detection algorithms
  - Create workload calculation utilities
  - _Requirements: 5.1, 5.2, 5.3, 6.1, 6.2, 2.2, 2.5_

- [ ]\* 1.1 Write property tests for assignment validation
  - **Property 1: Teacher-Subject Compatibility Validation**
  - **Validates: Requirements 5.1, 5.2, 5.3**

- [ ]\* 1.2 Write property tests for workload calculation
  - **Property 2: Workload Calculation Accuracy**
  - **Validates: Requirements 2.2, 2.5**

- [ ]\* 1.3 Write property tests for conflict detection
  - **Property 4: Assignment Conflict Detection**
  - **Validates: Requirements 6.1, 6.2**

- [x] 2. Enhance Teacher feature with assignment management
  - [x] 2.1 Add assignments tab to TeacherEditDrawer
    - Extend TeacherEditDrawer with new "تخصیص کلاس‌ها" tab
    - Create tab navigation and content structure
    - _Requirements: 1.1, 1.2_

  - [x] 2.2 Implement TeacherAssignmentMatrix component
    - Create assignment matrix showing teacher-subject-class relationships
    - Add assign/remove buttons with validation
    - Implement conflict indicators and warnings
    - _Requirements: 1.2, 1.3, 1.4, 1.5_

  - [x] 2.3 Implement TeacherWorkloadCalculator component
    - Create workload display with current/max periods
    - Add visual indicators (progress bars, color coding)
    - Implement real-time workload updates
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6_

  - [x] 2.4 Create teacher assignment hooks
    - Implement useTeacherAssignments hook for CRUD operations
    - Create useTeacherWorkload hook for calculations
    - Add TanStack Query integration with cache invalidation
    - _Requirements: 1.6, 8.4, 8.5_

- [ ]\* 2.5 Write property tests for workload threshold detection
  - **Property 3: Workload Threshold Detection**
  - **Validates: Requirements 2.3, 2.4**

- [ ]\* 2.6 Write unit tests for TeacherAssignmentMatrix
  - Test assignment matrix rendering and interactions
  - Test conflict indicator display
  - _Requirements: 1.3, 1.4, 1.5_

- [ ] 3. Checkpoint - Teacher assignment functionality complete
  - Ensure all teacher assignment tests pass, ask the user if questions arise.

- [x] 4. Enhance Class feature with teacher assignment
  - [x] 4.1 Enhance SubjectRequirementsEditor component
    - Add teacher dropdown selectors to subject requirements
    - Implement assignment status indicators
    - Add inline conflict warnings
    - _Requirements: 3.1, 3.2, 3.6_

  - [x] 4.2 Implement class assignment validation
    - Add teacher selection validation
    - Implement conflict detection for class assignments
    - Create assignment status calculation
    - _Requirements: 3.3, 3.4_

  - [x] 4.3 Create class assignment hooks
    - Implement useClassAssignments hook
    - Add bidirectional assignment updates
    - Integrate with existing class management hooks
    - _Requirements: 3.5_

- [ ]\* 4.4 Write property tests for assignment synchronization
  - **Property 5: Bidirectional Assignment Synchronization**
  - **Validates: Requirements 3.5, 7.1, 7.2**

- [ ]\* 4.5 Write property tests for assignment status calculation
  - **Property 6: Assignment Status Calculation**
  - **Validates: Requirements 3.6, 4.4**

- [x] 5. Enhance Subject feature with coverage analysis
  - [x] 5.1 Add coverage section to SubjectEditDrawer
    - Create "پوشش تدریس" section in subject editing
    - Add coverage analysis display structure
    - _Requirements: 4.1_

  - [x] 5.2 Implement SubjectCoverageView component
    - Create coverage analysis with class assignment status
    - Display teacher compatibility information
    - Add quick-assign functionality for unassigned classes
    - _Requirements: 4.2, 4.3, 4.4, 4.5_

  - [x] 5.3 Create subject coverage hooks
    - Implement useSubjectCoverage hook
    - Add coverage percentage calculations
    - Create teacher compatibility analysis
    - _Requirements: 4.6_

- [ ]\* 5.4 Write property tests for coverage calculation
  - **Property 7: Coverage Percentage Calculation**
  - **Validates: Requirements 4.2, 4.5**

- [ ]\* 5.5 Write property tests for teacher filtering
  - **Property 8: Teacher Filtering for Subject Compatibility**
  - **Validates: Requirements 5.5, 4.3**

- [x] 6. Implement assignment API enhancements
  - [x] 6.1 Create assignment validation endpoints
    - Add POST /api/assignments/validate endpoint
    - Implement assignment validation logic in backend
    - Add conflict detection API methods
    - _Requirements: 5.4, 6.5_

  - [x] 6.2 Create assignment operation endpoints
    - Add POST /api/assignments/assign endpoint
    - Add DELETE /api/assignments/unassign endpoint
    - Implement bidirectional data updates
    - _Requirements: 1.6, 3.5_

  - [x] 6.3 Create analysis endpoints
    - Add GET /api/assignments/teacher/:id/workload endpoint
    - Add GET /api/assignments/subject/:id/coverage endpoint
    - Add GET /api/assignments/conflicts endpoint
    - _Requirements: 2.1, 4.2, 6.5_

- [ ]\* 6.4 Write integration tests for assignment APIs
  - Test assignment CRUD operations
  - Test bidirectional data synchronization
  - Test conflict detection endpoints
  - _Requirements: 9.1, 9.2_

- [ ] 7. Checkpoint - Core assignment functionality complete
  - Ensure all assignment tests pass, ask the user if questions arise.

- [x] 8. Implement enhanced data serialization
  - [x] 8.1 Create enhanced serialization utilities
    - Implement serializeEnhancedClassAssignments function
    - Create deserializeEnhancedClassAssignments function
    - Add enhanced subject requirements serialization
    - _Requirements: 7.1, 7.2, 7.4, 7.5_

  - [x] 8.2 Update existing data models
    - Enhance Teacher.classAssignments with calculated fields
    - Enhance ClassGroup.subjectRequirements with teacher assignments
    - Maintain backward compatibility with solver format
    - _Requirements: 7.1, 7.2_

- [ ]\* 8.3 Write property tests for data serialization
  - **Property 10: Assignment Data Serialization Round-trip**
  - **Validates: Requirements 7.4, 7.5**

- [x] 9. Implement real-time UI synchronization
  - [x] 9.1 Add real-time workload updates
    - Implement immediate workload recalculation on assignment changes
    - Update all workload indicators across components
    - Add optimistic updates for better UX
    - _Requirements: 8.4, 8.5_

  - [x] 9.2 Add real-time conflict detection
    - Implement immediate conflict checking on assignment changes
    - Update conflict indicators across all related components
    - Add conflict resolution suggestions
    - _Requirements: 6.6_

  - [x] 9.3 Implement assignment status synchronization
    - Update assignment status indicators in real-time
    - Synchronize status across teacher, class, and subject views
    - Add status change animations and feedback
    - _Requirements: 8.5_

- [ ]\* 9.4 Write property tests for UI synchronization
  - **Property 9: Real-time UI Synchronization**
  - **Validates: Requirements 8.4, 8.5**

- [ ]\* 9.5 Write property tests for conflict resolution
  - **Property 11: Conflict Resolution State Updates**
  - **Validates: Requirements 6.6**

- [x] 10. Add user feedback and error handling
  - [x] 10.1 Implement assignment notifications
    - Add success toast notifications for assignment operations
    - Create confirmation dialogs for assignment removal
    - Add detailed error messages for assignment failures
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 10.2 Create error handling service
    - Implement AssignmentErrorHandler class
    - Add Farsi error message translations
    - Create conflict resolution suggestion system
    - _Requirements: 8.3, 6.5_

  - [x] 10.3 Add progress indicators for bulk operations
    - Implement progress bars for bulk assignment operations
    - Add summary results display
    - Create cancellation functionality
    - _Requirements: 8.6_

- [ ]\* 10.4 Write unit tests for error handling
  - Test error message generation
  - Test conflict resolution suggestions
  - Test progress indicator functionality
  - _Requirements: 8.3, 6.5, 8.6_

- [x] 11. Implement performance optimizations
  - [x] 11.1 Add assignment data caching
    - Implement efficient TanStack Query caching strategies
    - Add optimistic updates for assignment operations
    - Create cache invalidation patterns
    - _Requirements: 11.6_

  - [x] 11.2 Optimize assignment calculations
    - Implement efficient workload calculation algorithms
    - Add memoization for expensive calculations
    - Create batch processing for bulk operations
    - _Requirements: 11.2, 11.5_

  - [x] 11.3 Add virtualization for large datasets
    - Implement virtual scrolling for assignment matrices
    - Add pagination for large teacher/class lists
    - Create efficient rendering for coverage views
    - _Requirements: 11.4_

- [ ]\* 11.4 Write performance tests
  - **Property 12: Performance Requirements Compliance**
  - **Validates: Requirements 11.1, 11.2, 11.3**

- [ ] 12. Add data persistence safeguards
  - [ ] 12.1 Implement transaction-like operations
    - Create AssignmentTransactionService class
    - Add rollback functionality for failed operations
    - Implement data consistency checks
    - _Requirements: 9.5_

  - [ ] 12.2 Add data validation and recovery
    - Implement graceful handling of corrupted assignment data
    - Add data recovery options for invalid states
    - Create data migration utilities if needed
    - _Requirements: 9.3_

- [ ]\* 12.3 Write property tests for data persistence
  - **Property 13: Data Persistence Consistency**
  - **Validates: Requirements 9.1, 9.2**

- [ ]\* 12.4 Write property tests for error recovery
  - **Property 14: Error Handling and Recovery**
  - **Validates: Requirements 9.5**

- [ ] 13. Final integration and testing
  - [ ] 13.1 Integration testing
    - Test assignment system with existing solver integration
    - Verify compatibility with existing timetable generation
    - Test assignment data flow through complete system
    - _Requirements: 7.3_

  - [ ] 13.2 UI consistency verification
    - Verify all assignment components use Shadcn/ui design system
    - Test RTL layout and Farsi localization
    - Ensure consistent validation patterns with React Hook Form
    - _Requirements: 10.1, 10.2, 10.5_

  - [ ] 13.3 Performance validation
    - Test assignment operations with large datasets (100 teachers, 50 classes)
    - Verify loading times meet requirements (2s loading, 500ms calculations)
    - Test bulk operation performance
    - _Requirements: 11.1, 11.2, 11.3_

- [ ] 14. Final checkpoint - Complete assignment system
  - Ensure all tests pass, verify integration with existing features, ask the
    user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation and user feedback
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Integration tests ensure compatibility with existing system
- Performance tests verify scalability requirements

The implementation maintains full backward compatibility with the existing
solver while providing comprehensive assignment management capabilities through
enhanced UI components and robust data validation.
