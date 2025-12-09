/**
 * Data Flow Analyzer
 * 
 * Traces data inputs from previous steps and stores, data outputs to next steps
 * and persistence layers, identifies race conditions in async operations, and
 * detects localStorage and API usage patterns.
 */

import {
  DataFlowAnalysis,
  DataInput,
  DataOutput,
  StoreUsage,
  APICall,
  RaceCondition,
  StateVariable,
  AnalysisFinding,
  FindingCategory,
  Severity,
  Effort
} from '../analysis-types';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract state variables from component
 */
function extractStateVariables(content: string): StateVariable[] {
  const stateVars: StateVariable[] = [];
  
  // Match useState patterns: const [state, setState] = useState(initialValue)
  const statePattern = /const\s+\[(\w+),\s*(\w+)\]\s*=\s*useState(?:<[^>]+>)?\s*\(([^)]*)\)/g;
  
  let match;
  while ((match = statePattern.exec(content)) !== null) {
    stateVars.push({
      name: match[1],
      type: 'unknown', // Would need type analysis
      initialValue: match[3].trim() || 'undefined',
      setter: match[2]
    });
  }
  
  return stateVars;
}

/**
 * Extract Zustand store usage
 */
function extractStoreUsage(content: string): StoreUsage[] {
  const stores: StoreUsage[] = [];
  
  // Match store hook patterns: const { method1, method2 } = useStore()
  const storePattern = /const\s+{([^}]+)}\s*=\s*(use\w+Store)\s*\(/g;
  
  let match;
  while ((match = storePattern.exec(content)) !== null) {
    const storeName = match[2];
    const methods = match[1].split(',').map(m => m.trim());
    
    stores.push({
      storeName,
      methods,
      selectors: methods.filter(m => !m.startsWith('set') && !m.startsWith('update'))
    });
  }
  
  return stores;
}

/**
 * Extract localStorage usage
 */
function extractLocalStorageKeys(content: string): string[] {
  const keys: string[] = [];
  
  // Match localStorage.getItem/setItem patterns
  const patterns = [
    /localStorage\.(?:get|set)Item\s*\(\s*['"]([^'"]+)['"]/g,
    /localStorage\[['"]([^'"]+)['"]\]/g
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      if (!keys.includes(match[1])) {
        keys.push(match[1]);
      }
    }
  }
  
  return keys;
}

/**
 * Extract API calls
 */
function extractAPICalls(content: string): APICall[] {
  const apiCalls: APICall[] = [];
  
  // Match fetch/axios patterns
  const fetchPattern = /(?:fetch|axios\.(?:get|post|put|delete))\s*\(\s*['"`]([^'"`]+)['"`]/g;
  
  let match;
  while ((match = fetchPattern.exec(content)) !== null) {
    const endpoint = match[1];
    const method = match[0].includes('post') ? 'POST' :
                   match[0].includes('put') ? 'PUT' :
                   match[0].includes('delete') ? 'DELETE' : 'GET';
    
    // Check if there's error handling nearby
    const contextStart = Math.max(0, match.index - 200);
    const contextEnd = Math.min(content.length, match.index + 200);
    const context = content.substring(contextStart, contextEnd);
    const hasErrorHandling = /\.catch\(|try\s*{|\.then\([^,]+,/.test(context);
    
    apiCalls.push({
      endpoint,
      method,
      purpose: 'Data fetching', // Would need more context
      errorHandling: hasErrorHandling
    });
  }
  
  return apiCalls;
}

/**
 * Identify potential race conditions
 */
function identifyRaceConditions(content: string, filePath: string): RaceCondition[] {
  const raceConditions: RaceCondition[] = [];
  
  // Check for async operations in useEffect without proper cleanup
  const effectPattern = /useEffect\s*\(\s*\(\s*\)\s*=>\s*{([^}]+async[^}]+)}\s*,\s*\[([^\]]*)\]\s*\)/g;
  
  let match;
  while ((match = effectPattern.exec(content)) !== null) {
    const effectBody = match[1];
    const deps = match[2];
    
    // Check if there's a cleanup function
    const hasCleanup = /return\s+\(\s*\)\s*=>/.test(effectBody);
    
    if (!hasCleanup && effectBody.includes('await')) {
      raceConditions.push({
        description: 'Async operation in useEffect without cleanup',
        location: `${filePath}:${getLineNumber(content, match.index)}`,
        scenario: 'Component unmounts before async operation completes',
        fix: 'Add cleanup function with abort controller or cancelled flag'
      });
    }
  }
  
  // Check for multiple setState calls in async functions
  const asyncFunctionPattern = /async\s+(?:function\s+\w+|\(\s*\)\s*=>)\s*{([^}]+)}/g;
  
  while ((match = asyncFunctionPattern.exec(content)) !== null) {
    const functionBody = match[1];
    const setStateCalls = (functionBody.match(/set\w+\(/g) || []).length;
    
    if (setStateCalls > 2) {
      raceConditions.push({
        description: 'Multiple setState calls in async function',
        location: `${filePath}:${getLineNumber(content, match.index)}`,
        scenario: 'State updates may occur after component unmounts',
        fix: 'Batch state updates or use a single state object'
      });
    }
  }
  
  return raceConditions;
}

/**
 * Get line number from character index
 */
function getLineNumber(content: string, index: number): number {
  return content.substring(0, index).split('\n').length;
}

/**
 * Trace data inputs (from props, stores, localStorage)
 */
function traceDataInputs(content: string): DataInput[] {
  const inputs: DataInput[] = [];
  
  // Extract from props
  const propsPattern = /(?:function\s+\w+|const\s+\w+\s*=\s*(?:\([^)]*\)|{[^}]*}))\s*(?::\s*\w+)?\s*=>\s*{/;
  const propsMatch = content.match(propsPattern);
  
  if (propsMatch) {
    // This is simplified - would need proper AST parsing for accurate prop extraction
    const propsSection = propsMatch[0];
    if (propsSection.includes('{')) {
      const propsContent = propsSection.match(/{([^}]+)}/);
      if (propsContent) {
        const props = propsContent[1].split(',').map(p => p.trim());
        for (const prop of props) {
          inputs.push({
            source: 'props',
            dataKey: prop.split(':')[0].trim(),
            usage: 'Component prop'
          });
        }
      }
    }
  }
  
  // Extract from store selectors
  const storePattern = /const\s+{([^}]+)}\s*=\s*use\w+Store\s*\(/g;
  let match;
  while ((match = storePattern.exec(content)) !== null) {
    const selectors = match[1].split(',').map(s => s.trim());
    for (const selector of selectors) {
      if (!selector.startsWith('set') && !selector.startsWith('update')) {
        inputs.push({
          source: 'Zustand store',
          dataKey: selector,
          usage: 'Store state selector'
        });
      }
    }
  }
  
  // Extract from localStorage
  const localStoragePattern = /localStorage\.getItem\s*\(\s*['"]([^'"]+)['"]/g;
  while ((match = localStoragePattern.exec(content)) !== null) {
    inputs.push({
      source: 'localStorage',
      dataKey: match[1],
      usage: 'Persisted data'
    });
  }
  
  return inputs;
}

/**
 * Trace data outputs (to stores, localStorage, API)
 */
function traceDataOutputs(content: string): DataOutput[] {
  const outputs: DataOutput[] = [];
  
  // Extract store mutations
  const storeMutationPattern = /(?:set|update)\w+\s*\([^)]*\)/g;
  let match;
  while ((match = storeMutationPattern.exec(content)) !== null) {
    outputs.push({
      destination: 'Zustand store',
      dataKey: match[0].split('(')[0].trim(),
      transformation: 'State update'
    });
  }
  
  // Extract localStorage writes
  const localStorageWritePattern = /localStorage\.setItem\s*\(\s*['"]([^'"]+)['"]/g;
  while ((match = localStorageWritePattern.exec(content)) !== null) {
    outputs.push({
      destination: 'localStorage',
      dataKey: match[1],
      transformation: 'Persistence'
    });
  }
  
  // Extract API calls (POST/PUT)
  const apiWritePattern = /(?:fetch|axios\.(?:post|put))\s*\(\s*['"`]([^'"`]+)['"`]/g;
  while ((match = apiWritePattern.exec(content)) !== null) {
    outputs.push({
      destination: 'API',
      dataKey: match[1],
      transformation: 'Backend sync'
    });
  }
  
  return outputs;
}

// ============================================================================
// Main Analyzer Function
// ============================================================================

/**
 * Analyze data flow in a wizard step component
 */
export function analyzeDataFlow(
  filePath: string,
  content: string
): DataFlowAnalysis {
  return {
    inputs: traceDataInputs(content),
    outputs: traceDataOutputs(content),
    storeUsage: extractStoreUsage(content),
    localStorageKeys: extractLocalStorageKeys(content),
    apiCalls: extractAPICalls(content),
    stateVariables: extractStateVariables(content),
    raceConditions: identifyRaceConditions(content, filePath)
  };
}

/**
 * Generate data flow findings from analysis
 */
export function generateDataFlowFindings(
  stepName: string,
  filePath: string,
  analysis: DataFlowAnalysis
): AnalysisFinding[] {
  const findings: AnalysisFinding[] = [];
  let findingId = 1;
  
  // Check for API calls without error handling
  const apiCallsWithoutErrorHandling = analysis.apiCalls.filter(call => !call.errorHandling);
  if (apiCallsWithoutErrorHandling.length > 0) {
    findings.push({
      id: `${stepName}-DATAFLOW-${findingId++}`,
      stepName,
      category: FindingCategory.DataFlow,
      severity: Severity.High,
      title: 'API calls without error handling',
      description: `Found ${apiCallsWithoutErrorHandling.length} API call(s) without proper error handling.`,
      impact: 'Users may see crashes or undefined behavior when API calls fail. No feedback on network errors.',
      filePaths: [filePath],
      suggestedFix: 'Wrap API calls in try-catch blocks or add .catch() handlers. Show user-friendly error messages.',
      codeSnippet: `// Add error handling:\ntry {\n  const response = await fetch('/api/endpoint');\n  const data = await response.json();\n  // Handle success\n} catch (error) {\n  console.error('API call failed:', error);\n  // Show error message to user\n}`,
      estimatedEffort: Effort.Small,
      acceptanceCriteria: [
        'All API calls have error handling',
        'User sees appropriate error messages',
        'No unhandled promise rejections'
      ]
    });
  }
  
  // Check for race conditions
  if (analysis.raceConditions.length > 0) {
    for (const raceCondition of analysis.raceConditions) {
      findings.push({
        id: `${stepName}-DATAFLOW-${findingId++}`,
        stepName,
        category: FindingCategory.DataFlow,
        severity: Severity.High,
        title: 'Potential race condition',
        description: raceCondition.description,
        impact: 'May cause memory leaks, state updates on unmounted components, or inconsistent UI state.',
        filePaths: [filePath],
        lineNumbers: [parseInt(raceCondition.location.split(':').pop() || '0')],
        reproductionSteps: [
          'Navigate to this step',
          'Trigger the async operation',
          'Quickly navigate away before operation completes',
          'Check console for warnings'
        ],
        suggestedFix: raceCondition.fix,
        codeSnippet: `// Add cleanup:\nuseEffect(() => {\n  let cancelled = false;\n  \n  async function fetchData() {\n    const data = await fetch('/api/data');\n    if (!cancelled) {\n      setData(data);\n    }\n  }\n  \n  fetchData();\n  \n  return () => {\n    cancelled = true;\n  };\n}, []);`,
        estimatedEffort: Effort.Small,
        acceptanceCriteria: [
          'No console warnings about state updates on unmounted components',
          'Cleanup functions properly cancel async operations',
          'No memory leaks'
        ]
      });
    }
  }
  
  // Check for localStorage usage without error handling
  if (analysis.localStorageKeys.length > 0) {
    findings.push({
      id: `${stepName}-DATAFLOW-${findingId++}`,
      stepName,
      category: FindingCategory.DataFlow,
      severity: Severity.Medium,
      title: 'localStorage usage detected',
      description: `Component uses localStorage with keys: ${analysis.localStorageKeys.join(', ')}`,
      impact: 'localStorage can fail in private browsing mode or when storage is full. May cause data loss.',
      filePaths: [filePath],
      suggestedFix: 'Wrap localStorage access in try-catch blocks. Provide fallback behavior when localStorage is unavailable.',
      codeSnippet: `// Safe localStorage access:\nfunction safeGetItem(key: string, defaultValue: any) {\n  try {\n    const item = localStorage.getItem(key);\n    return item ? JSON.parse(item) : defaultValue;\n  } catch (error) {\n    console.warn('localStorage access failed:', error);\n    return defaultValue;\n  }\n}`,
      estimatedEffort: Effort.Small,
      acceptanceCriteria: [
        'localStorage access is wrapped in try-catch',
        'Fallback behavior exists when localStorage fails',
        'No crashes in private browsing mode'
      ]
    });
  }
  
  // Check for missing data persistence
  if (analysis.stateVariables.length > 3 && analysis.outputs.length === 0) {
    findings.push({
      id: `${stepName}-DATAFLOW-${findingId++}`,
      stepName,
      category: FindingCategory.DataFlow,
      severity: Severity.High,
      title: 'State not persisted',
      description: `Component has ${analysis.stateVariables.length} state variables but no data persistence detected.`,
      impact: 'User data may be lost when navigating between steps or refreshing the page.',
      filePaths: [filePath],
      suggestedFix: 'Persist important state to Zustand store or localStorage. Add debounced auto-save.',
      codeSnippet: `// Add debounced save:\nimport { useDebounce } from '@/hooks/useDebounce';\n\nconst debouncedData = useDebounce(formData, 500);\n\nuseEffect(() => {\n  if (debouncedData) {\n    saveToStore(debouncedData);\n  }\n}, [debouncedData]);`,
      estimatedEffort: Effort.Medium,
      acceptanceCriteria: [
        'Important state is persisted',
        'Data survives page refresh',
        'Data is available when navigating back to step'
      ]
    });
  }
  
  return findings;
}
