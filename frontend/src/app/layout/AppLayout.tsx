import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './AppSidebar';
import { useLocation } from 'react-router-dom';
import { Bell, Monitor, Moon, PanelLeft, Sun } from 'lucide-react';
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

  /*
   * Navigation visibility — a deliberate behaviour change, not a refactor.
   *
   * The collapse control was removed (owner decision), so there is no longer a
   * "narrow rail" state to persist. From `lg` up the rail is permanent; below
   * `lg` it is a drawer, closed by default and opened by the menu button in the
   * page toolbar. The old `sidebar-collapsed` localStorage key is no longer
   * read — stale values are ignored rather than migrated.
   */
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= 1024,
  );

  useEffect(() => {
    // Crossing the breakpoint re-syncs to that breakpoint's default: visible on
    // desktop, closed on mobile.
    const handleResize = () => {
      setIsSidebarOpen(window.innerWidth >= 1024);
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

  const toggleSidebar = () => setIsSidebarOpen((open) => !open);
  const closeSidebar = () => {
    // Only meaningful for the mobile drawer; the desktop rail is always shown.
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  const initials = (currentUser?.name ?? 'Admin')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  /*
   * The page background is not painted here. It lives once, on the body, in
   * `index.css` — a neutral two-point wash over the page surface.
   *
   * This shell used to lay a second, coloured wash on top of an opaque
   * background of its own. That gave the page four competing backgrounds, and
   * left the old palette's cyan, purple and blue as the last coloured
   * decoration anywhere in the app. Both are gone.
   *
   * The wrapper must stay transparent for the one wash to show through: adding a
   * background here hides it and quietly returns the whole app to a flat page.
   */
  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden text-[var(--app-text)] font-sans transition-colors duration-300 dark:text-zinc-100">

      {/* Global Top Header */}
      <header className="surface-toolbar relative z-[60] flex h-12 shrink-0 items-center justify-between px-3 lg:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap rounded-full px-1.5 py-1"
            title={APP_NAME}
          >
            {/*
              Both branches are the same raised chip in two colours, so they get
              the same treatment — the fallback used to carry a blue glow while
              the real logo sat on a flat Tailwind shadow, which made the chip
              change depth depending on whether an image loaded.

              The logo branch swaps `ring-1` for a real `border`: `.ambient`
              owns `box-shadow` and is unlayered, so a Tailwind ring on the same
              element is inert. A ring and a border are the same 1px line here.
            */}
            {logoFailed ? (
              <div className="ambient amb-elevation-0 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-macos-blue text-[10px] font-bold text-white">
                {APP_NAME.charAt(0)}
              </div>
            ) : (
              <span className="ambient amb-elevation-0 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-[var(--app-hairline)] bg-[var(--app-surface-raised)]">
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
              <p className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-macos-text-muted sm:block">
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
              className="rounded-full text-macos-text-muted hover:text-macos-text dark:hover:text-zinc-100"
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
              className="relative rounded-full text-macos-text-muted hover:text-macos-text dark:hover:text-zinc-100"
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
            {/*
              The last `active:scale-[0.98]` in the app. A control that shrinks
              when pressed is imitating glass; `.mat-press` sinks the surface
              instead, which is what every other control here now does. It was
              also carrying `shadow-sm`, which `.ambient` would have swallowed
              anyway — so the depth comes from the material, not a Tailwind
              shadow that was already inert.
            */}
            <button
              type="button"
              className="ambient amb-elevation-0 mat-press flex cursor-pointer items-center gap-2 rounded-full border border-[var(--app-hairline)] bg-[var(--app-surface-raised)] py-1 pl-1 pr-2 text-left transition-colors duration-200 hover:bg-[var(--app-chrome)]"
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
                <div className="border-b border-black/5 px-4 py-3 dark:border-white/10">
                  <p className="text-sm font-bold leading-tight text-macos-text dark:text-zinc-100">
                    {currentUser?.name ?? 'Admin'}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-macos-text-muted">
                    {(currentUser?.role ?? 'admin').replace(/_/g, ' ')}
                  </p>
                </div>
                {/*
                  The `dark:` partner is not decoration. This element is a plain
                  button, so nothing else supplies its dark colour: without it the
                  logout label keeps the light-mode red and lands at roughly 2.2:1
                  on the dark menu. It was already failing before the colour moved
                  — the Apple system red it used to carry measures about 3.9:1 on
                  this surface, still under the 4.5:1 floor for text.
                */}
                <button
                  type="button"
                  onClick={logout}
                  className="w-full cursor-pointer px-4 py-2.5 text-left text-xs font-semibold text-red-700 transition-colors hover:bg-macos-red/10 dark:text-red-300"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Page Toolbar */}
      <div className="surface-toolbar relative z-[40] flex h-11 shrink-0 items-center justify-between px-3 lg:px-4">
        <div className="flex min-w-0 items-center gap-3">
          {/*
            Mobile only. The desktop collapse control is gone by design — from
            `lg` up the rail is permanent, so there is nothing to toggle there.
          */}
          <Button
            size="icon"
            variant="ghost"
            onClick={toggleSidebar}
            title={isSidebarOpen ? 'Hide navigation' : 'Show navigation'}
            aria-label={isSidebarOpen ? 'Hide navigation' : 'Show navigation'}
            aria-expanded={isSidebarOpen}
            className="rounded-full text-macos-text-muted hover:text-macos-text dark:hover:text-zinc-100 lg:hidden"
          >
            <PanelLeft className="h-4 w-4" />
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
          onNavigate={closeSidebar}
          className={cn(
            'absolute bottom-0 left-0 top-0 z-50 lg:static',
            !isSidebarOpen && 'hidden lg:flex',
          )}
        />
        {/*
          The scrim doubles as the click-to-close target for the mobile drawer.
          The `onClick` is the feature — it used to be carried by an animation
          wrapper, and dropping that wrapper must not drop the handler.
        */}
        {isSidebarOpen && (
          <div
            className="absolute inset-0 z-40 bg-black/40 lg:hidden"
            onClick={closeSidebar}
          />
        )}
        <main className="flex flex-1 flex-col overflow-hidden bg-transparent transition-colors duration-300">
          <div className="flex-1 overflow-y-auto p-3 scrollbar-hide lg:p-5 xl:p-6">
            {/*
              The page surface. Until Phase 3 this was the single strongest
              signal of the frosted-glass look — a translucent white panel with
              a blur wrapped *every* route, so no amount of restyling inside a
              page could change what the app felt like. It is now one opaque,
              token-driven surface, and it is the same markup in both themes
              because the tokens carry the theme rather than a `dark:` override.
            */}
            <section className="min-h-full rounded-[1.5rem] border border-[var(--app-hairline)] bg-[var(--app-surface-raised)] p-3 shadow-[var(--shadow-card)] lg:p-4">
              {children}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
};
