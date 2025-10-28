import React from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  MapPin, 
  GraduationCap, 
  Calendar, 
  Settings,
  Sparkles
} from "lucide-react"

const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Setup Wizard", href: "/wizard", icon: Sparkles },
  { name: "Teachers", href: "/teachers", icon: Users },
  { name: "Subjects", href: "/subjects", icon: BookOpen },
  { name: "Rooms", href: "/rooms", icon: MapPin },
  { name: "Classes", href: "/classes", icon: GraduationCap },
  { name: "Timetable", href: "/timetable", icon: Calendar },
  { name: "Settings", href: "/settings", icon: Settings },
]

export function Sidebar() {
  return (
    <aside className="w-64 border-r bg-muted/10">
      <div className="flex h-full flex-col">
        <div className="p-4">
          <h2 className="text-lg font-semibold">Navigation</h2>
        </div>
        <nav className="flex-1 space-y-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Button
                key={item.name}
                variant="ghost"
                className="w-full justify-start"
                asChild
              >
                <Link to={item.href}>
                  <Icon className="mr-2 h-4 w-4" />
                  {item.name}
                </Link>
              </Button>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}