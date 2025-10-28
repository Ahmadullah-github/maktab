# Maktab Timetable Generator - Project Summary

## Project Overview
**Maktab Timetable Generator** is an automated school timetable scheduling system built with modern web technologies. The application supports bilingual operation (English/Dari) with full RTL support for Persian (Afghan) language.

## Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite** as build tool
- **Tailwind CSS** for styling
- **Zustand** for state management
- **Radix UI** for accessible components
- **React Router DOM** for routing
- **Zod** for schema validation
- **Sonner** for toast notifications

### Backend
- **Express.js** with TypeScript
- **TypeORM** for ORM
- **SQLite** database
- **Python Solver** for timetable generation (OR-Tools)

### Key Features
- Multi-step wizard interface
- Bilingual support (English/Dari - RTL)
- Real-time form validation
- Auto-save functionality
- Optimistic UI updates
- Responsive design

## Project Structure

```
Maktab/
├── packages/
│   ├── web/                    # Frontend React application
│   │   ├── src/
│   │   │   ├── components/     # React components
│   │   │   ├── pages/          # Page components
│   │   │   ├── stores/         # Zustand state stores
│   │   │   ├── hooks/          # Custom React hooks
│   │   │   ├── lib/            # Utilities and services
│   │   │   ├── types/          # TypeScript types
│   │   │   ├── schemas/        # Zod validation schemas
│   │   │   └── i18n/           # Internationalization
│   │   └── tailwind.config.ts  # Tailwind configuration
│   ├── api/                    # Backend Express API
│   │   ├── src/
│   │   │   ├── entity/         # TypeORM entities
│   │   │   ├── database/       # Database service
│   │   │   └── server.ts       # Express server
│   │   └── schema.ts           # Zod validation schemas
│   └── solver/                 # Python solver
│       └── solver_enhanced.py  # OR-Tools scheduler
└── timetable.db                # SQLite database
```

## What We've Completed

### Phase 1: UI Improvements & Multilingual Support

#### 1. Enhanced Wizard Container ✅
- **Location**: `packages/web/src/components/wizard/wizard-container.tsx`
- **Features**:
  - Animated progress bar with percentage
  - Step indicators with checkmarks for completed steps
  - Visual feedback for current step (highlighted with ring)
  - Responsive layout for mobile and desktop
  - Full RTL support for Dari language
  - Auto-save functionality
  - Smooth fade animations between steps
  - Gradient backgrounds
  - Loading states for buttons
  - Navigation buttons with direction-aware icons

#### 2. Language Support System ✅
- **Location**: `packages/web/src/hooks/useLanguage.ts`
- **Features**:
  - Dynamic language switching (English ↔ Dari)
  - Automatic RTL/LTR layout switching
  - Persian font support (Vazirmatn)
  - Helper functions for RTL-aware styling:
    - `rtlClass()` - Conditional class names
    - `rtlSide()` - Margin/padding helpers
    - `rtlRow()` - Flex direction helpers
- **CSS Changes**: `packages/web/src/index.css`
  - `[dir="rtl"]` and `[dir="ltr"]` rules
  - RTL-specific styles for components
  - Persian font family configuration

#### 3. School Information Step ✅
- **Location**: `packages/web/src/components/wizard/steps/school-info-step.tsx`
- **Features**:
  - Beautiful card-based layout with icons
  - Real-time validation with visual feedback (green/red borders)
  - Timezone dropdown with major Asian timezones
  - Interactive working days selector
  - Selected days summary with badges
  - Modern UI with hover effects
  - Dark mode support
  - Multilingual support

#### 4. Periods Configuration Step ✅
- **Location**: `packages/web/src/components/wizard/steps/periods-step.tsx`
- **Features**:
  - Dynamic period calculation from school start time
  - Periods per day selector (1-10)
  - Duration selector with 5-minute increments (10-90 minutes)
  - Break periods selector (lunch/prayer)
  - Live schedule preview with timeline
  - Statistics cards (Total Hours, Break Time, End Time)
  - Visual period list with time slots
  - Color-coded periods (regular vs break)
  - Automatic time calculations

#### 5. Rooms Management Step ✅
- **Location**: `packages/web/src/components/wizard/steps/rooms-step.tsx`
- **Features**:
  - Table-based inline editing
  - 3 empty rows by default
  - Dynamic room types from database
  - Autocomplete for room types (prevents duplicates)
  - Statistics cards (Total Rooms, Capacity, Avg, Types)
  - Real-time validation
  - Row-level delete functionality
  - Auto-save on field blur
  - RTL support
  - Backend integration with Zustand store

#### 6. Classes Management Step ✅
- **Location**: `packages/web/src/components/wizard/steps/classes-step.tsx`
- **Features**:
  - Simplified table UI (Name, Student Count)
  - 3 empty rows by default
  - Statistics cards (Total Classes, Students, Average)
  - Inline editing with validation
  - Row-level actions (save, delete)
  - Real-time statistics calculation
  - Backend integration
  - Multilingual support

#### 7. Subjects Management Step ✅
- **Location**: `packages/web/src/components/wizard/steps/subjects-step.tsx`
- **Features**:
  - Comprehensive table with all subject fields
  - 3 empty rows by default
  - Room types loaded from database (no mock data)
  - Autocomplete for room types
  - Inline editing with validation
  - Fields: Name*, Code, Room Type, Is Difficult, Min Capacity
  - Real-time save on blur
  - Row-level actions
  - Backend integration

#### 8. Wizard Step Order ✅
- **Location**: `packages/web/src/pages/Wizard.tsx`
- **Final Order**:
  1. School Info
  2. Periods
  3. Rooms (moved before Subjects)
  4. Classes (moved before Subjects)
  5. Subjects (now uses real room types)
  6. Teachers
  7. Constraints
  8. Review

#### 9. UI Components Created ✅
- **Progress Component**: `packages/web/src/components/ui/progress.tsx`
  - Gradient progress bar
  - Smooth animations
  - Accessible design
- **Wizard Step Container**: `packages/web/src/components/wizard/shared/wizard-step-container.tsx`
  - Reusable card wrapper
  - Icon support
  - RTL-aware layout
  - Consistent styling

#### 10. Language Switcher in Header ✅
- **Location**: `packages/web/src/components/layout/header.tsx`
- **Features**:
  - Toggle button with language icon
  - Displays current language
  - Updates entire application

## Design System

### Color Palette
- **Primary Blue**: `blue-50` to `blue-900`
- **Success Green**: `green-50` to `green-900`
- **Warning Orange**: `orange-50` to `orange-900`
- **Error Red**: `red-50` to `red-900`
- **Purple Accent**: `purple-50` to `purple-900`

### Typography
- **Primary Font**: System UI Stack (English)
- **Secondary Font**: Vazirmatn (Dari/Persian)
- **Base Size**: 16px (1rem)
- **Scale**: Tailwind's default scale

### Spacing
- Consistent use of Tailwind spacing scale
- Container max-width: `max-w-5xl` / `max-w-7xl`
- Card padding: `p-4` to `p-6`
- Gap spacing: `gap-2` to `gap-6`

## Key Features Implemented

### User Experience
1. **Inline Editing**: All wizard steps support inline editing
2. **Auto-Save**: Changes save automatically on blur or button click
3. **Real-Time Validation**: Immediate visual feedback
4. **Empty State Handling**: 3 empty rows by default
5. **Statistics Cards**: Live calculation of totals and averages
6. **Loading States**: Smooth transitions and feedback
7. **Toast Notifications**: Success/error messages
8. **Error Handling**: Graceful error states

### Data Management
1. **Zustand Stores**: Global state management
2. **Backend Sync**: Real-time database synchronization
3. **Optimistic Updates**: Immediate UI updates
4. **Cache Invalidation**: Automatic cache refresh
5. **Data Normalization**: Consistent ID types (strings)

### Internationalization
1. **Dynamic Language Switching**: English ↔ Dari
2. **RTL Layout Support**: Complete right-to-left layout
3. **Persian Font**: Vazirmatn for proper rendering
4. **Translation Keys**: Organized i18n structure
5. **Direction-Aware Components**: Adaptive layouts

## Database Schema

### Entities
- **SchoolInfo**: School name, timezone, working days, start time
- **PeriodsInfo**: Periods per day, duration, break periods
- **Room**: Name, type, capacity, features, unavailable times
- **ClassGroup**: Name, student count, subject requirements
- **Subject**: Name, code, room type, difficulty, capacity
- **Teacher**: Full name, subjects, availability, preferences
- **Timetable**: Generated schedules
- **Configuration**: System settings

## API Endpoints

### Data Operations
- `GET /api/health` - Health check
- `GET /api/rooms` - Get all rooms
- `POST /api/rooms` - Create room
- `PUT /api/rooms/:id` - Update room
- `DELETE /api/rooms/:id` - Delete room
- Similar endpoints for Subjects, Teachers, Classes

### Wizard Operations
- `GET /api/wizard/:id/steps/:stepKey` - Get step data
- `POST /api/wizard/:id/steps/:stepKey` - Save step data
- `GET /api/wizard/:id/steps` - Get all steps

### Timetable Generation
- `POST /api/generate` - Generate timetable

## Testing Status

### Completed
- ✅ UI Components
- ✅ Wizard Flow
- ✅ Data Persistence
- ✅ Multilingual Support
- ✅ RTL Layout

### Pending
- ⏳ Teacher Step Enhancement
- ⏳ Constraints Step
- ⏳ Review Step
- ⏳ Timetable Generation
- ⏳ Full Integration Tests

## Next Steps

### Phase 2: Remaining Steps (Pending)
1. **Teachers Step Enhancement**
   - Add availability matrix
   - Subject assignments
   - Time preferences
   - Room preferences

2. **Constraints Step**
   - Hard constraints configuration
   - Soft constraints (weights)
   - Validation rules

3. **Review Step**
   - Data validation
   - Summary display
   - Conflict detection
   - Generate button

### Phase 3: Timetable Generation
1. Payload preparation
2. Python solver integration
3. Result processing
4. Conflict resolution
5. Display timetable

### Phase 4: Polish & Testing
1. Error handling
2. Loading states
3. Accessibility audit
4. Performance optimization
5. End-to-end testing

## Known Issues
- None currently documented

## Dependencies

### Frontend
```json
{
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "typescript": "^5.3.3",
  "vite": "^5.1.0",
  "tailwindcss": "^3.4.1",
  "zustand": "^4.5.0",
  "radix-ui": "^1.0.0",
  "zod": "^3.22.4",
  "sonner": "^1.3.1",
  "lucide-react": "^0.344.0"
}
```

### Backend
```json
{
  "express": "^4.18.2",
  "typeorm": "^0.3.17",
  "sqlite3": "^5.1.6",
  "zod": "^3.22.4"
}
```

## Development Commands

### Frontend
```bash
cd packages/web
npm install
npm run dev          # Start dev server
npm run build        # Build for production
```

### Backend
```bash
cd packages/api
npm install
npm run dev          # Start API server
```

### Full Stack
```bash
npm run dev          # Start both frontend and backend
```

## File Locations Reference

### Key Files Modified/Created
- `packages/web/src/components/wizard/wizard-container.tsx` - Enhanced wizard
- `packages/web/src/components/wizard/steps/*` - All step components
- `packages/web/src/hooks/useLanguage.ts` - Language management
- `packages/web/src/components/ui/progress.tsx` - Progress component
- `packages/web/src/i18n/translations.ts` - Translations
- `packages/web/tailwind.config.ts` - Tailwind config
- `packages/web/src/index.css` - Global styles with RTL support

## Contribution Guidelines
1. Follow the established design patterns
2. Use TypeScript for all new code
3. Implement proper error handling
4. Add RTL support for all new components
5. Write meaningful commit messages
6. Test on both English and Dari languages
7. Ensure responsive design

## License
[Your License Here]

## Contact
[Your Contact Information]

---

**Last Updated**: December 2024
**Version**: 1.0.0
**Status**: Phase 1 Complete (UI Improvements)
