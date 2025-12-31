# ==============================================================================
# Property Tests: Progress Reporter
#
# Tests for progress update format and correctness.
#
# **Feature: solver-ux-feedback, Property 10: Progress Update Format**
# **Validates: Requirements 5.1, 5.2, 5.5**
#
# ==============================================================================

import io
import json
import sys
import time
from contextlib import redirect_stdout
from typing import Optional

import pytest
from hypothesis import given, strategies as st, settings, assume

from feedback.progress_reporter import (
    SolveStage,
    STAGE_FARSI,
    STAGE_PERCENT_RANGES,
    ProgressReporter,
)


# ==============================================================================
# Strategies for generating test data
# ==============================================================================

# Strategy for valid solve stages
solve_stage_strategy = st.sampled_from(list(SolveStage))

# Strategy for percent within stage (0.0 to 1.0)
percent_within_stage_strategy = st.floats(min_value=0.0, max_value=1.0, allow_nan=False)


# ==============================================================================
# Property Tests: Progress Update Format (Property 10)
# ==============================================================================

class TestProgressUpdateFormat:
    """
    **Feature: solver-ux-feedback, Property 10: Progress Update Format**
    **Validates: Requirements 5.1, 5.2, 5.5**
    
    For any progress update emitted by the solver, the update SHALL be valid JSON
    containing stage, stageFarsi, and percentComplete fields, AND stageFarsi SHALL
    be a non-empty Farsi string.
    """

    @given(
        stage=solve_stage_strategy,
        percent_within_stage=percent_within_stage_strategy,
    )
    @settings(max_examples=100)
    def test_progress_update_is_valid_json(
        self,
        stage: SolveStage,
        percent_within_stage: float,
    ):
        """
        **Feature: solver-ux-feedback, Property 10: Progress Update Format**
        **Validates: Requirements 5.1, 5.2, 5.5**
        
        For any stage and percent_within_stage, the emitted progress update
        SHALL be valid JSON.
        """
        reporter = ProgressReporter()
        
        # Capture stdout
        captured_output = io.StringIO()
        with redirect_stdout(captured_output):
            reporter.report_stage(stage, percent_within_stage)
        
        output = captured_output.getvalue().strip()
        
        # Should be valid JSON
        try:
            parsed = json.loads(output)
        except json.JSONDecodeError as e:
            pytest.fail(f"Progress update is not valid JSON: {e}\nOutput: {output}")
        
        assert isinstance(parsed, dict), "Progress update must be a JSON object"

    @given(
        stage=solve_stage_strategy,
        percent_within_stage=percent_within_stage_strategy,
    )
    @settings(max_examples=100)
    def test_progress_update_contains_required_fields(
        self,
        stage: SolveStage,
        percent_within_stage: float,
    ):
        """
        **Feature: solver-ux-feedback, Property 10: Progress Update Format**
        **Validates: Requirements 5.1, 5.2, 5.5**
        
        For any progress update, the JSON SHALL contain type, stage, stageFarsi,
        percentComplete, and estimatedSecondsRemaining fields.
        """
        reporter = ProgressReporter()
        
        # Capture stdout
        captured_output = io.StringIO()
        with redirect_stdout(captured_output):
            reporter.report_stage(stage, percent_within_stage)
        
        output = captured_output.getvalue().strip()
        parsed = json.loads(output)
        
        # Check required fields
        required_fields = ["type", "stage", "stageFarsi", "percentComplete", "estimatedSecondsRemaining"]
        for field in required_fields:
            assert field in parsed, f"Progress update must contain '{field}' field"

    @given(
        stage=solve_stage_strategy,
        percent_within_stage=percent_within_stage_strategy,
    )
    @settings(max_examples=100)
    def test_progress_update_type_is_progress(
        self,
        stage: SolveStage,
        percent_within_stage: float,
    ):
        """
        **Feature: solver-ux-feedback, Property 10: Progress Update Format**
        **Validates: Requirements 5.1**
        
        For any progress update, the type field SHALL be "progress".
        """
        reporter = ProgressReporter()
        
        captured_output = io.StringIO()
        with redirect_stdout(captured_output):
            reporter.report_stage(stage, percent_within_stage)
        
        output = captured_output.getvalue().strip()
        parsed = json.loads(output)
        
        assert parsed["type"] == "progress", "type field must be 'progress'"

    @given(
        stage=solve_stage_strategy,
        percent_within_stage=percent_within_stage_strategy,
    )
    @settings(max_examples=100)
    def test_progress_update_stage_matches_input(
        self,
        stage: SolveStage,
        percent_within_stage: float,
    ):
        """
        **Feature: solver-ux-feedback, Property 10: Progress Update Format**
        **Validates: Requirements 5.2**
        
        For any progress update, the stage field SHALL match the input stage value.
        """
        reporter = ProgressReporter()
        
        captured_output = io.StringIO()
        with redirect_stdout(captured_output):
            reporter.report_stage(stage, percent_within_stage)
        
        output = captured_output.getvalue().strip()
        parsed = json.loads(output)
        
        assert parsed["stage"] == stage.value, f"stage field must be '{stage.value}'"

    @given(
        stage=solve_stage_strategy,
        percent_within_stage=percent_within_stage_strategy,
    )
    @settings(max_examples=100)
    def test_stage_farsi_is_non_empty_string(
        self,
        stage: SolveStage,
        percent_within_stage: float,
    ):
        """
        **Feature: solver-ux-feedback, Property 10: Progress Update Format**
        **Validates: Requirements 5.5**
        
        For any progress update, stageFarsi SHALL be a non-empty Farsi string.
        """
        reporter = ProgressReporter()
        
        captured_output = io.StringIO()
        with redirect_stdout(captured_output):
            reporter.report_stage(stage, percent_within_stage)
        
        output = captured_output.getvalue().strip()
        parsed = json.loads(output)
        
        stage_farsi = parsed["stageFarsi"]
        
        # Must be a string
        assert isinstance(stage_farsi, str), "stageFarsi must be a string"
        
        # Must be non-empty
        assert len(stage_farsi) > 0, "stageFarsi must be non-empty"
        
        # Must match the expected Farsi translation
        assert stage_farsi == STAGE_FARSI[stage], (
            f"stageFarsi must match STAGE_FARSI[{stage}]"
        )

    @given(
        stage=solve_stage_strategy,
        percent_within_stage=percent_within_stage_strategy,
    )
    @settings(max_examples=100)
    def test_percent_complete_is_valid_integer(
        self,
        stage: SolveStage,
        percent_within_stage: float,
    ):
        """
        **Feature: solver-ux-feedback, Property 10: Progress Update Format**
        **Validates: Requirements 5.1, 5.2**
        
        For any progress update, percentComplete SHALL be an integer between 0 and 100.
        """
        reporter = ProgressReporter()
        
        captured_output = io.StringIO()
        with redirect_stdout(captured_output):
            reporter.report_stage(stage, percent_within_stage)
        
        output = captured_output.getvalue().strip()
        parsed = json.loads(output)
        
        percent_complete = parsed["percentComplete"]
        
        # Must be an integer
        assert isinstance(percent_complete, int), "percentComplete must be an integer"
        
        # Must be in valid range
        assert 0 <= percent_complete <= 100, (
            f"percentComplete must be between 0 and 100, got {percent_complete}"
        )

    @given(
        stage=solve_stage_strategy,
        percent_within_stage=percent_within_stage_strategy,
    )
    @settings(max_examples=100)
    def test_percent_complete_within_stage_range(
        self,
        stage: SolveStage,
        percent_within_stage: float,
    ):
        """
        **Feature: solver-ux-feedback, Property 10: Progress Update Format**
        **Validates: Requirements 5.2**
        
        For any stage and percent_within_stage, percentComplete SHALL be within
        the defined range for that stage.
        """
        reporter = ProgressReporter()
        
        captured_output = io.StringIO()
        with redirect_stdout(captured_output):
            reporter.report_stage(stage, percent_within_stage)
        
        output = captured_output.getvalue().strip()
        parsed = json.loads(output)
        
        percent_complete = parsed["percentComplete"]
        start_pct, end_pct = STAGE_PERCENT_RANGES[stage]
        
        # percentComplete should be within the stage's range
        assert start_pct <= percent_complete <= end_pct, (
            f"percentComplete {percent_complete} should be within stage range "
            f"[{start_pct}, {end_pct}] for stage {stage.value}"
        )

    @given(solve_stage_strategy)
    @settings(max_examples=100)
    def test_all_stages_have_farsi_translation(self, stage: SolveStage):
        """
        **Feature: solver-ux-feedback, Property 10: Progress Update Format**
        **Validates: Requirements 5.5**
        
        For any SolveStage, there SHALL be a corresponding Farsi translation
        in STAGE_FARSI.
        """
        assert stage in STAGE_FARSI, f"Stage {stage} must have Farsi translation"
        assert len(STAGE_FARSI[stage]) > 0, f"Farsi translation for {stage} must be non-empty"

    @given(solve_stage_strategy)
    @settings(max_examples=100)
    def test_all_stages_have_percent_ranges(self, stage: SolveStage):
        """
        **Feature: solver-ux-feedback, Property 10: Progress Update Format**
        **Validates: Requirements 5.2**
        
        For any SolveStage, there SHALL be a corresponding percent range
        in STAGE_PERCENT_RANGES.
        """
        assert stage in STAGE_PERCENT_RANGES, f"Stage {stage} must have percent range"
        
        start_pct, end_pct = STAGE_PERCENT_RANGES[stage]
        
        # Range must be valid
        assert 0 <= start_pct <= 100, f"Start percent for {stage} must be 0-100"
        assert 0 <= end_pct <= 100, f"End percent for {stage} must be 0-100"
        assert start_pct <= end_pct, f"Start percent must be <= end percent for {stage}"

    def test_stage_ranges_cover_full_progress(self):
        """
        **Feature: solver-ux-feedback, Property 10: Progress Update Format**
        **Validates: Requirements 5.2**
        
        The stage percent ranges SHALL cover 0% to 100% without gaps.
        """
        # Get all ranges sorted by start percent
        ranges = sorted(STAGE_PERCENT_RANGES.values(), key=lambda x: x[0])
        
        # First range should start at 0
        assert ranges[0][0] == 0, "First stage should start at 0%"
        
        # Last range should end at 100
        assert ranges[-1][1] == 100, "Last stage should end at 100%"
        
        # Ranges should be contiguous
        for i in range(len(ranges) - 1):
            current_end = ranges[i][1]
            next_start = ranges[i + 1][0]
            assert current_end == next_start, (
                f"Gap between ranges: {ranges[i]} and {ranges[i + 1]}"
            )

    def test_estimated_seconds_remaining_is_valid(self):
        """
        **Feature: solver-ux-feedback, Property 10: Progress Update Format**
        **Validates: Requirements 5.1**
        
        estimatedSecondsRemaining SHALL be either null or a non-negative integer.
        """
        reporter = ProgressReporter()
        
        # First update - may not have estimate yet
        captured_output = io.StringIO()
        with redirect_stdout(captured_output):
            reporter.report_stage(SolveStage.VALIDATION, 0.5)
        
        output = captured_output.getvalue().strip()
        parsed = json.loads(output)
        
        estimated = parsed["estimatedSecondsRemaining"]
        
        # Must be None or non-negative integer
        assert estimated is None or (isinstance(estimated, int) and estimated >= 0), (
            f"estimatedSecondsRemaining must be null or non-negative integer, got {estimated}"
        )


class TestProgressReporterState:
    """
    Additional tests for ProgressReporter state management.
    """

    def test_reporter_tracks_current_stage(self):
        """
        ProgressReporter SHALL track the current stage after report_stage is called.
        """
        reporter = ProgressReporter()
        
        assert reporter.current_stage is None, "Initial current_stage should be None"
        
        captured_output = io.StringIO()
        with redirect_stdout(captured_output):
            reporter.report_stage(SolveStage.VALIDATION, 0.5)
        
        assert reporter.current_stage == SolveStage.VALIDATION

    def test_reporter_updates_last_update_time(self):
        """
        ProgressReporter SHALL update last_update_time after report_stage is called.
        """
        reporter = ProgressReporter()
        
        initial_time = reporter.last_update_time
        
        captured_output = io.StringIO()
        with redirect_stdout(captured_output):
            reporter.report_stage(SolveStage.VALIDATION, 0.5)
        
        assert reporter.last_update_time > initial_time

    def test_intermediate_report_requires_current_stage(self):
        """
        report_intermediate SHALL not emit if current_stage is None.
        """
        reporter = ProgressReporter()
        
        captured_output = io.StringIO()
        with redirect_stdout(captured_output):
            reporter.report_intermediate(0.5)
        
        output = captured_output.getvalue()
        assert output == "", "report_intermediate should not emit without current_stage"

    def test_intermediate_report_respects_time_threshold(self):
        """
        report_intermediate SHALL only emit if 5+ seconds since last update.
        """
        reporter = ProgressReporter()
        
        # First, set a stage
        captured_output = io.StringIO()
        with redirect_stdout(captured_output):
            reporter.report_stage(SolveStage.SOLVING_PHASE_1, 0.0)
        
        # Immediately call report_intermediate - should not emit
        captured_output = io.StringIO()
        with redirect_stdout(captured_output):
            reporter.report_intermediate(0.5)
        
        output = captured_output.getvalue()
        assert output == "", "report_intermediate should not emit within 5 seconds"

    def test_intermediate_report_emits_after_threshold(self):
        """
        report_intermediate SHALL emit if 5+ seconds since last update.
        """
        reporter = ProgressReporter()
        
        # First, set a stage
        captured_output = io.StringIO()
        with redirect_stdout(captured_output):
            reporter.report_stage(SolveStage.SOLVING_PHASE_1, 0.0)
        
        # Simulate time passing by manipulating last_update_time
        reporter.last_update_time = time.time() - 6  # 6 seconds ago
        
        # Now report_intermediate should emit
        captured_output = io.StringIO()
        with redirect_stdout(captured_output):
            reporter.report_intermediate(0.5)
        
        output = captured_output.getvalue().strip()
        assert output != "", "report_intermediate should emit after 5 seconds"
        
        # Verify it's valid JSON with correct stage
        parsed = json.loads(output)
        assert parsed["stage"] == SolveStage.SOLVING_PHASE_1.value

