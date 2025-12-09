# Maktab Backend Architecture Foundation

## Overview

This document describes the architectural foundation built into the Maktab Timetable application to support future expansion into a full LMS/ERP system.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CURRENT STATE (v1.0)                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Timetable Generation + License Management                          │   │
│  │  - Full constraint-based scheduling                                  │   │
│  │  - 6-month / Annual licensing                                        │   │
│  │  - Contact-based renewal (WhatsApp, Telegram, Call)                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Foundation Ready
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FUTURE VERSIONS (v2.0+)                              │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐   │
│  │   Students    │ │     Fees      │ │    Exams      │ │   Reports     │   │
│  │  Registration │ │  Management   │ │  & Results    │ │  & Analytics  │   │
│  └───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SCHOOL (Future)                                │
│                                    │                                        │
│         ┌──────────────────────────┼──────────────────────────┐            │
│         │                          │                          │            │
│         ▼                          ▼                          ▼            │
│  ┌─────────────┐           ┌─────────────┐           ┌─────────────┐       │
│  │   License   │           │    User     │           │ AcademicYear│       │
│  │             │           │             │           │             │       │
│  │ - schoolId  │           │ - schoolId  │           │ - schoolId  │       │
│  │ - key       │           │ - roles     │           │ - name      │       │
│  │ - expiresAt │           │ - perms     │           │ - isCurrent │       │
│  └─────────────┘           └─────────────┘           └──────┬──────┘       │
│                                                              │              │
│                                                              ▼              │
│                                                       ┌─────────────┐       │
│                                                       │    Term     │       │
│                                                       │             │       │
│                                                       │ - yearId    │       │
│                                                       │ - name      │       │
│                                                       └──────┬──────┘       │
│                                                              │              │
│         ┌────────────────────────────────────────────────────┤              │
│         │                    │                    │          │              │
│         ▼                    ▼                    ▼          ▼              │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐ ┌─────────┐       │
│  │  ClassGroup │     │  Timetable  │     │   (Future)  │ │(Future) │       │
│  │             │     │             │     │    Exams    │ │  Fees   │       │
│  │ - schoolId  │     │ - schoolId  │     │             │ │         │       │
│  │ - yearId    │     │ - yearId    │     │ - termId    │ │- termId │       │
│  │ - grade     │     │ - termId    │     │ - classId   │ │- classId│       │
│  └──────┬──────┘     └─────────────┘     └─────────────┘ └─────────┘       │
│         │                                                                   │
│         │ (Future: Students belong to Class)                               │
│         ▼                                                                   │
│  ┌─────────────┐                                                           │
│  │  (Future)   │                                                           │
│  │  Students   │                                                           │
│  │             │                                                           │
│  │ - classId   │                                                           │
│  │ - yearId    │                                                           │
│  └─────────────┘                                                           │
│                                                                             │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                   │
│  │   Teacher   │     │   Subject   │     │    Room     │                   │
│  │             │     │             │     │             │                   │
│  │ - schoolId  │     │ - schoolId  │     │ - schoolId  │                   │
│  │ - isDeleted │     │ - isDeleted │     │ - isDeleted │                   │
│  └─────────────┘     └─────────────┘     └─────────────┘                   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                           AuditLog                                   │   │
│  │  - schoolId, userId, action, entityType, entityId, oldValue, newValue│   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Foundation Features

### 1. Multi-Tenancy Ready (schoolId)

Every entity now has a `schoolId` field:

```typescript
// All entities have this pattern:
@Column({ type: "integer", nullable: true })
schoolId: number | null = null;
```

**Current behavior (v1.0):** schoolId is null (single-school mode)
**Future behavior (v2.0+):** Filter all queries by schoolId

### 2. Soft Delete Support

Every entity has soft delete fields:

```typescript
@Column({ type: "boolean", default: false })
isDeleted: boolean = false;

@Column({ type: "datetime", nullable: true })
deletedAt: Date | null = null;
```

**Benefits:**
- Data recovery possible
- Audit trail maintained
- Required for financial compliance

### 3. Academic Year Hierarchy

```
AcademicYear (1403)
├── Term 1 (First Semester)
│   ├── Timetables
│   ├── Exams (future)
│   └── Fee Records (future)
├── Term 2 (Second Semester)
│   ├── Timetables
│   ├── Exams (future)
│   └── Fee Records (future)
└── Classes
    └── Students (future)
```

### 4. User & Role System (Ready)

```typescript
// User entity ready with:
- username, email, passwordHash
- roles: ["admin", "teacher", "accountant"]
- permissions: ["timetable.create", "fees.view"]
- teacherId: Link to Teacher entity
- preferredLanguage: "fa" | "ps" | "en"
```

### 5. Audit Logging (Ready)

```typescript
// AuditService can log:
- CREATE, UPDATE, DELETE actions
- Who made the change (userId, userName)
- What changed (oldValue, newValue, changedFields)
- When (timestamp)
- From where (ipAddress, userAgent)
```

---

## Version Roadmap

### v1.0 (Current)
- ✅ Timetable generation
- ✅ License management
- ✅ Foundation entities (unused but ready)

### v2.0 (Student Registration)
- [ ] Student entity
- [ ] Class enrollment
- [ ] Student import/export
- [ ] Parent entity
- [ ] Basic reports

### v3.0 (Financial Module)
- [ ] Fee structure by class
- [ ] Payment tracking
- [ ] Discounts (sibling, scholarship)
- [ ] Receipt generation
- [ ] Financial reports
- [ ] Audit logging enabled

### v4.0 (Exam Management)
- [ ] Exam scheduling
- [ ] Grade entry
- [ ] Result cards (government format)
- [ ] GPA calculation
- [ ] Promotion rules

### v5.0 (Full LMS)
- [ ] Attendance tracking
- [ ] Teacher portal
- [ ] Parent portal
- [ ] SMS/notification system
- [ ] Mobile app API

---

## Migration Notes

### When Adding Students (v2.0)

```typescript
// New entity to create:
@Entity()
export class Student extends BaseEntity {
  @Column() schoolId: number;
  @Column() academicYearId: number;
  @Column() classId: number;
  @Column() fullName: string;
  @Column() fatherName: string;
  @Column() nationalId: string;
  @Column() enrollmentDate: Date;
  @Column() discounts: string; // JSON
  @Column() isDeleted: boolean;
  // ... more fields
}
```

### When Adding Fees (v3.0)

```typescript
// New entities to create:
@Entity()
export class FeeStructure extends BaseEntity {
  @Column() schoolId: number;
  @Column() academicYearId: number;
  @Column() classId: number;
  @Column() feeType: string; // "tuition", "transport", etc.
  @Column() amount: number;
}

@Entity()
export class Payment extends BaseEntity {
  @Column() schoolId: number;
  @Column() studentId: number;
  @Column() termId: number;
  @Column() amount: number;
  @Column() paymentDate: Date;
  @Column() receiptNumber: string;
}
```

---

## Developer Notes

### Adding a New Module

1. Create entity in `src/entity/`
2. Add to `ormconfig.ts` entities array
3. Create service in `src/services/`
4. Add routes to `server.ts` (or create module router)
5. Add audit logging for sensitive operations

### Enabling Multi-Tenancy

When ready to support multiple schools:

1. Create `School` entity
2. Add authentication middleware
3. Create tenant filtering middleware:
```typescript
app.use((req, res, next) => {
  req.schoolId = extractSchoolIdFromToken(req);
  next();
});
```
4. Update all queries to filter by schoolId

### Enabling Audit Logging

```typescript
// In any service method:
import { AuditService } from './auditService';

const auditService = AuditService.getInstance();

// After creating entity:
await auditService.logCreate("Teacher", savedTeacher);

// After updating entity:
await auditService.logUpdate("Teacher", oldTeacher, newTeacher);

// After deleting entity:
await auditService.logDelete("Teacher", teacher);
```

---

## Contact

For questions about this architecture, contact the development team.
