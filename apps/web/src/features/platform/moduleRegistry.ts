import type { LucideIcon } from 'lucide-react';
import {
  BookOpenCheck,
  Boxes,
  Bus,
  CalendarDays,
  CircleDollarSign,
  GraduationCap,
  HeartHandshake,
  Library,
  MessageSquareText,
  Scale,
  ShieldCheck,
  UserCog,
  UsersRound,
} from 'lucide-react';

export type ModuleDelivery = 'online' | 'offline' | 'hybrid';

export interface PlatformModuleDefinition {
  code: string;
  title: string;
  titleFa: string;
  description: string;
  delivery: ModuleDelivery;
  icon: LucideIcon;
  hardware?: string;
}

export const platformModules: PlatformModuleDefinition[] = [
  {
    code: 'timetable',
    title: 'Timetable generator',
    titleFa: 'تقسیم اوقات',
    description: 'Offline-first schedule generation with optional cloud synchronization.',
    delivery: 'offline',
    icon: CalendarDays,
  },
  {
    code: 'academics',
    title: 'Academics and exams',
    titleFa: 'سرمعلمیت و امتحانات',
    description: 'Attendance, marks, examinations, reports, student records, and question banks.',
    delivery: 'hybrid',
    icon: GraduationCap,
    hardware: 'Biometric attendance',
  },
  {
    code: 'courses',
    title: 'Course management',
    titleFa: 'مدیریت کورس‌ها',
    description: 'Course enrollment, teachers, books, fees, payroll, balances, and reports.',
    delivery: 'online',
    icon: Library,
  },
  {
    code: 'discipline',
    title: 'Discipline',
    titleFa: 'امور انضباطی',
    description: 'Configurable incidents for students and staff with class and type reports.',
    delivery: 'online',
    icon: Scale,
  },
  {
    code: 'hr',
    title: 'Human resources',
    titleFa: 'منابع بشری',
    description: 'Staff records, attendance, responsibility transfers, and payroll policies.',
    delivery: 'online',
    icon: UsersRound,
    hardware: 'Biometric attendance',
  },
  {
    code: 'transport',
    title: 'Transport',
    titleFa: 'ترانسپورت',
    description: 'Routes, vehicles, drivers, assignments, and transport fee integration.',
    delivery: 'online',
    icon: Bus,
  },
  {
    code: 'inventory',
    title: 'Inventory and custody',
    titleFa: 'تحویل‌دارخانه',
    description: 'Books, uniforms, school assets, loans, handovers, sales, and stock reports.',
    delivery: 'online',
    icon: Boxes,
    hardware: 'A4 and receipt printing',
  },
  {
    code: 'finance',
    title: 'Finance and payroll',
    titleFa: 'حسابات مالی',
    description: 'Fees, family payments, expenses, purchasing, tax, payroll, balances, and audit.',
    delivery: 'online',
    icon: CircleDollarSign,
    hardware: 'A4 and receipt printing',
  },
  {
    code: 'messaging',
    title: 'Messaging',
    titleFa: 'پیام‌رسانی',
    description: 'Dari and Pashto notices, attendance alerts, receipts, and delivery tracking.',
    delivery: 'online',
    icon: MessageSquareText,
  },
  {
    code: 'users',
    title: 'Users and access',
    titleFa: 'کاربران و دسترسی‌ها',
    description: 'Separate staff and guardian identities, memberships, roles, and scoped access.',
    delivery: 'online',
    icon: UserCog,
  },
  {
    code: 'audit',
    title: 'Audit and user activity',
    titleFa: 'کارکردهای کاربران',
    description: 'Append-only history for sensitive edits, deletions, fees, and staff actions.',
    delivery: 'online',
    icon: ShieldCheck,
  },
  {
    code: 'teacher_portal',
    title: 'Teacher portal',
    titleFa: 'پورتال استادان',
    description: 'Responsive daily work area for attendance, marks, notices, and teaching tasks.',
    delivery: 'online',
    icon: BookOpenCheck,
  },
  {
    code: 'parent_portal',
    title: 'Guardian portal',
    titleFa: 'پورتال اولیای شاگرد',
    description: 'Student attendance, notices, diary, results, payments, and school communication.',
    delivery: 'online',
    icon: HeartHandshake,
  },
];
