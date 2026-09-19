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
        'surface-panel flex w-[196px] shrink-0 flex-col overflow-hidden border-r border-[var(--app-hairline)] text-macos-text dark:text-zinc-100',
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
              /*
               * The active item is a key that has been pushed in, not a pill
               * that lights up — the same `.mat-sunk` idiom the segmented
               * controls use, so "you are here" reads the same way everywhere.
               *
               * It keeps `bg-macos-blue` where the segmented pills moved to
               * `bg-segment-*` (task #41), and the asymmetry is deliberate. It
               * is not the same surface: the sidebar is `.surface-panel`, so the
               * row sits on `--app-surface-raised`, and there `#555558` with a
               * white label measures 7.43:1 — it was never broken. The pills
               * sit on the darker `surface-segmented` track instead, which is
               * what made a light, saturated fill fail against it.
               *
               * The material has to sit on the `NavLink` itself rather than on
               * a child. The previous version put a full-bleed gradient span at
               * `inset-0` behind the label and gave it a blue glow, but this
               * element carries `overflow-hidden` to clip the truncating label,
               * which clips a *descendant's* cast shadow. A raised child would
               * have had its bevel silently cut off at the row's edges.
               */
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-2.5 overflow-hidden rounded-xl px-2.5 py-2 text-[13px] font-semibold transition-colors duration-200',
                  isActive
                    ? 'mat-sunk bg-macos-blue text-white'
                    : 'text-macos-text-muted hover:text-macos-text dark:text-zinc-300 dark:hover:text-zinc-100',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors duration-200',
                      isActive
                        ? 'border-white/20 bg-white/20 text-white'
                        : 'border-[var(--app-hairline)] bg-[var(--app-chrome)] text-macos-text-muted group-hover:bg-[var(--app-surface)] group-hover:text-macos-text dark:text-zinc-200 dark:group-hover:text-zinc-100',
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                  </span>
                  <span className="truncate whitespace-nowrap">
                    {item.label}
                  </span>
                  {isActive && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white/85" />
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
