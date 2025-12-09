/**
 * Architecture Analyzer
 * 
 * Analyzes component structure, imports, dependencies, file organization,
 * and calculates complexity metrics for wizard steps.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  ArchitectureAnalysis,
  ComponentImport,
  ComplexityMetrics,
  AnalysisFinding,
  FindingCategory,
  Severity,
  Effort
} from '../analysis-types';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract imports from TypeScript/React file content
 */
function extractImports(content: string, filePath: string): ComponentImport[] {
  const imports: ComponentImport[] = [];
  
  // Match various import patterns
  const importPatterns = [
    // import { X, Y } from 'path'
    /import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/g,
    // import X from 'path'
    /import\s+([\w]+)\s+from\s+['"]([^'"]+)['"]/g,
    // import * as X from 'path'
    /import\s+\*\s+as\s+([\w]+)\s+from\s+['"]([^'"]+)['"]/g,
  ];
  
  for (const pattern of importPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const importPath = match[2];
      const names = match[1].split(',').map(n => n.trim());
      
      for (const name of names) {
        imports.push({
          name: name.replace(/\s+as\s+\w+/, '').trim(),
          path: importPath,
          type: determineImportType(importPath)
        });
      }
    }
  }
  
  return imports;
}

/**
 * Determine the type of import based on path
 */
function determineImportType(importPath: string): ComponentImport['type'] {
  if (importPath.includes('/hooks/') || importPath.startsWith('use')) {
    return 'hook';
  }
  if (importPath.includes('/stores/') || importPath.includes('Store')) {
    return 'store';
  }
  if (importPath.includes('/types/') || importPath.includes('/schemas/')) {
    return 'type';
  }
  if (importPath.includes('/lib/') || importPath.includes('/utils/')) {
    return 'utility';
  }
  return 'component';
}

/**
 * Count lines of code (excluding comments and blank lines)
 */
function countLinesOfCode(content: string): number {
  const lines = content.split('\n');
  let count = 0;
  let inBlockComment = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip blank lines
    if (trimmed === '') continue;
    
    // Handle block comments
    if (trimmed.startsWith('/*')) {
      inBlockComment = true;
    }
    if (inBlockComment) {
      if (trimmed.endsWith('*/')) {
        inBlockComment = false;
      }
      continue;
    }
    
    // Skip single-line comments
    if (trimmed.startsWith('//')) continue;
    
    count++;
  }
  
  return count;
}

/**
 * Count React hooks usage
 */
function countHooks(content: string): number {
  const hookPattern = /\buse[A-Z]\w+\(/g;
  const matches = content.match(hookPattern);
  return matches ? matches.length : 0;
}

/**
 * Count state variables (useState calls)
 */
function countStateVariables(content: string): number {
  const statePattern = /useState\s*[<(]/g;
  const matches = content.match(statePattern);
  return matches ? matches.length : 0;
}

/**
 * Estimate cyclomatic complexity (simplified)
 */
function estimateCyclomaticComplexity(content: string): number {
  // Count decision points: if, else, case, while, for, &&, ||, ?
  const patterns = [
    /\bif\s*\(/g,
    /\belse\s+if\s*\(/g,
    /\bcase\s+/g,
    /\bwhile\s*\(/g,
    /\bfor\s*\(/g,
    /&&/g,
    /\|\|/g,
    /\?/g
  ];
  
  let complexity = 1; // Base complexity
  
  for (const pattern of patterns) {
    const matches = content.match(pattern);
    if (matches) {
      complexity += matches.length;
    }
  }
  
  return complexity;
}

/**
 * Identify design patterns in the code
 */
function identifyPatterns(content: string): string[] {
  const patterns: string[] = [];
  
  // Check for common React patterns
  if (content.includes('useContext')) {
    patterns.push('Context API');
  }
  if (content.includes('useReducer')) {
    patterns.push('Reducer Pattern');
  }
  if (content.includes('useMemo') || content.includes('useCallback')) {
    patterns.push('Memoization');
  }
  if (content.includes('forwardRef')) {
    patterns.push('Ref Forwarding');
  }
  if (content.includes('React.memo')) {
    patterns.push('Component Memoization');
  }
  if (/\.map\(/.test(content)) {
    patterns.push('List Rendering');
  }
  if (content.includes('useState') && content.includes('useEffect')) {
    patterns.push('State + Side Effects');
  }
  
  return patterns;
}

/**
 * Identify anti-patterns in the code
 */
function identifyAntiPatterns(content: string): string[] {
  const antiPatterns: string[] = [];
  
  // Check for common anti-patterns
  
  // Missing dependency array in useEffect
  if (/useEffect\s*\(\s*\(\s*\)\s*=>\s*{[^}]*}\s*\)/.test(content)) {
    antiPatterns.push('useEffect without dependency array');
  }
  
  // Inline object/array in JSX (causes re-renders)
  if (/\w+\s*=\s*{[^}]*}(?=\s*\/>|\s*>)/.test(content)) {
    antiPatterns.push('Inline object creation in JSX');
  }
  
  // Direct state mutation
  if (/\w+\.\w+\s*=\s*[^=]/.test(content) && content.includes('useState')) {
    antiPatterns.push('Potential direct state mutation');
  }
  
  // Large component (>500 LOC)
  const loc = countLinesOfCode(content);
  if (loc > 500) {
    antiPatterns.push(`Large component (${loc} LOC)`);
  }
  
  // Too many useState calls (>10)
  const stateCount = countStateVariables(content);
  if (stateCount > 10) {
    antiPatterns.push(`Too many state variables (${stateCount})`);
  }
  
  return antiPatterns;
}

/**
 * Analyze file organization
 */
function analyzeFileOrganization(filePath: string, imports: ComponentImport[]): string[] {
  const observations: string[] = [];
  
  // Check import organization
  const externalImports = imports.filter(imp => 
    !imp.path.startsWith('.') && !imp.path.startsWith('@/')
  );
  const localImports = imports.filter(imp => 
    imp.path.startsWith('.') || imp.path.startsWith('@/')
  );
  
  observations.push(`${externalImports.length} external imports, ${localImports.length} local imports`);
  
  // Check for co-located files
  const dir = path.dirname(filePath);
  const baseName = path.basename(filePath, path.extname(filePath));
  
  observations.push(`Component location: ${dir}`);
  observations.push(`Base name: ${baseName}`);
  
  return observations;
}

// ============================================================================
// Main Analyzer Function
// ============================================================================

/**
 * Analyze the architecture of a wizard step component
 */
export function analyzeArchitecture(
  filePath: string,
  content: string
): ArchitectureAnalysis {
  // Extract imports
  const imports = extractImports(content, filePath);
  
  // Calculate complexity metrics
  const complexity: ComplexityMetrics = {
    linesOfCode: countLinesOfCode(content),
    cyclomaticComplexity: estimateCyclomaticComplexity(content),
    numberOfImports: imports.length,
    numberOfExports: (content.match(/export\s+(const|function|class|interface|type)/g) || []).length,
    numberOfHooks: countHooks(content),
    numberOfStateVariables: countStateVariables(content)
  };
  
  // Identify patterns and anti-patterns
  const patterns = identifyPatterns(content);
  const antiPatterns = identifyAntiPatterns(content);
  
  // Analyze file organization
  const fileOrganization = analyzeFileOrganization(filePath, imports);
  
  // Determine component structure
  const componentStructure = determineComponentStructure(content, complexity);
  
  return {
    componentStructure,
    fileOrganization,
    dependencies: imports,
    complexity,
    patterns,
    antiPatterns
  };
}

/**
 * Determine component structure description
 */
function determineComponentStructure(content: string, metrics: ComplexityMetrics): string {
  const parts: string[] = [];
  
  // Component type
  if (content.includes('export default function')) {
    parts.push('Functional component (default export)');
  } else if (content.includes('export const')) {
    parts.push('Functional component (named export)');
  }
  
  // Complexity assessment
  if (metrics.linesOfCode > 500) {
    parts.push('Large component');
  } else if (metrics.linesOfCode > 300) {
    parts.push('Medium-sized component');
  } else {
    parts.push('Small component');
  }
  
  // Hook usage
  if (metrics.numberOfHooks > 10) {
    parts.push('Heavy hook usage');
  } else if (metrics.numberOfHooks > 5) {
    parts.push('Moderate hook usage');
  }
  
  return parts.join(', ');
}

/**
 * Generate architecture findings from analysis
 */
export function generateArchitectureFindings(
  stepName: string,
  filePath: string,
  analysis: ArchitectureAnalysis
): AnalysisFinding[] {
  const findings: AnalysisFinding[] = [];
  let findingId = 1;
  
  // Check for large component
  if (analysis.complexity.linesOfCode > 500) {
    findings.push({
      id: `${stepName}-ARCH-${findingId++}`,
      stepName,
      category: FindingCategory.Architecture,
      severity: Severity.Medium,
      title: 'Large component file',
      description: `Component has ${analysis.complexity.linesOfCode} lines of code, which may indicate it's doing too much.`,
      impact: 'Reduces maintainability and makes the component harder to test and understand.',
      filePaths: [filePath],
      suggestedFix: 'Consider breaking down the component into smaller, focused sub-components. Extract complex logic into custom hooks.',
      estimatedEffort: Effort.Medium,
      acceptanceCriteria: [
        'Component is split into logical sub-components',
        'Each sub-component has a single responsibility',
        'Main component is under 300 LOC'
      ]
    });
  }
  
  // Check for high cyclomatic complexity
  if (analysis.complexity.cyclomaticComplexity && analysis.complexity.cyclomaticComplexity > 20) {
    findings.push({
      id: `${stepName}-ARCH-${findingId++}`,
      stepName,
      category: FindingCategory.Architecture,
      severity: Severity.Medium,
      title: 'High cyclomatic complexity',
      description: `Component has cyclomatic complexity of ${analysis.complexity.cyclomaticComplexity}, indicating complex control flow.`,
      impact: 'Makes code harder to understand, test, and maintain. Increases likelihood of bugs.',
      filePaths: [filePath],
      suggestedFix: 'Simplify conditional logic. Extract complex conditions into well-named functions. Consider using early returns.',
      estimatedEffort: Effort.Medium,
      acceptanceCriteria: [
        'Cyclomatic complexity reduced below 15',
        'Complex conditions extracted into named functions',
        'Code is more readable'
      ]
    });
  }
  
  // Check for too many state variables
  if (analysis.complexity.numberOfStateVariables > 10) {
    findings.push({
      id: `${stepName}-ARCH-${findingId++}`,
      stepName,
      category: FindingCategory.Architecture,
      severity: Severity.High,
      title: 'Too many state variables',
      description: `Component uses ${analysis.complexity.numberOfStateVariables} useState calls, which may indicate state management issues.`,
      impact: 'Difficult to track state changes, potential for state synchronization bugs, performance issues.',
      filePaths: [filePath],
      suggestedFix: 'Consider using useReducer for related state, or move state to Zustand store. Group related state into objects.',
      codeSnippet: `// Instead of multiple useState:\nconst [name, setName] = useState('');\nconst [email, setEmail] = useState('');\n\n// Use a single state object:\nconst [formData, setFormData] = useState({ name: '', email: '' });`,
      estimatedEffort: Effort.Medium,
      acceptanceCriteria: [
        'Related state variables are grouped',
        'Number of useState calls reduced below 8',
        'State management is clearer'
      ]
    });
  }
  
  // Check for anti-patterns
  for (const antiPattern of analysis.antiPatterns) {
    if (antiPattern.includes('useEffect without dependency array')) {
      findings.push({
        id: `${stepName}-ARCH-${findingId++}`,
        stepName,
        category: FindingCategory.Architecture,
        severity: Severity.High,
        title: 'useEffect without dependency array',
        description: 'Found useEffect calls without dependency arrays, which run on every render.',
        impact: 'Performance issues, potential infinite loops, unexpected side effects.',
        filePaths: [filePath],
        suggestedFix: 'Add appropriate dependency arrays to all useEffect calls. Use empty array [] for mount-only effects.',
        codeSnippet: `// Bad:\nuseEffect(() => {\n  fetchData();\n});\n\n// Good:\nuseEffect(() => {\n  fetchData();\n}, []); // Runs only on mount`,
        estimatedEffort: Effort.Small,
        acceptanceCriteria: [
          'All useEffect calls have dependency arrays',
          'No infinite loop warnings in console',
          'Effects run at appropriate times'
        ]
      });
    }
  }
  
  return findings;
}
