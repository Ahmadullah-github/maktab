"""Quick test to verify Phase 3 serialization fix."""
import sys
import json

# Test if constraint budget can be serialized
try:
    from utils import ConstraintBudget, ConstraintPriority
    
    # Create budget
    budget = ConstraintBudget(max_penalty_vars=1000, problem_size="medium")
    
    # Get stats
    stats = budget.get_usage_stats()
    
    # Try to serialize to JSON (this is what logs do internally)
    json_str = json.dumps(stats)
    
    print("SUCCESS: Constraint budget is JSON-serializable")
    print(f"Stats: {json_str[:100]}...")
    
except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)
