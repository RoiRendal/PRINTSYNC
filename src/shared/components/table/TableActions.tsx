import React, { useState } from 'react';
import { RefreshCcw, Download, Check } from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';

interface TableActionsProps {
  onRefresh?: () => void;
  onExport?: () => void;
}

export const TableActions: React.FC<TableActionsProps> = ({ 
  onRefresh, 
  onExport, 
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
    <div className="flex flex-wrap gap-1.5 items-center">
      <Tooltip content="Refresh Data">
        <button 
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex whitespace-nowrap shrink-0 items-center justify-center p-1.5 text-gray-600 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-all disabled:opacity-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700"
          aria-label="Refresh Data"
        >
          <RefreshCcw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </Tooltip>
      
      <Tooltip content="Export Data">
        <button 
          onClick={handleExport}
          disabled={isExporting}
          className="flex whitespace-nowrap shrink-0 items-center justify-center p-1.5 text-white bg-slate-900 border border-slate-900 rounded hover:bg-slate-800 transition-all disabled:bg-slate-500 dark:bg-blue-600 dark:border-blue-600 dark:hover:bg-blue-500 dark:disabled:bg-blue-900"
          aria-label="Export Data"
        >
          {isExporting ? (
            <Check className="w-3.5 h-3.5" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
        </button>
      </Tooltip>
    </div>
  );
};

