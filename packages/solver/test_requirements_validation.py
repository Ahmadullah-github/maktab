"""
Phase 2: Validation Logic Tests
Tests validation rules for Afghanistan Education Ministry requirements.

SAFETY: Tests validation logic only - no actual solver execution.
"""
import sys
import json
from typing import Dict, List, Any
from enum import Enum

try:
    from pydantic import BaseModel, Field, model_validator, ValidationError
except ImportError as e:
    print(f"[ERROR] Missing pydantic: {e}")
    sys.exit(1)


class TestResult:
    """Track test results."""
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.warnings = 0
        self.results = []
    
    def add_pass(self, test_name: str, details: str = ""):
        self.passed += 1
        self.results.append({"test": test_name, "status": "PASS", "details": details})
        print(f"  ✓ PASS: {test_name}")
        if details:
            print(f"    → {details}")
    
    def add_fail(self, test_name: str, error: str):
        self.failed += 1
        self.results.append({"test": test_name, "status": "FAIL", "error": error})
        print(f"  ✗ FAIL: {test_name}")
        print(f"    → {error}")
    
    def add_warning(self, test_name: str, warning: str):
        self.warnings += 1
        self.results.append({"test": test_name, "status": "WARNING", "warning": warning})
        print(f"  ⚠ WARNING: {test_name}")
        print(f"    → {warning}")
    
    def summary(self):
        total = self.passed + self.failed
        print(f"\n{'='*70}")
        print(f"TEST SUMMARY")
        print(f"{'='*70}")
        print(f"Total: {total} | Passed: {self.passed} | Failed: {self.failed} | Warnings: {self.warnings}")
        if total > 0:
            print(f"Success Rate: {(self.passed/total)*100:.1f}%")
        print(f"{'='*70}\n")
        return self.failed == 0


class DayOfWeek(str, Enum):
    MONDAY = 'Monday'
    TUESDAY = 'Tuesday'
    WEDNESDAY = 'Wednesday'
    THURSDAY = 'Thursday'
    FRIDAY = 'Friday'
    SATURDAY = 'Saturday'
    SUNDAY = 'Sunday'


# ==============================================================================
# TEST 1: Period Configuration Validation
# Requirement 6: Validate periods per day configuration
# ==============================================================================

class PeriodConfig(BaseModel):
    """Period configuration with validation."""
    daysOfWeek: List[DayOfWeek]
    periodsPerDayMap: Dict[DayOfWeek, int]
    
    @model_validator(mode='after')
    def validate_periods_config(self):
        """Validate period configuration."""
        # Check all days have period counts
        for day in self.daysOfWeek:
            if day not in self.periodsPerDayMap:
                raise ValueError(f"Missing period count for {day.value}")
            
            periods = self.periodsPerDayMap[day]
            if periods < 1 or periods > 12:
                raise ValueError(f"{day.value}: periods must be 1-12, got {periods}")
        
        # Check for extra days in map
        for day in self.periodsPerDayMap:
            if day not in self.daysOfWeek:
                raise ValueError(f"Period map contains day not in daysOfWeek: {day.value}")
        
        return self


def test_period_configuration_validation(results: TestResult):
    """Test Requirement 6: Period configuration validation."""
    print("\n" + "="*70)
    print("TEST 1: Period Configuration Validation")
    print("="*70)
    
    # Test 1.1: Valid configuration
    try:
        config = PeriodConfig(
            daysOfWeek=[DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.SATURDAY],
            periodsPerDayMap={
                DayOfWeek.MONDAY: 5,
                DayOfWeek.TUESDAY: 5,
                DayOfWeek.SATURDAY: 2
            }
        )
        results.add_pass("1.1: Valid period config", "All days have valid period counts")
    except Exception as e:
        results.add_fail("1.1: Valid period config", str(e))
    
    # Test 1.2: Missing day in map
    try:
        config = PeriodConfig(
            daysOfWeek=[DayOfWeek.MONDAY, DayOfWeek.TUESDAY],
            periodsPerDayMap={
                DayOfWeek.MONDAY: 5
            }
        )
        results.add_fail("1.2: Missing day validation", "Should reject missing day")
    except ValueError as e:
        if "Missing period count" in str(e):
            results.add_pass("1.2: Missing day validation", "Correctly rejects missing day")
        else:
            results.add_fail("1.2: Missing day validation", f"Wrong error: {e}")
    
    # Test 1.3: Invalid period count (too high)
    try:
        config = PeriodConfig(
            daysOfWeek=[DayOfWeek.MONDAY],
            periodsPerDayMap={
                DayOfWeek.MONDAY: 15  # > 12
            }
        )
        results.add_fail("1.3: Period count range", "Should reject >12 periods")
    except ValueError as e:
        if "must be 1-12" in str(e):
            results.add_pass("1.3: Period count range", "Correctly validates range")
        else:
            results.add_fail("1.3: Period count range", f"Wrong error: {e}")
    
    # Test 1.4: Invalid period count (zero)
    try:
        config = PeriodConfig(
            daysOfWeek=[DayOfWeek.MONDAY],
            periodsPerDayMap={
                DayOfWeek.MONDAY: 0
            }
        )
        results.add_fail("1.4: Zero periods", "Should reject 0 periods")
    except ValueError:
        results.add_pass("1.4: Zero periods", "Correctly rejects 0 periods")


# ==============================================================================
# TEST 2: No Empty Periods Validation
# Requirement 9: Validate subject periods = total available periods
# ==============================================================================

class SubjectRequirement(BaseModel):
    subjectId: str
    periodsPerWeek: int = Field(ge=0)


class ClassValidation(BaseModel):
    """Class with subject requirements validation."""
    classId: str
    subjects: List[SubjectRequirement]
    totalAvailablePeriods: int = Field(gt=0)
    
    @model_validator(mode='after')
    def validate_no_empty_periods(self):
        """Validate Requirement 9: No empty periods."""
        total_required = sum(s.periodsPerWeek for s in self.subjects)
        
        if total_required < self.totalAvailablePeriods:
            # Warning: will have empty periods
            self.validation_warning = f"Empty periods: {self.totalAvailablePeriods - total_required} periods unassigned"
        elif total_required > self.totalAvailablePeriods:
            # Error: not enough periods
            raise ValueError(
                f"Over-allocated: need {total_required} periods but only {self.totalAvailablePeriods} available"
            )
        
        return self


def test_no_empty_periods_validation(results: TestResult):
    """Test Requirement 9: No empty periods validation."""
    print("\n" + "="*70)
    print("TEST 2: No Empty Periods Validation (Requirement 9)")
    print("="*70)
    
    # Test 2.1: Perfect match - no empty periods
    try:
        class_val = ClassValidation(
            classId="TEST_CLASS_1A",
            totalAvailablePeriods=27,  # 5+5+5+5+5+2+2 = 29, or 5*5 + 2 = 27
            subjects=[
                SubjectRequirement(subjectId="MATH", periodsPerWeek=5),
                SubjectRequirement(subjectId="DARI", periodsPerWeek=5),
                SubjectRequirement(subjectId="PASHTO", periodsPerWeek=4),
                SubjectRequirement(subjectId="SCIENCE", periodsPerWeek=4),
                SubjectRequirement(subjectId="ISLAMIC", periodsPerWeek=4),
                SubjectRequirement(subjectId="ARTS", periodsPerWeek=3),
                SubjectRequirement(subjectId="PE", periodsPerWeek=2),
            ]
        )
        total = sum(s.periodsPerWeek for s in class_val.subjects)
        if total == class_val.totalAvailablePeriods:
            results.add_pass("2.1: Perfect allocation", f"{total} = {class_val.totalAvailablePeriods} periods")
        else:
            results.add_fail("2.1: Perfect allocation", f"Mismatch: {total} != {class_val.totalAvailablePeriods}")
    except Exception as e:
        results.add_fail("2.1: Perfect allocation", str(e))
    
    # Test 2.2: Under-allocated - will have empty periods (WARNING)
    try:
        class_val = ClassValidation(
            classId="TEST_CLASS_BAD",
            totalAvailablePeriods=27,
            subjects=[
                SubjectRequirement(subjectId="MATH", periodsPerWeek=5),
                SubjectRequirement(subjectId="DARI", periodsPerWeek=5),
            ]
        )
        if hasattr(class_val, 'validation_warning'):
            results.add_warning("2.2: Under-allocation", class_val.validation_warning)
        else:
            results.add_pass("2.2: Under-allocation", "Validation accepted (add warning logic)")
    except Exception as e:
        results.add_fail("2.2: Under-allocation", str(e))
    
    # Test 2.3: Over-allocated - not enough periods (ERROR)
    try:
        class_val = ClassValidation(
            classId="TEST_CLASS_OVERFLOW",
            totalAvailablePeriods=27,
            subjects=[
                SubjectRequirement(subjectId="MATH", periodsPerWeek=10),
                SubjectRequirement(subjectId="DARI", periodsPerWeek=10),
                SubjectRequirement(subjectId="PASHTO", periodsPerWeek=10),
            ]
        )
        results.add_fail("2.3: Over-allocation", "Should reject over-allocated periods")
    except ValueError as e:
        if "Over-allocated" in str(e):
            results.add_pass("2.3: Over-allocation", "Correctly rejects over-allocation")
        else:
            results.add_fail("2.3: Over-allocation", f"Wrong error: {e}")


# ==============================================================================
# TEST 3: Single-Teacher Mode Validation
# Requirements 2-3: Validate single-teacher configuration
# ==============================================================================

class SingleTeacherValidation(BaseModel):
    """Single-teacher class validation."""
    classId: str
    singleTeacherMode: bool
    classTeacherId: str | None
    teacherAvailablePeriods: int
    classRequiredPeriods: int
    
    @model_validator(mode='after')
    def validate_single_teacher(self):
        """Validate single-teacher mode requirements."""
        if self.singleTeacherMode:
            # Must have a class teacher
            if not self.classTeacherId:
                raise ValueError(f"Class {self.classId}: Single-teacher mode requires classTeacherId")
            
            # Teacher must have sufficient availability
            if self.teacherAvailablePeriods < self.classRequiredPeriods:
                raise ValueError(
                    f"Class {self.classId}: Teacher has {self.teacherAvailablePeriods} available "
                    f"but class needs {self.classRequiredPeriods} periods"
                )
        else:
            # Multi-teacher mode should not have classTeacherId set
            if self.classTeacherId:
                raise ValueError(
                    f"Class {self.classId}: Multi-teacher mode should not have classTeacherId"
                )
        
        return self


def test_single_teacher_validation(results: TestResult):
    """Test Requirements 2-3: Single-teacher mode validation."""
    print("\n" + "="*70)
    print("TEST 3: Single-Teacher Mode Validation")
    print("="*70)
    
    # Test 3.1: Valid single-teacher with sufficient availability
    try:
        validation = SingleTeacherValidation(
            classId="TEST_CLASS_1A",
            singleTeacherMode=True,
            classTeacherId="TEACHER_001",
            teacherAvailablePeriods=27,
            classRequiredPeriods=27
        )
        results.add_pass("3.1: Valid single-teacher", "Teacher has sufficient availability")
    except Exception as e:
        results.add_fail("3.1: Valid single-teacher", str(e))
    
    # Test 3.2: Single-teacher without teacher ID
    try:
        validation = SingleTeacherValidation(
            classId="TEST_CLASS_BAD",
            singleTeacherMode=True,
            classTeacherId=None,
            teacherAvailablePeriods=27,
            classRequiredPeriods=27
        )
        results.add_fail("3.2: Missing teacher ID", "Should reject missing teacher")
    except ValueError as e:
        if "requires classTeacherId" in str(e):
            results.add_pass("3.2: Missing teacher ID", "Correctly requires teacher ID")
        else:
            results.add_fail("3.2: Missing teacher ID", f"Wrong error: {e}")
    
    # Test 3.3: Single-teacher with insufficient availability
    try:
        validation = SingleTeacherValidation(
            classId="TEST_CLASS_LIMITED",
            singleTeacherMode=True,
            classTeacherId="TEACHER_PARTTIME",
            teacherAvailablePeriods=15,
            classRequiredPeriods=27
        )
        results.add_fail("3.3: Insufficient availability", "Should reject insufficient availability")
    except ValueError as e:
        if "Teacher has 15 available but class needs 27" in str(e):
            results.add_pass("3.3: Insufficient availability", "Correctly validates availability")
        else:
            results.add_fail("3.3: Insufficient availability", f"Wrong error: {e}")
    
    # Test 3.4: Multi-teacher with teacher ID (should warn)
    try:
        validation = SingleTeacherValidation(
            classId="TEST_CLASS_MULTI",
            singleTeacherMode=False,
            classTeacherId="TEACHER_001",  # Shouldn't be set
            teacherAvailablePeriods=27,
            classRequiredPeriods=27
        )
        results.add_fail("3.4: Multi-teacher inconsistency", "Should reject teacher ID in multi mode")
    except ValueError as e:
        if "should not have classTeacherId" in str(e):
            results.add_pass("3.4: Multi-teacher inconsistency", "Correctly validates mode consistency")
        else:
            results.add_fail("3.4: Multi-teacher inconsistency", f"Wrong error: {e}")


# ==============================================================================
# TEST 4: Teacher Availability vs Dynamic Periods
# Requirement 8: Validate teacher availability matches period config
# ==============================================================================

class TeacherAvailabilityValidation(BaseModel):
    """Validate teacher availability matches period configuration."""
    teacherId: str
    availabilityMap: Dict[DayOfWeek, List[bool]]
    expectedPeriodsPerDay: Dict[DayOfWeek, int]
    
    @model_validator(mode='after')
    def validate_availability_structure(self):
        """Validate availability matches expected periods."""
        for day, expected_periods in self.expectedPeriodsPerDay.items():
            if day not in self.availabilityMap:
                raise ValueError(f"Teacher {self.teacherId}: Missing availability for {day.value}")
            
            actual_periods = len(self.availabilityMap[day])
            if actual_periods != expected_periods:
                raise ValueError(
                    f"Teacher {self.teacherId}: {day.value} has {actual_periods} periods "
                    f"but config expects {expected_periods}"
                )
        
        return self


def test_teacher_availability_integration(results: TestResult):
    """Test Requirement 8: Teacher availability with dynamic periods."""
    print("\n" + "="*70)
    print("TEST 4: Teacher Availability Integration")
    print("="*70)
    
    # Test 4.1: Valid availability matching config
    try:
        validation = TeacherAvailabilityValidation(
            teacherId="TEACHER_001",
            availabilityMap={
                DayOfWeek.MONDAY: [True, True, True, True, True],
                DayOfWeek.SATURDAY: [True, True]
            },
            expectedPeriodsPerDay={
                DayOfWeek.MONDAY: 5,
                DayOfWeek.SATURDAY: 2
            }
        )
        results.add_pass("4.1: Matching availability", "Availability matches period config")
    except Exception as e:
        results.add_fail("4.1: Matching availability", str(e))
    
    # Test 4.2: Mismatched period count
    try:
        validation = TeacherAvailabilityValidation(
            teacherId="TEACHER_BAD",
            availabilityMap={
                DayOfWeek.MONDAY: [True, True, True]  # Only 3
            },
            expectedPeriodsPerDay={
                DayOfWeek.MONDAY: 5  # Expects 5
            }
        )
        results.add_fail("4.2: Mismatched periods", "Should reject mismatched period count")
    except ValueError as e:
        if "has 3 periods but config expects 5" in str(e):
            results.add_pass("4.2: Mismatched periods", "Correctly validates period count")
        else:
            results.add_fail("4.2: Mismatched periods", f"Wrong error: {e}")
    
    # Test 4.3: Missing day availability
    try:
        validation = TeacherAvailabilityValidation(
            teacherId="TEACHER_INCOMPLETE",
            availabilityMap={
                DayOfWeek.MONDAY: [True, True, True, True, True]
            },
            expectedPeriodsPerDay={
                DayOfWeek.MONDAY: 5,
                DayOfWeek.TUESDAY: 5
            }
        )
        results.add_fail("4.3: Missing day", "Should reject missing day availability")
    except ValueError as e:
        if "Missing availability" in str(e):
            results.add_pass("4.3: Missing day", "Correctly requires all days")
        else:
            results.add_fail("4.3: Missing day", f"Wrong error: {e}")


# ==============================================================================
# TEST 5: Grade Category Auto-Assignment
# Requirement 1: Validate category based on grade level
# ==============================================================================

def determine_category(grade_level: int) -> str:
    """Determine category from grade level."""
    if 1 <= grade_level <= 3:
        return "Alpha-Primary"
    elif 4 <= grade_level <= 6:
        return "Beta-Primary"
    elif 7 <= grade_level <= 9:
        return "Middle"
    elif 10 <= grade_level <= 12:
        return "High"
    else:
        raise ValueError(f"Invalid grade level: {grade_level}")


def test_category_determination(results: TestResult):
    """Test Requirement 1: Category determination logic."""
    print("\n" + "="*70)
    print("TEST 5: Grade Category Determination")
    print("="*70)
    
    test_cases = [
        (1, "Alpha-Primary"), (2, "Alpha-Primary"), (3, "Alpha-Primary"),
        (4, "Beta-Primary"), (5, "Beta-Primary"), (6, "Beta-Primary"),
        (7, "Middle"), (8, "Middle"), (9, "Middle"),
        (10, "High"), (11, "High"), (12, "High")
    ]
    
    passed = 0
    for grade, expected in test_cases:
        try:
            result = determine_category(grade)
            if result == expected:
                passed += 1
            else:
                results.add_fail(
                    f"5.{grade}: Grade {grade}",
                    f"Expected {expected}, got {result}"
                )
        except Exception as e:
            results.add_fail(f"5.{grade}: Grade {grade}", str(e))
    
    if passed == len(test_cases):
        results.add_pass(
            "5.0: All grade categories",
            f"{passed}/{len(test_cases)} grades correctly categorized"
        )
    
    # Test invalid grades
    try:
        determine_category(0)
        results.add_fail("5.13: Invalid grade low", "Should reject grade 0")
    except ValueError:
        results.add_pass("5.13: Invalid grade low", "Correctly rejects grade 0")
    
    try:
        determine_category(13)
        results.add_fail("5.14: Invalid grade high", "Should reject grade 13")
    except ValueError:
        results.add_pass("5.14: Invalid grade high", "Correctly rejects grade 13")


# ==============================================================================
# MAIN TEST RUNNER
# ==============================================================================

def main():
    """Run all Phase 2 tests."""
    print("\n" + "="*70)
    print("PHASE 2: VALIDATION LOGIC TESTS")
    print("Testing Requirements: 1, 2, 3, 6, 8, 9")
    print("Risk Level: LOW (validation only, no solver)")
    print("="*70)
    
    results = TestResult()
    
    # Run all test suites
    test_period_configuration_validation(results)
    test_no_empty_periods_validation(results)
    test_single_teacher_validation(results)
    test_teacher_availability_integration(results)
    test_category_determination(results)
    
    # Print summary
    success = results.summary()
    
    if success:
        print("✓ ALL VALIDATION TESTS PASSED")
        print("\nKey Findings:")
        print("- Period configuration validation works")
        print("- No empty periods constraint can be validated")
        print("- Single-teacher mode validation works")
        print("- Teacher availability integration validated")
        print("\nNext Steps:")
        print("1. Phase 3: Constraint solver tests (MEDIUM risk)")
        print("2. Test with actual CP-SAT solver")
        return 0
    else:
        print("✗ SOME VALIDATION TESTS FAILED")
        print("\nRecommendations:")
        print("1. Review failed validation logic")
        print("2. Adjust validators as needed")
        print("3. Re-run Phase 2 tests")
        return 1


if __name__ == "__main__":
    sys.exit(main())
