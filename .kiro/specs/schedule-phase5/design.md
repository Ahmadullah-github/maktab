# Design Document: Schedule Feature - Phase 5

## Overview

This design document outlines the Export System for the Schedule Feature in the
Maktab school timetable application. Phase 5 builds on the existing data layer
(Phase 1), grid rendering (Phase 2), dashboard (Phase 3), and display
customization (Phase 4) to provide comprehensive export functionality for PDF
and Excel formats.

The design follows the existing feature module pattern and integrates with the
Phase 4 display settings system. The export system supports both single schedule
exports and batch exports that generate multi-page PDFs with analysis summaries.
All exports handle Persian/Dari text with proper RTL layout and font embedding.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Schedule Views                                   │
│  ┌─────────────────────────┐    ┌─────────────────────────┐            │
│  │  ClassScheduleView      │    │  TeacherScheduleView    │            │
│  │  [📥 Export Button]     │    │  [📥 Export Button]     │            │
│  └───────────┬─────────────┘    └───────────┬─────────────┘            │
│              │                              │                           │
│              └──────────┬───────────────────┘                           │
│                         │ opens                                         │
│              ┌──────────▼──────────┐                                    │
│              │   ExportDialog      │                                    │
│              │  ├─ FormatSelector  │                                    │
│              │  ├─ ScopeSelector   │                                    │
│              │  ├─ LanguageSelector│                                    │
│              │  ├─ SettingsToggles │                                    │
│              │  └─ ExportButton    │                                    │
│              └──────────┬──────────┘                                    │
│                         │ triggers                                      │
│              ┌──────────▼──────────┐                                    │
│              │  useExportSchedule  │ ◄── Hook with mutation             │
│              └──────────┬──────────┘                                    │
│                         │ calls API                                     │
│              ┌──────────▼──────────┐                                    │
│              │    Frontend API     │                                    │
│              │  (POST /export)     │                                    │
│              └──────────┬──────────┘                                    │
│                         │ HTTP                                          │
│  ┌─────────────────────────────────────────────────────────────────────┤
│  │                    Backend API                                       │
│  │  ┌──────────────────┼──────────────────┐                           │
│  │  │                  │                  │                            │
│  │  ▼                  ▼                  ▼                            │
│  │ ┌────────────┐  ┌──────────────┐  ┌─────────────────┐              │
│  │ │ExportRoutes│  │ExportService │  │AnalysisService  │              │
│  │ │            │  │              │  │                 │              │
│  │ └────────────┘  └──────┬───────┘  └─────────────────┘              │
│  │                        │                                            │
│  │              ┌─────────┼─────────┐                                  │
│  │              │         │         │                                  │
│  │              ▼         ▼         ▼                                  │
│  │         ┌─────────┐ ┌─────────┐ ┌──────────┐                       │
│  │         │PDFGen   │ │ExcelGen │ │FileCleanup│                      │
│  │         │Service  │ │Service  │ │Service    │                      │
│  │         └─────────┘ └─────────┘ └──────────┘                       │
│  └─────────────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Trigger**: User clicks export button in schedule view
2. **Configure**: ExportDialog opens with current settings
3. **Submit**: User configures options and clicks export
4. **Process**: Frontend calls backend API with export request
5. **Generate**: Backend generates PDF/Excel with proper formatting
6. **Download**: Backend returns download URL, frontend triggers download
7. **Cleanup**: Backend cleans up temporary files after expiration

## Components and Interfaces

### File Structure

```
packages/web/src/features/schedule/
├── components/
│   └── export/
│       ├── ExportDialog.tsx           # Main export modal
│       ├── FormatSelector.tsx         # PDF/Excel selection
│       ├── ScopeSelector.tsx          # Current/All selection
│       ├── LanguageSelector.tsx       # Persian/English selection
│       ├── SettingsToggles.tsx        # Display settings checkboxes
│       ├── ExportProgress.tsx         # Progress indicator
│       └── index.ts
├── hooks/
│   └── useExportSchedule.ts           # Export mutation hook
├── api/
│   └── export.api.ts                  # Export API functions
└── __tests__/
    ├── ExportDialog.test.ts
    ├── ExportDialog.property.test.ts
    ├── useExportSchedule.test.ts
    ├── useExportSchedule.property.test.ts
    └── export.api.property.test.ts

packages/api/src/
├── routes/
│   └── export.routes.ts               # Export endpoints
├── services/
│   ├── export.service.ts              # Main export orchestration
│   ├── pdfGeneration.service.ts       # PDF generation with RTL
│   ├── excelGeneration.service.ts     # Excel generation with RTL
│   ├── analysisGeneration.service.ts  # Analysis page generation
│   └── fileCleanup.service.ts         # Temporary file management
└── __tests__/
    ├── export.service.test.ts
    ├── export.service.property.test.ts
    ├── pdfGeneration.property.test.ts
    └── excelGeneration.property.test.ts
```

## Data Models

### Export Request Interface

```typescript
/**
 * Export format options
 */
export type ExportFormat = 'pdf' | 'excel';

/**
 * Export scope options
 */
export type ExportScope = 'current' | 'all-classes' | 'all-teachers';

/**
 * Export language options
 */
export type ExportLanguage = 'fa' | 'en';

/**
 * Export request payload
 */
export interface ExportRequest {
  scheduleId: number;
  format: ExportFormat;
  scope: ExportScope;
  targetType: 'class' | 'teacher';
  targetId?: string;
  language: ExportLanguage;
  displaySettings: DisplaySettings; // From Phase 4
  includeAnalysis?: boolean; // For batch exports
}

/**
 * Export response from backend
 */
export interface ExportResponse {
  success: boolean;
  downloadUrl: string;
  filename: string;
  expiresAt: string;
  fileSize: number;
  pageCount?: number; // For PDF exports
}

/**
 * Export progress information
 */
export interface ExportProgress {
  current: number;
  total: number;
  status: 'preparing' | 'generating' | 'finalizing' | 'complete' | 'error';
  message: string;
}

/**
 * Analysis summary data
 */
export interface AnalysisSummary {
  totalClasses: number;
  totalTeachers: number;
  totalSubjects: number;
  totalRooms: number;
  utilizationRate: number;
  conflictCount: number;
  generatedAt: string;
  schoolName?: string;
}
```

### Component Props Interfaces

```typescript
/**
 * Props for ExportDialog component
 */
export interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentScheduleId: number;
  currentType: 'class' | 'teacher';
  currentTargetId: string;
}

/**
 * Props for FormatSelector component
 */
export interface FormatSelectorProps {
  value: ExportFormat;
  onChange: (format: ExportFormat) => void;
}

/**
 * Props for ScopeSelector component
 */
export interface ScopeSelectorProps {
  value: ExportScope;
  onChange: (scope: ExportScope) => void;
  currentType: 'class' | 'teacher';
}

/**
 * Props for LanguageSelector component
 */
export interface LanguageSelectorProps {
  value: ExportLanguage;
  onChange: (language: ExportLanguage) => void;
}

/**
 * Props for SettingsToggles component
 */
export interface SettingsTogglesProps {
  displaySettings: DisplaySettings;
  onChange: (settings: Partial<DisplaySettings>) => void;
}

/**
 * Props for ExportProgress component
 */
export interface ExportProgressProps {
  progress: ExportProgress;
  onCancel: () => void;
}
```

### File Naming Convention

```typescript
/**
 * Generate filename for exported file
 */
export function generateExportFilename(
  type: 'class' | 'teacher',
  name: string,
  language: ExportLanguage,
  format: ExportFormat,
  scope: ExportScope
): string {
  const date = new Date().toISOString().split('T')[0];
  const scopePrefix = scope === 'current' ? '' : 'all-';
  return `schedule_${scopePrefix}${type}_${name}_${language}_${date}.${format}`;
}

// Examples:
// schedule_class_10A_fa_2024-12-26.pdf
// schedule_all-teachers_school_en_2024-12-26.pdf
// schedule_teacher_ahmad-hassan_fa_2024-12-26.xlsx
```

## Component Specifications

### ExportDialog Component

**File:** `components/export/ExportDialog.tsx`

**Requirements:** 1.1, 1.2, 1.3, 1.4, 1.5, 7.5, 9.4

```typescript
interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentScheduleId: number;
  currentType: 'class' | 'teacher';
  currentTargetId: string;
}
```

**Layout (RTL):**

```
┌─────────────────────────────────────────────────────┐
│  صادرات برنامه                              [✕]    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  فرمت فایل                                          │
│  ┌─────────────────────────────────────────────┐   │
│  │ ○ PDF        ○ Excel                        │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  محدوده صادرات                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │ ○ کلاس/استاد فعلی                           │   │
│  │ ○ همه کلاس‌ها                               │   │
│  │ ○ همه اساتید                                │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  زبان                                               │
│  ┌─────────────────────────────────────────────┐   │
│  │ ○ فارسی      ○ انگلیسی                      │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  تنظیمات نمایش                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │ ☑ نام استاد    ☑ نام اتاق    ☑ رنگ‌بندی   │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │              [لغو]    [صادرات]              │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### useExportSchedule Hook

**File:** `hooks/useExportSchedule.ts`

**Requirements:** 2.1, 2.2, 2.3, 2.4, 2.5, 8.1, 8.2, 8.4

```typescript
interface UseExportScheduleReturn {
  exportSchedule: (request: ExportRequest) => Promise<void>;
  isExporting: boolean;
  progress: ExportProgress | null;
  error: string | null;
  cancelExport: () => void;
}

export function useExportSchedule(): UseExportScheduleReturn {
  // Implementation uses TanStack Query mutation
  // Handles progress tracking for batch exports
  // Triggers browser download on completion
}
```

**Implementation Notes:**

- Uses TanStack Query `useMutation` for API calls
- Implements progress polling for batch exports
- Handles automatic download trigger
- Provides cancellation support

### Backend Export Service

**File:** `packages/api/src/services/export.service.ts`

**Requirements:** 3.1, 3.2, 3.3, 3.4, 3.5, 8.3, 8.5

```typescript
interface ExportServiceInterface {
  exportSchedule(request: ExportRequest): Promise<ExportResponse>;
  generateAnalysisSummary(schedules: Schedule[]): Promise<AnalysisSummary>;
  cleanupExpiredFiles(): Promise<void>;
}

export class ExportService implements ExportServiceInterface {
  constructor(
    private pdfService: PDFGenerationService,
    private excelService: ExcelGenerationService,
    private analysisService: AnalysisGenerationService,
    private fileCleanupService: FileCleanupService
  ) {}

  async exportSchedule(request: ExportRequest): Promise<ExportResponse> {
    // Validate request (max 50 schedules for batch)
    // Generate analysis page for batch exports
    // Call appropriate generation service
    // Create temporary download URL
    // Schedule cleanup
  }
}
```

### PDF Generation Service

**File:** `packages/api/src/services/pdfGeneration.service.ts`

**Requirements:** 5.1, 5.2, 5.3, 5.4, 7.4

```typescript
interface PDFGenerationOptions {
  schedules: Schedule[];
  language: ExportLanguage;
  displaySettings: DisplaySettings;
  includeAnalysis: boolean;
  analysisSummary?: AnalysisSummary;
}

export class PDFGenerationService {
  async generatePDF(options: PDFGenerationOptions): Promise<Buffer> {
    // Use puppeteer or pdfkit for generation
    // Embed Vazirmatn font for Persian text
    // Apply RTL layout for Persian content
    // Generate analysis page if requested
    // Apply color coding from display settings
    // Create multi-page PDF for batch exports
  }
}
```

**PDF Structure for Batch Export:**

```
Page 1: Analysis Summary
├── School Statistics
├── Utilization Metrics
├── Conflict Summary
└── Generation Info

Page 2-N: Individual Schedules
├── Schedule Title (Class/Teacher Name)
├── Schedule Grid with Applied Settings
└── Footer with Page Number
```

### Excel Generation Service

**File:** `packages/api/src/services/excelGeneration.service.ts`

**Requirements:** 6.1, 6.2, 6.3, 6.5

```typescript
interface ExcelGenerationOptions {
  schedules: Schedule[];
  language: ExportLanguage;
  displaySettings: DisplaySettings;
}

export class ExcelGenerationService {
  async generateExcel(options: ExcelGenerationOptions): Promise<Buffer> {
    // Use exceljs library
    // Set RTL direction: worksheet.views[0].rightToLeft = true
    // Create styled headers
    // One worksheet per schedule
    // Preserve grid structure and data
  }
}
```

**Excel Structure:**

```
Worksheet 1: Class 10A Schedule
├── Styled Headers (Day/Period columns)
├── RTL Direction
├── Schedule Data Grid
└── Applied Display Settings

Worksheet 2: Class 10B Schedule
├── ... (same structure)
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all
valid executions of a system-essentially, a formal statement about what the
system should do. Properties serve as the bridge between human-readable
specifications and machine-verifiable correctness guarantees._

### Property 1: Paper Size Consistency

_For any_ PDF export request, the generated PDF SHALL always use A4 paper size
regardless of other parameters.

**Validates: Requirements 1.4**

### Property 2: Display Settings Integration

_For any_ export request with displaySettings where showTeacherName is false,
the exported content SHALL NOT contain any teacher name strings in schedule
cells.

**Validates: Requirements 7.2**

### Property 3: Filename Convention Compliance

_For any_ valid export parameters (type, name, language, format, scope), the
generated filename SHALL match the pattern:
schedule*{scope-prefix}{type}*{name}_{language}_{date}.{format}

**Validates: Requirements 2.5, 8.4**

### Property 4: Batch Export Page Structure

_For any_ batch export with N schedules, the generated PDF SHALL contain exactly
N+1 pages (one analysis page plus one page per schedule).

**Validates: Requirements 3.4**

### Property 5: RTL Layout Application

_For any_ PDF export with Persian language selected, all text content SHALL be
rendered with RTL layout direction.

**Validates: Requirements 5.2**

### Property 6: Excel RTL Configuration

_For any_ Excel export, the generated file SHALL have
worksheet.views[0].rightToLeft set to true.

**Validates: Requirements 6.1**

### Property 7: Export Scope Limitation

_For any_ batch export request, if the number of target schedules exceeds 50,
the export system SHALL reject the request with an appropriate error.

**Validates: Requirements 3.5**

### Property 8: Progress Text Format

_For any_ export progress with current=X and total=Y values, the displayed
status text SHALL match the format "Exporting X of Y...".

**Validates: Requirements 4.2**

### Property 9: URL Expiration

_For any_ generated download URL, the URL SHALL become invalid exactly 1 hour
after creation.

**Validates: Requirements 8.3**

### Property 10: Analysis Summary Content

_For any_ analysis summary page, the content SHALL include totalClasses,
totalTeachers, and utilizationRate statistics.

**Validates: Requirements 3.3**

### Property 11: Font Embedding Verification

_For any_ PDF export containing Persian text, the generated PDF SHALL have the
Vazirmatn font embedded in the file metadata.

**Validates: Requirements 5.1**

### Property 12: Color Coding Preservation

_For any_ export request with colorBy setting enabled, the PDF export SHALL
apply the same color scheme to schedule cells as displayed in the UI.

**Validates: Requirements 7.4**

## Error Handling

### Export Generation Errors

| Error Condition          | Handling                               |
| ------------------------ | -------------------------------------- |
| PDF generation failure   | Return specific PDF error message      |
| Excel generation failure | Return specific Excel error message    |
| Font embedding failure   | Fall back to system fonts, log warning |
| Memory limit exceeded    | Return resource limit error            |
| Invalid schedule data    | Return validation error with details   |

### File Management Errors

| Error Condition              | Handling                               |
| ---------------------------- | -------------------------------------- |
| Disk space insufficient      | Return storage error message           |
| File write permission denied | Return permission error                |
| Temporary directory missing  | Create directory or return setup error |
| Cleanup service failure      | Log error, continue operation          |

### Network and Download Errors

| Error Condition                 | Handling                                   |
| ------------------------------- | ------------------------------------------ |
| Download URL generation fail    | Return URL generation error                |
| Network timeout                 | Return timeout error with retry suggestion |
| Browser download blocked        | Provide manual download link               |
| File corruption during transfer | Provide file integrity error               |

## Testing Strategy

### Dual Testing Approach

This feature uses both unit tests and property-based tests:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property-based tests**: Verify universal properties that hold across all
  valid inputs

### Property-Based Testing Framework

- **Library**: fast-check (JavaScript/TypeScript), Hypothesis (Python if needed)
- **Minimum iterations**: 100 per property test
- **Test file location**: `features/schedule/__tests__/*.property.test.ts`
- **Tag format**:
  `**Feature: schedule-phase5, Property {number}: {property_text}**`

### Test Categories

#### Unit Tests

1. **ExportDialog**
   - Renders all format options (PDF, Excel)
   - Renders all scope options based on current type
   - Displays current display settings in checkboxes
   - Handles form submission correctly

2. **useExportSchedule**
   - Calls correct API endpoint with request data
   - Handles progress updates for batch exports
   - Triggers download on completion
   - Provides cancellation functionality

3. **Export Services (Backend)**
   - PDF generation with RTL layout
   - Excel generation with RTL configuration
   - Analysis summary generation
   - File cleanup after expiration

#### Property-Based Tests

Each property test MUST:

1. Be tagged with format:
   `**Feature: schedule-phase5, Property {number}: {property_text}**`
2. Reference the requirements it validates
3. Run minimum 100 iterations
4. Use smart generators for export parameters

### Test Generators

```typescript
// Generator for ExportFormat
const exportFormatArb = fc.constantFrom('pdf', 'excel');

// Generator for ExportScope
const exportScopeArb = fc.constantFrom(
  'current',
  'all-classes',
  'all-teachers'
);

// Generator for ExportLanguage
const exportLanguageArb = fc.constantFrom('fa', 'en');

// Generator for valid ExportRequest
const exportRequestArb = fc.record({
  scheduleId: fc.integer({ min: 1, max: 1000 }),
  format: exportFormatArb,
  scope: exportScopeArb,
  targetType: fc.constantFrom('class', 'teacher'),
  targetId: fc.string({ minLength: 1, maxLength: 20 }),
  language: exportLanguageArb,
  displaySettings: displaySettingsArb, // From Phase 4
});

// Generator for schedule collections (for batch testing)
const scheduleCollectionArb = fc.array(
  fc.record({
    id: fc.integer({ min: 1, max: 100 }),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    type: fc.constantFrom('class', 'teacher'),
  }),
  { minLength: 1, maxLength: 60 } // Test beyond 50 limit
);
```

## i18n Keys

Add to `locales/fa/translation.json`:

```json
{
  "schedule": {
    "export": {
      "title": "صادرات برنامه",
      "format": "فرمت فایل",
      "formatPdf": "PDF",
      "formatExcel": "Excel",
      "scope": "محدوده صادرات",
      "scopeCurrent": "کلاس/استاد فعلی",
      "scopeAllClasses": "همه کلاس‌ها",
      "scopeAllTeachers": "همه اساتید",
      "language": "زبان",
      "languagePersian": "فارسی",
      "languageEnglish": "انگلیسی",
      "displaySettings": "تنظیمات نمایش",
      "includeTeacherNames": "نام اساتید",
      "includeRoomNames": "نام اتاق‌ها",
      "includeColorCoding": "رنگ‌بندی",
      "exportButton": "صادرات",
      "cancel": "لغو",
      "progress": {
        "preparing": "آماده‌سازی...",
        "generating": "در حال تولید {{current}} از {{total}}...",
        "finalizing": "نهایی‌سازی...",
        "complete": "تکمیل شد",
        "error": "خطا در صادرات"
      },
      "errors": {
        "pdfGeneration": "خطا در تولید فایل PDF",
        "excelGeneration": "خطا در تولید فایل Excel",
        "networkError": "خطا در شبکه. دوباره تلاش کنید.",
        "timeout": "زمان صادرات به پایان رسید. لطفاً دوباره تلاش کنید.",
        "tooManySchedules": "حداکثر ۵۰ برنامه قابل صادرات است"
      },
      "success": {
        "downloadStarted": "دانلود فایل آغاز شد",
        "batchComplete": "صادرات دسته‌ای با موفقیت تکمیل شد"
      }
    }
  }
}
```

## Implementation Notes

### Backend Dependencies

```json
{
  "puppeteer": "^21.0.0",
  "exceljs": "^4.4.0",
  "multer": "^1.4.5-lts.1",
  "archiver": "^6.0.0"
}
```

### Font Integration

The Vazirmatn font should be:

1. Stored in `packages/api/assets/fonts/`
2. Embedded in PDF generation
3. Referenced in CSS for HTML-to-PDF conversion

### Temporary File Management

```typescript
// File cleanup configuration
const CLEANUP_CONFIG = {
  downloadUrlExpiry: 60 * 60 * 1000, // 1 hour
  cleanupInterval: 15 * 60 * 1000, // 15 minutes
  maxFileAge: 2 * 60 * 60 * 1000, // 2 hours
};
```

### Progress Tracking for Batch Exports

```typescript
// Progress tracking implementation
interface BatchProgress {
  jobId: string;
  current: number;
  total: number;
  status: 'preparing' | 'generating' | 'finalizing' | 'complete' | 'error';
}

// Store progress in memory or Redis for scalability
const progressStore = new Map<string, BatchProgress>();
```

### API Endpoints

```typescript
// Export routes
POST /api/timetables/:id/export
GET  /api/export/progress/:jobId
GET  /api/export/download/:token
DELETE /api/export/cancel/:jobId
```
