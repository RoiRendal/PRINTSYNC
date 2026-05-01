import React, { useState } from 'react';
import { RefreshCcw, Download, Check } from 'lucide-react';

interface TableActionsProps {
  onRefresh?: () => void;
  onExport?: () => void;
  exportLabel?: string;
}

export const TableActions: React.FC<TableActionsProps> = ({ 
  onRefresh, 
  onExport, 
  exportLabel = "Export Data" 
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleRefresh = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    if (onRefresh) onRefresh();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const handleExport = () => {
    if (isExporting) return;
    setIsExporting(true);
    if (onExport) onExport();
    
    // Simulate export
    const content = "Dummy data for export";
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `export-${new Date().getTime()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setTimeout(() => setIsExporting(false), 2000);
  };

  return (
    <div className="flex gap-2 items-center">
      <button 
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-600 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-all disabled:opacity-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700"
        title="Refresh data"
      >
        <RefreshCcw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
        {isRefreshing ? 'Refreshing...' : 'Refresh'}
      </button>
      <button 
        onClick={handleExport}
        disabled={isExporting}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white bg-slate-900 border border-slate-900 rounded hover:bg-slate-800 transition-all disabled:bg-slate-500 dark:bg-blue-600 dark:border-blue-600 dark:hover:bg-blue-500 dark:disabled:bg-blue-900"
        title={exportLabel}
      >
        {isExporting ? (
          <Check className="w-3 h-3" />
        ) : (
          <Download className="w-3 h-3" />
        )}
        {isExporting ? 'Exported' : exportLabel}
      </button>
    </div>
  );
};
