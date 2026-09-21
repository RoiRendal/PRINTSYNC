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
                  'group relative flex items-center gap-1.5 overflow-hidden rounded-xl px-2.5 py-1 text-[13px] font-semibold',
                  /* One colour for both states, and the icon inherits it, so
                     selecting an item never recolours anything — only the row's
                     own fill moves. Hover is a fill for the same reason: there is
                     no colour left to change. */
                  'text-[var(--app-text)]',
                  !isActive && 'hover:bg-[var(--app-state-hover)]',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute inset-0 rounded-xl bg-[var(--app-state-selected)]" />
                  )}
                  {/* An alignment box only. It paints nothing and takes its colour
                      from the row, so the icon and the label can never drift apart. */}
                  <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center">
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
