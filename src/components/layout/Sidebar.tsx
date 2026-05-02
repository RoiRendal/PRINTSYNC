import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '../../constants';
import { motion, AnimatePresence } from 'motion/react';
import { Printer, Moon, Sun, ChevronLeft, PanelLeft } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useTheme } from '../../context/ThemeContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Sidebar = () => {
  const { theme, toggleTheme } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(isCollapsed));
  }, [isCollapsed]);

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  return (
    <aside 
      className={cn(
        "bg-gray-50 text-gray-900 flex flex-col border-r border-gray-200 shrink-0 transition-all duration-300 ease-in-out dark:bg-zinc-950 dark:text-zinc-100 dark:border-zinc-800 overflow-hidden",
        isCollapsed ? "w-16" : "w-52"
      )}
    >
      <div className={cn("p-4 border-b border-gray-200 dark:border-zinc-800 flex items-center shrink-0 h-12 justify-center")}>
        <button 
          onClick={toggleCollapse}
          className="p-1.5 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 transition-colors"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <PanelLeft className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto overflow-x-hidden scrollbar-hide">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded text-sm transition-all duration-200 group relative",
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
