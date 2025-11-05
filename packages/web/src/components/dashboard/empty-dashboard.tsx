import React from "react"
import { School, Users, BookOpen, Building2, Sparkles } from "lucide-react"
import { useLanguageCtx } from "@/i18n/provider"
import { Button, ButtonWithIcon } from "@/components/ui/button"
import { useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils/tailwaindMergeUtil"

export function EmptyDashboard() {
  const { t, isRTL } = useLanguageCtx()
  const navigate = useNavigate()

  const quickActions = [
    { icon: Users, label: t.nav?.teachers ?? "Teachers", path: "/teachers" },
    { icon: BookOpen, label: t.nav?.subjects ?? "Subjects", path: "/subjects" },
    { icon: Building2, label: t.nav?.rooms ?? "Rooms", path: "/rooms" },
    { icon: School, label: t.nav?.classes ?? "Classes", path: "/classes" },
  ]

  return (
    <div className={cn("relative min-h-[calc(100vh-8rem)] flex items-center justify-center p-6 overflow-hidden", isRTL && "rtl")} dir={isRTL ? "rtl" : "ltr"}>
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/20 dark:via-indigo-950/20 dark:to-purple-950/20" />
      
      {/* Animated Gradient Orbs */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-blue-400/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0s' }} />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-400/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-indigo-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }} />

      {/* Content */}
      <div className="relative z-10 max-w-2xl w-full text-center space-y-8">
        {/* Icon with Gradient */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full blur-xl opacity-50 animate-pulse" />
            <div className="relative bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 p-6 rounded-full shadow-2xl">
              <Sparkles className="h-16 w-16 text-white" />
            </div>
          </div>
        </div>

        {/* Text Content */}
        <div className="space-y-4">
          <h1 className={cn("text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent", isRTL && "text-right")}>
            {t.dashboard?.emptyState?.title || "Welcome to Your Dashboard"}
          </h1>
          <p className={cn("text-lg text-muted-foreground max-w-md mx-auto", isRTL && "text-right")}>
            {t.dashboard?.emptyState?.description || 
              "Get started by adding teachers, subjects, rooms, and classes to begin managing your school schedule."}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.path}
                onClick={() => navigate(action.path)}
                className="group relative p-6 rounded-xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-800/50 hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-300 hover:shadow-lg hover:scale-105"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 via-indigo-500/0 to-purple-500/0 group-hover:from-blue-500/10 group-hover:via-indigo-500/10 group-hover:to-purple-500/10 rounded-xl transition-all duration-300" />
                <div className="relative flex flex-col items-center space-y-3">
                  <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 group-hover:from-blue-600 group-hover:to-indigo-700 transition-all duration-300">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {action.label}
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Optional CTA */}
        <div className="pt-4">
          <ButtonWithIcon
            onClick={() => navigate("/wizard")}
            size="lg"
            icon={<Sparkles className="h-5 w-5" />}
            iconPosition="start"
            className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
          >
            {t.dashboard?.emptyState?.cta || "Start Setup Wizard"}
          </ButtonWithIcon>
        </div>
      </div>
    </div>
  )
}

