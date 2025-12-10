"""
Property-based tests for grade category validity.

Tests the grade category determination logic to ensure it always returns
valid categories for grades 1-12.
"""

import pytest
from hypothesis import given, strategies as st

from models.input import ClassGroup, SubjectRequirement


def get_category_from_grade(grade_level: int) -> str:
    """
    Determine category from grade level using the same logic as ClassGroup.
    
    Args:
        grade_level: Grade level (1-12)
        
    Returns:
        Category string
    """
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


class TestGradeCategoryValidity:
    """Property tests for grade category validity."""
    
    # **Feature: solver-refactoring, Property 18: Grade Category Validity**
    @given(st.integers(min_value=1, max_value=12))
    def test_grade_category_always_valid(self, grade: int):
        """For any grade 1-12, category must be one of the four valid values."""
        valid_categories = {"Alpha-Primary", "Beta-Primary", "Middle", "High"}
        
        category = get_category_from_grade(grade)
        
        assert category in valid_categories, (
            f"Grade {grade} produced invalid category '{category}'. "
            f"Must be one of: {valid_categories}"
        )
    
    # **Feature: solver-refactoring, Property 18: Grade Category Validity**
    @given(st.integers(min_value=1, max_value=12))
    def test_class_group_category_determination(self, grade: int):
        """For any grade 1-12, ClassGroup should auto-determine correct category."""
        valid_categories = {"Alpha-Primary", "Beta-Primary", "Middle", "High"}
        
        # Create a minimal ClassGroup with the grade level
        class_group = ClassGroup(
            id=f"class_{grade}",
            name=f"Grade {grade}",
            studentCount=25,
            subjectRequirements={"math": SubjectRequirement(periodsPerWeek=5)},
            gradeLevel=grade
        )
        
        # The model_validator should auto-determine the category
        assert class_group.category in valid_categories, (
            f"Grade {grade} produced invalid category '{class_group.category}'. "
            f"Must be one of: {valid_categories}"
        )
    
    # **Feature: solver-refactoring, Property 18: Grade Category Validity**
    @given(st.integers(min_value=1, max_value=3))
    def test_alpha_primary_range(self, grade: int):
        """For grades 1-3, category should be Alpha-Primary."""
        category = get_category_from_grade(grade)
        assert category == "Alpha-Primary", (
            f"Grade {grade} should be Alpha-Primary, got '{category}'"
        )
    
    # **Feature: solver-refactoring, Property 18: Grade Category Validity**
    @given(st.integers(min_value=4, max_value=6))
    def test_beta_primary_range(self, grade: int):
        """For grades 4-6, category should be Beta-Primary."""
        category = get_category_from_grade(grade)
        assert category == "Beta-Primary", (
            f"Grade {grade} should be Beta-Primary, got '{category}'"
        )
    
    # **Feature: solver-refactoring, Property 18: Grade Category Validity**
    @given(st.integers(min_value=7, max_value=9))
    def test_middle_range(self, grade: int):
        """For grades 7-9, category should be Middle."""
        category = get_category_from_grade(grade)
        assert category == "Middle", (
            f"Grade {grade} should be Middle, got '{category}'"
        )
    
    # **Feature: solver-refactoring, Property 18: Grade Category Validity**
    @given(st.integers(min_value=10, max_value=12))
    def test_high_range(self, grade: int):
        """For grades 10-12, category should be High."""
        category = get_category_from_grade(grade)
        assert category == "High", (
            f"Grade {grade} should be High, got '{category}'"
        )
    
    # **Feature: solver-refactoring, Property 18: Grade Category Validity**
    @given(st.integers().filter(lambda x: x < 1 or x > 12))
    def test_invalid_grades_raise_error(self, invalid_grade: int):
        """For grades outside 1-12, should raise ValueError."""
        with pytest.raises(ValueError, match="Invalid grade level"):
            get_category_from_grade(invalid_grade)