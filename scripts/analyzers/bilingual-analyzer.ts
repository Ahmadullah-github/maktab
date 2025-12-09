/**
 * Bilingual Support Analyzer
 * 
 * Verifies RTL direction handling, checks translation completeness and accuracy,
 * validates Persian font loading, and checks numeral localization.
 */

import {
  BilingualAnalysis,
  AnalysisFinding,
  FindingCategory,
  Severity,
  Effort,
  BilingualText
} from '../analysis-types';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check RTL direction handling in component
 */
function checkRTLHandling(content: string, filePath: string): string[] {
  const issues: string[] = [];
  
  // Check if component uses isRTL or dir attribute
  const hasRTLCheck = /isRTL|dir\s*=\s*{/.test(content);
  
  if (!hasRTLCheck) {
    issues.push(`No RTL direction handling detected in ${filePath}`);
  }
  
  // Check for hardcoded text-left or text-right without RTL consideration
  const hardcodedAlignment = content.match(/className\s*=\s*["'][^"']*text-(left|right)[^"']*["']/g);
  if (hardcodedAlignment && hardcodedAlignment.length > 0) {
    issues.push(`Found ${hardcodedAlignment.length} hardcoded text alignment(s) that may not work with RTL`);
  }
  
  // Check for hardcoded margin/padding left/right without RTL consideration
  const hardcodedSpacing = content.match(/className\s*=\s*["'][^"']*(ml-|mr-|pl-|pr-)[^"']*["']/g);
  if (hardcodedSpacing && hardcodedSpacing.length > 0) {
    const count = hardcodedSpacing.length;
    if (count > 5) { // Only flag if there are many instances
      issues.push(`Found ${count} hardcoded left/right spacing classes (ml-, mr-, pl-, pr-) that should use logical properties (ms-, me-, ps-, pe-) for RTL support`);
    }
  }
  
  // Check for flex direction without RTL consideration
  const flexDirection = content.match(/flex-row(?!-reverse)/g);
  if (flexDirection && flexDirection.length > 3) {
    issues.push(`Found ${flexDirection.length} flex-row usages that may need RTL consideration`);
  }
  
  // Check if dir attribute is properly set on container elements
  const hasDirAttribute = /dir\s*=\s*{isRTL\s*\?\s*["']rtl["']\s*:\s*["']ltr["']}/.test(content);
  if (hasRTLCheck && !hasDirAttribute) {
    issues.push('Component has RTL logic but may not set dir attribute on container elements');
  }
  
  return issues;
}

/**
 * Check translation completeness
 */
function checkTranslationCompleteness(
  content: string,
  enTranslations: any,
  faTranslations: any
): string[] {
  const issues: string[] = [];
  
  // Extract translation keys used in component (t.key.path pattern)
  const translationKeyPattern = /t\.([a-zA-Z0-9_.]+)/g;
  const usedKeys: string[] = [];
  
  let match;
  while ((match = translationKeyPattern.exec(content)) !== null) {
    usedKeys.push(match[1]);
  }
  
  // Check if keys exist in both EN and FA
  for (const key of usedKeys) {
    const keyPath = key.split('.');
    
    // Check English
    let enValue = enTranslations;
    let enExists = true;
    for (const part of keyPath) {
      if (enValue && typeof enValue === 'object' && part in enValue) {
        enValue = enValue[part];
      } else {
        enExists = false;
        break;
      }
    }
    
    // Check Persian
    let faValue = faTranslations;
    let faExists = true;
    for (const part of keyPath) {
      if (faValue && typeof faValue === 'object' && part in faValue) {
        faValue = faValue[part];
      } else {
        faExists = false;
        break;
      }
    }
    
    if (!enExists) {
      issues.push(`Translation key "${key}" missing in English translations`);
    }
    
    if (!faExists) {
      issues.push(`Translation key "${key}" missing in Persian translations`);
    }
    
    // Check if translation is just a placeholder or empty
    if (enExists && typeof enValue === 'string' && (enValue.trim() === '' || enValue === key)) {
      issues.push(`Translation key "${key}" has empty or placeholder English text`);
    }
    
    if (faExists && typeof faValue === 'string' && (faValue.trim() === '' || faValue === key)) {
      issues.push(`Translation key "${key}" has empty or placeholder Persian text`);
    }
  }
  
  // Check for hardcoded English text in JSX
  const hardcodedTextPattern = />([A-Z][a-zA-Z\s]{3,})</g;
  const hardcodedTexts: string[] = [];
  
  while ((match = hardcodedTextPattern.exec(content)) !== null) {
    const text = match[1].trim();
    // Filter out common non-translatable text
    if (text.length > 3 && !text.match(/^(div|span|button|input|label|form)$/i)) {
      hardcodedTexts.push(text);
    }
  }
  
  if (hardcodedTexts.length > 0) {
    issues.push(`Found ${hardcodedTexts.length} potential hardcoded English text(s) that should use translation keys: ${hardcodedTexts.slice(0, 3).join(', ')}${hardcodedTexts.length > 3 ? '...' : ''}`);
  }
  
  return issues;
}

/**
 * Check Persian font loading
 */
function checkPersianFontLoading(content: string): string[] {
  const issues: string[] = [];
  
  // Check if component references Persian font
  const hasFontReference = /font-vazir|Vazir|font-family.*Vazir/i.test(content);
  
  // Check for font loading logic
  const hasFontLoading = /fontFamily|font-family|className.*font-/i.test(content);
  
  if (!hasFontReference && hasFontLoading) {
    issues.push('Component uses fonts but no Persian font (Vazir) reference detected');
  }
  
  // Check for font loading without fallback
  const fontFamilyPattern = /font-family:\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = fontFamilyPattern.exec(content)) !== null) {
    const fontFamily = match[1];
    if (!fontFamily.includes('sans-serif') && !fontFamily.includes('serif')) {
      issues.push(`Font family "${fontFamily}" missing fallback font`);
    }
  }
  
  return issues;
}

/**
 * Check numeral localization
 */
function checkNumeralLocalization(content: string): string[] {
  const issues: string[] = [];
  
  // Check for number formatting
  const hasNumberFormatting = /toLocaleString|Intl\.NumberFormat|formatNumber/i.test(content);
  
  // Check for hardcoded numbers in JSX that might need localization
  const numberPattern = />\s*(\d{2,})\s*</g;
  const hardcodedNumbers: string[] = [];
  
  let match;
  while ((match = numberPattern.exec(content)) !== null) {
    hardcodedNumbers.push(match[1]);
  }
  
  if (hardcodedNumbers.length > 3 && !hasNumberFormatting) {
    issues.push(`Found ${hardcodedNumbers.length} hardcoded number(s) that may need localization for Persian (Arabic-Indic numerals)`);
  }
  
  // Check for date formatting
  const hasDateFormatting = /toLocaleDateString|Intl\.DateTimeFormat|formatDate/i.test(content);
  const hasDateUsage = /Date\(|date|time|timestamp/i.test(content);
  
  if (hasDateUsage && !hasDateFormatting) {
    issues.push('Component uses dates but no localization detected (should support Jalali/Hijri calendars)');
  }
  
  return issues;
}

/**
 * Extract bilingual text pairs from component
 */
function extractBilingualTextPairs(
  content: string,
  enTranslations: any,
  faTranslations: any
): BilingualText[] {
  const pairs: BilingualText[] = [];
  
  // Extract translation keys
  const translationKeyPattern = /t\.([a-zA-Z0-9_.]+)/g;
  const usedKeys = new Set<string>();
  
  let match;
  while ((match = translationKeyPattern.exec(content)) !== null) {
    usedKeys.add(match[1]);
  }
  
  // Get EN/FA pairs for each key
  for (const key of usedKeys) {
    const keyPath = key.split('.');
    
    let enValue = enTranslations;
    for (const part of keyPath) {
      if (enValue && typeof enValue === 'object' && part in enValue) {
        enValue = enValue[part];
      } else {
        enValue = null;
        break;
      }
    }
    
    let faValue = faTranslations;
    for (const part of keyPath) {
      if (faValue && typeof faValue === 'object' && part in faValue) {
        faValue = faValue[part];
      } else {
        faValue = null;
        break;
      }
    }
    
    if (enValue && faValue && typeof enValue === 'string' && typeof faValue === 'string') {
      pairs.push({
        en: enValue,
        fa: faValue,
        context: `Translation key: ${key}`
      });
    }
  }
  
  return pairs;
}

// ============================================================================
// Main Analyzer Function
// ============================================================================

/**
 * Analyze bilingual support in a wizard step component
 */
export function analyzeBilingualSupport(
  filePath: string,
  content: string,
  enTranslations: any = {},
  faTranslations: any = {}
): BilingualAnalysis {
  return {
    rtlHandling: checkRTLHandling(content, filePath),
    translationGaps: checkTranslationCompleteness(content, enTranslations, faTranslations),
    fontLoading: checkPersianFontLoading(content),
    numeralLocalization: checkNumeralLocalization(content)
  };
}

/**
 * Generate bilingual support findings from analysis
 */
export function generateBilingualFindings(
  stepName: string,
  filePath: string,
  analysis: BilingualAnalysis,
  enTranslations: any = {},
  faTranslations: any = {}
): AnalysisFinding[] {
  const findings: AnalysisFinding[] = [];
  let findingId = 1;
  
  // RTL handling issues
  if (analysis.rtlHandling.length > 0) {
    const criticalRTLIssues = analysis.rtlHandling.filter(issue => 
      issue.includes('No RTL direction handling') || 
      issue.includes('hardcoded text alignment')
    );
    
    if (criticalRTLIssues.length > 0) {
      findings.push({
        id: `${stepName}-BILINGUAL-${findingId++}`,
        stepName,
        category: FindingCategory.Bilingual,
        severity: Severity.High,
        title: 'RTL direction handling issues',
        description: criticalRTLIssues.join('; '),
        impact: 'Persian/Dari users will see misaligned text and broken layouts. UI elements may appear in wrong positions.',
        filePaths: [filePath],
        suggestedFix: 'Add RTL support using isRTL context and dir attribute. Use logical properties (ms-, me-, ps-, pe-) instead of left/right.',
        codeSnippet: `// Add RTL support:\nconst { isRTL } = useLanguageCtx();\n\nreturn (\n  <div dir={isRTL ? "rtl" : "ltr"} className="space-y-4">\n    {/* Use logical properties */}\n    <div className="ms-4 me-2"> {/* instead of ml-4 mr-2 */}\n      {/* Content */}\n    </div>\n  </div>\n);`,
        estimatedEffort: Effort.Small,
        acceptanceCriteria: [
          'Component sets dir attribute based on language',
          'Layout mirrors correctly in RTL mode',
          'Text alignment adapts to language direction',
          'Spacing uses logical properties'
        ]
      });
    }
    
    // Spacing issues
    const spacingIssues = analysis.rtlHandling.filter(issue => 
      issue.includes('left/right spacing')
    );
    
    if (spacingIssues.length > 0) {
      findings.push({
        id: `${stepName}-BILINGUAL-${findingId++}`,
        stepName,
        category: FindingCategory.Bilingual,
        severity: Severity.Medium,
        title: 'Hardcoded directional spacing',
        description: spacingIssues.join('; '),
        impact: 'Spacing will not mirror correctly in RTL mode, causing visual inconsistencies.',
        filePaths: [filePath],
        suggestedFix: 'Replace ml-/mr-/pl-/pr- with ms-/me-/ps-/pe- (logical properties).',
        codeSnippet: `// Replace directional with logical properties:\n// Before: className="ml-4 mr-2 pl-3 pr-1"\n// After:  className="ms-4 me-2 ps-3 pe-1"\n\n// ms = margin-inline-start (left in LTR, right in RTL)\n// me = margin-inline-end (right in LTR, left in RTL)\n// ps = padding-inline-start\n// pe = padding-inline-end`,
        estimatedEffort: Effort.Small,
        acceptanceCriteria: [
          'All directional spacing uses logical properties',
          'Spacing mirrors correctly in RTL mode'
        ]
      });
    }
  }
  
  // Translation completeness issues
  if (analysis.translationGaps.length > 0) {
    const missingTranslations = analysis.translationGaps.filter(issue =>
      issue.includes('missing in') || issue.includes('empty or placeholder')
    );
    
    if (missingTranslations.length > 0) {
      findings.push({
        id: `${stepName}-BILINGUAL-${findingId++}`,
        stepName,
        category: FindingCategory.Bilingual,
        severity: Severity.High,
        title: 'Missing or incomplete translations',
        description: missingTranslations.slice(0, 5).join('; ') + (missingTranslations.length > 5 ? `... and ${missingTranslations.length - 5} more` : ''),
        impact: 'Users will see missing text, English fallbacks, or translation keys instead of proper Persian text.',
        filePaths: [filePath],
        suggestedFix: 'Add missing translations to i18n files. Ensure all translation keys have both EN and FA values.',
        codeSnippet: `// Add to packages/web/src/i18n/en.ts and fa.ts:\nexport const en = {\n  // ... existing translations\n  yourSection: {\n    newKey: 'English text',\n  }\n};\n\nexport const fa = {\n  // ... existing translations\n  yourSection: {\n    newKey: 'متن فارسی',\n  }\n};`,
        estimatedEffort: Effort.Small,
        acceptanceCriteria: [
          'All translation keys exist in both EN and FA files',
          'No empty or placeholder translations',
          'Persian text displays correctly in UI'
        ]
      });
    }
    
    const hardcodedText = analysis.translationGaps.filter(issue =>
      issue.includes('hardcoded English text')
    );
    
    if (hardcodedText.length > 0) {
      findings.push({
        id: `${stepName}-BILINGUAL-${findingId++}`,
        stepName,
        category: FindingCategory.Bilingual,
        severity: Severity.Medium,
        title: 'Hardcoded text not using translations',
        description: hardcodedText.join('; '),
        impact: 'Text will always appear in English, even when Persian language is selected.',
        filePaths: [filePath],
        suggestedFix: 'Move hardcoded text to translation files and use t.key pattern.',
        codeSnippet: `// Before:\n<button>Save Changes</button>\n\n// After:\n// 1. Add to i18n files:\n// en.ts: { button: { save: 'Save Changes' } }\n// fa.ts: { button: { save: 'ذخیره تغییرات' } }\n\n// 2. Use in component:\nconst { t } = useLanguageCtx();\n<button>{t.button.save}</button>`,
        estimatedEffort: Effort.Small,
        acceptanceCriteria: [
          'No hardcoded English text in JSX',
          'All user-facing text uses translation keys',
          'Text switches correctly when language changes'
        ]
      });
    }
  }
  
  // Font loading issues
  if (analysis.fontLoading.length > 0) {
    findings.push({
      id: `${stepName}-BILINGUAL-${findingId++}`,
      stepName,
      category: FindingCategory.Bilingual,
      severity: Severity.Medium,
      title: 'Persian font loading issues',
      description: analysis.fontLoading.join('; '),
      impact: 'Persian text may render with incorrect font, causing readability issues or visual inconsistencies.',
      filePaths: [filePath],
      suggestedFix: 'Ensure Vazir font is loaded and applied for Persian text. Add fallback fonts.',
      codeSnippet: `// Ensure font is loaded in global CSS or Tailwind config:\n// tailwind.config.js:\nmodule.exports = {\n  theme: {\n    extend: {\n      fontFamily: {\n        vazir: ['Vazir', 'sans-serif'],\n      },\n    },\n  },\n};\n\n// Apply font based on language:\nconst { isRTL } = useLanguageCtx();\n<div className={isRTL ? 'font-vazir' : 'font-sans'}>\n  {/* Content */}\n</div>`,
      estimatedEffort: Effort.Small,
      acceptanceCriteria: [
        'Vazir font loads correctly for Persian text',
        'Fallback fonts are specified',
        'No font loading delays or FOUT (Flash of Unstyled Text)'
      ]
    });
  }
  
  // Numeral localization issues
  if (analysis.numeralLocalization.length > 0) {
    findings.push({
      id: `${stepName}-BILINGUAL-${findingId++}`,
      stepName,
      category: FindingCategory.Bilingual,
      severity: Severity.Low,
      title: 'Numeral localization not implemented',
      description: analysis.numeralLocalization.join('; '),
      impact: 'Numbers and dates will display in Western format even for Persian users. May cause confusion.',
      filePaths: [filePath],
      suggestedFix: 'Use Intl.NumberFormat and Intl.DateTimeFormat for locale-aware formatting. Consider Arabic-Indic numerals for Persian.',
      codeSnippet: `// Format numbers for locale:\nconst { language } = useLanguageCtx();\n\nconst formatNumber = (num: number) => {\n  return new Intl.NumberFormat(language === 'fa' ? 'fa-AF' : 'en-US').format(num);\n};\n\n// Format dates:\nconst formatDate = (date: Date) => {\n  return new Intl.DateTimeFormat(language === 'fa' ? 'fa-AF' : 'en-US').format(date);\n};\n\n// Usage:\n<span>{formatNumber(1234)}</span> {/* Shows ۱۲۳۴ in Persian */}\n<span>{formatDate(new Date())}</span>`,
      estimatedEffort: Effort.Medium,
      acceptanceCriteria: [
        'Numbers display in Arabic-Indic numerals for Persian',
        'Dates format according to locale',
        'Calendar system adapts (Gregorian/Jalali/Hijri)'
      ]
    });
  }
  
  return findings;
}

/**
 * Extract bilingual text pairs for documentation
 */
export function extractBilingualPairs(
  content: string,
  enTranslations: any = {},
  faTranslations: any = {}
): BilingualText[] {
  return extractBilingualTextPairs(content, enTranslations, faTranslations);
}
