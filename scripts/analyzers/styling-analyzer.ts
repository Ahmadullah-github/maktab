/**
 * Styling Analyzer
 * 
 * Identifies styling inconsistencies (spacing, colors, typography),
 * analyzes component pattern usage, detects Tailwind class duplication,
 * and verifies design token usage.
 */

import {
  StylingAnalysis,
  StylingInconsistency,
  DesignTokenUsage,
  AnalysisFinding,
  FindingCategory,
  Severity,
  Effort
} from '../analysis-types';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract all Tailwind classes from content
 */
function extractTailwindClasses(content: string): string[] {
  const classes: string[] = [];
  
  // Match className="..." and className={...}
  const classNamePattern = /className\s*=\s*(?:["']([^"']+)["']|{([^}]+)})/g;
  let match;
  
  while ((match = classNamePattern.exec(content)) !== null) {
    const classString = match[1] || match[2];
    if (classString) {
      // Remove template literal syntax and split by spaces
      const cleanedClasses = classString
        .replace(/[`${}]/g, '')
        .split(/\s+/)
        .filter(c => c.length > 0);
      
      classes.push(...cleanedClasses);
    }
  }
  
  return classes;
}

/**
 * Categorize Tailwind classes
 */
function categorizeTailwindClasses(classes: string[]): {
  spacing: string[];
  colors: string[];
  typography: string[];
  layout: string[];
  other: string[];
} {
  const spacing: string[] = [];
  const colors: string[] = [];
  const typography: string[] = [];
  const layout: string[] = [];
  const other: string[] = [];
  
  for (const cls of classes) {
    if (/^[mp][trblxy]?-/.test(cls) || /^gap-|^space-/.test(cls)) {
      spacing.push(cls);
    } else if (/^(?:text|bg|border|ring|shadow)-(?:red|blue|green|yellow|purple|pink|gray|slate|zinc|neutral|stone|orange|amber|lime|emerald|teal|cyan|sky|indigo|violet|fuchsia|rose|white|black)-/.test(cls)) {
      colors.push(cls);
    } else if (/^(?:text-|font-|leading-|tracking-|italic|underline|line-through|uppercase|lowercase|capitalize)/.test(cls)) {
      typography.push(cls);
    } else if (/^(?:flex|grid|block|inline|hidden|container|w-|h-|min-|max-)/.test(cls)) {
      layout.push(cls);
    } else {
      other.push(cls);
    }
  }
  
  return { spacing, colors, typography, layout, other };
}

/**
 * Find duplicate class patterns
 */
function findDuplicatePatterns(classes: string[]): Map<string, number> {
  const frequency = new Map<string, number>();
  
  for (const cls of classes) {
    frequency.set(cls, (frequency.get(cls) || 0) + 1);
  }
  
  // Filter to only duplicates (used more than 3 times)
  const duplicates = new Map<string, number>();
  for (const [cls, count] of frequency.entries()) {
    if (count > 3) {
      duplicates.set(cls, count);
    }
  }
  
  return duplicates;
}

/**
 * Identify spacing inconsistencies
 */
function identifySpacingInconsistencies(spacingClasses: string[]): StylingInconsistency[] {
  const inconsistencies: StylingInconsistency[] = [];
  
  // Extract spacing values
  const spacingValues = new Set<string>();
  for (const cls of spacingClasses) {
    const match = cls.match(/[mp][trblxy]?-(\d+|px|auto)/);
    if (match) {
      spacingValues.add(match[1]);
    }
  }
  
  // Check for too many different spacing values
  if (spacingValues.size > 8) {
    inconsistencies.push({
      type: 'spacing',
      locations: ['Throughout component'],
      expected: 'Consistent spacing scale (e.g., 2, 4, 6, 8)',
      actual: `${spacingValues.size} different spacing values`,
      fix: 'Use a consistent spacing scale from design system'
    });
  }
  
  // Check for non-standard spacing values
  const standardSpacing = ['0', '1', '2', '3', '4', '5', '6', '8', '10', '12', '16', '20', '24', 'px', 'auto'];
  const nonStandard = Array.from(spacingValues).filter(v => !standardSpacing.includes(v));
  
  if (nonStandard.length > 0) {
    inconsistencies.push({
      type: 'spacing',
      locations: ['Throughout component'],
      expected: 'Standard spacing values',
      actual: `Non-standard values: ${nonStandard.join(', ')}`,
      fix: 'Replace with standard spacing values from design system'
    });
  }
  
  return inconsistencies;
}

/**
 * Identify color inconsistencies
 */
function identifyColorInconsistencies(colorClasses: string[]): StylingInconsistency[] {
  const inconsistencies: StylingInconsistency[] = [];
  
  // Extract color names and shades
  const colors = new Map<string, Set<string>>();
  
  for (const cls of colorClasses) {
    const match = cls.match(/(?:text|bg|border)-(\w+)-(\d+)/);
    if (match) {
      const colorName = match[1];
      const shade = match[2];
      
      if (!colors.has(colorName)) {
        colors.set(colorName, new Set());
      }
      colors.get(colorName)!.add(shade);
    }
  }
  
  // Check for too many color variations
  if (colors.size > 5) {
    inconsistencies.push({
      type: 'color',
      locations: ['Throughout component'],
      expected: 'Limited color palette (3-5 colors)',
      actual: `${colors.size} different colors used`,
      fix: 'Consolidate to primary, secondary, and accent colors from design system'
    });
  }
  
  // Check for inconsistent shades
  for (const [colorName, shades] of colors.entries()) {
    if (shades.size > 4) {
      inconsistencies.push({
        type: 'color',
        locations: ['Throughout component'],
        expected: `Consistent ${colorName} shades`,
        actual: `${shades.size} different shades: ${Array.from(shades).join(', ')}`,
        fix: `Use consistent ${colorName} shades (e.g., 500 for primary, 600 for hover)`
      });
    }
  }
  
  return inconsistencies;
}

/**
 * Identify typography inconsistencies
 */
function identifyTypographyInconsistencies(typographyClasses: string[]): StylingInconsistency[] {
  const inconsistencies: StylingInconsistency[] = [];
  
  // Extract font sizes
  const fontSizes = new Set<string>();
  for (const cls of typographyClasses) {
    const match = cls.match(/text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)/);
    if (match) {
      fontSizes.add(match[1]);
    }
  }
  
  // Check for too many font sizes
  if (fontSizes.size > 6) {
    inconsistencies.push({
      type: 'typography',
      locations: ['Throughout component'],
      expected: 'Limited font size scale (4-6 sizes)',
      actual: `${fontSizes.size} different font sizes`,
      fix: 'Use consistent typography scale from design system'
    });
  }
  
  // Extract font weights
  const fontWeights = new Set<string>();
  for (const cls of typographyClasses) {
    const match = cls.match(/font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)/);
    if (match) {
      fontWeights.add(match[1]);
    }
  }
  
  // Check for too many font weights
  if (fontWeights.size > 4) {
    inconsistencies.push({
      type: 'typography',
      locations: ['Throughout component'],
      expected: 'Limited font weights (2-4 weights)',
      actual: `${fontWeights.size} different font weights`,
      fix: 'Use consistent font weights (e.g., normal, medium, bold)'
    });
  }
  
  return inconsistencies;
}

/**
 * Identify component patterns
 */
function identifyComponentPatterns(content: string): string[] {
  const patterns: string[] = [];
  
  // Common UI component patterns
  const componentPatterns = [
    { name: 'Card', pattern: /<Card|className="[^"]*card/i },
    { name: 'Form', pattern: /<Form|<form/i },
    { name: 'Button', pattern: /<Button/i },
    { name: 'Input', pattern: /<Input/i },
    { name: 'Modal/Dialog', pattern: /<Modal|<Dialog/i },
    { name: 'Table', pattern: /<Table|<table/i },
    { name: 'List', pattern: /<List|<ul|<ol/i },
    { name: 'Grid', pattern: /className="[^"]*grid/i },
    { name: 'Flex', pattern: /className="[^"]*flex/i },
    { name: 'Tooltip', pattern: /<Tooltip/i },
    { name: 'Badge', pattern: /<Badge/i },
    { name: 'Alert', pattern: /<Alert/i }
  ];
  
  for (const { name, pattern } of componentPatterns) {
    if (pattern.test(content)) {
      patterns.push(name);
    }
  }
  
  return patterns;
}

/**
 * Analyze design token usage
 */
function analyzeDesignTokenUsage(classes: string[]): DesignTokenUsage {
  const categorized = categorizeTailwindClasses(classes);
  
  // Identify custom values (non-Tailwind)
  const customValues: string[] = [];
  
  for (const cls of classes) {
    // Check for arbitrary values [...]
    if (cls.includes('[') && cls.includes(']')) {
      customValues.push(cls);
    }
  }
  
  return {
    colors: Array.from(new Set(categorized.colors)),
    spacing: Array.from(new Set(categorized.spacing)),
    typography: Array.from(new Set(categorized.typography)),
    customValues
  };
}

// ============================================================================
// Main Analyzer Function
// ============================================================================

/**
 * Analyze styling patterns in a wizard step component
 */
export function analyzeStyling(
  filePath: string,
  content: string
): StylingAnalysis {
  const classes = extractTailwindClasses(content);
  const categorized = categorizeTailwindClasses(classes);
  
  const inconsistencies: StylingInconsistency[] = [
    ...identifySpacingInconsistencies(categorized.spacing),
    ...identifyColorInconsistencies(categorized.colors),
    ...identifyTypographyInconsistencies(categorized.typography)
  ];
  
  const componentPatterns = identifyComponentPatterns(content);
  const designTokenUsage = analyzeDesignTokenUsage(classes);
  
  // Get most used classes
  const duplicates = findDuplicatePatterns(classes);
  const tailwindClasses = Array.from(duplicates.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([cls, count]) => `${cls} (${count}x)`);
  
  return {
    componentPatterns,
    tailwindClasses,
    inconsistencies,
    designTokenUsage
  };
}

/**
 * Generate styling findings from analysis
 */
export function generateStylingFindings(
  stepName: string,
  filePath: string,
  analysis: StylingAnalysis
): AnalysisFinding[] {
  const findings: AnalysisFinding[] = [];
  let findingId = 1;
  
  // Inconsistency findings
  for (const inconsistency of analysis.inconsistencies) {
    const severity = inconsistency.type === 'color' ? Severity.Medium : Severity.Low;
    
    findings.push({
      id: `${stepName}-STYLE-${findingId++}`,
      stepName,
      category: FindingCategory.Styling,
      severity,
      title: `${inconsistency.type.charAt(0).toUpperCase() + inconsistency.type.slice(1)} inconsistency`,
      description: `${inconsistency.actual}. Expected: ${inconsistency.expected}`,
      impact: 'Inconsistent styling reduces visual coherence and makes the UI feel unpolished.',
      filePaths: [filePath],
      suggestedFix: inconsistency.fix,
      estimatedEffort: Effort.Small,
      acceptanceCriteria: [
        'Styling follows design system guidelines',
        'Consistent values used throughout',
        'Visual coherence improved'
      ]
    });
  }
  
  // Custom value findings
  if (analysis.designTokenUsage.customValues.length > 0) {
    findings.push({
      id: `${stepName}-STYLE-${findingId++}`,
      stepName,
      category: FindingCategory.Styling,
      severity: Severity.Low,
      title: 'Custom CSS values used',
      description: `Found ${analysis.designTokenUsage.customValues.length} custom values: ${analysis.designTokenUsage.customValues.slice(0, 5).join(', ')}`,
      impact: 'Custom values bypass design system, leading to inconsistency.',
      filePaths: [filePath],
      suggestedFix: 'Replace custom values with design tokens from Tailwind config.',
      codeSnippet: `// Instead of:\nclassName="w-[347px] text-[#3B82F6]"\n\n// Use design tokens:\nclassName="w-80 text-blue-500"`,
      estimatedEffort: Effort.Small,
      acceptanceCriteria: [
        'Custom values replaced with design tokens',
        'Styling uses Tailwind standard classes',
        'Design system is followed'
      ]
    });
  }
  
  // Duplicate class findings
  if (analysis.tailwindClasses.length > 0) {
    const highFrequencyClasses = analysis.tailwindClasses.filter(c => {
      const count = parseInt(c.match(/\((\d+)x\)/)?.[1] || '0');
      return count > 5;
    });
    
    if (highFrequencyClasses.length > 0) {
      findings.push({
        id: `${stepName}-STYLE-${findingId++}`,
        stepName,
        category: FindingCategory.Styling,
        severity: Severity.Low,
        title: 'Repeated Tailwind classes',
        description: `Frequently repeated classes: ${highFrequencyClasses.join(', ')}`,
        impact: 'Class duplication makes styling harder to maintain and update consistently.',
        filePaths: [filePath],
        suggestedFix: 'Extract repeated class combinations into reusable components or CSS classes.',
        codeSnippet: `// Extract to component:\nconst FormField = ({ children }) => (\n  <div className="mb-4 space-y-2">\n    {children}\n  </div>\n);\n\n// Or use @apply in CSS:\n.form-field {\n  @apply mb-4 space-y-2;\n}`,
        estimatedEffort: Effort.Small,
        acceptanceCriteria: [
          'Repeated patterns extracted to components',
          'Styling is more maintainable',
          'Consistent styling across similar elements'
        ]
      });
    }
  }
  
  // Component pattern findings
  if (analysis.componentPatterns.length === 0) {
    findings.push({
      id: `${stepName}-STYLE-${findingId++}`,
      stepName,
      category: FindingCategory.Styling,
      severity: Severity.Medium,
      title: 'No UI component patterns detected',
      description: 'Component does not use standard UI patterns (Card, Form, etc.)',
      impact: 'May indicate custom styling that does not follow design system.',
      filePaths: [filePath],
      suggestedFix: 'Use standard UI components from component library (Chakra UI, shadcn/ui, etc.)',
      estimatedEffort: Effort.Medium,
      acceptanceCriteria: [
        'Standard UI components are used',
        'Styling follows design system',
        'Component is consistent with other steps'
      ]
    });
  }
  
  return findings;
}

/**
 * Generate styling recommendations
 */
export function generateStylingRecommendations(
  analysis: StylingAnalysis
): string[] {
  const recommendations: string[] = [];
  
  // Spacing recommendations
  const spacingClasses = analysis.designTokenUsage.spacing;
  if (spacingClasses.length > 10) {
    recommendations.push('Consolidate spacing values to a consistent scale (e.g., 4, 8, 12, 16, 24)');
  }
  
  // Color recommendations
  const colorClasses = analysis.designTokenUsage.colors;
  const uniqueColors = new Set(colorClasses.map(c => c.match(/(?:text|bg|border)-(\w+)-/)?.[1]).filter(Boolean));
  if (uniqueColors.size > 5) {
    recommendations.push('Reduce color palette to 3-5 primary colors');
  }
  
  // Typography recommendations
  const typographyClasses = analysis.designTokenUsage.typography;
  const fontSizes = new Set(typographyClasses.filter(c => c.startsWith('text-')));
  if (fontSizes.size > 6) {
    recommendations.push('Simplify typography scale to 4-6 font sizes');
  }
  
  // Custom value recommendations
  if (analysis.designTokenUsage.customValues.length > 0) {
    recommendations.push('Replace custom CSS values with design tokens');
  }
  
  // Component pattern recommendations
  if (analysis.componentPatterns.length < 3) {
    recommendations.push('Use more standard UI components for consistency');
  }
  
  return recommendations;
}
