import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import fa from './locales/fa.json';

// Feature translations
import { assignmentsTranslations } from '@/features/assignments/i18n';
import { classesTranslations } from '@/features/classes/i18n';
import { constraintsTranslations } from '@/features/constraints/i18n';
import { curriculumTranslations } from '@/features/curriculum/i18n';
import { periodStructureTranslations } from '@/features/periods/i18n';
import { roomsTranslations } from '@/features/rooms/i18n';
import { scheduleTranslations } from '@/features/schedule/i18n';
import { schoolSettingsTranslations } from '@/features/school-settings/i18n';
import { subjectsTranslations } from '@/features/subjects/i18n';
import { teachersTranslations } from '@/features/teachers/i18n';

// Merge feature translations into main resources
const resources = {
  fa: {
    translation: {
      ...fa,
      ...schoolSettingsTranslations.fa,
      ...periodStructureTranslations.fa,
      ...roomsTranslations.fa,
      ...subjectsTranslations.fa,
      ...teachersTranslations.fa,
      ...classesTranslations.fa,
      ...constraintsTranslations.fa,
      ...curriculumTranslations.fa,
      ...assignmentsTranslations.fa,
      ...scheduleTranslations.fa,
    },
  },
  en: {
    translation: {
      ...en,
      ...schoolSettingsTranslations.en,
      ...periodStructureTranslations.en,
      ...roomsTranslations.en,
      ...subjectsTranslations.en,
      ...teachersTranslations.en,
      ...classesTranslations.en,
      ...constraintsTranslations.en,
      ...curriculumTranslations.en,
      ...assignmentsTranslations.en,
      ...scheduleTranslations.en,
    },
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'fa', // Default language - Dari (fa locale and RTL script conventions)
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // React already escapes
  },
  react: {
    useSuspense: false,
  },
});

export default i18n;
