import React, { useEffect, useRef, useState } from 'react';
import { Bell, Building2, Cloud, Database, History, ImagePlus, Palette, Shield } from 'lucide-react';

import { useTheme } from '../../../app/providers/ThemeProvider';
import { useBusinessBranding } from '../../../app/providers/BusinessBrandingProvider';
import { useNotifications } from '../../../app/providers/NotificationProvider';
import { BRAND_LOGO_URL, DEFAULT_BUSINESS_DISPLAY_NAME } from '../../../shared/constants/branding';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, GlassCard, Input } from '../../../shared/components/ui';
import { cn } from '../../../shared/lib/cn';

function SettingIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.95rem] bg-gradient-to-br from-macos-blue/18 to-white/40 text-macos-blue shadow-[var(--shadow-card)] ring-1 ring-macos-blue/20 dark:from-macos-blue-dark/20 dark:to-white/5 dark:text-macos-cyan">
      {children}
    </div>
  );
}

function ToggleSwitch({ label, enabled, onToggle }: { label: string; enabled: boolean; onToggle?: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={enabled}
      onClick={onToggle}
      className="flex w-full cursor-pointer items-center justify-between rounded-[var(--radius-card)] border border-white/45 bg-white/54 p-3 text-left shadow-[var(--shadow-card)] transition-all hover:border-macos-blue/25 hover:bg-white/72 dark:border-white/10 dark:bg-white/6 dark:hover:border-macos-blue-dark/25 dark:hover:bg-white/10"
    >
      <span className="text-xs font-semibold text-macos-text dark:text-zinc-200">{label}</span>
      <span className={cn('relative h-5 w-9 rounded-full p-0.5 transition-colors', enabled ? 'bg-macos-green' : 'bg-black/15 dark:bg-white/18')}>
        <span className={cn('block h-4 w-4 rounded-full bg-white shadow transition-transform', enabled && 'translate-x-4')} />
      </span>
    </button>
  );
}

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const {
    businessDisplayName,
    setBusinessDisplayName,
    effectiveBusinessLogoUrl,
    customBusinessLogoDataUrl,
    setCustomBusinessLogoDataUrl,
    maxCustomLogoBytes,
    brandingError,
  } = useBusinessBranding();
  const { settings, toggleStockAlerts, toggleExportAlerts } = useNotifications();
  const [companyDraft, setCompanyDraft] = useState(businessDisplayName);
  const [logoUploadError, setLogoUploadError] = useState('');
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCompanyDraft(businessDisplayName);
  }, [businessDisplayName]);

  const handleSaveCompanyName = async () => {
    try {
      await setBusinessDisplayName(companyDraft);
    } catch (error) {
      setLogoUploadError(error instanceof Error ? error.message : 'Business name could not be saved.');
    }
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
        void setCustomBusinessLogoDataUrl(result).catch((error: unknown) => {
          setLogoUploadError(error instanceof Error ? error.message : 'The business logo could not be saved.');
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const archives = [
    { name: 'Weekly Auto-Backup', date: 'Yesterday 11:45 PM', size: '14.2 MB' },
    { name: 'End-of-Month Audit', date: '2024-04-30', size: '128.5 MB' },
    { name: 'Inventory Snapshot', date: '2024-04-15', size: '2.1 MB' },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>

        <h1 className="text-2xl font-bold tracking-tight text-macos-text dark:text-zinc-100 lg:text-[28px]">Settings</h1>
        <p className="mt-1 text-sm text-macos-text-muted dark:text-zinc-400">Tune identity, sync posture, appearance, and operational safeguards.</p>
      </div>

      <Card variant="elevated" padding="lg" className="overflow-hidden">
        <CardHeader className="border-b border-black/5 pb-4 dark:border-white/10">
          <div className="flex items-start gap-3">
            <SettingIcon><Building2 className="h-5 w-5" aria-hidden="true" /></SettingIcon>
            <div>
              <CardTitle>Business identity</CardTitle>
              <CardDescription>Company name and logo shown in the header, login screen, and reports.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 pt-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.45fr)]">
          <div className="space-y-5">
            <label className="block space-y-1.5" htmlFor="company-display-name">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-macos-text-muted dark:text-zinc-500">Company name</span>
              <Input
                id="company-display-name"
                type="text"
                value={companyDraft}
                onChange={(e) => setCompanyDraft(e.target.value)}
                autoComplete="organization"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={handleSaveCompanyName}>Save identity</Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setCompanyDraft(DEFAULT_BUSINESS_DISPLAY_NAME);
                  void setBusinessDisplayName(DEFAULT_BUSINESS_DISPLAY_NAME).catch((error: unknown) => {
                    setLogoUploadError(error instanceof Error ? error.message : 'Business name could not be reset.');
                  });
                }}
              >
                Reset default
              </Button>
            </div>
          </div>

          <GlassCard className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.15rem] border border-white/50 bg-white/60 p-3 shadow-[var(--shadow-card)] dark:border-white/10 dark:bg-white/8">
                <img src={effectiveBusinessLogoUrl} alt="" className="max-h-16 max-w-full object-contain" />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <ImagePlus className="h-4 w-4 text-macos-blue dark:text-macos-cyan" aria-hidden="true" />
                  <p className="text-xs font-bold text-macos-text dark:text-zinc-100">Business logo</p>
                </div>
                <p className="text-[11px] leading-relaxed text-macos-text-muted dark:text-zinc-400">
                  Uses <span className="font-mono text-[10px]">{BRAND_LOGO_URL}</span> until you upload a browser-saved replacement.
                </p>
                <input ref={logoFileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={handleBusinessLogoFile} />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={() => logoFileInputRef.current?.click()}>Upload image</Button>
                  {customBusinessLogoDataUrl != null && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setLogoUploadError('');
                        void setCustomBusinessLogoDataUrl(null).catch((error: unknown) => {
                          setLogoUploadError(error instanceof Error ? error.message : 'The business logo could not be removed.');
                        });
                      }}
                    >
                      Use file logo
                    </Button>
                  )}
                </div>
                {(logoUploadError || brandingError) && <p className="text-[11px] font-medium text-macos-red dark:text-red-300">{logoUploadError || brandingError}</p>}
              </div>
            </div>
          </GlassCard>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <Card variant="elevated" padding="none" className="overflow-hidden">
          <CardHeader className="mb-0 border-b border-black/5 p-4 dark:border-white/10">
            <div className="flex items-start gap-3">
              <SettingIcon><Database className="h-5 w-5" aria-hidden="true" /></SettingIcon>
              <div>
                <CardTitle>Data & Safekeeping</CardTitle>
                <CardDescription>System archive activity and database connection telemetry.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-5 p-4 md:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.22em] text-macos-text-muted dark:text-zinc-500">System Archives</h3>
              {archives.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  className="flex w-full cursor-pointer items-center justify-between rounded-[var(--radius-card)] border border-white/45 bg-white/58 p-3 text-left shadow-[var(--shadow-card)] hover:border-macos-blue/30 dark:border-white/10 dark:bg-white/6"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.75rem] bg-black/5 text-macos-text-muted dark:bg-white/8 dark:text-zinc-500"><History className="h-4 w-4" aria-hidden="true" /></span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-bold text-macos-text dark:text-zinc-100">{item.name}</span>
                      <span className="text-[10px] text-macos-text-muted dark:text-zinc-500">{item.date}</span>
                    </span>
                  </span>
                  <span className="font-mono text-[10px] text-macos-text-muted dark:text-zinc-500">{item.size}</span>
                </button>
              ))}
            </div>

            <GlassCard className="space-y-4 p-4">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.22em] text-macos-text-muted dark:text-zinc-500">Connection Status</h3>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cloud className="h-4 w-4 text-macos-green" aria-hidden="true" />
                  <span className="text-xs font-semibold text-macos-text dark:text-zinc-200">Cloud Sync</span>
                </div>
                <Badge variant="green">Online</Badge>
              </div>
              <div className="h-px bg-black/5 dark:bg-white/10" />
              <div className="space-y-3 text-[10px]">
                <div className="flex justify-between gap-3"><span className="font-bold uppercase tracking-wider text-macos-text-muted">Database Version</span><span className="font-mono font-bold text-macos-text dark:text-zinc-200">v14.2.1-stable</span></div>
                <div className="flex justify-between gap-3"><span className="font-bold uppercase tracking-wider text-macos-text-muted">Integrity Check</span><span className="font-mono font-bold text-macos-text dark:text-zinc-200">May 01, 2026</span></div>
              </div>
            </GlassCard>
          </CardContent>
        </Card>

        <Card variant="glass" padding="lg">
          <CardHeader>
            <div className="flex items-start gap-3">
              <SettingIcon><Palette className="h-5 w-5" aria-hidden="true" /></SettingIcon>
              <div>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>Apply a persistent app color scheme.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <div className="flex rounded-full border border-white/50 bg-white/55 p-1 shadow-[var(--shadow-card)] backdrop-blur-xl dark:border-white/10 dark:bg-white/8">
            {(['light', 'dark', 'system'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTheme(item)}
                className={cn('h-8 flex-1 cursor-pointer rounded-full px-3 text-[10px] font-bold uppercase tracking-[0.18em] transition-all', theme === item ? 'bg-macos-blue text-white shadow-[0_8px_18px_rgb(0_122_255/0.22)]' : 'text-macos-text-muted hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10')}
              >
                {item}
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Card variant="glass" padding="lg">
          <CardHeader>
            <div className="flex items-start gap-3">
              <SettingIcon><Shield className="h-5 w-5" aria-hidden="true" /></SettingIcon>
              <div>
                <CardTitle>Security</CardTitle>
                <CardDescription>Mac-style toggles for protective controls.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <div className="space-y-3">
            <ToggleSwitch label="Two-Factor Authentication" enabled />
            <ToggleSwitch label="IP Access Restriction" enabled={false} />
          </div>
        </Card>

        <Card variant="glass" padding="lg">
          <CardHeader>
            <div className="flex items-start gap-3">
              <SettingIcon><Bell className="h-5 w-5" aria-hidden="true" /></SettingIcon>
              <div>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Control operational alerts across exports and stock.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <div className="space-y-3">
            <ToggleSwitch label="Export Completion Alerts" enabled={settings.exportAlertsEnabled} onToggle={toggleExportAlerts} />
            <ToggleSwitch label="Stock Level Critical Warnings" enabled={settings.stockAlertsEnabled} onToggle={toggleStockAlerts} />
          </div>
        </Card>
      </div>
    </div>
  );
}
