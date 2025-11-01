#!/usr/bin/env python3
"""Validate a solution for constraint violations, especially gaps."""

import json
import sys
from collections import defaultdict

def validate_solution(solution_file: str):
    """Validate solution and check for gaps."""
    print(f"Loading solution from {solution_file}...")
    
    with open(solution_file, 'r', encoding='utf-8') as f:
        solution = json.load(f)
    
    print(f"Solution has {len(solution)} lessons\n")
    
    # Group lessons by class and day
    class_schedules = defaultdict(lambda: defaultdict(list))
    
    for lesson in solution:
        class_id = lesson['classId']
        day = lesson['day']
        period = lesson['periodIndex']
        subject = lesson['subjectId']
        
        class_schedules[class_id][day].append({
            'period': period,
            'subject': subject,
            'teacher': lesson['teacherIds'][0] if lesson['teacherIds'] else None,
            'room': lesson.get('roomId')
        })
    
    # Check for gaps
    total_gaps = 0
    classes_with_gaps = []
    
    print("=" * 80)
    print("GAP ANALYSIS")
    print("=" * 80)
    
    for class_id in sorted(class_schedules.keys()):
        print(f"\nClass {class_id}:")
        class_has_gap = False
        
        for day in sorted(class_schedules[class_id].keys()):
            lessons = class_schedules[class_id][day]
            periods = sorted([l['period'] for l in lessons])
            
            if len(periods) > 1:
                min_period = min(periods)
                max_period = max(periods)
                span = max_period - min_period + 1
                actual_lessons = len(periods)
                
                gap_count = span - actual_lessons
                
                if gap_count > 0:
                    total_gaps += gap_count
                    class_has_gap = True
                    print(f"  {day}: ❌ GAP FOUND! Periods {min_period}-{max_period} ({periods}) = {gap_count} gap(s)")
                else:
                    print(f"  {day}: ✓ No gaps - Periods {min_period}-{max_period} ({actual_lessons} consecutive)")
            else:
                print(f"  {day}: ✓ Single lesson at period {periods[0]}")
        
        if class_has_gap:
            classes_with_gaps.append(class_id)
    
    # Summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Total lessons: {len(solution)}")
    print(f"Classes: {len(class_schedules)}")
    print(f"Total gaps found: {total_gaps}")
    print(f"Classes with gaps: {len(classes_with_gaps)}")
    
    if total_gaps == 0:
        print("\n✓✓✓ NO GAPS FOUND! Gap prevention working perfectly! ✓✓✓")
        return True
    else:
        print(f"\n❌ {total_gaps} gaps found in {len(classes_with_gaps)} classes")
        print(f"Classes with gaps: {', '.join(classes_with_gaps)}")
        return False


if __name__ == "__main__":
    solution_file = sys.argv[1] if len(sys.argv) > 1 else "output_6_classes.json"
    valid = validate_solution(solution_file)
    sys.exit(0 if valid else 1)


