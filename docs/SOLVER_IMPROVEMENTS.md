# Timetable Solver: Unbeatable Improvements

> Based on analysis of your current solver architecture. Prioritized by impact vs effort.

---

## Current Strengths (Already Ahead of Competitors)

Your solver already has:
- ✅ OR-Tools CP-SAT (industrial-grade solver)
- ✅ 3 strategy modes (Fast/Balanced/Thorough)
- ✅ Problem decomposition for large schools
- ✅ Modular constraint system (hard/soft separation)
- ✅ Afghanistan-specific rules (grade categories, single-teacher mode)
- ✅ Dynamic periods per day
- ✅ Gender separation support
- ✅ Multi-shift support

Most competitors use simple greedy algorithms or manual scheduling. You're already technically superior.

---

## High Impact, Low Effort (Do First)

### 1. Solution Quality Score
**What:** Show users a quality score (0-100) for generated timetables.
**Why:** Users can't tell if a schedule is "good" — give them confidence.
**How:**
```python
# Add to solution output
def calculate_quality_score(solution, data):
    score = 100
    penalties = {
        'teacher_gaps': -2,      # per gap
        'afternoon_difficult': -3,  # per occurrence
        'same_day_subject': -1,  # per duplicate
        'unbalanced_load': -5,   # if teacher load variance > 20%
    }
    # Calculate and return score with breakdown
    return {
        'overall': score,
        'breakdown': {...},
        'suggestions': [...]  # "Move Math to morning for better results"
    }
```

### 2. Conflict Explanation (Farsi)
**What:** When solver fails, explain WHY in clear Farsi.
**Why:** Users blame the software when it's their data that's wrong.
**How:**
```python
CONFLICT_MESSAGES = {
    'teacher_overload': 'استاد {name} بیشتر از {max} ساعت در هفته تدریس نمیتواند، اما {required} ساعت نیاز است.',
    'room_conflict': 'اتاق {room} در {day} ساعت {period} دو صنف دارد.',
    'impossible_schedule': 'صنف {class} به {hours} ساعت نیاز دارد اما فقط {available} ساعت موجود است.',
}
```

### 3. "What-If" Analysis
**What:** Before generating, show potential issues.
**Why:** Catch problems before wasting 5 minutes on a failed solve.
**How:**
```python
def pre_solve_analysis(data):
    warnings = []
    
    # Check teacher capacity
    for teacher in data.teachers:
        required = sum_assigned_periods(teacher, data)
        if required > teacher.maxPeriodsPerWeek:
            warnings.append({
                'type': 'teacher_overload',
                'severity': 'error',
                'teacher': teacher.fullName,
                'required': required,
                'available': teacher.maxPeriodsPerWeek
            })
    
    # Check room capacity
    # Check subject distribution feasibility
    # etc.
    
    return warnings
```

---

## High Impact, Medium Effort

### 4. Teacher Preference Learning
**What:** Remember which schedules teachers liked and optimize for similar patterns.
**Why:** "The system knows what I prefer" = happy users.
**How:**
```python
# Store in database when user accepts/modifies schedule
class TeacherPreferenceHistory:
    teacher_id: str
    preferred_days: List[str]  # Days they didn't change
    preferred_periods: List[int]  # Periods they kept
    avoided_patterns: List[str]  # Patterns they always changed
```

### 5. Incremental Solving
**What:** When user changes ONE thing, don't regenerate entire schedule.
**Why:** 5-minute wait for small changes = frustrated users.
**How:**
```python
def solve_incremental(current_solution, change_request):
    """
    Only re-solve affected parts:
    - If teacher changed: only that teacher's lessons
    - If room changed: only that room's lessons
    - If subject added: only that class's schedule
    """
    affected_lessons = identify_affected(current_solution, change_request)
    fixed_lessons = [l for l in current_solution if l not in affected_lessons]
    
    # Solve with fixed lessons as constraints
    return solve_partial(data, fixed_lessons, affected_lessons)
```

### 6. Multi-Objective Optimization Display
**What:** Show trade-offs: "Fewer teacher gaps OR better subject distribution?"
**Why:** Let users choose what matters to THEM.
**How:**
```python
def generate_pareto_solutions(data, num_solutions=3):
    """Generate multiple solutions optimizing different objectives."""
    solutions = []
    
    # Solution 1: Minimize teacher gaps
    solutions.append(solve_with_priority('teacher_gaps'))
    
    # Solution 2: Best subject distribution
    solutions.append(solve_with_priority('subject_spread'))
    
    # Solution 3: Balanced
    solutions.append(solve_with_priority('balanced'))
    
    return solutions  # Let user pick
```

---

## Medium Impact, Low Effort

### 7. Smart Defaults by School Size
**What:** Auto-select solver strategy based on school size.
**Why:** Small schools don't need "Thorough" mode (wastes time).
**How:**
```python
def auto_select_strategy(data):
    total_lessons = sum(
        sum(req.periodsPerWeek for req in cls.subjectRequirements.values())
        for cls in data.classes
    )
    
    if total_lessons < 200:
        return 'fast'  # < 5 classes
    elif total_lessons < 500:
        return 'balanced'  # 5-15 classes
    else:
        return 'thorough'  # Large school
```

### 8. Progress Feedback
**What:** Show real-time progress during solving.
**Why:** Users think app is frozen during long solves.
**How:**
```python
# Already have structlog, add progress callbacks
def solve_with_progress(data, progress_callback):
    stages = [
        ('validation', 5),
        ('building_model', 15),
        ('solving_phase_1', 40),
        ('solving_phase_2', 30),
        ('formatting', 10)
    ]
    
    for stage, percent in stages:
        progress_callback(stage, percent)
        # ... do work
```

### 9. Export Comparison
**What:** Export two schedules side-by-side for comparison.
**Why:** Principals want to compare options before deciding.
**Format:** PDF with highlighted differences.

---

## Afghanistan-Specific Improvements (User-Controlled)

> **UX Philosophy:** Smart defaults for new users, full control for admins.
> Nothing is forced — everything is optional and configurable.

### 10. Ramadan Mode (Optional Toggle)
**What:** Shorter periods, adjusted break times during Ramadan.
**UX Approach:**
- Default: OFF
- Toggle in Settings → School Configuration
- When enabled, suggests (not forces) adjusted timings
- User can customize period duration, break times

```python
class SchoolConfig:
    # User-controlled settings (stored in database)
    ramadanModeEnabled: bool = False  # Default OFF
    ramadanPeriodDuration: int = 35   # Suggestion, user can change
    ramadanBreakConfig: Optional[List[BreakPeriodConfig]] = None
    
    # UI shows: "رمضان مود فعال شود؟" with explanation
```

**UI Flow:**
1. Settings → "تنظیمات رمضان" (Ramadan Settings)
2. Toggle: "فعال/غیرفعال"
3. If enabled: Show customizable fields for period duration, breaks
4. "ذخیره" saves to SchoolConfig entity

### 11. Friday Handling (User Choice)
**What:** Let user define their weekly schedule.
**UX Approach:**
- Default: Saturday-Thursday (common in Afghanistan)
- User picks which days are active
- User sets periods per day individually
- NO assumptions about Friday

```python
# Already exists in your config - just needs good UI
class GlobalConfig:
    daysOfWeek: List[DayOfWeek]  # User selects active days
    periodsPerDayMap: Dict[DayOfWeek, int]  # User sets per day
```

**UI Flow:**
1. Wizard Step 1: "روزهای هفته را انتخاب کنید" (Select school days)
2. Checkboxes for each day (Sat-Fri)
3. For each selected day: "چند ساعت درسی؟" (How many periods?)
4. Presets available: "معمول (شنبه-پنجشنبه)" or "سفارشی"

### 12. Ministry Curriculum Validation (Optional Helper)
**What:** OPTIONAL validation against Ministry requirements.
**UX Approach:**
- Default: OFF (just a helper, not enforced)
- Toggle: "بررسی مطابقت با نصاب وزارت معارف"
- Shows warnings, NOT errors
- User can ignore warnings and proceed
- Schools with custom curriculum can disable entirely

```python
class SchoolConfig:
    enableMinistryValidation: bool = False  # Default OFF
    ministryValidationMode: str = 'warn'    # 'warn' | 'strict' | 'off'
    customCurriculumMode: bool = False      # For non-standard schools

def validate_ministry_compliance(data, config):
    if not config.enableMinistryValidation:
        return []  # Skip validation entirely
    
    warnings = []  # NOT errors - user can proceed
    for cls in data.classes:
        # ... check requirements
        pass
    
    return warnings  # UI shows as yellow warnings, not red errors
```

**UI Flow:**
1. Settings → "تنظیمات نصاب" (Curriculum Settings)
2. Toggle: "بررسی مطابقت با نصاب رسمی"
3. If enabled: Choose mode
   - "فقط هشدار" (Warn only) - default
   - "اجباری" (Strict) - blocks generation
4. Option: "مکتب ما نصاب سفارشی دارد" (We have custom curriculum)

---

## Competitive Differentiators

### 13. Offline-First Reliability
**What:** Solver works 100% offline, no internet needed.
**Why:** Many Afghan schools have unreliable internet.
**Status:** ✅ Already implemented (Electron + local SQLite)

### 14. Low-Resource Mode
**What:** Reduce memory/CPU usage for old computers.
**Why:** Many schools have old hardware.
**How:**
```python
def solve_low_resource(data):
    """Use less memory, accept slightly worse solutions."""
    # Limit worker threads
    solver.parameters.num_workers = 2  # vs default 8
    
    # Reduce search space
    solver.parameters.max_memory_in_mb = 512
    
    # Accept first feasible solution
    solver.parameters.stop_after_first_solution = True
```

### 15. WhatsApp Export
**What:** Generate schedule image optimized for WhatsApp sharing.
**Why:** Teachers share schedules via WhatsApp groups.
**Format:** Compressed PNG, readable on mobile.

---

## UX Design Principles

> **Core Philosophy:** Defaults that work + Freedom to customize

### Settings Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│  LEVEL 1: Smart Defaults (New Users)                    │
│  - Works out of the box                                 │
│  - No configuration required                            │
│  - Based on most common Afghan school setup             │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  LEVEL 2: Quick Settings (Most Users)                   │
│  - Toggle switches for common options                   │
│  - Ramadan mode, validation, etc.                       │
│  - Simple ON/OFF choices                                │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  LEVEL 3: Advanced Settings (Power Users)               │
│  - Full customization                                   │
│  - Custom constraints, weights, timings                 │
│  - Hidden behind "تنظیمات پیشرفته" button               │
└─────────────────────────────────────────────────────────┘
```

### Default Values (New Installation)

| Setting | Default | Why |
|---------|---------|-----|
| School Days | Sat-Thu | Most common in Afghanistan |
| Periods/Day | 7 | Standard for most schools |
| Friday | OFF | Most schools closed |
| Ramadan Mode | OFF | Only needed 1 month/year |
| Ministry Validation | OFF | Not all schools follow exactly |
| Solver Strategy | Auto | System picks based on size |
| Gender Separation | OFF | User enables if needed |
| Multi-shift | OFF | Single shift is common |

### Warning vs Error Philosophy

| Type | Color | Behavior | Example |
|------|-------|----------|---------|
| Error | 🔴 Red | Blocks generation | "استاد کافی نیست" |
| Warning | 🟡 Yellow | Shows but allows proceed | "نصاب وزارت رعایت نشده" |
| Suggestion | 🔵 Blue | Informational only | "ریاضی صبح بهتر است" |

User can always click "ادامه با وجود هشدارها" (Continue despite warnings).

---

## Implementation Priority

| Priority | Feature | Effort | Impact | User Control |
|----------|---------|--------|--------|--------------|
| 1 | Solution Quality Score | 2 days | High | Display only |
| 2 | Conflict Explanation (Farsi) | 2 days | High | Display only |
| 3 | Pre-solve Analysis | 3 days | High | Warnings dismissible |
| 4 | Progress Feedback | 1 day | Medium | Display only |
| 5 | Smart Strategy Selection | 1 day | Medium | Override available |
| 6 | Ramadan Mode | 2 days | High | Toggle + customize |
| 7 | Ministry Validation | 3 days | Medium | Toggle + mode select |
| 8 | Incremental Solving | 1 week | High | Automatic |
| 9 | Multi-Solution Generation | 1 week | Medium | User picks solution |
| 10 | Teacher Preference Learning | 2 weeks | High | Opt-in |

---

## What NOT to Build

❌ AI/ML-based scheduling — OR-Tools is already optimal
❌ Cloud-based solving — Offline is your advantage
❌ Complex UI for constraints — Keep it simple
❌ Real-time collaboration — Overkill for single-school use

---

## Summary

Your solver is already technically superior. The improvements above focus on:

1. **User Experience** — Quality scores, progress, explanations
2. **Afghanistan Context** — Ramadan, Ministry rules, WhatsApp
3. **Reliability** — Offline, low-resource, pre-validation
4. **Speed** — Incremental solving, smart defaults

These make your product feel "smart" and "local" — things competitors can't easily copy.
