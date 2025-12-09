/**
 * Data Passing Analyzer
 * 
 * Documents inter-step data dependencies, creates data flow diagrams,
 * identifies data loss scenarios during navigation, and analyzes handling
 * of disabled/skipped steps.
 */

import {
  AnalysisFinding,
  FindingCategory,
  Severity,
  Effort
} from '../analysis-types';

// ============================================================================
// Types
// ============================================================================

export interface StepDataDependency {
  stepName: string;
  dependsOn: string[];          // Previous steps this step depends on
  provides: string[];           // Data this step provides to next steps
  requiredData: string[];       // Data that must exist for this step to work
  optionalData: string[];       // Data that enhances this step but isn't required
}

export interface DataLossScenario {
  scenario: string;
  steps: string[];              // Steps involved
  dataAtRisk: string[];         // What data could be lost
  trigger: string;              // What causes the loss
  prevention: string;           // How to prevent it
}

export interface DataFlowDiagram {
  stepName: string;
  inputs: {
    source: string;
    data: string[];
  }[];
  processing: string[];         // What happens to the data
  outputs: {
    destination: string;
    data: string[];
  }[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract data dependencies from step content
 */
function extractDataDependencies(
  stepName: string,
  content: string,
  stepIndex: number
): StepDataDependency {
  const dependsOn: string[] = [];
  const provides: string[] = [];
  const requiredData: string[] = [];
  const optionalData: string[] = [];
  
  // Analyze store selectors to understand dependencies
  const storePattern = /const\s+{([^}]+)}\s*=\s*use(\w+)Store\s*\(/g;
  let match;
  
  while ((match = storePattern.exec(content)) !== null) {
    const storeName = match[2];
    const selectors = match[1].split(',').map(s => s.trim());
    
    for (const selector of selectors) {
      // If it's a getter (not a setter), it's a dependency
      if (!selector.startsWith('set') && !selector.startsWith('update')) {
        requiredData.push(`${storeName}.${selector}`);
      }
      // If it's a setter, this step provides data
      if (selector.startsWith('set') || selector.startsWith('update')) {
        provides.push(`${storeName}.${selector.replace(/^set|^update/, '')}`);
      }
    }
  }
  
  // Check for conditional rendering based on previous step data
  const conditionalPattern = /if\s*\([^)]*(?:schoolInfo|periods|subjects|teachers|classes|rooms|constraints)[^)]*\)/gi;
  const conditionals = content.match(conditionalPattern) || [];
  
  for (const conditional of conditionals) {
    const stepRefs = conditional.match(/schoolInfo|periods|subjects|teachers|classes|rooms|constraints/gi);
    if (stepRefs) {
      for (const ref of stepRefs) {
        if (!dependsOn.includes(ref)) {
          dependsOn.push(ref);
        }
      }
    }
  }
  
  return {
    stepName,
    dependsOn,
    provides,
    requiredData,
    optionalData
  };
}

/**
 * Identify potential data loss scenarios
 */
function identifyDataLossScenarios(
  stepName: string,
  content: string,
  dependencies: StepDataDependency
): DataLossScenario[] {
  const scenarios: DataLossScenario[] = [];
  
  // Scenario 1: No persistence before navigation
  const hasNavigationButtons = /(?:onNext|onBack|onPrevious|navigate)/i.test(content);
  const hasPersistence = /(?:localStorage\.setItem|setWizardData|saveData)/i.test(content);
  
  if (hasNavigationButtons && !hasPersistence) {
    scenarios.push({
      scenario: 'Data loss on navigation',
      steps: [stepName],
      dataAtRisk: dependencies.provides,
      trigger: 'User clicks Next/Back without auto-save',
      prevention: 'Add debounced auto-save or save on navigation button click'
    });
  }
  
  // Scenario 2: No validation before navigation
  const hasValidation = /(?:validate|isValid|errors)/i.test(content);
  
  if (hasNavigationButtons && !hasValidation) {
    scenarios.push({
      scenario: 'Invalid data persisted',
      steps: [stepName],
      dataAtRisk: dependencies.provides,
      trigger: 'User navigates with invalid data',
      prevention: 'Validate data before allowing navigation'
    });
  }
  
  // Scenario 3: Async operations without completion check
  const hasAsyncOps = /async|await|\.then\(/i.test(content);
  const hasLoadingState = /(?:loading|isLoading|isSaving)/i.test(content);
  
  if (hasAsyncOps && hasNavigationButtons && !hasLoadingState) {
    scenarios.push({
      scenario: 'Navigation during async operation',
      steps: [stepName],
      dataAtRisk: dependencies.provides,
      trigger: 'User navigates while data is being saved',
      prevention: 'Disable navigation buttons during async operations'
    });
  }
  
  // Scenario 4: Missing data from previous steps
  if (dependencies.requiredData.length > 0) {
    scenarios.push({
      scenario: 'Missing required data from previous steps',
      steps: [stepName, ...dependencies.dependsOn],
      dataAtRisk: dependencies.requiredData,
      trigger: 'User skips previous steps or data not persisted',
      prevention: 'Check for required data on mount and redirect if missing'
    });
  }
  
  return scenarios;
}

/**
 * Create data flow diagram for a step
 */
function createDataFlowDiagram(
  stepName: string,
  content: string,
  dependencies: StepDataDependency
): DataFlowDiagram {
  const inputs: DataFlowDiagram['inputs'] = [];
  const processing: string[] = [];
  const outputs: DataFlowDiagram['outputs'] = [];
  
  // Inputs from stores
  if (dependencies.requiredData.length > 0) {
    inputs.push({
      source: 'Zustand Store',
      data: dependencies.requiredData
    });
  }
  
  // Inputs from localStorage
  const localStorageReads = content.match(/localStorage\.getItem\s*\(\s*['"]([^'"]+)['"]/g);
  if (localStorageReads) {
    const keys = localStorageReads.map(read => {
      const match = read.match(/['"]([^'"]+)['"]/);
      return match ? match[1] : '';
    }).filter(Boolean);
    
    if (keys.length > 0) {
      inputs.push({
        source: 'localStorage',
        data: keys
      });
    }
  }
  
  // Processing steps
  if (content.includes('useState')) {
    processing.push('Local state management');
  }
  if (content.includes('validate') || content.includes('isValid')) {
    processing.push('Data validation');
  }
  if (content.includes('transform') || content.includes('map(')) {
    processing.push('Data transformation');
  }
  if (content.includes('filter(')) {
    processing.push('Data filtering');
  }
  
  // Outputs to stores
  if (dependencies.provides.length > 0) {
    outputs.push({
      destination: 'Zustand Store',
      data: dependencies.provides
    });
  }
  
  // Outputs to localStorage
  const localStorageWrites = content.match(/localStorage\.setItem\s*\(\s*['"]([^'"]+)['"]/g);
  if (localStorageWrites) {
    const keys = localStorageWrites.map(write => {
      const match = write.match(/['"]([^'"]+)['"]/);
      return match ? match[1] : '';
    }).filter(Boolean);
    
    if (keys.length > 0) {
      outputs.push({
        destination: 'localStorage',
        data: keys
      });
    }
  }
  
  // Outputs to API
  const apiWrites = content.match(/(?:fetch|axios\.(?:post|put))\s*\(\s*['"`]([^'"`]+)['"`]/g);
  if (apiWrites) {
    const endpoints = apiWrites.map(write => {
      const match = write.match(/['"`]([^'"`]+)['"`]/);
      return match ? match[1] : '';
    }).filter(Boolean);
    
    if (endpoints.length > 0) {
      outputs.push({
        destination: 'Backend API',
        data: endpoints
      });
    }
  }
  
  return {
    stepName,
    inputs,
    processing,
    outputs
  };
}

/**
 * Analyze handling of disabled/skipped steps
 */
function analyzeSkippedStepHandling(
  stepName: string,
  content: string,
  dependencies: StepDataDependency
): string[] {
  const issues: string[] = [];
  
  // Check if step checks for required data
  const hasDataCheck = /if\s*\([^)]*(?:!|not|undefined|null)[^)]*\)/i.test(content);
  
  if (dependencies.requiredData.length > 0 && !hasDataCheck) {
    issues.push('No check for required data from previous steps');
  }
  
  // Check for fallback UI when data is missing
  const hasFallbackUI = /(?:EmptyState|NoData|Placeholder|Loading)/i.test(content);
  
  if (dependencies.requiredData.length > 0 && !hasFallbackUI) {
    issues.push('No fallback UI when required data is missing');
  }
  
  // Check for redirect logic
  const hasRedirect = /(?:navigate|redirect|router\.push)/i.test(content);
  
  if (dependencies.requiredData.length > 0 && !hasRedirect) {
    issues.push('No redirect logic when required data is missing');
  }
  
  return issues;
}

// ============================================================================
// Main Analyzer Function
// ============================================================================

/**
 * Analyze data passing patterns in a wizard step
 */
export function analyzeDataPassing(
  stepName: string,
  stepIndex: number,
  content: string
): {
  dependencies: StepDataDependency;
  dataLossScenarios: DataLossScenario[];
  dataFlowDiagram: DataFlowDiagram;
  skippedStepIssues: string[];
} {
  const dependencies = extractDataDependencies(stepName, content, stepIndex);
  const dataLossScenarios = identifyDataLossScenarios(stepName, content, dependencies);
  const dataFlowDiagram = createDataFlowDiagram(stepName, content, dependencies);
  const skippedStepIssues = analyzeSkippedStepHandling(stepName, content, dependencies);
  
  return {
    dependencies,
    dataLossScenarios,
    dataFlowDiagram,
    skippedStepIssues
  };
}

/**
 * Generate data passing findings from analysis
 */
export function generateDataPassingFindings(
  stepName: string,
  filePath: string,
  analysis: ReturnType<typeof analyzeDataPassing>
): AnalysisFinding[] {
  const findings: AnalysisFinding[] = [];
  let findingId = 1;
  
  // Findings for data loss scenarios
  for (const scenario of analysis.dataLossScenarios) {
    const severity = scenario.dataAtRisk.length > 3 ? Severity.Critical : Severity.High;
    
    findings.push({
      id: `${stepName}-DATAPASS-${findingId++}`,
      stepName,
      category: FindingCategory.DataPassing,
      severity,
      title: scenario.scenario,
      description: `Data at risk: ${scenario.dataAtRisk.join(', ')}. Triggered by: ${scenario.trigger}`,
      impact: 'User may lose entered data, leading to frustration and need to re-enter information.',
      filePaths: [filePath],
      reproductionSteps: [
        `Navigate to ${stepName} step`,
        'Enter data in form fields',
        scenario.trigger,
        'Check if data is preserved'
      ],
      suggestedFix: scenario.prevention,
      estimatedEffort: Effort.Small,
      acceptanceCriteria: [
        'Data persists when navigating between steps',
        'No data loss on page refresh',
        'User can safely navigate back and forth'
      ]
    });
  }
  
  // Findings for skipped step handling issues
  if (analysis.skippedStepIssues.length > 0) {
    findings.push({
      id: `${stepName}-DATAPASS-${findingId++}`,
      stepName,
      category: FindingCategory.DataPassing,
      severity: Severity.High,
      title: 'Missing data handling for skipped steps',
      description: `Issues found: ${analysis.skippedStepIssues.join('; ')}`,
      impact: 'Component may crash or show broken UI when required data from previous steps is missing.',
      filePaths: [filePath],
      suggestedFix: 'Add checks for required data on component mount. Show appropriate fallback UI or redirect to previous step.',
      codeSnippet: `// Add data check on mount:\nuseEffect(() => {\n  if (!requiredData) {\n    // Option 1: Redirect to previous step\n    navigate('/wizard/previous-step');\n    \n    // Option 2: Show empty state\n    setShowEmptyState(true);\n  }\n}, [requiredData]);`,
      estimatedEffort: Effort.Small,
      acceptanceCriteria: [
        'Component handles missing data gracefully',
        'User sees helpful message when data is missing',
        'No crashes or undefined errors'
      ]
    });
  }
  
  // Finding for missing inter-step dependencies
  if (analysis.dependencies.requiredData.length > 0 && analysis.dependencies.dependsOn.length === 0) {
    findings.push({
      id: `${stepName}-DATAPASS-${findingId++}`,
      stepName,
      category: FindingCategory.DataPassing,
      severity: Severity.Medium,
      title: 'Unclear inter-step dependencies',
      description: `Step requires data (${analysis.dependencies.requiredData.join(', ')}) but dependencies on previous steps are not explicit.`,
      impact: 'Makes it harder to understand wizard flow and maintain data consistency.',
      filePaths: [filePath],
      suggestedFix: 'Document which previous steps this step depends on. Add explicit checks for required data.',
      estimatedEffort: Effort.Small,
      acceptanceCriteria: [
        'Dependencies are clearly documented',
        'Required data is validated on mount',
        'Error messages guide user to complete previous steps'
      ]
    });
  }
  
  return findings;
}

/**
 * Generate Mermaid diagram for data flow
 */
export function generateDataFlowMermaidDiagram(diagram: DataFlowDiagram): string {
  const lines: string[] = [
    '```mermaid',
    'graph LR',
    ''
  ];
  
  // Add input nodes
  diagram.inputs.forEach((input, idx) => {
    lines.push(`  INPUT${idx}["${input.source}"]`);
    lines.push(`  INPUT${idx} -->|${input.data.join(', ')}| STEP`);
  });
  
  // Add step node
  lines.push(`  STEP["${diagram.stepName}"]`);
  
  // Add processing
  if (diagram.processing.length > 0) {
    lines.push(`  STEP -->|${diagram.processing.join(', ')}| PROCESS`);
    lines.push(`  PROCESS["Processing"]`);
  }
  
  // Add output nodes
  diagram.outputs.forEach((output, idx) => {
    const source = diagram.processing.length > 0 ? 'PROCESS' : 'STEP';
    lines.push(`  ${source} -->|${output.data.join(', ')}| OUTPUT${idx}`);
    lines.push(`  OUTPUT${idx}["${output.destination}"]`);
  });
  
  lines.push('```');
  
  return lines.join('\n');
}
