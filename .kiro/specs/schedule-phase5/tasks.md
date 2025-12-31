# Implementation Plan

- [x] 1. Set up export feature structure and dependencies
  - Create export component directory structure in
    features/schedule/components/export/
  - Add backend export service directory structure in packages/api/src/services/
  - Install required dependencies: puppeteer, exceljs, archiver
  - Set up export API routes structure
  - _Requirements: 1.1, 9.4_

- [x] 2. Implement export dialog components
- [x] 2.1 Create ExportDialog main component
  - Implement modal dialog using existing Dialog component
  - Add form state management with React Hook Form and Zod validation
  - Integrate with current schedule context (scheduleId, type, targetId)
  - _Requirements: 1.1, 9.4_

- [x] 2.2 Create FormatSelector component
  - Implement PDF/Excel radio button selection
  - Handle format change events
  - _Requirements: 1.1_

- [x] 2.3 Create ScopeSelector component
  - Implement Current/All Classes/All Teachers radio buttons
  - Adapt options based on current schedule type (class/teacher)
  - _Requirements: 1.2_

- [x] 2.4 Create LanguageSelector component
  - Implement Persian/English radio button selection
  - Handle language change events
  - _Requirements: 1.3_

- [x] 2.5 Create SettingsToggles component
  - Integrate with Phase 4 useDisplaySettings hook
  - Display checkboxes for showTeacherName, showRoomName, colorBy settings
  - Handle settings change events
  - _Requirements: 1.5, 7.5_

- [x] 2.6 Create ExportProgress component
  - Implement progress bar with percentage display
  - Add status text showing "Exporting X of Y..." format
  - Include cancel button functionality
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 2.7 Write property test for export dialog components
  - **Property 1: Paper Size Consistency**
  - **Validates: Requirements 1.4**

- [x] 2.8 Write property test for display settings integration
  - **Property 2: Display Settings Integration**
  - **Validates: Requirements 7.2**

- [x] 2.9 Write unit tests for export dialog components
  - Test ExportDialog rendering and form submission
  - Test component interactions and state management
  - Test accessibility and RTL layout
  - _Requirements: 1.1, 1.2, 1.3, 1.5_

- [-] 3. Implement export API integration
- [x] 3.1 Create export API functions
  - Implement exportSchedule API call function
  - Add progress polling for batch exports
  - Handle API response and error cases
  - _Requirements: 2.1, 8.1_

- [x] 3.2 Create useExportSchedule hook
  - Implement TanStack Query mutation for export requests
  - Add progress tracking state management
  - Implement automatic download trigger on completion
  - Add cancellation support
  - _Requirements: 2.1, 8.2, 4.3_

- [x] 3.3 Write property test for filename convention
  - **Property 3: Filename Convention Compliance**
  - **Validates: Requirements 2.5, 8.4**

- [ ] 3.4 Write property test for export scope limitation
  - **Property 7: Export Scope Limitation**
  - **Validates: Requirements 3.5**

- [ ] 3.5 Write unit tests for export API integration
  - Test API function calls and response handling
  - Test hook state management and side effects
  - Test error handling and retry logic
  - _Requirements: 2.1, 8.1, 8.2_

- [ ] 4. Implement backend export routes and validation
- [ ] 4.1 Create export routes
  - Implement POST /api/timetables/:id/export endpoint
  - Add GET /api/export/progress/:jobId for progress tracking
  - Add GET /api/export/download/:token for file download
  - Add DELETE /api/export/cancel/:jobId for cancellation
  - _Requirements: 2.1, 4.1, 8.1_

- [ ] 4.2 Add export request validation
  - Implement Zod schema for ExportRequest validation
  - Add batch size limit validation (max 50 schedules)
  - Validate display settings and format combinations
  - _Requirements: 3.5, 10.1, 10.2_

- [ ] 4.3 Write unit tests for export routes
  - Test endpoint request/response handling
  - Test validation logic and error responses
  - Test authentication and authorization
  - _Requirements: 2.1, 3.5, 10.1_

- [x] 5. Implement core export service
- [x] 5.1 Create ExportService main orchestrator
  - Implement export request processing logic
  - Add temporary file management and cleanup scheduling
  - Integrate with PDF and Excel generation services
  - Handle batch export coordination
  - _Requirements: 2.1, 8.3, 8.5_

- [x] 5.2 Create AnalysisGenerationService
  - Implement analysis summary calculation logic
  - Generate school statistics (totalClasses, totalTeachers, utilizationRate)
  - Create analysis page content for batch exports
  - _Requirements: 3.3_

- [x] 5.3 Create FileCleanupService
  - Implement automatic cleanup of expired files
  - Add cleanup scheduling and monitoring
  - Handle download URL expiration (1 hour)
  - _Requirements: 8.3, 8.5_

- [x] 5.4 Write property test for batch export structure
  - **Property 4: Batch Export Page Structure**
  - **Validates: Requirements 3.4**

- [x] 5.5 Write property test for URL expiration
  - **Property 9: URL Expiration**
  - **Validates: Requirements 8.3**

- [x] 5.6 Write property test for analysis summary content
  - **Property 10: Analysis Summary Content**
  - **Validates: Requirements 3.3**

- [x] 5.7 Write unit tests for export service
  - Test export orchestration logic
  - Test file management and cleanup
  - Test error handling and recovery
  - _Requirements: 2.1, 8.3, 8.5_

- [-] 6. Implement PDF generation service
- [x] 6.1 Create PDFGenerationService
  - Set up puppeteer or pdfkit for PDF generation
  - Implement A4 paper size configuration
  - Add HTML template system for schedule rendering
  - _Requirements: 1.4, 5.3_

- [x] 6.2 Add Persian font embedding
  - Integrate Vazirmatn font files into PDF generation
  - Implement font embedding in PDF metadata
  - Handle font fallback for missing characters
  - _Requirements: 5.1, 5.4_

- [x] 6.3 Implement RTL layout support
  - Add RTL text direction for Persian content
  - Configure proper text alignment and flow
  - Handle mixed LTR/RTL content correctly
  - _Requirements: 5.2_

- [x] 6.4 Add display settings integration
  - Apply showTeacherName, showRoomName settings to PDF content
  - Implement color coding preservation from UI
  - Handle conditional content rendering
  - _Requirements: 7.2, 7.4_

- [x] 6.5 Implement batch PDF generation
  - Create multi-page PDF with analysis summary
  - Add page numbering and headers
  - Generate one page per schedule plus analysis page
  - _Requirements: 3.1, 3.2, 3.4_

- [x] 6.6 Write property test for RTL layout
  - **Property 5: RTL Layout Application**
  - **Validates: Requirements 5.2**

- [x] 6.7 Write property test for font embedding
  - **Property 11: Font Embedding Verification**
  - **Validates: Requirements 5.1**

- [x] 6.8 Write property test for color coding preservation
  - **Property 12: Color Coding Preservation**
  - **Validates: Requirements 7.4**

- [x] 6.9 Write unit tests for PDF generation
  - Test PDF creation with various settings
  - Test font embedding and RTL layout
  - Test batch PDF structure and content
  - _Requirements: 5.1, 5.2, 5.3, 7.4_

- [x] 7. Implement Excel generation service
- [x] 7.1 Create ExcelGenerationService
  - Set up exceljs library for Excel generation
  - Implement basic worksheet creation and styling
  - Add header formatting and cell styling
  - _Requirements: 6.2, 6.5_

- [x] 7.2 Add RTL worksheet configuration
  - Set worksheet.views[0].rightToLeft = true for all worksheets
  - Configure proper column ordering for RTL
  - Handle text alignment in RTL context
  - _Requirements: 6.1_

- [x] 7.3 Implement schedule data mapping
  - Map schedule grid data to Excel cells
  - Preserve cell structure and relationships
  - Apply display settings to Excel content
  - _Requirements: 6.5, 7.2_

- [x] 7.4 Add multi-worksheet support
  - Create separate worksheet for each schedule in batch exports
  - Add worksheet naming and organization
  - Handle large datasets efficiently
  - _Requirements: 6.3_

- [x] 7.5 Write property test for Excel RTL configuration
  - **Property 6: Excel RTL Configuration**
  - **Validates: Requirements 6.1**

- [x] 7.6 Write unit tests for Excel generation
  - Test Excel file creation and formatting
  - Test RTL configuration and data mapping
  - Test multi-worksheet functionality
  - _Requirements: 6.1, 6.2, 6.3, 6.5_

- [-] 8. Integrate export functionality into schedule views
- [x] 8.1 Add export buttons to ClassScheduleView
  - Add export button with download icon to schedule header
  - Integrate with ExportDialog component
  - Pass current schedule context to dialog
  - _Requirements: 9.1, 9.3, 9.5_

- [x] 8.2 Add export buttons to TeacherScheduleView
  - Add export button with download icon to schedule header
  - Integrate with ExportDialog component
  - Pass current schedule context to dialog
  - _Requirements: 9.2, 9.3, 9.5_

- [x] 8.3 Add accessibility and i18n support
  - Add proper ARIA labels for export buttons
  - Implement Persian/English translations for all export UI
  - Test keyboard navigation and screen reader support
  - _Requirements: 9.3, 10.5_

- [x] 8.4 Write unit tests for view integration
  - Test export button rendering and interactions
  - Test dialog opening and context passing
  - Test accessibility features
  - _Requirements: 9.1, 9.2, 9.3_

- [x] 9. Implement progress tracking and error handling
- [x] 9.1 Add progress tracking for batch exports
  - Implement job tracking system for long-running exports
  - Add progress polling mechanism
  - Store progress state in memory or cache
  - _Requirements: 4.1, 4.2_

- [x] 9.2 Implement comprehensive error handling
  - Add specific error messages for PDF/Excel generation failures
  - Handle network timeouts and retry logic
  - Implement graceful degradation for font/formatting issues
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 9.3 Add user feedback and notifications
  - Implement success notifications for completed exports
  - Add error notifications with actionable messages
  - Show progress notifications during batch operations
  - _Requirements: 4.4, 4.5, 10.5_

- [x] 9.4 Write property test for progress text format
  - **Property 8: Progress Text Format**
  - **Validates: Requirements 4.2**

- [x] 9.5 Write unit tests for progress and error handling
  - Test progress tracking and updates
  - Test error handling and user feedback
  - Test notification system integration
  - _Requirements: 4.1, 4.2, 10.1, 10.2_

- [-] 10. Final integration and testing
- [x] 10.1 Add complete i18n translations
  - Add all Persian translations for export functionality
  - Add English translations for bilingual support
  - Test RTL layout with translated content
  - _Requirements: 1.3, 10.5_

- [x] 10.2 Implement file naming convention
  - Add filename generation utility function
  - Apply naming pattern:
    schedule*{scope-prefix}{type}*{name}_{lang}_{date}.{ext}
  - Handle special characters and sanitization
  - _Requirements: 2.5, 8.4_

- [ ] 10.3 Add comprehensive error boundary
  - Implement error boundary for export components
  - Add fallback UI for export failures
  - Log errors for debugging and monitoring
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [ ] 10.4 Write integration tests for complete export flow
  - Test end-to-end export process for PDF and Excel
  - Test batch export with multiple schedules
  - Test error scenarios and recovery
  - _Requirements: 2.1, 3.1, 3.2_

- [ ] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
