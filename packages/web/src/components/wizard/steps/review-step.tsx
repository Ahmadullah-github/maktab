import React, { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionItem } from "@/components/ui/accordion"
import { SchoolInfo, PeriodsInfo, Teacher, Subject, Room, ClassGroup } from "@/types"
import { WizardStepContainer } from "@/components/wizard/shared/wizard-step-container"
import { useLanguageCtx } from "@/i18n/provider"
import { CheckCircle, Book, Users, GraduationCap, Building2 } from "lucide-react"
import { extractGradeFromClassName, gradeToSection } from "@/lib/classSubjectAssignment"
import { cn } from "@/lib/utils/tailwaindMergeUtil"

interface ReviewStepProps {
  schoolInfo: SchoolInfo
  periodsInfo: PeriodsInfo
  teachers: Teacher[]
  subjects: Subject[]
  rooms: Room[]
  classes: ClassGroup[]
  onGenerateTimetable: () => void
}

export function ReviewStep({ 
  schoolInfo, 
  periodsInfo, 
  teachers, 
  subjects, 
  rooms, 
  classes,
  onGenerateTimetable
}: ReviewStepProps) {
  const { t, isRTL } = useLanguageCtx();
  
  // Helper functions
  const getEnabledGrades = useMemo(() => {
    const grades: number[] = [];
    const addRange = (a: number, b: number) => { for (let g=a; g<=b; g++) grades.push(g); };
    if (schoolInfo.enablePrimary) addRange(1,6);
    if (schoolInfo.enableMiddle) addRange(7,9);
    if (schoolInfo.enableHigh) addRange(10,12);
    return grades;
  }, [schoolInfo.enablePrimary, schoolInfo.enableMiddle, schoolInfo.enableHigh]);

  // Filter subjects to only include those from enabled grades
  const filteredSubjects = useMemo(() => {
    return subjects.filter(subject => {
      if (subject.grade === null || subject.grade === undefined) return false;
      return getEnabledGrades.includes(subject.grade);
    });
  }, [subjects, getEnabledGrades]);

  // Filter classes to only include those from enabled grades
  const filteredClasses = useMemo(() => {
    return classes.filter(classGroup => {
      const grade = classGroup.grade || (classGroup.name ? extractGradeFromClassName(classGroup.name) : null);
      if (grade === null) return false;
      return getEnabledGrades.includes(grade);
    });
  }, [classes, getEnabledGrades]);

  // Create set of enabled subject IDs for filtering teacher references
  const enabledSubjectIds = useMemo(() => {
    return new Set(filteredSubjects.map(s => String(s.id)));
  }, [filteredSubjects]);

  // Filter teachers - only keep subject IDs that reference enabled subjects
  const filteredTeachers = useMemo(() => {
    return teachers.map(teacher => {
      const filteredPrimary = (teacher.primarySubjectIds || []).filter(id => enabledSubjectIds.has(String(id)));
      const filteredAllowed = (teacher.allowedSubjectIds || []).filter(id => enabledSubjectIds.has(String(id)));
      return {
        ...teacher,
        primarySubjectIds: filteredPrimary,
        allowedSubjectIds: filteredAllowed,
      };
    }).filter(teacher => 
      // Keep teachers that have at least one valid primary subject
      teacher.primarySubjectIds.length > 0
    );
  }, [teachers, enabledSubjectIds]);

  // Group subjects by grade
  const subjectsByGrade = useMemo(() => {
    const grouped = new Map<number, Subject[]>();
    filteredSubjects.forEach(subject => {
      if (subject.grade !== null && subject.grade !== undefined) {
        const grade = subject.grade;
        if (!grouped.has(grade)) {
          grouped.set(grade, []);
        }
        grouped.get(grade)!.push(subject);
      }
    });
    return grouped;
  }, [filteredSubjects]);

  // Group subjects by section
  const subjectsBySection = useMemo(() => {
    const primary: Subject[] = [];
    const middle: Subject[] = [];
    const high: Subject[] = [];
    
    filteredSubjects.forEach(subject => {
      if (subject.grade !== null && subject.grade !== undefined) {
        const section = gradeToSection(subject.grade);
        if (section === 'PRIMARY') primary.push(subject);
        else if (section === 'MIDDLE') middle.push(subject);
        else high.push(subject);
      }
    });
    
    return { primary, middle, high };
  }, [filteredSubjects]);

  // Group classes by grade
  const classesByGrade = useMemo(() => {
    const grouped = new Map<number, ClassGroup[]>();
    filteredClasses.forEach(classGroup => {
      const grade = classGroup.grade || (classGroup.name ? extractGradeFromClassName(classGroup.name) : null);
      if (grade !== null) {
        if (!grouped.has(grade)) {
          grouped.set(grade, []);
        }
        grouped.get(grade)!.push(classGroup);
      }
    });
    return grouped;
  }, [filteredClasses]);

  // Calculate summary stats
  const stats = useMemo(() => {
    return {
      subjects: filteredSubjects.length,
      teachers: filteredTeachers.length,
      classes: filteredClasses.length,
      rooms: rooms.length,
      subjectsBySection: {
        primary: subjectsBySection.primary.length,
        middle: subjectsBySection.middle.length,
        high: subjectsBySection.high.length,
      },
    };
  }, [filteredSubjects, filteredTeachers, filteredClasses, rooms, subjectsBySection]);

  // Get period configuration for a section
  const getSectionPeriodConfig = (section: 'PRIMARY' | 'MIDDLE' | 'HIGH') => {
    return {
      periodsPerDay: schoolInfo.periodsPerDay,
      periodDuration: periodsInfo.periodDuration,
      startTime: periodsInfo.schoolStartTime,
      breakPeriods: schoolInfo.breakPeriods ?? [],
    };
  };

  // Render section-specific period configuration
  const renderSectionPeriodConfig = (section: 'PRIMARY' | 'MIDDLE' | 'HIGH', enabled: boolean) => {
    if (!enabled) return null;
    const config = getSectionPeriodConfig(section);
    return (
      <div className="border rounded-lg p-4 bg-muted/30">
        <h4 className="font-medium mb-3">{section} {t.school.name}</h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">{t.periods.periodsPerDay}:</span>
            <span className="ml-2 font-medium">{config.periodsPerDay}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t.periods.duration?.replace('(minutes)', '')?.trim()}:</span>
            <span className="ml-2 font-medium">{config.periodDuration} {t.periods.min || "min"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t.periods.startTime}:</span>
            <span className="ml-2 font-medium">{config.startTime}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t.periods.breakPeriods}:</span>
            <span className="ml-2 font-medium">
              {config.breakPeriods.length > 0 
                ? config.breakPeriods.map(b => `${t.common.review?.afterP || "After P"}${b.afterPeriod} (${b.duration}${t.periods.min || "min"})`).join(", ") 
                : (t.common.no || "None")}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Feature flag: section-specific period configs are not yet implemented
  const enableSectionSpecificPeriods = false;

  return (
    <div className="space-y-6 max-w-6xl mx-auto" dir={isRTL ? "rtl" : "ltr"}>
      <WizardStepContainer
        title={t.wizard.reviewTitle}
        description={t.wizard.reviewDescription}
        icon={<CheckCircle className="h-6 w-6 text-blue-600" />}
        isRTL={isRTL}
      >
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t.common.review?.totalSubjects}</p>
                    <p className="text-2xl font-bold">{stats.subjects}</p>
                  </div>
                  <Book className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t.common.review?.totalTeachers}</p>
                    <p className="text-2xl font-bold">{stats.teachers}</p>
                  </div>
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t.common.review?.totalClasses}</p>
                    <p className="text-2xl font-bold">{stats.classes}</p>
                  </div>
                  <GraduationCap className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t.common.review?.totalRooms}</p>
                    <p className="text-2xl font-bold">{stats.rooms}</p>
                  </div>
                  <Building2 className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* School Information */}
          <Card>
            <CardHeader>
              <CardTitle>{t.common.review?.schoolInfo}</CardTitle>
              <CardDescription>
                {t.common.review?.schoolInfoDescription}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="font-medium">{t.common.review?.schoolName}</h3>
            <p className="text-muted-foreground">{schoolInfo.schoolName}</p>
          </div>
          <div>
                  <h3 className="font-medium">{t.common.review?.sectionsEnabled}</h3>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {schoolInfo.enablePrimary && <Badge variant="secondary">{t.common.review?.primaryShort}</Badge>}
                    {schoolInfo.enableMiddle && <Badge variant="secondary">{t.common.review?.middleShort}</Badge>}
                    {schoolInfo.enableHigh && <Badge variant="secondary">{t.common.review?.highShort}</Badge>}
                  </div>
          </div>
          <div>
                  <h3 className="font-medium">{t.school.daysPerWeek}</h3>
                  <p className="text-muted-foreground">{schoolInfo.daysPerWeek}</p>
          </div>
          <div>
                  <h3 className="font-medium">{t.common.review?.periodsPerDayLabel}</h3>
                  <p className="text-muted-foreground">{schoolInfo.periodsPerDay}</p>
                </div>
              </div>

              {/* Section-Specific Period Configuration */}
              {enableSectionSpecificPeriods && (
                <div className="mt-4 pt-4 border-t">
                  <h3 className="font-medium mb-3">{t.common.review?.sectionSpecificSchedule}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {renderSectionPeriodConfig('PRIMARY', schoolInfo.enablePrimary)}
                    {renderSectionPeriodConfig('MIDDLE', schoolInfo.enableMiddle)}
                    {renderSectionPeriodConfig('HIGH', schoolInfo.enableHigh)}
            </div>
          </div>
              )}
        </CardContent>
      </Card>
      
          {/* Period Configuration (Common) */}
          {!enableSectionSpecificPeriods && (
      <Card>
        <CardHeader>
          <CardTitle>{t.common.review?.periodConfiguration}</CardTitle>
          <CardDescription>
            {t.common.review?.periodConfigurationDescription}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <h3 className="font-medium">{t.common.review?.periodsPerDayLabel}</h3>
            <p className="text-muted-foreground">{periodsInfo.periodsPerDay}</p>
          </div>
          <div>
            <h3 className="font-medium">{t.common.review?.periodDuration}</h3>
            <p className="text-muted-foreground">{periodsInfo.periodDuration} {t.common.minutes || "minutes"}</p>
          </div>
          <div>
            <h3 className="font-medium">{t.common.review?.schoolStartTime}</h3>
            <p className="text-muted-foreground">{periodsInfo.schoolStartTime}</p>
          </div>
          <div>
            <h3 className="font-medium">{t.common.review?.breakPeriods}</h3>
            <p className="text-muted-foreground">
              {periodsInfo.breakPeriods.length > 0 
                ? periodsInfo.breakPeriods.map(b => `${t.common.review?.afterP || "After P"}${b.afterPeriod} (${b.duration}${t.common.minutes || "min"})`).join(", ") 
                : (t.common.no || "None")}
            </p>
          </div>
              </CardContent>
            </Card>
          )}

          {/* Subjects - Grouped by Section */}
          <Card>
            <CardHeader>
              <CardTitle>{t.common.review?.subjectsTitle}</CardTitle>
              <CardDescription>
                {filteredSubjects.length} {t.common.review?.subjectsConfigured}
                {schoolInfo.enablePrimary && ` (${t.common.review?.primary}: ${stats.subjectsBySection.primary}, `}
                {schoolInfo.enableMiddle && `${t.common.review?.middle}: ${stats.subjectsBySection.middle}, `}
                {schoolInfo.enableHigh && `${t.common.review?.high}): ${stats.subjectsBySection.high})`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredSubjects.length === 0 ? (
                <p className="text-muted-foreground">{t.common.review?.noSubjectsAdded}</p>
              ) : (
                <Accordion>
                  {schoolInfo.enablePrimary && subjectsBySection.primary.length > 0 && (
                    <AccordionItem 
                      title={`${t.common.review?.primarySubjects} - ${subjectsBySection.primary.length} ${t.common.review?.subjectsCount}`}
                      defaultOpen={true}
                    >
                      <div className="space-y-2">
                        {Array.from(subjectsByGrade.entries())
                          .filter(([grade]) => grade >= 1 && grade <= 6)
                          .sort(([a], [b]) => a - b)
                          .map(([grade, gradeSubjects]) => (
                            <div key={grade} className="border rounded p-3 bg-muted/20">
                              <h4 className="font-medium mb-2">{t.common.review?.gradesLabel} {grade} ({gradeSubjects.length} {t.common.review?.subjectsCount})</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {gradeSubjects.map(subject => (
                                  <div key={subject.id} className="flex items-center justify-between p-2 bg-background rounded border">
                                    <div>
                                      <p className="font-medium text-sm">{subject.name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {subject.code || t.common.review?.noCode} • {subject.periodsPerWeek || 0} {t.common.periods}/week
                                      </p>
                                    </div>
                                    {subject.isDifficult && (
                                      <Badge variant="outline" className="text-xs">{t.common.difficult}</Badge>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    </AccordionItem>
                  )}
                  {schoolInfo.enableMiddle && subjectsBySection.middle.length > 0 && (
                    <AccordionItem 
                      title={`${t.common.review?.middleSubjects} - ${subjectsBySection.middle.length} ${t.common.review?.subjectsCount}`}
                      defaultOpen={true}
                    >
                      <div className="space-y-2">
                        {Array.from(subjectsByGrade.entries())
                          .filter(([grade]) => grade >= 7 && grade <= 9)
                          .sort(([a], [b]) => a - b)
                          .map(([grade, gradeSubjects]) => (
                            <div key={grade} className="border rounded p-3 bg-muted/20">
                              <h4 className="font-medium mb-2">{t.common.review?.gradesLabel} {grade} ({gradeSubjects.length} {t.common.review?.subjectsCount})</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {gradeSubjects.map(subject => (
                                  <div key={subject.id} className="flex items-center justify-between p-2 bg-background rounded border">
                                    <div>
                                      <p className="font-medium text-sm">{subject.name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {subject.code || t.common.review?.noCode} • {subject.periodsPerWeek || 0} {t.common.periods}/week
                                      </p>
                                    </div>
                                    {subject.isDifficult && (
                                      <Badge variant="outline" className="text-xs">{t.common.difficult}</Badge>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    </AccordionItem>
                  )}
                  {schoolInfo.enableHigh && subjectsBySection.high.length > 0 && (
                    <AccordionItem 
                      title={`${t.common.review?.highSubjects} - ${subjectsBySection.high.length} ${t.common.review?.subjectsCount}`}
                      defaultOpen={true}
                    >
                      <div className="space-y-2">
                        {Array.from(subjectsByGrade.entries())
                          .filter(([grade]) => grade >= 10 && grade <= 12)
                          .sort(([a], [b]) => a - b)
                          .map(([grade, gradeSubjects]) => (
                            <div key={grade} className="border rounded p-3 bg-muted/20">
                              <h4 className="font-medium mb-2">{t.common.review?.gradesLabel} {grade} ({gradeSubjects.length} {t.common.review?.subjectsCount})</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {gradeSubjects.map(subject => (
                                  <div key={subject.id} className="flex items-center justify-between p-2 bg-background rounded border">
                                    <div>
                                      <p className="font-medium text-sm">{subject.name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {subject.code || t.common.review?.noCode} • {subject.periodsPerWeek || 0} {t.common.periods}/week
                                      </p>
                                    </div>
                                    {subject.isDifficult && (
                                      <Badge variant="outline" className="text-xs">{t.common.difficult}</Badge>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    </AccordionItem>
                  )}
                </Accordion>
              )}
        </CardContent>
      </Card>
      
          {/* Teachers and Rooms */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t.common.review?.teachersTitle}</CardTitle>
            <CardDescription>
                  {filteredTeachers.length} {t.common.review?.teachersConfigured}
            </CardDescription>
          </CardHeader>
          <CardContent>
                {filteredTeachers.length === 0 ? (
              <p className="text-muted-foreground">{t.common.review?.noTeachersAdded}</p>
            ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {filteredTeachers.map(teacher => (
                      <div key={teacher.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <p className="font-medium">{teacher.fullName}</p>
                      <p className="text-sm text-muted-foreground">
                            {teacher.primarySubjectIds.length} {teacher.primarySubjectIds.length !== 1 ? t.common.review?.primarySubjectsPlural : t.common.review?.primarySubject} • {teacher.maxPeriodsPerWeek} {t.common.periods}/week
                      </p>
                    </div>
                        {teacher.timePreference && (
                    <Badge variant="outline">
                            {teacher.timePreference}
                    </Badge>
                        )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>{t.common.review?.roomsTitle}</CardTitle>
            <CardDescription>
              {rooms.length} {t.common.review?.roomsConfigured}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rooms.length === 0 ? (
              <p className="text-muted-foreground">{t.common.review?.noRoomsAdded}</p>
            ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                {rooms.map(room => (
                      <div key={room.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <p className="font-medium">{room.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {room.type} ({room.capacity} {t.common.review?.capacity})
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
          </div>
        
          {/* Classes - Grouped by Grade */}
        <Card>
          <CardHeader>
            <CardTitle>{t.common.review?.classesTitle}</CardTitle>
            <CardDescription>
                {filteredClasses.length} {t.common.review?.classesConfigured}
            </CardDescription>
          </CardHeader>
          <CardContent>
              {filteredClasses.length === 0 ? (
              <p className="text-muted-foreground">{t.common.review?.noClassesAdded}</p>
            ) : (
                <Accordion>
                  {schoolInfo.enablePrimary && (
                    <AccordionItem 
                      title={t.common.review?.primaryClasses || "Primary School Classes"}
                      defaultOpen={true}
                    >
                      <div className="space-y-2">
                        {Array.from(classesByGrade.entries())
                          .filter(([grade]) => grade >= 1 && grade <= 6)
                          .sort(([a], [b]) => a - b)
                          .map(([grade, gradeClasses]) => (
                            <div key={grade} className="border rounded p-3 bg-muted/20">
                              <h4 className="font-medium mb-2">{t.common.review?.gradesLabel} {grade} ({gradeClasses.length} {t.common.classes})</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {gradeClasses.map(classGroup => (
                                  <div key={classGroup.id} className="p-2 bg-background rounded border">
                                    <p className="font-medium text-sm">{classGroup.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {classGroup.studentCount} {t.common.review?.students} • {
                                        Array.isArray(classGroup.subjectRequirements) 
                                          ? `${classGroup.subjectRequirements.length} ${t.common.review?.subjectsCount}`
                                          : Object.keys(classGroup.subjectRequirements || {}).length + ` ${t.common.review?.subjectsCount}`
                                      }
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    </AccordionItem>
                  )}
                  {schoolInfo.enableMiddle && (
                    <AccordionItem 
                      title={t.common.review?.middleClasses || "Middle School Classes"}
                      defaultOpen={true}
                    >
                      <div className="space-y-2">
                        {Array.from(classesByGrade.entries())
                          .filter(([grade]) => grade >= 7 && grade <= 9)
                          .sort(([a], [b]) => a - b)
                          .map(([grade, gradeClasses]) => (
                            <div key={grade} className="border rounded p-3 bg-muted/20">
                              <h4 className="font-medium mb-2">{t.common.review?.gradesLabel} {grade} ({gradeClasses.length} {t.common.classes})</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {gradeClasses.map(classGroup => (
                                  <div key={classGroup.id} className="p-2 bg-background rounded border">
                                    <p className="font-medium text-sm">{classGroup.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {classGroup.studentCount} {t.common.review?.students} • {
                                        Array.isArray(classGroup.subjectRequirements) 
                                          ? `${classGroup.subjectRequirements.length} ${t.common.review?.subjectsCount}`
                                          : Object.keys(classGroup.subjectRequirements || {}).length + ` ${t.common.review?.subjectsCount}`
                                      }
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    </AccordionItem>
                  )}
                  {schoolInfo.enableHigh && (
                    <AccordionItem 
                      title={t.common.review?.highClasses || "High School Classes"}
                      defaultOpen={true}
                    >
                      <div className="space-y-2">
                        {Array.from(classesByGrade.entries())
                          .filter(([grade]) => grade >= 10 && grade <= 12)
                          .sort(([a], [b]) => a - b)
                          .map(([grade, gradeClasses]) => (
                            <div key={grade} className="border rounded p-3 bg-muted/20">
                              <h4 className="font-medium mb-2">{t.common.review?.gradesLabel} {grade} ({gradeClasses.length} {t.common.classes})</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {gradeClasses.map(classGroup => (
                                  <div key={classGroup.id} className="p-2 bg-background rounded border">
                                    <p className="font-medium text-sm">{classGroup.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {classGroup.studentCount} {t.common.review?.students} • {
                                        Array.isArray(classGroup.subjectRequirements) 
                          ? `${classGroup.subjectRequirements.length} ${t.common.review?.subjectsCount}`
                                          : Object.keys(classGroup.subjectRequirements || {}).length + ` ${t.common.review?.subjectsCount}`
                                      }
                                    </p>
                                  </div>
                                ))}
                    </div>
                  </div>
                ))}
              </div>
                    </AccordionItem>
                  )}
                </Accordion>
            )}
          </CardContent>
        </Card>
      
          {/* Generate Button */}
      <Card>
        <CardHeader>
          <CardTitle>{t.wizard.generateTitle}</CardTitle>
          <CardDescription>
            {t.wizard.generateDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-4">
            <button
              onClick={onGenerateTimetable}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            >
              {t.wizard.generate}
            </button>
          </div>
        </CardContent>
      </Card>
        </div>
      </WizardStepContainer>
    </div>
  )
}
