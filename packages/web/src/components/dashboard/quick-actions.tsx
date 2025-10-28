import React from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Sparkles, 
  Users, 
  BookOpen, 
  MapPin, 
  GraduationCap, 
  Calendar,
  Upload
} from "lucide-react"

const actions = [
  {
    title: "Run Setup Wizard",
    description: "Configure your school settings",
    icon: Sparkles,
    href: "/wizard",
  },
  {
    title: "Add Teachers",
    description: "Import or add new teachers",
    icon: Users,
    href: "/teachers",
  },
  {
    title: "Add Subjects",
    description: "Define curriculum subjects",
    icon: BookOpen,
    href: "/subjects",
  },
  {
    title: "Add Rooms",
    description: "Configure school facilities",
    icon: MapPin,
    href: "/rooms",
  },
  {
    title: "Add Classes",
    description: "Create student groups",
    icon: GraduationCap,
    href: "/classes",
  },
  {
    title: "Generate Timetable",
    description: "Create new timetable",
    icon: Calendar,
    href: "/timetable",
  },
  {
    title: "Bulk Import",
    description: "Import data from CSV",
    icon: Upload,
    href: "/import",
  },
]

export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>
          Get started with common tasks
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {actions.map((action, index) => {
            const Icon = action.icon
            return (
              <Button
                key={index}
                variant="outline"
                className="h-auto flex-col items-start justify-start p-4 text-left"
                asChild
              >
                <Link to={action.href}>
                  <div className="flex items-center">
                    <Icon className="mr-2 h-5 w-5" />
                    <span className="font-medium">{action.title}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {action.description}
                  </p>
                </Link>
              </Button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}