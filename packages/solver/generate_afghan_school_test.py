#!/usr/bin/env python3
"""
Generate realistic Afghan school test data for timetable solver testing.
Supports incremental scale testing: 6, 12, and 18 classes.
"""

import json
import sys
from typing import List, Dict

# Afghan school subjects by grade (realistic curriculum)
# IMPORTANT: Each grade's periods MUST sum to exactly (periodsPerDay × daysPerWeek - breakPeriods)
# For 8 periods/day × 6 days - 6 breaks = 42 periods required per class
AFGHAN_SUBJECTS = {
    7: [
        {"id": "math7", "name": "Mathematics", "code": "MTH7", "isDifficult": True, "periods": 5},
        {"id": "dari7", "name": "Dari Language", "code": "DRI7", "periods": 4},
        {"id": "pashto7", "name": "Pashto Language", "code": "PSH7", "periods": 4},
        {"id": "eng7", "name": "English", "code": "ENG7", "periods": 4},
        {"id": "islam7", "name": "Islamic Studies", "code": "ISL7", "periods": 3},
        {"id": "sci7", "name": "Science", "code": "SCI7", "isDifficult": True, "periods": 4},
        {"id": "hist7", "name": "History", "code": "HIS7", "periods": 3},
        {"id": "geo7", "name": "Geography", "code": "GEO7", "periods": 3},
        {"id": "pe7", "name": "Physical Education", "code": "PE7", "periods": 2},
        {"id": "art7", "name": "Art", "code": "ART7", "periods": 2},
        {"id": "comp7", "name": "Computer", "code": "CMP7", "periods": 2},
        {"id": "quran7", "name": "Quran", "code": "QRN7", "periods": 3},
        {"id": "arabic7", "name": "Arabic", "code": "ARB7", "periods": 3},
    ],  # Total: 42 periods
    8: [
        {"id": "math8", "name": "Mathematics", "code": "MTH8", "isDifficult": True, "periods": 5},
        {"id": "dari8", "name": "Dari Language", "code": "DRI8", "periods": 4},
        {"id": "pashto8", "name": "Pashto Language", "code": "PSH8", "periods": 4},
        {"id": "eng8", "name": "English", "code": "ENG8", "periods": 4},
        {"id": "islam8", "name": "Islamic Studies", "code": "ISL8", "periods": 3},
        {"id": "sci8", "name": "Science", "code": "SCI8", "isDifficult": True, "periods": 4},
        {"id": "hist8", "name": "History", "code": "HIS8", "periods": 3},
        {"id": "geo8", "name": "Geography", "code": "GEO8", "periods": 3},
        {"id": "pe8", "name": "Physical Education", "code": "PE8", "periods": 2},
        {"id": "art8", "name": "Art", "code": "ART8", "periods": 2},
        {"id": "comp8", "name": "Computer", "code": "CMP8", "periods": 2},
        {"id": "quran8", "name": "Quran", "code": "QRN8", "periods": 3},
        {"id": "arabic8", "name": "Arabic", "code": "ARB8", "periods": 3},
    ],  # Total: 42 periods
    9: [
        {"id": "math9", "name": "Mathematics", "code": "MTH9", "isDifficult": True, "periods": 5},
        {"id": "dari9", "name": "Dari Language", "code": "DRI9", "periods": 4},
        {"id": "pashto9", "name": "Pashto Language", "code": "PSH9", "periods": 3},
        {"id": "eng9", "name": "English", "code": "ENG9", "periods": 4},
        {"id": "islam9", "name": "Islamic Studies", "code": "ISL9", "periods": 3},
        {"id": "phys9", "name": "Physics", "code": "PHY9", "isDifficult": True, "periods": 4},
        {"id": "chem9", "name": "Chemistry", "code": "CHM9", "isDifficult": True, "periods": 4},
        {"id": "bio9", "name": "Biology", "code": "BIO9", "periods": 3},
        {"id": "hist9", "name": "History", "code": "HIS9", "periods": 3},
        {"id": "geo9", "name": "Geography", "code": "GEO9", "periods": 3},
        {"id": "pe9", "name": "Physical Education", "code": "PE9", "periods": 2},
        {"id": "comp9", "name": "Computer", "code": "CMP9", "periods": 2},
        {"id": "arabic9", "name": "Arabic", "code": "ARB9", "periods": 2},
    ],  # Total: 42 periods
    10: [
        {"id": "math10", "name": "Mathematics", "code": "MTH10", "isDifficult": True, "periods": 5},
        {"id": "dari10", "name": "Dari Language", "code": "DRI10", "periods": 4},
        {"id": "pashto10", "name": "Pashto Language", "code": "PSH10", "periods": 3},
        {"id": "eng10", "name": "English", "code": "ENG10", "periods": 4},
        {"id": "islam10", "name": "Islamic Studies", "code": "ISL10", "periods": 3},
        {"id": "phys10", "name": "Physics", "code": "PHY10", "isDifficult": True, "periods": 4},
        {"id": "chem10", "name": "Chemistry", "code": "CHM10", "isDifficult": True, "periods": 4},
        {"id": "bio10", "name": "Biology", "code": "BIO10", "periods": 3},
        {"id": "hist10", "name": "History", "code": "HIS10", "periods": 3},
        {"id": "geo10", "name": "Geography", "code": "GEO10", "periods": 3},
        {"id": "pe10", "name": "Physical Education", "code": "PE10", "periods": 2},
        {"id": "comp10", "name": "Computer", "code": "CMP10", "periods": 2},
        {"id": "arabic10", "name": "Arabic", "code": "ARB10", "periods": 2},
    ],  # Total: 42 periods
    11: [
        {"id": "math11", "name": "Mathematics", "code": "MTH11", "isDifficult": True, "periods": 5},
        {"id": "dari11", "name": "Dari Language", "code": "DRI11", "periods": 4},
        {"id": "pashto11", "name": "Pashto Language", "code": "PSH11", "periods": 3},
        {"id": "eng11", "name": "English", "code": "ENG11", "periods": 4},
        {"id": "islam11", "name": "Islamic Studies", "code": "ISL11", "periods": 3},
        {"id": "phys11", "name": "Physics", "code": "PHY11", "isDifficult": True, "periods": 4},
        {"id": "chem11", "name": "Chemistry", "code": "CHM11", "isDifficult": True, "periods": 4},
        {"id": "bio11", "name": "Biology", "code": "BIO11", "periods": 3},
        {"id": "hist11", "name": "History", "code": "HIS11", "periods": 2},
        {"id": "geo11", "name": "Geography", "code": "GEO11", "periods": 2},
        {"id": "comp11", "name": "Computer Science", "code": "CMP11", "periods": 2},
        {"id": "pe11", "name": "Physical Education", "code": "PE11", "periods": 2},
        {"id": "art11", "name": "Art", "code": "ART11", "periods": 2},
        {"id": "arabic11", "name": "Arabic", "code": "ARB11", "periods": 2},
    ],  # Total: 42 periods
    12: [
        {"id": "math12", "name": "Mathematics", "code": "MTH12", "isDifficult": True, "periods": 5},
        {"id": "dari12", "name": "Dari Language", "code": "DRI12", "periods": 4},
        {"id": "pashto12", "name": "Pashto Language", "code": "PSH12", "periods": 3},
        {"id": "eng12", "name": "English", "code": "ENG12", "periods": 4},
        {"id": "islam12", "name": "Islamic Studies", "code": "ISL12", "periods": 3},
        {"id": "phys12", "name": "Physics", "code": "PHY12", "isDifficult": True, "periods": 4},
        {"id": "chem12", "name": "Chemistry", "code": "CHM12", "isDifficult": True, "periods": 4},
        {"id": "bio12", "name": "Biology", "code": "BIO12", "periods": 3},
        {"id": "hist12", "name": "History", "code": "HIS12", "periods": 2},
        {"id": "geo12", "name": "Geography", "code": "GEO12", "periods": 2},
        {"id": "comp12", "name": "Computer Science", "code": "CMP12", "periods": 2},
        {"id": "pe12", "name": "Physical Education", "code": "PE12", "periods": 2},
        {"id": "art12", "name": "Art", "code": "ART12", "periods": 2},
        {"id": "econ12", "name": "Economics", "code": "ECN12", "periods": 2},
    ],  # Total: 42 periods
}


def generate_availability(days: List[str], periods_per_day: int, break_period: int = 3) -> Dict:
    """Generate teacher availability matrix (all available except break period)."""
    availability = {}
    for day in days:
        availability[day] = [True] * periods_per_day
        # Break period is not available
        if break_period < periods_per_day:
            availability[day][break_period] = False
    return availability


def generate_teachers(grades: List[int], num_math_teachers: int = 6) -> List[Dict]:
    """Generate realistic teacher pool."""
    teachers = []
    teacher_id = 1
    
    # First, collect all subject IDs for reference
    all_subject_ids = set()
    for g in grades:
        for subject in AFGHAN_SUBJECTS[g]:
            all_subject_ids.add(subject["id"])
    
    # Mathematics teachers (teach across grades)
    math_subjects = [f"math{g}" for g in grades]
    for i in range(num_math_teachers):
        teachers.append({
            "id": f"T{teacher_id}",
            "fullName": f"Math Teacher {i+1}",
            "primarySubjectIds": math_subjects[:2] if len(math_subjects) > 2 else math_subjects,
            "allowedSubjectIds": math_subjects,
            "restrictToPrimarySubjects": False,
            "availability": generate_availability(
                ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"], 8
            ),
            "maxPeriodsPerWeek": 36,
            "maxPeriodsPerDay": 6,
            "timePreference": "Morning"
        })
        teacher_id += 1
    
    # Science teachers (Physics, Chemistry, Biology)
    science_subjects = []
    for g in grades:
        if g >= 9:
            science_subjects.extend([f"phys{g}", f"chem{g}", f"bio{g}"])
        else:
            science_subjects.append(f"sci{g}")
    
    for i in range(5):
        teachers.append({
            "id": f"T{teacher_id}",
            "fullName": f"Science Teacher {i+1}",
            "primarySubjectIds": science_subjects[:3] if len(science_subjects) > 3 else science_subjects,
            "allowedSubjectIds": science_subjects,
            "restrictToPrimarySubjects": False,
            "availability": generate_availability(
                ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"], 8
            ),
            "maxPeriodsPerWeek": 36,
            "maxPeriodsPerDay": 6,
            "timePreference": "Morning"
        })
        teacher_id += 1
    
    # Language teachers (Dari, Pashto, English)
    for lang in ["dari", "pashto", "eng"]:
        lang_subjects = [f"{lang}{g}" for g in grades]
        for i in range(3):
            teachers.append({
                "id": f"T{teacher_id}",
                "fullName": f"{lang.capitalize()} Teacher {i+1}",
                "primarySubjectIds": lang_subjects,
                "availability": generate_availability(
                    ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"], 8
                ),
                "maxPeriodsPerWeek": 36,
                "maxPeriodsPerDay": 6
            })
            teacher_id += 1
    
    # Islamic Studies teachers
    islam_subjects = [f"islam{g}" for g in grades]
    for i in range(3):
        teachers.append({
            "id": f"T{teacher_id}",
            "fullName": f"Islamic Studies Teacher {i+1}",
            "primarySubjectIds": islam_subjects,
            "availability": generate_availability(
                ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"], 8
            ),
            "maxPeriodsPerWeek": 30,
            "maxPeriodsPerDay": 5
        })
        teacher_id += 1
    
    # History and Geography teachers (now included in all grades)
    hist_geo_subjects = []
    for g in grades:
        hist_geo_subjects.extend([f"hist{g}", f"geo{g}"])
    
    for i in range(4):  # Increased from 3 to 4 teachers
        teachers.append({
            "id": f"T{teacher_id}",
            "fullName": f"Social Studies Teacher {i+1}",
            "primarySubjectIds": hist_geo_subjects[:4] if len(hist_geo_subjects) > 4 else hist_geo_subjects,
            "allowedSubjectIds": hist_geo_subjects,
            "restrictToPrimarySubjects": False,
            "availability": generate_availability(
                ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"], 8
            ),
            "maxPeriodsPerWeek": 36,  # Increased from 30
            "maxPeriodsPerDay": 6      # Increased from 5
        })
        teacher_id += 1
    
    # Quran and Arabic teachers (new - for all grades)
    quran_arabic_subjects = []
    for g in grades:
        if f"quran{g}" in all_subject_ids:
            quran_arabic_subjects.append(f"quran{g}")
        if f"arabic{g}" in all_subject_ids:
            quran_arabic_subjects.append(f"arabic{g}")
    
    if quran_arabic_subjects:
        for i in range(4):
            teachers.append({
                "id": f"T{teacher_id}",
                "fullName": f"Quran/Arabic Teacher {i+1}",
                "primarySubjectIds": quran_arabic_subjects[:3] if len(quran_arabic_subjects) > 3 else quran_arabic_subjects,
                "allowedSubjectIds": quran_arabic_subjects,
                "restrictToPrimarySubjects": False,
                "availability": generate_availability(
                    ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"], 8
                ),
                "maxPeriodsPerWeek": 36,
                "maxPeriodsPerDay": 6
            })
            teacher_id += 1
    
    # Additional teachers for electives (PE, Art, Computer, Economics) - all grades
    elective_subjects = []
    for g in grades:
        if f"pe{g}" in all_subject_ids:
            elective_subjects.append(f"pe{g}")
        if f"art{g}" in all_subject_ids:
            elective_subjects.append(f"art{g}")
        if f"comp{g}" in all_subject_ids:
            elective_subjects.append(f"comp{g}")
        if f"econ{g}" in all_subject_ids:
            elective_subjects.append(f"econ{g}")
    
    if elective_subjects:
        for i in range(5):  # Increased from 3 to 5 teachers
            teachers.append({
                "id": f"T{teacher_id}",
                "fullName": f"Elective Teacher {i+1}",
                "primarySubjectIds": elective_subjects[:4] if len(elective_subjects) > 4 else elective_subjects,
                "allowedSubjectIds": elective_subjects,
                "restrictToPrimarySubjects": False,
                "availability": generate_availability(
                    ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"], 8
                ),
                "maxPeriodsPerWeek": 36,  # Increased from 30
                "maxPeriodsPerDay": 6      # Increased from 5
            })
            teacher_id += 1
    
    return teachers


def generate_rooms(num_rooms: int) -> List[Dict]:
    """Generate classroom data."""
    rooms = []
    for i in range(1, num_rooms + 1):
        rooms.append({
            "id": f"R{i}",
            "name": f"Room {i}",
            "capacity": 35,
            "type": "Regular",
            "features": ["whiteboard", "projector"] if i % 3 == 0 else ["whiteboard"]
        })
    return rooms


def generate_test_data(grades: List[int], sections: List[str], test_name: str) -> Dict:
    """Generate complete test data for specified grades and sections."""
    
    # Collect all subjects
    all_subjects = []
    for grade in grades:
        for subject in AFGHAN_SUBJECTS[grade]:
            all_subjects.append({
                "id": subject["id"],
                "name": subject["name"],
                "code": subject.get("code", subject["id"].upper()),
                "requiredRoomType": "Regular",
                "isDifficult": subject.get("isDifficult", False)
            })
    
    # Generate classes
    classes = []
    for grade in grades:
        for section in sections:
            class_id = f"{grade}{section}"
            
            # Calculate total periods required
            subject_requirements = {}
            total_periods = 0
            for subject in AFGHAN_SUBJECTS[grade]:
                periods = subject["periods"]
                subject_requirements[subject["id"]] = {
                    "periodsPerWeek": periods,
                    "minConsecutive": 1,
                    "maxConsecutive": 2 if periods > 2 else periods
                }
                total_periods += periods
            
            classes.append({
                "id": class_id,
                "name": f"Grade {grade} Section {section}",
                "studentCount": 30,
                "subjectRequirements": subject_requirements
            })
            
            print(f"Class {class_id}: {len(subject_requirements)} subjects, {total_periods} periods/week", file=sys.stderr)
    
    # Generate teachers
    teachers = generate_teachers(grades)
    
    # Generate rooms (2 rooms per class to allow flexibility)
    num_rooms = len(classes) * 2
    rooms = generate_rooms(num_rooms)
    
    # Configuration
    config = {
        "daysOfWeek": ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"],
        "periodsPerDay": 8,
        "schoolStartTime": "08:00",
        "periodDurationMinutes": 40,
        "breakPeriods": [{"afterPeriod": 4, "duration": 30}],  # 30 min break after 4th period
        "solverTimeLimitSeconds": 1800,  # 30 minutes
        "solverOptimizationLevel": 1,  # Balanced
        "enableGracefulDegradation": True
    }
    
    preferences = {
        "avoidTeacherGapsWeight": 0.5,  # Reduced weight for performance
        "avoidClassGapsWeight": 0.0,  # Disabled - we have HARD constraint for this
        "distributeDifficultSubjectsWeight": 0.3,
        "balanceTeacherLoadWeight": 0.5,
        "minimizeRoomChangesWeight": 0.2,
        "preferMorningForDifficultWeight": 0.4,
        "respectTeacherTimePreferenceWeight": 0.3,
        "respectTeacherRoomPreferenceWeight": 0.1,
        "allowConsecutivePeriodsForSameSubject": True
    }
    
    data = {
        "meta": {
            "test_name": test_name,
            "num_classes": len(classes),
            "num_subjects": len(all_subjects),
            "num_teachers": len(teachers),
            "num_rooms": len(rooms)
        },
        "config": config,
        "preferences": preferences,
        "rooms": rooms,
        "subjects": all_subjects,
        "teachers": teachers,
        "classes": classes
    }
    
    # Print summary
    total_lessons = sum(
        sum(req["periodsPerWeek"] for req in cls["subjectRequirements"].values())
        for cls in classes
    )
    
    print(f"\n=== {test_name} Summary ===", file=sys.stderr)
    print(f"Classes: {len(classes)}", file=sys.stderr)
    print(f"Subjects: {len(all_subjects)}", file=sys.stderr)
    print(f"Teachers: {len(teachers)}", file=sys.stderr)
    print(f"Rooms: {len(rooms)}", file=sys.stderr)
    print(f"Total lessons to schedule: {total_lessons}", file=sys.stderr)
    print(f"Available slots: {len(classes)} × {len(config['daysOfWeek'])} × {config['periodsPerDay']-len(config['breakPeriods'])} = {len(classes) * len(config['daysOfWeek']) * (config['periodsPerDay']-len(config['breakPeriods']))}", file=sys.stderr)
    print(f"Utilization: {total_lessons / (len(classes) * len(config['daysOfWeek']) * (config['periodsPerDay']-len(config['breakPeriods']))):.1%}", file=sys.stderr)
    
    return data


if __name__ == "__main__":
    # Test 1: 6 classes (Grades 7-8, sections A, B, C)
    test1 = generate_test_data([7, 8], ["A", "B", "C"], "Test 1: 6 Classes")
    with open("test_6_classes.json", "w", encoding="utf-8") as f:
        json.dump(test1, f, indent=2, ensure_ascii=False)
    print(f"✓ Generated test_6_classes.json", file=sys.stderr)
    
    # Test 2: 12 classes (Grades 7-10, sections A, B, C)
    test2 = generate_test_data([7, 8, 9, 10], ["A", "B", "C"], "Test 2: 12 Classes")
    with open("test_12_classes.json", "w", encoding="utf-8") as f:
        json.dump(test2, f, indent=2, ensure_ascii=False)
    print(f"✓ Generated test_12_classes.json", file=sys.stderr)
    
    # Test 3: 18 classes (Grades 7-12, sections A, B, C)
    test3 = generate_test_data([7, 8, 9, 10, 11, 12], ["A", "B", "C"], "Test 3: 18 Classes (Full Scale)")
    with open("test_18_classes_full.json", "w", encoding="utf-8") as f:
        json.dump(test3, f, indent=2, ensure_ascii=False)
    print(f"✓ Generated test_18_classes_full.json", file=sys.stderr)
    
    print("\n✓ All test files generated successfully!", file=sys.stderr)

