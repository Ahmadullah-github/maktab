#!/usr/bin/env node
/**
 * Seed script for test data
 * Run: node seed-data.js
 */

const API_BASE = 'http://localhost:4000/api';

async function post(endpoint, data) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

async function seed() {
  console.log('🌱 Seeding database...\n');

  // Subjects (Afghan curriculum)
  const subjects = [
    { name: 'ریاضی', code: 'MATH', section: 'MIDDLE', periodsPerWeek: 5, isDifficult: true },
    {
      name: 'فیزیک',
      code: 'PHYS',
      section: 'MIDDLE',
      periodsPerWeek: 3,
      isDifficult: true,
      requiredRoomType: 'lab',
    },
    {
      name: 'کیمیا',
      code: 'CHEM',
      section: 'MIDDLE',
      periodsPerWeek: 3,
      isDifficult: true,
      requiredRoomType: 'lab',
    },
    { name: 'بیولوژی', code: 'BIO', section: 'MIDDLE', periodsPerWeek: 3, requiredRoomType: 'lab' },
    { name: 'دری', code: 'DARI', section: 'MIDDLE', periodsPerWeek: 4 },
    { name: 'پشتو', code: 'PASH', section: 'MIDDLE', periodsPerWeek: 3 },
    { name: 'انگلیسی', code: 'ENG', section: 'MIDDLE', periodsPerWeek: 3 },
    { name: 'عربی', code: 'ARAB', section: 'MIDDLE', periodsPerWeek: 2 },
    { name: 'تعلیمات اسلامی', code: 'ISL', section: 'MIDDLE', periodsPerWeek: 3 },
    { name: 'تاریخ', code: 'HIST', section: 'MIDDLE', periodsPerWeek: 2 },
    { name: 'جغرافیه', code: 'GEO', section: 'MIDDLE', periodsPerWeek: 2 },
    { name: 'ورزش', code: 'PE', section: 'MIDDLE', periodsPerWeek: 2, requiredRoomType: 'gym' },
    { name: 'کمپیوتر', code: 'COMP', section: 'HIGH', periodsPerWeek: 2, requiredRoomType: 'lab' },
  ];

  console.log('📚 Creating subjects...');
  const subjectIds = {};
  for (const s of subjects) {
    const result = await post('/subjects', s);
    if (result.id) {
      subjectIds[s.code] = result.id;
      console.log(`  ✓ ${s.name}`);
    }
  }

  // Rooms
  const rooms = [
    { name: 'اتاق ۱۰۱', capacity: 35, type: 'classroom' },
    { name: 'اتاق ۱۰۲', capacity: 35, type: 'classroom' },
    { name: 'اتاق ۱۰۳', capacity: 35, type: 'classroom' },
    { name: 'اتاق ۱۰۴', capacity: 40, type: 'classroom' },
    { name: 'اتاق ۱۰۵', capacity: 40, type: 'classroom' },
    { name: 'اتاق ۲۰۱', capacity: 30, type: 'classroom' },
    { name: 'اتاق ۲۰۲', capacity: 30, type: 'classroom' },
    { name: 'لابراتوار فیزیک', capacity: 25, type: 'lab', features: JSON.stringify(['physics']) },
    { name: 'لابراتوار کیمیا', capacity: 25, type: 'lab', features: JSON.stringify(['chemistry']) },
    {
      name: 'لابراتوار کمپیوتر',
      capacity: 30,
      type: 'lab',
      features: JSON.stringify(['computers']),
    },
    { name: 'سالون ورزش', capacity: 50, type: 'gym' },
  ];

  console.log('\n🏫 Creating rooms...');
  const roomIds = {};
  for (const r of rooms) {
    const result = await post('/rooms', r);
    if (result.id) {
      roomIds[r.name] = result.id;
      console.log(`  ✓ ${r.name}`);
    }
  }

  // Teachers
  const teachers = [
    {
      fullName: 'استاد احمدی',
      primarySubjectIds: JSON.stringify([subjectIds.MATH]),
      maxPeriodsPerWeek: 25,
      maxPeriodsPerDay: 6,
    },
    {
      fullName: 'استاد کریمی',
      primarySubjectIds: JSON.stringify([subjectIds.PHYS]),
      maxPeriodsPerWeek: 20,
      maxPeriodsPerDay: 5,
    },
    {
      fullName: 'استاد محمدی',
      primarySubjectIds: JSON.stringify([subjectIds.CHEM]),
      maxPeriodsPerWeek: 20,
      maxPeriodsPerDay: 5,
    },
    {
      fullName: 'استاد رحیمی',
      primarySubjectIds: JSON.stringify([subjectIds.BIO]),
      maxPeriodsPerWeek: 18,
      maxPeriodsPerDay: 5,
    },
    {
      fullName: 'استاد حسینی',
      primarySubjectIds: JSON.stringify([subjectIds.DARI]),
      maxPeriodsPerWeek: 24,
      maxPeriodsPerDay: 6,
    },
    {
      fullName: 'استاد نوری',
      primarySubjectIds: JSON.stringify([subjectIds.PASH]),
      maxPeriodsPerWeek: 20,
      maxPeriodsPerDay: 5,
    },
    {
      fullName: 'استاد صمدی',
      primarySubjectIds: JSON.stringify([subjectIds.ENG]),
      maxPeriodsPerWeek: 22,
      maxPeriodsPerDay: 5,
    },
    {
      fullName: 'استاد عزیزی',
      primarySubjectIds: JSON.stringify([subjectIds.ARAB, subjectIds.ISL]),
      maxPeriodsPerWeek: 24,
      maxPeriodsPerDay: 6,
    },
    {
      fullName: 'استاد جمالی',
      primarySubjectIds: JSON.stringify([subjectIds.HIST, subjectIds.GEO]),
      maxPeriodsPerWeek: 20,
      maxPeriodsPerDay: 5,
    },
    {
      fullName: 'استاد فرهادی',
      primarySubjectIds: JSON.stringify([subjectIds.PE]),
      maxPeriodsPerWeek: 18,
      maxPeriodsPerDay: 6,
    },
    {
      fullName: 'استاد سلیمی',
      primarySubjectIds: JSON.stringify([subjectIds.COMP]),
      maxPeriodsPerWeek: 16,
      maxPeriodsPerDay: 4,
    },
    {
      fullName: 'خانم رحیمی',
      primarySubjectIds: JSON.stringify([subjectIds.MATH, subjectIds.DARI]),
      maxPeriodsPerWeek: 30,
      maxPeriodsPerDay: 6,
    },
  ];

  console.log('\n👨‍🏫 Creating teachers...');
  const teacherIds = {};
  for (const t of teachers) {
    const result = await post('/teachers', t);
    if (result.id) {
      teacherIds[t.fullName] = result.id;
      console.log(`  ✓ ${t.fullName}`);
    }
  }

  // Classes
  const classes = [
    // Alpha-Primary (1-3) - Single teacher mode
    {
      name: '۱-الف',
      grade: 1,
      section: 'PRIMARY',
      sectionIndex: 'الف',
      studentCount: 28,
      singleTeacherMode: true,
      classTeacherId: teacherIds['خانم رحیمی'],
      fixedRoomId: roomIds['اتاق ۱۰۱'],
    },
    {
      name: '۲-الف',
      grade: 2,
      section: 'PRIMARY',
      sectionIndex: 'الف',
      studentCount: 30,
      singleTeacherMode: true,
    },
    {
      name: '۳-الف',
      grade: 3,
      section: 'PRIMARY',
      sectionIndex: 'الف',
      studentCount: 32,
      singleTeacherMode: true,
    },
    // Beta-Primary (4-6)
    { name: '۴-الف', grade: 4, section: 'PRIMARY', sectionIndex: 'الف', studentCount: 34 },
    { name: '۵-الف', grade: 5, section: 'PRIMARY', sectionIndex: 'الف', studentCount: 35 },
    { name: '۶-الف', grade: 6, section: 'PRIMARY', sectionIndex: 'الف', studentCount: 33 },
    // Middle (7-9)
    {
      name: '۷-الف',
      grade: 7,
      section: 'MIDDLE',
      sectionIndex: 'الف',
      studentCount: 35,
      classTeacherId: teacherIds['استاد احمدی'],
      fixedRoomId: roomIds['اتاق ۱۰۴'],
    },
    {
      name: '۷-ب',
      grade: 7,
      section: 'MIDDLE',
      sectionIndex: 'ب',
      studentCount: 32,
      classTeacherId: teacherIds['استاد کریمی'],
    },
    { name: '۸-الف', grade: 8, section: 'MIDDLE', sectionIndex: 'الف', studentCount: 36 },
    { name: '۸-ب', grade: 8, section: 'MIDDLE', sectionIndex: 'ب', studentCount: 34 },
    { name: '۹-الف', grade: 9, section: 'MIDDLE', sectionIndex: 'الف', studentCount: 38 },
    // High (10-12)
    {
      name: '۱۰-الف',
      grade: 10,
      section: 'HIGH',
      sectionIndex: 'الف',
      studentCount: 40,
      classTeacherId: teacherIds['استاد محمدی'],
    },
    { name: '۱۱-الف', grade: 11, section: 'HIGH', sectionIndex: 'الف', studentCount: 38 },
    { name: '۱۲-الف', grade: 12, section: 'HIGH', sectionIndex: 'الف', studentCount: 35 },
  ];

  console.log('\n🏛️ Creating classes...');
  for (const c of classes) {
    const result = await post('/classes', c);
    if (result.id) {
      console.log(`  ✓ ${c.name} (Grade ${c.grade})`);
    }
  }

  console.log('\n✅ Seeding complete!');
}

seed().catch(console.error);
