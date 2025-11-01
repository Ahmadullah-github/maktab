import React, { useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  MapPin, 
  GraduationCap, 
  Calendar, 
  Settings,
  Sparkles,
  ChevronDown,
  ChevronRight
} from "lucide-react"

interface NavItem {
  name: string;
  href: string;
  icon: any;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Setup Wizard", href: "/wizard", icon: Sparkles },
  { name: "Teachers", href: "/teachers", icon: Users },
  { name: "Subjects", href: "/subjects", icon: BookOpen },
  { name: "Rooms", href: "/rooms", icon: MapPin },
  { name: "Classes", href: "/classes", icon: GraduationCap },
  { 
    name: "Timetable", 
    href: "/timetable", 
    icon: Calendar,
    children: [
      { name: "Generate", href: "/timetable", icon: Calendar },
      { name: "Class Schedules", href: "/timetable/classes", icon: GraduationCap },
      { name: "Teacher Schedules", href: "/timetable/teachers", icon: Users },
    ]
  },
  { name: "Settings", href: "/settings", icon: Settings },
]

export function Sidebar() {
  const location = useLocation();
  const [expandedItems, setExpandedItems] = useState<string[]>(["/timetable"]);

  const toggleExpand = (href: string) => {
    setExpandedItems(prev => 
      prev.includes(href) 
        ? prev.filter(h => h !== href)
        : [...prev, href]
    );
  };

  const isActive = (href: string) => {
    if (href === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(href);
  };

  return (
    <aside className="w-64 border-r bg-muted/10">
      <div className="flex h-full flex-col">
        <div className="p-4">
          <h2 className="text-lg font-semibold">Navigation</h2>
        </div>
        <nav className="flex-1 space-y-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = expandedItems.includes(item.href);
            const active = isActive(item.href);

            return (
              <div key={item.name}>
                {hasChildren ? (
                  <>
                    <Button
                      variant="ghost"
                      className={`w-full justify-start ${active ? "bg-muted" : ""}`}
                      onClick={() => toggleExpand(item.href)}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      <span className="flex-1 text-left">{item.name}</span>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                    {isExpanded && (
                      <div className="ml-4 mt-1 space-y-1">
                        {item.children?.map((child) => {
                          const ChildIcon = child.icon;
                          const childActive = location.pathname === child.href;
                          
                          return (
                            <Button
                              key={child.name}
                              variant="ghost"
                              className={`w-full justify-start text-sm ${
                                childActive ? "bg-muted font-medium" : ""
                              }`}
                              asChild
                            >
                              <Link to={child.href}>
                                <ChildIcon className="mr-2 h-3 w-3" />
                                {child.name}
                              </Link>
                            </Button>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    className={`w-full justify-start ${active ? "bg-muted" : ""}`}
                    asChild
                  >
                    <Link to={item.href}>
                      <Icon className="mr-2 h-4 w-4" />
                      {item.name}
                    </Link>
                  </Button>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  )
}