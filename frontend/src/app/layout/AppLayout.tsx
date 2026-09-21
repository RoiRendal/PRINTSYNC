import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './AppSidebar';
import { useLocation } from 'react-router-dom';
import { Bell, ChevronLeft, Monitor, Moon, PanelLeft, Sun } from 'lucide-react';
import { useTheme } from '../providers/ThemeProvider';
import { useNotifications } from '../providers/NotificationProvider';
import { NotificationPanel } from '../components/NotificationPanel';
import { ConnectionStatus } from '../components/ConnectionStatus';
import { cn } from '../../shared/lib/cn';
import { NAV_ITEMS } from '../../shared/constants/navigation';
import { APP_NAME } from '../../shared/constants/branding';
import { useBusinessBranding } from '../providers/BusinessBrandingProvider';
import { useAuth } from '../../app/stores/useAuthStore';
import { Button, Tooltip } from '../../shared/components/ui';

const NEXT_THEME_LABEL: Record<'light' | 'dark' | 'system', string> = {
  light: 'Dark',
  dark: 'System',
  system: 'Light',
};

const ThemeIcon: React.FC<{ theme: 'light' | 'dark' | 'system'; isDark: boolean }> = ({ theme, isDark }) => {
  if (theme === 'light') return <Sun className="h-4 w-4" />;
  if (theme === 'dark') return <Moon className="h-4 w-4" />;
  // 'system' — show a neutral monitor icon so the state is unambiguous.
  // Tone the icon with the actual rendered mode for a subtle visual cue.
  return (
    <Monitor
      className={cn(
        'h-4 w-4',
        isDark ? 'text-macos-blue' : 'text-macos-text',
      )}
    />
  );
};

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const currentPath = location.pathname;
  const currentItem = NAV_ITEMS.find(item => item.path === currentPath);
  const currentLabel = currentItem?.label || 'Dashboard';
  const { theme, toggleTheme, isDark } = useTheme();
  const { businessDisplayName, effectiveBusinessLogoUrl } = useBusinessBranding();
  const { currentUser, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
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
      if (!target.closest('#notification-trigger')) {
        setIsNotificationsOpen(false);
      }
    };
    if (isProfileOpen || isNotificationsOpen) {
      window.addEventListener('click', handleClickOutside);
    }
    return () => window.removeEventListener('click', handleClickOutside);
  }, [isProfileOpen, isNotificationsOpen]);

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
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-[var(--app-surface)] text-[var(--app-text)] font-sans dark:text-zinc-100">
      {/* Global Top Header */}
      <header className="relative z-[60] flex h-12 shrink-0 items-center justify-between border-b border-[var(--app-border-frame)] bg-[var(--app-surface)] px-3 lg:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap rounded-full px-1.5 py-1"
            title={APP_NAME}
          >
            {logoFailed ? (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-macos-blue text-[10px] font-bold text-white">
                {APP_NAME.charAt(0)}
              </div>
            ) : (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#f9f9fa] ring-1 ring-[var(--app-border-hairline)] dark:bg-[#4e4e50]">
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
          <Tooltip content={`Theme: ${theme[0].toUpperCase()}${theme.slice(1)} (click for ${NEXT_THEME_LABEL[theme]})`}>
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleTheme}
              title={`Theme: ${theme}. Click to switch to ${NEXT_THEME_LABEL[theme]}.`}
              aria-label={`Theme is ${theme}. Activate to switch to ${NEXT_THEME_LABEL[theme]}.`}
              className="rounded-full text-macos-text-muted hover:text-macos-text dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              <ThemeIcon theme={theme} isDark={isDark} />
            </Button>
          </Tooltip>
          <div
            id="notification-trigger"
            className="relative"
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
          >
            <Button
              size="icon"
              variant="ghost"
              aria-label="Notifications"
              aria-expanded={isNotificationsOpen}
              className="relative rounded-full text-macos-text-muted hover:text-macos-text dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-white bg-macos-red px-1 text-[9px] font-bold text-white dark:border-zinc-950">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
            {isNotificationsOpen && <NotificationPanel onClose={() => setIsNotificationsOpen(false)} />}
          </div>

          <div
            id="user-profile-trigger"
            className="relative"
            onClick={() => setIsProfileOpen(!isProfileOpen)}
          >
            <button
              type="button"
              className="flex cursor-pointer items-center gap-2 rounded-full border border-[var(--app-border-hairline)] bg-[#f4f4f6] py-1 pl-1 pr-2 text-left hover:bg-[#f9f9fa] active:scale-[0.98]"
              aria-expanded={isProfileOpen}
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-macos-blue text-[10px] font-bold text-white">
                {initials}
              </div>
              <span className="hidden max-w-28 truncate text-xs font-semibold text-macos-text dark:text-zinc-100 sm:inline">
                {currentUser?.name ?? 'Admin'}
              </span>
            </button>

            {isProfileOpen && (
              <div
                className="surface-panel absolute right-0 top-full z-[100] mt-2 w-64 overflow-hidden rounded-2xl py-1"
                onClick={(e) => e.stopPropagation()}
              >
                  <div className="border-b px-4 py-3">
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
                    /* `text-macos-red` (#ff3b30) measured 3.55:1 at rest on the
                       raised panel and 3.01:1 on the red hover tint — and 3.93 /
                       3.37 in dark. This label is 12px, so it needs the full
                       4.5:1, not the 3:1 large-text allowance. red-700 / red-300
                       measure 6.42 / 5.45 and 7.26 / 6.24 (browser-resolved). */
                    className="w-full cursor-pointer px-4 py-2.5 text-left text-xs font-semibold text-red-700 hover:bg-[var(--app-tint-red)] dark:text-red-300"
                  >
                    Logout
                  </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Page Toolbar */}
      <div className="relative z-[40] flex h-11 shrink-0 items-center justify-between border-b border-[var(--app-border-frame)] bg-[var(--app-surface)] px-3 lg:px-4">
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
        <ConnectionStatus className="shrink-0" />
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
        {!isCollapsed && (
          <div
            className="absolute inset-0 z-40 bg-[var(--app-scrim)] lg:hidden"
            onClick={toggleCollapse}
          />
        )}
        <main className="flex flex-1 flex-col overflow-hidden bg-transparent">
          <div className="flex-1 overflow-y-auto p-3 scrollbar-hide lg:p-5 xl:p-6">
            <section className="min-h-full rounded-[1.5rem] border border-[var(--app-border-frame)] bg-[var(--app-surface)] p-3 lg:p-4">
              {children}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
};
