# Maktab Backend Architecture Foundation

## Overview

This document describes the architectural foundation of the Maktab Timetable application. The system is designed as a desktop application for Afghan schools to generate class schedules automatically, with a foundation ready for future expansion into a full Learning Management System (LMS).

### Current Capabilities (v1.0)

The application currently provides:

- **Timetable Generation**: Automated schedule creation using constraint-based optimization. The solver handles complex requirements like teacher availability, room capacity, and subject distribution.

- **Parallel Processing**: For large schools with 756+ lessons per week, the solver automatically breaks the problem into smaller pieces and solves them simultaneously, significantly reducing wait time.

- **License Management**: Schools purchase 6-month or annual licenses. Renewal is handled through WhatsApp, Telegram, or phone calls.

### Future Expansion Path

The architecture is designed to grow into a complete school management system:
- Student registration and enrollment
- Fee collection and financial tracking
- Exam scheduling and grade management
- Attendance tracking and reporting
- Parent and teacher portals

---

## Solver Architecture

The timetable solver is the heart of the application. It was recently refactored from a single 3000+ line file into a modular system for better maintainability and performance.

### How the Solver Works

When you click "Generate Timetable", here's what happens:

**Step 1 - Configuration Loading**

The solver first loads its settings. It looks for a `solver_config.yaml` file, then checks for environment variables like `SOLVER_MAX_MEMORY_MB`. If nothing is configured, it uses sensible defaults (4GB memory limit, 10-minute time limit).

**Step 2 - Input Validation**

Before solving, the system validates all your data:
- Are the period configurations correct for each day?
- Does every teacher's availability match the school's schedule?
- Do all subject references point to actual subjects?

If validation fails, you get a clear error message explaining what's wrong.

**Step 3 - Problem Size Analysis**

The solver checks how many lessons need to be scheduled. For small schools (under 200 lessons/week), it solves everything at once. For larger schools, it automatically decomposes the problem.

**Step 4 - Decomposition (Large Schools Only)**

For schools with 200+ lessons, the solver groups classes into clusters based on shared teachers. Each cluster is solved independently, then the solutions are merged. This approach:
- Reduces solving time from hours to minutes
- Uses multiple CPU cores simultaneously
- Allows checkpointing so you can pause and resume

**Step 5 - Constraint Application**

The solver applies two types of constraints:

*Hard Constraints* (must be satisfied):
- No teacher can be in two places at once
- No class can have two lessons simultaneously
- No room can be double-booked
- Multi-period lessons must be on the same day
- Consecutive lessons must be adjacent

*Soft Constraints* (optimized when possible):
- Difficult subjects (like Math) should be in the morning
- Minimize gaps in teacher schedules
- Spread subjects across the week

**Step 6 - Solution Building**

Once the solver finds a valid schedule, it builds the output with:
- Day and period for each lesson
- Assigned teacher and room
- Metadata like grade categories (Alpha-Primary, Beta-Primary, Middle, High)

### Solver Module Organization

The solver code is organized into logical modules:

**core/** - The main solving logic
- `solver.py`: Orchestrates the entire solving process
- `variables.py`: Creates the mathematical variables for optimization
- `solution_builder.py`: Converts solver output to readable schedules

**constraints/** - All scheduling rules
- `registry.py`: A plugin system that manages which constraints are active
- `hard/`: Rules that cannot be broken (overlaps, consecutive periods)
- `soft/`: Preferences that improve schedule quality

**validation/** - Input checking
- Validates period configurations, teacher availability, and subject references

**models/** - Data structures
- `input.py`: Defines what data the solver expects (teachers, classes, rooms, etc.)
- `output.py`: Defines the schedule format returned

**config/** - Settings management
- `schema.py`: Defines all configurable options
- `loader.py`: Loads settings from files and environment variables

**parallel/** - Large problem handling
- `executor.py`: Runs multiple solver instances simultaneously
- `checkpoint.py`: Saves progress so solving can be paused and resumed

**memory/** - Resource management
- `manager.py`: Monitors memory usage and triggers cleanup when needed

**metrics/** - Performance monitoring
- `prometheus.py`: Exports statistics for monitoring dashboards

**job_queue/** - Background processing
- `worker.py`: Processes solving jobs from a queue (for server deployments)

### Configuration Options

The solver behavior can be customized through `solver_config.yaml`:

**Decomposition Settings**
- `threshold`: Lesson count that triggers decomposition (default: 200)
- `max_cluster_size`: Maximum lessons per cluster (default: 150)

**Strategy Settings**
Three built-in strategies balance speed vs. quality:
- *Fast*: 2 workers, 2-minute limit, minimal optimization
- *Balanced*: 4 workers, 5-minute limit, good optimization
- *Thorough*: 8 workers, 10-minute limit, maximum optimization

**Memory Settings**
- `max_memory_mb`: Maximum RAM usage (default: 4096 MB)
- `gc_threshold`: When to trigger garbage collection (default: 90% of limit)

**Environment Variables**
- `SOLVER_MAX_MEMORY_MB`: Override memory limit
- `SOLVER_MAX_TIME_SECONDS`: Override time limit

### Checkpoint and Resume

For very large schools, solving might take a long time. The checkpoint system:
- Saves progress after each cluster is solved
- Stores the partial solution, completed clusters, and pending work
- Allows resuming from exactly where it stopped
- Automatically deletes checkpoints after successful completion

### Docker Deployment

The solver can run in a Docker container with resource limits:
- CPU limited to 2 cores
- Memory limited to 4GB
- Health checks verify the solver is responsive
- Environment variables configure limits

---

## Database Architecture

### Multi-Tenancy Foundation

Every database table includes a `schoolId` field. Currently this is always null (single-school mode), but the foundation exists for future multi-school deployments where one server hosts multiple schools.

### Soft Delete Pattern

Records are never permanently deleted. Instead:
- `isDeleted` flag marks records as deleted
- `deletedAt` timestamp records when deletion occurred

This approach enables:
- Data recovery if something is deleted by mistake
- Complete audit trails for compliance
- Historical reporting

### Academic Year Structure

Data is organized hierarchically:

**Academic Year** (e.g., 1403 in Persian calendar)
- Contains multiple terms (semesters)
- Classes are assigned to years

**Term** (e.g., First Semester, Second Semester)
- Timetables belong to terms
- Future: Exams and fees will be term-based

**Class Groups**
- Belong to academic years
- Have grade levels (1-12)
- Future: Students will be enrolled in classes

### Core Entities

**Teachers**: Store name, subjects they can teach, availability schedule, and preferences.

**Subjects**: Define curriculum items with difficulty level and room requirements.

**Rooms**: Track capacity, type (classroom, lab, gym), and available features.

**Classes**: Group students by grade with subject requirements specifying periods per week.

**Timetables**: Store generated schedules linked to terms.

### Audit Logging

The system can log all data changes:
- What action occurred (create, update, delete)
- Who made the change
- What the old and new values were
- When and from where the change was made

This is essential for future financial modules where audit trails are legally required.

---

## User and Role System

The foundation exists for user management:

**User Accounts** include:
- Username and email for login
- Secure password storage
- Language preference (Farsi, Pashto, English)
- Link to teacher record (for teacher accounts)

**Roles** define what users can do:
- Admin: Full system access
- Teacher: View schedules, manage own availability
- Accountant: Access financial modules (future)

**Permissions** provide fine-grained control:
- `timetable.create`: Can generate new schedules
- `timetable.view`: Can view schedules
- `fees.view`: Can view financial data (future)

---

## Version Roadmap

### v1.0 (Current Release)
- Complete timetable generation with all constraint types
- License management system
- Modular solver with parallel processing
- Checkpoint/resume for large schools
- Docker containerization
- Prometheus metrics for monitoring

### v2.0 (Student Registration)
- Student database with enrollment
- Class assignment and transfers
- Student import/export (Excel, CSV)
- Parent contact information
- Basic student reports

### v3.0 (Financial Module)
- Fee structures by class and type
- Payment recording and tracking
- Discount management (siblings, scholarships)
- Receipt generation
- Financial reports and summaries
- Full audit logging enabled

### v4.0 (Exam Management)
- Exam scheduling integrated with timetables
- Grade entry by teachers
- Result card generation (Afghan government format)
- GPA calculation
- Promotion rules and recommendations

### v5.0 (Full LMS)
- Daily attendance tracking
- Teacher portal for grades and attendance
- Parent portal for viewing student progress
- SMS and notification system
- Mobile app API

---

## Testing Strategy

The solver uses comprehensive testing:

**Unit Tests** verify individual components work correctly in isolation. Located in `packages/solver/tests/unit/`.

**Property-Based Tests** use the Hypothesis framework to verify that certain properties always hold true, regardless of input. For example:
- The solver never produces schedules where a teacher is double-booked
- Configuration can be saved and loaded without data loss
- Every lesson appears in exactly one cluster during decomposition

**Integration Tests** verify the complete workflow from input to output. Located in `packages/solver/tests/integration/`.

To run tests, activate the solver's virtual environment and use pytest.

---

## Developer Quick Reference

### Adding a New Database Entity

1. Create the entity class in `packages/api/src/entity/`
2. Include `schoolId`, `isDeleted`, `deletedAt`, `createdAt`, `updatedAt` fields
3. Register the entity in the TypeORM configuration
4. Create a service class for business logic
5. Add API routes in `server.ts`
6. Add audit logging for sensitive operations

### Adding a New Constraint to the Solver

1. Create a constraint class inheriting from `HardConstraint` or `SoftConstraint`
2. Implement the `apply()` method with your constraint logic
3. Register the constraint with the `ConstraintRegistry`
4. Add tests to verify the constraint works correctly

### Configuring for Production

1. Set appropriate memory limits via environment variables
2. Configure the solver strategy based on typical school size
3. Enable checkpoint saving for large deployments
4. Set up Prometheus metrics collection for monitoring
5. Use Docker resource limits to prevent runaway processes

---

## Contact

For questions about this architecture, contact the development team.
