#!/usr/bin/env python3
"""
Wrapper script for the timetable solver that can be called from Node.js
"""
import sys
import os
import json

# Add the current directory to Python path
sys.path.append(os.path.dirname(__file__))

from solver_enhanced import TimetableSolver


if __name__ == "__main__":
    try:
        # Use relative path from current script location
        script_dir = os.path.dirname(os.path.abspath(__file__))
        test_file = os.path.join(script_dir, "test.json")
        with open(test_file) as f:
            data = json.load(f)
        # print(data)
        
        # Run solver
        solver = TimetableSolver(data)
        result = solver.solve()
        
        # Output result
        print(json.dumps(result))
        
    except Exception as e:
        print(f"ERROR: {str(e)}", file=sys.stderr)
        sys.exit(1)