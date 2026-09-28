import React, { useState, useEffect } from 'react';
import { Sidebar } from './AppSidebar';
import { useLocation } from 'react-router-dom';
import { Bell, ChevronLeft, Monitor, Moon, PanelLeft, Sun } from '../../shared/components/ui/icons';
import { useTheme } from '../providers/ThemeProvider';
import { useNotifications } from '../providers/NotificationProvider';
import { NotificationPanel } from '../components/NotificationPanel';
import { ConnectionStatus } from '../components/ConnectionStatus';
import { cn } from '../../shared/lib/cn';
import { NAV_ITEMS } from '../../shared/constants/navigation';
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
  const { currentUser, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

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

  /* Kept deliberately independent of `isCollapsed`. Collapsed hides the sidebar
     outright (width 0); minimized keeps it on screen as an icon rail — logo plus
     icons, no labels. Remembering the two separately is what lets someone hide
     the sidebar and come back to the width they had chosen. */
  const [isMinimized, setIsMinimized] = useState(() => {
    return localStorage.getItem('sidebar-minimized') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('sidebar-minimized', String(isMinimized));
  }, [isMinimized]);

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
  const toggleMinimize = () => setIsMinimized(!isMinimized);
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
    /* One row, two columns: the sidebar owns the entire left edge for the full
       height of the window, and everything else stacks in the column to its
       right. The flex default `align-items: stretch` is what makes the sidebar
       reach from the top of the window to the bottom — it is never given a
       height of its own. */
    <div className="relative flex h-screen w-full overflow-hidden bg-[var(--app-surface)] text-[var(--app-text)] font-sans dark:text-zinc-100">
      {/* Left sidebar — full height, and the only place the brand appears.
          On small screens it becomes an overlay drawer. It has to sit ABOVE the
          header (`z-[70]` vs the header's `z-[60]`): the drawer starts at y=0 and
          spans the top of the window, and the header spans the full width, so at
          a lower z the header would paint over the drawer's brand block — the
          top 48px of the sidebar. On `lg` and up the sidebar is `static`, so this
          z-index does not apply and the two never overlap horizontally. */}
      <Sidebar
        isCollapsed={isCollapsed}
        isMinimized={isMinimized}
        onToggleMinimize={toggleMinimize}
        onNavigate={closeSidebar}
        className={cn(
          'absolute bottom-0 left-0 top-0 z-[70] lg:static',
          isCollapsed && 'hidden lg:flex',
        )}
      />
      {!isCollapsed && (
        <div
          className="absolute inset-0 z-40 bg-[var(--app-scrim)] lg:hidden"
          onClick={toggleCollapse}
        />
      )}

      {/* Right column — header, page toolbar and content, stacked top to bottom. */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Global Top Header. The brand moved into the sidebar, so this bar is
            deliberately empty on the left and carries only the global controls
            on the right. */}
        <header className="relative z-[60] flex h-12 shrink-0 items-center justify-end border-b border-[var(--app-border-frame)] bg-[var(--app-surface)] px-3 lg:px-5 xl:px-6">
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
                {/* The count used to sit at `right-1.5 top-1.5` at 16px square —
                    which is the exact 16px box the bell occupies inside this 28px
                    button, so it covered the icon outright rather than annotating
                    it. It now hangs off the button's top-right corner (negative
                    offsets) and is a step smaller, so only its own corner meets
                    the bell's box. `px-0.5` is deliberate: at `px-1` the "9+"
                    label alone widens the pill back across the icon. */}
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full border border-white bg-macos-red px-0.5 text-2xs font-bold text-white dark:border-zinc-950">
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
              {/* The pill's fill is token-driven, never a literal. It used to be
                  `bg-[#f4f4f6]` — the one hardcoded light fill in the app with no
                  `dark:` partner — so in dark mode a near-white pill carried a
                  near-white name (`dark:text-zinc-100`) at about 1.02:1 and the
                  button read as a blank white blob. `-sub` already means "a
                  control resting on the header": its dark step (#3a3a3c) puts the
                  name at 10.3:1. Light shifts one shade (#f4f4f6 -> #ececef) to
                  match every other resting control, and hover now darkens
                  (#dedee3) rather than lightening (#f9f9fa) — the direction the
                  rest of the app already uses. */}
              <button
                type="button"
                className="flex cursor-pointer items-center gap-2 rounded-full border border-[var(--app-border-hairline)] bg-[var(--app-surface-sub)] py-1 pl-1 pr-2 text-left hover:bg-[var(--app-state-hover-sub)] active:scale-[0.98]"
                aria-expanded={isProfileOpen}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-macos-blue text-2xs font-bold text-[var(--app-accent-ink)]">
                  {initials}
                </div>
                <span className="hidden max-w-28 truncate text-xs font-semibold text-[var(--app-text)] sm:inline">
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
                      <p className="mt-1 text-2xs font-semibold text-macos-text-muted dark:text-zinc-500">
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

        {/* Page Toolbar. Inset from the column's edges and fully outlined — it
            shares one fill with the header, so the outline is the only thing that
            makes it read as a bar of its own. The corner is one step smaller than
            the body card's: at this height that larger radius would round the ends
            into a capsule instead of a corner.

            Its left and right margins track the content area's horizontal inset at
            each breakpoint (12 / 20 / 24), so the bar's edges land on the body
            card's edges. The horizontal padding is a flat 8px, which is what sets
            the chevron's left edge just inside the bar's own border. */}
        <div className="relative z-[40] mx-3 mt-2 flex h-10 shrink-0 items-center justify-between rounded-2xl border border-[var(--app-border-frame)] bg-[var(--app-surface)] px-2 lg:mx-5 xl:mx-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleCollapse}
              title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              aria-label={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              className="h-8 w-8 rounded-full text-macos-text-muted hover:text-macos-text dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              {isCollapsed ? <PanelLeft className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
            </Button>
            <div className="min-w-0">
              <span className="block truncate text-sm font-bold tracking-tight text-macos-text dark:text-zinc-100">{currentLabel}</span>

            </div>
          </div>
          <ConnectionStatus className="shrink-0 px-2 py-0.5 text-2xs" />
        </div>

        {/* Main Content Area. The body card sits in the same 12 / 20 / 24 gutter
            as the header and the toolbar above it, so all three share one left
            and right edge down the column. The 8px of top padding is the same 8px
            that sits above the toolbar. */}
        <main className="flex flex-1 flex-col overflow-hidden bg-transparent">
          <div className="flex-1 overflow-y-auto p-3 pt-2 scrollbar-hide lg:p-5 lg:pt-2 xl:p-6 xl:pt-2">
            <section className="min-h-full rounded-[1.5rem] border border-[var(--app-border-frame)] bg-[var(--app-surface)] p-3 lg:p-4">
              {children}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
};
