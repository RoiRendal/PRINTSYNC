import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '../../shared/constants/navigation';
import { cn } from '../../shared/lib/cn';
import { useAuth } from '../../app/stores/useAuthStore';

/**
 * Navigation rail.
 *
 * Always full width — the collapse control was removed deliberately, so there is
 * no collapsed state to render. Visibility is the caller's concern: `AppLayout`
 * hides this below `lg` unless the mobile drawer is open, which is why the width
 * is fixed rather than animated.
 */
export const Sidebar = ({ className, onNavigate }: { className?: string; onNavigate?: () => void }) => {
  const { currentUser } = useAuth();
  const visibleItems = currentUser
    ? NAV_ITEMS.filter((item) => currentUser.access.includes(item.key))
    : [];

  return (
    <aside
      className={cn(
        'glass-panel flex w-[196px] shrink-0 flex-col overflow-hidden border-r border-white/55 text-macos-text dark:border-white/10 dark:text-zinc-100',
        'rounded-none lg:my-3 lg:ml-3 lg:rounded-[1.35rem]',
        className,
      )}
    >
      <div className="flex h-full min-w-[196px] flex-col">
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 scrollbar-hide">
          {visibleItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-2.5 overflow-hidden rounded-xl px-2.5 py-2 text-[13px] font-semibold transition-colors duration-200',
                  isActive
                    ? 'text-white dark:text-white'
                    : 'text-macos-text-muted hover:text-macos-text dark:text-zinc-300 dark:hover:text-zinc-100',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-macos-blue to-macos-cyan shadow-[0_10px_26px_rgb(0_122_255/0.24)]" />
                  )}
                  <span
                    className={cn(
                      'relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors duration-200',
                      isActive
                        ? 'border-white/20 bg-white/20 text-white'
                        : 'border-black/5 bg-white/55 text-macos-text-muted group-hover:bg-white/80 group-hover:text-macos-text dark:border-white/20 dark:bg-white/22 dark:text-zinc-200 dark:group-hover:bg-white/30 dark:group-hover:text-zinc-100',
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                  </span>
                  <span className="relative z-10 truncate whitespace-nowrap">
                    {item.label}
                  </span>
                  {isActive && (
                    <span className="relative z-10 ml-auto h-1.5 w-1.5 rounded-full bg-white/85 shadow-[0_0_12px_rgb(255_255_255/0.8)]" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  );
};
