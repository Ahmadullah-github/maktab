import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/uiStore';
import { BookOpen, Building2, GraduationCap, LayoutDashboard, Users, X } from 'lucide-react';

export const TabBar = () => {
  const { tabs, activeTabId, setActiveTab, closeTab } = useUIStore();

  const getIcon = (type: string) => {
    switch (type) {
      case 'dashboard':
        return <LayoutDashboard className="h-3.5 w-3.5" />;
      case 'teacher':
        return <Users className="h-3.5 w-3.5" />;
      case 'class':
        return <GraduationCap className="h-3.5 w-3.5" />;
      case 'room':
        return <Building2 className="h-3.5 w-3.5" />;
      case 'subject':
        return <BookOpen className="h-3.5 w-3.5" />;
      default:
        return null;
    }
  };

  return (
    <div className="h-10 bg-muted/40 border-b flex items-end px-2 gap-1 overflow-x-auto no-scrollbar w-full">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'group flex items-center gap-2 px-3 py-2 min-w-[120px] max-w-[200px] text-sm font-medium border-t border-x rounded-t-md cursor-pointer select-none transition-colors relative',
              isActive
                ? 'bg-background border-border text-foreground -mb-px pb-2.5 z-10'
                : 'bg-transparent border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            )}
          >
            <span className="shrink-0 opacity-70 group-hover:opacity-100">{getIcon(tab.type)}</span>
            <span className="truncate flex-1 text-xs sm:text-sm">{tab.title}</span>

            <div
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              className={cn(
                'p-0.5 rounded-sm opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all',
                isActive && 'opacity-100'
              )}
            >
              <X className="h-3 w-3" />
            </div>

            {/* Active indicator line for better visibility */}
            {isActive && (
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary rounded-t-md" />
            )}
          </div>
        );
      })}
    </div>
  );
};
