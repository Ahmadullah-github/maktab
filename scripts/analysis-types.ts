/**
 * Analysis Framework Type Definitions
 * 
 * This module defines all data structures, interfaces, and enums used
 * throughout the wizard analysis framework.
 */

// ============================================================================
// Enums
// ============================================================================

export enum FindingCategory {
  Architecture = "Architecture",
  DataFlow = "DataFlow",
  DataPassing = "DataPassing",
  UIUX = "UIUX",
  Logic = "Logic",
  Validation = "Validation",
  Styling = "Styling",
  Terminology = "Terminology",
  Performance = "Performance",
  Bilingual = "Bilingual",
  Accessibility = "Accessibility",
  Testing = "Testing"
}

export enum Severity {
  Critical = "Critical",  // Data loss, crashes, blocking issues
  High = "High",          // Major UX problems, data integrity risks
  Medium = "Medium",      // Moderate UX issues, inconsistencies
  Low = "Low"             // Minor polish, nice-to-haves
}

export enum Effort {
  Small = "Small",        // < 4 hours
  Medium = "Medium",      // 1-2 days
  Large = "Large"         // 3+ days
}

// ============================================================================
// Core Analysis Types
// ============================================================================

export interface AnalysisFinding {
  id: string;                    // Unique identifier
  stepName: string;              // Which step (or "global" for cross-step)
  category: FindingCategory;     // Architecture, DataFlow, UIUX, Logic, Styling, etc.
  severity: Severity;            // Critical, High, Medium, Low
  title: string;                 // Short description
  description: string;           // Detailed explanation
  impact: string;                // Impact on users/system
  filePaths: string[];           // Affected files
  lineNumbers?: number[];        // Specific line numbers if applicable
  reproductionSteps?: string[];  // How to reproduce the issue
  suggestedFix: string;          // Recommended solution
  codeSnippet?: string;          // Copy-paste code fix
  estimatedEffort: Effort;       // Small, Medium, Large
  acceptanceCriteria: string[];  // How to verify the fix
  relatedFindings?: string[];    // IDs of related findings
}

export interface BilingualText {
  en: string;           // English text
  fa: string;           // Persian/Dari text
  literal?: string;     // Literal translation (if different from recommended)
  context?: string;     // Usage context for translators
}

export interface Task {
  id: string;
  title: string;
  description: string;
  category: FindingCategory;
  priority: Severity;
  effort: Effort;
  files: string[];              // Files to modify
  codeSnippet?: string;         // Patch or example code
  acceptanceCriteria: string[];
  relatedTasks?: string[];      // Dependencies
  bilingualText?: BilingualText;
}

// ============================================================================
// Component and File Analysis Types
// ============================================================================

export interface ComponentImport {
  name: string;
  path: string;
  type: "component" | "hook" | "store" | "utility" | "type";
}

export interface StateVariable {
  name: string;
  type: string;
  initialValue?: string;
  setter?: string;
}

export interface StoreUsage {
  storeName: string;
  methods: string[];            // Methods called on the store
  selectors: string[];          // State selectors used
}

export interface APICall {
  endpoint: string;
  method: string;               // GET, POST, PUT, DELETE
  purpose: string;
  errorHandling: boolean;
}

export interface RaceCondition {
  description: string;
  location: string;             // File and line number
  scenario: string;             // When it occurs
  fix: string;                  // How to fix it
}

// ============================================================================
// Data Flow Analysis Types
// ============================================================================

export interface DataInput {
  source: string;               // Previous step or store
  dataKey: string;              // Property name
  usage: string;                // How it's used in this step
}

export interface DataOutput {
  destination: string;          // Next step or store
  dataKey: string;
  transformation?: string;      // How data is transformed
}

export interface DataFlowAnalysis {
  inputs: DataInput[];          // Data from previous steps
  outputs: DataOutput[];        // Data to next steps
  storeUsage: StoreUsage[];     // Zustand store interactions
  localStorageKeys: string[];   // localStorage access
  apiCalls: APICall[];          // Backend API interactions
  stateVariables: StateVariable[]; // Local React state
  raceConditions: RaceCondition[];
}

// ============================================================================
// UI/UX Analysis Types
// ============================================================================

export interface LayoutAnalysis {
  visualHierarchy: string;      // Assessment of visual hierarchy
  spacing: string[];            // Spacing issues found
  grouping: string[];           // Field grouping observations
  responsive: string[];         // Responsive design issues
}

export interface InteractionAnalysis {
  formControls: string[];       // Types of form controls used
  buttonStates: string[];       // Button state handling
  keyboardNav: string[];        // Keyboard navigation issues
  focusManagement: string[];    // Focus management observations
  modalUsage: string[];         // Modal/dialog usage patterns
}

export interface FeedbackAnalysis {
  validation: string[];         // Validation feedback mechanisms
  errorMessages: string[];      // Error message patterns
  successStates: string[];      // Success confirmation patterns
  loadingStates: string[];      // Loading state indicators
  progressIndicators: string[]; // Progress indication
}

export interface AccessibilityAnalysis {
  ariaLabels: string[];         // ARIA label usage
  keyboardOnly: string[];       // Keyboard-only navigation issues
  screenReader: string[];       // Screen reader support
  colorContrast: string[];      // Color contrast issues
}

export interface BilingualAnalysis {
  rtlHandling: string[];        // RTL direction handling
  translationGaps: string[];    // Missing translations
  fontLoading: string[];        // Persian font loading issues
  numeralLocalization: string[]; // Numeral localization
}

export interface UIUXAnalysis {
  layout: LayoutAnalysis;
  interactions: InteractionAnalysis;
  feedback: FeedbackAnalysis;
  accessibility: AccessibilityAnalysis;
  bilingualSupport: BilingualAnalysis;
}

// ============================================================================
// Logic Analysis Types
// ============================================================================

export interface ValidationRule {
  field: string;
  rule: string;
  timing: string;               // blur, submit, change
  errorMessage: string;
}

export interface EdgeCase {
  scenario: string;
  currentHandling: string;
  issue?: string;
  recommendation?: string;
}

export interface ErrorHandling {
  location: string;
  type: string;                 // try-catch, error boundary, etc.
  coverage: string;             // What errors are handled
  gaps?: string[];              // What's not handled
}

export interface StateTransition {
  from: string;
  to: string;
  trigger: string;
  dataChanges: string[];
}

export interface LogicAnalysis {
  validationRules: ValidationRule[];
  edgeCases: EdgeCase[];
  errorHandling: ErrorHandling[];
  stateTransitions: StateTransition[];
}

// ============================================================================
// Styling Analysis Types
// ============================================================================

export interface StylingInconsistency {
  type: string;                 // spacing, color, typography, etc.
  locations: string[];
  expected: string;
  actual: string;
  fix: string;
}

export interface DesignTokenUsage {
  colors: string[];
  spacing: string[];
  typography: string[];
  customValues: string[];       // Non-token values used
}

export interface StylingAnalysis {
  componentPatterns: string[];  // Card, Form, Modal, etc.
  tailwindClasses: string[];    // Most used classes
  inconsistencies: StylingInconsistency[];
  designTokenUsage: DesignTokenUsage;
}

// ============================================================================
// Performance Analysis Types
// ============================================================================

export interface PerformanceIssue {
  type: string;                 // re-render, expensive computation, etc.
  location: string;
  impact: string;               // High, Medium, Low
  fix: string;
}

export interface PerformanceAnalysis {
  reRenderIssues: PerformanceIssue[];
  memoizationOpportunities: PerformanceIssue[];
  expensiveComputations: PerformanceIssue[];
  listRenderingIssues: PerformanceIssue[];
}

// ============================================================================
// Terminology Analysis Types
// ============================================================================

export interface TerminologyIssue {
  term: string;
  variations: string[];         // Different names used
  locations: string[];
  recommended: string;
}

export interface TerminologyAnalysis {
  namingInconsistencies: TerminologyIssue[];
  i18nKeyPatterns: string[];
  domainTerms: TerminologyIssue[];
}

// ============================================================================
// Architecture Analysis Types
// ============================================================================

export interface ComplexityMetrics {
  linesOfCode: number;
  cyclomaticComplexity?: number;
  numberOfImports: number;
  numberOfExports: number;
  numberOfHooks: number;
  numberOfStateVariables: number;
}

export interface ArchitectureAnalysis {
  componentStructure: string;
  fileOrganization: string[];
  dependencies: ComponentImport[];
  complexity: ComplexityMetrics;
  patterns: string[];           // Design patterns identified
  antiPatterns: string[];       // Anti-patterns identified
}

// ============================================================================
// Step Analysis Result
// ============================================================================

export interface StepAnalysisResult {
  stepName: string;
  stepKey: string;              // e.g., "school-info"
  filePath: string;             // Main step component file
  imports: ComponentImport[];   // All imported components
  architecture: ArchitectureAnalysis;
  dataFlow: DataFlowAnalysis;
  uiux: UIUXAnalysis;
  logic: LogicAnalysis;
  styling: StylingAnalysis;
  performance: PerformanceAnalysis;
  terminology: TerminologyAnalysis;
  findings: AnalysisFinding[];
  quickWins: QuickWin[];
}

export interface QuickWin {
  id: string;
  title: string;
  description: string;
  filePath: string;
  lineNumber?: number;
  codeSnippet?: string;
  estimatedTime: string;        // e.g., "30 minutes", "1 hour"
  category: FindingCategory;
  bilingualText?: BilingualText;
}

// ============================================================================
// Cross-Step Analysis Types
// ============================================================================

export interface CrossStepPattern {
  pattern: string;
  steps: string[];              // Which steps exhibit this pattern
  consistency: string;          // Consistent, Inconsistent, Mixed
  recommendation?: string;
}

export interface CrossStepAnalysis {
  validationPatterns: CrossStepPattern[];
  stylingPatterns: CrossStepPattern[];
  terminologyPatterns: CrossStepPattern[];
  stateManagementPatterns: CrossStepPattern[];
  dataFlowIssues: AnalysisFinding[];
  globalIssues: AnalysisFinding[];
}

// ============================================================================
// Complete Analysis Result
// ============================================================================

export interface WizardAnalysisResult {
  metadata: {
    generatedAt: string;
    version: string;
    totalSteps: number;
    totalFindings: number;
  };
  steps: StepAnalysisResult[];
  crossStep: CrossStepAnalysis;
  summary: {
    criticalIssues: AnalysisFinding[];
    topQuickWins: QuickWin[];
    healthScore: number;        // 0-100
  };
}

// ============================================================================
// Backlog Types
// ============================================================================

export interface BacklogMetadata {
  generatedAt: string;
  totalTasks: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

export interface Backlog {
  metadata: BacklogMetadata;
  tasks: Task[];
}
