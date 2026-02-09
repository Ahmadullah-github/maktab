# ==============================================================================
#
#  Afghanistan Ministry of Education Curriculum Data
#
#  Description:
#  Official curriculum requirements from the Ministry of Education.
#  Used for validation when ministry validation is enabled.
#
# ==============================================================================

from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
from enum import Enum


class GradeCategory(str, Enum):
    """Grade categories in Afghanistan education system."""

    ALPHA_PRIMARY = "Alpha-Primary"  # Grades 1-3
    BETA_PRIMARY = "Beta-Primary"  # Grades 4-6
    MIDDLE = "Middle"  # Grades 7-9
    HIGH = "High"  # Grades 10-12


class SubjectDefinition(BaseModel):
    """Ministry-defined subject with required periods."""

    name: str = Field(description="Farsi name")
    nameEn: str = Field(description="English name")
    code: str = Field(description="Subject code")
    periodsPerWeek: int = Field(ge=0, description="Ministry-mandated periods")
    isDifficult: bool = Field(default=False)
    requiredRoomType: Optional[str] = Field(default=None)
    isCore: bool = Field(
        default=False, description="Core subjects cannot be removed in strict mode"
    )


class GradeCurriculumInfo(BaseModel):
    """Curriculum information for a specific grade."""

    grade: int
    category: Optional[GradeCategory] = None
    subjects: List[SubjectDefinition] = Field(default_factory=list)
    totalPeriods: int = Field(default=0)
    expectedPeriods: int = Field(default=42)


# ==============================================================================
# Grade Category Mapping
# ==============================================================================

GRADE_TO_CATEGORY: Dict[int, GradeCategory] = {
    1: GradeCategory.ALPHA_PRIMARY,
    2: GradeCategory.ALPHA_PRIMARY,
    3: GradeCategory.ALPHA_PRIMARY,
    4: GradeCategory.BETA_PRIMARY,
    5: GradeCategory.BETA_PRIMARY,
    6: GradeCategory.BETA_PRIMARY,
    7: GradeCategory.MIDDLE,
    8: GradeCategory.MIDDLE,
    9: GradeCategory.MIDDLE,
    10: GradeCategory.HIGH,
    11: GradeCategory.HIGH,
    12: GradeCategory.HIGH,
}

EXPECTED_PERIODS: Dict[GradeCategory, int] = {
    GradeCategory.ALPHA_PRIMARY: 24,
    GradeCategory.BETA_PRIMARY: 32,
    GradeCategory.MIDDLE: 36,
    GradeCategory.HIGH: 36,
}


def get_grade_category(grade: int) -> Optional[GradeCategory]:
    """Get the category for a grade level."""
    return GRADE_TO_CATEGORY.get(grade)


def get_expected_periods(grade: int) -> int:
    """Get expected total periods for a grade."""
    category = get_grade_category(grade)
    return EXPECTED_PERIODS.get(category, 42) if category else 42


# ==============================================================================
# Ministry Curriculum Data (Default)
# ==============================================================================

# This is the default ministry curriculum used when no custom curriculum is provided.
# Schools can override this via the API's curriculum configuration.

MINISTRY_CURRICULUM: Dict[int, List[Dict[str, Any]]] = {
    1: [
        {
            "name": "دری",
            "nameEn": "Dari Language",
            "code": "دری۱",
            "periodsPerWeek": 6,
            "isCore": True,
        },
        {
            "name": "ریاضی",
            "nameEn": "Mathematics",
            "code": "ریض۱",
            "periodsPerWeek": 5,
            "isCore": True,
        },
        {
            "name": "تعلیم و تربیه اسلامی",
            "nameEn": "Islamic Studies",
            "code": "اسل۱",
            "periodsPerWeek": 5,
            "isCore": True,
        },
        {
            "name": "قرآن‌کریم",
            "nameEn": "Holy Quran",
            "code": "قرآ۱",
            "periodsPerWeek": 5,
            "isCore": True,
        },
        {
            "name": "تربیت بدنی",
            "nameEn": "Physical Education",
            "code": "ترب۱",
            "periodsPerWeek": 1,
        },
        {
            "name": "رسم و خط",
            "nameEn": "Art & Calligraphy",
            "code": "رسم۱",
            "periodsPerWeek": 2,
        },
    ],
    2: [
        {
            "name": "دری",
            "nameEn": "Dari Language",
            "code": "دری۲",
            "periodsPerWeek": 6,
            "isCore": True,
        },
        {
            "name": "ریاضی",
            "nameEn": "Mathematics",
            "code": "ریض۲",
            "periodsPerWeek": 5,
            "isCore": True,
        },
        {
            "name": "تعلیم و تربیه اسلامی",
            "nameEn": "Islamic Studies",
            "code": "اسل۲",
            "periodsPerWeek": 5,
            "isCore": True,
        },
        {
            "name": "قرآن‌کریم",
            "nameEn": "Holy Quran",
            "code": "قرآ۲",
            "periodsPerWeek": 5,
            "isCore": True,
        },
        {
            "name": "تربیت بدنی",
            "nameEn": "Physical Education",
            "code": "ترب۲",
            "periodsPerWeek": 1,
        },
        {
            "name": "رسم و خط",
            "nameEn": "Art & Calligraphy",
            "code": "رسم۲",
            "periodsPerWeek": 2,
        },
    ],
    3: [
        {
            "name": "دری",
            "nameEn": "Dari Language",
            "code": "دری۳",
            "periodsPerWeek": 6,
            "isCore": True,
        },
        {
            "name": "ریاضی",
            "nameEn": "Mathematics",
            "code": "ریض۳",
            "periodsPerWeek": 5,
            "isCore": True,
        },
        {
            "name": "تعلیم و تربیه اسلامی",
            "nameEn": "Islamic Studies",
            "code": "اسل۳",
            "periodsPerWeek": 5,
            "isCore": True,
        },
        {
            "name": "قرآن‌کریم",
            "nameEn": "Holy Quran",
            "code": "قرآ۳",
            "periodsPerWeek": 5,
            "isCore": True,
        },
        {
            "name": "تربیت بدنی",
            "nameEn": "Physical Education",
            "code": "ترب۳",
            "periodsPerWeek": 1,
        },
        {
            "name": "رسم و خط",
            "nameEn": "Art & Calligraphy",
            "code": "رسم۳",
            "periodsPerWeek": 2,
        },
    ],
}


# Grades 4-6 (Beta-Primary)
MINISTRY_CURRICULUM[4] = [
    {
        "name": "دری",
        "nameEn": "Dari Language",
        "code": "دری۴",
        "periodsPerWeek": 4,
        "isCore": True,
    },
    {
        "name": "پشتو",
        "nameEn": "Pashto Language",
        "code": "پشت۴",
        "periodsPerWeek": 3,
        "isCore": True,
    },
    {"name": "انگلیسی", "nameEn": "English", "code": "انگ۴", "periodsPerWeek": 2},
    {
        "name": "ریاضی",
        "nameEn": "Mathematics",
        "code": "ریض۴",
        "periodsPerWeek": 5,
        "isDifficult": True,
        "isCore": True,
    },
    {
        "name": "تعلیم و تربیه اسلامی",
        "nameEn": "Islamic Studies",
        "code": "اسل۴",
        "periodsPerWeek": 4,
        "isCore": True,
    },
    {
        "name": "قرآن‌کریم",
        "nameEn": "Holy Quran",
        "code": "قرآ۴",
        "periodsPerWeek": 5,
        "isCore": True,
    },
    {"name": "ساینس", "nameEn": "Science", "code": "ساین۴", "periodsPerWeek": 2},
    {
        "name": "دروس اجتماعی",
        "nameEn": "Social Studies",
        "code": "اجت۴",
        "periodsPerWeek": 2,
    },
    {
        "name": "رسم و خط",
        "nameEn": "Art & Calligraphy",
        "code": "رسم۴",
        "periodsPerWeek": 2,
    },
    {
        "name": "تربیت بدنی",
        "nameEn": "Physical Education",
        "code": "ترب۴",
        "periodsPerWeek": 1,
    },
    {
        "name": "حرفه",
        "nameEn": "Vocational Skills",
        "code": "حرف۴",
        "periodsPerWeek": 2,
    },
]

MINISTRY_CURRICULUM[5] = [
    {
        "name": "دری",
        "nameEn": "Dari Language",
        "code": "دری۵",
        "periodsPerWeek": 4,
        "isCore": True,
    },
    {
        "name": "پشتو",
        "nameEn": "Pashto Language",
        "code": "پشت۵",
        "periodsPerWeek": 3,
        "isCore": True,
    },
    {"name": "انگلیسی", "nameEn": "English", "code": "انگ۵", "periodsPerWeek": 2},
    {
        "name": "ریاضی",
        "nameEn": "Mathematics",
        "code": "ریض۵",
        "periodsPerWeek": 5,
        "isDifficult": True,
        "isCore": True,
    },
    {
        "name": "تعلیم و تربیه اسلامی",
        "nameEn": "Islamic Studies",
        "code": "اسل۵",
        "periodsPerWeek": 4,
        "isCore": True,
    },
    {
        "name": "قرآن‌کریم",
        "nameEn": "Holy Quran",
        "code": "قرآ۵",
        "periodsPerWeek": 5,
        "isCore": True,
    },
    {"name": "ساینس", "nameEn": "Science", "code": "ساین۵", "periodsPerWeek": 2},
    {
        "name": "دروس اجتماعی",
        "nameEn": "Social Studies",
        "code": "اجت۵",
        "periodsPerWeek": 2,
    },
    {
        "name": "رسم و خط",
        "nameEn": "Art & Calligraphy",
        "code": "رسم۵",
        "periodsPerWeek": 2,
    },
    {
        "name": "تربیت بدنی",
        "nameEn": "Physical Education",
        "code": "ترب۵",
        "periodsPerWeek": 1,
    },
    {
        "name": "حرفه",
        "nameEn": "Vocational Skills",
        "code": "حرف۵",
        "periodsPerWeek": 2,
    },
]

MINISTRY_CURRICULUM[6] = [
    {
        "name": "دری",
        "nameEn": "Dari Language",
        "code": "دری۶",
        "periodsPerWeek": 4,
        "isCore": True,
    },
    {
        "name": "پشتو",
        "nameEn": "Pashto Language",
        "code": "پشت۶",
        "periodsPerWeek": 3,
        "isCore": True,
    },
    {"name": "انگلیسی", "nameEn": "English", "code": "انگ۶", "periodsPerWeek": 2},
    {
        "name": "ریاضی",
        "nameEn": "Mathematics",
        "code": "ریض۶",
        "periodsPerWeek": 5,
        "isDifficult": True,
        "isCore": True,
    },
    {
        "name": "تعلیم و تربیه اسلامی",
        "nameEn": "Islamic Studies",
        "code": "اسل۶",
        "periodsPerWeek": 4,
        "isCore": True,
    },
    {
        "name": "قرآن‌کریم",
        "nameEn": "Holy Quran",
        "code": "قرآ۶",
        "periodsPerWeek": 5,
        "isCore": True,
    },
    {"name": "ساینس", "nameEn": "Science", "code": "ساین۶", "periodsPerWeek": 2},
    {
        "name": "دروس اجتماعی",
        "nameEn": "Social Studies",
        "code": "اجت۶",
        "periodsPerWeek": 2,
    },
    {
        "name": "رسم و خط",
        "nameEn": "Art & Calligraphy",
        "code": "رسم۶",
        "periodsPerWeek": 2,
    },
    {
        "name": "تربیت بدنی",
        "nameEn": "Physical Education",
        "code": "ترب۶",
        "periodsPerWeek": 1,
    },
    {
        "name": "حرفه",
        "nameEn": "Vocational Skills",
        "code": "حرف۶",
        "periodsPerWeek": 2,
    },
]


# Grades 7-9 (Middle School)
MINISTRY_CURRICULUM[7] = [
    {
        "name": "ریاضی",
        "nameEn": "Mathematics",
        "code": "ریض۷",
        "periodsPerWeek": 5,
        "isDifficult": True,
        "isCore": True,
    },
    {
        "name": "دری",
        "nameEn": "Dari Language",
        "code": "دری۷",
        "periodsPerWeek": 3,
        "isCore": True,
    },
    {
        "name": "پشتو",
        "nameEn": "Pashto Language",
        "code": "پشت۷",
        "periodsPerWeek": 3,
        "isCore": True,
    },
    {"name": "عربی", "nameEn": "Arabic Language", "code": "عرب۷", "periodsPerWeek": 3},
    {"name": "انگلیسی", "nameEn": "English", "code": "انگ۷", "periodsPerWeek": 2},
    {
        "name": "تعلیم و تربیه اسلامی",
        "nameEn": "Islamic Studies",
        "code": "اسل۷",
        "periodsPerWeek": 3,
        "isCore": True,
    },
    {
        "name": "قرآن‌کریم",
        "nameEn": "Holy Quran",
        "code": "قرآ۷",
        "periodsPerWeek": 3,
        "isCore": True,
    },
    {
        "name": "فزیک",
        "nameEn": "Physics",
        "code": "فزی۷",
        "periodsPerWeek": 3,
        "isDifficult": True,
        "requiredRoomType": "lab",
    },
    {
        "name": "کیمیا",
        "nameEn": "Chemistry",
        "code": "کیم۷",
        "periodsPerWeek": 3,
        "isDifficult": True,
        "requiredRoomType": "lab",
    },
    {
        "name": "بیولوژی",
        "nameEn": "Biology",
        "code": "بیو۷",
        "periodsPerWeek": 2,
        "requiredRoomType": "lab",
    },
    {"name": "تاریخ", "nameEn": "History", "code": "تار۷", "periodsPerWeek": 2},
    {"name": "جغرافیه", "nameEn": "Geography", "code": "جغر۷", "periodsPerWeek": 2},
    {
        "name": "تربیت بدنی",
        "nameEn": "Physical Education",
        "code": "ترب۷",
        "periodsPerWeek": 1,
    },
    {
        "name": "حرفه",
        "nameEn": "Vocational Skills",
        "code": "حرف۷",
        "periodsPerWeek": 1,
    },
]

MINISTRY_CURRICULUM[8] = [
    {
        "name": "ریاضی",
        "nameEn": "Mathematics",
        "code": "ریض۸",
        "periodsPerWeek": 5,
        "isDifficult": True,
        "isCore": True,
    },
    {
        "name": "دری",
        "nameEn": "Dari Language",
        "code": "دری۸",
        "periodsPerWeek": 3,
        "isCore": True,
    },
    {
        "name": "پشتو",
        "nameEn": "Pashto Language",
        "code": "پشت۸",
        "periodsPerWeek": 3,
        "isCore": True,
    },
    {"name": "عربی", "nameEn": "Arabic Language", "code": "عرب۸", "periodsPerWeek": 3},
    {"name": "انگلیسی", "nameEn": "English", "code": "انگ۸", "periodsPerWeek": 2},
    {
        "name": "تعلیم و تربیه اسلامی",
        "nameEn": "Islamic Studies",
        "code": "اسل۸",
        "periodsPerWeek": 3,
        "isCore": True,
    },
    {
        "name": "قرآن‌کریم",
        "nameEn": "Holy Quran",
        "code": "قرآ۸",
        "periodsPerWeek": 3,
        "isCore": True,
    },
    {
        "name": "فزیک",
        "nameEn": "Physics",
        "code": "فزی۸",
        "periodsPerWeek": 3,
        "isDifficult": True,
        "requiredRoomType": "lab",
    },
    {
        "name": "کیمیا",
        "nameEn": "Chemistry",
        "code": "کیم۸",
        "periodsPerWeek": 3,
        "isDifficult": True,
        "requiredRoomType": "lab",
    },
    {
        "name": "بیولوژی",
        "nameEn": "Biology",
        "code": "بیو۸",
        "periodsPerWeek": 2,
        "requiredRoomType": "lab",
    },
    {"name": "تاریخ", "nameEn": "History", "code": "تار۸", "periodsPerWeek": 2},
    {"name": "جغرافیه", "nameEn": "Geography", "code": "جغر۸", "periodsPerWeek": 2},
    {
        "name": "تربیت بدنی",
        "nameEn": "Physical Education",
        "code": "ترب۸",
        "periodsPerWeek": 1,
    },
    {
        "name": "حرفه",
        "nameEn": "Vocational Skills",
        "code": "حرف۸",
        "periodsPerWeek": 1,
    },
]

MINISTRY_CURRICULUM[9] = [
    {
        "name": "ریاضی",
        "nameEn": "Mathematics",
        "code": "ریض۹",
        "periodsPerWeek": 5,
        "isDifficult": True,
        "isCore": True,
    },
    {
        "name": "دری",
        "nameEn": "Dari Language",
        "code": "دری۹",
        "periodsPerWeek": 3,
        "isCore": True,
    },
    {
        "name": "پشتو",
        "nameEn": "Pashto Language",
        "code": "پشت۹",
        "periodsPerWeek": 3,
        "isCore": True,
    },
    {"name": "عربی", "nameEn": "Arabic Language", "code": "عرب۹", "periodsPerWeek": 3},
    {"name": "انگلیسی", "nameEn": "English", "code": "انگ۹", "periodsPerWeek": 2},
    {
        "name": "تعلیم و تربیه اسلامی",
        "nameEn": "Islamic Studies",
        "code": "اسل۹",
        "periodsPerWeek": 3,
        "isCore": True,
    },
    {
        "name": "قرآن‌کریم",
        "nameEn": "Holy Quran",
        "code": "قرآ۹",
        "periodsPerWeek": 3,
        "isCore": True,
    },
    {
        "name": "فزیک",
        "nameEn": "Physics",
        "code": "فزی۹",
        "periodsPerWeek": 3,
        "isDifficult": True,
        "requiredRoomType": "lab",
    },
    {
        "name": "کیمیا",
        "nameEn": "Chemistry",
        "code": "کیم۹",
        "periodsPerWeek": 3,
        "isDifficult": True,
        "requiredRoomType": "lab",
    },
    {
        "name": "بیولوژی",
        "nameEn": "Biology",
        "code": "بیو۹",
        "periodsPerWeek": 2,
        "requiredRoomType": "lab",
    },
    {"name": "تاریخ", "nameEn": "History", "code": "تار۹", "periodsPerWeek": 2},
    {"name": "جغرافیه", "nameEn": "Geography", "code": "جغر۹", "periodsPerWeek": 2},
    {
        "name": "تربیت بدنی",
        "nameEn": "Physical Education",
        "code": "ترب۹",
        "periodsPerWeek": 1,
    },
    {
        "name": "حرفه",
        "nameEn": "Vocational Skills",
        "code": "حرف۹",
        "periodsPerWeek": 1,
    },
]


# Grades 10-12 (High School)
MINISTRY_CURRICULUM[10] = [
    {
        "name": "ریاضی",
        "nameEn": "Mathematics",
        "code": "ریض۱۰",
        "periodsPerWeek": 6,
        "isDifficult": True,
        "isCore": True,
    },
    {
        "name": "دری",
        "nameEn": "Dari Language",
        "code": "دری۱۰",
        "periodsPerWeek": 3,
        "isDifficult": True,
        "isCore": True,
    },
    {
        "name": "پشتو",
        "nameEn": "Pashto Language",
        "code": "پشت۱۰",
        "periodsPerWeek": 2,
        "isCore": True,
    },
    {"name": "انگلیسی", "nameEn": "English", "code": "انگ۱۰", "periodsPerWeek": 2},
    {
        "name": "تعلیم و تربیه اسلامی",
        "nameEn": "Islamic Studies",
        "code": "اسل۱۰",
        "periodsPerWeek": 3,
        "isCore": True,
    },
    {
        "name": "تفسیر",
        "nameEn": "Tafsir",
        "code": "تفس۱۰",
        "periodsPerWeek": 3,
        "isCore": True,
    },
    {
        "name": "فزیک",
        "nameEn": "Physics",
        "code": "فزی۱۰",
        "periodsPerWeek": 3,
        "isDifficult": True,
        "requiredRoomType": "lab",
    },
    {
        "name": "کیمیا",
        "nameEn": "Chemistry",
        "code": "کیم۱۰",
        "periodsPerWeek": 3,
        "isDifficult": True,
        "requiredRoomType": "lab",
    },
    {
        "name": "بیولوژی",
        "nameEn": "Biology",
        "code": "بیو۱۰",
        "periodsPerWeek": 2,
        "requiredRoomType": "lab",
    },
    {
        "name": "جیولوژی",
        "nameEn": "Geology",
        "code": "جیو۱۰",
        "periodsPerWeek": 2,
        "requiredRoomType": "lab",
    },
    {"name": "تاریخ", "nameEn": "History", "code": "تار۱۰", "periodsPerWeek": 2},
    {"name": "جغرافیه", "nameEn": "Geography", "code": "جغر۱۰", "periodsPerWeek": 2},
    {
        "name": "تربیت بدنی",
        "nameEn": "Physical Education",
        "code": "ترب۱۰",
        "periodsPerWeek": 1,
    },
    {
        "name": "کمپیوتر",
        "nameEn": "Computer",
        "code": "کمپ۱۰",
        "periodsPerWeek": 2,
        "requiredRoomType": "computer_lab",
    },
]

MINISTRY_CURRICULUM[11] = [
    {
        "name": "ریاضی",
        "nameEn": "Mathematics",
        "code": "ریض۱۱",
        "periodsPerWeek": 6,
        "isDifficult": True,
        "isCore": True,
    },
    {
        "name": "دری",
        "nameEn": "Dari Language",
        "code": "دری۱۱",
        "periodsPerWeek": 3,
        "isDifficult": True,
        "isCore": True,
    },
    {
        "name": "پشتو",
        "nameEn": "Pashto Language",
        "code": "پشت۱۱",
        "periodsPerWeek": 2,
        "isCore": True,
    },
    {"name": "انگلیسی", "nameEn": "English", "code": "انگ۱۱", "periodsPerWeek": 2},
    {
        "name": "تعلیم و تربیه اسلامی",
        "nameEn": "Islamic Studies",
        "code": "اسل۱۱",
        "periodsPerWeek": 4,
        "isCore": True,
    },
    {
        "name": "تفسیر",
        "nameEn": "Tafsir",
        "code": "تفس۱۱",
        "periodsPerWeek": 3,
        "isCore": True,
    },
    {
        "name": "فزیک",
        "nameEn": "Physics",
        "code": "فزی۱۱",
        "periodsPerWeek": 3,
        "isDifficult": True,
        "requiredRoomType": "lab",
    },
    {
        "name": "کیمیا",
        "nameEn": "Chemistry",
        "code": "کیم۱۱",
        "periodsPerWeek": 3,
        "isDifficult": True,
        "requiredRoomType": "lab",
    },
    {
        "name": "بیولوژی",
        "nameEn": "Biology",
        "code": "بیو۱۱",
        "periodsPerWeek": 3,
        "requiredRoomType": "lab",
    },
    {"name": "تاریخ", "nameEn": "History", "code": "تار۱۱", "periodsPerWeek": 2},
    {"name": "جغرافیه", "nameEn": "Geography", "code": "جغر۱۱", "periodsPerWeek": 2},
    {
        "name": "تربیت بدنی",
        "nameEn": "Physical Education",
        "code": "ترب۱۱",
        "periodsPerWeek": 1,
    },
    {
        "name": "کمپیوتر",
        "nameEn": "Computer",
        "code": "کمپ۱۱",
        "periodsPerWeek": 2,
        "requiredRoomType": "computer_lab",
    },
]

MINISTRY_CURRICULUM[12] = [
    {
        "name": "ریاضی",
        "nameEn": "Mathematics",
        "code": "ریض۱۲",
        "periodsPerWeek": 6,
        "isDifficult": True,
        "isCore": True,
    },
    {
        "name": "دری",
        "nameEn": "Dari Language",
        "code": "دری۱۲",
        "periodsPerWeek": 3,
        "isDifficult": True,
        "isCore": True,
    },
    {
        "name": "پشتو",
        "nameEn": "Pashto Language",
        "code": "پشت۱۲",
        "periodsPerWeek": 2,
        "isCore": True,
    },
    {"name": "انگلیسی", "nameEn": "English", "code": "انگ۱۲", "periodsPerWeek": 2},
    {
        "name": "تعلیم و تربیه اسلامی",
        "nameEn": "Islamic Studies",
        "code": "اسل۱۲",
        "periodsPerWeek": 4,
        "isCore": True,
    },
    {
        "name": "تفسیر",
        "nameEn": "Tafsir",
        "code": "تفس۱۲",
        "periodsPerWeek": 3,
        "isCore": True,
    },
    {
        "name": "فزیک",
        "nameEn": "Physics",
        "code": "فزی۱۲",
        "periodsPerWeek": 3,
        "isDifficult": True,
        "requiredRoomType": "lab",
    },
    {
        "name": "کیمیا",
        "nameEn": "Chemistry",
        "code": "کیم۱۲",
        "periodsPerWeek": 3,
        "isDifficult": True,
        "requiredRoomType": "lab",
    },
    {
        "name": "بیولوژی",
        "nameEn": "Biology",
        "code": "بیو۱۲",
        "periodsPerWeek": 3,
        "requiredRoomType": "lab",
    },
    {"name": "تاریخ", "nameEn": "History", "code": "تار۱۲", "periodsPerWeek": 2},
    {"name": "جغرافیه", "nameEn": "Geography", "code": "جغر۱۲", "periodsPerWeek": 2},
    {
        "name": "تربیت بدنی",
        "nameEn": "Physical Education",
        "code": "ترب۱۲",
        "periodsPerWeek": 1,
    },
    {
        "name": "کمپیوتر",
        "nameEn": "Computer",
        "code": "کمپ۱۲",
        "periodsPerWeek": 2,
        "requiredRoomType": "computer_lab",
    },
]


# ==============================================================================
# Curriculum Helper Functions
# ==============================================================================


def get_ministry_subjects(grade: int) -> List[Dict[str, Any]]:
    """Get ministry curriculum subjects for a grade."""
    return MINISTRY_CURRICULUM.get(grade, [])


def get_ministry_subject_periods(grade: int, subject_name: str) -> int:
    """Get required periods for a subject in a grade."""
    subjects = get_ministry_subjects(grade)
    for subj in subjects:
        if subj.get("name") == subject_name or subj.get("nameEn") == subject_name:
            return subj.get("periodsPerWeek", 0)
    return 0


def is_core_subject(grade: int, subject_name: str) -> bool:
    """Check if a subject is a core subject for a grade."""
    subjects = get_ministry_subjects(grade)
    for subj in subjects:
        if subj.get("name") == subject_name or subj.get("nameEn") == subject_name:
            return subj.get("isCore", False)
    return False


def get_curriculum_for_category(category: str) -> Dict[int, List[Dict[str, Any]]]:
    """Get curriculum for all grades in a category."""
    result = {}
    for grade, cat in GRADE_TO_CATEGORY.items():
        if cat.value == category:
            result[grade] = MINISTRY_CURRICULUM.get(grade, [])
    return result


class CurriculumProvider:
    """
    Provides curriculum data with support for school-specific customizations.

    When custom curriculum is provided (from API), it overrides the ministry defaults.
    """

    def __init__(self, custom_curriculum: Optional[Dict[str, Any]] = None):
        """
        Initialize curriculum provider.

        Args:
            custom_curriculum: Optional school-specific curriculum from API.
                              Format: {"grade_N": {"subjects": [...], ...}, ...}
        """
        self.custom_curriculum = custom_curriculum or {}

    def get_subjects_for_grade(self, grade: int) -> List[Dict[str, Any]]:
        """Get subjects for a grade (custom or ministry default)."""
        grade_key = f"grade_{grade}"

        if grade_key in self.custom_curriculum:
            custom_data = self.custom_curriculum[grade_key]
            if isinstance(custom_data, dict) and "subjects" in custom_data:
                return custom_data["subjects"]

        return get_ministry_subjects(grade)

    def get_required_periods(self, grade: int, subject_name: str) -> int:
        """Get required periods for a subject."""
        subjects = self.get_subjects_for_grade(grade)
        for subj in subjects:
            if subj.get("name") == subject_name or subj.get("nameEn") == subject_name:
                return subj.get("periodsPerWeek", 0)
        return 0

    def is_core_subject(self, grade: int, subject_name: str) -> bool:
        """Check if subject is core (cannot be removed in strict mode)."""
        subjects = self.get_subjects_for_grade(grade)
        for subj in subjects:
            if subj.get("name") == subject_name or subj.get("nameEn") == subject_name:
                return subj.get("isCore", False)
        return False

    def get_total_periods(self, grade: int) -> int:
        """Get total periods for a grade."""
        subjects = self.get_subjects_for_grade(grade)
        return sum(s.get("periodsPerWeek", 0) for s in subjects)

    def validate_grade_curriculum(self, grade: int) -> Dict[str, Any]:
        """Validate curriculum for a grade."""
        subjects = self.get_subjects_for_grade(grade)
        total = self.get_total_periods(grade)
        expected = get_expected_periods(grade)

        return {
            "grade": grade,
            "category": get_grade_category(grade),
            "totalPeriods": total,
            "expectedPeriods": expected,
            "isValid": total == expected,
            "difference": expected - total,
            "subjectCount": len(subjects),
        }
