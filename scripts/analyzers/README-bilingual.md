# Bilingual Support Analyzer

## Overview

The Bilingual Support Analyzer verifies that wizard step components properly support both English and Persian/Dari languages with correct RTL handling, complete translations, Persian font loading, and numeral localization.

## Features

### 1. RTL Direction Handling
- Detects if component uses `isRTL` context
- Checks for proper `dir` attribute usage
- Identifies hardcoded text alignment (text-left, text-right)
- Flags hardcoded directional spacing (ml-, mr-, pl-, pr-)
- Recommends logical properties (ms-, me-, ps-, pe-)

### 2. Translation Completeness
- Extracts all translation keys used in component (t.key.path pattern)
- Verifies keys exist in both English and Persian translation files
- Detects empty or placeholder translations
- Identifies hardcoded English text that should use translation keys

### 3. Persian Font Loading
- Checks for Vazir font references
- Validates font-family declarations have fallbacks
- Ensures Persian text renders with appropriate fonts

### 4. Numeral Localization
- Detects hardcoded numbers that may need localization
- Checks for number formatting (Intl.NumberFormat)
- Validates date formatting for locale support
- Recommends Arabic-Indic numerals for Persian

## Usage

```typescript
import { 
  analyzeBilingualSupport, 
  generateBilingualFindings,
  extractBilingualPairs 
} from './analyzers/bilingual-analyzer';

// Load translation files
const enTranslations = require('../packages/web/src/i18n/en.ts');
const faTranslations = require('../packages/web/src/i18n/fa.ts');

// Read component file
const filePath = 'packages/web/src/components/wizard/steps/school-info-step.tsx';
const content = fs.readFileSync(filePath, 'utf-8');

// Analyze bilingual support
const analysis = analyzeBilingualSupport(
  filePath,
  content,
  enTranslations,
  faTranslations
);

// Generate findings with severity levels
const findings = generateBilingualFindings(
  'school-info',
  filePath,
  analysis,
  enTranslations,
  faTranslations
);

// Extract bilingual text pairs for documentation
const pairs = extractBilingualPairs(
  content,
  enTranslations,
  faTranslations
);
```

## Analysis Output

### BilingualAnalysis Object
```typescript
{
  rtlHandling: string[];          // RTL issues found
  translationGaps: string[];      // Missing/incomplete translations
  fontLoading: string[];          // Font loading issues
  numeralLocalization: string[];  // Number formatting issues
}
```

### AnalysisFinding Objects
Each finding includes:
- **id**: Unique identifier (e.g., "school-info-BILINGUAL-001")
- **category**: FindingCategory.Bilingual
- **severity**: Critical, High, Medium, or Low
- **title**: Short description
- **description**: Detailed explanation
- **impact**: Effect on users/system
- **filePaths**: Affected files
- **suggestedFix**: Recommended solution
- **codeSnippet**: Copy-paste code fix
- **estimatedEffort**: Small, Medium, or Large
- **acceptanceCriteria**: How to verify the fix

## Severity Levels

### High Severity
- No RTL direction handling
- Hardcoded text alignment
- Missing translations in either language
- Empty or placeholder translations

### Medium Severity
- Hardcoded directional spacing (many instances)
- Hardcoded English text not using translations
- Persian font loading issues

### Low Severity
- Missing numeral localization
- Date formatting without locale support

## Code Snippet Examples

### RTL Support
```typescript
// Add RTL support:
const { isRTL } = useLanguageCtx();

return (
  <div dir={isRTL ? "rtl" : "ltr"} className="space-y-4">
    {/* Use logical properties */}
    <div className="ms-4 me-2"> {/* instead of ml-4 mr-2 */}
      {/* Content */}
    </div>
  </div>
);
```

### Translation Keys
```typescript
// Before:
<button>Save Changes</button>

// After:
// 1. Add to i18n files:
// en.ts: { button: { save: 'Save Changes' } }
// fa.ts: { button: { save: 'ذخیره تغییرات' } }

// 2. Use in component:
const { t } = useLanguageCtx();
<button>{t.button.save}</button>
```

### Numeral Localization
```typescript
// Format numbers for locale:
const { language } = useLanguageCtx();

const formatNumber = (num: number) => {
  return new Intl.NumberFormat(
    language === 'fa' ? 'fa-AF' : 'en-US'
  ).format(num);
};

// Usage:
<span>{formatNumber(1234)}</span> // Shows ۱۲۳۴ in Persian
```

## Requirements Coverage

This analyzer satisfies the following requirements from the specification:

- **4.1**: Identifies missing or incorrect translation strings
- **4.2**: Verifies RTL direction handling for Persian text
- **4.3**: Provides both English and Persian translations
- **4.4**: Marks ambiguous translations
- **4.5**: Validates Persian font loading

## Testing

Run the verification script to test the analyzer:

```bash
node scripts/verify-bilingual-analyzer.js
```

Test on a real component:

```bash
node scripts/test-bilingual-on-real-component.js
```

## Integration

The bilingual analyzer is integrated into the per-step analysis framework and will be called for each wizard step during the comprehensive analysis. Results are included in:

1. Individual step audit documents (`{step}-audit.md`)
2. Overall wizard overview (`wizard-overview.md`)
3. Prioritized task backlog (`wizard-backlog.json`)

## Future Enhancements

- AST-based parsing for more accurate analysis
- Support for additional languages
- Automated translation suggestions
- Visual diff for RTL layout comparison
- Integration with translation management tools
