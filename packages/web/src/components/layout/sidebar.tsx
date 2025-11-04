import React, { useEffect, useState } from "react"
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
  ChevronRight,
  ChevronLeft,
  ChevronRight as ChevronRightIcon
} from "lucide-react"
import { useLanguageCtx } from "@/i18n/provider"
import { cn } from "@/lib/utils/tailwaindMergeUtil"

interface NavItem {
  name: string;
  href: string;
  icon: any;
  children?: NavItem[];
}

function makeNavItems(t: any): NavItem[] {
  const nav = t?.nav ?? {};
  return [
    { name: nav.dashboard ?? "Dashboard", href: "/", icon: LayoutDashboard },
    { name: nav.wizard ?? "New Setup", href: "/wizard", icon: Sparkles },
    { name: nav.teachers ?? "Teachers", href: "/teachers", icon: Users },
    { name: nav.subjects ?? "Subjects", href: "/subjects", icon: BookOpen },
    { name: nav.rooms ?? "Rooms", href: "/rooms", icon: MapPin },
    { name: nav.classes ?? "Classes", href: "/classes", icon: GraduationCap },
    {
      name: nav.timetable ?? "Timetable",
      href: "/timetable",
      icon: Calendar,
      children: [
        { name: nav.timetableGenerate ?? "Generate", href: "/timetable", icon: Calendar },
        { name: nav.timetableClassSchedules ?? "Class Schedules", href: "/timetable/classes", icon: GraduationCap },
        { name: nav.timetableTeacherSchedules ?? "Teacher Schedules", href: "/timetable/teachers", icon: Users },
      ],
    },
    { name: nav.settings ?? "Settings", href: "/settings", icon: Settings },
  ];
}

export function Sidebar() {
  const { t, isRTL } = useLanguageCtx();
  const location = useLocation();
  const [expandedItems, setExpandedItems] = useState<string[]>(["/timetable"]);
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const items = makeNavItems(t);

  useEffect(() => {
    const stored = localStorage.getItem("sidebar.collapsed");
    if (stored) setCollapsed(stored === "1");
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebar.collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

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

  // Get correct chevron direction for expand/collapse
  const getExpandIcon = (isExpanded: boolean, isRTL: boolean) => {
    if (isExpanded) {
      return <ChevronDown className="h-4 w-4" />;
    }
    return isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />;
  };

  // Get correct collapse icon
  const getCollapseIcon = (collapsed: boolean, isRTL: boolean) => {
    if (isRTL) {
      return collapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />;
    }
    return collapsed ? <ChevronRightIcon className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />;
  };

  return (
    <aside 
      className={cn(
        collapsed ? "w-16" : "w-64", 
        "border-r bg-muted/10 transition-[width] duration-200",
        isRTL && "font-persian" // Add Persian font class if available
      )}
      dir={isRTL ? "rtl" : "ltr"} // Essential for proper RTL support
    > 
      <div className="flex h-full flex-col">
        <div className={cn(
          "flex items-center p-2", 
          isRTL ? "flex-row justify-between" : "justify-between"
        )}>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8" 
            onClick={() => setCollapsed((c) => !c)} 
            title={collapsed ? "Expand" : "Collapse"}
          >
            {getCollapseIcon(collapsed, isRTL)}
          </Button>
          {!collapsed && (
            <h2 className="px-2 text-sm font-medium text-muted-foreground truncate">
              {t.nav?.navigationTitle ?? "Navigation"}
            </h2>
          )}
        </div>
        
        <nav className="flex-1 space-y-0.5 px-1">
          {items.map((item) => {
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
                      className={cn(
                        "relative w-full h-9 px-2 gap-2 rounded-md justify-start",
                        isRTL && "flex-row", // Only reverse flex for RTL
                        active ? "bg-muted" : "hover:bg-muted/60",
                        "focus-visible:ring-2 focus-visible:ring-ring"
                      )}
                      onClick={() => toggleExpand(item.href)}
                      title={item.name}
                      aria-expanded={isExpanded}
                      aria-haspopup={hasChildren ? "menu" : undefined}
                    >
                      {/* Accent rail - positioned based on RTL */}
                      <span
                        className={cn(
                          "absolute inset-y-1 w-0.5 rounded-full bg-primary",   
                          isRTL ? "right-1" : "left-1",
                          active ? "opacity-100" : "opacity-0"
                        )}
                        aria-hidden
                      />
                      
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      
                      {!collapsed && (
                        <>
                          <span className={cn(
                            "flex-1 truncate",
                            isRTL ? "text-right" : "text-left"
                          )}>
                            {item.name}
                          </span>
                          {getExpandIcon(isExpanded, isRTL)}
                        </>
                      )}
                    </Button>
                    
                    {isExpanded && !collapsed && (
                      <div className={cn(
                        "mt-1 space-y-0.5",
                        isRTL ? "me-4" : "ms-4" // Use logical margins for RTL
                      )}>
                        {item.children?.map((child) => {
                          const ChildIcon = child.icon;
                          const childActive = location.pathname === child.href;
                          
                          return (
                            <Button
                              key={child.name}
                              variant="ghost"
                              className={cn(
                                "relative w-full h-9 px-2 text-sm gap-2 rounded-md justify-start",
                                isRTL && "flex-row",
                                childActive ? "bg-muted" : "hover:bg-muted/60", 
                                "focus-visible:ring-2 focus-visible:ring-ring"  
                              )}
                              asChild
                              title={child.name}
                              aria-current={childActive ? "page" : undefined}
                              role="menuitem"
                            >
                              <Link to={child.href}>
                                <ChildIcon className="h-3 w-3 flex-shrink-0" />
                                <span className={cn(
                                  "truncate",
                                  isRTL ? "text-right" : "text-left"
                                )}>
                                  {child.name}
                                </span>
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
                    className={cn(
                      "relative w-full h-9 px-2 gap-2 rounded-md justify-start",
                      isRTL && "flex-row",
                      active ? "bg-muted" : "hover:bg-muted/60",
                      "focus-visible:ring-2 focus-visible:ring-ring"
                    )}
                    asChild
                    title={item.name}
                    aria-current={active ? "page" : undefined}
                    role="menuitem"
                  >
                    <Link to={item.href}>
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      {!collapsed && (
                        <span className={cn(
                          "truncate",
                          isRTL ? "text-right" : "text-left"
                        )}>
                          {item.name}
                        </span>
                      )}
                    </Link>
                  </Button>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
