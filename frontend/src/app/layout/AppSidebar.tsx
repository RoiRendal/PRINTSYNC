import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '../../shared/constants/navigation';
import { cn } from '../../shared/lib/cn';
import { useAuth } from '../../app/stores/useAuthStore';

export const Sidebar = ({ isCollapsed, className, onNavigate }: { isCollapsed: boolean, className?: string, onNavigate?: () => void }) => {
  const { currentUser } = useAuth();
  const visibleItems = currentUser
    ? NAV_ITEMS.filter((item) => currentUser.access.includes(item.key))
    : [];

  return (
    <aside
      /* The width used to be driven by a spring-animated width prop. The
         library wrote it as an inline style, so the static equivalent is an
         inline style too — a class would fight the responsive `hidden lg:flex`
         the parent passes for the collapsed mobile case. */
      style={{ width: isCollapsed ? 0 : 196 }}
      className={cn(
        'flex shrink-0 flex-col overflow-hidden bg-[var(--app-surface)] text-macos-text dark:text-zinc-100',
        'rounded-none lg:my-3 lg:ml-3 lg:rounded-[1.35rem]',
        className,
      )}
    >
      <div className="flex h-full min-w-[196px] flex-col">
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-1 py-3 scrollbar-hide">
          {visibleItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-2.5 overflow-hidden rounded-xl px-2.5 py-1.5 text-[13px] font-semibold',
                  isActive
                    ? 'text-white dark:text-white'
                    : 'text-macos-text-muted hover:text-macos-text dark:text-zinc-300 dark:hover:text-zinc-100',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute inset-0 rounded-xl bg-macos-blue" />
                  )}
                  <span
                    className={cn(
                      'relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border',
                      /* Tile fills are the flat composites of the translucent
                         whites they replace, over whatever each one actually sat
                         on: the inactive light tile was on the white sidebar and
                         so was already white, while the dark tiles and the active
                         tile (which sits on the solid accent pill) were not. */
                      isActive
                        ? 'border-[#78787a] bg-[#78787a] text-white'
                        : 'border-[var(--app-border-hairline)] bg-[var(--app-surface-raised)] text-macos-text-muted group-hover:text-macos-text dark:border-[#565658] dark:bg-[#5a5a5c] dark:text-zinc-200 dark:group-hover:bg-[#6b6b6d] dark:group-hover:text-zinc-100',
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                  </span>
                  <span className="relative z-10 truncate whitespace-nowrap">
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  );
};
