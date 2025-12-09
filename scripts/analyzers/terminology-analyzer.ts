/**
 * Terminology Analyzer
 * 
 * Checks naming consistency across components, verifies i18n key usage
 * patterns, and identifies domain term mismatches.
 */

import {
  TerminologyAnalysis,
  TerminologyIssue,
  AnalysisFinding,
  FindingCategory,
  Severity,
  Effort
} from '../analysis-types';

// ============================================================================
// Domain Terms
// ============================================================================

// Common domain terms that should be used consistently
const DOMAIN_TERMS = {
  // School-related
  school: ['school', 'School', 'institution', 'Institution'],
  teacher: ['teacher', 'Teacher', 'instructor', 'Instructor', 'faculty', 'Faculty'],
  student: ['student', 'Student', 'pupil', 'Pupil', 'learner', 'Learner'],
  class: ['class', 'Class', 'classroom', 'Classroom', 'section', 'Section'],
  subject: ['subject', 'Subject', 'course', 'Course'],
  period: ['period', 'Period', 'slot', 'Slot', 'timeSlot', 'TimeSlot'],
  timetable: ['timetable', 'Timetable', 'schedule', 'Schedule'],
  room: ['room', 'Room', 'classroom', 'Classroom', 'venue', 'Venue'],
  
  // Wizard-related
  step: ['step', 'Step', 'stage', 'Stage', 'phase', 'Phase'],
  wizard: ['wizard', 'Wizard', 'flow', 'Flow'],
  
  // Action-related
  save: ['save', 'Save', 'store', 'Store', 'persist', 'Persist'],
  delete: ['delete', 'Delete', 'remove', 'Remove'],
  edit: ['edit', 'Edit', 'modify', 'Modify', 'update', 'Update'],
  add: ['add', 'Add', 'create', 'Create', 'new', 'New']
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract variable and function names from code
 */
function extractNames(content: string): string[] {
  const names: string[] = [];
  
  // Extract variable names
  const varPattern = /(?:const|let|var)\s+(\w+)/g;
  let match;
  
  while ((match = varPattern.exec(content)) !== null) {
    names.push(match[1]);
  }
  
  // Extract function names
  const funcPattern = /function\s+(\w+)|const\s+(\w+)\s*=\s*(?:\([^)]*\)|async)/g;
  
  while ((match = funcPattern.exec(content)) !== null) {
    names.push(match[1] || match[2]);
  }
  
  // Extract component names from JSX
  const componentPattern = /<([A-Z]\w+)/g;
  
  while ((match = componentPattern.exec(content)) !== null) {
    names.push(match[1]);
  }
  
  return names;
}

/**
 * Extract i18n keys from code
 */
function extractI18nKeys(content: string): string[] {
  const keys: string[] = [];
  
  // Match t('key') or t("key")
  const tPattern = /\bt\s*\(\s*['"]([^'"]+)['"]/g;
  let match;
  
  while ((match = tPattern.exec(content)) !== null) {
    keys.push(match[1]);
  }
  
  // Match i18n.t('key')
  const i18nPattern = /i18n\.t\s*\(\s*['"]([^'"]+)['"]/g;
  
  while ((match = i18nPattern.exec(content)) !== null) {
    keys.push(match[1]);
  }
  
  return keys;
}

/**
 * Check naming consistency for domain terms
 */
function checkNamingConsistency(names: string[]): TerminologyIssue[] {
  const issues: TerminologyIssue[] = [];
  
  for (const [preferredTerm, variations] of Object.entries(DOMAIN_TERMS)) {
    const foundVariations: string[] = [];
    const locations: string[] = [];
    
    for (const name of names) {
      const lowerName = name.toLowerCase();
      
      for (const variation of variations) {
        if (lowerName.includes(variation.toLowerCase()) && variation.toLowerCase() !== preferredTerm) {
          foundVariations.push(variation);
          locations.push(name);
        }
      }
    }
    
    if (foundVariations.length > 0) {
      const uniqueVariations = Array.from(new Set(foundVariations));
      
      if (uniqueVariations.length > 1) {
        issues.push({
          term: preferredTerm,
          variations: uniqueVariations,
          locations: Array.from(new Set(locations)),
          recommended: preferredTerm
        });
      }
    }
  }
  
  return issues;
}

/**
 * Analyze i18n key patterns
 */
function analyzeI18nKeyPatterns(keys: string[]): string[] {
  const patterns: string[] = [];
  
  if (keys.length === 0) {
    patterns.push('No i18n keys found - text may be hardcoded');
    return patterns;
  }
  
  // Check for consistent namespace
  const namespaces = new Set<string>();
  for (const key of keys) {
    const parts = key.split('.');
    if (parts.length > 0) {
      namespaces.add(parts[0]);
    }
  }
  
  if (namespaces.size > 3) {
    patterns.push(`Multiple namespaces used (${namespaces.size}): ${Array.from(namespaces).join(', ')}`);
  }
  
  // Check for wizard namespace
  const hasWizardNamespace = keys.some(key => key.startsWith('wizard.'));
  if (!hasWizardNamespace && keys.length > 0) {
    patterns.push('No wizard namespace used - consider using wizard.* for wizard-specific translations');
  }
  
  // Check for common namespace
  const hasCommonNamespace = keys.some(key => key.startsWith('common.'));
  if (hasCommonNamespace) {
    patterns.push('Uses common namespace for shared translations');
  }
  
  // Check key structure
  const deepKeys = keys.filter(key => key.split('.').length > 3);
  if (deepKeys.length > keys.length * 0.3) {
    patterns.push('Many deeply nested keys - consider flattening structure');
  }
  
  // Check for inconsistent casing
  const camelCaseKeys = keys.filter(key => /[a-z][A-Z]/.test(key));
  const snakeCaseKeys = keys.filter(key => /_/.test(key));
  const kebabCaseKeys = keys.filter(key => /-/.test(key));
  
  if (camelCaseKeys.length > 0 && snakeCaseKeys.length > 0) {
    patterns.push('Mixed camelCase and snake_case in keys');
  }
  if (camelCaseKeys.length > 0 && kebabCaseKeys.length > 0) {
    patterns.push('Mixed camelCase and kebab-case in keys');
  }
  
  return patterns;
}

/**
 * Identify domain term mismatches
 */
function identifyDomainTermMismatches(content: string): TerminologyIssue[] {
  const issues: TerminologyIssue[] = [];
  
  // Check for mixed terminology in strings
  const stringPattern = /['"`]([^'"`]{10,})['"`]/g;
  let match;
  
  const foundTerms = new Map<string, string[]>();
  
  while ((match = stringPattern.exec(content)) !== null) {
    const text = match[1].toLowerCase();
    
    for (const [preferredTerm, variations] of Object.entries(DOMAIN_TERMS)) {
      for (const variation of variations) {
        if (text.includes(variation.toLowerCase())) {
          if (!foundTerms.has(preferredTerm)) {
            foundTerms.set(preferredTerm, []);
          }
          foundTerms.get(preferredTerm)!.push(variation);
        }
      }
    }
  }
  
  // Check for inconsistencies
  for (const [preferredTerm, variations] of foundTerms.entries()) {
    const uniqueVariations = Array.from(new Set(variations));
    
    if (uniqueVariations.length > 1) {
      issues.push({
        term: preferredTerm,
        variations: uniqueVariations,
        locations: ['String literals'],
        recommended: preferredTerm
      });
    }
  }
  
  return issues;
}

/**
 * Check for abbreviation consistency
 */
function checkAbbreviations(names: string[]): TerminologyIssue[] {
  const issues: TerminologyIssue[] = [];
  
  // Common abbreviations
  const abbreviations = {
    info: ['info', 'information', 'details'],
    config: ['config', 'configuration', 'settings'],
    num: ['num', 'number', 'count'],
    max: ['max', 'maximum'],
    min: ['min', 'minimum'],
    temp: ['temp', 'temporary'],
    btn: ['btn', 'button'],
    msg: ['msg', 'message']
  };
  
  for (const [abbrev, variations] of Object.entries(abbreviations)) {
    const found: string[] = [];
    
    for (const name of names) {
      const lowerName = name.toLowerCase();
      
      for (const variation of variations) {
        if (lowerName.includes(variation)) {
          found.push(variation);
        }
      }
    }
    
    const uniqueFound = Array.from(new Set(found));
    
    if (uniqueFound.length > 1) {
      issues.push({
        term: abbrev,
        variations: uniqueFound,
        locations: names.filter(n => uniqueFound.some(v => n.toLowerCase().includes(v))),
        recommended: variations[variations.length - 1] // Prefer full word
      });
    }
  }
  
  return issues;
}

// ============================================================================
// Main Analyzer Function
// ============================================================================

/**
 * Analyze terminology usage in a wizard step component
 */
export function analyzeTerminology(
  filePath: string,
  content: string
): TerminologyAnalysis {
  const names = extractNames(content);
  const i18nKeys = extractI18nKeys(content);
  
  const namingInconsistencies = [
    ...checkNamingConsistency(names),
    ...identifyDomainTermMismatches(content),
    ...checkAbbreviations(names)
  ];
  
  const i18nKeyPatterns = analyzeI18nKeyPatterns(i18nKeys);
  
  // Combine domain term issues
  const domainTerms = namingInconsistencies.filter(issue => 
    Object.keys(DOMAIN_TERMS).includes(issue.term)
  );
  
  return {
    namingInconsistencies,
    i18nKeyPatterns,
    domainTerms
  };
}

/**
 * Generate terminology findings from analysis
 */
export function generateTerminologyFindings(
  stepName: string,
  filePath: string,
  analysis: TerminologyAnalysis
): AnalysisFinding[] {
  const findings: AnalysisFinding[] = [];
  let findingId = 1;
  
  // Naming inconsistency findings
  for (const issue of analysis.namingInconsistencies) {
    findings.push({
      id: `${stepName}-TERM-${findingId++}`,
      stepName,
      category: FindingCategory.Terminology,
      severity: Severity.Low,
      title: `Inconsistent terminology for "${issue.term}"`,
      description: `Found variations: ${issue.variations.join(', ')}. Locations: ${issue.locations.slice(0, 3).join(', ')}${issue.locations.length > 3 ? '...' : ''}`,
      impact: 'Inconsistent terminology makes code harder to understand and maintain.',
      filePaths: [filePath],
      suggestedFix: `Standardize on "${issue.recommended}" throughout the codebase.`,
      codeSnippet: `// Instead of mixing:\nconst schoolInfo = ...;\nconst institutionData = ...;\n\n// Use consistent term:\nconst schoolInfo = ...;\nconst schoolData = ...;`,
      estimatedEffort: Effort.Small,
      acceptanceCriteria: [
        `All references use "${issue.recommended}"`,
        'Terminology is consistent across files',
        'Code is more readable'
      ]
    });
  }
  
  // i18n pattern findings
  if (analysis.i18nKeyPatterns.some(p => p.includes('hardcoded'))) {
    findings.push({
      id: `${stepName}-TERM-${findingId++}`,
      stepName,
      category: FindingCategory.Terminology,
      severity: Severity.High,
      title: 'Hardcoded text detected',
      description: 'Text is hardcoded instead of using i18n translation keys.',
      impact: 'Makes internationalization impossible and creates maintenance burden.',
      filePaths: [filePath],
      suggestedFix: 'Extract all user-facing text to translation files and use t() function.',
      codeSnippet: `// Instead of:\n<Button>Save and Continue</Button>\n\n// Use:\nconst { t } = useTranslation();\n<Button>{t('wizard.common.saveAndContinue')}</Button>`,
      estimatedEffort: Effort.Medium,
      acceptanceCriteria: [
        'All user-facing text uses i18n keys',
        'Translation keys follow consistent pattern',
        'Both English and Persian translations exist'
      ]
    });
  }
  
  if (analysis.i18nKeyPatterns.some(p => p.includes('Mixed'))) {
    findings.push({
      id: `${stepName}-TERM-${findingId++}`,
      stepName,
      category: FindingCategory.Terminology,
      severity: Severity.Low,
      title: 'Inconsistent i18n key casing',
      description: analysis.i18nKeyPatterns.filter(p => p.includes('Mixed')).join('; '),
      impact: 'Makes translation keys harder to find and maintain.',
      filePaths: [filePath],
      suggestedFix: 'Standardize on camelCase for i18n keys (e.g., wizard.schoolInfo.title)',
      estimatedEffort: Effort.Small,
      acceptanceCriteria: [
        'All i18n keys use consistent casing',
        'Keys follow project conventions',
        'Keys are easy to find and maintain'
      ]
    });
  }
  
  if (analysis.i18nKeyPatterns.some(p => p.includes('Multiple namespaces'))) {
    findings.push({
      id: `${stepName}-TERM-${findingId++}`,
      stepName,
      category: FindingCategory.Terminology,
      severity: Severity.Low,
      title: 'Multiple i18n namespaces used',
      description: analysis.i18nKeyPatterns.find(p => p.includes('Multiple namespaces')) || '',
      impact: 'Makes it harder to organize and find translations.',
      filePaths: [filePath],
      suggestedFix: 'Consolidate to 2-3 main namespaces (e.g., wizard, common, errors)',
      estimatedEffort: Effort.Small,
      acceptanceCriteria: [
        'Translations organized into logical namespaces',
        'Namespace usage is consistent',
        'Easy to find related translations'
      ]
    });
  }
  
  return findings;
}

/**
 * Generate terminology recommendations
 */
export function generateTerminologyRecommendations(
  analysis: TerminologyAnalysis
): string[] {
  const recommendations: string[] = [];
  
  if (analysis.namingInconsistencies.length > 0) {
    recommendations.push('Create a terminology guide documenting preferred terms');
    recommendations.push('Run a codebase-wide search and replace for inconsistent terms');
  }
  
  if (analysis.i18nKeyPatterns.some(p => p.includes('hardcoded'))) {
    recommendations.push('Audit all components for hardcoded text');
    recommendations.push('Set up linting rules to prevent hardcoded text');
  }
  
  if (analysis.i18nKeyPatterns.some(p => p.includes('deeply nested'))) {
    recommendations.push('Flatten i18n key structure for better maintainability');
  }
  
  if (analysis.domainTerms.length > 0) {
    recommendations.push('Document domain terminology in project README');
    recommendations.push('Use TypeScript types to enforce consistent terminology');
  }
  
  return recommendations;
}
