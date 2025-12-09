"""
Test Suite for CHUNK 8: No Empty Periods Constraint

Tests the implementation of the hard constraint that prevents empty periods in schedules.
All periods must be filled with lessons - no gaps allowed (Afghanistan school requirement).
"""

import pytest
import json
from solver_enhanced import solve

def create_test_data_perfect_allocation():
    """
    Create test data with perfect period allocation (27 periods = 27 required).
    Afghanistan standard: 5+5+5+5+5+2 = 27 periods per week.
    """
    return {
        "config": {
            "daysOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
            "periodsPerDayMap": {
                "Monday": 5,
                "Tuesday": 5,
                "Wednesday": 5,
                "Thursday": 5,
                "Friday": 5,
                "Saturday": 2
            },
            "periodsPerDay": 5,  # Default if map not used
            "breakPeriods": []
        },
        "rooms": [
            {"id": "ROOM_001", "name": "Room 1-A", "capacity": 30}
        ],
        "subjects": [
            {"id": "SUBJ_MATH", "name": "Mathematics", "isCustom": False},
            {"id": "SUBJ_DARI", "name": "Dari Language", "isCustom": False},
            {"id": "SUBJ_PASHTO", "name": "Pashto Language", "isCustom": False},
            {"id": "SUBJ_SCIENCE", "name": "Science", "isCustom": False},
            {"id": "SUBJ_ISLAMIC", "name": "Islamic Studies", "isCustom": False},
            {"id": "SUBJ_ARTS", "name": "Arts", "isCustom": False},
            {"id": "SUBJ_PE", "name": "Physical Education", "isCustom": False}
        ],
        "teachers": [
            {
                "id": "TEACHER_001",
                "fullName": "Ahmad Karimi",
                "primarySubjectIds": ["SUBJ_MATH", "SUBJ_DARI", "SUBJ_PASHTO", "SUBJ_SCIENCE", "SUBJ_ISLAMIC", "SUBJ_ARTS", "SUBJ_PE"],
                "maxPeriodsPerWeek": 30,
                "availability": {
                    "Monday": [True] * 5,
                    "Tuesday": [True] * 5,
                    "Wednesday": [True] * 5,
                    "Thursday": [True] * 5,
                    "Friday": [True] * 5,
                    "Saturday": [True] * 2
                }
            }
        ],
        "classes": [
            {
                "id": "CLASS_001",
                "name": "Class 1-A",
                "gradeLevel": 1,
                "category": "Alpha-Primary",
                "studentCount": 25,
                "singleTeacherMode": True,
                "classTeacherId": "TEACHER_001",
                "subjectRequirements": {
                    # Total: 5+5+4+4+4+3+2 = 27 periods (perfect match!)
                    "SUBJ_MATH": {"periodsPerWeek": 5},
                    "SUBJ_DARI": {"periodsPerWeek": 5},
                    "SUBJ_PASHTO": {"periodsPerWeek": 4},
                    "SUBJ_SCIENCE": {"periodsPerWeek": 4},
                    "SUBJ_ISLAMIC": {"periodsPerWeek": 4},
                    "SUBJ_ARTS": {"periodsPerWeek": 3},
                    "SUBJ_PE": {"periodsPerWeek": 2}
                }
            }
        ]
    }

def create_test_data_under_allocation():
    """
    Create test data with under-allocation (only 20 periods required out of 27 available).
    This should FAIL validation with helpful error message.
    """
    data = create_test_data_perfect_allocation()
    # Only allocate 20 periods instead of 27
    data["classes"][0]["subjectRequirements"] = {
        "SUBJ_MATH": {"periodsPerWeek": 10},
        "SUBJ_DARI": {"periodsPerWeek": 10}
    }
    return data

def create_test_data_over_allocation():
    """
    Create test data with over-allocation (30 periods required but only 27 available).
    This should FAIL validation with helpful error message.
    """
    data = create_test_data_perfect_allocation()
    # Allocate 30 periods instead of 27
    data["classes"][0]["subjectRequirements"] = {
        "SUBJ_MATH": {"periodsPerWeek": 10},
        "SUBJ_DARI": {"periodsPerWeek": 10},
        "SUBJ_PASHTO": {"periodsPerWeek": 10}
    }
    return data


class TestNoEmptyPeriodsValidation:
    """Test pre-solve validation (Task 8.1)"""
    
    def test_perfect_allocation_passes_validation(self):
        """Test that perfect allocation (27=27) passes validation."""
        data = create_test_data_perfect_allocation()
        
        # Should not raise any errors during validation
        try:
            solution = solve(data)
            assert solution is not None
            print("✓ Perfect allocation passed validation")
        except ValueError as e:
            pytest.fail(f"Perfect allocation should not raise error: {e}")
    
    def test_under_allocation_rejected(self):
        """Test that under-allocation (20<27) is rejected with helpful error."""
        data = create_test_data_under_allocation()
        
        with pytest.raises(ValueError) as exc_info:
            solve(data)
        
        error_msg = str(exc_info.value).lower()
        assert "empty period" in error_msg or "empty periods" in error_msg
        assert "class 1-a" in error_msg
        assert "7" in error_msg  # Should mention the 7-period gap
        
        print(f"✓ Under-allocation correctly rejected: {exc_info.value}")
    
    def test_over_allocation_rejected(self):
        """Test that over-allocation (30>27) is rejected with helpful error."""
        data = create_test_data_over_allocation()
        
        with pytest.raises(ValueError) as exc_info:
            solve(data)
        
        error_msg = str(exc_info.value).lower()
        assert "over-allocation" in error_msg or "over" in error_msg or "excess" in error_msg
        assert "class 1-a" in error_msg
        assert "3" in error_msg  # Should mention the 3-period excess
        
        print(f"✓ Over-allocation correctly rejected: {exc_info.value}")


class TestNoEmptyPeriodsConstraint:
    """Test hard constraint enforcement (Task 8.2)"""
    
    def test_all_periods_filled(self):
        """Test that generated schedule has ALL periods filled - no gaps."""
        data = create_test_data_perfect_allocation()
        
        solution = solve(data)
        
        # Extract schedule from metadata structure (Sub-Chunk 7.1 format)
        if isinstance(solution, dict) and "schedule" in solution:
            schedule = solution["schedule"]
        else:
            schedule = solution
        
        # Group lessons by day
        lessons_by_day = {}
        for lesson in schedule:
            if lesson["classId"] == "CLASS_001":
                day = lesson["day"]
                if day not in lessons_by_day:
                    lessons_by_day[day] = []
                lessons_by_day[day].append(lesson["periodIndex"])
        
        # Check each day has correct number of periods
        expected_periods = {
            "Monday": 5, "Tuesday": 5, "Wednesday": 5,
            "Thursday": 5, "Friday": 5, "Saturday": 2
        }
        
        for day, expected_count in expected_periods.items():
            actual_count = len(lessons_by_day.get(day, []))
            assert actual_count == expected_count, \
                f"Day {day}: Expected {expected_count} periods, got {actual_count}"
        
        # Check total lessons = 27
        total_lessons = sum(len(periods) for periods in lessons_by_day.values())
        assert total_lessons == 27, f"Expected 27 total lessons, got {total_lessons}"
        
        # Check no duplicate periods (no overlaps)
        for day, periods in lessons_by_day.items():
            unique_periods = set(periods)
            assert len(unique_periods) == len(periods), \
                f"Day {day} has duplicate periods: {periods}"
        
        # Check periods are consecutive (0, 1, 2, ... no gaps)
        for day, periods in lessons_by_day.items():
            sorted_periods = sorted(periods)
            expected_sequence = list(range(expected_periods[day]))
            assert sorted_periods == expected_sequence, \
                f"Day {day} has gaps! Expected {expected_sequence}, got {sorted_periods}"
        
        print("✓ All 27 periods filled - no empty periods!")
        print(f"  Schedule breakdown: {dict((k, len(v)) for k, v in lessons_by_day.items())}")
    
    def test_multiple_classes_all_filled(self):
        """Test multiple classes all have no empty periods."""
        data = create_test_data_perfect_allocation()
        
        # Add a second class
        data["classes"].append({
            "id": "CLASS_002",
            "name": "Class 1-B",
            "gradeLevel": 1,
            "category": "Alpha-Primary",
            "studentCount": 28,
            "singleTeacherMode": True,
            "classTeacherId": "TEACHER_001",
            "subjectRequirements": data["classes"][0]["subjectRequirements"]
        })
        
        # Add second room
        data["rooms"].append({"id": "ROOM_002", "name": "Room 1-B", "capacity": 30})
        
        # Increase teacher capacity
        data["teachers"][0]["maxPeriodsPerWeek"] = 60
        
        solution = solve(data)
        
        # Extract schedule
        if isinstance(solution, dict) and "schedule" in solution:
            schedule = solution["schedule"]
        else:
            schedule = solution
        
        # Check both classes have 27 lessons each
        class_001_lessons = [l for l in schedule if l["classId"] == "CLASS_001"]
        class_002_lessons = [l for l in schedule if l["classId"] == "CLASS_002"]
        
        assert len(class_001_lessons) == 27, f"Class 1-A should have 27 lessons, got {len(class_001_lessons)}"
        assert len(class_002_lessons) == 27, f"Class 1-B should have 27 lessons, got {len(class_002_lessons)}"
        
        print("✓ Multiple classes: All periods filled for all classes!")


class TestEdgeCases:
    """Test edge cases and special scenarios"""
    
    def test_single_period_day(self):
        """Test that single-period days work correctly (e.g., special Saturday schedule)."""
        data = create_test_data_perfect_allocation()
        
        # Modify to have only 1 period on Saturday
        data["config"]["periodsPerDayMap"]["Saturday"] = 1
        
        # Adjust requirements to match (26 total)
        data["classes"][0]["subjectRequirements"] = {
            "SUBJ_MATH": {"periodsPerWeek": 5},
            "SUBJ_DARI": {"periodsPerWeek": 5},
            "SUBJ_PASHTO": {"periodsPerWeek": 4},
            "SUBJ_SCIENCE": {"periodsPerWeek": 4},
            "SUBJ_ISLAMIC": {"periodsPerWeek": 4},
            "SUBJ_ARTS": {"periodsPerWeek": 3},
            "SUBJ_PE": {"periodsPerWeek": 1}  # Reduced by 1
        }
        
        # Adjust teacher availability
        data["teachers"][0]["availability"]["Saturday"] = [True]
        
        solution = solve(data)
        
        # Extract schedule
        if isinstance(solution, dict) and "schedule" in solution:
            schedule = solution["schedule"]
        else:
            schedule = solution
        
        # Check Saturday has exactly 1 lesson
        saturday_lessons = [l for l in schedule if l["classId"] == "CLASS_001" and l["day"] == "Saturday"]
        assert len(saturday_lessons) == 1, f"Saturday should have 1 lesson, got {len(saturday_lessons)}"
        
        print("✓ Single-period day handled correctly!")
    
    def test_error_message_quality(self):
        """Test that error messages are helpful and actionable."""
        data = create_test_data_under_allocation()
        
        try:
            solve(data)
            pytest.fail("Should have raised ValueError")
        except ValueError as e:
            error_msg = str(e)
            
            # Check error message contains helpful information
            assert "Empty Periods Error" in error_msg or "empty period" in error_msg.lower()
            assert "Class 1-A" in error_msg or "CLASS_001" in error_msg
            assert "Suggestions:" in error_msg or "suggestion" in error_msg.lower()
            
            # Should mention how many empty periods
            assert "7" in error_msg
            
            # Should suggest solutions
            suggests_add_periods = "add" in error_msg.lower() and "period" in error_msg.lower()
            suggests_new_subjects = "new subject" in error_msg.lower()
            suggests_reduce_schedule = "reduce" in error_msg.lower() or "remove" in error_msg.lower()
            
            assert suggests_add_periods or suggests_new_subjects or suggests_reduce_schedule, \
                "Error should suggest at least one solution"
            
            print(f"✓ Error message is helpful and actionable!")
            print(f"   Error preview: {error_msg[:200]}...")


def test_chunk_8_integration():
    """Integration test for entire CHUNK 8 implementation."""
    print("\n" + "=" * 70)
    print("CHUNK 8 INTEGRATION TEST: No Empty Periods Constraint")
    print("=" * 70)
    
    # Test 1: Perfect allocation
    print("\n1. Testing perfect allocation (27=27)...")
    data = create_test_data_perfect_allocation()
    solution = solve(data)
    assert solution is not None
    print("   ✅ PASS: Perfect allocation works")
    
    # Test 2: Under-allocation rejection
    print("\n2. Testing under-allocation rejection (20<27)...")
    data_under = create_test_data_under_allocation()
    try:
        solve(data_under)
        assert False, "Should have raised error"
    except ValueError as e:
        assert "empty period" in str(e).lower()
        print(f"   ✅ PASS: Under-allocation rejected")
    
    # Test 3: Over-allocation rejection
    print("\n3. Testing over-allocation rejection (30>27)...")
    data_over = create_test_data_over_allocation()
    try:
        solve(data_over)
        assert False, "Should have raised error"
    except ValueError as e:
        assert "over" in str(e).lower() or "excess" in str(e).lower()
        print(f"   ✅ PASS: Over-allocation rejected")
    
    # Test 4: All periods filled
    print("\n4. Verifying all periods are filled in generated schedule...")
    data = create_test_data_perfect_allocation()
    solution = solve(data)
    
    if isinstance(solution, dict) and "schedule" in solution:
        schedule = solution["schedule"]
    else:
        schedule = solution
    
    class_lessons = [l for l in schedule if l["classId"] == "CLASS_001"]
    assert len(class_lessons) == 27, f"Expected 27 lessons, got {len(class_lessons)}"
    print(f"   ✅ PASS: All 27 periods filled")
    
    print("\n" + "=" * 70)
    print("✅ CHUNK 8 INTEGRATION TEST: ALL TESTS PASSED!")
    print("=" * 70)
    print("\nCHUNK 8 IMPLEMENTATION COMPLETE:")
    print("  ✅ Pre-solve validation catches mismatches")
    print("  ✅ Helpful error messages with suggestions")
    print("  ✅ Hard constraint ensures no empty periods")
    print("  ✅ Generated schedules have zero gaps")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    # Run integration test
    test_chunk_8_integration()
    
    print("\nRunning detailed pytest suite...")
    pytest.main([__file__, "-v", "-s"])
