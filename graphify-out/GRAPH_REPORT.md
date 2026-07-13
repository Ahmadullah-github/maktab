# Graph Report - packages/web  (2026-07-12)

## Corpus Check
- Large corpus: 587 files · ~374,508 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 3221 nodes · 10017 edges · 123 communities (115 shown, 8 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 48 edges (avg confidence: 0.54)
- Token cost: 0 input · 0 output

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
- Sidebar Navigation Tests
- Delete Dialog Tests
- Test Environment Setup
- Statistics Card Tests
- Index Route

## God Nodes (most connected - your core abstractions)
1. `cn()` - 353 edges
2. `Button` - 98 edges
3. `Teacher` - 85 edges
4. `Badge` - 74 edges
5. `DayOfWeek` - 70 edges
6. `Subject` - 70 edges
7. `ClassGroup` - 60 edges
8. `ScheduledLesson` - 58 edges
9. `useScheduleStore` - 53 edges
10. `AssignmentConflict` - 47 edges

## Surprising Connections (you probably didn't know these)
- `generateExcelTemplate()` --references--> `xlsx`  [EXTRACTED]
  src/features/teachers/hooks/useBulkImportTeachers.ts → package.json
- `parseExcelFile()` --references--> `xlsx`  [EXTRACTED]
  src/features/teachers/hooks/useBulkImportTeachers.ts → package.json
- `CommandShortcut()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/command.tsx → src/lib/utils.ts
- `DropdownMenuShortcut()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/dropdown-menu.tsx → src/lib/utils.ts
- `SheetFooter()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/sheet.tsx → src/lib/utils.ts

## Import Cycles
- None detected.

## Communities (123 total, 8 thin omitted)

### Community 0 - "Constraint Management"
Cohesion: 0.06
Nodes (77): Alert, AlertDescription, AlertTitle, alertVariants, fetchPreferences(), savePreferences(), ConstraintRanking(), ConstraintRankingProps (+69 more)

### Community 1 - "Assignment Data Hooks"
Cohesion: 0.06
Nodes (69): AssignmentDrawer(), calculateTeacherWorkloadFromAssignments(), getInitials(), TeacherList(), TeacherListProps, TeacherOption, assignmentsApi, buildClassPeriodMap() (+61 more)

### Community 2 - "Assignment Page UI"
Cohesion: 0.05
Nodes (65): AssignmentCell(), getInitials(), AssignmentDrawerProps, AssignmentContextBar(), AssignmentDrawerV2(), AssignmentDrawerV2Props, getInitials(), AssignmentProgress() (+57 more)

### Community 3 - "Entity Editing Forms"
Cohesion: 0.07
Nodes (57): FormControl, FormDescription, FormField(), FormFieldContext, FormFieldContextValue, FormItem, FormItemContext, FormItemContextValue (+49 more)

### Community 4 - "Shared UI Primitives"
Cohesion: 0.08
Nodes (47): Badge, BadgeProps, badgeVariants, Button, Checkbox, Progress, SelectContent, SelectItem (+39 more)

### Community 5 - "Schedule Types Tests"
Cohesion: 0.05
Nodes (53): PresetButtonsProps, CELL_SIZE_OPTIONS, FONT_SIZE_OPTIONS, SizeSelectorProps, CELL_SIZE_MAP, CONSTRAINT_TYPES, ConstraintSeverity, DAYS_OF_WEEK (+45 more)

### Community 6 - "Schedule Transformation Storage"
Cohesion: 0.05
Nodes (48): ScheduleApiResult, useAutoSave(), updateScheduleLessons(), UpdateScheduleLessonsInput, useSaveScheduleChanges(), UseSaveScheduleChangesReturn, classMetadataArb, dayOfWeekArb (+40 more)

### Community 7 - "Layout Licensing Generation"
Cohesion: 0.05
Nodes (51): Header(), MainLayout(), TabBar(), LicenseBanner(), DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel (+43 more)

### Community 8 - "Schedule Grid Cells"
Cohesion: 0.05
Nodes (43): DroppableCell, DroppableCellProps, isValidDropSource(), FocusIndicator, FocusIndicatorProps, IndicatorPosition, ScheduleCell, SwapBlockedDialogProps (+35 more)

### Community 9 - "Schedule State Store"
Cohesion: 0.07
Nodes (41): UndoRedoButtons(), DEFAULT_DISPLAY_SETTINGS, fetchSwapConstraintContext(), useSwapConstraintContext(), useSwapExecution(), useUndoRedo(), UseUndoRedoReturn, useUnsavedChanges() (+33 more)

### Community 10 - "Schedule Constraint Validation"
Cohesion: 0.08
Nodes (47): SWAP_CONSTRAINT_TYPES, availabilityArrayArb, dayOfWeekArb, fullAvailabilityArb, idArb, periodArb, roomConstraintDataArb, scheduledLessonArb (+39 more)

### Community 11 - "Solver Results Dashboard"
Cohesion: 0.06
Nodes (47): CATEGORY_ORDER, ErrorDisplay(), ErrorDisplayProps, CATEGORY_COLORS, CATEGORY_ICONS, ErrorGroup(), ErrorGroupProps, ENTITY_TYPE_LABELS (+39 more)

### Community 12 - "Data Lists Utilities"
Cohesion: 0.06
Nodes (41): Avatar, AvatarFallback, AvatarImage, ButtonProps, Column, DataGrid(), DataGridProps, EditableCell() (+33 more)

### Community 13 - "Assignment Shared Models"
Cohesion: 0.07
Nodes (39): AssignmentStatusBadge(), AssignmentStatusBadgeProps, STATUS_CONFIG, ClassSelector(), ClassSelectorProps, groupClassesByGrade(), COMPATIBILITY_CONFIG, CompatibilityBadge() (+31 more)

### Community 14 - "Assignment Workflow Hooks"
Cohesion: 0.07
Nodes (43): BulkOperationResult, BulkOperationStatus, VirtualizedAssignmentMatrixProps, UseAssignmentMutationsResult, AssignmentSyncState, calculateClassStatus(), calculateSubjectStatus(), calculateTeacherStatus() (+35 more)

### Community 15 - "Schedule Swap Grid"
Cohesion: 0.09
Nodes (41): MultiLessonCell, MultiLessonCellProps, DEFAULT_DAYS, LessonPickerState, ResolvedSwapStatus, ScheduleGrid(), SwapReviewStatus, SwapLessonPickerOption (+33 more)

### Community 16 - "Teacher Bulk Import"
Cohesion: 0.09
Nodes (38): xlsx, ScrollArea, SheetContent, SheetContentProps, SheetDescription, SheetFooter(), SheetHeader(), SheetOverlay (+30 more)

### Community 17 - "Workload Conflict Services"
Cohesion: 0.09
Nodes (41): useRealtimeWorkload(), UseRealtimeWorkloadResult, getBestResolution(), getResolutionsForConflict(), hasAutoApplicableResolution(), ResolutionActionType, ResolutionResult, ResolutionSuggestion (+33 more)

### Community 18 - "Schedule Dashboard"
Cohesion: 0.08
Nodes (36): DashboardErrorState(), DashboardErrorStateProps, getErrorMessage(), DashboardSkeleton(), DashboardSkeletonProps, GenerationHubSkeleton(), HistorySectionSkeleton(), ReadinessChecklistSkeleton() (+28 more)

### Community 19 - "Core School Models"
Cohesion: 0.09
Nodes (25): AssignmentCellProps, BulkAssignmentPreviewProps, UseUnifiedAssignmentResult, ConflictResolutionService, DataLookups, EnhancedClassAssignment, EnhancedSubjectRequirement, applyBidirectionalAssignment() (+17 more)

### Community 20 - "Schedule Drag Selection"
Cohesion: 0.08
Nodes (35): DraggableCell, DraggableCellProps, isEscapeKey(), isSelectionKey(), useCellSelection(), UseCellSelectionOptions, UseCellSelectionReturn, createCellId() (+27 more)

### Community 21 - "Settings Cards Controls"
Cohesion: 0.10
Nodes (29): ErrorBoundaryState, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, DirectionalText() (+21 more)

### Community 22 - "Assignment Coverage Projections"
Cohesion: 0.07
Nodes (37): GroupedCells, AssignmentMatrixClassView, AssignmentMatrixView, ClassAssignmentView, getProjectionCoverageStatus(), ProjectionCapabilityLevel, ProjectionRequirementView, ProjectionWarningSummary (+29 more)

### Community 23 - "Assignment Error Conflicts"
Cohesion: 0.09
Nodes (28): calculateRetryDelay(), DEFAULT_RETRY_CONFIG, ErrorState, INITIAL_ERROR_STATE, isRetryableError(), mapErrorToCode(), RetryConfig, sleep() (+20 more)

### Community 24 - "Schedule Views Navigation"
Cohesion: 0.07
Nodes (33): CategoryAccordion, CategorySection, CategorySectionProps, ClassItem, ClassItemProps, ClassTabProps, TeacherTab, TeacherTabProps (+25 more)

### Community 25 - "Runtime Dependencies"
Cohesion: 0.05
Nodes (43): dependencies, autoprefixer, class-variance-authority, clsx, cmdk, @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities (+35 more)

### Community 26 - "Solver Strategy Selection"
Cohesion: 0.07
Nodes (29): GenerationProgress(), GenerationProgressProps, STRATEGY_COLORS, StrategyCard(), StrategyCardProps, StrategySelector(), StrategySelectorProps, GenerateInput (+21 more)

### Community 27 - "Schedule Swap State"
Cohesion: 0.07
Nodes (31): ApiConstraintViolation, ApiValidationResponse, createSwapValidationRequest(), fetchSwapValidation(), mapValidationResponse(), mapViolation(), normalizeConstraintType(), SolverSwapValidationResult (+23 more)

### Community 28 - "Assignment Requirement Validation"
Cohesion: 0.09
Nodes (36): ClassGroupParsed, ClassGroupRaw, calculateTeacherCurrentWorkload(), createClassAlreadyAssignedWarning(), createDuplicateAssignmentWarning(), createNearCapacityWarning(), createWorkloadExceededConflict(), getCompatibleTeachersForSubject() (+28 more)

### Community 29 - "Assignment Serialization Utilities"
Cohesion: 0.11
Nodes (36): calculateAssignmentPeriods(), deserializeClassAssignments(), deserializeEnhancedClassAssignments(), deserializeEnhancedSubjectRequirements(), deserializeSubjectRequirements(), determineAssignmentStatus(), enhanceClassAssignment(), enhanceSubjectRequirement() (+28 more)

### Community 30 - "Schedule Query Hooks"
Cohesion: 0.09
Nodes (29): SaveScheduleInput, SCHEDULE_QUERY_KEYS, EnhancedGenerationError, useKeyboardShortcuts(), UseKeyboardShortcutsOptions, PeriodsConfiguration, useDeleteSchedule(), useSaveSchedule() (+21 more)

### Community 31 - "Readiness Validation"
Cohesion: 0.09
Nodes (29): DataCompletionProgressProps, ReadinessChecklist(), ReadinessChecklistProps, ScheduleDashboard(), determineEmptyStateType(), EmptyStateType, useEmptyStateLogic(), UseEmptyStateLogicReturn (+21 more)

### Community 32 - "Solver Generation Status"
Cohesion: 0.11
Nodes (35): GenerationHubProps, ApiError, buildErrorFromLastRun(), buildLastRunSignature(), buildSyntheticError(), buildTerminalStatus(), ERROR_MESSAGES, ERROR_SUGGESTIONS (+27 more)

### Community 33 - "Teacher Subject Availability"
Cohesion: 0.10
Nodes (31): AssignmentBadgesCellProps, AvailabilityMatrix(), AvailabilityMatrixProps, getMaxPeriods(), getPeriodsForDay(), isSlotUnavailable(), toggleSlot(), QuickAssignmentFormProps (+23 more)

### Community 34 - "Period Defaults Matrix"
Cohesion: 0.14
Nodes (17): CategoryPeriodsMatrix(), CategoryPeriodsMatrixProps, DynamicPeriodsConfig(), DynamicPeriodsConfigProps, GRADE_CATEGORIES, GradeCategoryKey, PERIOD_LIMITS, CategoryPeriodsMap (+9 more)

### Community 35 - "Teacher Forms Validation"
Cohesion: 0.10
Nodes (28): createTeacherFormSchemaWithConfig(), getDefaultConstraints(), getDefaultValues(), TeacherForm(), TeacherFormProps, getDefaultValues(), TeacherFormDrawer(), TeacherFormDrawerProps (+20 more)

### Community 36 - "Curriculum Schedule Lists"
Cohesion: 0.11
Nodes (27): Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow (+19 more)

### Community 37 - "Teacher Page Data"
Cohesion: 0.11
Nodes (27): usePeriodStructure(), TeacherBulkImportDialog(), EditTab, getDefaultValues(), TeacherEditDrawer(), TeacherFiltersProps, TeachersPage(), TeachersPageProps (+19 more)

### Community 38 - "Unified Assignments Data"
Cohesion: 0.10
Nodes (29): determineWorkloadStatus(), getRequirementStatus(), getTeacherCompatibilityFromProjection(), groupWorkloadBreakdown(), useUnifiedAssignment(), useWorkloadImpact(), useTeacherWorkloadView(), AddTeacherPopover() (+21 more)

### Community 39 - "Data Grids Dialogs"
Cohesion: 0.17
Nodes (23): AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay, AlertDialogTitle (+15 more)

### Community 40 - "Period Structure Schema"
Cohesion: 0.11
Nodes (25): DefaultPeriodsInput(), DefaultPeriodsInputProps, PeriodDurationInput(), PeriodDurationInputProps, PrayerBreaksConfig(), PrayerBreaksConfigProps, ALL_GRADES, BREAK_DURATION_LIMITS (+17 more)

### Community 41 - "Assignment Cache Management"
Cohesion: 0.14
Nodes (10): ASSIGNMENT_QUERY_KEYS, AssignmentCacheManager, CACHE_GC_TIMES, CACHE_STALE_TIMES, createAssignmentCacheManager(), ensureSubjectRequirements(), parseJsonArray(), SubjectCoverage (+2 more)

### Community 42 - "Class Categories Statistics"
Cohesion: 0.11
Nodes (22): ClassFiltersProps, calculateStats(), ClassStatsCard(), ClassStatsCardProps, getCategoryLabel(), GradeBadge(), GradeBadgeProps, Room (+14 more)

### Community 43 - "Schedule View Routing"
Cohesion: 0.14
Nodes (23): scheduleApi, ClassScheduleView, EmptyScheduleState, mockUseScheduleStore, mockUseScheduleView, DEFAULT_PREFERENCE, findLatestScheduleId(), getScheduleSelectionPreference() (+15 more)

### Community 44 - "Sidebar Readiness Tooltips"
Cohesion: 0.11
Nodes (19): Sidebar(), SidebarItemType, SidebarNavItem, SidebarSection, TooltipContent, ICON_MAP, ReadinessItem(), STATUS_CONFIG (+11 more)

### Community 45 - "Subject Page Data"
Cohesion: 0.14
Nodes (25): subjectsApi, CurriculumDialogMode, CurriculumDialogProps, SubjectCoverageCellProps, SubjectEditDrawerProps, SubjectFilters(), SubjectFormDrawer(), SubjectFormDrawerProps (+17 more)

### Community 46 - "TypeScript Configuration"
Cohesion: 0.06
Nodes (30): compilerOptions, allowImportingTsExtensions, baseUrl, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module (+22 more)

### Community 47 - "School Settings API"
Cohesion: 0.10
Nodes (24): fetchPeriodStructure(), periodStructureApi, updatePeriodStructure(), PERIOD_STRUCTURE_QUERY_KEY, fromPeriodStructureApiResponse(), PeriodStructureFormValues, safeParseJson(), toPeriodStructureApiPayload() (+16 more)

### Community 48 - "Shared Error Routing"
Cohesion: 0.09
Nodes (12): ErrorBoundary, ErrorBoundaryClass, ErrorBoundaryProps, PlaceholderPage(), PlaceholderPageProps, PLACEHOLDER_PAGE_CONFIGS, SIDEBAR_TRANSLATION_KEYS, Route (+4 more)

### Community 49 - "Period Break Configuration"
Cohesion: 0.17
Nodes (21): SectionCard(), BreakConfiguration(), BreakConfigurationProps, BreakEditorTarget, getNextAvailableBreakPeriod(), calculateStats(), PeriodStats, PeriodStructurePage() (+13 more)

### Community 50 - "Teacher Compatibility Selection"
Cohesion: 0.14
Nodes (25): SmartTeacherDropdown(), TeacherWithProjection, getCompatibilityLevel(), parseJsonArray(), summarizeAssignments(), useSmartTeacherSelection(), UseSmartTeacherSelectionOptions, UseSmartTeacherSelectionResult (+17 more)

### Community 51 - "Keyboard Schedule Navigation"
Cohesion: 0.12
Nodes (22): useKeyboardNavigation(), UseKeyboardNavigationOptions, UseKeyboardNavigationReturn, computeInitialFocus(), dayOfWeekArb, daysArrayArb, focusedSlotArb, GRID_DAYS (+14 more)

### Community 52 - "Optimized Assignment Calculations"
Cohesion: 0.15
Nodes (19): buildDataLookups(), calculateCompatibilityOptimized(), calculateCoveragesBatch(), calculateWorkloadOptimized(), calculateWorkloadsBatch(), calculateWorkloadStatus(), canAcceptMoreAssignments(), clearCalculationCaches() (+11 more)

### Community 53 - "Teacher API Serialization"
Cohesion: 0.20
Nodes (20): deserializeTeacher(), serializeTeacherForApi(), UnavailableSlot, apiLogger, componentLogger, LogContext, logger, LogLevel (+12 more)

### Community 54 - "ESLint Configuration"
Cohesion: 0.08
Nodes (24): jsx, env, browser, es2020, extends, ignorePatterns, parser, parserOptions (+16 more)

### Community 55 - "Application Bootstrap I18n"
Cohesion: 0.11
Nodes (14): assignmentsTranslations, classesTranslations, constraintsTranslations, periodStructureTranslations, roomsTranslations, scheduleTranslations, schoolSettingsTranslations, subjectsTranslations (+6 more)

### Community 56 - "Room Data Access"
Cohesion: 0.16
Nodes (18): roomsApi, RoomEditDrawerProps, RoomFormProps, RoomFormDrawer(), RoomsPage(), ROOMS_QUERY_KEY, useCreateRoom(), useDeleteRoom() (+10 more)

### Community 57 - "Development Dependencies"
Cohesion: 0.08
Nodes (24): devDependencies, eslint, eslint-config-prettier, eslint-plugin-react, eslint-plugin-react-hooks, fast-check, jsdom, @tailwindcss/postcss (+16 more)

### Community 58 - "Search Selection Controls"
Cohesion: 0.15
Nodes (18): Command, CommandDialogProps, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator (+10 more)

### Community 59 - "Teacher Subject Configuration"
Cohesion: 0.12
Nodes (19): calculateWorkloadFromAssignments(), AvailableClass, AddClassPopoverWrapper(), parseSubjectRequirements(), SelectedClassPeriodOverride, SubjectAssignmentManager(), ClassInfo, SubjectInfo (+11 more)

### Community 60 - "Class Page Data"
Cohesion: 0.19
Nodes (19): classesApi, BulkApplyCurriculumDialog(), BulkApplyCurriculumDialogProps, BulkClassDialog(), ClassDataGrid(), ClassesPage(), ClassesPageProps, ClassFormDrawer() (+11 more)

### Community 61 - "School Settings Page"
Cohesion: 0.15
Nodes (17): AcademicStructureCard(), DaysOfWeekSelector(), DaysOfWeekSelectorProps, LowResourceModeCard(), MinistryValidationCard(), RamadanModeCard(), SchoolIdentityCard(), calculateStats() (+9 more)

### Community 62 - "Schedule Export Dialog"
Cohesion: 0.18
Nodes (16): ExportDialog(), ExportDialogProps, getDefaultValues(), ExportProgress, ExportProgressProps, FormatSelector(), LanguageSelector(), ScopeSelector() (+8 more)

### Community 63 - "Subject Filtering"
Cohesion: 0.15
Nodes (19): SubjectFiltersProps, applySubjectFilters(), DEFAULT_FILTERS, filterSubjectsByGrade(), filterSubjectsBySearch(), filterSubjectsBySection(), useSubjectFilters(), filtersStateArb (+11 more)

### Community 64 - "Shared Action Dialogs"
Cohesion: 0.26
Nodes (13): DialogContent, DialogDescription, DialogFooter(), DialogHeader(), DialogOverlay, DialogTitle, BulkClassDialogProps, GRADE_RANGES (+5 more)

### Community 65 - "UI Components Configuration"
Cohesion: 0.11
Nodes (18): aliases, components, hooks, lib, ui, utils, iconLibrary, registries (+10 more)

### Community 66 - "Class API Serialization"
Cohesion: 0.18
Nodes (13): deserializeClass(), parseMetaJson(), serializeClassForApi(), subjectRequirementArb, subjectRequirementsArrayArb, ClassGroupResponse, apiLogger, LogContext (+5 more)

### Community 67 - "Room Filtering"
Cohesion: 0.15
Nodes (17): RoomFiltersProps, applyRoomFilters(), DEFAULT_FILTERS, filterRoomsBySearch(), filterRoomsByType(), useRoomFilters(), filtersStateArb, isoDateStringArb (+9 more)

### Community 68 - "Room CRUD Tests"
Cohesion: 0.11
Nodes (11): isoDateStringArb, roomArb, roomsArrayWithUniqueIdsArb, roomTypeArb, unavailableSlotArb, isoDateStringArb, roomArb, roomsArrayArb (+3 more)

### Community 69 - "Schedule Export API"
Cohesion: 0.17
Nodes (14): buildApiUrl(), exportApi, ExportJobResponse, fetchAPI(), generateExportFilename(), isExportJob(), ExportErrorType, parseErrorType() (+6 more)

### Community 70 - "Subject API Serialization"
Cohesion: 0.22
Nodes (15): featureArrayArb, featureStringArb, isoDateStringArb, roomTypeArb, sectionArb, subjectFormValuesArb, subjectResponseArb, RoomType (+7 more)

### Community 71 - "Teacher Inspector Forms"
Cohesion: 0.13
Nodes (15): SubjectAssignmentManagerProps, TeacherEditDrawerProps, getDefaultValues(), InspectorTab, TeacherInspector(), TeacherInspectorProps, useSubjects(), ALL_TABS (+7 more)

### Community 72 - "Room Type Settings"
Cohesion: 0.17
Nodes (11): DEFAULT_ROOM_TYPES, getRoomTypeIcon(), ICON_MAP, RoomTypeOption, RoomTypeWithIcon, withIcons(), CreateRoomTypeInput, fetchRoomTypes() (+3 more)

### Community 73 - "Assignment Conflict Hook"
Cohesion: 0.16
Nodes (16): calculateWorkload(), ConflictDetectionOptions, ConflictDetectionResult, createCoverageConflict(), createDuplicateConflict(), createWorkloadConflict(), parseJsonArray(), NOTE: createIncompatibilityConflict removed - no longer used (+8 more)

### Community 74 - "Generation Progress Hub"
Cohesion: 0.19
Nodes (13): GenerationHub(), getViewState(), isGenerationReady(), ViewState, formatElapsedTime(), formatRemainingTime(), ProgressView(), ProgressViewProps (+5 more)

### Community 75 - "Export Format Controls"
Cohesion: 0.26
Nodes (10): Label, labelVariants, RadioGroup, RadioGroupItem, FormatSelectorProps, LanguageSelectorProps, ScopeSelectorProps, ExportFormat (+2 more)

### Community 76 - "Room Serialization"
Cohesion: 0.20
Nodes (14): featureArrayArb, featureStringArb, isoDateStringArb, roomFormValuesArb, roomResponseArb, roomTypeArb, unavailableSlotArb, unavailableSlotsArb (+6 more)

### Community 77 - "School Shift Configuration"
Cohesion: 0.21
Nodes (14): MinistryValidationCardProps, ValidationModeOption, calculateDuration(), ShiftConfiguration(), ShiftConfigurationProps, timeToMinutes(), DEFAULT_SHIFT_CONFIG, ShiftMode (+6 more)

### Community 78 - "Subject Form Utilities"
Cohesion: 0.16
Nodes (11): useRoomTypeOptions(), DEFAULT_VALUES, GRADE_OPTIONS, SECTION_OPTIONS, SubjectForm(), SubjectFormProps, apiLogger, componentLogger (+3 more)

### Community 79 - "Conflict Detection Engine"
Cohesion: 0.25
Nodes (13): useRealtimeConflicts(), calculateTotalAssignedPeriods(), detectAllConflicts(), detectCompatibilityConflicts(), detectCoverageConflict(), detectDuplicateAssignments(), detectTeacherConflicts(), detectWorkloadConflict() (+5 more)

### Community 80 - "Curriculum Population"
Cohesion: 0.22
Nodes (13): ClassEditDrawer(), getDefaultValues(), useTeachers(), ApplyCurriculumResult, calculateTotalPeriods(), CurriculumPreview, getCategoryFarsi(), mapSubjectsToRequirements() (+5 more)

### Community 81 - "Room Data Grid"
Cohesion: 0.26
Nodes (10): RoomDataGrid(), RoomDataGridProps, TYPE_COLORS, TypeBadge(), calculateStats(), RoomStats, RoomStatsCard(), RoomStatsCardProps (+2 more)

### Community 82 - "Subject Data Grid"
Cohesion: 0.19
Nodes (11): getStatusColors(), SubjectCoverageCell(), ROOM_TYPE_CONFIG, RoomTypeBadge(), SECTION_STYLES, SectionBadge(), SubjectDataGrid(), SubjectDataGridProps (+3 more)

### Community 83 - "Schedule Onboarding"
Cohesion: 0.26
Nodes (10): calculateCompletionPercentage(), DataCompletionProgress(), getCompletedItemsText(), getCompletionStatusText(), getProgressColor(), getCountForKey(), OnboardingEmptyState(), OnboardingEmptyStateProps (+2 more)

### Community 84 - "Schedule Display Settings"
Cohesion: 0.30
Nodes (8): CellContentToggles(), CellContentTogglesProps, COLOR_CODING_OPTIONS, ColorCodingSelector(), ColorCodingSelectorProps, DisplaySettingsDialog(), PresetButtons(), SizeSelector()

### Community 85 - "Class Filtering"
Cohesion: 0.27
Nodes (8): applyClassFilters(), DEFAULT_FILTERS, filterClassesByGradeCategory(), filterClassesBySearch(), filterClassesByStatus(), useClassFilters(), classGroupArb, ClassFiltersState

### Community 86 - "Export Error Boundary"
Cohesion: 0.24
Nodes (4): categorizeError(), ExportErrorBoundaryClass, ExportErrorBoundaryProps, logExportError()

### Community 87 - "Export Form Schema"
Cohesion: 0.20
Nodes (7): Assertion, Vi, ExportFormatEnum, exportFormSchema, ExportFormValues, ExportLanguageEnum, ExportScopeEnum

### Community 88 - "Subject Form Schema"
Cohesion: 0.22
Nodes (9): invalidCapacityArb, invalidCodeArb, invalidNameArb, invalidPeriodsArb, roomTypeArb, sectionArb, validSubjectFormDataArb, SubjectFormData (+1 more)

### Community 89 - "Rooms Page Layout"
Cohesion: 0.22
Nodes (8): PageHeader(), PageHeaderProps, BulkRoomDialog(), getDefaultValues(), RoomEditDrawer(), RoomFilters(), RoomsPageProps, useBulkCreateRooms()

### Community 90 - "Subject Section Translation"
Cohesion: 0.29
Nodes (8): getDefaultValues(), SubjectInspector(), nonEmptySectionArb, sectionArb, getSectionLabel(), hasValidTranslation(), SECTION_LABELS, VALID_SECTIONS

### Community 91 - "Package Scripts"
Cohesion: 0.22
Nodes (9): scripts, build, dev, lint, preview, test, test:coverage, test:watch (+1 more)

### Community 92 - "Subject Color Generation"
Cohesion: 0.31
Nodes (8): AUTO_COLOR_BASE, deriveColors(), getSubjectBaseColor(), getSubjectColors(), hashString(), HSL, SUBJECT_BASE_COLORS, SubjectColors

### Community 93 - "Node TypeScript Config"
Cohesion: 0.22
Nodes (8): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, strict, include

### Community 94 - "API Error Tests"
Cohesion: 0.25
Nodes (4): ApiError, apiErrorArb, errorMessageArb, statusCodeArb

### Community 95 - "Class CRUD Tests"
Cohesion: 0.25
Nodes (4): classFormValuesArb, classGroupArb, subjectRequirementArb, ClassFormValues

### Community 96 - "Swap Indicator Tests"
Cohesion: 0.25
Nodes (3): nonNullValidationStatusArb, STATUS_CLASSES, validationStatusArb

### Community 97 - "Teacher Workload Hook"
Cohesion: 0.47
Nodes (5): WorkloadBreakdown, toBreakdown(), useTeacherWorkload(), UseTeacherWorkloadOptions, UseTeacherWorkloadResult

### Community 99 - "Display Settings Hook"
Cohesion: 0.53
Nodes (5): loadFromLocalStorage(), saveToLocalStorage(), useDisplaySettings(), UseDisplaySettingsReturn, validateSettings()

### Community 101 - "Package Metadata"
Cohesion: 0.40
Nodes (4): description, name, type, version

### Community 102 - "Constraint Weight Slider"
Cohesion: 0.60
Nodes (4): getWeightColor(), getWeightLabel(), WeightSlider(), WeightSliderProps

## Knowledge Gaps
- **774 isolated node(s):** `root`, `browser`, `es2020`, `extends`, `ignorePatterns` (+769 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Data Lists Utilities` to `Constraint Management`, `Assignment Data Hooks`, `Assignment Page UI`, `Entity Editing Forms`, `Shared UI Primitives`, `Layout Licensing Generation`, `Schedule Grid Cells`, `Schedule State Store`, `Solver Results Dashboard`, `Assignment Shared Models`, `Schedule Swap Grid`, `Teacher Bulk Import`, `Workload Conflict Services`, `Schedule Dashboard`, `Schedule Drag Selection`, `Settings Cards Controls`, `Assignment Coverage Projections`, `Schedule Views Navigation`, `Solver Strategy Selection`, `Assignment Requirement Validation`, `Readiness Validation`, `Teacher Subject Availability`, `Period Defaults Matrix`, `Teacher Forms Validation`, `Curriculum Schedule Lists`, `Teacher Page Data`, `Unified Assignments Data`, `Data Grids Dialogs`, `Period Structure Schema`, `Class Categories Statistics`, `Sidebar Readiness Tooltips`, `Subject Page Data`, `Period Break Configuration`, `Teacher Compatibility Selection`, `Room Data Access`, `Search Selection Controls`, `Teacher Subject Configuration`, `Class Page Data`, `School Settings Page`, `Shared Action Dialogs`, `Teacher Inspector Forms`, `Generation Progress Hub`, `Export Format Controls`, `School Shift Configuration`, `Curriculum Population`, `Room Data Grid`, `Subject Data Grid`, `Schedule Onboarding`, `Rooms Page Layout`, `Subject Section Translation`, `Constraint Weight Slider`?**
  _High betweenness centrality (0.210) - this node is a cross-community bridge._
- **Why does `Button` connect `Shared UI Primitives` to `Constraint Management`, `Assignment Data Hooks`, `Assignment Page UI`, `Entity Editing Forms`, `Schedule Types Tests`, `Layout Licensing Generation`, `Solver Results Dashboard`, `Data Lists Utilities`, `Assignment Shared Models`, `Schedule Swap Grid`, `Teacher Bulk Import`, `Schedule Dashboard`, `Settings Cards Controls`, `Assignment Coverage Projections`, `Schedule Views Navigation`, `Solver Strategy Selection`, `Assignment Requirement Validation`, `Teacher Forms Validation`, `Curriculum Schedule Lists`, `Teacher Page Data`, `Unified Assignments Data`, `Period Structure Schema`, `Schedule View Routing`, `Sidebar Readiness Tooltips`, `Subject Page Data`, `Period Break Configuration`, `Search Selection Controls`, `Teacher Subject Configuration`, `Class Page Data`, `School Settings Page`, `Schedule Export Dialog`, `Shared Action Dialogs`, `Teacher Inspector Forms`, `Generation Progress Hub`, `Subject Form Utilities`, `Schedule Onboarding`, `Rooms Page Layout`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Runtime Dependencies` to `Teacher Bulk Import`, `Package Metadata`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **What connects `root`, `browser`, `es2020` to the rest of the system?**
  _790 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Constraint Management` be split into smaller, more focused modules?**
  _Cohesion score 0.06002239641657335 - nodes in this community are weakly interconnected._
- **Should `Assignment Data Hooks` be split into smaller, more focused modules?**
  _Cohesion score 0.056910569105691054 - nodes in this community are weakly interconnected._
- **Should `Assignment Page UI` be split into smaller, more focused modules?**
  _Cohesion score 0.05189873417721519 - nodes in this community are weakly interconnected._