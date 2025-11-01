#!/usr/bin/env python3
"""
Analyze solver output for gaps and constraint violations
"""

import json
from collections import defaultdict

# This is the output from the solver run
SOLVER_OUTPUT = [
  {
    "day": "Saturday",
    "periodIndex": 0,
    "classId": "7A",
    "subjectId": "ENG",
    "teacherIds": ["T2"],
    "roomId": "103",
    "isFixed": False
  },
  {
    "day": "Saturday",
    "periodIndex": 1,
    "classId": "7A",
    "subjectId": "ENG",
    "teacherIds": ["T2"],
    "roomId": "103",
    "isFixed": False
  },
  {
    "day": "Saturday",
    "periodIndex": 2,
    "classId": "7B",
    "subjectId": "ENG",
    "teacherIds": ["T2"],
    "roomId": "101",
    "isFixed": False
  },
  {
    "day": "Saturday",
    "periodIndex": 3,
    "classId": "7B",
    "subjectId": "ENG",
    "teacherIds": ["T2"],
    "roomId": "101",
    "isFixed": False
  },
  {
    "day": "Sunday",
    "periodIndex": 0,
    "classId": "7A",
    "subjectId": "ENG",
    "teacherIds": ["T2"],
    "roomId": "103",
    "isFixed": False
  },
  {
    "day": "Sunday",
    "periodIndex": 0,
    "classId": "7B",
    "subjectId": "MATH",
    "teacherIds": ["T1"],
    "roomId": "101",
    "isFixed": False
  },
  {
    "day": "Sunday",
    "periodIndex": 1,
    "classId": "7A",
    "subjectId": "ENG",
    "teacherIds": ["T2"],
    "roomId": "103",
    "isFixed": False
  },
  {
    "day": "Sunday",
    "periodIndex": 1,
    "classId": "7B",
    "subjectId": "MATH",
    "teacherIds": ["T1"],
    "roomId": "101",
    "isFixed": False
  },
  {
    "day": "Monday",
    "periodIndex": 0,
    "classId": "7B",
    "subjectId": "MATH",
    "teacherIds": ["T1"],
    "roomId": "101",
    "isFixed": False
  },
  {
    "day": "Monday",
    "periodIndex": 1,
    "classId": "7B",
    "subjectId": "MATH",
    "teacherIds": ["T1"],
    "roomId": "101",
    "isFixed": False
  },
  {
    "day": "Monday",
    "periodIndex": 5,
    "classId": "7A",
    "subjectId": "MATH",
    "teacherIds": ["T1"],
    "roomId": "103",
    "isFixed": False
  },
  {
    "day": "Tuesday",
    "periodIndex": 0,
    "classId": "7A",
    "subjectId": "MATH",
    "teacherIds": ["T1"],
    "roomId": "103",
    "isFixed": False
  },
  {
    "day": "Tuesday",
    "periodIndex": 1,
    "classId": "7A",
    "subjectId": "MATH",
    "teacherIds": ["T1"],
    "roomId": "103",
    "isFixed": False
  },
  {
    "day": "Tuesday",
    "periodIndex": 2,
    "classId": "7A",
    "subjectId": "MATH",
    "teacherIds": ["T1"],
    "roomId": "103",
    "isFixed": False
  },
  {
    "day": "Tuesday",
    "periodIndex": 3,
    "classId": "7A",
    "subjectId": "MATH",
    "teacherIds": ["T1"],
    "roomId": "103",
    "isFixed": False
  },
  {
    "day": "Tuesday",
    "periodIndex": 5,
    "classId": "7B",
    "subjectId": "MATH",
    "teacherIds": ["T1"],
    "roomId": "101",
    "isFixed": False
  },
  {
    "day": "Wednesday",
    "periodIndex": 0,
    "classId": "7A",
    "subjectId": "HIST",
    "teacherIds": ["T4"],
    "roomId": "103",
    "isFixed": False
  },
  {
    "day": "Wednesday",
    "periodIndex": 0,
    "classId": "7B",
    "subjectId": "ENG",
    "teacherIds": ["T2"],
    "roomId": "101",
    "isFixed": False
  },
  {
    "day": "Wednesday",
    "periodIndex": 1,
    "classId": "7A",
    "subjectId": "HIST",
    "teacherIds": ["T4"],
    "roomId": "103",
    "isFixed": False
  },
  {
    "day": "Wednesday",
    "periodIndex": 1,
    "classId": "7B",
    "subjectId": "ENG",
    "teacherIds": ["T2"],
    "roomId": "101",
    "isFixed": False
  },
  {
    "day": "Thursday",
    "periodIndex": 0,
    "classId": "7B",
    "subjectId": "SCI",
    "teacherIds": ["T3"],
    "roomId": "101",
    "isFixed": False
  },
  {
    "day": "Thursday",
    "periodIndex": 1,
    "classId": "7B",
    "subjectId": "SCI",
    "teacherIds": ["T3"],
    "roomId": "101",
    "isFixed": False
  },
  {
    "day": "Thursday",
    "periodIndex": 2,
    "classId": "7A",
    "subjectId": "ART",
    "teacherIds": ["T4"],
    "roomId": "103",
    "isFixed": False
  },
  {
    "day": "Thursday",
    "periodIndex": 2,
    "classId": "7B",
    "subjectId": "SCI",
    "teacherIds": ["T3"],
    "roomId": "101",
    "isFixed": False
  },
  {
    "day": "Thursday",
    "periodIndex": 3,
    "classId": "7A",
    "subjectId": "SCI",
    "teacherIds": ["T3"],
    "roomId": "103",
    "isFixed": False
  },
  {
    "day": "Thursday",
    "periodIndex": 3,
    "classId": "7B",
    "subjectId": "HIST",
    "teacherIds": ["T4"],
    "roomId": "101",
    "isFixed": False
  },
  {
    "day": "Thursday",
    "periodIndex": 4,
    "classId": "7A",
    "subjectId": "SCI",
    "teacherIds": ["T3"],
    "roomId": "103",
    "isFixed": False
  },
  {
    "day": "Thursday",
    "periodIndex": 4,
    "classId": "7B",
    "subjectId": "HIST",
    "teacherIds": ["T4"],
    "roomId": "101",
    "isFixed": False
  },
  {
    "day": "Thursday",
    "periodIndex": 5,
    "classId": "7A",
    "subjectId": "SCI",
    "teacherIds": ["T3"],
    "roomId": "103",
    "isFixed": False
  },
  {
    "day": "Thursday",
    "periodIndex": 5,
    "classId": "7B",
    "subjectId": "ART",
    "teacherIds": ["T4"],
    "roomId": "101",
    "isFixed": False
  }
]


def analyze_gaps():
    """Analyze the output for gaps"""
    print("="*80)
    print("  GAP ANALYSIS REPORT")
    print("="*80)
    print()
    
    # Group by class and day
    class_schedules = defaultdict(lambda: defaultdict(list))
    
    for lesson in SOLVER_OUTPUT:
        class_id = lesson['classId']
        day = lesson['day']
        period = lesson['periodIndex']
        class_schedules[class_id][day].append(period)
    
    # Analyze each class
    total_gaps = 0
    
    for class_id in sorted(class_schedules.keys()):
        print(f"\n📚 Class: {class_id}")
        print("-" * 80)
        
        days_dict = class_schedules[class_id]
        
        for day in ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']:
            if day not in days_dict:
                continue
            
            periods = sorted(days_dict[day])
            
            if len(periods) == 0:
                continue
            
            # Check for gaps
            min_p = periods[0]
            max_p = periods[-1]
            span = max_p - min_p + 1
            actual = len(periods)
            
            gaps = span - actual
            
            if gaps > 0:
                total_gaps += gaps
                print(f"  {day:<12} ⚠️ GAP DETECTED!")
                print(f"    Periods: {periods}")
                print(f"    Range: P{min_p+1} to P{max_p+1} (span={span})")
                print(f"    Actual lessons: {actual}")
                print(f"    Gaps: {gaps}")
            else:
                print(f"  {day:<12} ✅ NO GAPS (periods: {periods})")
    
    print("\n" + "="*80)
    print("  SUMMARY")
    print("="*80)
    print(f"Total Classes Analyzed: {len(class_schedules)}")
    print(f"Total Lessons: {len(SOLVER_OUTPUT)}")
    print(f"Total Gaps Found: {total_gaps}")
    
    if total_gaps == 0:
        print("\n🎉 SUCCESS! Gap prevention constraint is working perfectly!")
        print("   All classes have consecutive lessons with NO gaps!")
    else:
        print(f"\n❌ FAILURE! Found {total_gaps} gap(s) in class schedules!")
        print("   Gap prevention constraint may need adjustment.")
    
    return total_gaps == 0


def print_visual_schedule():
    """Print visual schedule"""
    print("\n" + "="*80)
    print("  VISUAL SCHEDULE")
    print("="*80)
    
    class_schedules = defaultdict(lambda: defaultdict(dict))
    
    for lesson in SOLVER_OUTPUT:
        class_id = lesson['classId']
        day = lesson['day']
        period = lesson['periodIndex']
        subject = lesson['subjectId']
        class_schedules[class_id][day][period] = subject
    
    days = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']
    
    for class_id in sorted(class_schedules.keys()):
        print(f"\n{class_id} Schedule:")
        print(f"{'Day':<12}", end='')
        for p in range(6):
            print(f"P{p+1:<6}", end='')
        print()
        print('-' * 80)
        
        for day in days:
            print(f"{day:<12}", end='')
            day_schedule = class_schedules[class_id].get(day, {})
            
            for p in range(6):
                subject = day_schedule.get(p, '—')
                print(f"{subject:<7}", end='')
            print()


if __name__ == "__main__":
    success = analyze_gaps()
    print_visual_schedule()
    print()

