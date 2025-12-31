# Afghanistan-Specific Features

This document describes the Afghanistan-specific features implemented in the Maktab timetable solver. These features provide optional, user-controlled settings that adapt the solver to local educational practices.

## Philosophy

**"Smart defaults + freedom to customize"** - Nothing is forced, everything is optional and configurable.

## Features Overview

| Feature | Description | Default |
|---------|-------------|---------|
| Ramadan Mode | Shorter periods and adjusted breaks during Ramadan | Disabled |
| Ministry Validation | Optional curriculum compliance checking | Disabled |
| Smart Defaults | Afghan school defaults (Sat-Thu, 7 periods) | Applied |
| Low-Resource Mode | Reduced CPU/memory for older computers | Disabled |
| Flexible Day Config | Different periods per day | 7 periods/day |

---

## 1. Ramadan Mode

Enables shorter periods and adjusted break times during the month of Ramadan.

### Configuration

```typescript
{
  ramadanModeEnabled: boolean,      // Enable/disable Ramadan mode
  ramadanPeriodDuration: number,    // Period duration in minutes (default: 35)
  ramadanBreakConfig: BreakPeriodConfig[] | null  // Optional break configuration
}
```

### Behavior

- When enabled, uses `ramadanPeriodDuration` (default 35 minutes) instead of standard period duration
- Applies `ramadanBreakConfig` for break periods if provided
- When disabled, uses standard period durations and break configurations

### API

```bash
# Get current config
GET /api/config/school-config

# Update Ramadan settings
PUT /api/config/school-config
{
  "ramadanModeEnabled": true,
  "ramadanPeriodDuration": 30
}
```

---

## 2. Ministry of Education Validation

Optional validation of curriculum against Afghanistan Ministry of Education requirements.

### Validation Modes

| Mode | Behavior |
|------|----------|
| `warn` | Returns warnings without blocking timetable generation |
| `strict` | Blocks generation if core subject requirements not met |
| `off` | Skips all Ministry curriculum checks |

### Configuration

```typescript
{
  enableMinistryValidation: boolean,  // Enable/disable validation
  ministryValidationMode: 'warn' | 'strict' | 'off',
  customCurriculumMode: boolean       // Skip validation for custom curriculum
}
```

### Curriculum Requirements

The system validates against official Ministry curriculum for grades 1-12:

- **Alpha-Primary (Grades 1-3)**: دری، ریاضی، تعلیم و تربیه اسلامی، قرآن‌کریم، تربیت بدنی، رسم و خط
- **Beta-Primary (Grades 4-6)**: Adds پشتو، انگلیسی، ساینس، دروس اجتماعی، حرفه
- **Middle (Grades 7-9)**: Adds فزیک، کیمیا، بیولوژی، تاریخ، جغرافیه، عربی
- **High (Grades 10-12)**: Adds تفسیر، جیولوژی، کمپیوتر

### Warning Messages

Warnings are generated in both Farsi and English:

```json
{
  "type": "MINISTRY_SUBJECT_HOURS",
  "severity": "warning",
  "className": "صنف ۱۰-الف",
  "subjectName": "ریاضی",
  "requiredPeriods": 6,
  "configuredPeriods": 4,
  "messageFarsi": "صنف صنف ۱۰-الف: مضمون ریاضی حداقل 6 ساعت نیاز دارد، اما 4 ساعت تنظیم شده",
  "messageEnglish": "Class صنف ۱۰-الف: Mathematics requires minimum 6 periods, but 4 configured"
}
```

---

## 3. Smart Defaults

Automatically applies Afghan school defaults when configuration is missing.

### Default Values

| Setting | Default Value |
|---------|---------------|
| School Days | Saturday through Thursday |
| Periods per Day | 7 |
| Ramadan Mode | Disabled |
| Ministry Validation | Disabled |
| Low-Resource Mode | Disabled |
| Gender Separation | Disabled |

### Behavior

- Defaults are applied only to missing fields
- User-provided values are always preserved
- Can be overridden through the settings interface

---

## 4. Low-Resource Mode

Optimizes solver for older computers with limited hardware resources.

### Configuration

```typescript
{
  lowResourceMode: boolean  // Enable/disable low-resource mode
}
```

### Resource Limits

| Parameter | Low-Resource | Standard |
|-----------|--------------|----------|
| Worker Threads | 2 | 8 |
| Max Memory | 512 MB | Unlimited |
| Solution Strategy | First feasible | Optimized |

### When to Use

- Older computers with limited RAM
- Systems experiencing freezing during generation
- When quick results are preferred over optimal solutions

---

## 5. Flexible Day Configuration

Allows different period counts for each day of the week.

### Configuration

```typescript
{
  daysOfWeek: string[],                    // Active school days
  periodsPerDay: number,                   // Default periods (1-12)
  periodsPerDayMap: Record<string, number> // Per-day overrides
}
```

### Example

```json
{
  "daysOfWeek": ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"],
  "periodsPerDay": 7,
  "periodsPerDayMap": {
    "Thursday": 5,
    "Wednesday": 6
  }
}
```

---

## API Endpoints

### School Configuration

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/config/school-config` | GET | Get current school configuration |
| `/api/config/school-config` | PUT | Update school configuration |
| `/api/config/school-config/solver` | GET | Get solver-compatible config |
| `/api/config/school-config/validate` | GET | Validate configuration |

### Example: Full Configuration

```json
{
  "id": 1,
  "schoolId": null,
  "ramadanModeEnabled": false,
  "ramadanPeriodDuration": 35,
  "ramadanBreakConfigJson": null,
  "enableMinistryValidation": false,
  "ministryValidationMode": "warn",
  "customCurriculumMode": false,
  "lowResourceMode": false,
  "daysOfWeekJson": "[\"Saturday\",\"Sunday\",\"Monday\",\"Tuesday\",\"Wednesday\",\"Thursday\"]",
  "periodsPerDayMapJson": null,
  "defaultPeriodsPerDay": 7
}
```

---

## Python Solver Integration

The Afghanistan features are integrated into the solver via the `afghanistan` module:

```
packages/solver/afghanistan/
├── __init__.py
├── curriculum.py        # Ministry curriculum data
├── defaults.py          # Default configuration
├── low_resource.py      # Low-resource mode handler
├── ministry_validator.py # Ministry validation
└── ramadan_mode.py      # Ramadan mode handler
```

### Usage in Solver

```python
from afghanistan.defaults import apply_defaults
from afghanistan.ramadan_mode import RamadanModeHandler
from afghanistan.ministry_validator import MinistryValidator
from afghanistan.low_resource import LowResourceHandler

# Apply defaults to input
data = apply_defaults(data)

# Apply Ramadan mode
ramadan_handler = RamadanModeHandler.from_solver_config(config)
data = ramadan_handler.apply_to_input(data)

# Validate curriculum
validator = MinistryValidator.from_solver_config(config)
result = validator.validate(data)

# Configure solver for low-resource mode
low_resource = LowResourceHandler.from_solver_config(config)
low_resource.configure_solver(solver)
```

---

## Database Schema

The `school_config` table stores all Afghanistan-specific settings:

```sql
CREATE TABLE school_config (
  id INTEGER PRIMARY KEY,
  schoolId INTEGER,
  schoolName TEXT,
  enablePrimary BOOLEAN DEFAULT TRUE,
  enableMiddle BOOLEAN DEFAULT TRUE,
  enableHigh BOOLEAN DEFAULT TRUE,
  daysPerWeek INTEGER DEFAULT 6,
  periodsPerDay INTEGER DEFAULT 7,
  breakPeriods TEXT DEFAULT '[]',
  ramadanModeEnabled BOOLEAN DEFAULT FALSE,
  ramadanPeriodDuration INTEGER DEFAULT 35,
  ramadanBreakConfigJson TEXT,
  enableMinistryValidation BOOLEAN DEFAULT FALSE,
  ministryValidationMode TEXT DEFAULT 'warn',
  customCurriculumMode BOOLEAN DEFAULT FALSE,
  lowResourceMode BOOLEAN DEFAULT FALSE,
  daysOfWeekJson TEXT,
  periodsPerDayMapJson TEXT,
  defaultPeriodsPerDay INTEGER DEFAULT 7,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## Testing

All features are covered by property-based tests using Hypothesis:

```bash
# Run Afghanistan feature tests
cd packages/solver
source .venv/bin/activate
pytest tests/property/test_prop_ramadan_mode.py -v
pytest tests/property/test_prop_low_resource.py -v
pytest tests/property/test_prop_afghanistan_defaults.py -v
pytest tests/property/test_prop_day_config.py -v
pytest tests/property/test_prop_farsi_localization.py -v

# Run integration tests
pytest tests/integration/test_afghanistan_features.py -v
```
