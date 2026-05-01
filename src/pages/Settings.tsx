import React, { useState } from 'react';
import { Shield, Database, Download, Check, History, Bell, Cloud } from 'lucide-react';

export default function Settings() {
  const [isExporting, setIsExporting] = useState(false);

  const handleExportArchive = () => {
    setIsExporting(true);
    
    // Simulate system-wide data archiving
    const archiveData = {
      timestamp: new Date().toISOString(),
      version: "2.4.0",
      system: "PRINTSYNC ERP",
      data: {
        inventory: "All stock records",
        orders: "Complete transaction history",
        users: "User profiles and permissions",
        finance: "Ledger and tax records",
        analytics: "Performance metrics"
      }
    };

    const blob = new Blob([JSON.stringify(archiveData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `printsync-data-archive-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setTimeout(() => {
      setIsExporting(false);
    }, 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded dark:bg-blue-900/20 dark:text-blue-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-tight text-gray-900 dark:text-zinc-100">Data & Safekeeping</h2>
              <p className="text-xs text-gray-500 dark:text-zinc-500">Manage system database and archival exports</p>
            </div>
          </div>
          <button 
            onClick={handleExportArchive}
            disabled={isExporting}
            className={`flex items-center gap-2 px-6 py-2.5 rounded text-xs font-bold uppercase tracking-widest transition-all ${
              isExporting 
                ? 'bg-green-600 text-white' 
                : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500'
            }`}
          >
            {isExporting ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4" />}
            {isExporting ? 'Archive Generated' : 'Export Data Archive'}
          </button>
        </div>
        
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 bg-gray-50/30 dark:bg-zinc-900/50">
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500">System Archives</h3>
            <div className="space-y-2">
               {[
                 { name: 'Weekly Auto-Backup', date: 'Yesterday 11:45 PM', size: '14.2 MB' },
                 { name: 'End-of-Month Audit', date: '2024-04-30', size: '128.5 MB' },
                 { name: 'Inventory Snapshot', date: '2024-04-15', size: '2.1 MB' }
               ].map((item, idx) => (
                 <div key={idx} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded hover:border-blue-300 transition-colors cursor-pointer group dark:bg-zinc-900 dark:border-zinc-800 dark:hover:border-blue-700">
                   <div className="flex items-center gap-3">
                     <History className="w-4 h-4 text-gray-400 group-hover:text-blue-500 dark:text-zinc-600 dark:group-hover:text-blue-400" />
                     <div>
                       <p className="text-xs font-semibold text-gray-800 dark:text-zinc-200">{item.name}</p>
                       <p className="text-[10px] text-gray-400 dark:text-zinc-500">{item.date}</p>
                     </div>
                   </div>
                   <span className="text-[10px] font-mono text-gray-500 dark:text-zinc-600">{item.size}</span>
                 </div>
               ))}
            </div>
          </div>

          <div className="space-y-4">
             <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500">Connection Status</h3>
             <div className="p-4 bg-white border border-gray-200 rounded space-y-4 dark:bg-zinc-900 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2">
                     <Cloud className="w-4 h-4 text-green-500 dark:text-green-400" />
                     <span className="text-xs font-medium dark:text-zinc-300">Cloud Sync</span>
                   </div>
                   <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold uppercase dark:bg-green-900/30 dark:text-green-400 dark:border-green-900/40">Online</span>
                </div>
                <div className="h-px bg-gray-100 dark:bg-zinc-800" />
                <div className="flex items-center justify-between text-[10px]">
                   <span className="text-gray-500 uppercase dark:text-zinc-500">Database Version</span>
                   <span className="font-mono font-bold text-gray-900 dark:text-zinc-300">v14.2.1-stable</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                   <span className="text-gray-500 uppercase dark:text-zinc-500">Last Integrity Check</span>
                   <span className="font-mono font-bold text-gray-900 dark:text-zinc-300">May 01, 2026</span>
                </div>
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded p-6 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-5 h-5 text-gray-400 dark:text-zinc-500" />
            <h3 className="text-xs font-bold uppercase tracking-tight dark:text-zinc-200">Security</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded dark:bg-zinc-800">
              <span className="text-xs dark:text-zinc-300">Two-Factor Authentication</span>
              <div className="w-8 h-4 bg-blue-600 rounded-full relative"><div className="absolute right-1 top-1 w-2 h-2 bg-white rounded-full"></div></div>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded dark:bg-zinc-800">
              <span className="text-xs dark:text-zinc-300">IP Access Restriction</span>
              <div className="w-8 h-4 bg-gray-300 rounded-full relative dark:bg-zinc-700 font-bold uppercase"><div className="absolute left-1 top-1 w-2 h-2 bg-white rounded-full"></div></div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded p-6 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="w-5 h-5 text-gray-400 dark:text-zinc-500" />
            <h3 className="text-xs font-bold uppercase tracking-tight dark:text-zinc-200">Notifications</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded dark:bg-zinc-800">
              <span className="text-xs dark:text-zinc-300">Export Completion Alerts</span>
              <div className="w-8 h-4 bg-blue-600 rounded-full relative"><div className="absolute right-1 top-1 w-2 h-2 bg-white rounded-full"></div></div>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded dark:bg-zinc-800">
              <span className="text-xs dark:text-zinc-300">Stock Level Critical Warnings</span>
              <div className="w-8 h-4 bg-blue-600 rounded-full relative"><div className="absolute right-1 top-1 w-2 h-2 bg-white rounded-full"></div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
