# ==============================================================================
#
#  Unit Tests for Soft Constraints
#
#  Tests penalty variable creation and weight application for soft constraints.
#  Requirements: 1.5
#
# ==============================================================================

import pytest
from unittest.mock import MagicMock, patch
from ortools.sat.python import cp_model

from constraints.soft.morning_difficult import PreferMorningForDifficultConstraint
from constraints.soft.teacher_gaps import AvoidTeacherGapsConstraint
from constraints.soft.subject_spread import SubjectSpreadConstraint
from constraints.registry import ConstraintRegistry, ConstraintStage


# ==============================================================================
# Fixtures
# ==============================================================================

@pytest.fixture
def cp_model_instance():
    """Create a fresh CP-SAT model for testing."""
    return cp_model.CpModel()


@pytest.fixture
def mock_preferences():
    """Create mock preferences with default weights."""
    prefs = MagicMock()
    prefs.preferMorningForDifficultWeight = 0.5
    prefs.avoidTeacherGapsWeight = 1.0
    prefs.subjectSpreadWeight = 0.5
    return prefs


@pytest.fixture
def mock_data(mock_preferences):
    """Create mock TimetableData."""
    data = MagicMock()
    data.preferences = mock_preferences
    
    # Create mock subjects
    difficult_subject = MagicMock()
    difficult_subject.isDifficult = True
    
    easy_subject = MagicMock()
    easy_subject.isDifficult = False
    
    data.subjects = [difficult_subject, easy_subject]
    
    # Create mock teachers
    teacher = MagicMock()
    teacher.id = "T1"
    data.teachers = [teacher]
    
    return data


@pytest.fixture
def basic_context(cp_model_instance, mock_data):
    """Create a basic context for constraint testing."""
    model = cp_model_instance
    
    # Create start variables for 3 requests
    start_vars = {
        0: model.NewIntVar(0, 39, 'start_0'),  # 5 days * 8 periods = 40 slots
        1: model.NewIntVar(0, 39, 'start_1'),
        2: model.NewIntVar(0, 39, 'start_2'),
    }
    
    # Create teacher variables
    teacher_vars = {
        0: model.NewIntVar(0, 0, 'teacher_0'),
        1: model.NewIntVar(0, 0, 'teacher_1'),
        2: model.NewIntVar(0, 0, 'teacher_2'),
    }
    
    requests = [
        {'class_id': 'C1', 'subject_id': 'S1', 'teacher_ids': ['T1']},
        {'class_id': 'C1', 'subject_id': 'S1', 'teacher_ids': ['T1']},
        {'class_id': 'C1', 'subject_id': 'S2', 'teacher_ids': ['T1']},
    ]
    
    return {
        'data': mock_data,
        'requests': requests,
        'start_vars': start_vars,
        'teacher_vars': teacher_vars,
        'subject_map': {'S1': 0, 'S2': 1},
        'teacher_map': {'T1': 0},
        'num_days': 5,
        'num_periods_per_day': 8,
    }


# ==============================================================================
# PreferMorningForDifficultConstraint Tests
# ==============================================================================

class TestPreferMorningForDifficultConstraint:
    """Tests for PreferMorningForDifficultConstraint."""

    def test_constraint_initialization(self):
        """Constraint should initialize with correct properties."""
        constraint = PreferMorningForDifficultConstraint()
        
        assert constraint.name == "prefer_morning_difficult"
        assert constraint.is_hard is False
        assert constraint.weight == PreferMorningForDifficultConstraint.DEFAULT_WEIGHT
        assert constraint.enabled is True

    def test_custom_weight_initialization(self):
        """Constraint should accept custom weight."""
        constraint = PreferMorningForDifficultConstraint(weight=100)
        assert constraint.weight == 100

    def test_apply_creates_penalty_variables(self, cp_model_instance, basic_context):
        """Apply should create penalty variables for difficult subjects."""
        constraint = PreferMorningForDifficultConstraint()
        
        penalties = constraint.apply(cp_model_instance, basic_context)
        
        # Should have penalties for requests with difficult subjects (S1 -> index 0)
        # Requests 0 and 1 have subject S1 which is difficult
        assert penalties is not None
        assert len(penalties) == 2  # Two requests with difficult subject

    def test_apply_no_penalties_for_easy_subjects(self, cp_model_instance, basic_context):
        """Apply should not create penalties for non-difficult subjects."""
        # Make all subjects non-difficult
        basic_context['data'].subjects[0].isDifficult = False
        basic_context['data'].subjects[1].isDifficult = False
        
        constraint = PreferMorningForDifficultConstraint()
        penalties = constraint.apply(cp_model_instance, basic_context)
        
        assert penalties == []

    def test_apply_respects_zero_weight(self, cp_model_instance, basic_context):
        """Apply should return empty list when weight is zero."""
        basic_context['data'].preferences.preferMorningForDifficultWeight = 0.0
        
        constraint = PreferMorningForDifficultConstraint()
        penalties = constraint.apply(cp_model_instance, basic_context)
        
        assert penalties == []

    def test_should_apply_returns_false_when_disabled(self, basic_context):
        """should_apply should return False when constraint is disabled."""
        constraint = PreferMorningForDifficultConstraint()
        constraint.disable()
        
        assert constraint.should_apply(basic_context) is False

    def test_should_apply_returns_false_when_weight_zero(self, basic_context):
        """should_apply should return False when weight is zero."""
        basic_context['data'].preferences.preferMorningForDifficultWeight = 0.0
        
        constraint = PreferMorningForDifficultConstraint()
        assert constraint.should_apply(basic_context) is False

    def test_should_apply_returns_true_with_positive_weight(self, basic_context):
        """should_apply should return True when weight is positive."""
        constraint = PreferMorningForDifficultConstraint()
        assert constraint.should_apply(basic_context) is True

    def test_apply_handles_missing_data(self, cp_model_instance):
        """Apply should handle missing data gracefully."""
        constraint = PreferMorningForDifficultConstraint()
        
        penalties = constraint.apply(cp_model_instance, {})
        assert penalties == []

    def test_apply_handles_empty_requests(self, cp_model_instance, mock_data):
        """Apply should handle empty requests list."""
        constraint = PreferMorningForDifficultConstraint()
        
        context = {
            'data': mock_data,
            'requests': [],
            'start_vars': {},
        }
        
        penalties = constraint.apply(cp_model_instance, context)
        assert penalties == []


# ==============================================================================
# AvoidTeacherGapsConstraint Tests
# ==============================================================================

class TestAvoidTeacherGapsConstraint:
    """Tests for AvoidTeacherGapsConstraint."""

    def test_constraint_initialization(self):
        """Constraint should initialize with correct properties."""
        constraint = AvoidTeacherGapsConstraint()
        
        assert constraint.name == "avoid_teacher_gaps"
        assert constraint.is_hard is False
        assert constraint.weight == AvoidTeacherGapsConstraint.DEFAULT_WEIGHT
        assert constraint.enabled is True

    def test_custom_weight_initialization(self):
        """Constraint should accept custom weight."""
        constraint = AvoidTeacherGapsConstraint(weight=200)
        assert constraint.weight == 200

    def test_apply_creates_penalty_variables(self, cp_model_instance, basic_context):
        """Apply should create penalty variables for teacher gaps."""
        constraint = AvoidTeacherGapsConstraint()
        
        penalties = constraint.apply(cp_model_instance, basic_context)
        
        # Should have penalties for pairs of requests with same teacher
        # 3 requests with same teacher = 3 pairs (0-1, 0-2, 1-2)
        assert penalties is not None
        assert len(penalties) == 3

    def test_apply_no_penalties_for_single_request(self, cp_model_instance, basic_context):
        """Apply should not create penalties when teacher has only one request."""
        # Keep only one request
        basic_context['requests'] = [basic_context['requests'][0]]
        basic_context['start_vars'] = {0: basic_context['start_vars'][0]}
        basic_context['teacher_vars'] = {0: basic_context['teacher_vars'][0]}
        
        constraint = AvoidTeacherGapsConstraint()
        penalties = constraint.apply(cp_model_instance, basic_context)
        
        assert penalties == []

    def test_apply_respects_zero_weight(self, cp_model_instance, basic_context):
        """Apply should return empty list when weight is zero."""
        basic_context['data'].preferences.avoidTeacherGapsWeight = 0.0
        
        constraint = AvoidTeacherGapsConstraint()
        penalties = constraint.apply(cp_model_instance, basic_context)
        
        assert penalties == []

    def test_should_apply_returns_false_when_disabled(self, basic_context):
        """should_apply should return False when constraint is disabled."""
        constraint = AvoidTeacherGapsConstraint()
        constraint.disable()
        
        assert constraint.should_apply(basic_context) is False

    def test_should_apply_returns_true_with_positive_weight(self, basic_context):
        """should_apply should return True when weight is positive."""
        constraint = AvoidTeacherGapsConstraint()
        assert constraint.should_apply(basic_context) is True

    def test_apply_handles_missing_data(self, cp_model_instance):
        """Apply should handle missing data gracefully."""
        constraint = AvoidTeacherGapsConstraint()
        
        penalties = constraint.apply(cp_model_instance, {})
        assert penalties == []


# ==============================================================================
# SubjectSpreadConstraint Tests
# ==============================================================================

class TestSubjectSpreadConstraint:
    """Tests for SubjectSpreadConstraint."""

    def test_constraint_initialization(self):
        """Constraint should initialize with correct properties."""
        constraint = SubjectSpreadConstraint()
        
        assert constraint.name == "subject_spread"
        assert constraint.is_hard is False
        assert constraint.weight == SubjectSpreadConstraint.DEFAULT_WEIGHT
        assert constraint.enabled is True

    def test_custom_weight_initialization(self):
        """Constraint should accept custom weight."""
        constraint = SubjectSpreadConstraint(weight=75)
        assert constraint.weight == 75

    def test_apply_creates_penalty_variables(self, cp_model_instance, basic_context):
        """Apply should create penalty variables for same-day subject clustering."""
        constraint = SubjectSpreadConstraint()
        
        penalties = constraint.apply(cp_model_instance, basic_context)
        
        # Requests 0 and 1 have same class_id and subject_id (C1, S1)
        # So there should be 1 penalty for this pair
        assert penalties is not None
        assert len(penalties) == 1

    def test_apply_no_penalties_for_different_subjects(self, cp_model_instance, basic_context):
        """Apply should not create penalties when subjects are different."""
        # Make all requests have different subjects
        basic_context['requests'] = [
            {'class_id': 'C1', 'subject_id': 'S1', 'teacher_ids': ['T1']},
            {'class_id': 'C1', 'subject_id': 'S2', 'teacher_ids': ['T1']},
            {'class_id': 'C1', 'subject_id': 'S3', 'teacher_ids': ['T1']},
        ]
        
        constraint = SubjectSpreadConstraint()
        penalties = constraint.apply(cp_model_instance, basic_context)
        
        assert penalties == []

    def test_apply_no_penalties_for_different_classes(self, cp_model_instance, basic_context):
        """Apply should not create penalties when classes are different."""
        # Make all requests have different classes
        basic_context['requests'] = [
            {'class_id': 'C1', 'subject_id': 'S1', 'teacher_ids': ['T1']},
            {'class_id': 'C2', 'subject_id': 'S1', 'teacher_ids': ['T1']},
            {'class_id': 'C3', 'subject_id': 'S1', 'teacher_ids': ['T1']},
        ]
        
        constraint = SubjectSpreadConstraint()
        penalties = constraint.apply(cp_model_instance, basic_context)
        
        assert penalties == []

    def test_apply_respects_zero_weight(self, cp_model_instance, basic_context):
        """Apply should return empty list when weight is zero."""
        basic_context['data'].preferences.subjectSpreadWeight = 0.0
        
        constraint = SubjectSpreadConstraint()
        penalties = constraint.apply(cp_model_instance, basic_context)
        
        assert penalties == []

    def test_should_apply_returns_false_when_disabled(self, basic_context):
        """should_apply should return False when constraint is disabled."""
        constraint = SubjectSpreadConstraint()
        constraint.disable()
        
        assert constraint.should_apply(basic_context) is False

    def test_should_apply_returns_false_when_weight_zero(self, basic_context):
        """should_apply should return False when weight is zero."""
        basic_context['data'].preferences.subjectSpreadWeight = 0.0
        
        constraint = SubjectSpreadConstraint()
        assert constraint.should_apply(basic_context) is False

    def test_should_apply_returns_true_with_positive_weight(self, basic_context):
        """should_apply should return True when weight is positive."""
        constraint = SubjectSpreadConstraint()
        assert constraint.should_apply(basic_context) is True

    def test_apply_handles_missing_data(self, cp_model_instance):
        """Apply should handle missing data gracefully."""
        constraint = SubjectSpreadConstraint()
        
        penalties = constraint.apply(cp_model_instance, {})
        assert penalties == []

    def test_multiple_pairs_same_class_subject(self, cp_model_instance, basic_context):
        """Apply should create penalties for all pairs of same class-subject."""
        # 4 requests with same class and subject = 6 pairs
        basic_context['requests'] = [
            {'class_id': 'C1', 'subject_id': 'S1', 'teacher_ids': ['T1']},
            {'class_id': 'C1', 'subject_id': 'S1', 'teacher_ids': ['T1']},
            {'class_id': 'C1', 'subject_id': 'S1', 'teacher_ids': ['T1']},
            {'class_id': 'C1', 'subject_id': 'S1', 'teacher_ids': ['T1']},
        ]
        basic_context['start_vars'] = {
            i: cp_model_instance.NewIntVar(0, 39, f'start_{i}')
            for i in range(4)
        }
        
        constraint = SubjectSpreadConstraint()
        penalties = constraint.apply(cp_model_instance, basic_context)
        
        # 4 choose 2 = 6 pairs
        assert len(penalties) == 6


# ==============================================================================
# Registration Tests
# ==============================================================================

class TestSoftConstraintRegistration:
    """Tests for soft constraint registration functions."""

    def test_register_soft_constraints(self):
        """register_soft_constraints should register all soft constraints."""
        from constraints.soft import register_soft_constraints
        
        registry = ConstraintRegistry()
        register_soft_constraints(registry)
        
        # Should have 3 soft constraints registered
        important_constraints = registry.get_constraints(ConstraintStage.IMPORTANT)
        
        constraint_names = [c.name for c in important_constraints]
        assert "prefer_morning_difficult" in constraint_names
        assert "avoid_teacher_gaps" in constraint_names
        assert "subject_spread" in constraint_names

    def test_individual_registration_functions(self):
        """Individual registration functions should work correctly."""
        from constraints.soft.morning_difficult import register_morning_difficult_constraint
        from constraints.soft.teacher_gaps import register_teacher_gaps_constraint
        from constraints.soft.subject_spread import register_subject_spread_constraint
        
        registry = ConstraintRegistry()
        
        register_morning_difficult_constraint(registry)
        assert registry.get_constraint_by_name("prefer_morning_difficult") is not None
        
        register_teacher_gaps_constraint(registry)
        assert registry.get_constraint_by_name("avoid_teacher_gaps") is not None
        
        register_subject_spread_constraint(registry)
        assert registry.get_constraint_by_name("subject_spread") is not None

    def test_soft_constraints_are_not_hard(self):
        """All soft constraints should have is_hard=False."""
        from constraints.soft import register_soft_constraints
        
        registry = ConstraintRegistry()
        register_soft_constraints(registry)
        
        for constraint in registry.get_constraints():
            if constraint.name in ["prefer_morning_difficult", "avoid_teacher_gaps", "subject_spread"]:
                assert constraint.is_hard is False
