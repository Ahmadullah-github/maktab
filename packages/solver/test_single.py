#!/usr/bin/env python3
"""Quick test of a single scenario with reduced constraints."""

import json
import subprocess
import sys
import time

def run_test(test_file: str, optimization_level: int = 0, time_limit: int = 300):
    """Run solver with specified parameters."""
    print(f"Loading {test_file}...")
    with open(test_file, 'r', encoding='utf-8') as f:
        test_data = json.load(f)
    
    # Override optimization settings
    test_data['config']['solverOptimizationLevel'] = optimization_level
    test_data['config']['solverTimeLimitSeconds'] = time_limit
    
    print(f"Test: {test_data['meta']['test_name']}")
    print(f"Classes: {test_data['meta']['num_classes']}")
    print(f"Optimization level: {optimization_level} (0=fastest, 1=balanced, 2=thorough)")
    print(f"Time limit: {time_limit}s")
    print(f"\nStarting solver...")
    
    start_time = time.time()
    
    result = subprocess.run(
        ['python', 'solver_enhanced.py'],
        input=json.dumps(test_data),
        capture_output=True,
        text=True,
        timeout=time_limit + 60
    )
    
    elapsed_time = time.time() - start_time
    
    print(f"\nSolver finished in {elapsed_time:.2f}s")
    print(f"Return code: {result.returncode}")
    
    # Print last 20 lines of stderr
    if result.stderr:
        print("\nLast stderr lines:")
        for line in result.stderr.split('\n')[-20:]:
            if line.strip():
                print(f"  {line}")
    
    # Try to parse solution
    if result.returncode == 0:
        try:
            # Find JSON in stdout
            stdout = result.stdout.strip()
            json_start = max(stdout.find('['), stdout.find('{'))
            
            if json_start != -1:
                solution = json.loads(stdout[json_start:])
                
                if isinstance(solution, list) and solution and isinstance(solution[0], dict) and 'error' in solution[0]:
                    print(f"\n❌ Solver error: {solution[0]['error']}")
                    print(f"Status: {solution[0].get('status')}")
                    if 'details' in solution[0]:
                        print(f"Details: {solution[0]['details'][:500]}")
                else:
                    print(f"\n✓ Solution found: {len(solution)} lessons")
                    return solution
            else:
                print(f"\n❌ No JSON found in output")
                print(f"First 500 chars of stdout: {result.stdout[:500]}")
        except Exception as e:
            print(f"\n❌ Error parsing output: {e}")
            print(f"First 500 chars: {result.stdout[:500]}")
    else:
        print(f"\n❌ Solver failed")
        if result.stderr:
            print(f"Error: {result.stderr[:1000]}")
    
    return None


if __name__ == "__main__":
    test_file = sys.argv[1] if len(sys.argv) > 1 else "test_6_classes.json"
    opt_level = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    time_limit = int(sys.argv[3]) if len(sys.argv) > 3 else 300
    
    solution = run_test(test_file, opt_level, time_limit)
    
    if solution:
        print("\n✓ Test PASSED")
        sys.exit(0)
    else:
        print("\n❌ Test FAILED")
        sys.exit(1)


