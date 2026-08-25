# Graph Report - maktab  (2026-08-03)

## Corpus Check
- 889 files · ~510,836 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 7133 nodes · 18117 edges · 323 communities (292 shown, 31 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 699 edges (avg confidence: 0.64)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `213772a7`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Constraint Management
- Assignment Data Hooks
- Assignment Page UI
- Entity Editing Forms
- Shared UI Primitives
- Schedule Types Tests
- Schedule Transformation Storage
- Layout Licensing Generation
- Schedule Grid Cells
- Schedule State Store
- Schedule Constraint Validation
- Solver Results Dashboard
- Data Lists Utilities
- Assignment Shared Models
- Assignment Workflow Hooks
- Schedule Swap Grid
- Teacher Bulk Import
- Workload Conflict Services
- Schedule Dashboard
- Core School Models
- Schedule Drag Selection
- Settings Cards Controls
- Assignment Coverage Projections
- Assignment Error Conflicts
- Schedule Views Navigation
- Runtime Dependencies
- Solver Strategy Selection
- Schedule Swap State
- Assignment Requirement Validation
- Assignment Serialization Utilities
- Schedule Query Hooks
- Readiness Validation
- Solver Generation Status
- Teacher Subject Availability
- Period Defaults Matrix
- Teacher Forms Validation
- Curriculum Schedule Lists
- Teacher Page Data
- Unified Assignments Data
- Data Grids Dialogs
- Period Structure Schema
- Assignment Cache Management
- Class Categories Statistics
- Schedule View Routing
- Sidebar Readiness Tooltips
- Subject Page Data
- TypeScript Configuration
- School Settings API
- Shared Error Routing
- Period Break Configuration
- Teacher Compatibility Selection
- Keyboard Schedule Navigation
- Optimized Assignment Calculations
- Teacher API Serialization
- ESLint Configuration
- Application Bootstrap I18n
- Room Data Access
- Development Dependencies
- Search Selection Controls
- Teacher Subject Configuration
- Class Page Data
- School Settings Page
- Schedule Export Dialog
- Subject Filtering
- Shared Action Dialogs
- UI Components Configuration
- Class API Serialization
- Room Filtering
- Room CRUD Tests
- Schedule Export API
- Subject API Serialization
- Teacher Inspector Forms
- Room Type Settings
- Assignment Conflict Hook
- Generation Progress Hub
- Export Format Controls
- Room Serialization
- School Shift Configuration
- Subject Form Utilities
- Conflict Detection Engine
- Curriculum Population
- Room Data Grid
- Subject Data Grid
- Schedule Onboarding
- Schedule Display Settings
- Class Filtering
- Export Error Boundary
- Export Form Schema
- Subject Form Schema
- Rooms Page Layout
- Subject Section Translation
- Package Scripts
- Subject Color Generation
- Node TypeScript Config
- API Error Tests
- Class CRUD Tests
- Swap Indicator Tests
- Teacher Workload Hook
- Dashboard Route
- Display Settings Hook
- Export Progress Tests
- Package Metadata
- Constraint Weight Slider
- Display Settings Tests
- Unsaved Changes Tests
- Sidebar Navigation Tests
- Delete Dialog Tests
- Test Environment Setup
- Statistics Card Tests
- Index Route
- PostCSS Configuration
- Error Boundary Tests
- About Feature Exports
- Constraint UI Exports
- Guidance Feature Exports
- Logout Feature Exports
- Delete Dialog Unit Test
- Schedule Smoke Test
- Statistics Cards Unit Test
- Enhanced Generation Test
- Tailwind Configuration
- Vite Configuration
- Vitest Configuration
- useLicense.ts
- Security, Multi-Tenancy, RBAC, and Audit
- AuditService
- ExportService
- subjects.integration.test.js
- CurriculumProvider
- Maktab Web Frontend
- Finance, Fees, Billing, and Accounting
- FileCleanupService
- curriculum.py
- MinistryValidator
- HardConstraint
- ._make_label_key
- package.json
- usePlatformSessionStore
- 1784000000000-HardenPeriodConfiguration.ts
- assignment.routes.ts
- class.routes.ts
- index.ts
- room.routes.ts
- pdfGeneration.service.ts
- RamadanModeHandler
- ProgressReporter
- defaults.ts
- Academic Structure and Head-Teacher Administration
- Human Resources and Workforce Administration
- Identity, Accounts, and Access Control
- People, Students, Guardians, Admissions, and Enrollment
- CodeChunker
- build
- dependencies
- migrate-assignments.js
- LowResourceHandler
- Organizations, Contracts, and Entitlements
- Context Indexer Cheat Sheet
- LRUCache
- ConsecutiveConstraint
- Attendance, Biometrics, and Employee Timekeeping
- Messaging and Notifications
- Examinations, Grades, Results, and Question Bank
- Public Site and Authenticated Portals
- Timetable and Scheduling
- Non-Functional Requirements
- Maktab School Platform Documentation
- CodeEmbedder
- CodebaseIndex
- build-solver.js
- 1783900000000-RepairSchoolConfigFlow.ts
- WizardRepository
- Histogram
- __init__.py
- ExportErrorBoundaryClass
- Course Management
- Mobile Experience, Student Diary, and Feedback
- Payroll
- Glossary and Open Terminology
- ConstraintStage
- Files
- useSolverStatus.ts
- README.md
- Audit, Compliance, and Operational Oversight
- Inventory, Store, Library, Books, and Uniforms
- Reporting and Analytics
- Transport
- devDependencies
- __init__.py
- StrategySelector
- Counter
- package.json
- scripts
- dropdown-menu.tsx
- subjectColors.ts
- compilerOptions
- Discipline and Student Welfare
- main
- package.json
- download-fonts.js
- AppConfig
- DatabaseManagerTests
- SameDayConstraint
- DataGrid.tsx
- schoolConfigDto.schema.ts
- api.ts
- apiParsers.ts
- CodeChunk
- Gauge
- playwright.config.ts
- ErrorBoundaryClass
- package-electron.js
- 1730000000000-BaselineSchema.ts
- prometheus.py
- Timer
- dashboard.tsx
- main.tsx
- API and data boundaries
- swap-export.contract.test.js
- MetricValue
- Maktab repository guidance
- package.json
- Repository map
- Q: Review how the codebase is connected, focusing on packages/web and executable code rather than Markdown.
- Q: Implement the plan.
- Q: Have a deep code review of subjects feature and find out all bugs,inconsistency, wrong implementation, wrong code flow between ui-->backend-->database and more other layers. and their relation with other features. then build a report for me, over all to fix. FOR NOW DO NOT CHANGE CODE.
- Q: Have a deep code review of subjects feature and find out all bugs,inconsistency, wrong implementation, wrong code flow between ui-->backend-->database and more other layers. and their relation with other features. then build a report for me, over all to fix. FOR NOW DO NOT CHANGE CODE.
- Q: fix all the problems, that you have found. phase by phase. do the testing at the very end.
- Q: Have a deep code review focused on packages/web/src/features/teachers and report UI, API, backend, database, and integration bugs without fixing code
- Q: Implement the plan.
- Q: Deep end-to-end review of packages/web/src/features/assignments and packages/web/src/features/teacher-assignments across UI, API, backend, database, and solver integrations
- Q: Resolve the five assignment domain decisions from the Afghanistan school production description
- Q: Implement the assignment remediation plan from ASSIGNMENTS_FEATURE_CODE_REVIEW.md using the resolved Afghanistan school rules
- Q: Should the Maktab repository upgrade from TypeScript 5.9 to TypeScript 7.0, and how should its deprecated baseUrl option be handled?
- Q: Implement the plan.
- Q: Why does teacher bulk import return maxPeriodsPerWeek cannot exceed the school calendar (32)?
- Q: so then solve it please
- Q: Why do manually added subjects appear on the Subjects screen but not in teachers, classes, or assignments after applying the lesson plan?
- Q: Why do manually added subjects appear on the Subjects screen but not in teachers, classes, or assignments after applying the lesson plan?
- Q: so to fix the problem, lets delete the whole database data(they were just draft data to test) and fix the problems of api and synchronization problems.
- Q: Why does the app freeze after curriculum subject sync or teacher bulk import even though data is saved?
- Q: AssignmentDrawerV2 opened from ClassAssignmentRow does not show the teacher list; show all teachers
- Q: Why can Ahmad not be assigned subject 44 to two classes although the UI shows spare workload and he can teach it?
- Q: Implement the plan.
- Q: Here one UI UX problem, exists, in the the assignement drawer , the teachers list is not visible correctly. modify the design layout of this drawer to focus more on teachers list and assignening instead of just labels and stats..
- Q: When assigning teachers from subject, class, or assignment drawer, the API rejects teachers whose subject is not primary or allowed. What is the best UX and domain-policy fix?
- Q: Implement an atomic Add as Primary and assign flow for headteachers across subject, class, and assignment drawer, with workload and availability conflict rollback and no allowed behavior outside teacher editing.
- Q: Implement the prioritized teacher assignment opportunity view and confirmed override flow in TeacherEditDrawer subjects/classes tab.
- Q: Analyze whether the database and backend support grade-wide subject periods with rare class-specific exceptions, then plan the UI changes.
- Q: ok so implement the plan
- Q: Here, can you update all UI components that they show the periods of subjects-class??? because the UI is yet do not working  correctly. the subject-class periods must be changeable from this components also packages/web/src/features/teachers/components/SubjectAssignmentManager.tsx packages/web/src/features/classes/components/ClassEditDrawer.tsx  and other UI parts must render or must show the real changes of periods. what do you think of???
- Q: http://localhost:5173/classes-schedule http://localhost:5173/teachers-schedule when accessing to these from browser it dont works correctly???
- Q: Deep review and fix swaps, exports, and the Python solver; find bugs, wrong implementations, and improvements
- index_package
- Maktab database console
- timetable.persistence.test.js
- GradeCurriculumInfo
- Command
- generate-license.js
- conftest.py
- test_authentication.py
- test_tenant_context.py
- .observe
- preload.js
- api_exception_handler
- test_health_endpoints_are_public
- AGENTS.md
- react
- aliases.sh
- AGENTS.md
- AGENTS.md
- README.md
- 0001_initial.py
- 0002_initial.py
- 0001_initial.py
- 0001_initial.py
- 0001_initial.py
- .clear
- SCHOOL_SETTINGS_QUERY_KEY
- maktab-platform-api
- maktab-timetable-solver

## God Nodes (most connected - your core abstractions)
1. `cn()` - 320 edges
2. `RepositoryOptions` - 151 edges
3. `CacheManager` - 145 edges
4. `Button` - 94 edges
5. `ServiceResult` - 91 edges
6. `Badge` - 72 edges
7. `Logger` - 71 edges
8. `Subject` - 68 edges
9. `Teacher` - 65 edges
10. `getDataSourceScopedInstance()` - 59 edges

## Surprising Connections (you probably didn't know these)
- `ScheduleGrid()` --indirect_call--> `slotKey()`  [INFERRED]
  apps/web/src/features/schedule/components/grid/ScheduleGrid.tsx → services/local-api/src/services/generatedTimetableValidation.service.ts
- `useCellSelection()` --indirect_call--> `slotKey()`  [INFERRED]
  apps/web/src/features/schedule/hooks/useCellSelection.ts → services/local-api/src/services/generatedTimetableValidation.service.ts
- `useValidSwapTargets()` --indirect_call--> `slotKey()`  [INFERRED]
  apps/web/src/features/schedule/hooks/useValidSwapTargets.ts → services/local-api/src/services/generatedTimetableValidation.service.ts
- `auditAssignmentStorageConsistency()` --indirect_call--> `assignment()`  [INFERRED]
  services/local-api/src/services/assignmentConsistency.service.ts → apps/web/src/features/subjects/subjectContracts.test.ts
- `buildPhase2BackfillPlan()` --indirect_call--> `assignment()`  [INFERRED]
  services/local-api/src/services/assignmentPhase2Planner.ts → apps/web/src/features/subjects/subjectContracts.test.ts

## Import Cycles
- 1-file cycle: `services/platform-api/src/config/celery.py -> services/platform-api/src/config/celery.py`

## Communities (323 total, 31 thin omitted)

### Community 0 - "Constraint Management"
Cohesion: 0.03
Nodes (125): DashboardErrorStateProps, DashboardSkeleton(), DashboardSkeletonProps, GenerationHubSkeleton(), HistorySectionSkeleton(), ReadinessChecklistSkeleton(), ScheduleCardSkeleton(), StrategyCardSkeleton() (+117 more)

### Community 1 - "Assignment Data Hooks"
Cohesion: 0.02
Nodes (60): Column, AppDataSource, AddFixedRoomToClassGroup1730826000000, AddAfghanistanFieldsToSchoolConfig1734530000000, CreateTeacherClassSubjectAssignment1736300000000, AddBreakPeriodsByDayToSchoolConfig1737600000000, CreateCanonicalAssignmentTables1742400000000, addChecks() (+52 more)

### Community 2 - "Assignment Page UI"
Cohesion: 0.04
Nodes (101): AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay, AlertDialogTitle (+93 more)

### Community 3 - "Entity Editing Forms"
Cohesion: 0.04
Nodes (22): RepositoryOptions, ClassRepository, LicenseRepository, normalizeRoomFeatures(), normalizeRoomName(), parseUnavailable(), RoomRepository, UnavailableSlot (+14 more)

### Community 4 - "Shared UI Primitives"
Cohesion: 0.04
Nodes (75): DEFAULT_SCHOOL_CONFIG, normalizeBreakPeriods(), parseBreakPeriods(), parseBreakPeriodsByDay(), SchoolConfigRepository, SolverConfigInput, VALID_DAYS, BreakPeriodConfig (+67 more)

### Community 5 - "Schedule Types Tests"
Cohesion: 0.04
Nodes (93): Textarea, TextareaProps, AvailabilityMatrix(), calculateMaxPeriodsPerWeek(), getEffectivePeriodsPerDayMap(), getPeriodsForDay(), AvailabilityMatrix(), AvailabilityMatrixProps (+85 more)

### Community 6 - "Schedule Transformation Storage"
Cohesion: 0.04
Nodes (47): requirement(), ClassSubjectRequirementRepository, TeacherSubjectCapabilityRepository, ClassSubjectRequirement, Check, Entity, Index, PrimaryGeneratedColumn (+39 more)

### Community 7 - "Layout Licensing Generation"
Cohesion: 0.03
Nodes (67): Room, Check, Entity, Index, PrimaryGeneratedColumn, Timetable, Entity, PrimaryGeneratedColumn (+59 more)

### Community 8 - "Schedule Grid Cells"
Cohesion: 0.04
Nodes (79): TabBar(), LicenseBanner(), Avatar, AvatarFallback, AvatarImage, ButtonProps, buttonVariants, DirectionalText() (+71 more)

### Community 9 - "Schedule State Store"
Cohesion: 0.05
Nodes (58): AbstractUser, APIView, HttpRequest, Response, active_membership_for_request(), membership_capabilities(), AccountSerializer, CapabilitiesSerializer (+50 more)

### Community 10 - "Schedule Constraint Validation"
Cohesion: 0.05
Nodes (63): SidebarItemType, SidebarNavItem, SidebarSection, Progress, SelectContent, SelectItem, SelectLabel, SelectScrollDownButton (+55 more)

### Community 11 - "Solver Results Dashboard"
Cohesion: 0.05
Nodes (74): DEFAULT_ROOM_TYPES, getRoomTypeIcon(), ICON_MAP, localizeRoomType(), RoomTypeOption, RoomTypeWithIcon, withIcons(), roomsApi (+66 more)

### Community 12 - "Data Lists Utilities"
Cohesion: 0.03
Nodes (62): ClassGroup, IntervalVar, Core solver components.  This module contains the core components of the timetab, Any, CpModel, IntVar, T, TimetableData (+54 more)

### Community 13 - "Assignment Shared Models"
Cohesion: 0.06
Nodes (42): CACHE_PREFIXES, ERROR_CODES, HTTP_STATUS, LOG_LEVELS, AggregatedCacheStats, CacheManagerConfig, CacheEntry, CacheStats (+34 more)

### Community 14 - "Assignment Workflow Hooks"
Cohesion: 0.05
Nodes (66): Badge, BadgeProps, badgeVariants, AssignmentContextBar(), getInitials(), AssignmentStatusBadge(), AssignmentStatusBadgeProps, STATUS_CONFIG (+58 more)

### Community 15 - "Schedule Swap Grid"
Cohesion: 0.05
Nodes (78): ConflictResolution, useRealtimeConflicts(), UseRealtimeConflictsOptions, useRealtimeWorkload(), UseRealtimeWorkloadOptions, canTeacherTeachSubject(), getTeacherSubjectCompatibility(), CACHE_GC_TIMES (+70 more)

### Community 16 - "Teacher Bulk Import"
Cohesion: 0.05
Nodes (44): assignment(), TeacherClassSubjectAssignmentInput, TeachingAssignmentRepository, TeachingAssignment, Check, Entity, Index, PrimaryGeneratedColumn (+36 more)

### Community 17 - "Workload Conflict Services"
Cohesion: 0.05
Nodes (60): SettingsTogglesProps, DraggableCell, DraggableCellProps, DroppableCell, DroppableCellProps, isValidDropSource(), FocusIndicator, FocusIndicatorProps (+52 more)

### Community 18 - "Schedule Dashboard"
Cohesion: 0.07
Nodes (48): PageHeader(), PageHeaderProps, ErrorBoundaryState, Button, Card, CardContent, CardDescription, CardFooter (+40 more)

### Community 19 - "Core School Models"
Cohesion: 0.06
Nodes (48): AssignmentCellProps, AssignmentDrawerV2Props, ClassAssignmentRowProps, UseRealtimeConflictsResult, UseRealtimeWorkloadResult, UseUnifiedAssignmentResult, calculateTeacherCurrentWorkload(), createClassAlreadyAssignedWarning() (+40 more)

### Community 20 - "Schedule Drag Selection"
Cohesion: 0.05
Nodes (47): ConstraintViolation, LessonMove, Any, Validate the complete simulated swap while resources follow lessons., Validates lesson swaps and finds minimal disruption solutions., Initialize validator with constraint data., Validates a swap operation and finds minimal disruption solution., Check whether a teacher is available at a given day/period. (+39 more)

### Community 21 - "Settings Cards Controls"
Cohesion: 0.04
Nodes (51): Protocol, Redis, create_job(), Any, BaseModel, QueueStatistics, Create a successful result.                  Args:             job_id: Job ident, Create a failed result.                  Args:             job_id: Job identifie (+43 more)

### Community 22 - "Assignment Coverage Projections"
Cohesion: 0.05
Nodes (38): TimetableData, Return class or class-subject occupancy for a single solver slot., Refactored constraint satisfaction solver for school timetabling.      This clas, Initialize the solver with input data.          Args:             timetable_data, Normalize all Day values to canonical strings., Build availability matrix for teachers or rooms.          This method also respe, Build blocked slots matrix for classes.          This method blocks slots that a, Prepare all data mappings needed for solving. (+30 more)

### Community 23 - "Assignment Error Conflicts"
Cohesion: 0.06
Nodes (61): buildOptimisticAssignments(), subjectsApi, GradePeriodsDialog(), SubjectAssignmentSheetProps, SubjectCoverageCellProps, SubjectDataGridProps, SubjectEditDrawerProps, SubjectFilters() (+53 more)

### Community 24 - "Schedule Views Navigation"
Cohesion: 0.06
Nodes (53): flattenKeys(), assignmentsTranslations, classesTranslations, fetchPreferences(), optimizationPreferencesSchema, parsePreferencesProfile(), profileSchema, savePreferences() (+45 more)

### Community 25 - "Runtime Dependencies"
Cohesion: 0.33
Nodes (6): dependencies, better-sqlite3, electron-updater, @maktab/local-api, node-machine-id, rollup

### Community 26 - "Solver Strategy Selection"
Cohesion: 0.08
Nodes (19): ParsedRoom, RoomDataIntegrityError, RoomInput, ParsedSubject, SubjectInput, ParsedTimetable, TimetableInput, TimetableRevisionConflictError (+11 more)

### Community 27 - "Schedule Swap State"
Cohesion: 0.08
Nodes (30): ParsedTeacher, TeacherInput, TeacherRepository, Teacher, TeacherEmploymentType, Check, Entity, Index (+22 more)

### Community 28 - "Assignment Requirement Validation"
Cohesion: 0.06
Nodes (54): formatSlot(), getDayLabel(), SwapBlockedDialog(), SwapBlockedDialogProps, SwapWarningDialog(), SwapWarningDialogProps, CellContentToggles(), COLOR_CODING_OPTIONS (+46 more)

### Community 29 - "Assignment Serialization Utilities"
Cohesion: 0.07
Nodes (56): main(), main(), applyBackfillPlan(), colorize(), colors, getCanonicalSchemaStatus(), loadCanonicalSnapshot(), loadPlannerInput() (+48 more)

### Community 30 - "Schedule Query Hooks"
Cohesion: 0.07
Nodes (55): BulkOperationResult, BulkOperationStatus, AssignmentBatchAllocation, AssignmentBatchMutationInput, AssignmentPrimaryCapabilityGrant, buildClassPeriodMap(), buildOptimisticUnassignments(), getBatchErrorMessage() (+47 more)

### Community 31 - "Readiness Validation"
Cohesion: 0.07
Nodes (57): calculateRetryDelay(), DEFAULT_RETRY_CONFIG, ErrorState, INITIAL_ERROR_STATE, isRetryableError(), mapErrorToCode(), RetryConfig, sleep() (+49 more)

### Community 32 - "Solver Generation Status"
Cohesion: 0.08
Nodes (22): ClassInput, ParsedClass, SubjectRequirement, runCommittedTransaction(), ClassService, ClassWriteSplitResult, normalizeSubjectRequirementsInput(), splitClassWriteInput() (+14 more)

### Community 33 - "Teacher Subject Availability"
Cohesion: 0.09
Nodes (43): Alert, AlertDescription, AlertTitle, alertVariants, ExportDialog(), getDefaultValues(), EmptyScheduleState, useAutoSave() (+35 more)

### Community 34 - "Period Defaults Matrix"
Cohesion: 0.08
Nodes (46): classesApi, deserializeClass(), parseMetaJson(), serializeClassForApi(), BulkApplyCurriculumDialog(), BulkApplyCurriculumDialogProps, BulkClassDialog(), ClassDataGrid() (+38 more)

### Community 35 - "Teacher Forms Validation"
Cohesion: 0.10
Nodes (3): CacheManager, positiveEnvironmentInteger(), getDataSourceScopedInstance()

### Community 36 - "Curriculum Schedule Lists"
Cohesion: 0.06
Nodes (19): applyLessonMovesToPayload(), createSwapRoutes(), parseTimetableId(), parseTimetablePayload(), ConstraintViolation, constraintViolationSchema, LessonMove, lessonMoveSchema (+11 more)

### Community 37 - "Teacher Page Data"
Cohesion: 0.07
Nodes (39): SaveScheduleInput, scheduleApi, ScheduleApiResult, SCHEDULE_QUERY_KEYS, UseKeyboardShortcutsOptions, ScheduleRevisionConflictError, updateScheduleLessons(), UpdateScheduleLessonsInput (+31 more)

### Community 38 - "Unified Assignments Data"
Cohesion: 0.08
Nodes (23): AffectedEntity, isStructuredSolverResponse(), ObjectiveResult, parseSolverProgressUpdate(), PreSolveResult, QualityBreakdown, QualityScore, SolverError (+15 more)

### Community 39 - "Data Grids Dialogs"
Cohesion: 0.06
Nodes (29): can_teach(), enhance_solution_with_metadata(), is_room_compatible(), Any, IntVar, Check if a room is compatible with a subject and class., Count empty usable positions strictly between first and last occupancy., Apply all class/teacher/subject objectives exposed by the settings UI. (+21 more)

### Community 40 - "Period Structure Schema"
Cohesion: 0.06
Nodes (40): PlatformLoginView(), Route, Route, Route, Route, Route, Route, Route (+32 more)

### Community 41 - "Assignment Cache Management"
Cohesion: 0.06
Nodes (42): AssignmentBatchChange, AssignmentBatchResult, useClassAssignmentView(), useTeacherWorkloadView(), assignmentMatrixSchema, assignmentSchema, classAssignmentViewSchema, projectionRequirementSchema (+34 more)

### Community 42 - "Class Categories Statistics"
Cohesion: 0.08
Nodes (41): calculateWorkload(), ConflictDetectionOptions, ConflictDetectionResult, createCoverageConflict(), createDuplicateConflict(), createWorkloadConflict(), parseJsonArray(), NOTE: createIncompatibilityConflict removed - no longer used (+33 more)

### Community 43 - "Schedule View Routing"
Cohesion: 0.10
Nodes (40): useKeyboardNavigation(), UseKeyboardNavigationOptions, UseKeyboardNavigationReturn, RoomConstraintData, ScheduleIndexes, SubjectConstraintData, TeacherConstraintData, generateEntityColor() (+32 more)

### Community 44 - "Sidebar Readiness Tooltips"
Cohesion: 0.12
Nodes (36): Express, paginationMiddleware(), parsePositiveInt(), Request, formatZodErrors(), integerParamInRange(), parseIntegerInRange(), parsePositiveInteger() (+28 more)

### Community 45 - "Subject Page Data"
Cohesion: 0.05
Nodes (44): dependencies, autoprefixer, class-variance-authority, clsx, cmdk, @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities (+36 more)

### Community 46 - "TypeScript Configuration"
Cohesion: 0.08
Nodes (33): BoundLogger, ConfigLoader, Path, Apply environment variable overrides to configuration.                  Supporte, Save configuration to YAML file.                  Args:             config: Conf, Get default configuration without loading from file.                  Returns:, Find the first existing config file in search paths.                  Returns:, Loads solver configuration from YAML files and environment variables.          S (+25 more)

### Community 47 - "School Settings API"
Cohesion: 0.10
Nodes (35): getExpectedTotalPeriods(), getGradeCategory(), GRADE_CATEGORIES, GradeCategory, GradeCategoryInfo, GradeSubjects, MINISTRY_CURRICULUM, SubjectDefinition (+27 more)

### Community 48 - "Shared Error Routing"
Cohesion: 0.09
Nodes (36): Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow (+28 more)

### Community 49 - "Period Break Configuration"
Cohesion: 0.18
Nodes (17): ArgumentParser, Namespace, build_parser(), confirm(), DatabaseManager, heading(), interactive_menu(), main() (+9 more)

### Community 50 - "Teacher Compatibility Selection"
Cohesion: 0.11
Nodes (27): CpSolver, build_effective_break_periods_by_day(), build_period_configuration_metadata(), clamp_break_periods(), _day_to_string(), get_category_dari_name(), get_periods_for_class_day(), has_variable_breaks() (+19 more)

### Community 51 - "Keyboard Schedule Navigation"
Cohesion: 0.05
Nodes (38): 1. Setup Aliases (One-time), 2. Index the Codebase, 3. Query the Code, Advanced, Aliases not working, Architecture, Available Commands, Backend Development (+30 more)

### Community 52 - "Optimized Assignment Calculations"
Cohesion: 0.08
Nodes (30): PreSolveAnalyzer, PreSolveResult, BaseModel, SolverErrorDetail, TimetableData, Check if any teacher is over-assigned.          For each teacher, sums assigned, Result of pre-solve analysis.      Requirements: 3.1, 3.2, 3.3      Attributes:, Check if total room-periods are sufficient.          Calculates total required r (+22 more)

### Community 53 - "Teacher API Serialization"
Cohesion: 0.07
Nodes (24): MemoryError, MemoryManager, MemoryWarning, Any, Exception, T, Initialize the MemoryManager.                  Args:             max_memory_mb:, Get current memory usage in megabytes.                  Uses psutil if available (+16 more)

### Community 54 - "ESLint Configuration"
Cohesion: 0.12
Nodes (27): DialogContent, DialogDescription, DialogFooter(), DialogHeader(), DialogOverlay, DialogTitle, ScrollArea, SheetContent (+19 more)

### Community 55 - "Application Bootstrap I18n"
Cohesion: 0.12
Nodes (33): assignmentsApi, ensureSubjectRequirements(), getRequiredPeriods(), parseJsonArray(), SubjectAssignmentSummary, useClassAssignments(), useClassAssignmentsQuery(), teacherAssignmentsApi (+25 more)

### Community 56 - "Room Data Access"
Cohesion: 0.12
Nodes (13): ASSIGNMENT_QUERY_KEYS, AssignmentCacheManager, ensureSubjectRequirements(), parseJsonArray(), ClassCoverageDetail, CoverageStatus, SubjectCoverage, TeacherCompatibility (+5 more)

### Community 57 - "Development Dependencies"
Cohesion: 0.25
Nodes (8): devDependencies, concurrently, cross-env, dependency-cruiser, electron, electron-builder, madge, wait-on

### Community 58 - "Search Selection Controls"
Cohesion: 0.07
Nodes (21): BalancedStrategy, Any, SolverStrategy, Balanced search effort; the enabled objective set remains unchanged., ABC, Any, Base strategy interface for solver strategies., Initialize strategy.                  Args:             name: Strategy name (e.g (+13 more)

### Community 59 - "Teacher Subject Configuration"
Cohesion: 0.06
Nodes (29): migrateLegacy(), migrateStrength(), quantize(), SchoolScopedOptimizationPreferences1784700000000, handleSchoolConfigError(), breakPeriod, configurationValueSchema, GeneralSchoolConfigUpdateInput (+21 more)

### Community 60 - "Class Page Data"
Cohesion: 0.10
Nodes (24): ClassScheduleView, ScheduleRouteState(), TeacherScheduleView, parseScheduleSearch(), useScheduleRouteLoader(), UseScheduleRouteLoaderOptions, UseScheduleRouteLoaderReturn, mocks (+16 more)

### Community 61 - "School Settings Page"
Cohesion: 0.06
Nodes (33): Daily commands, Database work, Development users, First setup, Local development, Verification, 1. Architectural objective, 2. Context view (+25 more)

### Community 62 - "Schedule Export Dialog"
Cohesion: 0.11
Nodes (30): TeacherWithProjection, getCompatibilityLevel(), parseJsonArray(), summarizeAssignments(), mocks, useSmartTeacherSelection(), UseSmartTeacherSelectionOptions, UseSmartTeacherSelectionResult (+22 more)

### Community 63 - "Subject Filtering"
Cohesion: 0.12
Nodes (12): normalizeSubjectCode(), normalizeSubjectFeatureTags(), normalizeSubjectInput(), normalizeSubjectText(), SubjectIdentityConflictError, SubjectIdentityMatch, SubjectRepository, Subject (+4 more)

### Community 64 - "Shared Action Dialogs"
Cohesion: 0.09
Nodes (10): ContactRequest, Entity, PrimaryGeneratedColumn, License, Entity, Index, PrimaryGeneratedColumn, ConfigurationService (+2 more)

### Community 65 - "UI Components Configuration"
Cohesion: 0.10
Nodes (23): Consecutive period constraints for Afghanistan school rules.  This module implem, Register the consecutive constraint with the registry.          Args:         re, register_consecutive_constraint(), Register all no-overlap constraints with the registry.          Args:         re, register_no_overlap_constraints(), Same-day constraint for multi-period lessons.  This constraint ensures that mult, Register the same-day constraint with the registry.          Args:         regis, register_same_day_constraint() (+15 more)

### Community 66 - "Class API Serialization"
Cohesion: 0.13
Nodes (30): BreakPeriodConfig, DayOfWeek, Enum, str, Convert between old and new period formats for backward compatibility., Configuration for break periods., TimePreference, ClassMetadata (+22 more)

### Community 67 - "Room Filtering"
Cohesion: 0.07
Nodes (19): ConsecutiveOptimizer, Phase 3.5: Consecutive Lessons Optimization  Optimizes O(n²) pairwise checks to, Pre-process consecutive lesson constraints for efficiency.                  Args, Optimizes consecutive lesson constraint generation.          Instead of checking, Generate optimized gap prevention constraints.                  Args:, Group lessons by day efficiently.                  Args:             lessons: Li, Check if consecutive constraint is feasible before adding it.                  A, DomainFilter (+11 more)

### Community 68 - "Room CRUD Tests"
Cohesion: 0.14
Nodes (25): BreakConfiguration(), BreakEditorTarget, buildEvenlyDistributedBreaks(), getNextAvailableBreakPeriod(), calculateStats(), getFirstErrorMessage(), PeriodStats, PeriodStructurePage() (+17 more)

### Community 69 - "Schedule Export API"
Cohesion: 0.10
Nodes (30): { app }, crypto, fs, generateUuid(), getFallbackUuidPath(), getMachineId(), getMachineIdSync(), getOrCreateFallbackUuid() (+22 more)

### Community 70 - "Subject API Serialization"
Cohesion: 0.17
Nodes (28): DEFAULT_DAYS, LessonPickerState, ResolvedSwapStatus, ScheduleGrid(), SwapReviewStatus, SwapConfirmationDialog(), usePeriodsConfiguration(), useSwapExecution() (+20 more)

### Community 71 - "Teacher Inspector Forms"
Cohesion: 0.14
Nodes (28): response, SubjectMetadata, extractSolverFields(), getSerializedJsonFromCharacterMap(), mapBreakIntervalsByDay(), mapBreakPeriods(), mapBreakPeriodsByDay(), mapClassMetadata() (+20 more)

### Community 72 - "Room Type Settings"
Cohesion: 0.11
Nodes (24): fetchSchoolConfig(), updateSchoolSettings(), MinistryValidationCardProps, ValidationModeOption, AFGHAN_WEEK_DAYS, TimezoneValue, VALID_TIMEZONES, getMaxPeriodsPerDay() (+16 more)

### Community 73 - "Assignment Conflict Hook"
Cohesion: 0.07
Nodes (29): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+21 more)

### Community 74 - "Generation Progress Hub"
Cohesion: 0.15
Nodes (11): ObjectiveResult, QualityScore, ScheduledLesson, AffectedEntity, Any, TimetableData, QualityScorer, Measure exactly the soft objectives selected by the headteacher. (+3 more)

### Community 75 - "Export Format Controls"
Cohesion: 0.11
Nodes (18): Checkpoint, CheckpointManager, Any, Path, Initialize the checkpoint manager.                  Args:             checkpoint, Ensure the checkpoint directory exists., Get the file path for a checkpoint., Compute a hash of the input data for validation.                  This hash is u (+10 more)

### Community 76 - "Room Serialization"
Cohesion: 0.10
Nodes (26): addAllocation(), calculateClassOverallStatus(), calculateGradeGroupStats(), DEFAULT_FILTERS, enhanceRequirement(), filterClasses(), getGradeCategoryForGrade(), GRADE_CATEGORY_ORDER (+18 more)

### Community 78 - "Subject Form Utilities"
Cohesion: 0.11
Nodes (16): DecompositionSolver, Any, Analyze how much teachers are shared across classes.          Returns:, Choose the best decomposition strategy for this problem.          Returns:, Check if classes have grade level metadata., Check if grade levels are independent (don't share teachers).          Returns:, Orchestrates decomposition-based solving for large problems.      Decides whethe, Solve the timetabling problem, with or without decomposition.          Args: (+8 more)

### Community 79 - "Conflict Detection Engine"
Cohesion: 0.13
Nodes (24): argumentValue(), hasArgument(), main(), ApiProcessMessage, bootstrap(), corsOrigins, notifyParent(), shutdown() (+16 more)

### Community 80 - "Curriculum Population"
Cohesion: 0.14
Nodes (27): buildMetadataLookup(), dayMatches(), DEFAULT_DAYS_OF_WEEK, detectDayOffset(), detectPeriodOffset(), ExportLesson, ExportPeriodConfiguration, ExportTimetableData (+19 more)

### Community 81 - "Room Data Grid"
Cohesion: 0.14
Nodes (20): Command, CommandDialogProps, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator (+12 more)

### Community 82 - "Subject Data Grid"
Cohesion: 0.09
Nodes (21): DropdownMenuSeparator, CategoryAccordion, CategorySection, CategorySectionProps, ClassItem, ClassItemProps, ClassDropdownItem, ClassDropdownItemProps (+13 more)

### Community 83 - "Schedule Onboarding"
Cohesion: 0.11
Nodes (16): Hard constraints module.  Hard constraints are constraints that must always be s, NoClassOverlapConstraint, NoRoomOverlapConstraint, NoTeacherOverlapConstraint, Any, CpModel, No-overlap constraints for timetable scheduling.  These constraints ensure that, Check if this constraint should be applied. (+8 more)

### Community 84 - "Schedule Display Settings"
Cohesion: 0.13
Nodes (20): CheckpointCorruptError, CheckpointError, CheckpointNotFoundError, CheckpointValidationError, Exception, Base exception for checkpoint-related errors., Raised when a checkpoint file is not found., Raised when a checkpoint file is corrupted or invalid. (+12 more)

### Community 85 - "Class Filtering"
Cohesion: 0.08
Nodes (26): devDependencies, eslint, eslint-config-prettier, @eslint/js, eslint-plugin-react, eslint-plugin-react-hooks, globals, jsdom (+18 more)

### Community 86 - "Export Error Boundary"
Cohesion: 0.14
Nodes (19): deserializeTeacher(), teachersApi, TeacherResponse, apiLogger, componentLogger, LogContext, logger, LogLevel (+11 more)

### Community 87 - "Export Form Schema"
Cohesion: 0.13
Nodes (17): createApp(), DeviceTrial, Entity, Index, PrimaryGeneratedColumn, CombinedLicenseStatus, determineCombinedStatus(), generateGuardMiddleware() (+9 more)

### Community 88 - "Subject Form Schema"
Cohesion: 0.08
Nodes (25): scripts, assignments:phase1:sync-schema, assignments:phase2:backfill, assignments:phase2:backfill:dry, assignments:phase2:report, build, db, db:backup (+17 more)

### Community 89 - "Rooms Page Layout"
Cohesion: 0.08
Nodes (22): BaseLessonSchema, BreakPeriodConfigSchema, ClassGroupSchema, ConstraintViolationSchema, DayOfWeek, DayOfWeekSchema, FixedLessonSchema, GlobalConfigSchema (+14 more)

### Community 90 - "Subject Section Translation"
Cohesion: 0.12
Nodes (14): ClassClusterBuilder, Any, Builds class clusters based on shared teacher relationships.  Uses graph-based a, Find connected components using BFS.          Args:             graph: Adjacency, Count total requests in a cluster., Balance cluster sizes to optimize performance.          Strategy:         1. Spl, Builds clusters of classes that can be solved independently.      Uses teacher-c, Split a large cluster into smaller sub-clusters.          Uses simple partitioni (+6 more)

### Community 91 - "Package Scripts"
Cohesion: 0.07
Nodes (30): scripts, analyze:wizard, build, build:all, build:api, build:solver, build:web, check (+22 more)

### Community 92 - "Subject Color Generation"
Cohesion: 0.12
Nodes (23): build_error(), build_internal_error(), _extract_affected_entities(), _format_message(), AffectedEntity, Any, Exception, SolverErrorDetail (+15 more)

### Community 93 - "Node TypeScript Config"
Cohesion: 0.08
Nodes (23): Adding New Translations, Cell States (`cell.*`), Editing Actions (`editing.actions.*`), Editing Hints (`editing.hints.*`), Editing Keyboard (`editing.keyboard.*`), Editing Mode (`editing.mode.*`), Editing Status (`editing.status.*`), English (+15 more)

### Community 94 - "API Error Tests"
Cohesion: 0.15
Nodes (8): CurriculumConfigRepository, CurriculumConfig, CustomSubjectData, GradeCurriculumData, SubjectOverrideData, Entity, Index, PrimaryGeneratedColumn

### Community 95 - "Class CRUD Tests"
Cohesion: 0.15
Nodes (17): RadioGroup, RadioGroupItem, FormatSelector(), FormatSelectorProps, LanguageSelector(), LanguageSelectorProps, ScopeSelector(), ScopeSelectorProps (+9 more)

### Community 96 - "Swap Indicator Tests"
Cohesion: 0.22
Nodes (16): BreakConfigurationProps, CategoryPeriodsMatrix(), CategoryPeriodsMatrixProps, DynamicPeriodsConfig(), DynamicPeriodsConfigProps, GRADE_CATEGORIES, GradeCategoryKey, basePeriodValues (+8 more)

### Community 97 - "Teacher Workload Hook"
Cohesion: 0.17
Nodes (16): exportApi, ExportJobResponse, fetchAPI(), isExportJob(), ExportErrorType, parseErrorType(), request, useExportSchedule() (+8 more)

### Community 98 - "Dashboard Route"
Cohesion: 0.09
Nodes (21): 1. Strategy, 2. Phase sequence, 3. Cross-cutting work in every phase, 4. Feature implementation lifecycle, 5. Recommended work-item hierarchy, 6. Release gates by risk class, 7. Migration rules for the existing application, 8. Program risks (+13 more)

### Community 99 - "Display Settings Hook"
Cohesion: 0.10
Nodes (14): Constraint, ABC, Any, CpModel, Base constraint interface for modular constraint system., Initialize constraint.                  Args:             name: Human-readable n, Apply this constraint to the CP-SAT model.                  Args:             mo, Enable this constraint. (+6 more)

### Community 100 - "Export Progress Tests"
Cohesion: 0.13
Nodes (14): DecompositionStrategy, Enum, Main decomposition solver orchestrator.  Decides whether to use decomposition, c, Available decomposition strategies., Decomposition solver for large timetabling problems.  Breaks problems into small, Any, Merges solutions from multiple sub-problems into a unified timetable.  Verifies, Merges sub-problem solutions into a complete timetable.      Verifies:     - No (+6 more)

### Community 101 - "Package Metadata"
Cohesion: 0.18
Nodes (10): author, description, homepage, keywords, license, main, name, private (+2 more)

### Community 102 - "Constraint Weight Slider"
Cohesion: 0.15
Nodes (20): AssignmentSyncState, calculateClassStatus(), calculateSubjectStatus(), calculateTeacherStatus(), ClassGroupParsed, ClassGroupRaw, parseJsonArray(), StatusChangeEvent (+12 more)

### Community 103 - "Display Settings Tests"
Cohesion: 0.15
Nodes (16): browserRequest(), PLATFORM_API_BASE, platformClient, responseData(), chooseMembership(), loadSessionState(), PlatformSessionState, SessionStatus (+8 more)

### Community 104 - "Unsaved Changes Tests"
Cohesion: 0.19
Nodes (20): ApiError, buildErrorFromLastRun(), buildLastRunSignature(), buildSyntheticError(), buildTerminalStatus(), ERROR_MESSAGES, ERROR_SUGGESTIONS, generateScheduleApi() (+12 more)

### Community 105 - "Sidebar Navigation Tests"
Cohesion: 0.10
Nodes (20): 1. Translation Structure Created, 2. Translation Keys Implemented, 3. Integration with Main i18n, 4. Language Support, ✨ Benefits, Cell State Translations, ✅ Completed, Editing Mode Translations (+12 more)

### Community 106 - "Delete Dialog Tests"
Cohesion: 0.14
Nodes (15): DEFAULT_ROOM_TYPES, DefaultRoomTypeDefinition, SUPPORTED_ROOM_TYPE_ICONS, SupportedRoomTypeIcon, addForeignKeyIfMissing(), canonicalFeatureTags(), canonicalUnavailable(), HardenRoomContracts1784100000000 (+7 more)

### Community 107 - "Test Environment Setup"
Cohesion: 0.13
Nodes (19): arraySchema, BulkTeacherDeleteInput, bulkTeacherDeleteSchema, BulkTeacherImportInput, bulkTeacherImportSchema, classAssignmentsSchema, CreateTeacherInput, createTeacherSchema (+11 more)

### Community 108 - "Statistics Card Tests"
Cohesion: 0.10
Nodes (20): compilerOptions, allowSyntheticDefaultImports, declaration, declarationMap, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+12 more)

### Community 109 - "Index Route"
Cohesion: 0.21
Nodes (13): Header(), MainLayout(), Sidebar(), languages, LanguageSwitcher(), Toaster(), ToasterProps, useDirection() (+5 more)

### Community 110 - "PostCSS Configuration"
Cohesion: 0.10
Nodes (19): 10. Finance and accounting model, 11. Inventory, library, and sales model, 12. Communications model, 13. Audit model, 14. Shared modeling rules, 1. Purpose, 2. Ownership hierarchy, 3. Core identity model (+11 more)

### Community 111 - "Error Boundary Tests"
Cohesion: 0.10
Nodes (19): arrowParens, bracketSpacing, embeddedLanguageFormatting, endOfLine, htmlWhitespaceSensitivity, insertPragma, jsxBracketSameLine, jsxSingleQuote (+11 more)

### Community 113 - "Constraint UI Exports"
Cohesion: 0.13
Nodes (16): bulkDeleteSubjectsSchema, BulkSubjectUpsertInput, bulkSubjectUpsertSchema, clearCurriculumSubjectsSchema, CreateSubjectInput, createSubjectSchema, customCategoryEnum, insertGradeCurriculumSchema (+8 more)

### Community 115 - "Logout Feature Exports"
Cohesion: 0.11
Nodes (18): aliases, components, hooks, lib, ui, utils, iconLibrary, registries (+10 more)

### Community 116 - "Delete Dialog Unit Test"
Cohesion: 0.16
Nodes (16): updatePeriodStructure(), DURATION_LIMITS, useUpdatePeriodStructure(), breakPeriodSchema, breaksByDaySchema, categoryPeriodsMapSchema, gradeCategorySchema, periodCountSchema (+8 more)

### Community 117 - "Schedule Smoke Test"
Cohesion: 0.16
Nodes (8): ErrorBoundary, PlaceholderPage(), PlaceholderPageProps, Route, Route, Route, Route, Route

### Community 118 - "Statistics Cards Unit Test"
Cohesion: 0.11
Nodes (16): A4 print contract, Acceptance criteria, Biometric connector contract, Hardware and External Integrations, Implementation tracker, Objective, Open questions, Requirements (+8 more)

### Community 120 - "Tailwind Configuration"
Cohesion: 0.12
Nodes (12): apiRoot, assert, Database, { fork, spawn }, fs, os, path, resetEntry (+4 more)

### Community 121 - "Vite Configuration"
Cohesion: 0.12
Nodes (10): MetricsExporter, Increment the gauge.                  Args:             amount: Amount to increm, Exports solver metrics in Prometheus format.          This class provides method, Initialize metrics exporter., Get singleton instance of MetricsExporter., Reset singleton instance (for testing)., Record constraint application.                  Args:             constraint_typ, Record solution quality score.                  Args:             score: Quality (+2 more)

### Community 122 - "Vitest Configuration"
Cohesion: 0.12
Nodes (16): 1. Install Dependencies, 2. Add Fonts (Optional but Recommended), 3. Generate Route Tree, 4. Start Building Features, Building for Production, Development Workflow, Frontend Setup Instructions, Next Steps (+8 more)

### Community 123 - "useLicense.ts"
Cohesion: 0.18
Nodes (15): fetchLicenseStatus(), generateWebMachineId(), getMachineId(), LICENSE_QUERY_KEY, useCanGenerate(), useLicense(), useReadOnly(), BannerType (+7 more)

### Community 124 - "Security, Multi-Tenancy, RBAC, and Audit"
Cohesion: 0.12
Nodes (17): 10. Security release gate, 1. Security objective, 2. Trust boundaries, 3. Authentication, 4. Tenant resolution and isolation, 5. Effective access model, 6. Financial and payroll control, 7. Child, guardian, and employee privacy (+9 more)

### Community 125 - "AuditService"
Cohesion: 0.19
Nodes (4): AuditLog, Entity, PrimaryGeneratedColumn, AuditService

### Community 126 - "ExportService"
Cohesion: 0.27
Nodes (3): createExportRoutes(), ExportService, getJobTracker()

### Community 127 - "subjects.integration.test.js"
Cohesion: 0.12
Nodes (16): { AppDataSource }, assert, { CacheManager }, { ClassService }, {
  CurriculumConfigRepository,
}, {
  CurriculumMaterializationService,
}, fs, os (+8 more)

### Community 128 - "CurriculumProvider"
Cohesion: 0.17
Nodes (11): CurriculumProvider, get_curriculum_for_category(), Any, Get curriculum for all grades in a category., Provides curriculum data with support for school-specific customizations.      W, Initialize curriculum provider.          Args:             custom_curriculum: Op, Get subjects for a grade (custom or ministry default)., Get required periods for a subject. (+3 more)

### Community 129 - "Maktab Web Frontend"
Cohesion: 0.12
Nodes (15): API Integration, Available Scripts, Building, Code Style, Development, Environment Variables, Getting Started, Installation (+7 more)

### Community 130 - "Finance, Fees, Billing, and Accounting"
Cohesion: 0.12
Nodes (15): Acceptance criteria, Accounting invariants, Cashier close, Core entities, Correction, Finance, Fees, Billing, and Accounting, Functional requirements, Implementation tracker (+7 more)

### Community 131 - "FileCleanupService"
Cohesion: 0.15
Nodes (4): CleanupConfig, CleanupTask, FileCleanupService, TODO: Implement proper zip archive when needed

### Community 132 - "curriculum.py"
Cohesion: 0.18
Nodes (14): get_expected_periods(), get_grade_category(), get_ministry_subject_periods(), get_ministry_subjects(), GradeCategory, is_core_subject(), Enum, str (+6 more)

### Community 133 - "MinistryValidator"
Cohesion: 0.17
Nodes (11): MinistryValidator, Any, Enum, str, Initialize the Ministry validator.                  Args:             enabled: W, Validate curriculum against Ministry requirements.                  When Ministr, Find configured periods for a subject by name.                  Args:, Ministry validation enforcement mode.          - WARN: Return warnings without b (+3 more)

### Community 134 - "HardConstraint"
Cohesion: 0.15
Nodes (10): HardConstraint, Base class for hard constraints (must be satisfied)., ClassTeacherMinLessonConstraint, Any, CpModel, Check if this constraint should be applied., Register the class teacher constraint with the registry.          Args:, Ensures class teacher has at least one lesson per week for their class. (+2 more)

### Community 135 - "._make_label_key"
Cohesion: 0.15
Nodes (8): Set the gauge to a specific value.                  Args:             value: Val, Decrement the gauge.                  Args:             amount: Amount to decrem, Get current gauge value.                  Args:             **labels: Label valu, Get sum of all observations.                  Args:             **labels: Label, Get count of all observations.                  Args:             **labels: Labe, Get count for a specific bucket.                  Args:             bucket_le: B, Create a hashable key from labels., Create a hashable key from labels.

### Community 136 - "package.json"
Cohesion: 0.13
Nodes (14): author, dependencies, electron-squirrel-startup, node-machine-id, description, devDependencies, electron, keywords (+6 more)

### Community 137 - "usePlatformSessionStore"
Cohesion: 0.17
Nodes (9): PlatformOverview(), PlatformSessionBootstrap(), ModuleDelivery, PlatformModuleDefinition, platformModules, usePlatformSessionStore, LogoutPage(), Route (+1 more)

### Community 138 - "1784000000000-HardenPeriodConfiguration.ts"
Cohesion: 0.26
Nodes (12): DAYS, DEFAULT_DAYS, HardenPeriodConfiguration1784000000000, MINISTRY_VALIDATION_MODES, normalizeBreaks(), normalizeDays(), normalizePeriodMap(), normalizePrayerBreaks() (+4 more)

### Community 139 - "assignment.routes.ts"
Cohesion: 0.18
Nodes (13): assignmentAllocationSchema, assignmentBatchChangeSchema, AssignmentBatchInput, assignmentBatchSchema, assignmentPrimaryCapabilityGrantSchema, AssignTeacherInput, assignTeacherSchema, classPeriodOverrideSchema (+5 more)

### Community 140 - "class.routes.ts"
Cohesion: 0.18
Nodes (13): NOTE: Must be defined before /:id routes to avoid matching as an ID, NOTE: Must be defined before /:id routes to avoid matching 'bulk' as an ID, bulkApplyCurriculumSchema, bulkCreateClassSchema, CreateClassInput, createClassSchema, metadataSchema, sectionEnum (+5 more)

### Community 141 - "index.ts"
Cohesion: 0.21
Nodes (10): handleAnalyze(), handleCancelGenerate(), handleGetStatus(), handleTest(), createGenerateRoutes(), analyzeRequestSchema, generateRequestSchema, generationConfigSchema (+2 more)

### Community 142 - "room.routes.ts"
Cohesion: 0.17
Nodes (13): NOTE: This route MUST be defined BEFORE /:id routes, bulkCreateRoomSchema, bulkDeleteRoomSchema, CreateRoomInput, createRoomSchema, featureArray, jsonArray, jsonRecord (+5 more)

### Community 143 - "pdfGeneration.service.ts"
Cohesion: 0.18
Nodes (12): DisplaySettings, ExcelGenerationOptions, ScheduleData, getBreakIntervals(), getDaysOfWeek(), getMaxPeriods(), getPeriodTimeRange(), AnalysisSummary (+4 more)

### Community 144 - "RamadanModeHandler"
Cohesion: 0.17
Nodes (10): Any, BaseModel, RamadanConfig, RamadanModeHandler, Return metadata about Ramadan mode for inclusion in solver response., Create a RamadanModeHandler from solver configuration dictionary., Configuration for Ramadan mode scheduling adjustments.          Attributes:, Handler for applying Ramadan mode settings to solver input.          This handle (+2 more)

### Community 145 - "ProgressReporter"
Cohesion: 0.17
Nodes (10): ProgressReporter, Enum, str, Report progress for a stage.          Calculates overall percentage from stage r, Report intermediate progress within the current stage.          Only emits an up, Stages of the timetable solving process.      Each stage represents a distinct p, Reports progress updates during timetable solving.      Emits JSON-formatted pro, Initialize the progress reporter.          Sets up timing information for progre (+2 more)

### Community 146 - "defaults.ts"
Cohesion: 0.18
Nodes (12): PrayerBreaksConfig(), PrayerBreaksConfigProps, ALL_GRADES, BREAK_DURATION_LIMITS, BREAK_PRESETS, BreakPresetKey, DEFAULT_BREAK_CONFIG, DEFAULT_PRAYER_BREAK (+4 more)

### Community 147 - "Academic Structure and Head-Teacher Administration"
Cohesion: 0.14
Nodes (13): Academic Structure and Head-Teacher Administration, Academic year setup, Acceptance criteria, Core entities, Head-teacher oversight, Implementation tracker, Invariants, Main workflows (+5 more)

### Community 148 - "Human Resources and Workforce Administration"
Cohesion: 0.14
Nodes (13): Acceptance criteria, Core entities, Human Resources and Workforce Administration, Implementation tracker, Invariants and controls, Main workflows, Objective, Onboarding (+5 more)

### Community 149 - "Identity, Accounts, and Access Control"
Cohesion: 0.14
Nodes (13): Acceptance criteria, Account issuance, Core entities, Identity, Accounts, and Access Control, Implementation tracker, Initial role templates, Main workflows, Objective (+5 more)

### Community 150 - "People, Students, Guardians, Admissions, and Enrollment"
Cohesion: 0.14
Nodes (13): Acceptance criteria, Admission and enrollment, Core entities, Duplicate resolution, Implementation tracker, Invariants, Main workflows, Objective (+5 more)

### Community 151 - "CodeChunker"
Cohesion: 0.20
Nodes (8): CodeChunker, Path, Detect the type of code based on path., Extract the main export name from content., Split content by code structure (functions, components, etc.)., Fallback: chunk by line count., Chunks TypeScript/React code intelligently., Chunk a single file into semantic pieces.

### Community 152 - "build"
Cohesion: 0.14
Nodes (14): build, appId, asarUnpack, directories, extraResources, files, nsis, productName (+6 more)

### Community 153 - "dependencies"
Cohesion: 0.14
Nodes (14): dependencies, axios, better-sqlite3, cors, exceljs, express, playwright, reflect-metadata (+6 more)

### Community 154 - "migrate-assignments.js"
Cohesion: 0.22
Nodes (13): args, colors, Database, dbPath, dryRun, fs, log(), migrateAssignments() (+5 more)

### Community 155 - "LowResourceHandler"
Cohesion: 0.18
Nodes (8): LowResourceHandler, Any, Create a LowResourceHandler from solver configuration dictionary., Get the solver parameters that would be applied in low-resource mode., Handler for configuring the solver for low-resource environments.          This, Initialize the low-resource mode handler.                  Args:             ena, Configure solver parameters for low-resource mode.                  When low-res, Return metadata about low-resource mode for inclusion in solver response.

### Community 156 - "Organizations, Contracts, and Entitlements"
Cohesion: 0.15
Nodes (12): Acceptance criteria, Change a contract, Core entities, Dependencies and open questions, Implementation tracker, Invariants and controls, Main workflows, Objective (+4 more)

### Community 157 - "Context Indexer Cheat Sheet"
Cohesion: 0.15
Nodes (12): Advanced Options, Common Commands, Context Indexer Cheat Sheet, Index Stats, Indexing, Quick Searches, Real-World Examples, Search by Package (+4 more)

### Community 159 - "ConsecutiveConstraint"
Cohesion: 0.22
Nodes (8): ConsecutiveConstraint, Any, CpModel, Apply constraints for lessons of a subject on a specific day.                  A, Apply adjacency constraints when consecutive periods are enabled., Enforces consecutive period rules for subjects.          Afghanistan School Rule, Check if this constraint should be applied., Apply consecutive period constraints.                  Args:             model:

### Community 160 - "Attendance, Biometrics, and Employee Timekeeping"
Cohesion: 0.17
Nodes (11): Acceptance criteria, Attendance, Biometrics, and Employee Timekeeping, Core entities, Employee timekeeping pipeline, Implementation tracker, Invariants and controls, Objective, Open questions (+3 more)

### Community 161 - "Messaging and Notifications"
Cohesion: 0.17
Nodes (11): Acceptance criteria, Class announcement, Core entities, Implementation tracker, Invariants and controls, Main workflows, Messaging and Notifications, Objective (+3 more)

### Community 162 - "Examinations, Grades, Results, and Question Bank"
Cohesion: 0.17
Nodes (11): Acceptance criteria, Core entities, Exam cycle, Examinations, Grades, Results, and Question Bank, Implementation tracker, Invariants, Main workflows, Objective (+3 more)

### Community 163 - "Public Site and Authenticated Portals"
Cohesion: 0.17
Nodes (11): Acceptance criteria, Experiences, Guardian, Implementation tracker, Objective, Open questions, Public, Public Site and Authenticated Portals (+3 more)

### Community 164 - "Timetable and Scheduling"
Cohesion: 0.17
Nodes (11): Acceptance criteria, Core entities/artifacts, Dependencies and open questions, Existing capability to preserve, Implementation tracker, Invariants, Objective, Offline synchronization contract (+3 more)

### Community 165 - "Non-Functional Requirements"
Cohesion: 0.17
Nodes (12): 10. Maintainability and delivery quality, 11. Definition of production-ready, 1. Capacity assumptions, 2. Availability and reliability, 3. Performance targets, 4. Scalability, 5. Recovery and continuity, 6. Security and privacy (+4 more)

### Community 166 - "Maktab School Platform Documentation"
Cohesion: 0.17
Nodes (12): 1. Purpose, 2. Product position, 3. Documentation map, 4. Requirement and status conventions, 5. Governing design principles, 6. Scope boundaries, 7. Change governance, Canonical design (+4 more)

### Community 167 - "CodeEmbedder"
Cohesion: 0.18
Nodes (7): CodeEmbedder, Code embeddings using CodeBERT via sentence-transformers., Generate embeddings for code chunks., Initialize the embedder.          Args:             model_name: HuggingFace mode, Generate embeddings for a list of texts.          Args:             texts: List, Get the embedding dimension., ndarray

### Community 168 - "CodebaseIndex"
Cohesion: 0.21
Nodes (7): CodebaseIndex, Path, Query the index for relevant code chunks.          Args:             query_text:, Find all indexable files in directory., Get index statistics., Index and query a codebase using semantic embeddings., Index all code files in a directory.          Args:             directory: Path

### Community 169 - "build-solver.js"
Cohesion: 0.17
Nodes (11): artifact, distPath, entrypoint, fs, path, result, root, solverRoot (+3 more)

### Community 170 - "1783900000000-RepairSchoolConfigFlow.ts"
Cohesion: 0.35
Nodes (9): DEFAULT_DAYS, normalizeAvailability(), normalizeDay(), normalizeDays(), normalizedJson(), normalizeUnavailable(), parseStructured(), RepairSchoolConfigFlow1783900000000 (+1 more)

### Community 172 - "Histogram"
Cohesion: 0.18
Nodes (7): Histogram, A histogram metric for tracking distributions.          Histograms track the dis, Initialize histogram.                  Args:             name: Metric name (e.g., Collect all metric values including buckets., Reset histogram (mainly for testing)., Get metrics in Prometheus text exposition format.                  Returns:, Reset all metrics (mainly for testing).

### Community 173 - "__init__.py"
Cohesion: 0.23
Nodes (8): Validate period configuration consistency.          Checks that:     - periodsPe, validate_period_configuration(), Validate that all subject references in class requirements exist.          Check, Validate custom subjects are properly configured.          Checks that:     - Cu, validate_custom_subjects(), validate_subject_references(), Validate teacher availability matches period configuration.          Checks that, validate_teacher_availability_structure()

### Community 174 - "ExportErrorBoundaryClass"
Cohesion: 0.24
Nodes (4): categorizeError(), ExportErrorBoundaryClass, ExportErrorBoundaryProps, logExportError()

### Community 175 - "Course Management"
Cohesion: 0.18
Nodes (10): Acceptance criteria, Core entities, Course Management, Implementation tracker, Invariants, Main workflows, Objective, Open questions (+2 more)

### Community 176 - "Mobile Experience, Student Diary, and Feedback"
Cohesion: 0.18
Nodes (10): Acceptance criteria, Core entities, Implementation tracker, Mobile Experience, Student Diary, and Feedback, Objective, Open questions, Product boundary, Requirements (+2 more)

### Community 177 - "Payroll"
Cohesion: 0.18
Nodes (10): Acceptance criteria, Core entities, Implementation tracker, Invariants and controls, Objective, Open questions, Payroll, Payroll lifecycle (+2 more)

### Community 178 - "Glossary and Open Terminology"
Cohesion: 0.18
Nodes (10): 1. Platform terms, 2. School roles collected so far, 3. Terms awaiting domain samples, 4. Other terminology to confirm, 5. Terminology governance, Glossary and Open Terminology, سه پارچه — TBD, سویه — TBD (+2 more)

### Community 179 - "ConstraintStage"
Cohesion: 0.18
Nodes (8): IntEnum, ConstraintStage, Any, CpModel, Apply all registered constraints for a given stage.                  Args:, Stages for constraint application.          Constraints are applied in order of, Get registered constraints, optionally filtered by stage.                  Args:, Register a constraint for automatic application.                  Args:

### Community 180 - "Files"
Cohesion: 0.18
Nodes (10): Benefits, Files, Generate Routes Module, `handlers.ts`, `index.ts`, Structure, `transformation.ts`, `types.ts` (+2 more)

### Community 181 - "useSolverStatus.ts"
Cohesion: 0.38
Nodes (9): cancelSolverGeneration(), fetchSolverStatus(), isRecord(), normalizeLastRun(), normalizePhase(), normalizeSolverStatus(), useSolverStatus(), SolverGenerationPhase (+1 more)

### Community 182 - "README.md"
Cohesion: 0.22
Nodes (6): 1. Decision states, 2. Confirmed decisions, 3. Provisional decisions, 4. Open decisions, 5. Decision review triggers, Product and Architecture Decisions

### Community 183 - "Audit, Compliance, and Operational Oversight"
Cohesion: 0.20
Nodes (9): Acceptance criteria, Audit, Compliance, and Operational Oversight, Core entities, Event categories, Implementation tracker, Invariants and controls, Objective, Open questions (+1 more)

### Community 184 - "Inventory, Store, Library, Books, and Uniforms"
Cohesion: 0.20
Nodes (9): Acceptance criteria, Core entities, Implementation tracker, Invariants and controls, Inventory, Store, Library, Books, and Uniforms, Main workflows, Objective, Open questions (+1 more)

### Community 185 - "Reporting and Analytics"
Cohesion: 0.20
Nodes (9): Acceptance criteria, Architecture, Core entities, Implementation tracker, Objective, Open questions, Report definition template, Reporting and Analytics (+1 more)

### Community 186 - "Transport"
Cohesion: 0.20
Nodes (9): Acceptance criteria, Core entities, Implementation tracker, Invariants and safety, Objective, Open questions, Reports, Requirements (+1 more)

### Community 187 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, concurrently, nodemon, ts-node, @types/better-sqlite3, @types/cors, @types/express, @types/node (+2 more)

### Community 188 - "__init__.py"
Cohesion: 0.27
Nodes (8): apply_defaults(), Any, Validate configuration has required fields with valid values.          Args:, Apply default values to missing configuration fields.          This function fil, validate_config(), MinistryValidationResult, BaseModel, Result of Ministry curriculum validation.          Attributes:         is_compli

### Community 189 - "StrategySelector"
Cohesion: 0.22
Nodes (7): Any, TimetableData, Selects the optimal solver strategy based on problem size.          Strategy sel, Initialize the strategy selector with timetable data.                  Args:, Count total lessons to schedule across all classes.                  Returns:, Select strategy and return metadata.                  Args:             user_str, StrategySelector

### Community 190 - "Counter"
Cohesion: 0.20
Nodes (6): Counter, A counter metric that only increases.          Counters track cumulative values, Initialize counter.                  Args:             name: Metric name (e.g.,, Increment the counter.                  Args:             amount: Amount to incr, Get current counter value.                  Args:             **labels: Label va, Reset counter to zero (mainly for testing).

### Community 191 - "package.json"
Cohesion: 0.20
Nodes (9): author, description, keywords, license, main, name, scripts, build (+1 more)

### Community 192 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, dev, lint, preview, test, test:e2e, test:unit (+1 more)

### Community 193 - "dropdown-menu.tsx"
Cohesion: 0.22
Nodes (8): DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioItem, DropdownMenuShortcut(), DropdownMenuSubContent, DropdownMenuSubTrigger

### Community 194 - "subjectColors.ts"
Cohesion: 0.31
Nodes (8): AUTO_COLOR_BASE, deriveColors(), getSubjectBaseColor(), getSubjectColors(), hashString(), HSL, SUBJECT_BASE_COLORS, SubjectColors

### Community 195 - "compilerOptions"
Cohesion: 0.22
Nodes (8): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, strict, include

### Community 196 - "Discipline and Student Welfare"
Cohesion: 0.22
Nodes (8): Acceptance criteria, Core entities, Discipline and Student Welfare, Implementation tracker, Invariants and safeguards, Objective, Open questions, Requirements

### Community 197 - "main"
Cohesion: 0.31
Nodes (8): format_as_markdown(), format_for_llm(), format_for_steering(), main(), Query the codebase for relevant context., Format results as markdown for pasting into chat., Format results as a steering-compatible context block., Format results optimized for LLM consumption - compact, structured, token-effici

### Community 198 - "package.json"
Cohesion: 0.22
Nodes (8): author, description, keywords, license, main, name, type, version

### Community 199 - "download-fonts.js"
Cohesion: 0.25
Nodes (7): extractFont(), FONTS_DIR, fs, https, main(), path, TEMP_ZIP

### Community 200 - "AppConfig"
Cohesion: 0.22
Nodes (5): AppConfig, AuditConfig, EntitlementsConfig, IdentityConfig, TenancyConfig

### Community 202 - "SameDayConstraint"
Cohesion: 0.25
Nodes (6): Any, CpModel, Ensures multi-period lessons don't span multiple days.          When a lesson re, Add same-day constraints for multi-period lessons.                  Args:, Check if this constraint should be applied.                  Only applies if the, SameDayConstraint

### Community 203 - "DataGrid.tsx"
Cohesion: 0.29
Nodes (5): DataGrid(), DataGridProps, DataGridRow, EditableCell(), MOCK_CLASSES

### Community 204 - "schoolConfigDto.schema.ts"
Cohesion: 0.25
Nodes (7): breakPeriod, category, periodCount, periodMap, prayerBreak, schoolConfigDtoSchema, weekDay

### Community 205 - "api.ts"
Cohesion: 0.39
Nodes (6): ApiError, ApiErrorPayload, extractApiErrorMessage(), fetchAPI(), formatValidationDetails(), getMachineId()

### Community 206 - "apiParsers.ts"
Cohesion: 0.36
Nodes (6): ClassAssignment, parseClassAssignments(), parseJsonArray(), parseNumberArray(), parseSubjectRequirements(), SubjectRequirement

### Community 207 - "CodeChunk"
Cohesion: 0.29
Nodes (4): CodeChunk, Smart code chunking for the Maktab web package. Chunks by: React components, hoo, A chunk of code with metadata., Main indexing logic - combines chunking, embedding, and ChromaDB storage.

### Community 208 - "Gauge"
Cohesion: 0.25
Nodes (5): Gauge, A gauge metric that can go up and down.          Gauges track values that can in, Initialize gauge.                  Args:             name: Metric name (e.g., 's, Create a hashable key from labels., Reset gauge to zero (mainly for testing).

### Community 211 - "package-electron.js"
Cohesion: 0.29
Nodes (6): electronBuilderCli, fs, nativeModulePath, path, projectRoot, { spawnSync }

### Community 212 - "1730000000000-BaselineSchema.ts"
Cohesion: 0.29
Nodes (4): BaselineSchema1730000000000, indexes, TableDefinition, tables

### Community 213 - "prometheus.py"
Cohesion: 0.33
Nodes (5): Metrics export module for solver monitoring., MetricType, Enum, Prometheus metrics export for solver monitoring.  This module provides metrics c, Types of metrics supported.

### Community 214 - "Timer"
Cohesion: 0.29
Nodes (3): Context manager for timing operations.          Usage:         with Timer() as t, Get elapsed time in seconds., Timer

### Community 216 - "main.tsx"
Cohesion: 0.33
Nodes (5): Register, root, router, @tanstack/react-router, routeTree

### Community 217 - "API and data boundaries"
Cohesion: 0.33
Nodes (5): API and data boundaries, Authentication, Local API, Platform API, Tenant context contract

### Community 218 - "swap-export.contract.test.js"
Cohesion: 0.33
Nodes (5): { applyLessonMovesToPayload }, assert, displaySettings, { exportRequestSchema }, test

### Community 219 - "MetricValue"
Cohesion: 0.33
Nodes (4): MetricValue, Collect all metric values., Represents a metric value with optional labels., Collect all metric values.

### Community 220 - "Maktab repository guidance"
Cohesion: 0.40
Nodes (4): Architecture boundaries, Change discipline, Maktab repository guidance, Verification

### Community 221 - "package.json"
Cohesion: 0.40
Nodes (4): description, name, type, version

### Community 222 - "Repository map"
Cohesion: 0.40
Nodes (4): Django domains currently established, Python layout, Repository map, Runtime components

### Community 223 - "Q: Review how the codebase is connected, focusing on packages/web and executable code rather than Markdown."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Review how the codebase is connected, focusing on packages/web and executable code rather than Markdown., Source Nodes

### Community 224 - "Q: Implement the plan."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Implement the plan., Source Nodes

### Community 225 - "Q: Have a deep code review of subjects feature and find out all bugs,inconsistency, wrong implementation, wrong code flow between ui-->backend-->database and more other layers. and their relation with other features. then build a report for me, over all to fix. FOR NOW DO NOT CHANGE CODE."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Have a deep code review of subjects feature and find out all bugs,inconsistency, wrong implementation, wrong code flow between ui-->backend-->database and more other layers. and their relation with other features. then build a report for me, over all to fix. FOR NOW DO NOT CHANGE CODE., Source Nodes

### Community 226 - "Q: Have a deep code review of subjects feature and find out all bugs,inconsistency, wrong implementation, wrong code flow between ui-->backend-->database and more other layers. and their relation with other features. then build a report for me, over all to fix. FOR NOW DO NOT CHANGE CODE."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Have a deep code review of subjects feature and find out all bugs,inconsistency, wrong implementation, wrong code flow between ui-->backend-->database and more other layers. and their relation with other features. then build a report for me, over all to fix. FOR NOW DO NOT CHANGE CODE., Source Nodes

### Community 227 - "Q: fix all the problems, that you have found. phase by phase. do the testing at the very end."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: fix all the problems, that you have found. phase by phase. do the testing at the very end., Source Nodes

### Community 228 - "Q: Have a deep code review focused on packages/web/src/features/teachers and report UI, API, backend, database, and integration bugs without fixing code"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Have a deep code review focused on packages/web/src/features/teachers and report UI, API, backend, database, and integration bugs without fixing code, Source Nodes

### Community 229 - "Q: Implement the plan."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Implement the plan., Source Nodes

### Community 230 - "Q: Deep end-to-end review of packages/web/src/features/assignments and packages/web/src/features/teacher-assignments across UI, API, backend, database, and solver integrations"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Deep end-to-end review of packages/web/src/features/assignments and packages/web/src/features/teacher-assignments across UI, API, backend, database, and solver integrations, Source Nodes

### Community 231 - "Q: Resolve the five assignment domain decisions from the Afghanistan school production description"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Resolve the five assignment domain decisions from the Afghanistan school production description, Source Nodes

### Community 232 - "Q: Implement the assignment remediation plan from ASSIGNMENTS_FEATURE_CODE_REVIEW.md using the resolved Afghanistan school rules"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Implement the assignment remediation plan from ASSIGNMENTS_FEATURE_CODE_REVIEW.md using the resolved Afghanistan school rules, Source Nodes

### Community 233 - "Q: Should the Maktab repository upgrade from TypeScript 5.9 to TypeScript 7.0, and how should its deprecated baseUrl option be handled?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Should the Maktab repository upgrade from TypeScript 5.9 to TypeScript 7.0, and how should its deprecated baseUrl option be handled?, Source Nodes

### Community 234 - "Q: Implement the plan."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Implement the plan., Source Nodes

### Community 235 - "Q: Why does teacher bulk import return maxPeriodsPerWeek cannot exceed the school calendar (32)?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Why does teacher bulk import return maxPeriodsPerWeek cannot exceed the school calendar (32)?, Source Nodes

### Community 236 - "Q: so then solve it please"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: so then solve it please, Source Nodes

### Community 237 - "Q: Why do manually added subjects appear on the Subjects screen but not in teachers, classes, or assignments after applying the lesson plan?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Why do manually added subjects appear on the Subjects screen but not in teachers, classes, or assignments after applying the lesson plan?, Source Nodes

### Community 238 - "Q: Why do manually added subjects appear on the Subjects screen but not in teachers, classes, or assignments after applying the lesson plan?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Why do manually added subjects appear on the Subjects screen but not in teachers, classes, or assignments after applying the lesson plan?, Source Nodes

### Community 239 - "Q: so to fix the problem, lets delete the whole database data(they were just draft data to test) and fix the problems of api and synchronization problems."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: so to fix the problem, lets delete the whole database data(they were just draft data to test) and fix the problems of api and synchronization problems., Source Nodes

### Community 240 - "Q: Why does the app freeze after curriculum subject sync or teacher bulk import even though data is saved?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Why does the app freeze after curriculum subject sync or teacher bulk import even though data is saved?, Source Nodes

### Community 241 - "Q: AssignmentDrawerV2 opened from ClassAssignmentRow does not show the teacher list; show all teachers"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: AssignmentDrawerV2 opened from ClassAssignmentRow does not show the teacher list; show all teachers, Source Nodes

### Community 242 - "Q: Why can Ahmad not be assigned subject 44 to two classes although the UI shows spare workload and he can teach it?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Why can Ahmad not be assigned subject 44 to two classes although the UI shows spare workload and he can teach it?, Source Nodes

### Community 243 - "Q: Implement the plan."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Implement the plan., Source Nodes

### Community 244 - "Q: Here one UI UX problem, exists, in the the assignement drawer , the teachers list is not visible correctly. modify the design layout of this drawer to focus more on teachers list and assignening instead of just labels and stats.."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Here one UI UX problem, exists, in the the assignement drawer , the teachers list is not visible correctly. modify the design layout of this drawer to focus more on teachers list and assignening instead of just labels and stats.., Source Nodes

### Community 245 - "Q: When assigning teachers from subject, class, or assignment drawer, the API rejects teachers whose subject is not primary or allowed. What is the best UX and domain-policy fix?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: When assigning teachers from subject, class, or assignment drawer, the API rejects teachers whose subject is not primary or allowed. What is the best UX and domain-policy fix?, Source Nodes

### Community 246 - "Q: Implement an atomic Add as Primary and assign flow for headteachers across subject, class, and assignment drawer, with workload and availability conflict rollback and no allowed behavior outside teacher editing."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Implement an atomic Add as Primary and assign flow for headteachers across subject, class, and assignment drawer, with workload and availability conflict rollback and no allowed behavior outside teacher editing., Source Nodes

### Community 247 - "Q: Implement the prioritized teacher assignment opportunity view and confirmed override flow in TeacherEditDrawer subjects/classes tab."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Implement the prioritized teacher assignment opportunity view and confirmed override flow in TeacherEditDrawer subjects/classes tab., Source Nodes

### Community 248 - "Q: Analyze whether the database and backend support grade-wide subject periods with rare class-specific exceptions, then plan the UI changes."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Analyze whether the database and backend support grade-wide subject periods with rare class-specific exceptions, then plan the UI changes., Source Nodes

### Community 249 - "Q: ok so implement the plan"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: ok so implement the plan, Source Nodes

### Community 250 - "Q: Here, can you update all UI components that they show the periods of subjects-class??? because the UI is yet do not working  correctly. the subject-class periods must be changeable from this components also packages/web/src/features/teachers/components/SubjectAssignmentManager.tsx packages/web/src/features/classes/components/ClassEditDrawer.tsx  and other UI parts must render or must show the real changes of periods. what do you think of???"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Here, can you update all UI components that they show the periods of subjects-class??? because the UI is yet do not working  correctly. the subject-class periods must be changeable from this components also packages/web/src/features/teachers/components/SubjectAssignmentManager.tsx packages/web/src/features/classes/components/ClassEditDrawer.tsx  and other UI parts must render or must show the real changes of periods. what do you think of???, Source Nodes

### Community 251 - "Q: http://localhost:5173/classes-schedule http://localhost:5173/teachers-schedule when accessing to these from browser it dont works correctly???"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: http://localhost:5173/classes-schedule http://localhost:5173/teachers-schedule when accessing to these from browser it dont works correctly???, Source Nodes

### Community 252 - "Q: Deep review and fix swaps, exports, and the Python solver; find bugs, wrong implementations, and improvements"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Deep review and fix swaps, exports, and the Python solver; find bugs, wrong implementations, and improvements, Source Nodes

### Community 253 - "index_package"
Cohesion: 0.50
Nodes (4): index_package(), main(), Index a single package and return stats., Index the Maktab codebase for semantic search.

### Community 254 - "Maktab database console"
Cohesion: 0.40
Nodes (4): Common commands, Destructive commands, Maktab database console, SQL shell commands

### Community 255 - "timetable.persistence.test.js"
Cohesion: 0.40
Nodes (3): assert, test, {
  validateGeneratedTimetable,
}

### Community 256 - "GradeCurriculumInfo"
Cohesion: 0.40
Nodes (5): GradeCurriculumInfo, BaseModel, Ministry-defined subject with required periods., Curriculum information for a specific grade., SubjectDefinition

### Community 258 - "generate-license.js"
Cohesion: 0.67
Nodes (3): crypto, generateLicenseKey(), main()

### Community 260 - "test_authentication.py"
Cohesion: 0.67
Nodes (3): APIClient, test_jwt_login_is_available_for_desktop(), test_session_login_requires_csrf_and_records_audit_event()

### Community 261 - "test_tenant_context.py"
Cohesion: 0.67
Nodes (3): APIClient, test_account_cannot_select_another_accounts_membership(), test_capabilities_intersect_roles_and_contract_entitlements()

## Knowledge Gaps
- **1610 isolated node(s):** `semi`, `trailingComma`, `singleQuote`, `printWidth`, `tabWidth` (+1605 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **31 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Work-memory lessons

**Preferred sources** — corroborated by past sessions; start here.
- `TeacherSelectionList.tsx` (4× useful, score=3.91033913) _(code changed — re-verify)_
- `useAssignmentMutations.ts` (4× useful, score=3.873336771) _(code changed — re-verify)_
- `AssignmentsPage.tsx` (2× useful, score=1.914744412) _(code changed — re-verify)_
- `swapValidation.ts` (2× useful, score=1.894475813) _(code changed — re-verify)_
- `TeacherBulkImportDialog()` (2× useful, score=1.882891134) _(code changed — re-verify)_
- `calculateMaxPeriodsPerWeek()` (2× useful, score=1.882891134) _(code changed — re-verify)_
- `AvailabilityMatrix.tsx` (2× useful, score=1.872895613) _(code changed — re-verify)_
- `TeacherFormDrawer.tsx` (2× useful, score=1.870550513) _(code changed — re-verify)_
- `scheduleStore.ts` (2× useful, score=1.840558334) _(code changed — re-verify)_

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Column` connect `Assignment Data Hooks` to `Shared Action Dialogs`, `Entity Editing Forms`, `Shared UI Primitives`, `Schedule Transformation Storage`, `Layout Licensing Generation`, `DataGrid.tsx`, `Teacher Bulk Import`, `Export Form Schema`, `Schedule Swap State`, `AuditService`, `API Error Tests`, `Subject Filtering`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Why does `cn()` connect `Schedule Grid Cells` to `Constraint Management`, `Assignment Page UI`, `Schedule Types Tests`, `Schedule Constraint Validation`, `Solver Results Dashboard`, `Assignment Workflow Hooks`, `Workload Conflict Services`, `Schedule Dashboard`, `defaults.ts`, `Assignment Error Conflicts`, `Schedule Views Navigation`, `Schedule Query Hooks`, `Teacher Subject Availability`, `Period Defaults Matrix`, `Assignment Cache Management`, `Class Categories Statistics`, `Shared Error Routing`, `ESLint Configuration`, `dropdown-menu.tsx`, `Room CRUD Tests`, `Subject API Serialization`, `DataGrid.tsx`, `Room Data Grid`, `Subject Data Grid`, `Class CRUD Tests`, `Swap Indicator Tests`, `Index Route`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Why does `requirement()` connect `Schedule Transformation Storage` to `Solver Generation Status`, `Schedule Grid Cells`, `Assignment Cache Management`, `Room Serialization`, `Sidebar Readiness Tooltips`, `Assignment Workflow Hooks`, `Schedule Swap Grid`, `Teacher Bulk Import`, `Assignment Error Conflicts`, `Application Bootstrap I18n`, `Schedule Export Dialog`, `Assignment Serialization Utilities`, `Schedule Query Hooks`, `Readiness Validation`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **What connects `semi`, `trailingComma`, `singleQuote` to the rest of the system?**
  _2120 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Constraint Management` be split into smaller, more focused modules?**
  _Cohesion score 0.0282937736498108 - nodes in this community are weakly interconnected._
- **Should `Assignment Data Hooks` be split into smaller, more focused modules?**
  _Cohesion score 0.023084291187739463 - nodes in this community are weakly interconnected._
- **Should `Assignment Page UI` be split into smaller, more focused modules?**
  _Cohesion score 0.044729433844228964 - nodes in this community are weakly interconnected._