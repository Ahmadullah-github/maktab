// components/dashboard/analytics-hub.tsx
import React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { 
  TrendingUp, 
  Users, 
  BookOpen, 
  Clock,
  Target,
  BarChart3,
  Lightbulb,
  School
} from "lucide-react"
import { useLanguageCtx } from "@/i18n/provider"
import { cn } from "@/lib/utils/tailwaindMergeUtil"

interface AnalyticsHubProps {
  teacherCount: number
  subjectCount: number
  roomCount: number
  classCount: number
  timetableData: any
  sectionBreakdown: {
    primary: { classes: number; subjects: number }
    middle: { classes: number; subjects: number }
    high: { classes: number; subjects: number }
  }
  periodUtilization: number
  teacherWorkload: { balanced: number; overloaded: number }
  subjectDistribution: Array<{ name: string; count: number; color: string }>
}

export function AnalyticsHub({
  teacherCount,
  subjectCount,
  roomCount,
  classCount,
  timetableData,
  sectionBreakdown,
  periodUtilization,
  teacherWorkload,
  subjectDistribution
}: AnalyticsHubProps) {
  const { t, isRTL } = useLanguageCtx()
  const analytics = t.dashboard?.analyticsHub

  // Helper function to replace placeholders in translated strings
  const translateWithCount = (template: string | undefined, count: number, fallback: string) => {
    if (!template) return fallback
    return template.replace('{{count}}', count.toString())
  }

  return (
    <div className={cn("space-y-6", isRTL && "rtl")} dir={isRTL ? "rtl" : "ltr"}>
      {/* KPI Header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title={analytics?.periodUtilization ?? "Period Utilization"}
          value={`${periodUtilization}%`}
          description={analytics?.classroomTimeEfficiency ?? "Classroom time efficiency"}
          trend="up"
          icon={TrendingUp}
          isRTL={isRTL}
        />
        <KPICard
          title={analytics?.teacherLoad ?? "Teacher Load"}
          value={`${teacherWorkload.balanced}%`}
          description={analytics?.balancedWorkload ?? "Balanced workload"}
          trend="stable"
          icon={Users}
          isRTL={isRTL}
        />
        <KPICard
          title={analytics?.curriculumCoverage ?? "Curriculum Coverage"}
          value={`${Math.round((subjectCount / (sectionBreakdown.primary.subjects + sectionBreakdown.middle.subjects + sectionBreakdown.high.subjects)) * 100)}%`}
          description={analytics?.ministryCompliance ?? "Ministry compliance"}
          trend="up"
          icon={Target}
          isRTL={isRTL}
        />
        <KPICard
          title={analytics?.roomUsage ?? "Room Usage"}
          value={`${Math.round((roomCount / classCount) * 100)}%`}
          description={analytics?.facilityOptimization ?? "Facility optimization"}
          trend="stable"
          icon={School}
          isRTL={isRTL}
        />
      </div>

      {/* Section Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SectionCard
          title={analytics?.primarySchool ?? "Primary School"}
          grades={analytics?.grades16 ?? "Grades 1-6"}
          classes={sectionBreakdown.primary.classes}
          subjects={sectionBreakdown.primary.subjects}
          color="bg-blue-50 border-blue-200"
          progress={85}
          isRTL={isRTL}
          classesLabel={analytics?.classes ?? "Classes"}
          subjectsLabel={analytics?.subjects ?? "Subjects"}
          curriculumCoverageLabel={analytics?.curriculumCoverageLabel ?? "Curriculum Coverage"}
        />
        <SectionCard
          title={analytics?.middleSchool ?? "Middle School"}
          grades={analytics?.grades79 ?? "Grades 7-9"}
          classes={sectionBreakdown.middle.classes}
          subjects={sectionBreakdown.middle.subjects}
          color="bg-green-50 border-green-200"
          progress={92}
          isRTL={isRTL}
          classesLabel={analytics?.classes ?? "Classes"}
          subjectsLabel={analytics?.subjects ?? "Subjects"}
          curriculumCoverageLabel={analytics?.curriculumCoverageLabel ?? "Curriculum Coverage"}
        />
        <SectionCard
          title={analytics?.highSchool ?? "High School"}
          grades={analytics?.grades1012 ?? "Grades 10-12"}
          classes={sectionBreakdown.high.classes}
          subjects={sectionBreakdown.high.subjects}
          color="bg-purple-50 border-purple-200"
          progress={78}
          isRTL={isRTL}
          classesLabel={analytics?.classes ?? "Classes"}
          subjectsLabel={analytics?.subjects ?? "Subjects"}
          curriculumCoverageLabel={analytics?.curriculumCoverageLabel ?? "Curriculum Coverage"}
        />
      </div>

      {/* Curriculum Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
              <BarChart3 className="h-5 w-5" />
              {analytics?.subjectDistribution ?? "Subject Distribution"}
            </CardTitle>
            <CardDescription className={cn(isRTL && "text-right")}>
              {analytics?.subjectDistributionDesc ?? "Across all grades and sections"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {subjectDistribution.map((subject, index) => (
                <div key={index} className={cn("flex items-center justify-between", isRTL && "flex-row-reverse")}>
                  <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: subject.color }}
                    />
                    <span className={cn("text-sm", isRTL && "text-right")}>{subject.name}</span>
                  </div>
                  <Badge variant="outline">{subject.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
              <Lightbulb className="h-5 w-5" />
              {analytics?.optimizationTips ?? "Optimization Tips"}
            </CardTitle>
            <CardDescription className={cn(isRTL && "text-right")}>
              {analytics?.optimizationTipsDesc ?? "Suggestions for improvement"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              {teacherWorkload.overloaded > 20 && (
                <div className={cn("flex items-start gap-2 p-2 bg-amber-50 rounded border border-amber-200", isRTL && "flex-row-reverse")}>
                  <Users className={cn("h-4 w-4 text-amber-600 mt-0.5", isRTL && "mt-0")} />
                  <div className={cn(isRTL && "text-right")}>
                    <div className="font-medium">{analytics?.teacherWorkload ?? "Teacher Workload"}</div>
                    <div className="text-amber-700">
                      {translateWithCount(analytics?.teachersOverloaded, teacherWorkload.overloaded, `${teacherWorkload.overloaded}% of teachers are overloaded`)}
                    </div>
                  </div>
                </div>
              )}
              
              {periodUtilization < 90 && (
                <div className={cn("flex items-start gap-2 p-2 bg-blue-50 rounded border border-blue-200", isRTL && "flex-row-reverse")}>
                  <Clock className={cn("h-4 w-4 text-blue-600 mt-0.5", isRTL && "mt-0")} />
                  <div className={cn(isRTL && "text-right")}>
                    <div className="font-medium">{analytics?.periodUsage ?? "Period Usage"}</div>
                    <div className="text-blue-700">
                      {translateWithCount(analytics?.periodsUnderutilized, 100 - periodUtilization, `${100 - periodUtilization}% of periods underutilized`)}
                    </div>
                  </div>
                </div>
              )}

              <div className={cn("flex items-start gap-2 p-2 bg-green-50 rounded border border-green-200", isRTL && "flex-row-reverse")}>
                <BookOpen className={cn("h-4 w-4 text-green-600 mt-0.5", isRTL && "mt-0")} />
                <div className={cn(isRTL && "text-right")}>
                  <div className="font-medium">{analytics?.curriculumComplete ?? "Curriculum Complete"}</div>
                  <div className="text-green-700">
                    {analytics?.ministryRequirementsMet ?? "All Ministry requirements met"}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions Bar */}
      <Card>
        <CardContent className="p-4">
          <div className={cn("flex flex-wrap gap-2 justify-center", isRTL && "flex-row-reverse")}>
            <Button variant="outline" size="sm">
              {analytics?.generateReport ?? "Generate Report"}
            </Button>
            <Button variant="outline" size="sm">
              {analytics?.exportAnalytics ?? "Export Analytics"}
            </Button>
            <Button variant="outline" size="sm">
              {analytics?.compareSemesters ?? "Compare Semesters"}
            </Button>
            <Button variant="outline" size="sm">
              {analytics?.curriculumAudit ?? "Curriculum Audit"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

const KPICard = ({ title, value, description, trend, icon: Icon, isRTL }: any) => (
  <Card>
    <CardContent className="p-4">
      <div className={cn("flex items-center justify-between", isRTL && "flex-row-reverse")}>
        <div className={cn(isRTL && "text-right")}>
          <p className="text-2xl font-bold">{value}</p>
          <p className={cn("text-sm font-medium", isRTL && "text-right")}>{title}</p>
          <p className={cn("text-xs text-muted-foreground", isRTL && "text-right")}>{description}</p>
        </div>
        <div className={cn("flex flex-col items-end", isRTL && "items-start")}>
          <Icon className="h-8 w-8 text-muted-foreground opacity-80" />
          {trend === "up" && <Badge variant="default" className="mt-1">+5%</Badge>}
          {trend === "down" && <Badge variant="destructive" className="mt-1">-2%</Badge>}
        </div>
      </div>
    </CardContent>
  </Card>
)

const SectionCard = ({ title, grades, classes, subjects, color, progress, isRTL, classesLabel, subjectsLabel, curriculumCoverageLabel }: any) => (
  <Card className={cn(`${color} border-2`, isRTL && "rtl")} dir={isRTL ? "rtl" : "ltr"}>
    <CardHeader className="pb-3">
      <CardTitle className={cn("text-base", isRTL && "text-right")}>{title}</CardTitle>
      <CardDescription className={cn(isRTL && "text-right")}>{grades}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-3">
      <div className={cn("flex justify-between text-sm", isRTL && "flex-row-reverse")}>
        <span className={cn(isRTL && "text-right")}>{classes} {classesLabel}</span>
        <span className={cn(isRTL && "text-right")}>{subjects} {subjectsLabel}</span>
      </div>
      <div className="space-y-1">
        <div className={cn("flex justify-between text-xs", isRTL && "flex-row-reverse")}>
          <span className={cn(isRTL && "text-right")}>{curriculumCoverageLabel}</span>
          <span className={cn(isRTL && "text-right")}>{progress}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>
    </CardContent>
  </Card>
)