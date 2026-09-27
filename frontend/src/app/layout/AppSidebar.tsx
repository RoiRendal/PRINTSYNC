import { useCallback, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '../../shared/constants/navigation';
import { APP_NAME } from '../../shared/constants/branding';
import { cn } from '../../shared/lib/cn';
import { useAuth } from '../../app/stores/useAuthStore';
import { useBusinessBranding } from '../../app/providers/BusinessBrandingProvider';

export const Sidebar = ({ isCollapsed, className, onNavigate }: { isCollapsed: boolean, className?: string, onNavigate?: () => void }) => {
  const { currentUser } = useAuth();
  const { businessDisplayName, effectiveBusinessLogoUrl } = useBusinessBranding();
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
      /* The width used to be driven by a spring-animated width prop. The
         library wrote it as an inline style, so the static equivalent is an
         inline style too — a class would fight the responsive `hidden lg:flex`
         the parent passes for the collapsed mobile case. */
      style={{ width: isCollapsed ? 0 : 196 }}
      className={cn(
        /* Full-height column on the left edge of the shell. It carries the
           right border that separates it from the header/toolbar/body stack, so
           it runs edge to edge rather than sitting in an inset rounded panel. */
        'flex shrink-0 flex-col overflow-hidden bg-[var(--app-surface)] text-macos-text dark:text-zinc-100',
        'border-r border-[var(--app-border-frame)]',
        className,
      )}
    >
      <div className="flex h-full min-w-[196px] flex-col">
        {/* Brand. The logo and the business name live here now — they used to sit
            in the top header, which is left empty on its left side so the brand
            reads as belonging to the sidebar. The border under this block is what
            separates the brand from the navigation list. */}
        <div className="flex items-center gap-2 border-b border-[var(--app-border-frame)] px-3 py-2.5">
          {logoFailed ? (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-macos-blue text-2xs font-bold text-[var(--app-accent-ink)]">
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
            <h1
              className="truncate text-sm font-bold tracking-tight text-macos-text dark:text-white"
              title={APP_NAME}
            >
              {businessDisplayName}
            </h1>
          </div>
        </div>

        {/* Navigation. The top padding is the gap between the brand border and the
            first tab; it stays small so the list starts tight under the brand. */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-1 pb-3 pt-2 scrollbar-hide">
          {visibleItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-1.5 overflow-hidden rounded-xl px-2.5 text-sm font-semibold',
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
