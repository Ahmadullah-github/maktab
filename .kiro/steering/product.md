# Product Overview

Maktab is a school timetable generation desktop application designed for the
Afghan education system.

## Core Functionality

- Automated timetable generation using constraint-based scheduling (OR-Tools
  CP-SAT solver)
- Support for Afghanistan's four-tier grade classification: Alpha-Primary (1-3),
  Beta-Primary (4-6), Middle (7-9), High (10-12)
- License management with 6-month/annual licensing and contact-based renewal
- Multi-shift and gender separation support

## Key Features

- Single-teacher mode for primary classes (one teacher teaches all subjects)
- Dynamic periods per day (different days can have different period counts)
- Custom subjects beyond the standard Ministry curriculum
- No empty periods validation (schedules must be fully allocated)
- Teacher availability and constraint management
- Room type and capacity matching

## Target Users

- Afghan schools (primary, middle, and high school levels)
- School administrators managing class schedules

## Localization

- Primary language: Farsi/Dari (Persian)
- UI messages and error strings are in Farsi
- Supports RTL layout considerations

## Business Rules (Code-Relevant)

These constraints affect how features should be implemented:

- **Single-teacher mode**: Primary classes (grades 1-6) have one teacher for all
  subjects
- **Variable periods**: Days can have different period counts (e.g., Saturday=7,
  Thursday=4)
- **No double-booking**: Teachers cannot be scheduled in two places at once
- **Room type matching**: Labs require specific room types (computer lab,
  science lab)
- **Shift isolation**: Resources (teachers, rooms) in one shift cannot overlap
  with another
- **No empty periods**: Generated schedules must be fully allocated (no gaps)
- **Grade tiers**: Alpha-Primary (1-3), Beta-Primary (4-6), Middle (7-9), High
  (10-12)
- **Soft delete**: All entities use `isDeleted` flag, never hard delete
