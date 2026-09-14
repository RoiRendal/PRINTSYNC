import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './AppSidebar';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, ChevronLeft, Moon, PanelLeft, Sun } from 'lucide-react';
import { useTheme } from '../providers/ThemeProvider';
import { cn } from '../../shared/lib/cn';
import { NAV_ITEMS } from '../../shared/constants/navigation';
import { APP_NAME } from '../../shared/constants/branding';
import { useBusinessBranding } from '../providers/BusinessBrandingProvider';
import { useAuth } from '../../features/users/state/AuthContext';
import { Button } from '../../shared/components/ui';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const currentPath = location.pathname;
  const currentItem = NAV_ITEMS.find(item => item.path === currentPath);
  const currentLabel = currentItem?.label || 'Dashboard';
  const { theme, toggleTheme, isDark } = useTheme();
  const { businessDisplayName, effectiveBusinessLogoUrl } = useBusinessBranding();
  const { currentUser, logout } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  const handleLogoError = useCallback(() => {
    setLogoFailed(true);
  }, []);

  useEffect(() => {
    setLogoFailed(false);
  }, [effectiveBusinessLogoUrl]);

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

  const initials = (currentUser?.name ?? 'Admin')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-[var(--app-surface)] text-[var(--app-text)] font-sans transition-colors duration-300 dark:text-zinc-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(90,200,250,0.18),transparent_30rem),radial-gradient(circle_at_85%_18%,rgba(175,82,222,0.13),transparent_28rem),radial-gradient(circle_at_55%_95%,rgba(0,122,255,0.10),transparent_34rem)]" />

      {/* Global Top Header */}
      <header className="glass-toolbar relative z-[60] flex h-12 shrink-0 items-center justify-between px-3 lg:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap rounded-full px-1.5 py-1"
            title={APP_NAME}
          >
            {logoFailed ? (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-macos-blue text-[10px] font-bold text-white shadow-[0_8px_22px_rgb(0_122_255/0.24)]">
                {APP_NAME.charAt(0)}
              </div>
            ) : (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white/70 shadow-[var(--shadow-card)] ring-1 ring-black/5 dark:bg-white/10 dark:ring-white/10">
                <img
                  src={effectiveBusinessLogoUrl}
                  alt=""
                  width={20}
                  height={20}
                  className="h-5 w-auto max-w-[7rem] object-contain object-left"
                  onError={handleLogoError}
                />
              </span>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold tracking-tight text-macos-text dark:text-white">
                {businessDisplayName}
              </h1>
              <p className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-macos-text-muted dark:text-zinc-500 sm:block">
                {APP_NAME} Workspace
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={toggleTheme}
            title={`Current theme: ${theme}. Click to cycle themes.`}
            aria-label="Toggle theme"
            className="rounded-full text-macos-text-muted hover:text-macos-text dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Notifications"
            className="relative rounded-full text-macos-text-muted hover:text-macos-text dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full border border-white bg-macos-red dark:border-zinc-950" />
          </Button>

          <div
            id="user-profile-trigger"
            className="relative"
            onClick={() => setIsProfileOpen(!isProfileOpen)}
          >
            <button
              type="button"
              className="flex cursor-pointer items-center gap-2 rounded-full border border-white/40 bg-white/42 py-1 pl-1 pr-2 text-left shadow-sm transition-all duration-200 hover:bg-white/70 active:scale-[0.98] dark:border-white/10 dark:bg-white/8 dark:hover:bg-white/14"
              aria-expanded={isProfileOpen}
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-macos-blue to-macos-cyan text-[10px] font-bold text-white shadow-[0_8px_22px_rgb(0_122_255/0.25)]">
                {initials}
              </div>
              <span className="hidden max-w-28 truncate text-xs font-semibold text-macos-text dark:text-zinc-100 sm:inline">
                {currentUser?.name ?? 'Admin'}
              </span>
            </button>

            <AnimatePresence>
              {isProfileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className="glass-panel absolute right-0 top-full z-[100] mt-2 w-64 overflow-hidden rounded-2xl py-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="border-b border-black/5 px-4 py-3 dark:border-white/10">
                    <p className="text-sm font-bold leading-tight text-macos-text dark:text-zinc-100">
                      {currentUser?.name ?? 'Admin'}
                    </p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-macos-text-muted dark:text-zinc-500">
                      {(currentUser?.role ?? 'admin').replace(/_/g, ' ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={logout}
                    className="w-full cursor-pointer px-4 py-2.5 text-left text-xs font-semibold text-macos-red transition-colors hover:bg-macos-red/10"
                  >
                    Logout
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Page Toolbar */}
      <div className="glass-toolbar relative z-[40] flex h-11 shrink-0 items-center justify-between px-3 lg:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            size="icon"
            variant="ghost"
            onClick={toggleCollapse}
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            aria-label={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            className="rounded-full text-macos-text-muted hover:text-macos-text dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            {isCollapsed ? <PanelLeft className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
          <div className="min-w-0">
            <span className="block truncate text-base font-bold tracking-tight text-macos-text dark:text-zinc-100">{currentLabel}</span>

          </div>
        </div>
      </div>

      {/* Main Content Area (Sidebar + Content) */}
      <div className="relative z-10 flex flex-1 overflow-hidden">
        <Sidebar
          isCollapsed={isCollapsed}
          onNavigate={closeSidebar}
          className={cn(
            'absolute bottom-0 left-0 top-0 z-50 lg:static',
            isCollapsed && 'hidden lg:flex',
          )}
        />
        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-40 bg-black/35 backdrop-blur-[2px] lg:hidden"
              onClick={toggleCollapse}
            />
          )}
        </AnimatePresence>
        <main className="flex flex-1 flex-col overflow-hidden bg-transparent transition-colors duration-300">
          <div className="flex-1 overflow-y-auto p-3 scrollbar-hide lg:p-5 xl:p-6">
            <section className="min-h-full rounded-[1.5rem] border border-white/65 bg-white/86 p-3 shadow-[var(--shadow-card)] backdrop-blur-sm dark:border-white/10 dark:bg-zinc-950/82 lg:p-4">
              {children}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
};
