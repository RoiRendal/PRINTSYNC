import { useCallback, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '../../shared/constants/navigation';
import { APP_NAME } from '../../shared/constants/branding';
import { ChevronLeft, ChevronRight } from '../../shared/components/ui/icons';
import { Button, Skeleton } from '../../shared/components/ui';
import { cn } from '../../shared/lib/cn';
import { useAuth } from '../../app/stores/useAuthStore';
import { useBusinessBranding } from '../../app/providers/BusinessBrandingProvider';

/** Width of the minimized rail: the logo tile and the nav icon boxes are both
 *  28px, so 56 leaves 14px of clearance on either side of them and still reads
 *  as a deliberate column rather than a strip. */
const MINIMIZED_WIDTH = 56;
/** Trimmed from 196. The column only has to be as wide as its widest row plus
 *  the gutters that frame it, and those gutters were tightened at the same time
 *  — so the visible inset stays comfortable while the column itself gets 20px
 *  narrower. Keep this in step with the `min-w-[176px]` floor below. */
const EXPANDED_WIDTH = 176;

export const Sidebar = ({
  isCollapsed,
  isMinimized,
  isNavLoading = false,
  onToggleMinimize,
  className,
  onNavigate,
}: {
  isCollapsed: boolean;
  isMinimized: boolean;
  /**
   * The navigation is RBAC-filtered — `visibleItems` is derived from
   * `currentUser.access` — so before the session resolves there is no honest list
   * to draw. This swaps the links for placeholder rows rather than showing an
   * empty column, which is the state ERPNext's own sidebar skeleton covers.
   */
  isNavLoading?: boolean;
  onToggleMinimize: () => void;
  className?: string;
  onNavigate?: () => void;
}) => {
  const { currentUser } = useAuth();
  const { effectiveBusinessLogoUrl } = useBusinessBranding();
  const [logoFailed, setLogoFailed] = useState(false);

  const handleLogoError = useCallback(() => {
    setLogoFailed(true);
  }, []);

  // A new logo URL is a fresh chance to render it, so clear any past failure.
  useEffect(() => {
    setLogoFailed(false);
  }, [effectiveBusinessLogoUrl]);

  const visibleItems = currentUser
    ? NAV_ITEMS.filter((item) => currentUser.access.includes(item.key))
    : [];

  return (
    <aside
      /* Three widths, in precedence order: collapsed (hidden) wins over
         minimized (icon rail), which wins over expanded. It is written as an
         inline style rather than a class because a class would fight the
         responsive `hidden lg:flex` the parent passes for the collapsed mobile
         case. */
      style={{ width: isCollapsed ? 0 : isMinimized ? MINIMIZED_WIDTH : EXPANDED_WIDTH }}
      className={cn(
        /* Full-height column on the left edge of the shell. It carries the
           right border that separates it from the header/toolbar/body stack, so
           it runs edge to edge rather than sitting in an inset rounded panel. */
        'flex shrink-0 flex-col overflow-hidden bg-[var(--app-surface-sidebar)] text-app-ink dark:text-zinc-100',
        'border-r border-[var(--app-border-frame)]',
        className,
      )}
    >
      {/* The 176px floor stops the brand and the nav labels from being squeezed
          during a width change. It has to be dropped while minimized, or it would
          hold the rail open at the expanded width. Written as a literal class
          string, not interpolated — Tailwind scans source text, so a built
          `min-w-[176px]` would never be generated. */}
      <div className={cn('flex h-full flex-col', !isMinimized && 'min-w-[176px]')}>
        {/* Brand. The business NAME now lives in the top header's left; only the
            logo stays here, centred in the brand row so it reads as a mark, not a
            lockup. The logo is decorative (`alt=""`) — the accessible name is the
            header's visible business name, so a screen reader never hears it twice.

            The rule that used to sit under this block is gone. It was there to
            separate the brand from the navigation, but the sidebar already has
            its own tint and its own right border, so the line was doing no
            separating work — it just cut the column in two. The row keeps the
            header's `h-12` so the navigation still starts on the same line as the
            toolbar in the column beside it. */}
        <div className="flex h-12 shrink-0 items-center justify-center px-2.5">
          {logoFailed ? (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center text-sm font-bold text-app-accent dark:text-app-accent-soft">
              {APP_NAME.charAt(0)}
            </div>
          ) : (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center">
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
        </div>

        {/* Navigation. The top padding is the gap between the brand and the first
            tab; it stays small so the list starts tight under the brand.

            Minimized, each row is just its icon, centred. The label is kept as
            `sr-only` — removing it would leave the links with no accessible name
            at all — and repeated as a `title` so a pointer user can still read
            what an icon is. */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-1 pb-3 pt-2 scrollbar-hide">
          {/* The loading state of the SAME list, not a second list. One pill per
              `NAV_ITEMS` entry is the most rows the column can ever hold, which
              is the honest ceiling while the session's access list is unknown.

              Each pill sits in an `h-7` slot — the real row's own height (the
              28px icon box) — so the rows arrive on exactly the same pitch and
              nothing moves. The pill inside is deliberately SHORTER than its
              slot: a real nav row is transparent at rest, so nine full-height
              pills stacked with no gap between them merge into one scalloped
              blob instead of reading as nine rows. The slot holds the geometry,
              the pill holds the shape. */}
          {isNavLoading
            ? NAV_ITEMS.map((item) => (
                <div key={item.key} className="flex h-7 items-center">
                  <Skeleton className={cn('h-5 rounded-lg', isMinimized ? 'mx-auto w-5' : 'w-full')} />
                </div>
              ))
            : visibleItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              title={isMinimized ? item.label : undefined}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-1.5 overflow-hidden rounded-xl px-2 text-sm font-semibold',
                  /* One colour for both states, and the icon inherits it, so
                     selecting an item never recolours anything — only the row's
                     own fill moves. Hover is a fill for the same reason: there is
                     no colour left to change. */
                  'text-[var(--app-text)]',
                  !isActive && 'hover:bg-[var(--app-state-hover-sidebar)]',
                  isMinimized && 'justify-center gap-0 px-0',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute inset-0 rounded-xl bg-[var(--app-state-selected-sidebar)]" />
                  )}
                  {/* An alignment box only. It paints nothing and takes its colour
                      from the row, so the icon and the label can never drift apart. */}
                  <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center">
                    <item.icon className="h-4 w-4" />
                  </span>
                  <span className={cn('truncate whitespace-nowrap', isMinimized ? 'sr-only' : 'relative z-10')}>
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Minimize. Placed in the sidebar itself, not in the page toolbar: the
            toolbar's chevron hides the sidebar outright, whereas this collapses it
            to an icon rail and leaves it on screen. It sits at the foot of the
            column so it stays in the same place in both widths — centred in the
            rail, pushed to the outer edge when expanded.

            No divider above it and no text label: the chevron alone, which is what
            keeps a layout control quiet until it is looked for. Its name still
            says what it does, via `aria-label` and `title`. */}
        <div
          className={cn(
            'flex shrink-0 items-center p-1.5',
            isMinimized ? 'justify-center' : 'justify-end',
          )}
        >
          <Button
            size="icon"
            variant="ghost"
            onClick={onToggleMinimize}
            title={isMinimized ? 'Show sidebar labels' : 'Minimize sidebar to icons'}
            aria-label={isMinimized ? 'Restore sidebar' : 'Minimize sidebar'}
            aria-expanded={!isMinimized}
            className="h-7 w-7 rounded-lg text-app-text-muted hover:text-app-ink dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            {isMinimized ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </aside>
  );
};
