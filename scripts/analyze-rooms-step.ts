/**
 * Rooms Step Analysis Script
 * 
 * Runs all analyzers on the rooms-step component and generates
 * a comprehensive audit document.
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
import { AnalysisFinding, Severity, BilingualText } from './analysis-types';

// ============================================================================
// Configuration
// ============================================================================

const STEP_NAME = 'rooms';
const STEP_FILE = 'packages/web/src/components/wizard/steps/rooms-step.tsx';
const OUTPUT_FILE = 'docs/rooms-audit.md';

// ============================================================================
// Main Analysis Function
// ============================================================================

async function analyzeRoomsStep() {
  console.log('🔍 Starting Rooms Step Analysis...\n');
  
  // Read the component file
  const content = fs.readFileSync(STEP_FILE, 'utf-8');
  
  // Run all analyzers
  console.log('📊 Running analyzers...');
  
  const architectureAnalysis = analyzeArchitecture(STEP_FILE, content);
  const dataFlowAnalysis = analyzeDataFlow(STEP_FILE, content);
  const uiuxAnalysis = analyzeUIUX(STEP_FILE, content);
  const logicAnalysis = analyzeLogic(STEP_FILE, content);
  const stylingAnalysis = analyzeStyling(STEP_FILE, content);
  const terminologyAnalysis = analyzeTerminology(STEP_FILE, content);
  const performanceAnalysis = analyzePerformance(STEP_FILE, content);
  const bilingualAnalysis = analyzeBilingualSupport(STEP_FILE, content);
  
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
    ...generateBilingualFindings(STEP_NAME, STEP_FILE, bilingualAnalysis)
  ];
  
  console.log(`✅ Generated ${allFindings.length} findings\n`);
  
  // Generate hand-holding suggestions
  const handHoldingSuggestions = generateHandHoldingSuggestions(STEP_NAME, content);
  
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
  
  let doc = `# Rooms Step - Deep Audit

**Generated:** ${new Date().toISOString()}

**Component:** \`${filePath}\`

## Executive Summary

This audit analyzes the Rooms wizard step across 9 dimensions: architecture, data flow, data passing, UI/UX, logic, styling, terminology, performance, and bilingual support.

### Findings Summary

- **Critical:** ${criticalFindings.length}
- **High:** ${highFindings.length}
- **Medium:** ${mediumFindings.length}
- **Low:** ${lowFindings.length}
- **Total:** ${findings.length}

---

## Component Inventory

### Main Component
- **File:** \`${filePath}\`
- **Size:** ${architectureAnalysis.complexity.linesOfCode} lines of code
- **Complexity:** ${architectureAnalysis.complexity.cyclomaticComplexity} (cyclomatic)
- **Structure:** ${architectureAnalysis.componentStructure}

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

#### Utilities
${architectureAnalysis.dependencies
  .filter((d: any) => d.type === 'utility')
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

1. **Room CRUD Operations**
   - Test adding new room
   - Test editing existing room
   - Test deleting room
   - Test room validation (name, type, capacity)

2. **Room Type Management**
   - Test common room types dropdown
   - Test custom room type entry
   - Test room type persistence
   - Test room type filtering

3. **Capacity Validation**
   - Test capacity minimum (1)
   - Test capacity maximum (1000)
   - Test capacity numeric validation
   - Test capacity display in statistics

4. **Batch Operations**
   - Test adding multiple rooms at once
   - Test saving all changes
   - Test validation of multiple rows
   - Test partial save handling

5. **Statistics Calculation**
   - Test total capacity calculation
   - Test average capacity calculation
   - Test unique types count
   - Test saved vs new room counts

### Integration Tests

1. **User Flow**
   - User adds room → fills details → saves
   - User edits room → changes details → saves
   - User deletes room → confirmation → removed from DB
   - User adds multiple rooms → saves all at once

2. **Data Persistence**
   - Changes persist when navigating away and back
   - Auto-save triggers after modifications
   - Data syncs with room store correctly
   - Room data available in subsequent steps

3. **Cross-Step Integration**
   - Rooms available for class assignment
   - Room capacity affects class placement
   - Room types filter appropriately
   - Changes in rooms reflect in constraints step

4. **Validation Flow**
   - Validate all rooms → navigation enabled/disabled correctly
   - Fix validation errors → navigation enabled
   - Missing required data → clear error messages
   - Invalid capacity → appropriate error handling

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

## Analysis Metadata

- **Generated:** ${new Date().toISOString()}
- **Analyzer Version:** 1.0.0
- **Component:** ${filePath}
- **Total Findings:** ${findings.length}
- **Analysis Dimensions:** 9 (Architecture, Data Flow, Data Passing, UI/UX, Logic, Styling, Terminology, Performance, Bilingual)

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
  console.log('\n✨ Analysis complete!');
}

// ============================================================================
// Run Analysis
// ============================================================================

analyzeRoomsStep().catch(error => {
  console.error('❌ Analysis failed:', error);
  process.exit(1);
});
