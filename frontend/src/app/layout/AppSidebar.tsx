import { NavLink } from 'react-router-dom';
import { motion } from 'motion/react';
import { NAV_ITEMS } from '../../shared/constants/navigation';
import { cn } from '../../shared/lib/cn';
import { useUserContext } from '../../features/users/state/UserContext';

export const Sidebar = ({ isCollapsed, className, onNavigate }: { isCollapsed: boolean, className?: string, onNavigate?: () => void }) => {
  const { currentUser } = useUserContext();
  const visibleItems = currentUser
    ? NAV_ITEMS.filter((item) => currentUser.access.includes(item.key))
    : [];

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 0 : 244 }}
      transition={{ type: 'spring', stiffness: 420, damping: 38 }}
      className={cn(
        'glass-panel flex shrink-0 flex-col overflow-hidden border-r border-white/55 text-macos-text dark:border-white/10 dark:text-zinc-100',
        'rounded-none lg:my-3 lg:ml-3 lg:rounded-[1.35rem]',
        className,
      )}
    >
      <div className="flex h-full min-w-[244px] flex-col">
        <div className="border-b border-black/5 px-4 py-4 dark:border-white/10">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-macos-text-muted dark:text-zinc-500">
            Navigation
          </p>
          <p className="mt-1 truncate text-sm font-bold text-macos-text dark:text-zinc-100">
            Print Operations
          </p>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-2.5 py-3 scrollbar-hide">
          {visibleItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-3 overflow-hidden rounded-2xl px-3 py-2.5 text-[13px] font-semibold transition-colors duration-200',
                  isActive
                    ? 'text-white dark:text-white'
                    : 'text-macos-text-muted hover:text-macos-text dark:text-zinc-400 dark:hover:text-zinc-100',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="sidebar-active-pill"
                      className="absolute inset-0 rounded-2xl bg-gradient-to-r from-macos-blue to-macos-cyan shadow-[0_10px_26px_rgb(0_122_255/0.24)]"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  )}
                  <motion.span
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                    className={cn(
                      'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-colors duration-200',
                      isActive
                        ? 'border-white/20 bg-white/20 text-white'
                        : 'border-black/5 bg-white/55 text-macos-text-muted group-hover:bg-white/80 group-hover:text-macos-text dark:border-white/10 dark:bg-white/8 dark:group-hover:bg-white/14 dark:group-hover:text-zinc-100',
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                  </motion.span>
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

        <div className="border-t border-black/5 px-4 py-3 dark:border-white/10">
          <div className="rounded-2xl border border-white/45 bg-white/42 p-3 shadow-sm dark:border-white/10 dark:bg-white/8">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-macos-blue dark:text-macos-cyan">
              Synced
            </p>
            <p className="mt-1 text-xs font-medium text-macos-text-muted dark:text-zinc-400">
              Cloud workspace online
            </p>
          </div>
        </div>
      </div>
    </motion.aside>
  );
};
