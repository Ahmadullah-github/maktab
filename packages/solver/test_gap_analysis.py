#!/usr/bin/env python3
"""
Comprehensive Solver Testing & Gap Analysis Script

This script:
1. Runs the solver with test data
2. Analyzes the output for gaps in class schedules
3. Validates all constraints
4. Generates detailed reports
"""

import json
import sys
import subprocess
from collections import defaultdict
from typing import List, Dict, Any


def load_test_data(filename: str) -> Dict:
    """Load test data from JSON file"""
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ Error loading test data: {e}")
        sys.exit(1)


def run_solver(test_data: Dict) -> List[Dict]:
    """Run the solver with test data"""
    try:
        # Convert test data to JSON
        input_json = json.dumps(test_data, ensure_ascii=False)
        
        # Run the solver
        print("🚀 Running solver...")
        result = subprocess.run(
            [sys.executable, 'solver_enhanced.py'],
            input=input_json,
            capture_output=True,
            text=True,
            encoding='utf-8'
        )
        
        if result.returncode != 0:
            print(f"❌ Solver failed with exit code {result.returncode}")
            print(f"STDERR: {result.stderr}")
            return []
        
        # Parse output
        try:
            output = json.loads(result.stdout)
            print(f"✅ Solver completed successfully")
            return output if isinstance(output, list) else []
        except json.JSONDecodeError as e:
            print(f"❌ Failed to parse solver output: {e}")
            print(f"STDOUT: {result.stdout}")
            return []
            
    except Exception as e:
        print(f"❌ Error running solver: {e}")
        return []


def analyze_gaps(lessons: List[Dict], config: Dict) -> Dict[str, Any]:
    """
    Analyze the timetable for gaps in class schedules
    
    Returns detailed analysis including:
    - Gap detection per class per day
    - Statistics
    - Validation results
    """
    periods_per_day = config['periodsPerDay']
    days = config['daysOfWeek']
    
    # Group lessons by class and day
    class_schedules = defaultdict(lambda: defaultdict(list))
    
    for lesson in lessons:
        class_id = lesson['classId']
        day = lesson['day']
        period = lesson['periodIndex']
        class_schedules[class_id][day].append(period)
    
    # Analyze each class-day for gaps
    analysis = {
        'total_classes': len(class_schedules),
        'total_lessons': len(lessons),
        'gaps_found': [],
        'class_details': {},
        'validation_passed': True
    }
    
    for class_id, days_dict in class_schedules.items():
        class_info = {
            'class_id': class_id,
            'days_analyzed': len(days_dict),
            'total_periods': 0,
            'gaps_per_day': {},
            'has_gaps': False
        }
        
        for day, periods in days_dict.items():
            if len(periods) == 0:
                continue
            
            # Sort periods
            sorted_periods = sorted(periods)
            class_info['total_periods'] += len(periods)
            
            # Check for gaps
            if len(sorted_periods) > 1:
                min_period = sorted_periods[0]
                max_period = sorted_periods[-1]
                span = max_period - min_period + 1
                actual_lessons = len(sorted_periods)
                
                # If span > actual lessons, there are gaps!
                if span > actual_lessons:
                    gap_count = span - actual_lessons
                    gap_info = {
                        'class_id': class_id,
                        'day': day,
                        'periods_scheduled': sorted_periods,
                        'first_period': min_period,
                        'last_period': max_period,
                        'span': span,
                        'actual_lessons': actual_lessons,
                        'gaps': gap_count,
                        'gap_description': f"{class_id} on {day}: {gap_count} gap(s) between periods {min_period}-{max_period}"
                    }
                    
                    analysis['gaps_found'].append(gap_info)
                    class_info['has_gaps'] = True
                    class_info['gaps_per_day'][day] = gap_count
                    analysis['validation_passed'] = False
        
        analysis['class_details'][class_id] = class_info
    
    return analysis


def analyze_constraints(lessons: List[Dict], test_data: Dict) -> Dict[str, Any]:
    """Validate all other constraints"""
    
    constraints = {
        'no_overlap_class': {'passed': True, 'violations': []},
        'no_overlap_teacher': {'passed': True, 'violations': []},
        'no_overlap_room': {'passed': True, 'violations': []},
        'teacher_max_periods_week': {'passed': True, 'violations': []},
        'teacher_max_periods_day': {'passed': True, 'violations': []},
        'room_capacity': {'passed': True, 'violations': []}
    }
    
    # Group lessons by slot (day + period)
    slots = defaultdict(list)
    for lesson in lessons:
        slot_key = f"{lesson['day']}-{lesson['periodIndex']}"
        slots[slot_key].append(lesson)
    
    # Check for overlaps
    for slot_key, slot_lessons in slots.items():
        # Class overlaps
        classes_in_slot = [l['classId'] for l in slot_lessons]
        if len(classes_in_slot) != len(set(classes_in_slot)):
            constraints['no_overlap_class']['passed'] = False
            constraints['no_overlap_class']['violations'].append(
                f"Slot {slot_key}: Multiple lessons for same class"
            )
        
        # Teacher overlaps
        teachers_in_slot = []
        for l in slot_lessons:
            teachers_in_slot.extend(l['teacherIds'])
        if len(teachers_in_slot) != len(set(teachers_in_slot)):
            constraints['no_overlap_teacher']['passed'] = False
            constraints['no_overlap_teacher']['violations'].append(
                f"Slot {slot_key}: Teacher assigned to multiple lessons"
            )
        
        # Room overlaps
        rooms_in_slot = [l['roomId'] for l in slot_lessons]
        if len(rooms_in_slot) != len(set(rooms_in_slot)):
            constraints['no_overlap_room']['passed'] = False
            constraints['no_overlap_room']['violations'].append(
                f"Slot {slot_key}: Room assigned to multiple lessons"
            )
    
    # Check teacher workload
    teacher_loads_week = defaultdict(int)
    teacher_loads_day = defaultdict(lambda: defaultdict(int))
    
    for lesson in lessons:
        for teacher_id in lesson['teacherIds']:
            teacher_loads_week[teacher_id] += 1
            teacher_loads_day[teacher_id][lesson['day']] += 1
    
    for teacher in test_data['teachers']:
        tid = teacher['id']
        max_week = teacher['maxPeriodsPerWeek']
        max_day = teacher.get('maxPeriodsPerDay', 999)
        
        if teacher_loads_week[tid] > max_week:
            constraints['teacher_max_periods_week']['passed'] = False
            constraints['teacher_max_periods_week']['violations'].append(
                f"Teacher {tid}: {teacher_loads_week[tid]} periods/week > max {max_week}"
            )
        
        for day, count in teacher_loads_day[tid].items():
            if count > max_day:
                constraints['teacher_max_periods_day']['passed'] = False
                constraints['teacher_max_periods_day']['violations'].append(
                    f"Teacher {tid} on {day}: {count} periods > max {max_day}"
                )
    
    return constraints


def print_schedule(lessons: List[Dict], config: Dict):
    """Print a human-readable schedule"""
    days = config['daysOfWeek']
    periods_per_day = config['periodsPerDay']
    
    # Group by class
    class_schedules = defaultdict(lambda: defaultdict(dict))
    
    for lesson in lessons:
        class_id = lesson['classId']
        day = lesson['day']
        period = lesson['periodIndex']
        subject = lesson['subjectId']
        class_schedules[class_id][day][period] = subject
    
    # Print each class schedule
    for class_id in sorted(class_schedules.keys()):
        print(f"\n{'='*80}")
        print(f"  {class_id} Schedule")
        print(f"{'='*80}")
        print(f"{'Day':<12}", end='')
        for p in range(periods_per_day):
            print(f"P{p+1:<4}", end='')
        print()
        print('-' * 80)
        
        for day in days:
            print(f"{day:<12}", end='')
            day_schedule = class_schedules[class_id][day]
            
            for p in range(periods_per_day):
                subject = day_schedule.get(p, '—')
                print(f"{subject:<5}", end='')
            
            # Check for gaps
            if day in class_schedules[class_id]:
                scheduled = sorted(day_schedule.keys())
                if len(scheduled) > 1:
                    span = scheduled[-1] - scheduled[0] + 1
                    if span > len(scheduled):
                        print(f"  ⚠️ GAP DETECTED!", end='')
            print()


def main():
    """Main testing function"""
    print("="*80)
    print("  PYTHON SOLVER COMPREHENSIVE TESTING")
    print("="*80)
    print()
    
    # Test 1: Gap Prevention Test
    print("\n📋 TEST 1: Gap Prevention with 2 Classes")
    print("-" * 80)
    
    test_data = load_test_data('test_gap_prevention.json')
    print(f"✓ Loaded test data: {len(test_data['classes'])} classes, {len(test_data['subjects'])} subjects")
    
    lessons = run_solver(test_data)
    
    if not lessons or (len(lessons) == 1 and 'error' in lessons[0]):
        print(f"❌ Solver failed or returned error")
        if lessons:
            print(f"Error: {lessons[0].get('error', 'Unknown')}")
        return False
    
    print(f"✓ Generated {len(lessons)} lessons")
    
    # Analyze gaps
    print("\n🔍 Analyzing for gaps...")
    gap_analysis = analyze_gaps(lessons, test_data['config'])
    
    if gap_analysis['validation_passed']:
        print(f"✅ NO GAPS FOUND - Gap prevention constraint working correctly!")
    else:
        print(f"❌ GAPS DETECTED - {len(gap_analysis['gaps_found'])} gap(s) found:")
        for gap in gap_analysis['gaps_found']:
            print(f"   ⚠️ {gap['gap_description']}")
            print(f"      Periods: {gap['periods_scheduled']}")
    
    # Analyze other constraints
    print("\n🔍 Validating other constraints...")
    constraint_results = analyze_constraints(lessons, test_data)
    
    all_passed = True
    for constraint_name, result in constraint_results.items():
        if result['passed']:
            print(f"   ✅ {constraint_name}")
        else:
            print(f"   ❌ {constraint_name}: {len(result['violations'])} violation(s)")
            for v in result['violations'][:3]:  # Show first 3
                print(f"      - {v}")
            all_passed = False
    
    # Print schedules
    print("\n📅 Generated Schedules:")
    print_schedule(lessons, test_data['config'])
    
    # Final summary
    print("\n" + "="*80)
    print("  TEST SUMMARY")
    print("="*80)
    print(f"Total Lessons Generated: {len(lessons)}")
    print(f"Classes: {gap_analysis['total_classes']}")
    print(f"Gap Prevention: {'✅ PASSED' if gap_analysis['validation_passed'] else '❌ FAILED'}")
    print(f"Other Constraints: {'✅ PASSED' if all_passed else '❌ FAILED'}")
    print()
    
    if gap_analysis['validation_passed'] and all_passed:
        print("🎉 ALL TESTS PASSED - Solver is working correctly!")
        return True
    else:
        print("⚠️ SOME TESTS FAILED - See details above")
        return False


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

