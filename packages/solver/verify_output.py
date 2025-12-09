#!/usr/bin/env python3
"""
Verification script for Afghanistan school rules.
Run this on your solver output to check for violations.
"""
import json
import sys
from collections import defaultdict

def verify_teacher_continuity(output):
    """Verify that each class-subject is taught by only ONE teacher."""
    print("\n" + "="*80)
    print("VERIFICATION 1: Teacher Continuity (One Teacher Per Class-Subject)")
    print("="*80)
    
    class_subject_teachers = defaultdict(set)
    violations = []
    
    for lesson in output['data']:
        key = (lesson['classId'], lesson['subjectId'])
        teacher_id = lesson['teacherIds'][0]
        class_subject_teachers[key].add(teacher_id)
    
    # Check for violations
    for (class_id, subject_id), teachers in class_subject_teachers.items():
        if len(teachers) > 1:
            violations.append({
                'class': class_id,
                'subject': subject_id,
                'teachers': list(teachers),
                'count': len(teachers)
            })
    
    if violations:
        print(f"\n❌ VIOLATIONS FOUND: {len(violations)}")
        for v in violations:
            print(f"   Class {v['class']}, Subject {v['subject']}: {v['count']} teachers ({v['teachers']})")
        return False
    else:
        print(f"\n✅ PASS: All {len(class_subject_teachers)} class-subject combinations have ONE teacher")
        return True

def verify_max_2_per_day(output):
    """Verify that no subject appears more than 2 times per day."""
    print("\n" + "="*80)
    print("VERIFICATION 2: Max 2 Periods Per Day Per Subject")
    print("="*80)
    
    violations = []
    class_subject_day_count = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    
    for lesson in output['data']:
        key = (lesson['classId'], lesson['subjectId'], lesson['day'])
        class_subject_day_count[lesson['classId']][lesson['subjectId']][lesson['day']] += 1
    
    # Check for violations (more than 2 per day)
    for class_id, subjects in class_subject_day_count.items():
        for subject_id, days in subjects.items():
            for day, count in days.items():
                if count > 2:
                    violations.append({
                        'class': class_id,
                        'subject': subject_id,
                        'day': day,
                        'count': count
                    })
    
    if violations:
        print(f"\n❌ VIOLATIONS FOUND: {len(violations)}")
        for v in violations:
            print(f"   {v['day']}: Class {v['class']}, Subject {v['subject']}: {v['count']} periods (max 2 allowed)")
        return False
    else:
        print(f"\n✅ PASS: No subject appears more than 2 times per day")
        return True

def verify_consecutive_rules(output):
    """Verify consecutive lesson rules based on Afghanistan school requirements."""
    print("\n" + "="*80)
    print("VERIFICATION 3: Consecutive Lessons Rules")
    print("="*80)
    
    # Group by class, subject, day to find subjects with 2 lessons on same day
    class_subject_day_lessons = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
    
    for lesson in output['data']:
        class_subject_day_lessons[lesson['classId']][lesson['subjectId']][lesson['day']].append({
            'period': lesson['periodIndex']
        })
    
    gaps_found = []
    
    # Check for gaps when 2 lessons of same subject are on same day
    for class_id, subjects in class_subject_day_lessons.items():
        for subject_id, days in subjects.items():
            for day, lessons in days.items():
                if len(lessons) == 2:
                    # Sort by period
                    lessons.sort(key=lambda x: x['period'])
                    period1 = lessons[0]['period']
                    period2 = lessons[1]['period']
                    
                    # Check if they are adjacent (no gap)
                    # Adjacent means period2 = period1 + 1
                    if period2 != period1 + 1:
                        gap = period2 - period1 - 1
                        gaps_found.append({
                            'class': class_id,
                            'subject': subject_id,
                            'day': day,
                            'period1': period1,
                            'period2': period2,
                            'gap': gap
                        })
    
    if gaps_found:
        print(f"\n⚠️  GAPS FOUND BETWEEN CONSECUTIVE LESSONS: {len(gaps_found)}")
        print("\n   (If consecutive is enabled, 2 lessons on same day MUST be adjacent)")
        for g in gaps_found:
            print(f"   {g['day']}: Class {g['class']}, Subject {g['subject']}, "
                  f"Periods {g['period1']} and {g['period2']} (gap of {g['gap']} period(s))")
        print("\n   NOTE: This is only a violation if consecutive lessons were ENABLED for these subjects")
        return False
    else:
        print(f"\n✅ PASS: All lessons with 2 on same day are adjacent (no gaps)")
        return True

def main():
    if len(sys.argv) < 2:
        print("Usage: python verify_output.py <output_file.json>")
        print("\nOr pipe output directly:")
        print("  python solver_enhanced.py < input.json | python verify_output.py")
        sys.exit(1)
    
    # Read from file or stdin
    if sys.argv[1] == '-':
        output = json.load(sys.stdin)
    else:
        with open(sys.argv[1], 'r', encoding='utf-8') as f:
            output = json.load(f)
    
    if not output.get('success'):
        print("❌ Solver did not succeed. Cannot verify.")
        sys.exit(1)
    
    print("\n🔍 VERIFYING TIMETABLE OUTPUT")
    print("="*80)
    print(f"Total lessons: {len(output['data'])}")
    
    # Run verifications
    test1 = verify_teacher_continuity(output)
    test2 = verify_max_2_per_day(output)
    test3 = verify_consecutive_rules(output)
    
    print("\n" + "="*80)
    print("FINAL RESULT")
    print("="*80)
    
    if test1 and test2 and test3:
        print("✅ ALL TESTS PASSED - Output follows Afghanistan school rules!")
        print("\nVerified:")
        print("  ✅ One teacher per class-subject")
        print("  ✅ Max 2 periods per day per subject")
        print("  ✅ No gaps in consecutive lessons")
    else:
        print("❌ SOME TESTS FAILED - See details above")
        sys.exit(1)

if __name__ == '__main__':
    main()
