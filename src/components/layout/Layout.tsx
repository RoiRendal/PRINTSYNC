import React from 'react';
import { Sidebar } from './Sidebar';
import { motion, AnimatePresence } from 'motion/react';
import { useLocation } from 'react-router-dom';
import { Bell } from 'lucide-react';

import { NAV_ITEMS, APP_NAME } from '../../constants';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const currentPath = location.pathname;
  const currentLabel = NAV_ITEMS.find(item => item.path === currentPath)?.label || 'Dashboard';

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-gray-50 text-gray-900 font-sans selection:bg-blue-600 selection:text-white dark:bg-zinc-950 dark:text-zinc-100 transition-colors duration-300">
      {/* Global Top Header */}
      <header className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0 dark:bg-zinc-900 dark:border-zinc-800 transition-colors duration-300 z-10">
        <div className="flex items-center gap-8">
          {/* Logo Section */}
          <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap">
            <div className="w-5 h-5 bg-blue-500 rounded-sm flex items-center justify-center text-white font-bold text-[10px] shrink-0">{APP_NAME.charAt(0)}</div>
            <h1 className="text-gray-900 dark:text-white font-bold tracking-tight text-base">{APP_NAME}</h1>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden lg:flex items-center gap-2 px-3 py-0.5 bg-green-50 text-green-700 rounded-full border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-[9px] font-bold uppercase tracking-wider">Live Production</span>
          </div>

          <div className="flex items-center gap-4 border-l pl-4 dark:border-zinc-800">
            <button className="relative p-1 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 transition-colors group">
              <Bell className="w-4 h-4" />
              <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full border border-white dark:border-zinc-900" />
            </button>
            
            <div className="flex items-center gap-3 pl-2 border-l dark:border-zinc-800 cursor-pointer group">
              <div className="flex flex-col text-right hidden sm:block">
                <p className="text-[10px] font-bold text-gray-800 dark:text-zinc-200 leading-none group-hover:text-blue-600 transition-colors">Admin Terminal</p>
                <p className="text-[9px] text-gray-400 dark:text-zinc-500 mt-1 uppercase tracking-tighter">Station 01-MNL</p>
              </div>
              <div className="w-7 h-7 rounded-full bg-slate-900 dark:bg-zinc-800 flex items-center justify-center text-[9px] font-bold text-white shadow-lg shadow-black/10 group-hover:bg-blue-600 transition-all duration-300">
                AD
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area (Sidebar + Content) */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-zinc-950 transition-colors duration-300">
          <div className="flex-1 overflow-y-auto p-6 lg:p-8 xl:p-10 scrollbar-hide">
            <div className="mb-6 flex flex-col">
              <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-zinc-100">{currentLabel}</h2>
              <div className="text-[11px] text-gray-400 font-mono mt-1 dark:text-zinc-500 uppercase tracking-widest">
                System Log • {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
};
