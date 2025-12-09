/**
 * UI/UX Analyzer
 * 
 * Analyzes layout effectiveness, visual hierarchy, interaction patterns,
 * form controls, feedback mechanisms, hand-holding opportunities, and
 * accessibility compliance.
 */

import {
  UIUXAnalysis,
  LayoutAnalysis,
  InteractionAnalysis,
  FeedbackAnalysis,
  AccessibilityAnalysis,
  BilingualAnalysis,
  AnalysisFinding,
  FindingCategory,
  Severity,
  Effort,
  BilingualText
} from '../analysis-types';

// ============================================================================
// Layout Analysis
// ============================================================================

function analyzeLayout(content: string): LayoutAnalysis {
  const spacing: string[] = [];
  const grouping: string[] = [];
  const responsive: string[] = [];
  
  // Check for spacing patterns
  const spacingClasses = content.match(/(?:p|m|gap|space)-\d+/g) || [];
  const uniqueSpacing = [...new Set(spacingClasses)];
  
  if (uniqueSpacing.length > 10) {
    spacing.push(`High variety of spacing values (${uniqueSpacing.length} unique)`);
  }
  
  // Check for grouping elements
  const hasFieldsets = content.includes('fieldset') || content.includes('Fieldset');
  const hasCards = content.includes('Card') || content.includes('card');
  const hasSections = content.includes('section') || content.includes('Section');
  
  if (!hasFieldsets && !hasCards && !hasSections) {
    grouping.push('No clear grouping elements (fieldset, Card, section) found');
  }
  
  // Check for responsive design
  const hasResponsiveClasses = /(?:sm:|md:|lg:|xl:|2xl:)/.test(content);
  const hasFlexbox = /flex|grid/.test(content);
  
  if (!hasResponsiveClasses) {
    responsive.push('No responsive breakpoint classes found');
  }
  if (!hasFlexbox) {
    responsive.push('No flexbox or grid layout detected');
  }
  
  // Visual hierarchy assessment
  const hasHeadings = /<h[1-6]|<Heading|text-(?:xl|2xl|3xl|4xl)/.test(content);
  const visualHierarchy = hasHeadings 
    ? 'Headings present for hierarchy'
    : 'Limited visual hierarchy - consider adding headings';
  
  return {
    visualHierarchy,
    spacing,
    grouping,
    responsive
  };
}

// ============================================================================
// Interaction Analysis
// ============================================================================

function analyzeInteractions(content: string): InteractionAnalysis {
  const formControls: string[] = [];
  const buttonStates: string[] = [];
  const keyboardNav: string[] = [];
  const focusManagement: string[] = [];
  const modalUsage: string[] = [];
  
  // Identify form controls
  if (content.includes('input') || content.includes('Input')) {
    formControls.push('Text inputs');
  }
  if (content.includes('select') || content.includes('Select')) {
    formControls.push('Select dropdowns');
  }
  if (content.includes('checkbox') || content.includes('Checkbox')) {
    formControls.push('Checkboxes');
  }
  if (content.includes('radio') || content.includes('Radio')) {
    formControls.push('Radio buttons');
  }
  if (content.includes('textarea') || content.includes('Textarea')) {
    formControls.push('Text areas');
  }
  
  // Check button states
  const hasDisabledState = /disabled\s*=|isDisabled/.test(content);
  const hasLoadingState = /loading\s*=|isLoading/.test(content);
  
  if (!hasDisabledState) {
    buttonStates.push('No disabled button states detected');
  }
  if (!hasLoadingState) {
    buttonStates.push('No loading button states detected');
  }
  
  // Check keyboard navigation
  const hasTabIndex = /tabIndex|tabindex/.test(content);
  const hasKeyHandlers = /onKeyDown|onKeyPress|onKeyUp/.test(content);
  
  if (!hasTabIndex && !hasKeyHandlers) {
    keyboardNav.push('No explicit keyboard navigation support');
  }
  
  // Check focus management
  const hasFocusManagement = /focus\(\)|autoFocus|ref\.current\.focus/.test(content);
  
  if (!hasFocusManagement) {
    focusManagement.push('No focus management detected');
  }
  
  // Check modal usage
  const hasModal = /Modal|Dialog|Popover/.test(content);
  
  if (hasModal) {
    modalUsage.push('Modal/Dialog components used');
    
    // Check for proper modal patterns
    const hasModalClose = /onClose|closeModal/.test(content);
    if (!hasModalClose) {
      modalUsage.push('Modal may be missing close handler');
    }
  }
  
  return {
    formControls,
    buttonStates,
    keyboardNav,
    focusManagement,
    modalUsage
  };
}

// ============================================================================
// Feedback Analysis
// ============================================================================

function analyzeFeedback(content: string): FeedbackAnalysis {
  const validation: string[] = [];
  const errorMessages: string[] = [];
  const successStates: string[] = [];
  const loadingStates: string[] = [];
  const progressIndicators: string[] = [];
  
  // Check validation feedback
  const hasValidation = /validate|isValid|errors/.test(content);
  const hasInlineErrors = /error\s*=|errorMessage|helperText/.test(content);
  
  if (hasValidation) {
    validation.push('Validation logic present');
  } else {
    validation.push('No validation logic detected');
  }
  
  if (hasInlineErrors) {
    errorMessages.push('Inline error messages supported');
  } else {
    errorMessages.push('No inline error message support');
  }
  
  // Check success states
  const hasSuccessState = /success|Success|toast|notification/.test(content);
  
  if (hasSuccessState) {
    successStates.push('Success feedback mechanism present');
  } else {
    successStates.push('No success feedback detected');
  }
  
  // Check loading states
  const hasLoadingState = /loading|isLoading|Spinner|Skeleton/.test(content);
  
  if (hasLoadingState) {
    loadingStates.push('Loading states implemented');
  } else {
    loadingStates.push('No loading states detected');
  }
  
  // Check progress indicators
  const hasProgress = /Progress|Stepper|Step/.test(content);
  
  if (hasProgress) {
    progressIndicators.push('Progress indication present');
  }
  
  return {
    validation,
    errorMessages,
    successStates,
    loadingStates,
    progressIndicators
  };
}

// ============================================================================
// Accessibility Analysis
// ============================================================================

function analyzeAccessibility(content: string): AccessibilityAnalysis {
  const ariaLabels: string[] = [];
  const keyboardOnly: string[] = [];
  const screenReader: string[] = [];
  const colorContrast: string[] = [];
  
  // Check ARIA attributes
  const hasAriaLabel = /aria-label|ariaLabel/.test(content);
  const hasAriaDescribedBy = /aria-describedby|ariaDescribedBy/.test(content);
  const hasRole = /role\s*=/.test(content);
  
  if (hasAriaLabel) {
    ariaLabels.push('aria-label attributes present');
  } else {
    ariaLabels.push('Missing aria-label attributes');
  }
  
  if (!hasAriaDescribedBy) {
    ariaLabels.push('Consider adding aria-describedby for form fields');
  }
  
  // Check semantic HTML
  const hasSemanticHTML = /<(?:button|nav|main|header|footer|article|section)/.test(content);
  
  if (!hasSemanticHTML) {
    screenReader.push('Limited semantic HTML - use button, nav, main, etc.');
  }
  
  // Check for keyboard navigation
  const hasKeyboardHandlers = /onKeyDown|onKeyPress/.test(content);
  
  if (!hasKeyboardHandlers) {
    keyboardOnly.push('No keyboard event handlers - may not be keyboard accessible');
  }
  
  // Check for color-only indicators
  const hasColorClasses = /(?:text|bg)-(?:red|green|yellow|blue)-/.test(content);
  
  if (hasColorClasses) {
    colorContrast.push('Color classes used - ensure sufficient contrast and not color-only indicators');
  }
  
  return {
    ariaLabels,
    keyboardOnly,
    screenReader,
    colorContrast
  };
}

// ============================================================================
// Bilingual Support Analysis
// ============================================================================

function analyzeBilingualSupport(content: string): BilingualAnalysis {
  const rtlHandling: string[] = [];
  const translationGaps: string[] = [];
  const fontLoading: string[] = [];
  const numeralLocalization: string[] = [];
  
  // Check RTL support
  const hasRTL = /dir\s*=|direction|rtl|ltr/.test(content);
  
  if (!hasRTL) {
    rtlHandling.push('No RTL direction handling detected');
  }
  
  // Check for translation usage
  const hasTranslation = /useTranslation|t\(|i18n/.test(content);
  const hasHardcodedText = /"[A-Za-z\s]{10,}"|'[A-Za-z\s]{10,}'/.test(content);
  
  if (!hasTranslation) {
    translationGaps.push('No translation hook usage detected');
  }
  
  if (hasHardcodedText && !hasTranslation) {
    translationGaps.push('Hardcoded text found - should use translation keys');
  }
  
  // Check font loading
  const hasFontFamily = /font-family|fontFamily/.test(content);
  
  if (!hasFontFamily) {
    fontLoading.push('No custom font family specified');
  }
  
  // Check numeral handling
  const hasNumbers = /\d+/.test(content);
  
  if (hasNumbers) {
    numeralLocalization.push('Numbers present - ensure proper localization for Persian');
  }
  
  return {
    rtlHandling,
    translationGaps,
    fontLoading,
    numeralLocalization
  };
}

// ============================================================================
// Main Analyzer Function
// ============================================================================

/**
 * Analyze UI/UX aspects of a wizard step component
 */
export function analyzeUIUX(
  filePath: string,
  content: string
): UIUXAnalysis {
  return {
    layout: analyzeLayout(content),
    interactions: analyzeInteractions(content),
    feedback: analyzeFeedback(content),
    accessibility: analyzeAccessibility(content),
    bilingualSupport: analyzeBilingualSupport(content)
  };
}

/**
 * Generate UI/UX findings from analysis
 */
export function generateUIUXFindings(
  stepName: string,
  filePath: string,
  analysis: UIUXAnalysis
): AnalysisFinding[] {
  const findings: AnalysisFinding[] = [];
  let findingId = 1;
  
  // Layout findings
  if (analysis.layout.grouping.length > 0) {
    findings.push({
      id: `${stepName}-UIUX-${findingId++}`,
      stepName,
      category: FindingCategory.UIUX,
      severity: Severity.Medium,
      title: 'Improve field grouping',
      description: analysis.layout.grouping.join('; '),
      impact: 'Users may have difficulty understanding relationships between form fields.',
      filePaths: [filePath],
      suggestedFix: 'Group related fields using Card, fieldset, or section elements with clear headings.',
      codeSnippet: `<Card>\n  <CardHeader>\n    <Heading size="md">School Details</Heading>\n  </CardHeader>\n  <CardBody>\n    <FormControl>\n      <FormLabel>School Name</FormLabel>\n      <Input />\n    </FormControl>\n    {/* More related fields */}\n  </CardBody>\n</Card>`,
      estimatedEffort: Effort.Small,
      acceptanceCriteria: [
        'Related fields are visually grouped',
        'Each group has a clear heading',
        'Visual hierarchy is improved'
      ]
    });
  }
  
  // Interaction findings
  if (analysis.interactions.buttonStates.some(s => s.includes('disabled'))) {
    findings.push({
      id: `${stepName}-UIUX-${findingId++}`,
      stepName,
      category: FindingCategory.UIUX,
      severity: Severity.Medium,
      title: 'Add button disabled states',
      description: 'Buttons should be disabled during async operations or when form is invalid.',
      impact: 'Users may click buttons multiple times, causing duplicate submissions or confusion.',
      filePaths: [filePath],
      suggestedFix: 'Add disabled state to buttons based on form validity and loading state.',
      codeSnippet: `<Button\n  onClick={handleSubmit}\n  isDisabled={!isValid || isLoading}\n  isLoading={isLoading}\n>\n  {isLoading ? 'Saving...' : 'Next'}\n</Button>`,
      estimatedEffort: Effort.Small,
      acceptanceCriteria: [
        'Buttons are disabled when form is invalid',
        'Buttons show loading state during async operations',
        'Users cannot double-submit'
      ]
    });
  }
  
  // Feedback findings
  if (analysis.feedback.validation.some(v => v.includes('No validation'))) {
    findings.push({
      id: `${stepName}-UIUX-${findingId++}`,
      stepName,
      category: FindingCategory.UIUX,
      severity: Severity.High,
      title: 'Add form validation',
      description: 'No validation logic detected for form inputs.',
      impact: 'Users can submit invalid data, leading to errors later in the wizard or backend.',
      filePaths: [filePath],
      suggestedFix: 'Implement validation using Zod schema or custom validation functions. Show inline errors.',
      codeSnippet: `import { z } from 'zod';\n\nconst schema = z.object({\n  schoolName: z.string().min(1, 'School name is required'),\n  email: z.string().email('Invalid email address')\n});\n\n// In component:\nconst { errors, validate } = useValidation(schema);\n\n<FormControl isInvalid={!!errors.schoolName}>\n  <FormLabel>School Name</FormLabel>\n  <Input onBlur={() => validate('schoolName', value)} />\n  <FormErrorMessage>{errors.schoolName}</FormErrorMessage>\n</FormControl>`,
      estimatedEffort: Effort.Medium,
      acceptanceCriteria: [
        'All required fields have validation',
        'Inline error messages are shown',
        'Form cannot be submitted with invalid data'
      ]
    });
  }
  
  // Accessibility findings
  if (analysis.accessibility.ariaLabels.some(a => a.includes('Missing'))) {
    findings.push({
      id: `${stepName}-UIUX-${findingId++}`,
      stepName,
      category: FindingCategory.Accessibility,
      severity: Severity.Medium,
      title: 'Add ARIA labels for accessibility',
      description: 'Form controls and interactive elements are missing aria-label attributes.',
      impact: 'Screen reader users cannot understand the purpose of form fields and buttons.',
      filePaths: [filePath],
      suggestedFix: 'Add aria-label or aria-labelledby to all form controls and interactive elements.',
      codeSnippet: `<Input\n  aria-label="School name"\n  aria-describedby="school-name-help"\n  placeholder="Enter school name"\n/>\n<FormHelperText id="school-name-help">\n  The official name of your school\n</FormHelperText>`,
      estimatedEffort: Effort.Small,
      acceptanceCriteria: [
        'All form controls have aria-label or associated label',
        'Helper text is linked with aria-describedby',
        'Screen readers can navigate the form'
      ]
    });
  }
  
  // Bilingual findings
  if (analysis.bilingualSupport.rtlHandling.length > 0) {
    findings.push({
      id: `${stepName}-UIUX-${findingId++}`,
      stepName,
      category: FindingCategory.Bilingual,
      severity: Severity.High,
      title: 'Add RTL support for Persian',
      description: 'No RTL direction handling detected for Persian/Dari language support.',
      impact: 'Persian text will display incorrectly, making the interface unusable for Persian speakers.',
      filePaths: [filePath],
      suggestedFix: 'Add dir attribute based on current language. Ensure layout adapts to RTL.',
      codeSnippet: `const { i18n } = useTranslation();\nconst isRTL = i18n.language === 'fa';\n\n<div dir={isRTL ? 'rtl' : 'ltr'} className={isRTL ? 'font-vazir' : ''}>\n  {/* Content */}\n</div>`,
      estimatedEffort: Effort.Medium,
      acceptanceCriteria: [
        'Layout switches to RTL for Persian',
        'Text alignment is correct in both directions',
        'Icons and UI elements are mirrored appropriately'
      ]
    });
  }
  
  if (analysis.bilingualSupport.translationGaps.some(g => g.includes('Hardcoded'))) {
    findings.push({
      id: `${stepName}-UIUX-${findingId++}`,
      stepName,
      category: FindingCategory.Bilingual,
      severity: Severity.High,
      title: 'Replace hardcoded text with translations',
      description: 'Hardcoded English text found that should use translation keys.',
      impact: 'Persian users will see English text, making the interface partially unusable.',
      filePaths: [filePath],
      suggestedFix: 'Extract all user-facing text to translation files. Use t() function for all text.',
      codeSnippet: `// Instead of:\n<Button>Save and Continue</Button>\n\n// Use:\nconst { t } = useTranslation();\n<Button>{t('wizard.common.saveAndContinue')}</Button>\n\n// In en.ts:\nwizard: {\n  common: {\n    saveAndContinue: 'Save and Continue'\n  }\n}\n\n// In fa.ts:\nwizard: {\n  common: {\n    saveAndContinue: 'ذخیره و ادامه'\n  }\n}`,
      estimatedEffort: Effort.Medium,
      acceptanceCriteria: [
        'All user-facing text uses translation keys',
        'Both English and Persian translations exist',
        'No hardcoded text remains'
      ]
    });
  }
  
  return findings;
}

/**
 * Generate hand-holding suggestions
 */
export function generateHandHoldingSuggestions(
  stepName: string,
  content: string
): Array<{ suggestion: string; bilingualText: BilingualText }> {
  const suggestions: Array<{ suggestion: string; bilingualText: BilingualText }> = [];
  
  // Check for tooltips
  if (!content.includes('Tooltip') && !content.includes('tooltip')) {
    suggestions.push({
      suggestion: 'Add tooltips to explain complex fields',
      bilingualText: {
        en: 'Click the ? icon for more information',
        fa: 'برای اطلاعات بیشتر روی آیکون ? کلیک کنید',
        context: 'Tooltip trigger text'
      }
    });
  }
  
  // Check for help text
  if (!content.includes('FormHelperText') && !content.includes('helperText')) {
    suggestions.push({
      suggestion: 'Add helper text below form fields',
      bilingualText: {
        en: 'Enter the official name as it appears on documents',
        fa: 'نام رسمی را همانطور که در اسناد ظاهر می‌شود وارد کنید',
        context: 'Helper text for school name field'
      }
    });
  }
  
  // Check for placeholder examples
  if (!content.includes('placeholder')) {
    suggestions.push({
      suggestion: 'Add placeholder examples in form fields',
      bilingualText: {
        en: 'e.g., Kabul International School',
        fa: 'مثال: مکتب بین‌المللی کابل',
        context: 'Placeholder for school name'
      }
    });
  }
  
  return suggestions;
}
