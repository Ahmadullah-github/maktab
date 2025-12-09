/**
 * Logic Analyzer
 * 
 * Documents validation rules and timing, identifies missing edge-case checks,
 * analyzes error handling patterns, and traces state transitions and
 * navigation logic.
 */

import {
  LogicAnalysis,
  ValidationRule,
  EdgeCase,
  ErrorHandling,
  StateTransition,
  AnalysisFinding,
  FindingCategory,
  Severity,
  Effort
} from '../analysis-types';

// ============================================================================
// Validation Analysis
// ============================================================================

function extractValidationRules(content: string): ValidationRule[] {
  const rules: ValidationRule[] = [];
  
  // Look for Zod schemas
  const zodSchemaPattern = /z\.object\({([^}]+)}\)/gs;
  let match;
  
  while ((match = zodSchemaPattern.exec(content)) !== null) {
    const schemaContent = match[1];
    
    // Extract individual field validations
    const fieldPattern = /(\w+):\s*z\.(\w+)\(\)([^,\n]*)/g;
    let fieldMatch;
    
    while ((fieldMatch = fieldPattern.exec(schemaContent)) !== null) {
      const field = fieldMatch[1];
      const type = fieldMatch[2];
      const constraints = fieldMatch[3];
      
      // Extract error message if present
      const errorMatch = constraints.match(/['"]([^'"]+)['"]/);
      const errorMessage = errorMatch ? errorMatch[1] : `${field} validation failed`;
      
      rules.push({
        field,
        rule: `${type}${constraints}`,
        timing: 'submit', // Default for Zod
        errorMessage
      });
    }
  }
  
  // Look for inline validation
  const inlineValidationPattern = /if\s*\([^)]*(!|\bnot\b|===\s*['"]{2}|===\s*null|===\s*undefined)([^)]*)\)\s*{[^}]*(?:error|setError|invalid)/gi;
  
  while ((match = inlineValidationPattern.exec(content)) !== null) {
    const condition = match[0];
    
    // Try to extract field name
    const fieldMatch = condition.match(/(\w+)(?:\.value|\.length)?/);
    const field = fieldMatch ? fieldMatch[1] : 'unknown';
    
    rules.push({
      field,
      rule: 'Custom validation',
      timing: 'blur', // Assume blur for inline validation
      errorMessage: 'Validation error'
    });
  }
  
  // Look for required field checks
  const requiredPattern = /required|isRequired/gi;
  if (requiredPattern.test(content)) {
    rules.push({
      field: 'multiple',
      rule: 'Required field validation',
      timing: 'submit',
      errorMessage: 'This field is required'
    });
  }
  
  return rules;
}

// ============================================================================
// Edge Case Analysis
// ============================================================================

function identifyEdgeCases(content: string): EdgeCase[] {
  const edgeCases: EdgeCase[] = [];
  
  // Empty state handling
  const hasEmptyCheck = /\.length\s*===\s*0|\.length\s*<\s*1|!.*\.length/.test(content);
  edgeCases.push({
    scenario: 'Empty data/list',
    currentHandling: hasEmptyCheck ? 'Checked' : 'Not checked',
    issue: hasEmptyCheck ? undefined : 'No empty state handling detected',
    recommendation: hasEmptyCheck ? undefined : 'Add empty state UI and validation'
  });
  
  // Null/undefined handling
  const hasNullCheck = /===\s*null|===\s*undefined|!\w+|optional\?/.test(content);
  edgeCases.push({
    scenario: 'Null/undefined values',
    currentHandling: hasNullCheck ? 'Checked' : 'Not checked',
    issue: hasNullCheck ? undefined : 'Missing null/undefined checks',
    recommendation: hasNullCheck ? undefined : 'Add null checks before accessing properties'
  });
  
  // Duplicate handling
  const hasDuplicateCheck = /duplicate|unique|Set\(|indexOf/.test(content);
  edgeCases.push({
    scenario: 'Duplicate entries',
    currentHandling: hasDuplicateCheck ? 'Checked' : 'Not checked',
    issue: hasDuplicateCheck ? undefined : 'No duplicate detection',
    recommendation: hasDuplicateCheck ? undefined : 'Validate for duplicates before adding items'
  });
  
  // Maximum limits
  const hasMaxCheck = /\.length\s*>\s*\d+|max(?:Length|Count|Size)/.test(content);
  edgeCases.push({
    scenario: 'Maximum item limits',
    currentHandling: hasMaxCheck ? 'Checked' : 'Not checked',
    issue: hasMaxCheck ? undefined : 'No maximum limit enforcement',
    recommendation: hasMaxCheck ? undefined : 'Set reasonable maximum limits for lists'
  });
  
  // Special characters in input
  const hasSanitization = /sanitize|escape|trim|replace/.test(content);
  edgeCases.push({
    scenario: 'Special characters in input',
    currentHandling: hasSanitization ? 'Sanitized' : 'Not sanitized',
    issue: hasSanitization ? undefined : 'No input sanitization',
    recommendation: hasSanitization ? undefined : 'Sanitize user input to prevent issues'
  });
  
  // Network failure
  const hasNetworkErrorHandling = /catch|\.catch\(|try\s*{/.test(content) && /fetch|axios/.test(content);
  edgeCases.push({
    scenario: 'Network/API failure',
    currentHandling: hasNetworkErrorHandling ? 'Handled' : 'Not handled',
    issue: hasNetworkErrorHandling ? undefined : 'No network error handling',
    recommendation: hasNetworkErrorHandling ? undefined : 'Add try-catch for API calls'
  });
  
  // Concurrent modifications
  const hasConcurrencyHandling = /version|timestamp|etag|optimistic/.test(content);
  edgeCases.push({
    scenario: 'Concurrent data modifications',
    currentHandling: hasConcurrencyHandling ? 'Handled' : 'Not handled',
    issue: hasConcurrencyHandling ? undefined : 'No concurrency handling',
    recommendation: hasConcurrencyHandling ? undefined : 'Consider optimistic locking or version checks'
  });
  
  return edgeCases;
}

// ============================================================================
// Error Handling Analysis
// ============================================================================

function analyzeErrorHandling(content: string, filePath: string): ErrorHandling[] {
  const errorHandling: ErrorHandling[] = [];
  
  // Try-catch blocks
  const tryCatchPattern = /try\s*{([^}]+)}\s*catch\s*\(([^)]+)\)\s*{([^}]+)}/gs;
  let match;
  
  while ((match = tryCatchPattern.exec(content)) !== null) {
    const tryBlock = match[1];
    const catchParam = match[2];
    const catchBlock = match[3];
    
    const gaps: string[] = [];
    
    // Check if error is logged
    if (!catchBlock.includes('console.') && !catchBlock.includes('logger')) {
      gaps.push('Error not logged');
    }
    
    // Check if user is notified
    if (!catchBlock.includes('toast') && !catchBlock.includes('alert') && !catchBlock.includes('setError')) {
      gaps.push('User not notified of error');
    }
    
    errorHandling.push({
      location: filePath,
      type: 'try-catch',
      coverage: 'Async operations',
      gaps: gaps.length > 0 ? gaps : undefined
    });
  }
  
  // Promise .catch()
  const promiseCatchPattern = /\.catch\s*\(([^)]+)\s*=>\s*{([^}]+)}\)/gs;
  
  while ((match = promiseCatchPattern.exec(content)) !== null) {
    const catchBlock = match[2];
    
    const gaps: string[] = [];
    
    if (!catchBlock.includes('console.') && !catchBlock.includes('logger')) {
      gaps.push('Error not logged');
    }
    
    if (!catchBlock.includes('toast') && !catchBlock.includes('alert') && !catchBlock.includes('setError')) {
      gaps.push('User not notified of error');
    }
    
    errorHandling.push({
      location: filePath,
      type: 'Promise .catch()',
      coverage: 'Promise rejections',
      gaps: gaps.length > 0 ? gaps : undefined
    });
  }
  
  // Error boundaries (React)
  const hasErrorBoundary = /ErrorBoundary|componentDidCatch|getDerivedStateFromError/.test(content);
  
  if (hasErrorBoundary) {
    errorHandling.push({
      location: filePath,
      type: 'Error Boundary',
      coverage: 'Component errors'
    });
  }
  
  // If no error handling found
  if (errorHandling.length === 0) {
    const hasAsyncOps = /async|await|fetch|axios|\.then\(/.test(content);
    
    if (hasAsyncOps) {
      errorHandling.push({
        location: filePath,
        type: 'None',
        coverage: 'None',
        gaps: ['No error handling for async operations']
      });
    }
  }
  
  return errorHandling;
}

// ============================================================================
// State Transition Analysis
// ============================================================================

function traceStateTransitions(content: string): StateTransition[] {
  const transitions: StateTransition[] = [];
  
  // Look for navigation calls
  const navigationPattern = /(?:navigate|router\.push|history\.push)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  let match;
  
  while ((match = navigationPattern.exec(content)) !== null) {
    const destination = match[1];
    
    // Try to find what triggers this navigation
    const contextStart = Math.max(0, match.index - 100);
    const context = content.substring(contextStart, match.index);
    
    let trigger = 'Unknown';
    if (/onClick|handleClick|handleNext/.test(context)) {
      trigger = 'Button click';
    } else if (/onSubmit|handleSubmit/.test(context)) {
      trigger = 'Form submission';
    } else if (/useEffect/.test(context)) {
      trigger = 'Side effect';
    }
    
    transitions.push({
      from: 'Current step',
      to: destination,
      trigger,
      dataChanges: []
    });
  }
  
  // Look for state updates before navigation
  const stateUpdatePattern = /set\w+\([^)]+\)[^;]*;[^;]*(?:navigate|router\.push)/g;
  
  while ((match = stateUpdatePattern.exec(content)) !== null) {
    const stateUpdate = match[0];
    const setterMatch = stateUpdate.match(/set(\w+)/);
    
    if (setterMatch && transitions.length > 0) {
      const lastTransition = transitions[transitions.length - 1];
      lastTransition.dataChanges.push(setterMatch[1]);
    }
  }
  
  // Look for step changes in wizard
  const stepChangePattern = /(?:setCurrentStep|setStep|goToStep)\s*\(([^)]+)\)/g;
  
  while ((match = stepChangePattern.exec(content)) !== null) {
    const stepValue = match[1];
    
    transitions.push({
      from: 'Current step',
      to: `Step ${stepValue}`,
      trigger: 'Step change',
      dataChanges: []
    });
  }
  
  return transitions;
}

// ============================================================================
// Main Analyzer Function
// ============================================================================

/**
 * Analyze logic patterns in a wizard step component
 */
export function analyzeLogic(
  filePath: string,
  content: string
): LogicAnalysis {
  return {
    validationRules: extractValidationRules(content),
    edgeCases: identifyEdgeCases(content),
    errorHandling: analyzeErrorHandling(content, filePath),
    stateTransitions: traceStateTransitions(content)
  };
}

/**
 * Generate logic findings from analysis
 */
export function generateLogicFindings(
  stepName: string,
  filePath: string,
  analysis: LogicAnalysis
): AnalysisFinding[] {
  const findings: AnalysisFinding[] = [];
  let findingId = 1;
  
  // Validation findings
  if (analysis.validationRules.length === 0) {
    findings.push({
      id: `${stepName}-LOGIC-${findingId++}`,
      stepName,
      category: FindingCategory.Validation,
      severity: Severity.High,
      title: 'No validation rules found',
      description: 'Component has no validation logic for form inputs.',
      impact: 'Users can submit invalid data, causing errors downstream or in the backend.',
      filePaths: [filePath],
      suggestedFix: 'Implement validation using Zod schema or custom validation functions.',
      codeSnippet: `import { z } from 'zod';\n\nconst schema = z.object({\n  name: z.string().min(1, 'Name is required'),\n  email: z.string().email('Invalid email'),\n  age: z.number().min(0).max(120)\n});\n\nconst { errors, validate } = useValidation(schema);`,
      estimatedEffort: Effort.Medium,
      acceptanceCriteria: [
        'All form fields have validation rules',
        'Validation runs at appropriate times',
        'Clear error messages are shown'
      ]
    });
  }
  
  // Edge case findings
  const unhandledEdgeCases = analysis.edgeCases.filter(ec => ec.issue);
  
  if (unhandledEdgeCases.length > 0) {
    const criticalEdgeCases = unhandledEdgeCases.filter(ec => 
      ec.scenario.includes('Null') || ec.scenario.includes('Empty') || ec.scenario.includes('Network')
    );
    
    if (criticalEdgeCases.length > 0) {
      findings.push({
        id: `${stepName}-LOGIC-${findingId++}`,
        stepName,
        category: FindingCategory.Logic,
        severity: Severity.High,
        title: 'Missing critical edge case handling',
        description: `Unhandled edge cases: ${criticalEdgeCases.map(ec => ec.scenario).join(', ')}`,
        impact: 'Application may crash or behave unexpectedly in edge cases.',
        filePaths: [filePath],
        suggestedFix: criticalEdgeCases.map(ec => ec.recommendation).join('; '),
        codeSnippet: `// Handle null/undefined:\nif (!data || data.length === 0) {\n  return <EmptyState message="No data available" />;\n}\n\n// Handle network errors:\ntry {\n  const response = await fetchData();\n  setData(response);\n} catch (error) {\n  console.error('Failed to fetch:', error);\n  toast.error('Failed to load data. Please try again.');\n}`,
        estimatedEffort: Effort.Medium,
        acceptanceCriteria: [
          'All critical edge cases are handled',
          'No crashes in edge case scenarios',
          'User sees appropriate feedback'
        ]
      });
    }
  }
  
  // Error handling findings
  const errorHandlingGaps = analysis.errorHandling.filter(eh => eh.gaps && eh.gaps.length > 0);
  
  if (errorHandlingGaps.length > 0) {
    findings.push({
      id: `${stepName}-LOGIC-${findingId++}`,
      stepName,
      category: FindingCategory.Logic,
      severity: Severity.Medium,
      title: 'Incomplete error handling',
      description: `Error handling gaps: ${errorHandlingGaps.flatMap(eh => eh.gaps || []).join('; ')}`,
      impact: 'Errors may go unnoticed by developers and users may not understand what went wrong.',
      filePaths: [filePath],
      suggestedFix: 'Log all errors and notify users with actionable error messages.',
      codeSnippet: `try {\n  await saveData(formData);\n  toast.success('Data saved successfully');\n} catch (error) {\n  // Log for debugging\n  console.error('Save failed:', error);\n  \n  // Notify user\n  toast.error('Failed to save data. Please try again.');\n  \n  // Update UI state\n  setError('save', { message: 'Save failed' });\n}`,
      estimatedEffort: Effort.Small,
      acceptanceCriteria: [
        'All errors are logged',
        'Users are notified of errors',
        'Error messages are actionable'
      ]
    });
  }
  
  // State transition findings
  if (analysis.stateTransitions.length === 0) {
    findings.push({
      id: `${stepName}-LOGIC-${findingId++}`,
      stepName,
      category: FindingCategory.Logic,
      severity: Severity.Low,
      title: 'No navigation logic detected',
      description: 'Component does not appear to handle navigation to other steps.',
      impact: 'May indicate incomplete implementation or missing navigation buttons.',
      filePaths: [filePath],
      suggestedFix: 'Add Next/Back buttons with proper navigation logic.',
      estimatedEffort: Effort.Small,
      acceptanceCriteria: [
        'Navigation buttons are present',
        'Navigation updates wizard state',
        'Data is saved before navigation'
      ]
    });
  }
  
  // Check for validation timing
  const hasBlurValidation = analysis.validationRules.some(rule => rule.timing === 'blur');
  const hasSubmitValidation = analysis.validationRules.some(rule => rule.timing === 'submit');
  
  if (hasSubmitValidation && !hasBlurValidation) {
    findings.push({
      id: `${stepName}-LOGIC-${findingId++}`,
      stepName,
      category: FindingCategory.Validation,
      severity: Severity.Low,
      title: 'Consider adding blur validation',
      description: 'Validation only runs on submit. Consider adding blur validation for better UX.',
      impact: 'Users only see validation errors after submitting, which can be frustrating.',
      filePaths: [filePath],
      suggestedFix: 'Add onBlur handlers to validate fields as users complete them.',
      codeSnippet: `<Input\n  onBlur={(e) => validate('fieldName', e.target.value)}\n  onChange={(e) => setValue(e.target.value)}\n/>`,
      estimatedEffort: Effort.Small,
      acceptanceCriteria: [
        'Fields validate on blur',
        'Errors appear immediately after leaving field',
        'Submit validation still works'
      ]
    });
  }
  
  return findings;
}
