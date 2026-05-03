import React from 'react';
import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '../../constants';
import { motion, AnimatePresence } from 'motion/react';
import { PanelLeft } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Sidebar = ({ isCollapsed, className, onNavigate }: { isCollapsed: boolean, className?: string, onNavigate?: () => void }) => {
  return (
    <aside 
      className={cn(
        "bg-gray-50 text-gray-900 flex flex-col shrink-0 transition-all duration-300 ease-in-out dark:bg-zinc-950 dark:text-zinc-100 overflow-hidden",
        isCollapsed ? "w-0 border-r-0" : "w-fit min-w-[3.5rem] border-r border-gray-200 dark:border-zinc-800",
        className
      )}
    >
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto overflow-x-hidden scrollbar-hide">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 px-2 py-1 rounded text-sm transition-all duration-200 group relative",
                isActive 
                  ? "bg-blue-600 text-white font-medium shadow-lg shadow-blue-500/20" 
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-200 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800",
                isCollapsed && "justify-center px-0"
              )
            }
            title={isCollapsed ? item.label : undefined}
          >
            <item.icon className="w-4 h-4 opacity-80 shrink-0" />
            <AnimatePresence>
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="whitespace-nowrap overflow-hidden"
                >
                  {item.label}
                </motion.span>
              )}
            </AnimatePresence>
            {isCollapsed && (
              <div className="absolute left-full ml-3 px-2 py-1 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity font-bold uppercase tracking-wider z-50 whitespace-nowrap shadow-xl border border-gray-200 dark:border-zinc-800">
                {item.label}
              </div>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};
