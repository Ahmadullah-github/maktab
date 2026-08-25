import { create } from 'zustand';

export interface Tab {
  id: string;
  title: string;
  type:
    | 'teacher'
    | 'class'
    | 'room'
    | 'subject'
    | 'dashboard'
    | 'school-info'
    | 'periods'
    | 'constraints'
    | 'schedule-dashboard'
    | 'classes-schedule'
    | 'teachers-schedule'
    | 'guidance'
    | 'about'
    | 'settings';
  data?: unknown;
}

interface UIStore {
  // Sidebar State
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  // Theme & Language
  theme: 'light' | 'dark';
  language: 'fa' | 'en' | 'ps';
  setTheme: (theme: 'light' | 'dark') => void;
  setLanguage: (lang: 'fa' | 'en' | 'ps') => void;

  // Workspace/Tabs State
  tabs: Tab[];
  activeTabId: string | null;
  addTab: (tab: Tab) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;

  // Right Panel (Inspector) State
  rightPanelOpen: boolean;
  toggleRightPanel: () => void;
  setRightPanelOpen: (open: boolean) => void;
  selectedItemId: string | null;
  setSelectedItem: (itemId: string | null) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  // Sidebar
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  // Theme & Language
  theme: 'light',
  language: 'fa',
  setTheme: (theme) => set({ theme }),
  setLanguage: (language) => set({ language }),

  // Tabs
  tabs: [{ id: 'dashboard', title: 'داشبورد', type: 'dashboard' }],
  activeTabId: 'dashboard',
  addTab: (tab) =>
    set((state) => {
      const exists = state.tabs.find((t) => t.id === tab.id);
      if (exists) {
        return { activeTabId: tab.id };
      }
      return {
        tabs: [...state.tabs, tab],
        activeTabId: tab.id,
      };
    }),
  closeTab: (tabId) =>
    set((state) => {
      const newTabs = state.tabs.filter((t) => t.id !== tabId);
      // If closing active tab, switch to the last one or null
      let newActiveId = state.activeTabId;
      if (state.activeTabId === tabId) {
        newActiveId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
      }
      return {
        tabs: newTabs,
        activeTabId: newActiveId,
      };
    }),
  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  // Right Panel
  rightPanelOpen: false,
  toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
  selectedItemId: null,
  setSelectedItem: (itemId) => set({ selectedItemId: itemId, rightPanelOpen: !!itemId }),
}));
