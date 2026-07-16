export const SUPPORTED_ROOM_TYPE_ICONS = ['Building', 'Beaker', 'Library', 'Dumbbell'] as const;

export type SupportedRoomTypeIcon = (typeof SUPPORTED_ROOM_TYPE_ICONS)[number];

export interface DefaultRoomTypeDefinition {
  value: string;
  labelFa: string;
  labelEn: string;
  icon: SupportedRoomTypeIcon;
  sortOrder: number;
}

/** Global, immutable room type values shipped with the application. */
export const DEFAULT_ROOM_TYPES: DefaultRoomTypeDefinition[] = [
  { value: 'normal', labelFa: 'صنف عادی', labelEn: 'Classroom', icon: 'Building', sortOrder: 1 },
  { value: 'computer_lab', labelFa: 'لابراتوار کمپیوتر', labelEn: 'Computer Lab', icon: 'Beaker', sortOrder: 2 },
  { value: 'biology_lab', labelFa: 'لابراتوار بیولوژی', labelEn: 'Biology Lab', icon: 'Beaker', sortOrder: 3 },
  { value: 'chemistry_lab', labelFa: 'لابراتوار کیمیا', labelEn: 'Chemistry Lab', icon: 'Beaker', sortOrder: 4 },
  { value: 'math_lab', labelFa: 'لابراتوار ریاضی', labelEn: 'Math Lab', icon: 'Beaker', sortOrder: 5 },
  { value: 'physics_lab', labelFa: 'لابراتوار فزیک', labelEn: 'Physics Lab', icon: 'Beaker', sortOrder: 6 },
  { value: 'lab', labelFa: 'لابراتوار', labelEn: 'Laboratory', icon: 'Beaker', sortOrder: 7 },
  { value: 'library', labelFa: 'کتابخانه', labelEn: 'Library', icon: 'Library', sortOrder: 8 },
  { value: 'salon', labelFa: 'سالون', labelEn: 'Hall', icon: 'Building', sortOrder: 9 },
  { value: 'gym', labelFa: 'سالون ورزش', labelEn: 'Gym', icon: 'Dumbbell', sortOrder: 10 },
  { value: 'sport_camp', labelFa: 'میدان ورزشی', labelEn: 'Sports Ground', icon: 'Dumbbell', sortOrder: 11 },
  { value: 'other', labelFa: 'سایر', labelEn: 'Other', icon: 'Building', sortOrder: 99 },
];
