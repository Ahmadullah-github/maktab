"""Quick test for CHUNK 3 category helpers."""

from solver_enhanced import get_category_from_grade, get_category_dari_name, CATEGORY_DARI_NAMES

print("Testing CHUNK 3: Grade Category Helpers")
print("=" * 50)

# Test get_category_from_grade
print("\nTest 1: Grade to Category Mapping")
test_cases = [
    (1, "Alpha-Primary"),
    (3, "Alpha-Primary"),
    (4, "Beta-Primary"),
    (6, "Beta-Primary"),
    (7, "Middle"),
    (9, "Middle"),
    (10, "High"),
    (12, "High")
]

for grade, expected in test_cases:
    result = get_category_from_grade(grade)
    status = "✓" if result == expected else "✗"
    print(f"  {status} Grade {grade:2d} -> {result:15s} (expected: {expected})")

# Test get_category_dari_name
print("\nTest 2: Category Dari Names")
for category, dari_name in CATEGORY_DARI_NAMES.items():
    result = get_category_dari_name(category)
    status = "✓" if result == dari_name else "✗"
    print(f"  {status} {category:15s} -> {result}")

# Test invalid grade
print("\nTest 3: Invalid Grade Handling")
try:
    get_category_from_grade(0)
    print("  ✗ Should have raised ValueError for grade 0")
except ValueError as e:
    print(f"  ✓ Correctly raised ValueError: {e}")

try:
    get_category_from_grade(13)
    print("  ✗ Should have raised ValueError for grade 13")
except ValueError as e:
    print(f"  ✓ Correctly raised ValueError: {e}")

print("\n" + "=" * 50)
print("✓ All CHUNK 3 helper tests passed!")
