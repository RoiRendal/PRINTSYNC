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
        "bg-slate-900 text-white flex flex-col border-r border-slate-800 shrink-0 transition-all duration-300 ease-in-out dark:bg-black dark:border-slate-900 overflow-hidden",
        isCollapsed ? "w-16" : "w-52"
      )}
    >
      <div className={cn("p-4 border-b border-slate-800 flex items-center shrink-0 h-12 justify-center")}>
        <button 
          onClick={toggleCollapse}
          className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
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
                  ? "bg-blue-600 text-white font-medium shadow-lg shadow-blue-900/20" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800",
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
              <div className="absolute left-full ml-3 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity font-bold uppercase tracking-wider z-50 whitespace-nowrap shadow-xl border border-slate-700">
                {item.label}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-800 space-y-4">
        {/* Theme Toggle */}
        <button 
          onClick={toggleTheme}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors group",
            isCollapsed && "justify-center px-0 text-amber-500 hover:text-amber-400"
          )}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? (
            <>
              <Moon className="w-4 h-4" />
              {!isCollapsed && <span>Dark Mode</span>}
            </>
          ) : (
            <>
              <Sun className="w-4 h-4" />
              {!isCollapsed && <span>Light Mode</span>}
            </>
          )}
        </button>
      </div>
    </aside>
  );
};
