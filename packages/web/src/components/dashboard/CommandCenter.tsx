// components/dashboard/command-center.tsx
import React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button, ButtonWithIcon } from "@/components/ui/button"
import { Link } from "react-router-dom"
import { 
  Sparkles, 
  Users, 
  BookOpen, 
  MapPin, 
  GraduationCap, 
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Settings
} from "lucide-react"
import { useLanguageCtx } from "@/i18n/provider"
import { cn } from "@/lib/utils/tailwaindMergeUtil"

interface CommandCenterProps {
  teacherCount: number
  subjectCount: number
  roomCount: number
  classCount: number
  timetableStatus: 'generated' | 'outdated' | 'none'
  lastGenerated?: Date
  conflictCount: number
  coverage: number // percentage of periods covered
  onGenerateTimetable: () => void
}

export function CommandCenter({
  teacherCount,
  subjectCount,
  roomCount,
  classCount,
  timetableStatus,
  lastGenerated,
  conflictCount,
  coverage,
  onGenerateTimetable
}: CommandCenterProps) {
  const { t, isRTL } = useLanguageCtx()
  const cmd = t.dashboard?.commandCenter
  
  const statusConfig = {
    generated: { color: "text-green-600", bg: "bg-green-50", label: cmd?.ready ?? "Ready", icon: CheckCircle2 },
    outdated: { color: "text-amber-600", bg: "bg-amber-50", label: cmd?.needsUpdate ?? "Needs Update", icon: AlertTriangle },
    none: { color: "text-gray-600", bg: "bg-gray-50", label: cmd?.notGenerated ?? "Not Generated", icon: Clock }
  };

  const StatusIcon = statusConfig[timetableStatus].icon;

  return (
    <div className={cn("space-y-6", isRTL && "rtl")} dir={isRTL ? "rtl" : "ltr"}>
      {/* Header Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className={cn("flex items-center gap-2 text-lg", isRTL && "flex-row-reverse")}>
              <Calendar className="h-5 w-5 text-blue-600" />
              {cmd?.timetableStatus ?? "Timetable Status"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("flex items-center justify-between", isRTL && "flex-row-reverse")}>
              <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
                <div className={`p-2 rounded-full ${statusConfig[timetableStatus].bg}`}>
                  <StatusIcon className={`h-6 w-6 ${statusConfig[timetableStatus].color}`} />
                </div>
                <div className={cn(isRTL && "text-right")}>
                  <div className="font-semibold">{statusConfig[timetableStatus].label}</div>
                  {lastGenerated && (
                    <div className="text-sm text-muted-foreground">
                      {cmd?.lastGenerated ?? "Last generated"}: {lastGenerated.toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
              <div className={cn("flex gap-2", isRTL && "flex-row-reverse")}>
                <ButtonWithIcon variant="outline" size="sm" icon={<Download className="h-4 w-4" />} iconPosition="start">
                  {cmd?.export ?? "Export"}
                </ButtonWithIcon>
                <ButtonWithIcon onClick={onGenerateTimetable} size="sm" icon={<Sparkles className="h-4 w-4" />} iconPosition="start">
                  {cmd?.generate ?? "Generate"}
                </ButtonWithIcon>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className={cn("text-lg", isRTL && "text-right")}>{cmd?.qualityMetrics ?? "Quality Metrics"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className={cn("flex justify-between items-center", isRTL && "flex-row-reverse")}>
              <span className={cn("text-sm", isRTL && "text-right")}>{cmd?.coverage ?? "Coverage"}</span>
              <Badge variant={coverage >= 95 ? "default" : "secondary"}>
                {coverage}%
              </Badge>
            </div>
            <div className={cn("flex justify-between items-center", isRTL && "flex-row-reverse")}>
              <span className={cn("text-sm", isRTL && "text-right")}>{t.dashboard?.conflicts ?? "Conflicts"}</span>
              <Badge variant={conflictCount === 0 ? "default" : "destructive"}>
                {conflictCount}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title={t.nav?.teachers ?? "Teachers"}
          value={teacherCount}
          icon={Users}
          color="text-blue-600"
          href="/teachers"
          isRTL={isRTL}
        />
        <StatCard
          title={t.nav?.subjects ?? "Subjects"}
          value={subjectCount}
          icon={BookOpen}
          color="text-green-600"
          href="/subjects"
          isRTL={isRTL}
        />
        <StatCard
          title={t.nav?.classes ?? "Classes"}
          value={classCount}
          icon={GraduationCap}
          color="text-purple-600"
          href="/classes"
          isRTL={isRTL}
        />
        <StatCard
          title={t.nav?.rooms ?? "Rooms"}
          value={roomCount}
          icon={MapPin}
          color="text-orange-600"
          href="/rooms"
          isRTL={isRTL}
        />
      </div>

      {/* Action Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <ActionCard
          title={cmd?.setupWizard ?? "Setup Wizard"}
          description={cmd?.setupWizardDesc ?? "Configure school settings"}
          icon={Sparkles}
          href="/wizard"
          variant="primary"
          isRTL={isRTL}
        />
        <ActionCard
          title={cmd?.timetableView ?? "Timetable View"}
          description={cmd?.timetableViewDesc ?? "View current timetable"}
          icon={Calendar}
          href="/timetable"
          isRTL={isRTL}
        />
        <ActionCard
          title={cmd?.systemSettings ?? "System Settings"}
          description={cmd?.systemSettingsDesc ?? "Manage application settings"}
          icon={Settings}
          href="/settings"
          isRTL={isRTL}
        />
      </div>

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle className={cn(isRTL && "text-right")}>{cmd?.systemHealth ?? "System Health"}</CardTitle>
          <CardDescription className={cn(isRTL && "text-right")}>{cmd?.systemHealthDesc ?? "Current system status and requirements"}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className={cn("flex justify-between", isRTL && "flex-row-reverse")}>
                <span className={cn(isRTL && "text-right")}>{cmd?.dataIntegrity ?? "Data Integrity"}</span>
                <Badge variant="default">{cmd?.healthy ?? "Healthy"}</Badge>
              </div>
              <div className={cn("flex justify-between", isRTL && "flex-row-reverse")}>
                <span className={cn(isRTL && "text-right")}>{cmd?.teacherCoverage ?? "Teacher Coverage"}</span>
                <Badge variant={teacherCount >= classCount ? "default" : "destructive"}>
                  {teacherCount >= classCount ? (cmd?.adequate ?? "Adequate") : (cmd?.insufficient ?? "Insufficient")}
                </Badge>
              </div>
            </div>
            <div className="space-y-2">
              <div className={cn("flex justify-between", isRTL && "flex-row-reverse")}>
                <span className={cn(isRTL && "text-right")}>{cmd?.roomCapacity ?? "Room Capacity"}</span>
                <Badge variant="default">{cmd?.optimal ?? "Optimal"}</Badge>
              </div>
              <div className={cn("flex justify-between", isRTL && "flex-row-reverse")}>
                <span className={cn(isRTL && "text-right")}>{cmd?.periodAllocation ?? "Period Allocation"}</span>
                <Badge variant={coverage >= 90 ? "default" : "secondary"}>
                  {coverage >= 90 ? (cmd?.balanced ?? "Balanced") : (cmd?.needsReview ?? "Needs Review")}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

const StatCard = ({ title, value, icon: Icon, color, href, isRTL }: any) => (
  <Card className="cursor-pointer hover:shadow-md transition-shadow">
    <CardContent className="p-4">
      <Link to={href} className={cn("flex items-center justify-between", isRTL && "flex-row-reverse")}>
        <div className={cn(isRTL && "text-right")}>
          <p className="text-2xl font-bold">{value}</p>
          <p className={cn("text-sm text-muted-foreground", isRTL && "text-right")}>{title}</p>
        </div>
        <Icon className={cn(`h-8 w-8 ${color} opacity-80`, isRTL && "me-0")} />
      </Link>
    </CardContent>
  </Card>
)

const ActionCard = ({ title, description, icon: Icon, href, variant = "default", isRTL }: any) => (
  <Card className={cn(`cursor-pointer border-2 hover:border-primary transition-colors ${
    variant === "primary" ? "border-primary bg-primary/5" : ""
  }`, isRTL && "rtl")} dir={isRTL ? "rtl" : "ltr"}>
    <CardContent className="p-4">
      <Link to={href} className={cn("flex items-start gap-3", isRTL && "flex-row-reverse")}>
        <Icon className={cn(`h-6 w-6 mt-1 ${
          variant === "primary" ? "text-primary" : "text-muted-foreground"
        }`, isRTL && "mt-0")} />
        <div className={cn(isRTL && "text-right")}>
          <p className="font-medium">{title}</p>
          <p className={cn("text-sm text-muted-foreground", isRTL && "text-right")}>{description}</p>
        </div>
      </Link>
    </CardContent>
  </Card>
)