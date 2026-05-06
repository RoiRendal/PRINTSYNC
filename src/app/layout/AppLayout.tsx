import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './AppSidebar';
import { useLocation } from 'react-router-dom';
import { Bell, Sun, Moon, PanelLeft, ChevronLeft } from 'lucide-react';
import { useTheme } from '../providers/ThemeProvider';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { NAV_ITEMS } from '../../shared/constants/navigation';
import { APP_NAME, BRAND_LOGO_URL } from '../../shared/constants/branding';
import { useBusinessBranding } from '../providers/BusinessBrandingProvider';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const currentPath = location.pathname;
  const currentLabel = NAV_ITEMS.find(item => item.path === currentPath)?.label || 'Dashboard';
  const { theme, toggleTheme, isDark } = useTheme();
  const { businessDisplayName } = useBusinessBranding();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  const handleLogoError = useCallback(() => {
    setLogoFailed(true);
  }, []);

  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    // Default to collapsed (isCollapsed = true) on small screens if not explicitly saved
    if (saved === null && typeof window !== 'undefined' && window.innerWidth < 1024) {
      return true;
    }
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(isCollapsed));
  }, [isCollapsed]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsCollapsed(true);
      } else {
        setIsCollapsed(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('#user-profile-trigger')) {
        setIsProfileOpen(false);
      }
    };
    if (isProfileOpen) {
      window.addEventListener('click', handleClickOutside);
    }
    return () => window.removeEventListener('click', handleClickOutside);
  }, [isProfileOpen]);

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);
  const closeSidebar = () => {
    if (window.innerWidth < 1024) {
      setIsCollapsed(true);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-gray-50 text-gray-900 font-sans selection:bg-zinc-200 selection:text-zinc-900 dark:selection:bg-zinc-700 dark:selection:text-zinc-100 dark:bg-zinc-950 dark:text-zinc-100 transition-colors duration-300">
      {/* Global Top Header */}
      <header className="relative h-11 bg-white border-b border-gray-300 flex items-center justify-between px-4 lg:px-5 shrink-0 dark:bg-zinc-900 dark:border-zinc-800 transition-colors duration-300 z-[60]">
        <div className="flex items-center gap-8">
          <div
            className="flex items-center gap-2 overflow-hidden whitespace-nowrap"
            title={`${APP_NAME}`}
          >
            {logoFailed ? (
              <div className="w-5 h-5 bg-zinc-800 rounded-sm flex items-center justify-center text-white font-bold text-[10px] shrink-0">
                {APP_NAME.charAt(0)}
              </div>
            ) : (
              <img
                src={BRAND_LOGO_URL}
                alt=""
                width={20}
                height={20}
                className="h-5 w-auto max-w-[7rem] object-contain object-left shrink-0 dark:brightness-0 dark:invert"
                onError={handleLogoError}
              />
            )}
            <h1 className="text-gray-900 dark:text-white font-bold tracking-tight text-base truncate">
              {businessDisplayName}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 dark:border-zinc-800">
            <button 
              onClick={toggleTheme}
              className="p-1 text-gray-400 hover:text-gray-900 dark:text-zinc-500 dark:hover:text-zinc-100 transition-colors"
              title={`Current theme: ${theme}. Click to cycle themes.`}
            >
              {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            <button className="relative p-1 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 transition-colors group">
              <Bell className="w-4 h-4" />
              <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full border border-white dark:border-zinc-900" />
            </button>
            
            <div 
              id="user-profile-trigger"
              className="relative flex items-center gap-3 px-2 py-1 dark:border-zinc-800 cursor-pointer group hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
              onClick={() => setIsProfileOpen(!isProfileOpen)}
            >
              <div className="flex flex-col text-right hidden sm:block">
                <p className="text-[10px] font-bold text-gray-800 dark:text-zinc-200 leading-none">Admin</p>
                <p className="text-[9px] text-gray-400 dark:text-zinc-500 mt-1 uppercase tracking-tighter">Station 01-MNL</p>
              </div>
              <div className="w-7 h-7 rounded-full bg-zinc-900 dark:bg-zinc-800 flex items-center justify-center text-[9px] font-bold text-white shadow-lg shadow-black/10">
                AD
              </div>

              {/* Dropdown Menu */}
              {isProfileOpen && (
                <div 
                  className="absolute top-full right-0 mt-1.5 w-48 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 rounded-md shadow-xl py-1 z-[100]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button className="w-full text-left px-4 py-1 text-xs text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
                    User Settings
                  </button>
                  <button className="w-full text-left px-4 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* New Header */}
      <div className="relative h-9 bg-gray-50 border-b border-gray-300 flex items-center px-3 lg:px-4 shrink-0 dark:bg-zinc-950 dark:border-zinc-800 transition-colors duration-300 z-[40]">
        <button 
          onClick={toggleCollapse}
          className="p-1.5 mr-4 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 transition-colors"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <PanelLeft className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
        <span className="text-sm font-bold tracking-tight text-gray-900 dark:text-zinc-100">{currentLabel}</span>
      </div>

      {/* Main Content Area (Sidebar + Content) */}
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar 
          isCollapsed={isCollapsed} 
          onNavigate={closeSidebar}
          className={cn(
            "lg:static absolute top-0 left-0 bottom-0 z-50",
            isCollapsed && "hidden lg:flex"
          )}
        />
        {/* Overlay */}
        {!isCollapsed && <div className="lg:hidden absolute inset-0 bg-black/50 z-40" onClick={toggleCollapse} />}
        <main className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-zinc-950 transition-colors duration-300">
          <div className="flex-1 overflow-y-auto p-4 lg:p-5 xl:p-6 scrollbar-hide">
            <section className="min-h-full border border-gray-300 rounded-lg bg-gray-50 p-3 lg:p-4 dark:bg-zinc-950 dark:border-zinc-800">
              {children}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
};


