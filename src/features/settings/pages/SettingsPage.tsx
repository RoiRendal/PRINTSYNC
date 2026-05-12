import React, { useEffect, useRef, useState } from 'react';
import { Shield, Database, Download, Check, History, Bell, Cloud, Palette, Building2, ImagePlus } from 'lucide-react';
import { useTheme } from '../../../app/providers/ThemeProvider';
import { useBusinessBranding } from '../../../app/providers/BusinessBrandingProvider';
import { APP_NAME, BRAND_LOGO_URL, DEFAULT_BUSINESS_DISPLAY_NAME } from '../../../shared/constants/branding';

import { Tooltip } from '../../../shared/components/ui/Tooltip';

export default function Settings() {
  const [isExporting, setIsExporting] = useState(false);
  const { theme, setTheme } = useTheme();
  const {
    businessDisplayName,
    setBusinessDisplayName,
    effectiveBusinessLogoUrl,
    customBusinessLogoDataUrl,
    setCustomBusinessLogoDataUrl,
    maxCustomLogoBytes,
  } = useBusinessBranding();
  const [companyDraft, setCompanyDraft] = useState(businessDisplayName);
  const [logoUploadError, setLogoUploadError] = useState('');
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCompanyDraft(businessDisplayName);
  }, [businessDisplayName]);

  const handleExportArchive = () => {
    setIsExporting(true);
    
    // Simulate system-wide data archiving
    const archiveData = {
      timestamp: new Date().toISOString(),
      version: "2.4.0",
      system: `${APP_NAME} ERP`,
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

  const handleSaveCompanyName = () => {
    setBusinessDisplayName(companyDraft);
  };

  const handleBusinessLogoFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLogoUploadError('');
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setLogoUploadError('Choose an image file (PNG, JPG, or WebP).');
      return;
    }
    if (file.size > maxCustomLogoBytes) {
      setLogoUploadError(`Keep the file under about ${Math.round(maxCustomLogoBytes / 1000)} KB so it fits in browser storage.`);
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setLogoUploadError('Could not read that file. Try another image.');
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        setCustomBusinessLogoDataUrl(result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto space-y-4">
      <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
        <div className="p-4 border-b border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-zinc-100 text-zinc-900 rounded dark:bg-zinc-800/40 dark:text-zinc-200">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-tight text-gray-900 dark:text-zinc-100">Business identity</h2>
              <p className="text-xs text-gray-500 dark:text-zinc-500">
                Company name shown in the header and reports.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1 space-y-1.5">
              <label htmlFor="company-display-name" className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-500">
                Company name
              </label>
              <input
                id="company-display-name"
                type="text"
                value={companyDraft}
                onChange={(e) => setCompanyDraft(e.target.value)}
                className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded text-sm text-gray-900 dark:text-zinc-100"
                autoComplete="organization"
              />
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSaveCompanyName}
                className="px-4 py-2.5 rounded text-xs font-bold uppercase bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setCompanyDraft(DEFAULT_BUSINESS_DISPLAY_NAME);
                  setBusinessDisplayName(DEFAULT_BUSINESS_DISPLAY_NAME);
                }}
                className="px-4 py-2.5 rounded text-xs font-bold uppercase bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Reset default
              </button>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100 dark:border-zinc-800">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-zinc-100 text-zinc-900 rounded dark:bg-zinc-800/40 dark:text-zinc-200">
                <ImagePlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-tight text-gray-900 dark:text-zinc-100">Business logo</h3>
                <p className="text-xs text-gray-500 dark:text-zinc-500">
                  Shown in the app header and login screen. Uses <span className="font-mono text-[10px]">{BRAND_LOGO_URL}</span> until you upload a replacement (saved in this browser).
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded border border-gray-200 bg-gray-50 dark:border-zinc-700 dark:bg-zinc-800/50">
                <img
                  src={effectiveBusinessLogoUrl}
                  alt=""
                  className="max-h-14 max-w-[7rem] object-contain"
                />
              </div>
              <div className="flex flex-col gap-2 min-w-0 flex-1">
                <input
                  ref={logoFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="sr-only"
                  onChange={handleBusinessLogoFile}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => logoFileInputRef.current?.click()}
                    className="px-4 py-2.5 rounded text-xs font-bold uppercase bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                  >
                    Upload image
                  </button>
                  {customBusinessLogoDataUrl != null && (
                    <button
                      type="button"
                      onClick={() => {
                        setLogoUploadError('');
                        setCustomBusinessLogoDataUrl(null);
                      }}
                      className="px-4 py-2.5 rounded text-xs font-bold uppercase bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    >
                      Use file logo instead
                    </button>
                  )}
                </div>
                {logoUploadError && (
                  <p className="text-[11px] text-red-600 dark:text-red-400">{logoUploadError}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-100 text-zinc-900 rounded dark:bg-zinc-800/40 dark:text-zinc-200">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-tight text-gray-900 dark:text-zinc-100">Data & Safekeeping</h2>
              <p className="text-xs text-gray-500 dark:text-zinc-500">Manage system database and archival exports</p>
            </div>
          </div>
          <Tooltip content="Export Data">
            <button 
              onClick={handleExportArchive}
              disabled={isExporting}
              className={`flex items-center justify-center p-2.5 rounded transition-all ${
                isExporting 
                  ? 'bg-green-600 text-white' 
                  : 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800'
              }`}
              aria-label="Export Data"
            >
              {isExporting ? <Check className="w-5 h-5" /> : <Download className="w-5 h-5" />}
            </button>
          </Tooltip>
        </div>
        
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-5 bg-gray-50/30 dark:bg-zinc-900/50">
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500">System Archives</h3>
            <div className="space-y-2">
               {[
                 { name: 'Weekly Auto-Backup', date: 'Yesterday 11:45 PM', size: '14.2 MB' },
                 { name: 'End-of-Month Audit', date: '2024-04-30', size: '128.5 MB' },
                 { name: 'Inventory Snapshot', date: '2024-04-15', size: '2.1 MB' }
               ].map((item, idx) => (
                 <div key={idx} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded hover:border-zinc-400 transition-colors cursor-pointer group dark:bg-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-500">
                   <div className="flex items-center gap-3">
                     <History className="w-4 h-4 text-gray-400 group-hover:text-zinc-600 dark:text-zinc-600 dark:group-hover:text-zinc-200" />
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded p-4 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex items-center gap-3 mb-4">
            <Palette className="w-5 h-5 text-gray-400 dark:text-zinc-500" />
            <h3 className="text-xs font-bold uppercase tracking-tight dark:text-zinc-200">Appearance</h3>
          </div>
          <div className="flex gap-2">
            {(['light', 'dark', 'system'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`px-4 py-2 rounded text-xs font-bold uppercase transition-colors ${theme === t ? 'bg-zinc-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded p-4 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-5 h-5 text-gray-400 dark:text-zinc-500" />
            <h3 className="text-xs font-bold uppercase tracking-tight dark:text-zinc-200">Security</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded dark:bg-zinc-800">
              <span className="text-xs dark:text-zinc-300">Two-Factor Authentication</span>
              <div className="w-8 h-4 bg-zinc-900 rounded-full relative"><div className="absolute right-1 top-1 w-2 h-2 bg-white rounded-full"></div></div>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded dark:bg-zinc-800">
              <span className="text-xs dark:text-zinc-300">IP Access Restriction</span>
              <div className="w-8 h-4 bg-gray-300 rounded-full relative dark:bg-zinc-700 font-bold uppercase"><div className="absolute left-1 top-1 w-2 h-2 bg-white rounded-full"></div></div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded p-4 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="w-5 h-5 text-gray-400 dark:text-zinc-500" />
            <h3 className="text-xs font-bold uppercase tracking-tight dark:text-zinc-200">Notifications</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded dark:bg-zinc-800">
              <span className="text-xs dark:text-zinc-300">Export Completion Alerts</span>
              <div className="w-8 h-4 bg-zinc-900 rounded-full relative"><div className="absolute right-1 top-1 w-2 h-2 bg-white rounded-full"></div></div>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded dark:bg-zinc-800">
              <span className="text-xs dark:text-zinc-300">Stock Level Critical Warnings</span>
              <div className="w-8 h-4 bg-zinc-900 rounded-full relative"><div className="absolute right-1 top-1 w-2 h-2 bg-white rounded-full"></div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

