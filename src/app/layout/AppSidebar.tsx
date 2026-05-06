import React from 'react';
import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '../../shared/constants/navigation';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Sidebar = ({ isCollapsed, className, onNavigate }: { isCollapsed: boolean, className?: string, onNavigate?: () => void }) => {
  return (
    <aside 
      className={cn(
        "bg-gray-50 text-gray-900 flex flex-col shrink-0 dark:bg-zinc-950 dark:text-zinc-100 overflow-hidden",
        isCollapsed ? "w-0 border-r-0" : "w-fit min-w-[3.25rem] border-r border-gray-300 dark:border-zinc-800",
        className
      )}
    >
      <nav className="flex-1 px-1.5 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden scrollbar-hide">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 px-2 py-1 rounded text-[13px] font-medium group relative",
                isActive 
                  ? "bg-slate-900 text-white shadow-lg shadow-black/20" 
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-200 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800",
                isCollapsed && "justify-center px-0"
              )
            }
            title={isCollapsed ? item.label : undefined}
          >
            <item.icon className="w-4 h-4 opacity-80 shrink-0" />
            {!isCollapsed && (
              <span className="whitespace-nowrap overflow-hidden">
                {item.label}
              </span>
            )}
            {isCollapsed && (
              <div className="absolute left-full ml-3 px-2 py-1 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity font-bold uppercase tracking-wider z-50 whitespace-nowrap shadow-xl border border-gray-300 dark:border-zinc-800">
                {item.label}
              </div>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

