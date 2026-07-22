# Graph Report - maktab  (2026-07-21)

## Corpus Check
- 795 files · ~474,228 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 6514 nodes · 17417 edges · 263 communities (241 shown, 22 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 611 edges (avg confidence: 0.67)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e6d8447f`
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
- Frontend Setup Instructions
- useConflictDetection.ts
- useClassAssignments.ts
- CategoryAccordion.tsx
- server.ts
- ExportService
- HardConstraint
- ._make_label_key
- Maktab Web Frontend
- index.ts
- DayOfWeek
- package.json
- assignment.routes.ts
- SwapValidator
- ProgressReporter
- ScheduleList.tsx
- CodeChunker
- build
- dependencies
- migrate-assignments.js
- Context Indexer Cheat Sheet
- LRUCache
- assignment.types.ts
- ConsecutiveConstraint
- assignmentValidation.ts
- CodeEmbedder
- CodebaseIndex
- 1783900000000-RepairSchoolConfigFlow.ts
- WizardRepository
- assignmentConsistency.service.ts
- Histogram
- __init__.py
- subjectContracts.test.ts
- FileRoutesByPath
- build-solver.js
- ConstraintStage
- Files
- ConfigurationService
- StrategySelector
- DataCompletionProgress.tsx
- ExportErrorBoundaryClass
- devDependencies
- Counter
- package.json
- TeacherConstraintTests
- main
- package.json
- download-fonts.js
- 1783800000000-ReconcileDatabaseIntegrity.ts
- scheduleTiming.service.ts
- DatabaseManagerTests
- SameDayConstraint
- SwapRequest
- RoomSolverConstraintTests
- scripts
- subjectColors.ts
- compilerOptions
- CodeChunk
- Gauge
- DataGrid.tsx
- api.ts
- apiParsers.ts
- 1730000000000-BaselineSchema.ts
- 1784200000000-HardenSubjectIdentity.ts
- create_worker_from_config
- prometheus.py
- Timer
- playwright.config.ts
- periods.tsx
- ErrorBoundaryClass
- package-electron.js
- DeviceTrialService
- generatedTimetableValidation.service.ts
- swap-export.contract.test.js
- MetricValue
- dashboard.tsx
- main.tsx
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
- Q: How should manually created subjects replace a ministry subject and be assigned to existing classes without refreshing the whole curriculum?
- Q: If we implement flow 3, where should we place the School Curriculum feature for consistency and better UX?
- Q: Should the School Curriculum page use School Settings and Period Structure as dynamic inputs, and smartly create subjects and classes when applying?
- Q: Implement the School Curriculum plan as a dynamic school-owned source of truth using School Settings and Period Structure, with reviewed subject/class materialization.
- index_package
- Maktab database console
- timetable.persistence.test.js
- package.json
- generate-license.js
- .observe
- teachers.tsx
- preload.js
- .failure
- aliases.sh
- .clear
- react
- PrayerBreakConfig
- SCHOOL_SETTINGS_QUERY_KEY

## God Nodes (most connected - your core abstractions)
1. `cn()` - 319 edges
2. `RepositoryOptions` - 151 edges
3. `CacheManager` - 144 edges
4. `Button` - 92 edges
5. `ServiceResult` - 91 edges
6. `Logger` - 71 edges
7. `Badge` - 70 edges
8. `Subject` - 68 edges
9. `Teacher` - 65 edges
10. `getDataSourceScopedInstance()` - 59 edges

## Surprising Connections (you probably didn't know these)
- `CodebaseIndex` --uses--> `CodeChunk`  [INFERRED]
  jepa-context/indexer/index.py → jepa-context/indexer/chunker.py
- `CodebaseIndex` --uses--> `CodeChunker`  [INFERRED]
  jepa-context/indexer/index.py → jepa-context/indexer/chunker.py
- `CodebaseIndex` --uses--> `CodeEmbedder`  [INFERRED]
  jepa-context/indexer/index.py → jepa-context/indexer/embedder.py
- `index_package()` --calls--> `CodebaseIndex`  [INFERRED]
  jepa-context/scripts/index_codebase.py → jepa-context/indexer/index.py
- `main()` --calls--> `CodebaseIndex`  [INFERRED]
  jepa-context/scripts/query_context.py → jepa-context/indexer/index.py

## Import Cycles
- None detected.

## Communities (263 total, 22 thin omitted)

### Community 0 - "Constraint Management"
Cohesion: 0.04
Nodes (109): Alert, AlertDescription, AlertTitle, alertVariants, Avatar, AvatarFallback, AvatarImage, Button (+101 more)

### Community 1 - "Assignment Data Hooks"
Cohesion: 0.03
Nodes (63): ClassSubjectRequirementRepository, TeacherSubjectCapabilityInput, TeacherSubjectCapabilityRepository, TeachingAssignmentRepository, ClassSubjectRequirement, Check, Entity, Index (+55 more)

### Community 2 - "Assignment Page UI"
Cohesion: 0.03
Nodes (105): getAfghanistanTemplateForGrade(), Express, paginationMiddleware(), parsePositiveInt(), Request, formatZodErrors(), integerParamInRange(), parseIntegerInRange() (+97 more)

### Community 3 - "Entity Editing Forms"
Cohesion: 0.03
Nodes (24): RepositoryOptions, ClassRepository, LicenseRepository, normalizeRoomFeatures(), normalizeRoomName(), parseUnavailable(), RoomRepository, RoomTypeRepository (+16 more)

### Community 4 - "Shared UI Primitives"
Cohesion: 0.03
Nodes (102): Preference-aware quality reporting for generated timetables., create_job(), Any, BaseModel, QueueStatistics, Create a successful result.                  Args:             job_id: Job ident, Check if the result represents a successful solve., Check if the result represents a failed solve. (+94 more)

### Community 5 - "Schedule Types Tests"
Cohesion: 0.05
Nodes (97): Badge, BadgeProps, badgeVariants, FormControl, FormDescription, FormField(), FormFieldContext, FormFieldContextValue (+89 more)

### Community 6 - "Schedule Transformation Storage"
Cohesion: 0.02
Nodes (55): AppDataSource, AddFixedRoomToClassGroup1730826000000, AddAfghanistanFieldsToSchoolConfig1734530000000, CreateTeacherClassSubjectAssignment1736300000000, AddBreakPeriodsByDayToSchoolConfig1737600000000, CreateCanonicalAssignmentTables1742400000000, TrackTimetableStaleness1784300000000, HardenTeacherContracts1784400000000 (+47 more)

### Community 7 - "Layout Licensing Generation"
Cohesion: 0.03
Nodes (81): migrateLegacy(), migrateStrength(), quantize(), SchoolScopedOptimizationPreferences1784700000000, DEFAULT_SCHOOL_CONFIG, normalizeBreakPeriods(), parseBreakPeriods(), parseBreakPeriodsByDay() (+73 more)

### Community 8 - "Schedule Grid Cells"
Cohesion: 0.04
Nodes (98): TeacherWorkloadView, calculateMaxPeriodsPerWeek(), getEffectivePeriodsPerDayMap(), SchoolConfig, AssignmentBadgesCell(), AssignmentBadgesCellProps, ClassInfo, FlatAssignment (+90 more)

### Community 9 - "Schedule State Store"
Cohesion: 0.03
Nodes (61): can_teach(), is_room_compatible(), Any, IntVar, TimetableData, Return class or class-subject occupancy for a single solver slot., Check if a room is compatible with a subject and class., Count empty usable positions strictly between first and last occupancy. (+53 more)

### Community 10 - "Schedule Constraint Validation"
Cohesion: 0.06
Nodes (59): CACHE_PREFIXES, LOG_LEVELS, AggregatedCacheStats, CacheManagerConfig, CacheEntry, CacheStats, BaseEntity, SubjectRequirement (+51 more)

### Community 11 - "Solver Results Dashboard"
Cohesion: 0.05
Nodes (79): classesApi, deserializeClass(), parseMetaJson(), serializeClassForApi(), BulkApplyCurriculumDialog(), BulkApplyCurriculumDialogProps, BulkClassDialog(), ClassDataGrid() (+71 more)

### Community 12 - "Data Lists Utilities"
Cohesion: 0.05
Nodes (61): flattenKeys(), assignmentsTranslations, classesTranslations, fetchPreferences(), optimizationPreferencesSchema, parsePreferencesProfile(), profileSchema, savePreferences() (+53 more)

### Community 13 - "Assignment Shared Models"
Cohesion: 0.06
Nodes (70): subjectsApi, SubjectPeriodSummary, getStatusColors(), SubjectAssignmentSheet(), SubjectAssignmentSheetProps, getStatusColors(), SubjectCoverageCell(), SubjectCoverageCellProps (+62 more)

### Community 14 - "Assignment Workflow Hooks"
Cohesion: 0.05
Nodes (39): ParsedTeacher, TeacherInput, TeacherRepository, runCommittedTransaction(), arraySchema, BulkTeacherDeleteInput, bulkTeacherDeleteSchema, BulkTeacherImportInput (+31 more)

### Community 15 - "Schedule Swap Grid"
Cohesion: 0.06
Nodes (66): AssignmentStatusBadge(), AssignmentStatusBadgeProps, STATUS_CONFIG, ClassSelectorProps, COMPATIBILITY_CONFIG, CompatibilityBadge(), CompatibilityBadgeProps, ConflictAlert() (+58 more)

### Community 16 - "Teacher Bulk Import"
Cohesion: 0.06
Nodes (55): PageHeader(), PageHeaderProps, ErrorBoundaryState, Card, CardContent, CardDescription, CardFooter, CardHeader (+47 more)

### Community 17 - "Workload Conflict Services"
Cohesion: 0.06
Nodes (61): SidebarItemType, SidebarNavItem, SidebarSection, TooltipContent, AssignmentCell(), AssignmentCellProps, getInitials(), addAllocation() (+53 more)

### Community 18 - "Schedule Dashboard"
Cohesion: 0.05
Nodes (59): build_error(), build_internal_error(), _extract_affected_entities(), _format_message(), AffectedEntity, Any, Exception, SolverErrorDetail (+51 more)

### Community 19 - "Core School Models"
Cohesion: 0.06
Nodes (54): ExportDialog(), getDefaultValues(), ClassScheduleView, EmptyScheduleState, ScheduleWorkspaceToolbar(), GRADE_CATEGORIES, useKeyboardShortcuts(), UseKeyboardShortcutsOptions (+46 more)

### Community 20 - "Schedule Drag Selection"
Cohesion: 0.09
Nodes (8): CacheManager, positiveEnvironmentInteger(), applyLessonMovesToPayload(), createSwapRoutes(), parseTimetableId(), parseTimetablePayload(), validateSwapRequest(), getDataSourceScopedInstance()

### Community 21 - "Settings Cards Controls"
Cohesion: 0.09
Nodes (46): AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay, AlertDialogTitle (+38 more)

### Community 22 - "Assignment Coverage Projections"
Cohesion: 0.05
Nodes (39): Room, Check, Entity, Index, PrimaryGeneratedColumn, Teacher, TeacherEmploymentType, Check (+31 more)

### Community 23 - "Assignment Error Conflicts"
Cohesion: 0.07
Nodes (56): main(), main(), applyBackfillPlan(), colorize(), colors, getCanonicalSchemaStatus(), loadCanonicalSnapshot(), loadPlannerInput() (+48 more)

### Community 24 - "Schedule Views Navigation"
Cohesion: 0.06
Nodes (50): formatSlot(), getDayLabel(), SwapBlockedDialog(), SwapBlockedDialogProps, SwapWarningDialog(), SwapWarningDialogProps, CellContentToggles(), CellContentTogglesProps (+42 more)

### Community 25 - "Runtime Dependencies"
Cohesion: 0.33
Nodes (6): dependencies, better-sqlite3, electron-updater, node-machine-id, rollup, timetable-api

### Community 26 - "Solver Strategy Selection"
Cohesion: 0.06
Nodes (41): SaveScheduleInput, scheduleApi, ScheduleApiResult, MultiLessonCellProps, ScheduleRouteState(), SCHEDULE_QUERY_KEYS, useAutoSave(), PeriodsConfiguration (+33 more)

### Community 27 - "Schedule Swap State"
Cohesion: 0.06
Nodes (44): Header(), MainLayout(), Sidebar(), TabBar(), LicenseBanner(), DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem (+36 more)

### Community 28 - "Assignment Requirement Validation"
Cohesion: 0.07
Nodes (26): getGradeCategory(), normalizeSubjectCode(), normalizeSubjectFeatureTags(), normalizeSubjectInput(), normalizeSubjectText(), SubjectIdentityMatch, SubjectRepository, Subject (+18 more)

### Community 29 - "Assignment Serialization Utilities"
Cohesion: 0.07
Nodes (47): Command, CommandDialogProps, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator (+39 more)

### Community 30 - "Schedule Query Hooks"
Cohesion: 0.07
Nodes (39): SettingsTogglesProps, DraggableCell, DraggableCellProps, DroppableCell, DroppableCellProps, isValidDropSource(), FocusIndicator, FocusIndicatorProps (+31 more)

### Community 31 - "Readiness Validation"
Cohesion: 0.07
Nodes (14): ConstraintViolation, constraintViolationSchema, LessonMove, lessonMoveSchema, SlotPosition, slotSchema, SwapRequest, swapRequestSchema (+6 more)

### Community 32 - "Solver Generation Status"
Cohesion: 0.10
Nodes (37): roomsApi, RoomDataGridProps, RoomEditDrawerProps, RoomFiltersProps, RoomForm(), RoomFormProps, RoomFormDrawer(), RoomFormDrawerProps (+29 more)

### Community 33 - "Teacher Subject Availability"
Cohesion: 0.06
Nodes (28): ClassGroup, IntervalVar, Core solver components.  This module contains the core components of the timetab, Any, CpModel, IntVar, T, TimetableData (+20 more)

### Community 34 - "Period Defaults Matrix"
Cohesion: 0.12
Nodes (39): BreakConfiguration(), BreakConfigurationProps, BreakEditorTarget, buildEvenlyDistributedBreaks(), getNextAvailableBreakPeriod(), CategoryPeriodsMatrix(), CategoryPeriodsMatrixProps, DynamicPeriodsConfigProps (+31 more)

### Community 35 - "Teacher Forms Validation"
Cohesion: 0.10
Nodes (40): useKeyboardNavigation(), UseKeyboardNavigationOptions, UseKeyboardNavigationReturn, RoomConstraintData, ScheduleIndexes, SubjectConstraintData, TeacherConstraintData, generateEntityColor() (+32 more)

### Community 36 - "Curriculum Schedule Lists"
Cohesion: 0.05
Nodes (44): dependencies, autoprefixer, class-variance-authority, clsx, cmdk, @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities (+36 more)

### Community 37 - "Teacher Page Data"
Cohesion: 0.08
Nodes (33): RadioGroup, RadioGroupItem, exportApi, ExportJobResponse, fetchAPI(), isExportJob(), FormatSelector(), FormatSelectorProps (+25 more)

### Community 38 - "Unified Assignments Data"
Cohesion: 0.08
Nodes (32): BoundLogger, ConfigLoader, Path, Apply environment variable overrides to configuration.                  Supporte, Save configuration to YAML file.                  Args:             config: Conf, Get default configuration without loading from file.                  Returns:, Find the first existing config file in search paths.                  Returns:, Loads solver configuration from YAML files and environment variables.          S (+24 more)

### Community 39 - "Data Grids Dialogs"
Cohesion: 0.08
Nodes (38): BulkOperationResult, BulkOperationStatus, assignmentsApi, UseAssignmentMutationsResult, AssignmentSyncState, calculateClassStatus(), calculateSubjectStatus(), calculateTeacherStatus() (+30 more)

### Community 40 - "Period Structure Schema"
Cohesion: 0.18
Nodes (17): ArgumentParser, Namespace, build_parser(), confirm(), DatabaseManager, heading(), interactive_menu(), main() (+9 more)

### Community 41 - "Assignment Cache Management"
Cohesion: 0.10
Nodes (29): CpSolver, build_effective_break_periods_by_day(), build_period_configuration_metadata(), clamp_break_periods(), _day_to_string(), get_category_dari_name(), get_periods_for_class_day(), has_variable_breaks() (+21 more)

### Community 42 - "Class Categories Statistics"
Cohesion: 0.11
Nodes (14): ASSIGNMENT_QUERY_KEYS, AssignmentCacheManager, ensureSubjectRequirements(), parseJsonArray(), ClassCoverageDetail, CoverageStatus, SubjectCoverage, TeacherCompatibility (+6 more)

### Community 43 - "Schedule View Routing"
Cohesion: 0.05
Nodes (38): 1. Setup Aliases (One-time), 2. Index the Codebase, 3. Query the Code, Advanced, Aliases not working, Architecture, Available Commands, Backend Development (+30 more)

### Community 44 - "Sidebar Readiness Tooltips"
Cohesion: 0.14
Nodes (9): TeacherClassSubjectAssignmentInput, AssignmentBatchChangeInput, AssignmentBatchResult, AssignmentOperationResult, AssignmentPrimaryCapabilityGrantInput, ClassPeriodOverride, AssignmentCommandService, buildClassPeriodOverrideMap() (+1 more)

### Community 45 - "Subject Page Data"
Cohesion: 0.07
Nodes (24): MemoryError, MemoryManager, MemoryWarning, Any, Exception, T, Initialize the MemoryManager.                  Args:             max_memory_mb:, Get current memory usage in megabytes.                  Uses psutil if available (+16 more)

### Community 46 - "TypeScript Configuration"
Cohesion: 0.07
Nodes (21): BalancedStrategy, Any, SolverStrategy, Balanced search effort; the enabled objective set remains unchanged., ABC, Any, Base strategy interface for solver strategies., Initialize strategy.                  Args:             name: Strategy name (e.g (+13 more)

### Community 47 - "School Settings API"
Cohesion: 0.10
Nodes (17): UseRealtimeWorkloadResult, getCompatibleTeachersForSubject(), ConflictResolutionService, getBestResolution(), getResolutionsForConflict(), hasAutoApplicableResolution(), ResolutionActionType, ResolutionResult (+9 more)

### Community 48 - "Shared Error Routing"
Cohesion: 0.11
Nodes (36): calculateAssignmentPeriods(), deserializeClassAssignments(), deserializeEnhancedClassAssignments(), deserializeEnhancedSubjectRequirements(), deserializeSubjectRequirements(), determineAssignmentStatus(), enhanceClassAssignment(), enhanceSubjectRequirement() (+28 more)

### Community 49 - "Period Break Configuration"
Cohesion: 0.07
Nodes (31): UseAssignmentsPageOptions, UseRealtimeWorkloadOptions, AffectedEntities, AssignmentDrawerState, AssignmentOperationResult, AssignmentSelectionState, AssignmentsFilterState, AssignTeacherRequest (+23 more)

### Community 50 - "Teacher Compatibility Selection"
Cohesion: 0.11
Nodes (34): useRealtimeWorkload(), CACHE_GC_TIMES, CACHE_STALE_TIMES, createAssignmentCacheManager(), calculateTeacherWorkload(), calculateWorkloadBreakdown(), calculateWorkloadFromAssignments(), calculateWorkloadWithAssignment() (+26 more)

### Community 51 - "Keyboard Schedule Navigation"
Cohesion: 0.08
Nodes (32): updatePeriodStructure(), DynamicPeriodsConfig(), useUpdatePeriodStructure(), breakPeriodSchema, breaksByDaySchema, categoryPeriodsMapSchema, gradeCategorySchema, periodCountSchema (+24 more)

### Community 52 - "Optimized Assignment Calculations"
Cohesion: 0.10
Nodes (29): DashboardErrorStateProps, DashboardSkeleton(), DashboardSkeletonProps, GenerationHubSkeleton(), HistorySectionSkeleton(), ReadinessChecklistSkeleton(), ScheduleCardSkeleton(), StrategyCardSkeleton() (+21 more)

### Community 53 - "Teacher API Serialization"
Cohesion: 0.15
Nodes (33): DEFAULT_DAYS, LessonPickerState, ResolvedSwapStatus, ScheduleGrid(), SwapReviewStatus, SwapConfirmationDialog(), isEscapeKey(), isSelectionKey() (+25 more)

### Community 54 - "ESLint Configuration"
Cohesion: 0.09
Nodes (20): ConstraintViolation, LessonMove, Validates a swap operation and finds minimal disruption solution., Check whether the moved teachers are available in their target slots., Check if teacher would be double-booked after swap., Check if either class would be double-booked after the swap., Check if room would be double-booked after swap., Find lesson at specific slot. (+12 more)

### Community 55 - "Application Bootstrap I18n"
Cohesion: 0.11
Nodes (32): asRecord(), calculateAvailableClassPeriods(), buildMetadataLookup(), dayMatches(), DEFAULT_DAYS_OF_WEEK, detectDayOffset(), detectPeriodOffset(), ExportLesson (+24 more)

### Community 56 - "Room Data Access"
Cohesion: 0.08
Nodes (23): apply_defaults(), Any, Validate configuration has required fields with valid values.          Args:, Apply default values to missing configuration fields.          This function fil, validate_config(), LowResourceHandler, Any, Create a LowResourceHandler from solver configuration dictionary. (+15 more)

### Community 57 - "Development Dependencies"
Cohesion: 0.25
Nodes (8): devDependencies, concurrently, cross-env, dependency-cruiser, electron, electron-builder, madge, wait-on

### Community 58 - "Search Selection Controls"
Cohesion: 0.08
Nodes (33): MetricItem(), MetricItemProps, QUALITY_DESCRIPTIONS, QUALITY_LABELS, QualityScoreDisplay(), QualityScoreDisplayProps, SuggestionItem(), SuggestionItemProps (+25 more)

### Community 59 - "Teacher Subject Configuration"
Cohesion: 0.11
Nodes (13): DisplaySettings, ExcelGenerationOptions, ExcelGenerationService, ScheduleData, getBreakIntervals(), getDaysOfWeek(), getMaxPeriods(), getPeriodTimeRange() (+5 more)

### Community 60 - "Class Page Data"
Cohesion: 0.10
Nodes (23): Consecutive period constraints for Afghanistan school rules.  This module implem, Register the consecutive constraint with the registry.          Args:         re, register_consecutive_constraint(), Register all no-overlap constraints with the registry.          Args:         re, register_no_overlap_constraints(), Same-day constraint for multi-period lessons.  This constraint ensures that mult, Register the same-day constraint with the registry.          Args:         regis, register_same_day_constraint() (+15 more)

### Community 61 - "School Settings Page"
Cohesion: 0.07
Nodes (19): ConsecutiveOptimizer, Phase 3.5: Consecutive Lessons Optimization  Optimizes O(n²) pairwise checks to, Pre-process consecutive lesson constraints for efficiency.                  Args, Optimizes consecutive lesson constraint generation.          Instead of checking, Generate optimized gap prevention constraints.                  Args:, Group lessons by day efficiently.                  Args:             lessons: Li, Check if consecutive constraint is feasible before adding it.                  A, DomainFilter (+11 more)

### Community 62 - "Schedule Export Dialog"
Cohesion: 0.10
Nodes (24): AnalysisSummary, ScheduleData, DisplaySettings, ExportFormat, ExportJobResponse, ExportLanguage, ExportProgress, ExportRequest (+16 more)

### Community 63 - "Subject Filtering"
Cohesion: 0.11
Nodes (18): Checkpoint, CheckpointManager, Any, Path, Initialize the checkpoint manager.                  Args:             checkpoint, Ensure the checkpoint directory exists., Get the file path for a checkpoint., Compute a hash of the input data for validation.                  This hash is u (+10 more)

### Community 64 - "Shared Action Dialogs"
Cohesion: 0.14
Nodes (27): response, extractSolverFields(), getSerializedJsonFromCharacterMap(), mapBreakIntervalsByDay(), mapBreakPeriods(), mapBreakPeriodsByDay(), mapClassMetadata(), mapLesson() (+19 more)

### Community 65 - "UI Components Configuration"
Cohesion: 0.07
Nodes (29): compilerOptions, allowImportingTsExtensions, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module, moduleResolution (+21 more)

### Community 66 - "Class API Serialization"
Cohesion: 0.11
Nodes (16): DecompositionSolver, Any, Analyze how much teachers are shared across classes.          Returns:, Choose the best decomposition strategy for this problem.          Returns:, Check if classes have grade level metadata., Check if grade levels are independent (don't share teachers).          Returns:, Orchestrates decomposition-based solving for large problems.      Decides whethe, Solve the timetabling problem, with or without decomposition.          Args: (+8 more)

### Community 67 - "Room Filtering"
Cohesion: 0.12
Nodes (24): DEFAULT_ROOM_TYPES, getRoomTypeIcon(), ICON_MAP, localizeRoomType(), RoomTypeOption, RoomTypeWithIcon, withIcons(), RoomDataGrid() (+16 more)

### Community 68 - "Room CRUD Tests"
Cohesion: 0.15
Nodes (27): buildErrorFromLastRun(), buildLastRunSignature(), buildSyntheticError(), buildTerminalStatus(), ERROR_MESSAGES, ERROR_SUGGESTIONS, generateScheduleApi(), getErrorMessageFromResponse() (+19 more)

### Community 69 - "Schedule Export API"
Cohesion: 0.07
Nodes (27): Route, Route, AboutRoute, AssignmentsRoute, ClassesRoute, ClassesScheduleRoute, ConstraintsRoute, DashboardRoute (+19 more)

### Community 70 - "Subject API Serialization"
Cohesion: 0.17
Nodes (9): ObjectiveResult, AffectedEntity, Any, TimetableData, QualityScorer, Measure exactly the soft objectives selected by the headteacher., QualityScore, ScheduledLesson (+1 more)

### Community 72 - "Room Type Settings"
Cohesion: 0.12
Nodes (25): { app }, crypto, fs, generateUuid(), getFallbackUuidPath(), getMachineId(), getMachineIdSync(), getOrCreateFallbackUuid() (+17 more)

### Community 73 - "Assignment Conflict Hook"
Cohesion: 0.14
Nodes (21): ERROR_CODES, HTTP_STATUS, createLastRunSummary(), createScheduleName(), createStructuredFailure(), getTimetableService(), handleAnalyze(), handleCancelGenerate() (+13 more)

### Community 74 - "Generation Progress Hub"
Cohesion: 0.19
Nodes (6): ClassInput, ParsedClass, ClassService, normalizeSubjectRequirementsInput(), splitClassWriteInput(), warnOnDeprecatedClassWrite()

### Community 76 - "Room Serialization"
Cohesion: 0.11
Nodes (16): Hard constraints module.  Hard constraints are constraints that must always be s, NoClassOverlapConstraint, NoRoomOverlapConstraint, NoTeacherOverlapConstraint, Any, CpModel, No-overlap constraints for timetable scheduling.  These constraints ensure that, Check if this constraint should be applied. (+8 more)

### Community 77 - "School Shift Configuration"
Cohesion: 0.13
Nodes (20): CheckpointCorruptError, CheckpointError, CheckpointNotFoundError, CheckpointValidationError, Exception, Base exception for checkpoint-related errors., Raised when a checkpoint file is not found., Raised when a checkpoint file is corrupted or invalid. (+12 more)

### Community 78 - "Subject Form Utilities"
Cohesion: 0.12
Nodes (21): curriculumApi, activeGrades(), capacityForGrade(), categoryForGrade(), newItemId(), parsePastedSubjects(), SchoolCurriculumPage(), CURRICULUM_QUERY_KEY (+13 more)

### Community 79 - "Conflict Detection Engine"
Cohesion: 0.08
Nodes (26): devDependencies, eslint, eslint-config-prettier, @eslint/js, eslint-plugin-react, eslint-plugin-react-hooks, globals, jsdom (+18 more)

### Community 80 - "Curriculum Population"
Cohesion: 0.15
Nodes (19): buildDataLookups(), calculateCompatibilityOptimized(), calculateCoveragesBatch(), calculateWorkloadOptimized(), calculateWorkloadsBatch(), calculateWorkloadStatus(), canAcceptMoreAssignments(), clearCalculationCaches() (+11 more)

### Community 81 - "Room Data Grid"
Cohesion: 0.13
Nodes (23): ErrorDisplayProps, CATEGORY_COLORS, CATEGORY_ICONS, ErrorGroup(), ErrorGroupProps, ENTITY_TYPE_LABELS, ErrorItem(), ErrorItemProps (+15 more)

### Community 82 - "Subject Data Grid"
Cohesion: 0.29
Nodes (24): check_docker(), check_docker_compose(), check_ports(), cmd_clean(), cmd_db_backup(), cmd_db_restore(), cmd_help(), cmd_logs() (+16 more)

### Community 83 - "Schedule Onboarding"
Cohesion: 0.08
Nodes (25): scripts, assignments:phase1:sync-schema, assignments:phase2:backfill, assignments:phase2:backfill:dry, assignments:phase2:report, build, db, db:backup (+17 more)

### Community 84 - "Schedule Display Settings"
Cohesion: 0.08
Nodes (22): BaseLessonSchema, BreakPeriodConfigSchema, ClassGroupSchema, ConstraintViolationSchema, DayOfWeek, DayOfWeekSchema, FixedLessonSchema, GlobalConfigSchema (+14 more)

### Community 85 - "Class Filtering"
Cohesion: 0.23
Nodes (5): ParsedRoom, RoomInput, isUniqueNameError(), RoomService, assertOperationalWriteScope()

### Community 86 - "Export Error Boundary"
Cohesion: 0.12
Nodes (14): ClassClusterBuilder, Any, Builds class clusters based on shared teacher relationships.  Uses graph-based a, Find connected components using BFS.          Args:             graph: Adjacency, Count total requests in a cluster., Balance cluster sizes to optimize performance.          Strategy:         1. Spl, Builds clusters of classes that can be solved independently.      Uses teacher-c, Split a large cluster into smaller sub-clusters.          Uses simple partitioni (+6 more)

### Community 87 - "Export Form Schema"
Cohesion: 0.14
Nodes (22): ScheduleDashboard(), determineEmptyStateType(), EmptyStateType, useEmptyStateLogic(), UseEmptyStateLogicReturn, useReadinessValidation(), UseReadinessValidationReturn, useDeleteSchedule() (+14 more)

### Community 88 - "Subject Form Schema"
Cohesion: 0.21
Nodes (5): ParsedSubject, SubjectInput, CurriculumMaterializationResult, GradeSubjectPeriodUpdateResult, SubjectService

### Community 89 - "Rooms Page Layout"
Cohesion: 0.17
Nodes (22): AssignmentBatchAllocation, AssignmentBatchMutationInput, AssignmentPrimaryCapabilityGrant, buildClassPeriodMap(), buildOptimisticAssignments(), buildOptimisticUnassignments(), getBatchErrorMessage(), invalidateAllAssignmentCaches() (+14 more)

### Community 90 - "Subject Section Translation"
Cohesion: 0.11
Nodes (20): assignmentMatrixSchema, assignmentSchema, classAssignmentViewSchema, projectionRequirementSchema, teacherWorkloadViewSchema, teacherWorkloadViewsSchema, warningSchema, workloadSchema (+12 more)

### Community 91 - "Package Scripts"
Cohesion: 0.11
Nodes (18): scripts, analyze:wizard, build, build:all, build:api, build:solver, build:web, dev (+10 more)

### Community 92 - "Subject Color Generation"
Cohesion: 0.12
Nodes (17): deserializeRoom(), parseJsonArray(), parseJsonObject(), parseUnavailableSlots(), RoomAvailabilityDataError, serializeRoomForApi(), DaysOfWeekSelectorProps, AFGHAN_WEEK_DAYS (+9 more)

### Community 93 - "Node TypeScript Config"
Cohesion: 0.16
Nodes (18): TeacherScheduleView, parseScheduleSearch(), useScheduleRouteLoader(), UseScheduleRouteLoaderOptions, UseScheduleRouteLoaderReturn, mocks, DEFAULT_PREFERENCE, findLatestScheduleId() (+10 more)

### Community 94 - "API Error Tests"
Cohesion: 0.08
Nodes (23): Adding New Translations, Cell States (`cell.*`), Editing Actions (`editing.actions.*`), Editing Hints (`editing.hints.*`), Editing Keyboard (`editing.keyboard.*`), Editing Mode (`editing.mode.*`), Editing Status (`editing.status.*`), English (+15 more)

### Community 95 - "Class CRUD Tests"
Cohesion: 0.15
Nodes (17): deserializeTeacher(), TeacherResponse, apiLogger, componentLogger, LogContext, LogLevel, parseAvailabilityMatrix(), parseClassAssignments() (+9 more)

### Community 96 - "Swap Indicator Tests"
Cohesion: 0.15
Nodes (21): calculateRetryDelay(), DEFAULT_RETRY_CONFIG, ErrorState, INITIAL_ERROR_STATE, isRetryableError(), mapErrorToCode(), RetryConfig, sleep() (+13 more)

### Community 97 - "Teacher Workload Hook"
Cohesion: 0.16
Nodes (16): AFGHANISTAN_CURRICULUM_TEMPLATE, DAYS, DEFAULT_DAYS, HardenPeriodConfiguration1784000000000, normalizeBreaks(), normalizeDays(), normalizePeriodMap(), normalizePrayerBreaks() (+8 more)

### Community 98 - "Dashboard Route"
Cohesion: 0.15
Nodes (6): License, Entity, Index, PrimaryGeneratedColumn, ContactInfo, LicenseService

### Community 99 - "Display Settings Hook"
Cohesion: 0.10
Nodes (20): AffectedEntity, isStructuredSolverResponse(), ObjectiveResult, PreSolveResult, QualityBreakdown, QualityScore, SolverError, SolverErrorDetail (+12 more)

### Community 100 - "Export Progress Tests"
Cohesion: 0.10
Nodes (14): Constraint, ABC, Any, CpModel, Base constraint interface for modular constraint system., Initialize constraint.                  Args:             name: Human-readable n, Apply this constraint to the CP-SAT model.                  Args:             mo, Enable this constraint. (+6 more)

### Community 101 - "Package Metadata"
Cohesion: 0.20
Nodes (9): author, description, homepage, keywords, license, main, name, version (+1 more)

### Community 102 - "Constraint Weight Slider"
Cohesion: 0.13
Nodes (14): DecompositionStrategy, Enum, Main decomposition solver orchestrator.  Decides whether to use decomposition, c, Available decomposition strategies., Decomposition solver for large timetabling problems.  Breaks problems into small, Any, Merges solutions from multiple sub-problems into a unified timetable.  Verifies, Merges sub-problem solutions into a complete timetable.      Verifies:     - No (+6 more)

### Community 103 - "Display Settings Tests"
Cohesion: 0.18
Nodes (15): getExpectedTotalPeriods(), GRADE_CATEGORIES, GradeCategory, GradeCategoryInfo, GradeSubjects, SubjectDefinition, createDefaultCurriculumConfig(), curriculumToSolverFormat() (+7 more)

### Community 104 - "Unsaved Changes Tests"
Cohesion: 0.18
Nodes (6): CurriculumConfigRepository, CurriculumConfig, Entity, Index, PrimaryGeneratedColumn, BulkAssignmentSummary()

### Community 105 - "Sidebar Navigation Tests"
Cohesion: 0.15
Nodes (6): AuditLog, Entity, PrimaryGeneratedColumn, AuditAction, AuditContext, AuditService

### Community 106 - "Delete Dialog Tests"
Cohesion: 0.10
Nodes (20): { AppDataSource }, assert, { CacheManager }, { ClassService }, {
  CurriculumConfigRepository,
}, {
  CurriculumMaterializationService,
}, { CurriculumPlanService }, fs (+12 more)

### Community 107 - "Test Environment Setup"
Cohesion: 0.10
Nodes (20): compilerOptions, allowSyntheticDefaultImports, declaration, declarationMap, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+12 more)

### Community 108 - "Statistics Card Tests"
Cohesion: 0.16
Nodes (17): ConflictResolution, useRealtimeConflicts(), UseRealtimeConflictsOptions, UseRealtimeConflictsResult, calculateTotalAssignedPeriods(), detectAllConflicts(), detectCompatibilityConflicts(), detectCoverageConflict() (+9 more)

### Community 109 - "Index Route"
Cohesion: 0.10
Nodes (20): 1. Translation Structure Created, 2. Translation Keys Implemented, 3. Integration with Main i18n, 4. Language Support, ✨ Benefits, Cell State Translations, ✅ Completed, Editing Mode Translations (+12 more)

### Community 110 - "PostCSS Configuration"
Cohesion: 0.25
Nodes (17): teacherAssignmentsApi, invalidateAllCaches(), teacherAssignmentKeys, useAssignmentSummary(), useBulkCreateTeacherAssignments(), useCreateTeacherAssignment(), useDeleteTeacherAssignment(), useTeacherAssignmentsByClass() (+9 more)

### Community 111 - "Error Boundary Tests"
Cohesion: 0.14
Nodes (15): DEFAULT_ROOM_TYPES, DefaultRoomTypeDefinition, SUPPORTED_ROOM_TYPE_ICONS, SupportedRoomTypeIcon, addForeignKeyIfMissing(), canonicalFeatureTags(), canonicalUnavailable(), HardenRoomContracts1784100000000 (+7 more)

### Community 113 - "Constraint UI Exports"
Cohesion: 0.16
Nodes (15): ConstraintData, ConstraintViolation, LessonMove, BaseModel, All constraint data needed for swap validation., Identifies a specific time slot in the timetable., Represents a constraint violation., Represents a lesson that needs to be moved as part of the swap. (+7 more)

### Community 114 - "Guidance Feature Exports"
Cohesion: 0.10
Nodes (19): arrowParens, bracketSpacing, embeddedLanguageFormatting, endOfLine, htmlWhitespaceSensitivity, insertPragma, jsxBracketSameLine, jsxSingleQuote (+11 more)

### Community 115 - "Logout Feature Exports"
Cohesion: 0.11
Nodes (18): aliases, components, hooks, lib, ui, utils, iconLibrary, registries (+10 more)

### Community 116 - "Delete Dialog Unit Test"
Cohesion: 0.24
Nodes (4): ParsedTimetable, TimetableInput, TimetableService, ServiceResult

### Community 118 - "Statistics Cards Unit Test"
Cohesion: 0.12
Nodes (12): apiRoot, assert, Database, { fork, spawn }, fs, os, path, resetEntry (+4 more)

### Community 119 - "Enhanced Generation Test"
Cohesion: 0.12
Nodes (10): MetricsExporter, Increment the gauge.                  Args:             amount: Amount to increm, Exports solver metrics in Prometheus format.          This class provides method, Initialize metrics exporter., Get singleton instance of MetricsExporter., Reset singleton instance (for testing)., Record constraint application.                  Args:             constraint_typ, Record solution quality score.                  Args:             score: Quality (+2 more)

### Community 120 - "Tailwind Configuration"
Cohesion: 0.18
Nodes (12): STRATEGY_COLORS, StrategyCard(), StrategyCardProps, StrategySelector(), StrategySelectorProps, GenerateInput, SolverStrategy, getAllStrategyConfigs() (+4 more)

### Community 121 - "Vite Configuration"
Cohesion: 0.21
Nodes (13): AppConfig, createApp(), CombinedLicenseStatus, determineCombinedStatus(), generateGuardMiddleware(), LICENSE_ROUTES, licenseMiddleware(), readOnlyMiddleware() (+5 more)

### Community 122 - "Vitest Configuration"
Cohesion: 0.14
Nodes (4): CleanupConfig, CleanupTask, FileCleanupService, TODO: Implement proper zip archive when needed

### Community 123 - "Frontend Setup Instructions"
Cohesion: 0.12
Nodes (16): 1. Install Dependencies, 2. Add Fonts (Optional but Recommended), 3. Generate Route Tree, 4. Start Building Features, Building for Production, Development Workflow, Frontend Setup Instructions, Next Steps (+8 more)

### Community 124 - "useConflictDetection.ts"
Cohesion: 0.16
Nodes (16): calculateWorkload(), ConflictDetectionOptions, ConflictDetectionResult, createCoverageConflict(), createDuplicateConflict(), createWorkloadConflict(), parseJsonArray(), NOTE: createIncompatibilityConflict removed - no longer used (+8 more)

### Community 125 - "useClassAssignments.ts"
Cohesion: 0.17
Nodes (15): ensureSubjectRequirements(), getRequiredPeriods(), parseJsonArray(), SubjectAssignmentSummary, useClassAssignments(), useClassAssignmentsQuery(), useTeacherAssignments(), ASSIGNMENT_INVALIDATION_KEYS (+7 more)

### Community 126 - "CategoryAccordion.tsx"
Cohesion: 0.14
Nodes (13): CategoryAccordion, CategorySection, CategorySectionProps, ClassItem, ClassItemProps, ClassTabNavigationProps, TeacherTab, TeacherTabProps (+5 more)

### Community 127 - "server.ts"
Cohesion: 0.26
Nodes (13): argumentValue(), hasArgument(), main(), ApiProcessMessage, bootstrap(), corsOrigins, notifyParent(), shutdown() (+5 more)

### Community 129 - "HardConstraint"
Cohesion: 0.15
Nodes (10): HardConstraint, Base class for hard constraints (must be satisfied)., ClassTeacherMinLessonConstraint, Any, CpModel, Check if this constraint should be applied., Register the class teacher constraint with the registry.          Args:, Ensures class teacher has at least one lesson per week for their class. (+2 more)

### Community 130 - "._make_label_key"
Cohesion: 0.15
Nodes (8): Set the gauge to a specific value.                  Args:             value: Val, Decrement the gauge.                  Args:             amount: Amount to decrem, Get current gauge value.                  Args:             **labels: Label valu, Get sum of all observations.                  Args:             **labels: Label, Get count of all observations.                  Args:             **labels: Labe, Get count for a specific bucket.                  Args:             bucket_le: B, Create a hashable key from labels., Create a hashable key from labels.

### Community 131 - "Maktab Web Frontend"
Cohesion: 0.12
Nodes (15): API Integration, Available Scripts, Building, Code Style, Development, Environment Variables, Getting Started, Installation (+7 more)

### Community 132 - "index.ts"
Cohesion: 0.17
Nodes (6): PlaceholderPage(), PlaceholderPageProps, Route, Route, Route, Route

### Community 133 - "DayOfWeek"
Cohesion: 0.22
Nodes (15): ApiConstraintViolation, ApiValidationResponse, createSwapValidationRequest(), fetchSwapValidation(), mapValidationResponse(), mapViolation(), normalizeConstraintType(), SolverSwapValidationResult (+7 more)

### Community 134 - "package.json"
Cohesion: 0.13
Nodes (14): author, dependencies, electron-squirrel-startup, node-machine-id, description, devDependencies, electron, keywords (+6 more)

### Community 135 - "assignment.routes.ts"
Cohesion: 0.18
Nodes (13): assignmentAllocationSchema, assignmentBatchChangeSchema, AssignmentBatchInput, assignmentBatchSchema, assignmentPrimaryCapabilityGrantSchema, AssignTeacherInput, assignTeacherSchema, classPeriodOverrideSchema (+5 more)

### Community 136 - "SwapValidator"
Cohesion: 0.22
Nodes (7): Any, Validate the complete simulated swap while resources follow lessons., Validates lesson swaps and finds minimal disruption solutions., Initialize validator with constraint data., Check whether a teacher is available at a given day/period., Build index for fast slot lookups., SwapValidator

### Community 137 - "ProgressReporter"
Cohesion: 0.17
Nodes (10): ProgressReporter, Enum, str, Report progress for a stage.          Calculates overall percentage from stage r, Report intermediate progress within the current stage.          Only emits an up, Stages of the timetable solving process.      Each stage represents a distinct p, Reports progress updates during timetable solving.      Emits JSON-formatted pro, Initialize the progress reporter.          Sets up timing information for progre (+2 more)

### Community 138 - "ScheduleList.tsx"
Cohesion: 0.23
Nodes (12): Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow (+4 more)

### Community 139 - "CodeChunker"
Cohesion: 0.20
Nodes (8): CodeChunker, Path, Detect the type of code based on path., Extract the main export name from content., Split content by code structure (functions, components, etc.)., Fallback: chunk by line count., Chunks TypeScript/React code intelligently., Chunk a single file into semantic pieces.

### Community 140 - "build"
Cohesion: 0.14
Nodes (14): build, appId, asarUnpack, directories, extraResources, files, nsis, productName (+6 more)

### Community 141 - "dependencies"
Cohesion: 0.14
Nodes (14): dependencies, axios, better-sqlite3, cors, exceljs, express, playwright, reflect-metadata (+6 more)

### Community 142 - "migrate-assignments.js"
Cohesion: 0.22
Nodes (13): args, colors, Database, dbPath, dryRun, fs, log(), migrateAssignments() (+5 more)

### Community 143 - "Context Indexer Cheat Sheet"
Cohesion: 0.15
Nodes (12): Advanced Options, Common Commands, Context Indexer Cheat Sheet, Index Stats, Indexing, Quick Searches, Real-World Examples, Search by Package (+4 more)

### Community 145 - "assignment.types.ts"
Cohesion: 0.15
Nodes (12): AffectedEntities, AssignmentAllocationInput, AssignmentStatus, AssignmentValidationRequest, AssignmentValidationResult, ClassCoverageDetail, ConflictSeverity, ConflictType (+4 more)

### Community 146 - "ConsecutiveConstraint"
Cohesion: 0.22
Nodes (8): ConsecutiveConstraint, Any, CpModel, Apply constraints for lessons of a subject on a specific day.                  A, Apply adjacency constraints when consecutive periods are enabled., Enforces consecutive period rules for subjects.          Afghanistan School Rule, Check if this constraint should be applied., Apply consecutive period constraints.                  Args:             model:

### Community 147 - "assignmentValidation.ts"
Cohesion: 0.24
Nodes (12): calculateTeacherCurrentWorkload(), canTeacherTeachSubject(), createClassAlreadyAssignedWarning(), createDuplicateAssignmentWarning(), createNearCapacityWarning(), createWorkloadExceededConflict(), getTeacherSubjectCompatibility(), parseJsonArray() (+4 more)

### Community 148 - "CodeEmbedder"
Cohesion: 0.18
Nodes (7): CodeEmbedder, Code embeddings using CodeBERT via sentence-transformers., Generate embeddings for code chunks., Initialize the embedder.          Args:             model_name: HuggingFace mode, Generate embeddings for a list of texts.          Args:             texts: List, Get the embedding dimension., ndarray

### Community 149 - "CodebaseIndex"
Cohesion: 0.21
Nodes (7): CodebaseIndex, Path, Query the index for relevant code chunks.          Args:             query_text:, Find all indexable files in directory., Get index statistics., Index and query a codebase using semantic embeddings., Index all code files in a directory.          Args:             directory: Path

### Community 150 - "1783900000000-RepairSchoolConfigFlow.ts"
Cohesion: 0.35
Nodes (9): DEFAULT_DAYS, normalizeAvailability(), normalizeDay(), normalizeDays(), normalizedJson(), normalizeUnavailable(), parseStructured(), RepairSchoolConfigFlow1783900000000 (+1 more)

### Community 152 - "assignmentConsistency.service.ts"
Cohesion: 0.23
Nodes (11): AssignmentConsistencyReport, assignmentKey(), AssignmentRow, auditAssignmentStorageConsistency(), CapabilityRow, ClassMirrorRow, compareSets(), parseArray() (+3 more)

### Community 153 - "Histogram"
Cohesion: 0.18
Nodes (7): Histogram, A histogram metric for tracking distributions.          Histograms track the dis, Initialize histogram.                  Args:             name: Metric name (e.g., Collect all metric values including buckets., Reset histogram (mainly for testing)., Get metrics in Prometheus text exposition format.                  Returns:, Reset all metrics (mainly for testing).

### Community 154 - "__init__.py"
Cohesion: 0.23
Nodes (8): Validate period configuration consistency.          Checks that:     - periodsPe, validate_period_configuration(), Validate that all subject references in class requirements exist.          Check, Validate custom subjects are properly configured.          Checks that:     - Cu, validate_custom_subjects(), validate_subject_references(), Validate teacher availability matches period configuration.          Checks that, validate_teacher_availability_structure()

### Community 155 - "subjectContracts.test.ts"
Cohesion: 0.24
Nodes (9): getVisibleSelectionState(), toggleVisibleSelection(), calculateSubjectStatistics(), GradeSubjectStatistics, hasConfiguredPeriods(), requiresSpecialRoom(), SectionSubjectStatistics, SubjectCoverageStat (+1 more)

### Community 156 - "FileRoutesByPath"
Cohesion: 0.17
Nodes (10): Route, Route, Route, Route, Route, Route, Route, Route (+2 more)

### Community 157 - "build-solver.js"
Cohesion: 0.17
Nodes (11): artifact, distPath, entrypoint, fs, path, result, root, solverRoot (+3 more)

### Community 158 - "ConstraintStage"
Cohesion: 0.18
Nodes (8): IntEnum, ConstraintStage, Any, CpModel, Apply all registered constraints for a given stage.                  Args:, Stages for constraint application.          Constraints are applied in order of, Get registered constraints, optionally filtered by stage.                  Args:, Register a constraint for automatic application.                  Args:

### Community 159 - "Files"
Cohesion: 0.18
Nodes (10): Benefits, Files, Generate Routes Module, `handlers.ts`, `index.ts`, Structure, `transformation.ts`, `types.ts` (+2 more)

### Community 161 - "StrategySelector"
Cohesion: 0.20
Nodes (7): Any, TimetableData, Selects the optimal solver strategy based on problem size.          Strategy sel, Initialize the strategy selector with timetable data.                  Args:, Count total lessons to schedule across all classes.                  Returns:, Select strategy and return metadata.                  Args:             user_str, StrategySelector

### Community 162 - "DataCompletionProgress.tsx"
Cohesion: 0.27
Nodes (10): calculateCompletionPercentage(), DataCompletionProgress(), DataCompletionProgressProps, getCompletedItemsText(), getCompletionStatusText(), getProgressColor(), OnboardingEmptyStateProps, ReadinessChecklistProps (+2 more)

### Community 163 - "ExportErrorBoundaryClass"
Cohesion: 0.24
Nodes (4): categorizeError(), ExportErrorBoundaryClass, ExportErrorBoundaryProps, logExportError()

### Community 164 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, concurrently, nodemon, ts-node, @types/better-sqlite3, @types/cors, @types/express, @types/node (+2 more)

### Community 165 - "Counter"
Cohesion: 0.20
Nodes (6): Counter, A counter metric that only increases.          Counters track cumulative values, Initialize counter.                  Args:             name: Metric name (e.g.,, Increment the counter.                  Args:             amount: Amount to incr, Get current counter value.                  Args:             **labels: Label va, Reset counter to zero (mainly for testing).

### Community 166 - "package.json"
Cohesion: 0.20
Nodes (9): author, description, keywords, license, main, name, scripts, build (+1 more)

### Community 167 - "TeacherConstraintTests"
Cohesion: 0.44
Nodes (3): payload(), solve(), TeacherConstraintTests

### Community 168 - "main"
Cohesion: 0.31
Nodes (8): format_as_markdown(), format_for_llm(), format_for_steering(), main(), Query the codebase for relevant context., Format results as markdown for pasting into chat., Format results as a steering-compatible context block., Format results optimized for LLM consumption - compact, structured, token-effici

### Community 169 - "package.json"
Cohesion: 0.22
Nodes (8): author, description, keywords, license, main, name, type, version

### Community 170 - "download-fonts.js"
Cohesion: 0.25
Nodes (7): extractFont(), FONTS_DIR, fs, https, main(), path, TEMP_ZIP

### Community 171 - "1783800000000-ReconcileDatabaseIntegrity.ts"
Cohesion: 0.31
Nodes (6): addChecks(), addForeignKeys(), assertValidExistingData(), IntegrityRule, integrityRules, ReconcileDatabaseIntegrity1783800000000

### Community 172 - "scheduleTiming.service.ts"
Cohesion: 0.33
Nodes (8): buildScheduleTiming(), enrichGeneratedScheduleTiming(), formatMinutes(), periodsForDay(), PeriodTimeRange, ScheduleBreakInterval, ScheduleTimingMetadata, toMinutes()

### Community 174 - "SameDayConstraint"
Cohesion: 0.25
Nodes (6): Any, CpModel, Ensures multi-period lessons don't span multiple days.          When a lesson re, Add same-day constraints for multi-period lessons.                  Args:, Check if this constraint should be applied.                  Only applies if the, SameDayConstraint

### Community 175 - "SwapRequest"
Cohesion: 0.36
Nodes (5): Request to swap two lessons in the timetable., SwapRequest, main(), Entry point for swap solver.     Reads JSON from stdin, writes result to stdout., SwapRoomContractTests

### Community 176 - "RoomSolverConstraintTests"
Cohesion: 0.47
Nodes (3): build_solver_payload(), RoomSolverConstraintTests, solve()

### Community 177 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, dev, lint, preview, test, test:e2e, test:unit (+1 more)

### Community 178 - "subjectColors.ts"
Cohesion: 0.31
Nodes (8): AUTO_COLOR_BASE, deriveColors(), getSubjectBaseColor(), getSubjectColors(), hashString(), HSL, SUBJECT_BASE_COLORS, SubjectColors

### Community 179 - "compilerOptions"
Cohesion: 0.22
Nodes (8): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, strict, include

### Community 180 - "CodeChunk"
Cohesion: 0.29
Nodes (4): CodeChunk, Smart code chunking for the Maktab web package. Chunks by: React components, hoo, A chunk of code with metadata., Main indexing logic - combines chunking, embedding, and ChromaDB storage.

### Community 181 - "Gauge"
Cohesion: 0.25
Nodes (5): Gauge, A gauge metric that can go up and down.          Gauges track values that can in, Initialize gauge.                  Args:             name: Metric name (e.g., 's, Create a hashable key from labels., Reset gauge to zero (mainly for testing).

### Community 182 - "DataGrid.tsx"
Cohesion: 0.29
Nodes (5): DataGrid(), DataGridProps, DataGridRow, EditableCell(), MOCK_CLASSES

### Community 183 - "api.ts"
Cohesion: 0.39
Nodes (6): ApiError, ApiErrorPayload, extractApiErrorMessage(), fetchAPI(), formatValidationDetails(), getMachineId()

### Community 184 - "apiParsers.ts"
Cohesion: 0.36
Nodes (6): ClassAssignment, parseClassAssignments(), parseJsonArray(), parseNumberArray(), parseSubjectRequirements(), SubjectRequirement

### Community 185 - "1730000000000-BaselineSchema.ts"
Cohesion: 0.29
Nodes (4): BaselineSchema1730000000000, indexes, TableDefinition, tables

### Community 186 - "1784200000000-HardenSubjectIdentity.ts"
Cohesion: 0.38
Nodes (4): canonicalFeatureTags(), describeDuplicates(), DuplicateSubjectIdentity, HardenSubjectIdentity1784200000000

### Community 187 - "create_worker_from_config"
Cohesion: 0.29
Nodes (5): create_worker_from_config(), Any, Get the current queue length., Perform health check on the worker.                  Returns:             Health, Create a SolverWorker from configuration.          Args:         redis_url: Redi

### Community 188 - "prometheus.py"
Cohesion: 0.33
Nodes (5): Metrics export module for solver monitoring., MetricType, Enum, Prometheus metrics export for solver monitoring.  This module provides metrics c, Types of metrics supported.

### Community 189 - "Timer"
Cohesion: 0.29
Nodes (3): Context manager for timing operations.          Usage:         with Timer() as t, Get elapsed time in seconds., Timer

### Community 191 - "periods.tsx"
Cohesion: 0.29
Nodes (4): ErrorBoundary, Route, Route, Route

### Community 193 - "package-electron.js"
Cohesion: 0.29
Nodes (6): electronBuilderCli, fs, nativeModulePath, path, projectRoot, { spawnSync }

### Community 195 - "generatedTimetableValidation.service.ts"
Cohesion: 0.47
Nodes (5): GeneratedTimetableValidationIssue, slotKey(), tupleKey(), validateGeneratedTimetable(), SolverInput

### Community 196 - "swap-export.contract.test.js"
Cohesion: 0.33
Nodes (5): { applyLessonMovesToPayload }, assert, displaySettings, { exportRequestSchema }, test

### Community 197 - "MetricValue"
Cohesion: 0.33
Nodes (4): MetricValue, Collect all metric values., Represents a metric value with optional labels., Collect all metric values.

### Community 199 - "main.tsx"
Cohesion: 0.33
Nodes (5): Register, root, router, @tanstack/react-router, routeTree

### Community 200 - "Q: Review how the codebase is connected, focusing on packages/web and executable code rather than Markdown."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Review how the codebase is connected, focusing on packages/web and executable code rather than Markdown., Source Nodes

### Community 201 - "Q: Implement the plan."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Implement the plan., Source Nodes

### Community 202 - "Q: Have a deep code review of subjects feature and find out all bugs,inconsistency, wrong implementation, wrong code flow between ui-->backend-->database and more other layers. and their relation with other features. then build a report for me, over all to fix. FOR NOW DO NOT CHANGE CODE."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Have a deep code review of subjects feature and find out all bugs,inconsistency, wrong implementation, wrong code flow between ui-->backend-->database and more other layers. and their relation with other features. then build a report for me, over all to fix. FOR NOW DO NOT CHANGE CODE., Source Nodes

### Community 203 - "Q: Have a deep code review of subjects feature and find out all bugs,inconsistency, wrong implementation, wrong code flow between ui-->backend-->database and more other layers. and their relation with other features. then build a report for me, over all to fix. FOR NOW DO NOT CHANGE CODE."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Have a deep code review of subjects feature and find out all bugs,inconsistency, wrong implementation, wrong code flow between ui-->backend-->database and more other layers. and their relation with other features. then build a report for me, over all to fix. FOR NOW DO NOT CHANGE CODE., Source Nodes

### Community 204 - "Q: fix all the problems, that you have found. phase by phase. do the testing at the very end."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: fix all the problems, that you have found. phase by phase. do the testing at the very end., Source Nodes

### Community 205 - "Q: Have a deep code review focused on packages/web/src/features/teachers and report UI, API, backend, database, and integration bugs without fixing code"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Have a deep code review focused on packages/web/src/features/teachers and report UI, API, backend, database, and integration bugs without fixing code, Source Nodes

### Community 206 - "Q: Implement the plan."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Implement the plan., Source Nodes

### Community 207 - "Q: Deep end-to-end review of packages/web/src/features/assignments and packages/web/src/features/teacher-assignments across UI, API, backend, database, and solver integrations"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Deep end-to-end review of packages/web/src/features/assignments and packages/web/src/features/teacher-assignments across UI, API, backend, database, and solver integrations, Source Nodes

### Community 208 - "Q: Resolve the five assignment domain decisions from the Afghanistan school production description"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Resolve the five assignment domain decisions from the Afghanistan school production description, Source Nodes

### Community 209 - "Q: Implement the assignment remediation plan from ASSIGNMENTS_FEATURE_CODE_REVIEW.md using the resolved Afghanistan school rules"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Implement the assignment remediation plan from ASSIGNMENTS_FEATURE_CODE_REVIEW.md using the resolved Afghanistan school rules, Source Nodes

### Community 210 - "Q: Should the Maktab repository upgrade from TypeScript 5.9 to TypeScript 7.0, and how should its deprecated baseUrl option be handled?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Should the Maktab repository upgrade from TypeScript 5.9 to TypeScript 7.0, and how should its deprecated baseUrl option be handled?, Source Nodes

### Community 211 - "Q: Implement the plan."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Implement the plan., Source Nodes

### Community 212 - "Q: Why does teacher bulk import return maxPeriodsPerWeek cannot exceed the school calendar (32)?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Why does teacher bulk import return maxPeriodsPerWeek cannot exceed the school calendar (32)?, Source Nodes

### Community 213 - "Q: so then solve it please"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: so then solve it please, Source Nodes

### Community 214 - "Q: Why do manually added subjects appear on the Subjects screen but not in teachers, classes, or assignments after applying the lesson plan?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Why do manually added subjects appear on the Subjects screen but not in teachers, classes, or assignments after applying the lesson plan?, Source Nodes

### Community 215 - "Q: Why do manually added subjects appear on the Subjects screen but not in teachers, classes, or assignments after applying the lesson plan?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Why do manually added subjects appear on the Subjects screen but not in teachers, classes, or assignments after applying the lesson plan?, Source Nodes

### Community 216 - "Q: so to fix the problem, lets delete the whole database data(they were just draft data to test) and fix the problems of api and synchronization problems."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: so to fix the problem, lets delete the whole database data(they were just draft data to test) and fix the problems of api and synchronization problems., Source Nodes

### Community 217 - "Q: Why does the app freeze after curriculum subject sync or teacher bulk import even though data is saved?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Why does the app freeze after curriculum subject sync or teacher bulk import even though data is saved?, Source Nodes

### Community 218 - "Q: AssignmentDrawerV2 opened from ClassAssignmentRow does not show the teacher list; show all teachers"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: AssignmentDrawerV2 opened from ClassAssignmentRow does not show the teacher list; show all teachers, Source Nodes

### Community 219 - "Q: Why can Ahmad not be assigned subject 44 to two classes although the UI shows spare workload and he can teach it?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Why can Ahmad not be assigned subject 44 to two classes although the UI shows spare workload and he can teach it?, Source Nodes

### Community 220 - "Q: Implement the plan."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Implement the plan., Source Nodes

### Community 221 - "Q: Here one UI UX problem, exists, in the the assignement drawer , the teachers list is not visible correctly. modify the design layout of this drawer to focus more on teachers list and assignening instead of just labels and stats.."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Here one UI UX problem, exists, in the the assignement drawer , the teachers list is not visible correctly. modify the design layout of this drawer to focus more on teachers list and assignening instead of just labels and stats.., Source Nodes

### Community 222 - "Q: When assigning teachers from subject, class, or assignment drawer, the API rejects teachers whose subject is not primary or allowed. What is the best UX and domain-policy fix?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: When assigning teachers from subject, class, or assignment drawer, the API rejects teachers whose subject is not primary or allowed. What is the best UX and domain-policy fix?, Source Nodes

### Community 223 - "Q: Implement an atomic Add as Primary and assign flow for headteachers across subject, class, and assignment drawer, with workload and availability conflict rollback and no allowed behavior outside teacher editing."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Implement an atomic Add as Primary and assign flow for headteachers across subject, class, and assignment drawer, with workload and availability conflict rollback and no allowed behavior outside teacher editing., Source Nodes

### Community 224 - "Q: Implement the prioritized teacher assignment opportunity view and confirmed override flow in TeacherEditDrawer subjects/classes tab."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Implement the prioritized teacher assignment opportunity view and confirmed override flow in TeacherEditDrawer subjects/classes tab., Source Nodes

### Community 225 - "Q: Analyze whether the database and backend support grade-wide subject periods with rare class-specific exceptions, then plan the UI changes."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Analyze whether the database and backend support grade-wide subject periods with rare class-specific exceptions, then plan the UI changes., Source Nodes

### Community 226 - "Q: ok so implement the plan"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: ok so implement the plan, Source Nodes

### Community 227 - "Q: Here, can you update all UI components that they show the periods of subjects-class??? because the UI is yet do not working  correctly. the subject-class periods must be changeable from this components also packages/web/src/features/teachers/components/SubjectAssignmentManager.tsx packages/web/src/features/classes/components/ClassEditDrawer.tsx  and other UI parts must render or must show the real changes of periods. what do you think of???"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Here, can you update all UI components that they show the periods of subjects-class??? because the UI is yet do not working  correctly. the subject-class periods must be changeable from this components also packages/web/src/features/teachers/components/SubjectAssignmentManager.tsx packages/web/src/features/classes/components/ClassEditDrawer.tsx  and other UI parts must render or must show the real changes of periods. what do you think of???, Source Nodes

### Community 228 - "Q: http://localhost:5173/classes-schedule http://localhost:5173/teachers-schedule when accessing to these from browser it dont works correctly???"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: http://localhost:5173/classes-schedule http://localhost:5173/teachers-schedule when accessing to these from browser it dont works correctly???, Source Nodes

### Community 229 - "Q: Deep review and fix swaps, exports, and the Python solver; find bugs, wrong implementations, and improvements"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Deep review and fix swaps, exports, and the Python solver; find bugs, wrong implementations, and improvements, Source Nodes

### Community 230 - "Q: How should manually created subjects replace a ministry subject and be assigned to existing classes without refreshing the whole curriculum?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: How should manually created subjects replace a ministry subject and be assigned to existing classes without refreshing the whole curriculum?, Source Nodes

### Community 231 - "Q: If we implement flow 3, where should we place the School Curriculum feature for consistency and better UX?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: If we implement flow 3, where should we place the School Curriculum feature for consistency and better UX?, Source Nodes

### Community 232 - "Q: Should the School Curriculum page use School Settings and Period Structure as dynamic inputs, and smartly create subjects and classes when applying?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Should the School Curriculum page use School Settings and Period Structure as dynamic inputs, and smartly create subjects and classes when applying?, Source Nodes

### Community 233 - "Q: Implement the School Curriculum plan as a dynamic school-owned source of truth using School Settings and Period Structure, with reviewed subject/class materialization."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Implement the School Curriculum plan as a dynamic school-owned source of truth using School Settings and Period Structure, with reviewed subject/class materialization., Source Nodes

### Community 234 - "index_package"
Cohesion: 0.50
Nodes (4): index_package(), main(), Index a single package and return stats., Index the Maktab codebase for semantic search.

### Community 235 - "Maktab database console"
Cohesion: 0.40
Nodes (4): Common commands, Destructive commands, Maktab database console, SQL shell commands

### Community 236 - "timetable.persistence.test.js"
Cohesion: 0.40
Nodes (3): assert, test, {
  validateGeneratedTimetable,
}

### Community 237 - "package.json"
Cohesion: 0.40
Nodes (4): description, name, type, version

### Community 238 - "generate-license.js"
Cohesion: 0.67
Nodes (3): crypto, generateLicenseKey(), main()

## Knowledge Gaps
- **1268 isolated node(s):** `semi`, `trailingComma`, `singleQuote`, `printWidth`, `tabWidth` (+1263 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **22 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Work-memory lessons

**Preferred sources** — corroborated by past sessions; start here.
- `TeacherSelectionList.tsx` (4× useful, score=3.718647812)
- `useAssignmentMutations.ts` (4× useful, score=3.68345937)
- `PeriodStructurePage.tsx` (3× useful, score=2.92831688)
- `BulkClassDialog.tsx` (2× useful, score=1.998800978)
- `SubjectsPage.tsx` (2× useful, score=1.998670501)
- `SubjectRequirementsEditor.tsx` (2× useful, score=1.930569056)
- `AssignmentsPage.tsx` (2× useful, score=1.820880461)
- `swapValidation.ts` (2× useful, score=1.801605462)
- `TeacherBulkImportDialog()` (2× useful, score=1.790588684)
- `calculateMaxPeriodsPerWeek()` (2× useful, score=1.790588684) _(code changed — re-verify)_

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Constraint Management` to `Schedule Types Tests`, `Schedule Grid Cells`, `ScheduleList.tsx`, `Solver Results Dashboard`, `Data Lists Utilities`, `Assignment Shared Models`, `Schedule Swap Grid`, `Teacher Bulk Import`, `Workload Conflict Services`, `Core School Models`, `Settings Cards Controls`, `Schedule Swap State`, `Assignment Serialization Utilities`, `Schedule Query Hooks`, `Solver Generation Status`, `Period Defaults Matrix`, `DataCompletionProgress.tsx`, `Teacher Page Data`, `Keyboard Schedule Navigation`, `Optimized Assignment Calculations`, `Teacher API Serialization`, `DataGrid.tsx`, `Search Selection Controls`, `Room Filtering`, `Subject Form Utilities`, `Room Data Grid`, `Subject Color Generation`, `Tailwind Configuration`, `CategoryAccordion.tsx`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **Why does `Column` connect `Schedule Transformation Storage` to `Assignment Data Hooks`, `Dashboard Route`, `Entity Editing Forms`, `Layout Licensing Generation`, `Unsaved Changes Tests`, `Sidebar Navigation Tests`, `Assignment Coverage Projections`, `DataGrid.tsx`, `Assignment Requirement Validation`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Why does `Logger` connect `Schedule Transformation Storage` to `Assignment Data Hooks`, `Assignment Page UI`, `Display Settings Hook`, `Layout Licensing Generation`, `assignment.routes.ts`, `Assignment Conflict Hook`, `Schedule Constraint Validation`, `Sidebar Navigation Tests`, `Data Lists Utilities`, `Assignment Workflow Hooks`, `Schedule Drag Selection`, `Assignment Error Conflicts`, `Vite Configuration`, `Readiness Validation`, `server.ts`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **What connects `semi`, `trailingComma`, `singleQuote` to the rest of the system?**
  _1755 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Constraint Management` be split into smaller, more focused modules?**
  _Cohesion score 0.03510716925351072 - nodes in this community are weakly interconnected._
- **Should `Assignment Data Hooks` be split into smaller, more focused modules?**
  _Cohesion score 0.03137254901960784 - nodes in this community are weakly interconnected._
- **Should `Assignment Page UI` be split into smaller, more focused modules?**
  _Cohesion score 0.03195135433941404 - nodes in this community are weakly interconnected._