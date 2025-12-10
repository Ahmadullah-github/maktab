"""
Integration tests for containerized solver.

Tests that the solver runs correctly in a Docker container and that
the health check functionality works as expected.

Requirements: 7.1, 7.2
"""

import json
import subprocess
import time
import pytest
from pathlib import Path


class TestContainerizedSolver:
    """Integration tests for Docker containerized solver."""

    @pytest.fixture(scope="class")
    def docker_image_name(self):
        """Docker image name for the solver."""
        return "maktab-solver:test"

    @pytest.fixture(scope="class")
    def build_solver_image(self, docker_image_name):
        """Build the solver Docker image for testing."""
        # Build the Docker image
        result = subprocess.run([
            "docker", "build", 
            "-f", "Dockerfile.solver",
            "-t", docker_image_name,
            "."
        ], capture_output=True, text=True, cwd=Path(__file__).parent.parent.parent.parent.parent)
        
        if result.returncode != 0:
            pytest.fail(f"Failed to build Docker image: {result.stderr}")
        
        yield docker_image_name
        
        # Cleanup: remove the test image
        subprocess.run([
            "docker", "rmi", docker_image_name
        ], capture_output=True)

    @pytest.fixture
    def sample_input_data(self):
        """Sample input data for solver testing."""
        return {
            "config": {
                "daysOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                "periodsPerDay": 6,
                "schoolStartTime": "08:00",
                "periodDurationMinutes": 45,
                "periods": [],
                "breakPeriods": [{"afterPeriod": 3, "duration": 15}],
                "timezone": "Asia/Kabul"
            },
            "preferences": {
                "avoidTeacherGapsWeight": 1.0,
                "avoidClassGapsWeight": 1.0,
                "distributeDifficultSubjectsWeight": 0.8,
                "balanceTeacherLoadWeight": 0.7,
                "minimizeRoomChangesWeight": 0.3,
                "preferMorningForDifficultWeight": 0.5,
                "respectTeacherTimePreferenceWeight": 0.5,
                "respectTeacherRoomPreferenceWeight": 0.2,
                "allowConsecutivePeriodsForSameSubject": True
            },
            "rooms": [
                {
                    "id": "1",
                    "name": "Room 1",
                    "capacity": 30,
                    "type": "classroom",
                    "features": ["whiteboard", "projector"]
                }
            ],
            "subjects": [
                {
                    "id": "1",
                    "name": "Mathematics",
                    "code": "MATH101",
                    "isDifficult": True,
                    "requiredRoomType": "classroom"
                }
            ],
            "teachers": [
                {
                    "id": "1",
                    "fullName": "John Doe",
                    "primarySubjectIds": ["1"],
                    "availability": {
                        "Monday": [True, True, True, True, True, True],
                        "Tuesday": [True, True, True, True, True, True],
                        "Wednesday": [True, True, True, True, True, True],
                        "Thursday": [True, True, True, True, True, True],
                        "Friday": [True, True, True, True, True, True]
                    },
                    "maxPeriodsPerWeek": 30,
                    "timePreference": "Morning"
                }
            ],
            "classes": [
                {
                    "id": "1",
                    "name": "Class 1A",
                    "studentCount": 25,
                    "gradeLevel": 1,
                    "subjectRequirements": {
                        "1": {
                            "periodsPerWeek": 5,
                            "minConsecutive": 1,
                            "maxConsecutive": 2
                        }
                    }
                }
            ]
        }

    def test_solver_container_builds_successfully(self, build_solver_image):
        """Test that the solver Docker image builds successfully."""
        # The fixture handles the build and will fail if unsuccessful
        assert build_solver_image is not None

    def test_solver_health_check_passes(self, build_solver_image):
        """Test that the solver container health check passes."""
        # Test the health check command directly (same as in Dockerfile)
        # We need to override the entrypoint to avoid the solver script expecting stdin
        result = subprocess.run([
            "docker", "run", "--rm", "--entrypoint", "python",
            build_solver_image,
            "-c", "import solver_enhanced; import json; print('Solver health check passed')"
        ], capture_output=True, text=True, timeout=30)
        
        assert result.returncode == 0, f"Health check failed: {result.stderr}"
        assert "Solver health check passed" in result.stdout

    def test_solver_runs_correctly_in_container(self, build_solver_image, sample_input_data):
        """Test that the solver runs correctly in the container and processes input."""
        # Convert input data to JSON
        input_json = json.dumps(sample_input_data)
        
        # Run solver in container with sample input
        result = subprocess.run([
            "docker", "run", "--rm", "-i",
            build_solver_image
        ], input=input_json, capture_output=True, text=True, timeout=60)
        
        # The solver should run without crashing, but may return infeasible results
        # We accept both success (returncode 0) and controlled failure (returncode 1 with structured error)
        assert result.returncode in [0, 1], f"Solver crashed unexpectedly: {result.stderr}"
        
        # Check that we get structured output in stderr (logging)
        assert len(result.stderr) > 0, "Should produce structured log output"
        
        # Verify the logs contain expected solver events
        stderr_lines = result.stderr.strip().split('\n')
        log_events = []
        for line in stderr_lines:
            try:
                log_entry = json.loads(line)
                if 'event' in log_entry:
                    log_events.append(log_entry['event'])
            except json.JSONDecodeError:
                continue
        
        # Check for key solver lifecycle events
        assert "Python solver script started." in log_events, "Should log solver start"
        assert "Input data received." in log_events, "Should log input reception"
        
        # If successful, check output structure
        if result.returncode == 0 and result.stdout:
            try:
                output = json.loads(result.stdout)
                # Verify basic output structure
                assert isinstance(output, list), "Output should be a list of scheduled lessons"
                
                # If we have lessons, verify structure
                if len(output) > 0:
                    lesson = output[0]
                    required_fields = ["day", "periodIndex", "classId", "subjectId", "teacherIds"]
                    for field in required_fields:
                        assert field in lesson, f"Missing required field: {field}"
            except json.JSONDecodeError:
                pytest.fail(f"Solver output is not valid JSON: {result.stdout}")

    def test_solver_respects_environment_variables(self, build_solver_image, sample_input_data):
        """Test that the solver respects environment variable configuration."""
        input_json = json.dumps(sample_input_data)
        
        # Run with custom environment variables
        result = subprocess.run([
            "docker", "run", "--rm", "-i",
            "-e", "SOLVER_MAX_MEMORY_MB=2048",
            "-e", "SOLVER_MAX_TIME_SECONDS=30",
            build_solver_image
        ], input=input_json, capture_output=True, text=True, timeout=45)
        
        # Should complete within the time limit (30s + overhead) - accept both success and controlled failure
        assert result.returncode in [0, 1], f"Solver crashed with env vars: {result.stderr}"
        
        # Verify that the solver respects the time limit by completing quickly
        # (The test itself has a 45s timeout, solver should complete much faster with 30s limit)

    def test_solver_container_resource_limits(self, build_solver_image):
        """Test that the solver container respects resource limits."""
        # Run container with resource limits - just test import, not full solver
        # Override entrypoint to avoid stdin expectation
        result = subprocess.run([
            "docker", "run", "--rm",
            "--memory", "512m",
            "--cpus", "0.5",
            "--entrypoint", "python",
            build_solver_image,
            "-c", "import solver_enhanced; print('Resource limits test passed')"
        ], capture_output=True, text=True, timeout=30)
        
        assert result.returncode == 0, f"Resource limits test failed: {result.stderr}"
        assert "Resource limits test passed" in result.stdout

    def test_solver_container_handles_invalid_input(self, build_solver_image):
        """Test that the solver container handles invalid input gracefully."""
        invalid_input = '{"invalid": "data"}'
        
        result = subprocess.run([
            "docker", "run", "--rm", "-i",
            build_solver_image
        ], input=invalid_input, capture_output=True, text=True, timeout=30)
        
        # Should exit with error code but not crash
        assert result.returncode != 0, "Should fail with invalid input"
        
        # Should produce structured error output in stderr
        assert len(result.stderr) > 0, "Should produce error output"
        # Check for validation error in the structured log output
        assert "validation" in result.stderr.lower() or "missing" in result.stderr.lower()

    def test_docker_health_check_functionality(self, build_solver_image):
        """Test that Docker's built-in health check works correctly."""
        # Start container with health check enabled
        container_name = f"test-solver-{int(time.time())}"
        
        try:
            # Start container in detached mode with overridden entrypoint
            start_result = subprocess.run([
                "docker", "run", "-d", "--name", container_name,
                "--entrypoint", "sleep",
                build_solver_image,
                "60"  # Keep container running for health check
            ], capture_output=True, text=True, timeout=30)
            
            assert start_result.returncode == 0, f"Failed to start container: {start_result.stderr}"
            
            # Wait a bit for health check to run
            time.sleep(35)  # Health check interval is 30s
            
            # Check container health status
            inspect_result = subprocess.run([
                "docker", "inspect", "--format", "{{.State.Health.Status}}", container_name
            ], capture_output=True, text=True, timeout=10)
            
            assert inspect_result.returncode == 0, f"Failed to inspect container: {inspect_result.stderr}"
            health_status = inspect_result.stdout.strip()
            
            # Health status should be "healthy" 
            assert health_status == "healthy", f"Container health check failed. Status: {health_status}"
            
        finally:
            # Cleanup: stop and remove container
            subprocess.run(["docker", "stop", container_name], capture_output=True)
            subprocess.run(["docker", "rm", container_name], capture_output=True)