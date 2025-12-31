# Maktab Product Roadmap

> Solo-developer realistic roadmap. Each phase builds on the previous. Ship → Learn → Iterate.

---

## Phase 1: Timetable Excellence (Current → v1.5)
**Timeline: 1-2 months | Status: In Progress**

Focus: Be the BEST timetable generator for Afghan schools before expanding.

| Feature | Description | Priority |
|---------|-------------|----------|
| Multi-shift support | Morning/afternoon shifts with separate schedules | High |
| Teacher workload reports | Visual analytics for teacher distribution | High |
| Conflict detection UI | Clear visualization of scheduling conflicts | Medium |
| Export improvements | PDF/Excel export with school branding | Medium |
| Bulk data import | CSV/Excel import for teachers, subjects, classes | Medium |

**Goal:** Make timetable generation so good that schools recommend it to others.

---

## Phase 2: Core School Data (v2.0)
**Timeline: 2-3 months**

Foundation for all future features. No fancy features yet — just solid data management.

| Feature | Description | New Entities |
|---------|-------------|--------------|
| Student Management | Basic student records, enrollment, class assignment | `Student`, `Guardian`, `Enrollment` |
| Staff Management | Expand Teacher → general Staff (admin, accountant, etc.) | `Staff`, `StaffRole` |
| Academic Calendar | Terms, holidays, exam periods | Uses existing `AcademicYear`, `Term` |
| User Authentication | Login system with roles (admin, teacher, staff) | Uses existing `User` |

**Database additions:**
```
Student: id, schoolId, fullName, fatherName, classId, enrollmentDate, gender, dob, address, phone, status
Guardian: id, studentId, name, relation, phone, canReceiveSMS
Enrollment: id, studentId, classId, academicYearId, status
```

---

## Phase 3: Attendance System (v2.5)
**Timeline: 2 months**

Simple attendance first. Biometric integration later.

| Feature | Description |
|---------|-------------|
| Manual Attendance | Teacher marks attendance per class/period |
| Attendance Reports | Daily, weekly, monthly reports per student/class |
| Absence Alerts | Flag students with excessive absences |
| Teacher Attendance | Track teacher presence |

**Future (v3.x):** QR code scanning, biometric device integration, auto SMS to parents.

---

## Phase 4: Exam & Grades (v3.0)
**Timeline: 2-3 months**

| Feature | Description | New Entities |
|---------|-------------|--------------|
| Exam Scheduling | Create exams, assign dates/rooms | `Exam`, `ExamSchedule` |
| Grade Entry | Teachers enter marks per student/subject | `Grade`, `GradeScale` |
| Report Cards | Generate term-end report cards | `ReportCard` |
| Class Rankings | Automatic ranking based on scores | — |

**Question Bank (v3.5):**
```
Question: id, subjectId, gradeLevel, type (MCQ/written), difficulty, text, options, answer
QuestionPaper: id, examId, questions (JSON)
```

---

## Phase 5: Financial Management (v4.0)
**Timeline: 3-4 months**

Most complex module. Build incrementally.

### v4.0 - Basic Fees
| Feature | Description |
|---------|-------------|
| Fee Structure | Define fees per class/term |
| Fee Collection | Record payments, generate receipts |
| Outstanding Reports | Track unpaid fees |

### v4.5 - Advanced Finance
| Feature | Description |
|---------|-------------|
| Salary Management | Staff salary records, payment tracking |
| Expense Tracking | School expenses by category |
| Financial Reports | Income/expense summaries |

**Entities:**
```
FeeStructure: id, classId, termId, amount, type (tuition/transport/etc)
Payment: id, studentId, amount, date, method, receiptNo
Expense: id, category, amount, date, description, approvedBy
Salary: id, staffId, month, amount, status, paidDate
```

---

## Phase 6: Communication (v4.5)
**Timeline: 1-2 months**

| Feature | Description |
|---------|-------------|
| Announcements | School-wide or class-specific notices |
| SMS Integration | Send attendance/fee alerts to parents |
| Notification Center | In-app notifications for users |

**Entities:**
```
Announcement: id, title, content, targetType (all/class/grade), targetId, publishDate
Notification: id, userId, type, message, isRead, createdAt
SMSLog: id, phone, message, status, sentAt
```

---

## Phase 7: Parent Portal (v5.0)
**Timeline: 2-3 months**

Separate lightweight app or web portal.

| Feature | Description |
|---------|-------------|
| View Child Info | Attendance, grades, fees |
| Receive Notifications | Push notifications for important updates |
| Fee Payment Status | See outstanding/paid fees |
| Communication | Message teachers (optional) |

**Technical:** Could be React Native mobile app or PWA. Shares API with main system.

---

## Phase 8: Advanced Features (v6.0+)
**Timeline: Future**

Only after core is stable and generating revenue.

| Feature | Complexity |
|---------|------------|
| Library Management | Medium |
| Transport Management | Medium |
| Inventory/Store | High |
| Biometric Integration | High (hardware) |
| Multi-school (SaaS) | Very High |
| Mobile App (Full) | High |

---

## Technical Debt to Address

Before major expansion:

- [ ] Add database migrations (currently using `synchronize: true`)
- [ ] Add comprehensive API tests
- [ ] Implement proper error handling across all routes
- [ ] Add request rate limiting
- [ ] Implement data backup/restore UI
- [ ] Add API documentation (Swagger/OpenAPI)

---

## Revenue Milestones

| Phase | Pricing Strategy |
|-------|------------------|
| v1.x | Timetable-only license (current) |
| v2.x | Basic School Management tier |
| v3.x | + Exam Management tier |
| v4.x | + Financial Management tier |
| v5.x | Full LMS package |

---

## Solo Dev Reality Check

| Phase | Estimated Time | With AI Assistance |
|-------|---------------|-------------------|
| Phase 1 | 2 months | 1 month |
| Phase 2 | 3 months | 2 months |
| Phase 3 | 2 months | 1.5 months |
| Phase 4 | 3 months | 2 months |
| Phase 5 | 4 months | 3 months |
| Phase 6 | 2 months | 1 month |
| Phase 7 | 3 months | 2 months |

**Total to full LMS: ~12-18 months of focused development**

---

## Recommended Approach

1. **Ship Phase 1 improvements** — Get more timetable customers
2. **Validate demand** — Ask customers what they need most
3. **Build Phase 2-3** — Core data + attendance (most requested)
4. **Re-evaluate** — Based on revenue and feedback
5. **Continue or pivot** — Maybe partner with existing LMS for other features

> "Don't build features nobody asked for. Ship fast, learn faster."
