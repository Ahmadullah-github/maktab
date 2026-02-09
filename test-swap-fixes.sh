#!/bin/bash

# Test script for swap workflow fixes
# Run this after starting the development servers

echo "=========================================="
echo "Swap Workflow Fix Verification"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if API is running
echo -n "Checking API server... "
if curl -s http://localhost:4000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not running${NC}"
    echo "Please start the API server: cd packages/api && npm run dev"
    exit 1
fi

# Check if Python solver is accessible
echo -n "Checking Python solver... "
if [ -f "packages/solver/.venv/bin/python" ]; then
    echo -e "${GREEN}✓ Found${NC}"
else
    echo -e "${RED}✗ Not found${NC}"
    echo "Please set up Python virtual environment"
    exit 1
fi

# Check if swap_solver.py exists
echo -n "Checking swap_solver.py... "
if [ -f "packages/solver/swap_solver.py" ]; then
    echo -e "${GREEN}✓ Found${NC}"
else
    echo -e "${RED}✗ Not found${NC}"
    exit 1
fi

# Check if swap_validator.py exists
echo -n "Checking swap_validator.py... "
if [ -f "packages/solver/core/swap_validator.py" ]; then
    echo -e "${GREEN}✓ Found${NC}"
else
    echo -e "${RED}✗ Not found${NC}"
    exit 1
fi

echo ""
echo "=========================================="
echo "Manual Testing Steps"
echo "=========================================="
echo ""
echo "1. Open the application in browser"
echo "2. Navigate to a schedule view"
echo "3. Enable editing mode"
echo "4. Try these swap scenarios:"
echo ""
echo "   ${YELLOW}Test 1: Swap to Empty Slot${NC}"
echo "   - Select a lesson"
echo "   - Click on an empty slot"
echo "   - Should show validation dialog"
echo "   - Should allow swap (no errors)"
echo ""
echo "   ${YELLOW}Test 2: Swap Between Lessons${NC}"
echo "   - Select a lesson"
echo "   - Click on another lesson"
echo "   - Should show validation dialog"
echo "   - Check for constraint violations"
echo ""
echo "   ${YELLOW}Test 3: Blocked Swap${NC}"
echo "   - Try swapping a lesson where teacher has conflict"
echo "   - Should show error in validation dialog"
echo "   - Should not allow swap"
echo ""
echo "   ${YELLOW}Test 4: Warning Swap${NC}"
echo "   - Try swapping that violates soft constraints"
echo "   - Should show warnings"
echo "   - Should allow swap with confirmation"
echo ""
echo "=========================================="
echo "Backend Testing"
echo "=========================================="
echo ""

# Test swap validation endpoint with curl
echo "Testing swap validation endpoint..."
echo ""

# Create test payload (you'll need to adjust IDs based on your data)
TEST_PAYLOAD='{
  "timetableId": 1,
  "sourceSlot": {
    "classId": "1",
    "day": "Saturday",
    "period": 0
  },
  "targetSlot": {
    "classId": "1",
    "day": "Saturday",
    "period": 1
  }
}'

echo "Sending test request to /api/swap/validate..."
echo "Payload: $TEST_PAYLOAD"
echo ""

RESPONSE=$(curl -s -X POST http://localhost:4000/api/swap/validate \
  -H "Content-Type: application/json" \
  -d "$TEST_PAYLOAD" 2>&1)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Request successful${NC}"
    echo ""
    echo "Response:"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
else
    echo -e "${RED}✗ Request failed${NC}"
    echo "$RESPONSE"
fi

echo ""
echo "=========================================="
echo "Python Solver Testing"
echo "=========================================="
echo ""

# Test Python solver directly
echo "Testing Python solver directly..."
echo ""

TEST_INPUT='{
  "swapRequest": {
    "timetable_id": 1,
    "source_slot": {
      "classId": "1",
      "day": "Saturday",
      "period": 0
    },
    "target_slot": {
      "classId": "1",
      "day": "Saturday",
      "period": 1
    }
  },
  "constraintData": {
    "teachers": [],
    "subjects": [],
    "rooms": [],
    "classes": [],
    "assignments": [],
    "timetableData": {
      "lessons": [],
      "periodsPerDay": {"Saturday": 7},
      "daysOfWeek": ["Saturday"]
    },
    "config": {
      "daysOfWeek": ["Saturday"],
      "periodsPerDay": {"Saturday": 7}
    }
  }
}'

echo "Running: echo '$TEST_INPUT' | packages/solver/.venv/bin/python packages/solver/swap_solver.py"
echo ""

SOLVER_OUTPUT=$(echo "$TEST_INPUT" | packages/solver/.venv/bin/python packages/solver/swap_solver.py 2>&1)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Solver executed successfully${NC}"
    echo ""
    echo "Output:"
    echo "$SOLVER_OUTPUT" | python3 -m json.tool 2>/dev/null || echo "$SOLVER_OUTPUT"
else
    echo -e "${RED}✗ Solver failed${NC}"
    echo "$SOLVER_OUTPUT"
fi

echo ""
echo "=========================================="
echo "Verification Complete"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Review the test results above"
echo "2. Perform manual UI testing"
echo "3. Check browser console for errors"
echo "4. Check API logs for errors"
echo ""
echo "If issues persist, check:"
echo "- SWAP_FIXES_COMPLETE.md for details"
echo "- API logs: packages/api/logs/"
echo "- Browser console (F12)"
echo ""
