# Afghan School Timetable Generator - Project Summary

## Overview

**Project Name**: Afghan School Timetable Generator  
**Version**: 1.0.0  
**Purpose**: Desktop application for Afghan school principals/head teachers to automatically generate timetables based on Ministry of Education curriculum requirements.

**Target Users**: School head teachers, principals, and administrators in Afghanistan.

---

## Project Architecture

### Technology Stack

#### Frontend
- **Framework**: React 18.3 with TypeScript
- **Build Tool**: Vite
- **State Management**: Zustand (5 stores: wizard, teacher, subject, room, class)
- **UI Library**: Radix UI components + Tailwind CSS
- **Routing**: React Router DOM
- **Form Validation**: React Hook Form + Zod
- **Internationalization**: Dual language support (English/Persian)
- **Desktop Wrapper**: Electron 31.0

#### Backend
- **Runtime**: Node.js with TypeScript
- **Framework**: Express 5.1
- **Database**: SQLite with TypeORM 0.3.27
- **ORM**: TypeORM with better-sqlite3 driver
- **API**: RESTful endpoints on port 4000

#### Solver Engine
- **Language**: Python 3
- **Solver**: Google OR-Tools (CP-SAT)
- **Validation**: Pydantic models
- **Features**: Gap prevention, constraint optimization

### Project Structure

```
timetable-desktop-app/
├── packages/
│   ├── web/          # React frontend application
│   │   ├── src/
│   │   │   ├── components/    # React components
│   │   │   │   ├── wizard/    # 8-step wizard components
│   │   │   │   ├── layout/    # App layout components
│   │   │   │   ├── common/    # Reusable components
│   │   │   │   └── ui/        # Radix UI components
│   │   │   ├── pages/         # Route pages
│   │   │   ├── stores/        # Zustand state stores
│   │   │   ├── hooks/         # Custom React hooks
│   │   │   ├── lib/           # Utilities and helpers
│   │   │   ├── data/          # Static data (Afghan curriculum)
│   │   │   └── types/         # TypeScript types
│   │   └── package.json
│   │
│   ├── api/          # Node.js backend API
│   │   ├── src/
│   │   │   ├── entity/        # TypeORM entities
│   │   │   ├── database/      # Database service layer
│   │   │   └── server.ts      # Express server
│   │   ├── timetable.db       # SQLite database
│   │   └── package.json
│   │
│   └── solver/       # Python solver
│       ├── solver_enhanced.py  # Main solver logic
│       ├── requirements.txt     # Python dependencies
│       └── package.json
│
├── electron/         # Electron desktop wrapper
│   └── main.js       # Electron main process
│
├── package.json      # Root workspace config
└── README.md
```

---

## Core Features

### 1. School Configuration Wizard (8 Steps)

#### Step 1: School Info
- Configure school sections:
  - Primary (Grades 1-6)
  - Middle (Grades 7-9)
  - High School (Grades 10-12)
- Set days per week (5/6/7)
- Configure periods per day (1-12)
- Set break periods
- School name and basic info

#### Step 2: Periods
- Set school start time
- Configure period duration
- View timeline preview (read-only, uses School Info settings)
- **Note**: Periods per day and breaks controlled in Step 1

#### Step 3: Rooms
- Add/Edit/Delete rooms
- Room types: Regular, Lab, Computer Lab, etc.
- Batch save pattern
- Duplicate prevention (app-level upsert)

#### Step 4: Classes
- Manual class creation or Quick Setup
- Quick Setup: Auto-generate classes by grade/section
  - Example: Grades 7-9, 3 sections each → 9 classes (7A, 7B, 7C, 8A, 8B, 8C, 9A, 9B, 9C)
- Auto-assign subjects based on grade from class name
- Validation: Must have 42 periods assigned per class
- Class name extraction: Supports "Grade7-A", "7A", "صنف هفتم الف" formats

#### Step 5: Subjects
- **Grade-based curriculum system**:
  - Each grade (7-12) has separate subjects
  - Subjects are grade-specific (Math Grade 7 ≠ Math Grade 8)
  - Periods per week fixed per subject (Ministry requirements)
- **Official Afghan Curriculum**:
  - One-click "Load Official Curriculum" per grade
  - Pre-configured with Ministry-mandated subjects and periods
  - Grades 7-12 have exactly 42 periods total
  - Grade-specific subjects (e.g., Quran only in 7-9, Geology only in Grade 10)
- **Validation**:
  - Real-time period validation: Shows "42/42 ✅" or "38/42 ❌"
  - Prevents saving invalid configurations
- **Edit/Delete**: Full CRUD operations with modal dialogs

#### Step 6: Teachers
- **Comprehensive Teacher Management**:
  - Basic info: Name, max periods/week, max periods/day, max consecutive
  - Subject expertise: Multi-select filtered by enabled sections
  - Class assignments: **Per-subject class assignment** (NEW!)
    - Example: Math teacher assigned to specific classes (7-A, 7-B) for Math Grade 7
  - Daily availability: Day × Period grid matrix
  - Availability respects break periods (shown but disabled)
- **Modal-based editing**: Clean UX, no inline editing
- Duplicate prevention (app-level upsert)

#### Step 7: Constraints
- Constraint weights (sliders):
  - Gap minimization (hard constraint)
  - Teacher availability preference
  - Room preference
  - Subject difficulty
  - Consecutive periods preference
- Preferences persist to backend

#### Step 8: Review & Generate
- Comprehensive validation:
  - Validates only enabled grades/sections
  - Shows filtered summary by section
  - Section grouping display
- **Timetable Generation**:
  - Collects all data from stores
  - Auto-assigns subjects to classes if empty
  - Sends to Python solver via API
  - Progress bar during generation (animated 0-100%)
  - Stores result in database and localStorage
  - Navigates to timetable view on success

### 2. Entity Management Pages

#### Teachers Page (`/teachers`)
- Full CRUD operations
- Subject assignment
- Availability editing
- Bulk import support

#### Subjects Page (`/subjects`)
- View all subjects by grade
- Edit/delete subjects
- Load curriculum per grade

#### Rooms Page (`/rooms`)
- Add/edit/delete rooms
- Room type management

#### Classes Page (`/classes`)
- Class management
- Subject requirement editing
- Validation indicators (42/42 periods)

### 3. Timetable Views

#### Main Timetable (`/timetable`)
- Grid view: Day × Period matrix
- Shows class schedules
- Color-coded by subject
- Print-friendly view

#### Class Schedule (`/timetable/classes`)
- Individual class timetable
- Filter by class

#### Teacher Schedule (`/timetable/teachers`)
- Individual teacher timetable
- Filter by teacher

### 4. Settings Page
- School configuration management
- Data reset options
- Export/Import features

---

## Afghan School System Requirements

### School Sections
1. **Nursery** (before age 6-7) - *Not yet implemented*
2. **Primary** (Grades 1-6) - *Curriculum data added, wizard support ready*
3. **Middle** (Grades 7-9) - *Fully implemented*
4. **High School** (Grades 10-12) - *Fully implemented*

### Curriculum Structure
- **Grade-specific subjects**: Each grade has its own subject list
- **Fixed periods**: Ministry mandates exact periods per subject
- **42 periods per week**: Standard for grades 7-12
- **Section-aware filtering**: All wizard steps filter by enabled sections

### Class Structure
- Same-grade students split into multiple classes (e.g., Grade 4-A, 4-B, 4-C)
- All classes of same grade have identical subject requirements
- Subject periods may differ by grade (e.g., Math Grade 4 = 3 periods, Math Grade 7 = 5 periods)

---

## Key Technical Features

### Data Integrity
- **Duplicate Prevention**: 
  - App-level upsert logic for Teachers, Rooms, Classes
  - Backend checks before creating/updating
- **Auto-save**: Wizard steps persist data before navigation
- **State Management**: 5 Zustand stores with backend sync

### Grade-Based Subject System
- Database schema: `Subject` entity has `grade` and `periodsPerWeek` fields
- Curriculum data: `afghanistanCurriculum.ts` contains official curriculum for all grades
- Auto-assignment: Classes automatically get subjects based on grade name
- Validation: Real-time period validation per grade

### Solver Integration
- **Python Process**: Solver runs as separate process via Node.js
- **Data Format**: TypeScript Zod schemas → Python Pydantic models
- **Constraints**: 
  - Hard: Gap prevention (no free periods)
  - Soft: Teacher availability, room preferences, subject difficulty
- **Progress Feedback**: Animated progress bar (simulated + real completion)

### Multi-language Support
- Persian (دری) and English
- UI text translations in `translations.ts`
- RTL support for Persian text

---

## Database Schema

### Core Entities (TypeORM)

#### Teacher
- `id`, `fullName`, `maxPeriodsPerWeek`, `maxPeriodsPerDay`, `maxConsecutive`
- `primarySubjectIds` (JSON): Expert subjects
- `allowedSubjectIds` (JSON): Additional allowed subjects
- `availability` (JSON): Day × Period availability matrix
- `classAssignments` (JSON): `[{subjectId, classIds[]}]` - **NEW! Per-subject class assignments**

#### Subject
- `id`, `name`, `code`
- `grade` (integer): **Grade-specific subjects**
- `periodsPerWeek` (integer): **Ministry-mandated periods**
- `roomType`, `isDifficult`
- **Unique constraint**: Composite (grade + name)

#### Room
- `id`, `name`, `capacity`, `roomType`
- **Unique constraint**: `name`

#### ClassGroup
- `id`, `name`, `studentCount`, `grade` (optional)
- `subjectRequirements` (JSON): `{subjectId: {periodsPerWeek, minConsecutive, ...}}`
- `meta` (JSON): Additional metadata
- **Unique constraint**: `name`

#### Timetable
- `id`, `name`, `description`
- `data` (JSON): Generated timetable solution
- `createdAt`, `updatedAt`

#### SchoolConfig
- `id`, `schoolName`, `enablePrimary`, `enableMiddle`, `enableHigh`
- `daysOfWeek` (JSON), `periodsPerDay`, `breakPeriods` (JSON)
- `schoolStartTime`, `periodDuration`
- `preferences` (JSON): Constraint weights

#### WizardStep
- `id`, `schoolId`, `stepKey`, `data` (JSON)
- Tracks wizard progress and step-specific data

---

## API Endpoints

### School Configuration
- `GET /api/config/school` - Get school configuration
- `PUT /api/config/school` - Save school configuration

### Entities (CRUD)
- `GET /api/teachers` - Get all teachers
- `POST /api/teachers` - Create/update teacher (upsert)
- `PUT /api/teachers/:id` - Update teacher
- `DELETE /api/teachers/:id` - Delete teacher
- `POST /api/teachers/bulk-import` - Bulk import teachers

*(Similar endpoints for subjects, rooms, classes)*

### Timetable
- `POST /api/timetables/generate` - Generate timetable (calls Python solver)
- `GET /api/timetables` - Get all generated timetables
- `GET /api/timetables/:id` - Get specific timetable

### Wizard Steps
- `GET /api/wizard-steps/:schoolId` - Get wizard step data
- `POST /api/wizard-steps` - Save wizard step data

### System
- `GET /api/health` - Health check
- `POST /api/reset` - Reset all data (with confirmation)

---

## Development Workflow

### Prerequisites
- Node.js 18+ and npm
- Python 3.8+ with pip
- Git

### Setup
```bash
# Clone repository
git clone <repository-url>
cd timetable-desktop-app

# Install dependencies
npm install

# Install Python solver dependencies
npm run install:deps
# or manually:
cd packages/solver
pip install -r requirements.txt
```

### Development
```bash
# Start all services (web + api + electron)
npm run dev

# Or individually:
npm run dev:web    # Frontend on http://localhost:5173
npm run dev:api    # Backend on http://localhost:4000
npm run dev:electron  # Electron desktop app
```

### Building
```bash
# Build all packages
npm run build

# Build individual packages
npm run build:web
npm run build:api
npm run build:solver
```

### Desktop Distribution
```bash
# Package for distribution (creates installer)
npm run dist

# Package without installer (just folder)
npm run pack
```

---

## Key Design Decisions

### 1. Grade-Based Subject System
**Why**: Afghan Ministry curriculum has grade-specific subjects with fixed periods. Math Grade 7 has 5 periods/week, Math Grade 8 has 5 periods/week, but they are different subjects.

**Implementation**: 
- Subjects table includes `grade` field
- Curriculum data organized by grade
- UI shows grade tabs (7, 8, 9, 10, 11, 12)
- Auto-assignment extracts grade from class name

### 2. Section-Aware Filtering
**Why**: Schools may only have Primary+Middle or Middle+High. UI should adapt.

**Implementation**:
- School Info step controls which sections are enabled
- Subjects step shows only grades for enabled sections
- Teachers step filters subjects by enabled sections
- All wizard steps respect section configuration

### 3. Auto-Assignment Logic
**Why**: Reduces manual work. When user creates "Grade 7-A", it should automatically get Grade 7 subjects.

**Implementation**:
- `extractGradeFromClassName()` function handles multiple formats
- `autoAssignSubjectsToClass()` matches class grade to subjects grade
- Validates that total periods = 42

### 4. Per-Subject Class Assignment
**Why**: A Math teacher may teach Math to Grade 7-A and 7-B, but not 7-C. Need granular control.

**Implementation**:
- Teacher entity has `classAssignments` JSON field
- Format: `[{subjectId: "math7", classIds: ["7a-id", "7b-id"]}]`
- UI shows class selection per expert subject
- Solver uses this for constraint generation

### 5. Wizard Auto-Save
**Why**: Users should not lose data on browser refresh.

**Implementation**:
- Each wizard step saves data before navigation
- School Info, Periods, Constraints persist to backend
- Teachers, Subjects, Rooms, Classes saved via "Save All" buttons
- Progress tracked in WizardStep table

### 6. Duplicate Prevention
**Why**: Users accidentally create duplicate teachers/rooms/classes.

**Implementation**:
- Backend upsert logic: Check by name before creating
- Database unique constraints (where applicable)
- App-level checks prevent UI duplicates
- Logs duplicate attempts for debugging

---

## Current Status & Known Issues

### ✅ Fully Implemented
- 8-step wizard flow
- Grade-based subject system
- Official Afghan curriculum data (Grades 7-12)
- Per-subject class assignment for teachers
- Auto-assignment of subjects to classes
- Duplicate prevention (app-level)
- Wizard auto-save
- Timetable generation with progress feedback
- Timetable display views
- Multi-language support (English/Persian)

### 🚧 Partially Implemented
- **Primary Grades (1-6)**: Curriculum data added, but wizard may need additional testing
- **Nursery Section**: Not yet implemented
- **Export Features**: PDF export exists but may need enhancement

### ⚠️ Known Limitations
- **Desktop Only**: No mobile responsiveness (intentional)
- **Single School**: One database instance per installation (no multi-school support)
- **Solver Timeout**: Large schools (18+ classes) may timeout. Timeout is configurable in solver.
- **No Conflict Detection**: Multi-tab editing not prevented (same database, different browser tabs)

### 🔄 Future Enhancements (Not Implemented)
- Sample data / quick start feature
- Manual timetable adjustments after generation
- Teacher schedule view improvements
- Conflict detection for multi-tab editing
- Progress cleanup/reset wizard option
- Enhanced PDF export with styling
- Data import from Excel/CSV

---

## Testing Recommendations

### Critical Path Tests
1. **Complete Wizard Flow**:
   - Configure school: Middle + High sections
   - Set periods: 8/day, 6 days, 1 break = 42 periods
   - Load subjects for Grade 7, 8, 9, 10
   - Create classes: Quick Setup for Grades 7-9, 3 sections each
   - Add teachers with class assignments
   - Generate timetable
   - Verify timetable displays correctly

2. **Grade-Specific Subjects**:
   - Load Grade 7 curriculum → Verify Quran appears
   - Load Grade 10 curriculum → Verify Geology appears, Quran does NOT
   - Verify each grade has exactly 42 periods

3. **Auto-Assignment**:
   - Create class "Grade7-A" → Verify Grade 7 subjects auto-assigned
   - Verify "42/42 ✅" validation passes

4. **Duplicate Prevention**:
   - Add teacher "John Doe"
   - Try to add "John Doe" again → Should update, not duplicate
   - Check database: Only one teacher exists

5. **Data Persistence**:
   - Fill wizard steps
   - Refresh browser
   - Navigate back to wizard → All data should persist

### Edge Cases
- Empty form submissions
- Network errors during save
- Rapid clicks on "Next" button
- Invalid period configurations (not 42 total)
- Missing teachers for subjects
- Solver timeout scenarios

---

## Deployment

### Desktop Distribution
1. Build all packages: `npm run build`
2. Package with Electron: `npm run dist`
3. Installer created in `dist-electron/`
4. Distribute to schools (Windows installer, Mac DMG, Linux AppImage)

### Web Deployment (Alternative)
1. Build frontend: `npm run build:web`
2. Deploy backend API to server
3. Serve frontend static files
4. Configure CORS for API access

### Database
- SQLite database at `packages/api/timetable.db`
- No migration scripts needed (TypeORM handles schema)
- Backup database file for data preservation
- Reset available via API endpoint (`POST /api/reset`)

---




## Quick Reference for Developers

### Key Files
- **Wizard Main**: `packages/web/src/pages/Wizard.tsx`
- **Subjects Step**: `packages/web/src/components/wizard/steps/subjects-step.tsx`
- **Teachers Step**: `packages/web/src/components/wizard/steps/teachers-step.tsx`
- **Curriculum Data**: `packages/web/src/data/afghanistanCurriculum.ts`
- **Auto-Assignment**: `packages/web/src/lib/classSubjectAssignment.ts`
- **Backend Service**: `packages/api/src/database/databaseService.ts`
- **Solver Entry**: `packages/api/pyhonSolverNodeFunction.ts`

### Important Functions
- `autoAssignSubjectsToClass(className, subjects)` - Auto-assign subjects to class
- `extractGradeFromClassName(className)` - Extract grade number from class name
- `collectTimetableData()` - Collects all wizard data for solver
- `saveTeacher()` - Upsert teacher with duplicate check
- `saveSubject()` - Upsert subject with duplicate check

### State Stores
- `useWizardStore` - School info, periods, constraints, wizard progress
- `useTeacherStore` - Teachers list
- `useSubjectStore` - Subjects list
- `useRoomStore` - Rooms list
- `useClassStore` - Classes list

---

## Contact & Support

For questions or issues:
1. Review this PROJECT_SUMMARY.md for architecture overview
2. Check PLAN_TO_V1.md for development roadmap
3. Review code comments in key files
4. Check database with db-manager.js script

---

**Last Updated**: 2025  
**Project Status**: Active Development  
**Version**: 1.0.0

