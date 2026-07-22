import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useNavigationGuardStore } from '@/stores/navigationGuardStore';
import { useUIStore } from '@/stores/uiStore';
import { Link, useRouterState } from '@tanstack/react-router';
import {
  AlertCircle,
  BookOpen,
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  Clock,
  GraduationCap,
  HelpCircle,
  Info,
  LayoutDashboard,
  LogOut,
  School,
  Settings,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { SchoolProfileDto } from '@/features/school-settings/schemas/schoolProfileDto.schema';
import { SchoolBrand } from './SchoolBrand';

type SidebarItemType = 'item' | 'label';

interface SidebarNavItem {
  id: string;
  titleKey: string;
  icon?: React.ComponentType<{ className?: string }>;
  type: SidebarItemType;
  path?: string;
}

interface SidebarSection {
  items: SidebarNavItem[];
}

export const Sidebar = ({ profile }: { profile: SchoolProfileDto }) => {
  const { t } = useTranslation();
  const { sidebarOpen } = useUIStore();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const isDirty = useNavigationGuardStore((s) => s.isDirty);
  const hasRouteBlocker = useNavigationGuardStore((s) => s.hasRouteBlocker);

  // Main navigation items
  const mainSection: SidebarSection = {
    items: [
      {
        id: 'dashboard',
        titleKey: 'sidebar.dashboard',
        icon: LayoutDashboard,
        type: 'item',
        path: '/dashboard',
      },
    ],
  };

  // Entities section
  const entitiesSection: SidebarSection = {
    items: [
      {
        id: 'entities-label',
        titleKey: 'sidebar.entities',
        type: 'label',
      },
      {
        id: 'school-settings',
        titleKey: 'sidebar.schoolSettings',
        icon: School,
        type: 'item',
        path: '/school-settings',
      },
      {
        id: 'periods',
        titleKey: 'sidebar.periods',
        icon: Clock,
        type: 'item',
        path: '/periods',
      },
      {
        id: 'school-curriculum',
        titleKey: 'sidebar.schoolCurriculum',
        icon: GraduationCap,
        type: 'item',
        path: '/school-curriculum',
      },
      {
        id: 'rooms',
        titleKey: 'sidebar.rooms',
        icon: Building2,
        type: 'item',
        path: '/rooms',
      },
      {
        id: 'subjects',
        titleKey: 'sidebar.subjects',
        icon: BookOpen,
        type: 'item',
        path: '/subjects',
      },
      {
        id: 'teachers',
        titleKey: 'sidebar.teachers',
        icon: Users,
        type: 'item',
        path: '/teachers',
      },
      {
        id: 'classes',
        titleKey: 'sidebar.classes',
        icon: GraduationCap,
        type: 'item',
        path: '/classes',
      },
      {
        id: 'assignments',
        titleKey: 'sidebar.assignments',
        icon: ClipboardList,
        type: 'item',
        path: '/assignments',
      },
      {
        id: 'constraints',
        titleKey: 'sidebar.constraints',
        icon: SlidersHorizontal,
        type: 'item',
        path: '/constraints',
      },
    ],
  };

  // Schedule section
  const scheduleSection: SidebarSection = {
    items: [
      {
        id: 'schedule-label',
        titleKey: 'sidebar.schedule',
        type: 'label',
      },
      {
        id: 'schedule-dashboard',
        titleKey: 'sidebar.scheduleDashboard',
        icon: CalendarDays,
        type: 'item',
        path: '/schedule-dashboard',
      },
      {
        id: 'classes-schedule',
        titleKey: 'sidebar.classesSchedule',
        icon: CalendarCheck,
        type: 'item',
        path: '/classes-schedule',
      },
      {
        id: 'teachers-schedule',
        titleKey: 'sidebar.teachersSchedule',
        icon: CalendarClock,
        type: 'item',
        path: '/teachers-schedule',
      },
    ],
  };

  // Footer items
  const footerItems: SidebarNavItem[] = [
    {
      id: 'guidance',
      titleKey: 'sidebar.guidance',
      icon: HelpCircle,
      type: 'item',
      path: '/guidance',
    },
    {
      id: 'about',
      titleKey: 'sidebar.about',
      icon: Info,
      type: 'item',
      path: '/about',
    },
    {
      id: 'settings',
      titleKey: 'sidebar.settings',
      icon: Settings,
      type: 'item',
      path: '/settings',
    },
    {
      id: 'logout',
      titleKey: 'sidebar.logout',
      icon: LogOut,
      type: 'item',
      path: '/logout',
    },
  ];

  const NavItem = ({ item }: { item: SidebarNavItem }) => {
    const isActive = item.path ? currentPath === item.path : false;
    const title = t(item.titleKey);
    const IconComponent = item.icon;

    if (item.type === 'label') {
      if (!sidebarOpen) return null;
      return (
        <div className="px-3 py-2 mt-4 first:mt-0">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {title}
          </span>
        </div>
      );
    }

    if (!item.path) return null;

    // Check if this link should be disabled (dirty state and not current page)
    const isDisabled = isDirty && !hasRouteBlocker && !isActive;

    const linkContent = (
      <>
        {IconComponent && (
          <span
            className={cn(
              'shrink-0 transition-transform duration-200',
              isActive && 'text-primary scale-110',
              isDisabled && 'text-muted-foreground'
            )}
          >
            <IconComponent className="h-5 w-5" />
          </span>
        )}
        {sidebarOpen && (
          <span
            className={cn(
              'flex-1 truncate text-sm font-medium transition-all duration-200',
              isActive && 'text-primary translate-x-0.5',
              isDisabled && 'text-muted-foreground'
            )}
          >
            {title}
          </span>
        )}
        {/* Show warning icon when disabled */}
        {isDisabled && sidebarOpen && <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />}
      </>
    );

    // When disabled, render a div instead of a link
    if (isDisabled) {
      const disabledElement = (
        <div
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-not-allowed opacity-60',
            !sidebarOpen && 'justify-center px-2'
          )}
          title={t('common.saveChangesFirst')}
        >
          {linkContent}
        </div>
      );

      if (!sidebarOpen) {
        return (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>{disabledElement}</TooltipTrigger>
            <TooltipContent side="left" className="font-medium">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                {t('common.saveChangesFirst')}
              </div>
            </TooltipContent>
          </Tooltip>
        );
      }

      return disabledElement;
    }

    // Normal link when not disabled
    const linkElement = (
      <Link
        to={item.path}
        className={cn(
          'group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ease-out',
          'hover:bg-accent hover:text-accent-foreground hover:translate-x-0.5',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'active:scale-[0.98]',
          isActive && 'bg-primary/10 text-primary border-s-2 border-primary shadow-sm',
          !sidebarOpen && 'justify-center px-2 hover:translate-x-0'
        )}
      >
        {linkContent}
      </Link>
    );

    if (!sidebarOpen) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{linkElement}</TooltipTrigger>
          <TooltipContent side="left" className="font-medium">
            {title}
          </TooltipContent>
        </Tooltip>
      );
    }

    return linkElement;
  };

  const renderSection = (section: SidebarSection) => (
    <div className="space-y-1">
      {section.items.map((item) => (
        <NavItem key={item.id} item={item} />
      ))}
    </div>
  );

  return (
    <TooltipProvider>
      <aside
        className={cn(
          'h-full bg-sidebar border-e flex flex-col transition-all duration-300 ease-in-out relative z-10',
          sidebarOpen ? 'w-64' : 'w-16'
        )}
      >
        {/* Logo / Brand */}
        <div
          className={cn(
            'h-16 border-b flex items-center shrink-0',
            sidebarOpen ? 'px-4' : 'justify-center'
          )}
        >
          <SchoolBrand profile={profile} compact={!sidebarOpen} />
        </div>

        {/* Unsaved Changes Warning Banner */}
        {isDirty && sidebarOpen && (
          <div className="mx-2 mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2 text-amber-700 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{t('common.unsavedChangesWarning')}</span>
            </div>
          </div>
        )}

        {/* Main Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          {/* Dashboard */}
          {renderSection(mainSection)}

          {/* Spacer */}
          <div className="h-4" />

          {/* Entities Section */}
          {renderSection(entitiesSection)}

          {/* Spacer */}
          <div className="h-4" />

          {/* Schedule Section */}
          {renderSection(scheduleSection)}
        </nav>

        {/* Footer */}
        <div className="mt-auto px-2 pb-4">
          <Separator className="mb-4" />
          <div className="space-y-1">
            {footerItems.map((item) => (
              <NavItem key={item.id} item={item} />
            ))}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
};
