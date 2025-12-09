/**
 * Teachers Step Analysis Script
 * 
 * Runs all analyzers on the teachers-step component and generates
 * a comprehensive audit document with special focus on UX improvements.
 */

import * as fs from 'fs';
import { analyzeArchitecture, generateArchitectureFindings } from './analyzers/architecture-analyzer';
import { analyzeDataFlow, generateDataFlowFindings } from './analyzers/data-flow-analyzer';
import { analyzeUIUX, generateUIUXFindings, generateHandHoldingSuggestions } from './analyzers/uiux-analyzer';
import { analyzeLogic, generateLogicFindings } from './analyzers/logic-analyzer';
import { analyzeStyling, generateStylingFindings } from './analyzers/styling-analyzer';
import { analyzeTerminology, generateTerminologyFindings } from './analyzers/terminology-analyzer';
import { analyzePerformance, generatePerformanceFindings } from './analyzers/performance-analyzer';
import { analyzeBilingualSupport, generateBilingualFindings } from './analyzers/bilingual-analyzer';
import { AnalysisFinding, Severity, BilingualText, FindingCategory, Effort } from './analysis-types';

// ============================================================================
// Configuration
// ============================================================================

const STEP_NAME = 'teachers';
const STEP_FILE = 'packages/web/src/components/wizard/steps/teachers-step.tsx';
const MODAL_FILE = 'packages/web/src/components/wizard/steps/teachers/TeacherEditModal.tsx';
const OUTPUT_FILE = 'docs/teachers-audit.md';

// ============================================================================
// Main Analysis Function
// ============================================================================

async function analyzeTeachersStep() {
  console.log('🔍 Starting Teachers Step Analysis (HIGH PRIORITY)...\n');
  
  // Read the component files
  const mainContent = fs.readFileSync(STEP_FILE, 'utf-8');
  const modalContent = fs.readFileSync(MODAL_FILE, 'utf-8');
  const combinedContent = mainContent + '\n\n' + modalContent;
  
  // Run all analyzers
  console.log('📊 Running analyzers...');
  
  const architectureAnalysis = analyzeArchitecture(STEP_FILE, mainContent);
  const dataFlowAnalysis = analyzeDataFlow(STEP_FILE, combinedContent);
  const uiuxAnalysis = analyzeUIUX(STEP_FILE, combinedContent);
  const logicAnalysis = analyzeLogic(STEP_FILE, combinedContent);
  const stylingAnalysis = analyzeStyling(STEP_FILE, combinedContent);
  const terminologyAnalysis = analyzeTerminology(STEP_FILE, combinedContent);
  const performanceAnalysis = analyzePerformance(STEP_FILE, combinedContent);
  const bilingualAnalysis = analyzeBilingualSupport(STEP_FILE, combinedContent);
  
  console.log('✅ Analysis complete\n');
  
  // Generate findings
  console.log('📝 Generating findings...');
  
  const allFindings: AnalysisFinding[] = [
    ...generateArchitectureFindings(STEP_NAME, STEP_FILE, architectureAnalysis),
    ...generateDataFlowFindings(STEP_NAME, STEP_FILE, dataFlowAnalysis),
    ...generateUIUXFindings(STEP_NAME, STEP_FILE, uiuxAnalysis),
    ...generateLogicFindings(STEP_NAME, STEP_FILE, logicAnalysis),
    ...generateStylingFindings(STEP_NAME, STEP_FILE, stylingAnalysis),
    ...generateTerminologyFindings(STEP_NAME, STEP_FILE, terminologyAnalysis),
    ...generatePerformanceFindings(STEP_NAME, STEP_FILE, performanceAnalysis),
    ...generateBilingualFindings(STEP_NAME, STEP_FILE, bilingualAnalysis),
    ...generateTeachersSpecificFindings()
  ];
  
  console.log(`✅ Generated ${allFindings.length} findings\n`);
  
  // Generate hand-holding suggestions
  const handHoldingSuggestions = generateHandHoldingSuggestions(STEP_NAME, combinedContent);
  
  // Generate audit document
  console.log('📄 Generating audit document...');
  
  const auditDocument = generateAuditDocument({
    stepName: STEP_NAME,
    filePath: STEP_FILE,
    architectureAnalysis,
    dataFlowAnalysis,
    uiuxAnalysis,
    logicAnalysis,
    stylingAnalysis,
    terminologyAnalysis,
    performanceAnalysis,
    bilingualAnalysis,
    findings: allFindings,
    handHoldingSuggestions
  });
  
  // Write audit document
  fs.writeFileSync(OUTPUT_FILE, auditDocument, 'utf-8');
  
  console.log(`✅ Audit document written to ${OUTPUT_FILE}\n`);
  
  // Print summary
  printSummary(allFindings);
}

// ============================================================================
// Teachers-Specific Findings
// ============================================================================

function generateTeachersSpecificFindings(): AnalysisFinding[] {
  const findings: AnalysisFinding[] = [];
  
  // UX IMPROVEMENT: Bulk Edit Operations
  findings.push({
    id: 'TEACHERS-UX-001',
    stepName: 'teachers',
    category: FindingCategory.UIUX,
    severity: Severity.High,
    title: 'Missing Bulk Edit Operations for Teacher Management',
    description: 'The teachers step requires users to edit each teacher individually through a modal. For schools with 20+ teachers, this becomes tedious. Bulk operations (select multiple → edit availability, assign subjects, set constraints) would dramatically improve efficiency.',
    impact: 'High friction for large schools. Users must open/close modal 20+ times to make similar changes across teachers. This leads to user fatigue and errors.',
    filePaths: [STEP_FILE],
    suggestedFix: 'Add bulk selection checkboxes to teacher table. Implement bulk actions toolbar with: (1) Bulk Availability Editor, (2) Bulk Subject Assignment, (3) Bulk Constraint Editor. Use a side panel or expanded modal for bulk operations.',
    codeSnippet: `// Add to TeachersStep component
const [selectedTeachers, setSelectedTeachers] = useState<Set<string>>(new Set());
const [bulkEditMode, setBulkEditMode] = useState<'availability' | 'subjects' | 'constraints' | null>(null);

// Bulk Actions Toolbar
{selectedTeachers.size > 0 && (
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
    <div className="flex items-center justify-between">
      <span className="font-medium">{selectedTeachers.size} teachers selected</span>
      <div className="flex gap-2">
        <Button onClick={() => setBulkEditMode('availability')}>
          Edit Availability
        </Button>
        <Button onClick={() => setBulkEditMode('subjects')}>
          Assign Subjects
        </Button>
        <Button onClick={() => setBulkEditMode('constraints')}>
          Set Constraints
        </Button>
      </div>
    </div>
  </div>
)}`,
    estimatedEffort: Effort.Large,
    acceptanceCriteria: [
      'Users can select multiple teachers via checkboxes',
      'Bulk actions toolbar appears when teachers are selected',
      'Bulk availability editor allows setting common availability patterns',
      'Bulk subject assignment allows adding/removing subjects for multiple teachers',
      'Changes apply to all selected teachers atomically',
      'Clear visual feedback during bulk operations'
    ]
  });

  // UX IMPROVEMENT: Advanced Filtering
  findings.push({
    id: 'TEACHERS-UX-002',
    stepName: 'teachers',
    category: FindingCategory.UIUX,
    severity: Severity.High,
    title: 'Missing Advanced Filtering and Search Capabilities',
    description: 'The teachers list shows all teachers without filtering options. Users cannot filter by subject expertise, grade level, workload utilization, or single-teacher qualification. Search is also missing.',
    impact: 'Difficult to find specific teachers in large schools. Cannot quickly identify teachers by expertise or availability. No way to find underutilized or overloaded teachers.',
    filePaths: [STEP_FILE],
    suggestedFix: 'Add filter toolbar with: (1) Search by name, (2) Filter by subject expertise, (3) Filter by grade level, (4) Filter by workload (underutilized/optimal/overloaded), (5) Filter by single-teacher qualification, (6) Filter by availability patterns.',
    codeSnippet: `// Add filter state
const [filters, setFilters] = useState({
  search: '',
  subjects: [] as string[],
  grades: [] as number[],
  workload: 'all' as 'all' | 'under' | 'optimal' | 'over',
  singleTeacher: false,
  availability: 'all' as 'all' | 'morning' | 'afternoon' | 'full'
});

// Filter teachers
const filteredTeachers = useMemo(() => {
  return teachers.filter(teacher => {
    if (filters.search && !teacher.fullName.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    if (filters.subjects.length > 0 && !filters.subjects.some(s => teacher.primarySubjectIds.includes(s))) {
      return false;
    }
    // ... additional filters
    return true;
  });
}, [teachers, filters]);`,
    estimatedEffort: Effort.Medium,
    acceptanceCriteria: [
      'Search box filters teachers by name in real-time',
      'Subject filter shows multi-select dropdown of all subjects',
      'Grade filter shows checkboxes for grades 1-12',
      'Workload filter categorizes teachers by utilization percentage',
      'Single-teacher filter shows only qualified teachers',
      'Filters can be combined (AND logic)',
      'Clear all filters button resets to default view'
    ]
  });

  // UX IMPROVEMENT: Visual Availability Grid
  findings.push({
    id: 'TEACHERS-UX-003',
    stepName: 'teachers',
    category: FindingCategory.UIUX,
    severity: Severity.High,
    title: 'Missing Visual Availability Grid in Main View',
    description: 'Teacher availability is only visible inside the edit modal. Users cannot see at-a-glance which teachers are available during specific periods without opening each teacher individually. This makes scheduling decisions difficult.',
    impact: 'Users must memorize or write down teacher availability. Cannot quickly identify conflicts or gaps. Scheduling becomes trial-and-error instead of data-driven.',
    filePaths: [STEP_FILE],
    suggestedFix: 'Add expandable availability preview in teacher table rows. Implement a "Grid View" toggle that shows all teachers\' availability in a compact heat-map format (rows=teachers, columns=day/period, colors=available/unavailable).',
    codeSnippet: `// Add view mode toggle
const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

// Grid View Component
{viewMode === 'grid' && (
  <div className="overflow-x-auto">
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr>
          <th className="border p-2 sticky left-0 bg-gray-50">Teacher</th>
          {daysToDisplay.map(day => (
            <th key={day} colSpan={periodsToDisplay} className="border p-1 bg-gray-50">
              {day.slice(0, 3)}
            </th>
          ))}
        </tr>
        <tr>
          <th className="border p-2 sticky left-0 bg-gray-50"></th>
          {daysToDisplay.map(day => 
            Array.from({length: periodsToDisplay}, (_, i) => (
              <th key={\`\${day}-\${i}\`} className="border p-1 text-[10px]">P{i+1}</th>
            ))
          )}
        </tr>
      </thead>
      <tbody>
        {teachers.map(teacher => (
          <tr key={teacher.id}>
            <td className="border p-2 sticky left-0 bg-white font-medium">
              {teacher.fullName}
            </td>
            {daysToDisplay.map(day => 
              Array.from({length: periodsToDisplay}, (_, i) => {
                const isAvailable = teacher.availability?.[day]?.[i];
                return (
                  <td key={\`\${day}-\${i}\`} 
                      className={\`border p-1 \${isAvailable ? 'bg-green-100' : 'bg-red-50'}\`}
                      title={\`\${teacher.fullName} - \${day} P\${i+1}\`}
                  />
                );
              })
            )}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)}`,
    estimatedEffort: Effort.Medium,
    acceptanceCriteria: [
      'Toggle button switches between List and Grid views',
      'Grid view shows all teachers in rows',
      'Grid view shows days/periods in columns',
      'Available periods shown in green, unavailable in red',
      'Hover tooltip shows teacher name and period details',
      'Grid is horizontally scrollable for many periods',
      'Teacher names sticky on left during horizontal scroll'
    ]
  });

  // UX IMPROVEMENT: Workload Visualization
  findings.push({
    id: 'TEACHERS-UX-004',
    stepName: 'teachers',
    category: FindingCategory.UIUX,
    severity: Severity.Medium,
    title: 'Missing Workload Visualization and Balance Indicators',
    description: 'The current UI shows "X/Y periods" as plain text. There is no visual indication of workload balance, no color coding for overloaded/underutilized teachers, and no aggregate statistics.',
    impact: 'Users cannot quickly identify workload imbalances. Difficult to ensure fair distribution of teaching load. No visibility into overall capacity utilization.',
    filePaths: [STEP_FILE],
    suggestedFix: 'Add progress bars for workload visualization. Color-code based on utilization: green (30-80%), yellow (80-95%), red (>95%), gray (<30%). Add summary cards showing: total capacity, total assigned, average utilization, teachers at capacity.',
    codeSnippet: `// Workload Progress Bar Component
function WorkloadBar({ current, max }: { current: number; max: number }) {
  const percent = max > 0 ? (current / max) * 100 : 0;
  const color = percent < 30 ? 'bg-gray-400' :
                percent < 80 ? 'bg-green-500' :
                percent < 95 ? 'bg-yellow-500' : 'bg-red-500';
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-mono">{current}/{max}</span>
        <span className="text-muted-foreground">{Math.round(percent)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className={\`\${color} h-2 rounded-full transition-all\`}
          style={{ width: \`\${Math.min(percent, 100)}%\` }}
        />
      </div>
    </div>
  );
}

// Summary Statistics
const workloadStats = useMemo(() => {
  const totalCapacity = teachers.reduce((sum, t) => sum + t.maxPeriodsPerWeek, 0);
  const totalAssigned = teachers.reduce((sum, t) => sum + calculateTeacherTotalPeriods(t), 0);
  const atCapacity = teachers.filter(t => {
    const assigned = calculateTeacherTotalPeriods(t);
    return assigned >= t.maxPeriodsPerWeek * 0.95;
  }).length;
  
  return { totalCapacity, totalAssigned, atCapacity, avgUtilization: totalCapacity > 0 ? (totalAssigned / totalCapacity) * 100 : 0 };
}, [teachers]);`,
    estimatedEffort: Effort.Small,
    acceptanceCriteria: [
      'Each teacher row shows a progress bar for workload',
      'Progress bar color indicates utilization level',
      'Hover shows exact numbers and percentage',
      'Summary cards show aggregate statistics',
      'Visual warning for overloaded teachers',
      'Visual indicator for underutilized teachers'
    ]
  });

  // DATA INTEGRITY: Availability Migration Issues
  findings.push({
    id: 'TEACHERS-DATA-001',
    stepName: 'teachers',
    category: FindingCategory.DataFlow,
    severity: Severity.High,
    title: 'Availability Migration Can Cause Data Loss',
    description: 'The "Fix Availability" button migrates teacher availability to match current period configuration. However, if a teacher had custom availability patterns (e.g., only mornings), the migration resets everything to the new grid size, potentially losing that information.',
    impact: 'Users lose carefully configured availability patterns when period configuration changes. No backup or undo mechanism.',
    filePaths: [STEP_FILE, 'packages/web/src/stores/useTeacherStore.ts'],
    reproductionSteps: [
      'Configure a teacher with specific availability (e.g., only Saturday/Sunday mornings)',
      'Change period configuration in Periods step (e.g., from 6 to 7 periods/day)',
      'Return to Teachers step and click "Fix Availability"',
      'Teacher\'s custom availability pattern is lost'
    ],
    suggestedFix: 'Before migration, show a preview dialog explaining what will change. Offer "Smart Migration" that preserves patterns where possible (e.g., if teacher was available P1-P3, keep them available for P1-P3 in new config). Add undo functionality.',
    codeSnippet: `// Add migration preview
const [migrationPreview, setMigrationPreview] = useState<{
  teacher: Teacher;
  before: Record<string, boolean[]>;
  after: Record<string, boolean[]>;
}[] | null>(null);

const handleMigrateAvailability = async () => {
  // Generate preview first
  const preview = teachers.map(teacher => ({
    teacher,
    before: teacher.availability,
    after: normalizeTeacherAvailability(teacher.availability, daysPerWeek, maxPeriodsPerDay, periodsPerDayMap)
  })).filter(p => JSON.stringify(p.before) !== JSON.stringify(p.after));
  
  if (preview.length === 0) {
    toast.info("All teachers already have correct availability");
    return;
  }
  
  setMigrationPreview(preview);
  // Show confirmation dialog with preview
};`,
    estimatedEffort: Effort.Medium,
    acceptanceCriteria: [
      'Migration shows preview dialog before applying changes',
      'Preview lists affected teachers and shows before/after',
      'User can cancel migration after seeing preview',
      'Smart migration preserves availability patterns where possible',
      'Undo button available for 30 seconds after migration',
      'Migration logs changes for audit trail'
    ]
  });

  return findings;
}

// ============================================================================
// Audit Document Generation
// ============================================================================

interface AuditData {
  stepName: string;
  filePath: string;
  architectureAnalysis: any;
  dataFlowAnalysis: any;
  uiuxAnalysis: any;
  logicAnalysis: any;
  stylingAnalysis: any;
  terminologyAnalysis: any;
  performanceAnalysis: any;
  bilingualAnalysis: any;
  findings: AnalysisFinding[];
  handHoldingSuggestions: Array<{ suggestion: string; bilingualText: BilingualText }>;
}

function generateAuditDocument(data: AuditData): string {
  const {
    filePath,
    architectureAnalysis,
    dataFlowAnalysis,
    uiuxAnalysis,
    logicAnalysis,
    stylingAnalysis,
    terminologyAnalysis,
    bilingualAnalysis,
    findings,
    handHoldingSuggestions
  } = data;
  
  const criticalFindings = findings.filter(f => f.severity === Severity.Critical);
  const highFindings = findings.filter(f => f.severity === Severity.High);
  const mediumFindings = findings.filter(f => f.severity === Severity.Medium);
  const lowFindings = findings.filter(f => f.severity === Severity.Low);
  
  const uxImprovementFindings = findings.filter(f => 
    f.id.startsWith('TEACHERS-UX-') && f.severity === Severity.High
  );
  
  let doc = `# Teachers Step - Deep Audit (HIGH PRIORITY)

**Generated:** ${new Date().toISOString()}

**Component:** \`${filePath}\`

**Priority:** 🔴 HIGH - This step requires major UX improvements for usability at scale

## Executive Summary

This audit analyzes the Teachers wizard step across 9 dimensions: architecture, data flow, data passing, UI/UX, logic, styling, terminology, performance, and bilingual support.

**The Teachers step is flagged as HIGH PRIORITY due to significant UX limitations that impact usability for schools with 15+ teachers.** The current implementation requires excessive modal interactions and lacks bulk operations, filtering, and visual availability management.

### Findings Summary

- **Critical:** ${criticalFindings.length}
- **High:** ${highFindings.length} (including ${uxImprovementFindings.length} major UX improvements)
- **Medium:** ${mediumFindings.length}
- **Low:** ${lowFindings.length}
- **Total:** ${findings.length}

### Key Issues

1. **No bulk edit operations** - Users must edit each teacher individually
2. **Missing advanced filtering** - Cannot filter by subject, grade, workload, or availability
3. **No visual availability grid** - Availability only visible in edit modal
4. **Limited workload visualization** - Difficult to identify imbalances
5. **Complex modal workflow** - Too many steps to configure a single teacher

---

## 🚨 Major UX Improvements Required

The following improvements are recommended for a separate usability sprint focused on the Teachers step:

${uxImprovementFindings.map((f, index) => `
### ${index + 1}. ${f.title}

**Priority:** ${f.severity}  
**Effort:** ${f.estimatedEffort}

**Problem:**  
${f.description}

**Impact:**  
${f.impact}

**Proposed Solution:**  
${f.suggestedFix}

**Wireframe/Component Suggestions:**

${f.codeSnippet ? `\`\`\`typescript\n${f.codeSnippet}\n\`\`\`` : 'See detailed findings section for implementation guidance.'}

**Acceptance Criteria:**
${f.acceptanceCriteria.map((ac: string) => `- ${ac}`).join('\n')}

---
`).join('\n')}

## Component Inventory

### Main Component
- **File:** \`${filePath}\`
- **Size:** ${architectureAnalysis.complexity.linesOfCode} lines of code
- **Complexity:** ${architectureAnalysis.complexity.cyclomaticComplexity} (cyclomatic)
- **Structure:** ${architectureAnalysis.componentStructure}

### Related Components
- **TeacherEditModal:** \`${MODAL_FILE}\` (1338 lines - very large, consider splitting)
- **SingleTeacherQualificationBadge:** Shows single-teacher mode qualification
- **QuickGradeAssignment:** Bulk subject assignment for single-teacher mode

### Dependencies

#### External Libraries
${architectureAnalysis.dependencies
  .filter((d: any) => !d.path.startsWith('.') && !d.path.startsWith('@/'))
  .map((d: any) => `- \`${d.name}\` from \`${d.path}\``)
  .join('\n') || '- None'}

#### Internal Components
${architectureAnalysis.dependencies
  .filter((d: any) => d.type === 'component' && (d.path.startsWith('.') || d.path.startsWith('@/')))
  .map((d: any) => `- \`${d.name}\` from \`${d.path}\``)
  .join('\n') || '- None'}

#### Hooks
${architectureAnalysis.dependencies
  .filter((d: any) => d.type === 'hook')
  .map((d: any) => `- \`${d.name}\` from \`${d.path}\``)
  .join('\n') || '- None'}

#### Stores
${architectureAnalysis.dependencies
  .filter((d: any) => d.type === 'store')
  .map((d: any) => `- \`${d.name}\` from \`${d.path}\``)
  .join('\n') || '- None'}

### State Management

#### Local State Variables (${dataFlowAnalysis.stateVariables.length})
${dataFlowAnalysis.stateVariables
  .map((s: any) => `- \`${s.name}\` (initial: \`${s.initialValue}\`)`)
  .join('\n') || '- None'}

#### Store Usage
${dataFlowAnalysis.storeUsage
  .map((s: any) => `- **${s.storeName}**: ${s.methods.join(', ')}`)
  .join('\n') || '- No Zustand stores used'}

---

## Data Integrity Audit

### Data Sources (Inputs)

${dataFlowAnalysis.inputs.length > 0 ? dataFlowAnalysis.inputs
  .map((input: any) => `- **${input.source}**: \`${input.dataKey}\` - ${input.usage}`)
  .join('\n') : '- No external data inputs detected'}

### Data Sinks (Outputs)

${dataFlowAnalysis.outputs.length > 0 ? dataFlowAnalysis.outputs
  .map((output: any) => `- **${output.destination}**: \`${output.dataKey}\` - ${output.transformation}`)
  .join('\n') : '- No data persistence detected'}

### localStorage Usage

${dataFlowAnalysis.localStorageKeys.length > 0 
  ? `Keys accessed: ${dataFlowAnalysis.localStorageKeys.map((k: string) => `\`${k}\``).join(', ')}`
  : 'No localStorage usage detected'}

### API Calls

${dataFlowAnalysis.apiCalls.length > 0 ? dataFlowAnalysis.apiCalls
  .map((call: any) => `- **${call.method}** \`${call.endpoint}\` - ${call.errorHandling ? '✅ Has error handling' : '❌ No error handling'}`)
  .join('\n') : 'No API calls detected'}

### Potential Issues

${dataFlowAnalysis.raceConditions.length > 0 ? '#### Race Conditions\n\n' + dataFlowAnalysis.raceConditions
  .map((rc: any) => `- **${rc.description}**\n  - Location: \`${rc.location}\`\n  - Scenario: ${rc.scenario}\n  - Fix: ${rc.fix}`)
  .join('\n\n') : '✅ No race conditions detected'}

${generateDataIntegrityFindings(findings)}

---

## Consistency Audit

### Naming Consistency

${terminologyAnalysis.namingPatterns && terminologyAnalysis.namingPatterns.length > 0 ? terminologyAnalysis.namingPatterns
  .map((p: string) => `- ${p}`)
  .join('\n') : '- No naming issues detected'}

### Styling Consistency

${stylingAnalysis.inconsistencies && stylingAnalysis.inconsistencies.length > 0 ? stylingAnalysis.inconsistencies
  .map((i: any) => `- **${i.type}**: ${i.description}`)
  .join('\n') : '✅ No major styling inconsistencies'}

### i18n Translation Status

${bilingualAnalysis.translationGaps && bilingualAnalysis.translationGaps.length > 0 ? '#### Missing/Incorrect Translations\n\n' + bilingualAnalysis.translationGaps
  .map((gap: string) => `- ${gap}`)
  .join('\n') : '✅ Translation coverage appears complete'}

### RTL Support

${bilingualAnalysis.rtlHandling && bilingualAnalysis.rtlHandling.length > 0 ? bilingualAnalysis.rtlHandling
  .map((issue: string) => `- ${issue}`)
  .join('\n') : '✅ RTL handling implemented'}

---

## Logic Correctness Audit

### Validation Rules

${logicAnalysis.validationRules && logicAnalysis.validationRules.length > 0 ? logicAnalysis.validationRules
  .map((rule: any) => `- **${rule.field}**: ${rule.rule} (timing: ${rule.timing})`)
  .join('\n') : '- No validation rules detected'}

### Edge Cases

${logicAnalysis.edgeCases && logicAnalysis.edgeCases.length > 0 ? logicAnalysis.edgeCases
  .map((edge: any) => `- **${edge.scenario}**: ${edge.handled ? '✅ Handled' : '❌ Not handled'}`)
  .join('\n') : '- No edge cases identified'}

### Error Handling

${logicAnalysis.errorHandling && logicAnalysis.errorHandling.length > 0 ? logicAnalysis.errorHandling
  .map((eh: any) => `- **${eh.type}**: ${eh.coverage}`)
  .join('\n') : '- Limited error handling detected'}

### Code Patches (HIGH/CRITICAL)

${generateCodePatches(findings)}

---

## UI/UX Polish Suggestions

### Layout Improvements

${(uiuxAnalysis.layout.grouping && uiuxAnalysis.layout.grouping.length > 0) || (uiuxAnalysis.layout.spacing && uiuxAnalysis.layout.spacing.length > 0) ? 
  [...(uiuxAnalysis.layout.grouping || []), ...(uiuxAnalysis.layout.spacing || [])]
    .map((item: string) => `- ${item}`)
    .join('\n') : '✅ Layout is well-structured'}

### Interaction Enhancements

${(uiuxAnalysis.interactions.buttonStates && uiuxAnalysis.interactions.buttonStates.length > 0) || (uiuxAnalysis.interactions.keyboardNav && uiuxAnalysis.interactions.keyboardNav.length > 0) ?
  [...(uiuxAnalysis.interactions.buttonStates || []), ...(uiuxAnalysis.interactions.keyboardNav || [])]
    .map((item: string) => `- ${item}`)
    .join('\n') : '✅ Interactions are well-implemented'}

### Feedback Mechanisms

${(uiuxAnalysis.feedback.validation && uiuxAnalysis.feedback.validation.length > 0) || (uiuxAnalysis.feedback.errorMessages && uiuxAnalysis.feedback.errorMessages.length > 0) ?
  [...(uiuxAnalysis.feedback.validation || []), ...(uiuxAnalysis.feedback.errorMessages || [])]
    .map((item: string) => `- ${item}`)
    .join('\n') : '✅ Feedback mechanisms are present'}

### Hand-Holding Opportunities

${handHoldingSuggestions.length > 0 ? handHoldingSuggestions
  .map((hs: any) => `- ${hs.suggestion}\n  - **EN:** ${hs.bilingualText.en}\n  - **FA:** ${hs.bilingualText.fa}`)
  .join('\n\n') : '✅ Adequate user guidance present'}

### Accessibility

${(uiuxAnalysis.accessibility.ariaLabels && uiuxAnalysis.accessibility.ariaLabels.length > 0) || (uiuxAnalysis.accessibility.keyboardOnly && uiuxAnalysis.accessibility.keyboardOnly.length > 0) ?
  [...(uiuxAnalysis.accessibility.ariaLabels || []), ...(uiuxAnalysis.accessibility.keyboardOnly || [])]
    .map((item: string) => `- ${item}`)
    .join('\n') : '✅ Accessibility features implemented'}

---

## Test Suggestions

### Unit Tests

1. **Teacher CRUD Operations**
   - Test adding new teacher
   - Test editing existing teacher
   - Test deleting teacher
   - Test teacher validation (name, periods, subjects)

2. **Subject Assignment**
   - Test assigning primary subjects
   - Test assigning allowed subjects
   - Test restrict to primary subjects toggle
   - Test single-teacher qualification detection

3. **Class Assignment**
   - Test assigning classes to teacher for subject
   - Test preventing duplicate assignments
   - Test workload calculation
   - Test assignment validation

4. **Availability Management**
   - Test setting availability grid
   - Test availability migration
   - Test variable periods per day
   - Test availability validation

5. **Workload Calculation**
   - Test total periods calculation
   - Test periods per subject calculation
   - Test utilization percentage
   - Test overload detection

### Integration Tests

1. **User Flow**
   - User adds teacher → assigns subjects → assigns classes → sets availability → saves
   - User edits teacher → changes subjects → class assignments update → saves
   - User deletes teacher → confirmation → removed from DB → dependent data cleaned

2. **Data Persistence**
   - Changes persist when navigating away and back
   - Teacher data syncs with store correctly
   - Availability persists correctly
   - Class assignments persist correctly

3. **Cross-Step Integration**
   - Teachers available in Classes step for assignment
   - Subject changes reflect in teacher subject lists
   - Period configuration changes trigger availability migration prompt

4. **Bulk Operations** (if implemented)
   - Select multiple teachers → bulk edit availability → all updated
   - Select multiple teachers → bulk assign subjects → all updated
   - Bulk operations handle errors gracefully

---

## Low-Level Code Fixes

${generateLowLevelFixes(findings)}

---

## Quick Wins Checklist

${generateQuickWins(findings)}

---

## Prioritized Task List

### Critical Priority (${criticalFindings.length})

${criticalFindings.length > 0 ? criticalFindings
  .map((f: AnalysisFinding) => `- **${f.title}** (${f.estimatedEffort})\n  - ${f.description}\n  - Files: ${f.filePaths.join(', ')}`)
  .join('\n\n') : '✅ No critical issues'}

### High Priority (${highFindings.length})

${highFindings.length > 0 ? highFindings
  .map((f: AnalysisFinding) => `- **${f.title}** (${f.estimatedEffort})\n  - ${f.description}\n  - Files: ${f.filePaths.join(', ')}`)
  .join('\n\n') : '✅ No high priority issues'}

### Medium Priority (${mediumFindings.length})

${mediumFindings.length > 0 ? mediumFindings
  .map((f: AnalysisFinding) => `- **${f.title}** (${f.estimatedEffort})\n  - ${f.description}\n  - Files: ${f.filePaths.join(', ')}`)
  .join('\n\n') : '✅ No medium priority issues'}

### Low Priority (${lowFindings.length})

${lowFindings.length > 0 ? lowFindings
  .map((f: AnalysisFinding) => `- **${f.title}** (${f.estimatedEffort})\n  - ${f.description}\n  - Files: ${f.filePaths.join(', ')}`)
  .join('\n\n') : '✅ No low priority issues'}

---

## Detailed Findings

${findings.map((f: AnalysisFinding, index: number) => `
### ${index + 1}. ${f.title}

**ID:** \`${f.id}\`  
**Category:** ${f.category}  
**Severity:** ${f.severity}  
**Effort:** ${f.estimatedEffort}  
**Files:** ${f.filePaths.map(p => `\`${p}\``).join(', ')}

**Description:**  
${f.description}

**Impact:**  
${f.impact}

**Suggested Fix:**  
${f.suggestedFix}

${f.codeSnippet ? `**Code Snippet:**\n\`\`\`typescript\n${f.codeSnippet}\n\`\`\`` : ''}

${f.reproductionSteps ? `**Reproduction Steps:**\n${f.reproductionSteps.map((step: string, i: number) => `${i + 1}. ${step}`).join('\n')}` : ''}

**Acceptance Criteria:**
${f.acceptanceCriteria.map((ac: string) => `- ${ac}`).join('\n')}
`).join('\n---\n')}

---

## Recommended Implementation Phases

Given the scope of UX improvements needed, we recommend a phased approach:

### Phase 1: Foundation (Week 1)
- Implement search and basic filtering
- Add workload visualization (progress bars)
- Improve availability migration with preview

### Phase 2: Bulk Operations (Week 2-3)
- Add bulk selection checkboxes
- Implement bulk availability editor
- Implement bulk subject assignment
- Add bulk constraint editor

### Phase 3: Advanced Views (Week 4)
- Implement grid view for availability
- Add advanced filtering (workload, single-teacher, etc.)
- Add expandable availability preview in list view

### Phase 4: Polish (Week 5)
- Performance optimizations
- Accessibility improvements
- Bilingual refinements
- User testing and feedback incorporation

---

## Analysis Metadata

- **Generated:** ${new Date().toISOString()}
- **Analyzer Version:** 1.0.0
- **Component:** ${filePath}
- **Total Findings:** ${findings.length}
- **Analysis Dimensions:** 9 (Architecture, Data Flow, Data Passing, UI/UX, Logic, Styling, Terminology, Performance, Bilingual)
- **Priority:** 🔴 HIGH - Requires dedicated usability sprint

`;
  
  return doc;
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateDataIntegrityFindings(findings: AnalysisFinding[]): string {
  const dataIntegrityFindings = findings.filter(f => 
    f.category === 'DataFlow' && 
    (f.severity === Severity.Critical || f.severity === Severity.High)
  );
  
  if (dataIntegrityFindings.length === 0) {
    return '\n✅ No critical data integrity issues detected';
  }
  
  return '\n#### Data Integrity Issues\n\n' + dataIntegrityFindings
    .map(f => `- **${f.title}**: ${f.description}`)
    .join('\n');
}

function generateCodePatches(findings: AnalysisFinding[]): string {
  const findingsWithCode = findings.filter(f => 
    f.codeSnippet && 
    (f.severity === Severity.Critical || f.severity === Severity.High)
  );
  
  if (findingsWithCode.length === 0) {
    return '\n✅ No immediate code patches required';
  }
  
  return '\n' + findingsWithCode
    .map(f => `#### ${f.title}\n\n\`\`\`typescript\n${f.codeSnippet}\n\`\`\`\n`)
    .join('\n');
}

function generateLowLevelFixes(findings: AnalysisFinding[]): string {
  const fixableFindings = findings.filter(f => 
    f.suggestedFix && f.estimatedEffort === 'Small'
  );
  
  if (fixableFindings.length === 0) {
    return '\n✅ No immediate low-level fixes required';
  }
  
  return '\n' + fixableFindings
    .map((f, index) => `### ${index + 1}. ${f.title}\n\n**Fix:** ${f.suggestedFix}\n\n**File:** \`${f.filePaths[0]}\`\n${f.codeSnippet ? `\n\`\`\`typescript\n${f.codeSnippet}\n\`\`\`\n` : ''}`)
    .join('\n');
}

function generateQuickWins(findings: AnalysisFinding[]): string {
  const quickWins = findings.filter(f => 
    f.estimatedEffort === 'Small' && 
    (f.severity === 'High' || f.severity === 'Medium')
  ).slice(0, 10);
  
  if (quickWins.length === 0) {
    return '\n✅ No quick wins identified - component is in good shape';
  }
  
  return '\n' + quickWins
    .map((f, index) => `${index + 1}. **${f.title}** (${f.severity})\n   - ${f.suggestedFix}\n   - File: \`${f.filePaths[0]}\``)
    .join('\n\n');
}

function printSummary(findings: AnalysisFinding[]): void {
  console.log('📊 Analysis Summary:');
  console.log('===================');
  console.log(`Total Findings: ${findings.length}`);
  console.log(`  - Critical: ${findings.filter(f => f.severity === Severity.Critical).length}`);
  console.log(`  - High: ${findings.filter(f => f.severity === Severity.High).length}`);
  console.log(`  - Medium: ${findings.filter(f => f.severity === Severity.Medium).length}`);
  console.log(`  - Low: ${findings.filter(f => f.severity === Severity.Low).length}`);
  console.log('\n🔴 HIGH PRIORITY: This step requires major UX improvements');
  console.log('   Recommended: Dedicated usability sprint for Teachers step');
  console.log('\n✨ Analysis complete!');
}

// ============================================================================
// Run Analysis
// ============================================================================

analyzeTeachersStep().catch(error => {
  console.error('❌ Analysis failed:', error);
  process.exit(1);
});
