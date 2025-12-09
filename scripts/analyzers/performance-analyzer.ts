/**
 * Performance Analyzer
 * 
 * Identifies unnecessary re-renders, detects missing memoization opportunities,
 * finds expensive computations, and checks list rendering patterns.
 */

import {
  PerformanceAnalysis,
  PerformanceIssue,
  AnalysisFinding,
  FindingCategory,
  Severity,
  Effort
} from '../analysis-types';

// ============================================================================
// Re-render Analysis
// ============================================================================

function identifyReRenderIssues(content: string, filePath: string): PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];
  
  // Check for inline object/array creation in JSX
  const inlineObjectPattern = /(\w+)\s*=\s*{[^}]*}(?=\s*(?:\/>|>))/g;
  let match;
  
  while ((match = inlineObjectPattern.exec(content)) !== null) {
    const propName = match[1];
    
    issues.push({
      type: 'Inline object creation',
      location: `${filePath} - prop: ${propName}`,
      impact: 'High',
      fix: 'Move object creation outside JSX or use useMemo'
    });
  }
  
  // Check for inline arrow functions in JSX
  const inlineFunctionPattern = /(\w+)\s*=\s*{(?:\([^)]*\)|[^}]*)\s*=>/g;
  
  while ((match = inlineFunctionPattern.exec(content)) !== null) {
    const propName = match[1];
    
    issues.push({
      type: 'Inline function creation',
      location: `${filePath} - prop: ${propName}`,
      impact: 'Medium',
      fix: 'Use useCallback to memoize function'
    });
  }
  
  // Check for missing React.memo on components
  const componentPattern = /(?:export\s+)?(?:const|function)\s+([A-Z]\w+)\s*(?:=\s*\([^)]*\)\s*=>|=\s*function|\()/g;
  const hasMemo = /React\.memo|memo\(/g.test(content);
  
  if (componentPattern.test(content) && !hasMemo) {
    issues.push({
      type: 'Component not memoized',
      location: filePath,
      impact: 'Medium',
      fix: 'Wrap component with React.memo if it receives stable props'
    });
  }
  
  // Check for useEffect without dependencies
  const useEffectPattern = /useEffect\s*\(\s*\([^)]*\)\s*=>\s*{[^}]*}\s*\)/g;
  
  if (useEffectPattern.test(content)) {
    issues.push({
      type: 'useEffect without dependencies',
      location: filePath,
      impact: 'High',
      fix: 'Add dependency array to prevent running on every render'
    });
  }
  
  // Check for state updates in render
  const stateUpdateInRenderPattern = /(?:set[A-Z]\w+)\s*\([^)]*\)(?![^{]*useEffect|[^{]*useCallback|[^{]*useMemo)/g;
  
  const matches = content.match(stateUpdateInRenderPattern);
  if (matches && matches.length > 5) {
    issues.push({
      type: 'Multiple state updates',
      location: filePath,
      impact: 'High',
      fix: 'Batch state updates or use useReducer'
    });
  }
  
  return issues;
}

// ============================================================================
// Memoization Analysis
// ============================================================================

function detectMemoizationOpportunities(content: string, filePath: string): PerformanceIssue[] {
  const opportunities: PerformanceIssue[] = [];
  
  // Check for expensive computations without useMemo
  const computationPatterns = [
    { pattern: /\.filter\([^)]+\)\.map\([^)]+\)/g, name: 'filter + map chain' },
    { pattern: /\.sort\([^)]+\)/g, name: 'array sort' },
    { pattern: /\.reduce\([^)]+\)/g, name: 'array reduce' },
    { pattern: /JSON\.parse\(/g, name: 'JSON.parse' },
    { pattern: /JSON\.stringify\(/g, name: 'JSON.stringify' }
  ];
  
  const hasMemo = /useMemo\s*\(/g.test(content);
  
  for (const { pattern, name } of computationPatterns) {
    const matches = content.match(pattern);
    
    if (matches && matches.length > 0 && !hasMemo) {
      opportunities.push({
        type: 'Missing useMemo',
        location: `${filePath} - ${name}`,
        impact: 'Medium',
        fix: `Wrap ${name} in useMemo to avoid recalculation on every render`
      });
    }
  }
  
  // Check for callback functions without useCallback
  const callbackPattern = /const\s+(\w+)\s*=\s*(?:\([^)]*\)|[^=]*)\s*=>/g;
  const hasCallback = /useCallback\s*\(/g.test(content);
  let match;
  
  const callbackCount = (content.match(callbackPattern) || []).length;
  
  if (callbackCount > 3 && !hasCallback) {
    opportunities.push({
      type: 'Missing useCallback',
      location: filePath,
      impact: 'Medium',
      fix: 'Wrap callback functions in useCallback to prevent recreation'
    });
  }
  
  // Check for derived state without useMemo
  const derivedStatePattern = /const\s+\w+\s*=\s*\w+\.(?:filter|map|reduce|sort)/g;
  
  if (derivedStatePattern.test(content) && !hasMemo) {
    opportunities.push({
      type: 'Derived state without memoization',
      location: filePath,
      impact: 'Medium',
      fix: 'Use useMemo for derived state calculations'
    });
  }
  
  return opportunities;
}

// ============================================================================
// Expensive Computation Analysis
// ============================================================================

function findExpensiveComputations(content: string, filePath: string): PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];
  
  // Check for nested loops
  const nestedLoopPattern = /for\s*\([^)]+\)\s*{[^}]*for\s*\([^)]+\)/g;
  
  if (nestedLoopPattern.test(content)) {
    issues.push({
      type: 'Nested loops',
      location: filePath,
      impact: 'High',
      fix: 'Optimize algorithm or move to Web Worker for large datasets'
    });
  }
  
  // Check for large array operations in render
  const largeArrayPattern = /\.length\s*>\s*(\d+)/g;
  let match;
  
  while ((match = largeArrayPattern.exec(content)) !== null) {
    const size = parseInt(match[1]);
    
    if (size > 100) {
      issues.push({
        type: 'Large array operations',
        location: `${filePath} - array size check: ${size}`,
        impact: 'Medium',
        fix: 'Consider virtualization for large lists or pagination'
      });
    }
  }
  
  // Check for regex in loops
  const regexInLoopPattern = /(?:for|while|map|forEach)\s*\([^)]*\)\s*{[^}]*new\s+RegExp|[^}]*\/[^/]+\/[gimuy]*/g;
  
  if (regexInLoopPattern.test(content)) {
    issues.push({
      type: 'Regex in loop',
      location: filePath,
      impact: 'Medium',
      fix: 'Move regex creation outside loop'
    });
  }
  
  // Check for deep object cloning
  const deepClonePattern = /JSON\.parse\s*\(\s*JSON\.stringify/g;
  
  if (deepClonePattern.test(content)) {
    issues.push({
      type: 'Deep object cloning with JSON',
      location: filePath,
      impact: 'Medium',
      fix: 'Use structuredClone() or a specialized library like lodash.cloneDeep'
    });
  }
  
  // Check for synchronous localStorage access in render
  const localStorageInRenderPattern = /localStorage\.(?:get|set)Item(?![^{]*useEffect|[^{]*useCallback)/g;
  
  if (localStorageInRenderPattern.test(content)) {
    issues.push({
      type: 'Synchronous localStorage access',
      location: filePath,
      impact: 'Low',
      fix: 'Move localStorage access to useEffect or custom hook'
    });
  }
  
  return issues;
}

// ============================================================================
// List Rendering Analysis
// ============================================================================

function checkListRenderingPatterns(content: string, filePath: string): PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];
  
  // Check for missing keys in list rendering
  const mapWithoutKeyPattern = /\.map\s*\([^)]*\)\s*(?:=>)?\s*(?:<[^>]*>|{[^}]*<)(?![^<]*key\s*=)/g;
  
  if (mapWithoutKeyPattern.test(content)) {
    issues.push({
      type: 'Missing key prop in list',
      location: filePath,
      impact: 'High',
      fix: 'Add unique key prop to list items'
    });
  }
  
  // Check for index as key
  const indexAsKeyPattern = /key\s*=\s*{?\s*(?:index|i|idx)\s*}?/g;
  
  if (indexAsKeyPattern.test(content)) {
    issues.push({
      type: 'Using index as key',
      location: filePath,
      impact: 'Medium',
      fix: 'Use stable unique identifier as key instead of index'
    });
  }
  
  // Check for large lists without virtualization
  const largeListPattern = /\.map\s*\([^)]*\)(?:[^{]*{[^}]*<[^>]*>)/g;
  const matches = content.match(largeListPattern);
  
  if (matches && matches.length > 0) {
    const hasVirtualization = /(?:VirtualList|Virtualized|react-window|react-virtualized)/i.test(content);
    const hasLargeArray = /\.length\s*>\s*(?:50|100)/g.test(content);
    
    if (hasLargeArray && !hasVirtualization) {
      issues.push({
        type: 'Large list without virtualization',
        location: filePath,
        impact: 'High',
        fix: 'Use react-window or react-virtualized for lists with 50+ items'
      });
    }
  }
  
  // Check for complex components in list items
  const complexListItemPattern = /\.map\s*\([^)]*\)\s*(?:=>)?\s*(?:<[A-Z]\w+[^>]*>)/g;
  
  if (complexListItemPattern.test(content)) {
    const hasMemoizedItem = /React\.memo|memo\(/g.test(content);
    
    if (!hasMemoizedItem) {
      issues.push({
        type: 'Complex list items not memoized',
        location: filePath,
        impact: 'Medium',
        fix: 'Wrap list item component with React.memo'
      });
    }
  }
  
  return issues;
}

// ============================================================================
// Main Analyzer Function
// ============================================================================

/**
 * Analyze performance patterns in a wizard step component
 */
export function analyzePerformance(
  filePath: string,
  content: string
): PerformanceAnalysis {
  return {
    reRenderIssues: identifyReRenderIssues(content, filePath),
    memoizationOpportunities: detectMemoizationOpportunities(content, filePath),
    expensiveComputations: findExpensiveComputations(content, filePath),
    listRenderingIssues: checkListRenderingPatterns(content, filePath)
  };
}

/**
 * Generate performance findings from analysis
 */
export function generatePerformanceFindings(
  stepName: string,
  filePath: string,
  analysis: PerformanceAnalysis
): AnalysisFinding[] {
  const findings: AnalysisFinding[] = [];
  let findingId = 1;
  
  // Re-render findings
  const highImpactReRenders = analysis.reRenderIssues.filter(issue => issue.impact === 'High');
  
  if (highImpactReRenders.length > 0) {
    findings.push({
      id: `${stepName}-PERF-${findingId++}`,
      stepName,
      category: FindingCategory.Performance,
      severity: Severity.High,
      title: 'Unnecessary re-renders detected',
      description: `Found ${highImpactReRenders.length} high-impact re-render issues: ${highImpactReRenders.map(i => i.type).join(', ')}`,
      impact: 'Component re-renders unnecessarily, causing performance degradation and poor user experience.',
      filePaths: [filePath],
      suggestedFix: highImpactReRenders.map(i => i.fix).join('; '),
      codeSnippet: `// Avoid inline objects:\n// Bad:\n<Component style={{ margin: 10 }} />\n\n// Good:\nconst style = useMemo(() => ({ margin: 10 }), []);\n<Component style={style} />\n\n// Avoid inline functions:\n// Bad:\n<Button onClick={() => handleClick(id)} />\n\n// Good:\nconst handleButtonClick = useCallback(() => handleClick(id), [id]);\n<Button onClick={handleButtonClick} />`,
      estimatedEffort: Effort.Medium,
      acceptanceCriteria: [
        'No inline object/array creation in JSX',
        'Callbacks are memoized with useCallback',
        'useEffect has proper dependency arrays'
      ]
    });
  }
  
  // Memoization findings
  if (analysis.memoizationOpportunities.length > 0) {
    findings.push({
      id: `${stepName}-PERF-${findingId++}`,
      stepName,
      category: FindingCategory.Performance,
      severity: Severity.Medium,
      title: 'Missing memoization opportunities',
      description: `Found ${analysis.memoizationOpportunities.length} opportunities to improve performance with memoization`,
      impact: 'Expensive computations run on every render, wasting CPU cycles and slowing down the UI.',
      filePaths: [filePath],
      suggestedFix: 'Use useMemo for expensive computations and useCallback for callback functions',
      codeSnippet: `// Memoize expensive computations:\nconst filteredData = useMemo(() => {\n  return data.filter(item => item.active).map(item => transform(item));\n}, [data]);\n\n// Memoize callbacks:\nconst handleChange = useCallback((value: string) => {\n  setValue(value);\n  onValueChange?.(value);\n}, [onValueChange]);`,
      estimatedEffort: Effort.Small,
      acceptanceCriteria: [
        'Expensive computations are wrapped in useMemo',
        'Callback functions are wrapped in useCallback',
        'Dependencies are correctly specified'
      ]
    });
  }
  
  // Expensive computation findings
  const criticalComputations = analysis.expensiveComputations.filter(issue => issue.impact === 'High');
  
  if (criticalComputations.length > 0) {
    findings.push({
      id: `${stepName}-PERF-${findingId++}`,
      stepName,
      category: FindingCategory.Performance,
      severity: Severity.High,
      title: 'Expensive computations detected',
      description: `Found ${criticalComputations.length} expensive operations: ${criticalComputations.map(i => i.type).join(', ')}`,
      impact: 'Heavy computations can freeze the UI and make the application feel sluggish.',
      filePaths: [filePath],
      suggestedFix: criticalComputations.map(i => i.fix).join('; '),
      codeSnippet: `// Optimize nested loops:\n// Bad:\nfor (const item of list1) {\n  for (const other of list2) {\n    if (item.id === other.id) { /* ... */ }\n  }\n}\n\n// Good:\nconst map = new Map(list2.map(item => [item.id, item]));\nfor (const item of list1) {\n  const other = map.get(item.id);\n  if (other) { /* ... */ }\n}`,
      estimatedEffort: Effort.Medium,
      acceptanceCriteria: [
        'No nested loops with O(n²) complexity',
        'Large datasets use efficient algorithms',
        'Heavy computations are debounced or moved to workers'
      ]
    });
  }
  
  // List rendering findings
  const listIssues = analysis.listRenderingIssues.filter(issue => issue.impact === 'High');
  
  if (listIssues.length > 0) {
    findings.push({
      id: `${stepName}-PERF-${findingId++}`,
      stepName,
      category: FindingCategory.Performance,
      severity: Severity.High,
      title: 'List rendering issues',
      description: `Found ${listIssues.length} list rendering problems: ${listIssues.map(i => i.type).join(', ')}`,
      impact: 'Poor list rendering can cause slow updates, incorrect UI state, and performance issues with large datasets.',
      filePaths: [filePath],
      suggestedFix: listIssues.map(i => i.fix).join('; '),
      codeSnippet: `// Always use stable keys:\n// Bad:\n{items.map((item, index) => <Item key={index} {...item} />)}\n\n// Good:\n{items.map(item => <Item key={item.id} {...item} />)}\n\n// Virtualize large lists:\nimport { FixedSizeList } from 'react-window';\n\n<FixedSizeList\n  height={600}\n  itemCount={items.length}\n  itemSize={50}\n  width="100%"\n>\n  {({ index, style }) => (\n    <div style={style}>\n      <Item {...items[index]} />\n    </div>\n  )}\n</FixedSizeList>`,
      estimatedEffort: Effort.Medium,
      acceptanceCriteria: [
        'All list items have stable unique keys',
        'Large lists (50+ items) use virtualization',
        'List item components are memoized'
      ]
    });
  }
  
  // Medium impact re-renders
  const mediumImpactReRenders = analysis.reRenderIssues.filter(issue => issue.impact === 'Medium');
  
  if (mediumImpactReRenders.length > 2) {
    findings.push({
      id: `${stepName}-PERF-${findingId++}`,
      stepName,
      category: FindingCategory.Performance,
      severity: Severity.Medium,
      title: 'Multiple medium-impact performance issues',
      description: `Found ${mediumImpactReRenders.length} medium-impact issues that could be optimized`,
      impact: 'Cumulative effect of multiple small issues can degrade overall performance.',
      filePaths: [filePath],
      suggestedFix: 'Consider wrapping component with React.memo and optimizing prop passing',
      codeSnippet: `// Memoize component:\nexport const MyComponent = React.memo(({ data, onAction }) => {\n  // Component implementation\n});\n\n// Or with custom comparison:\nexport const MyComponent = React.memo(\n  ({ data, onAction }) => {\n    // Component implementation\n  },\n  (prevProps, nextProps) => {\n    return prevProps.data.id === nextProps.data.id;\n  }\n);`,
      estimatedEffort: Effort.Small,
      acceptanceCriteria: [
        'Component wrapped with React.memo where appropriate',
        'Props are stable or memoized',
        'No unnecessary re-renders in React DevTools'
      ]
    });
  }
  
  return findings;}

