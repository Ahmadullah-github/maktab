# Afghanistan Curriculum Integration Plan

## Phase 1: Data Structure Setup ✅
- [x] Create curriculum data file with official subjects
- [x] Add TypeScript types for curriculum data
- [x] Add helper functions to parse and access curriculum data
- [x] Add validation for grade selection
- [x] Implement subject-to-room-type mapping
- [x] Add curriculum compliance checking

## Phase 2: Classes Step Enhancement ✅
- [x] Add "Quick Setup" modal
- [x] Implement grade selector (1-12)
- [x] Add sections selector with bilingual support (A, B, C / الف, ب, ج)
- [x] Generate class names automatically with bilingual formatting:
  - English: Grade7-A, Grade7-B, Grade8-A...
  - Persian: صنف هفتم الف, صنف هفتم ب, صنف هشتم الف...
- [x] Pre-populate classes with official subject requirements
- [x] Add "Generate All Classes" functionality
- [x] Preserve manual edit capability
- [x] Support Persian grade names (هفتم, هشتم, etc.)
- [x] Real-time preview in both languages

## Phase 3: Subjects Step Enhancement ✅
- [x] Add "Load from Curriculum" button
- [x] Create grade-based quick selection
- [x] Auto-populate subjects with official names
- [x] Map subjects to appropriate room types automatically
- [x] Add curriculum compliance indicator
- [x] Allow custom subject additions
- [x] Add subject templates for different grade levels

## Phase 4: Teachers Step Enhancement
- [ ] Add curriculum-based subject suggestions
- [ ] Show grade-level appropriate subjects
- [ ] Quick assignment tool using curriculum data
- [ ] Validation for subject-teacher combinations
- [ ] Multi-select for multiple subjects

## Phase 5: Additional Features
- [ ] Curriculum compliance report
- [ ] Missing subjects warning
- [ ] Auto-fill suggestions in all steps
- [ ] Grade-specific templates
- [ ] Localization support for subject names

## Technical Implementation Details

### File Structure
```
packages/web/src/
├── data/
│   └── afghanistanCurriculum.ts (NEW)
├── components/wizard/steps/
│   ├── classes-step.tsx (ENHANCED)
│   ├── subjects-step.tsx (ENHANCED)
│   └── teachers-step.tsx (ENHANCED)
└── types/
    └── curriculum.ts (NEW)
```

### Priority Implementation Order
1. Phase 1 (Data Structure) - Foundation
2. Phase 3 (Subjects) - Most immediate UX improvement
3. Phase 2 (Classes) - Complementary to subjects
4. Phase 4 (Teachers) - Enhanced after subjects
5. Phase 5 (Additional Features) - Polish

### Success Metrics
- Reduce subject entry time by 80%
- Reduce class setup time by 60%
- Improve curriculum compliance to 95%+
- User satisfaction increase in setup speed
