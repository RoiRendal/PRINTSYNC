import React, { useEffect, useRef, useState } from 'react';
import { Bell, Building2, Download, ImagePlus, Palette, Settings2 } from 'lucide-react';

import { useTheme } from '../../../app/providers/ThemeProvider';
import { useBusinessBranding } from '../../../app/providers/BusinessBrandingProvider';
import { useNotifications } from '../../../app/providers/NotificationProvider';
import { BRAND_LOGO_URL, BUSINESS_LOGO_CONTENT_TYPES, DEFAULT_BUSINESS_DISPLAY_NAME } from '../../../shared/constants/branding';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, GlassCard, Input, Select } from '../../../shared/components/ui';
import { cn } from '../../../shared/lib/cn';
import { exportApi } from '../api/exportApi';

function SettingIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.95rem] bg-[var(--app-surface-sub)] text-macos-blue shadow-[var(--shadow-card)] ring-1 ring-[var(--app-border-hairline)] dark:text-macos-cyan">
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
      className="flex w-full cursor-pointer items-center justify-between rounded-[var(--radius-card)] border bg-[var(--app-surface-raised)] p-3 text-left shadow-[var(--shadow-card)] transition-all hover:border-[var(--app-border-control)] hover:bg-[var(--app-state-hover)] dark:bg-[#39393b] dark:hover:bg-[#414143]"
    >
      <span className="text-xs font-semibold text-macos-text dark:text-zinc-200">{label}</span>
      <span className={cn('relative h-5 w-9 rounded-full p-0.5 transition-colors', enabled ? 'bg-macos-green' : 'bg-[#d9d9d9] dark:bg-[#525254]')}>
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
    businessLogoUrl,
    uploadBusinessLogo,
    clearBusinessLogo,
    vatRate,
    setVatRate,
    currencySymbol,
    setCurrencySymbol,
    maxBusinessLogoBytes,
    brandingError,
  } = useBusinessBranding();
  const { settings, toggleStockAlerts, toggleExportAlerts } = useNotifications();
  const [companyDraft, setCompanyDraft] = useState(businessDisplayName);
  const [vatDraft, setVatDraft] = useState(String(vatRate));
  const [currencyDraft, setCurrencyDraft] = useState(currencySymbol);
  const [logoUploadError, setLogoUploadError] = useState('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [defaultsError, setDefaultsError] = useState('');
  const [exportError, setExportError] = useState('');
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCompanyDraft(businessDisplayName);
  }, [businessDisplayName]);

  useEffect(() => {
    setVatDraft(String(vatRate));
  }, [vatRate]);

  useEffect(() => {
    setCurrencyDraft(currencySymbol);
  }, [currencySymbol]);

  const handleSaveCompanyName = async () => {
    try {
      await setBusinessDisplayName(companyDraft);
    } catch (error) {
      setLogoUploadError(error instanceof Error ? error.message : 'Business name could not be saved.');
    }
  };

  const handleSaveDefaults = async () => {
    setDefaultsError('');
    try {
      const rate = parseFloat(vatDraft);
      if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
        setDefaultsError('VAT rate must be between 0 and 100.');
        return;
      }
      const symbol = currencyDraft.trim();
      if (!symbol) {
        setDefaultsError('Currency symbol is required.');
        return;
      }
      await Promise.all([setVatRate(rate), setCurrencySymbol(symbol)]);
    } catch (error) {
      setDefaultsError(error instanceof Error ? error.message : 'Defaults could not be saved.');
    }
  };

  const handleBusinessLogoFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setLogoUploadError('');
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!BUSINESS_LOGO_CONTENT_TYPES.includes(file.type as (typeof BUSINESS_LOGO_CONTENT_TYPES)[number])) {
      setLogoUploadError('Choose a PNG, JPG, WebP, or SVG image.');
      return;
    }
    if (file.size > maxBusinessLogoBytes) {
      setLogoUploadError(`Keep the logo under ${Math.round(maxBusinessLogoBytes / (1024 * 1024))} MB.`);
      return;
    }
    setIsUploadingLogo(true);
    try {
      await uploadBusinessLogo(file);
    } catch (error) {
      setLogoUploadError(error instanceof Error ? error.message : 'The business logo could not be uploaded.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleClearBusinessLogo = async () => {
    setLogoUploadError('');
    setIsUploadingLogo(true);
    try {
      await clearBusinessLogo();
    } catch (error) {
      setLogoUploadError(error instanceof Error ? error.message : 'The business logo could not be removed.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleExportOrders = async () => {
    setExportError('');
    try {
      await exportApi.downloadOrders();
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Orders could not be exported.');
    }
  };

  const handleExportInventory = async () => {
    setExportError('');
    try {
      await exportApi.downloadInventory();
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Inventory could not be exported.');
    }
  };

  const handleExportTransactions = async () => {
    setExportError('');
    try {
      await exportApi.downloadTransactions();
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Transactions could not be exported.');
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-macos-text dark:text-zinc-100 lg:text-[28px]">Settings</h1>
        <p className="mt-1 text-sm text-macos-text-muted dark:text-zinc-400">Manage business identity, defaults, appearance, and data export.</p>
      </div>

      <Card variant="elevated" padding="lg" className="overflow-hidden">
        <CardHeader className="border-b pb-4">
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
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.15rem] border bg-[var(--app-surface-raised)] p-3 shadow-[var(--shadow-card)] dark:bg-[#3d3d3f]">
                <img src={effectiveBusinessLogoUrl} alt="" className="max-h-16 max-w-full object-contain" />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <ImagePlus className="h-4 w-4 text-macos-blue dark:text-macos-cyan" aria-hidden="true" />
                  <p className="text-xs font-bold text-macos-text dark:text-zinc-100">Business logo</p>
                </div>
                <p className="text-[11px] leading-relaxed text-macos-text-muted dark:text-zinc-400">
                  Stored in Supabase Storage, up to{' '}
                  <span className="font-mono text-[10px]">{Math.round(maxBusinessLogoBytes / (1024 * 1024))} MB</span>. Falls back to{' '}
                  <span className="font-mono text-[10px]">{BRAND_LOGO_URL}</span> when unset.
                </p>
                <input ref={logoFileInputRef} type="file" accept={BUSINESS_LOGO_CONTENT_TYPES.join(',')} className="sr-only" onChange={handleBusinessLogoFile} />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" disabled={isUploadingLogo} onClick={() => logoFileInputRef.current?.click()}>
                    {isUploadingLogo ? 'Uploading…' : 'Upload image'}
                  </Button>
                  {businessLogoUrl != null && (
                    <Button type="button" variant="secondary" size="sm" disabled={isUploadingLogo} onClick={handleClearBusinessLogo}>
                      Use default logo
                    </Button>
                  )}
                </div>
                {(logoUploadError || brandingError) && <p className="text-[11px] font-medium text-macos-red dark:text-red-300">{logoUploadError || brandingError}</p>}
              </div>
            </div>
          </GlassCard>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <Card variant="elevated" padding="lg" className="overflow-hidden">
          <CardHeader className="border-b pb-4">
            <div className="flex items-start gap-3">
              <SettingIcon><Settings2 className="h-5 w-5" aria-hidden="true" /></SettingIcon>
              <div>
                <CardTitle>Business Defaults</CardTitle>
                <CardDescription>System-wide values applied to POS transactions and reports.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-5 pt-5 md:grid-cols-2">
            <div className="space-y-5">
              <label className="block space-y-1.5" htmlFor="vat-rate">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-macos-text-muted dark:text-zinc-500">Default VAT Rate (%)</span>
                <Input
                  id="vat-rate"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={vatDraft}
                  onChange={(e) => setVatDraft(e.target.value)}
                />
              </label>
              <label className="block space-y-1.5" htmlFor="currency-symbol">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-macos-text-muted dark:text-zinc-500">Currency Symbol</span>
                <Select
                  id="currency-symbol"
                  value={currencyDraft}
                  onChange={(e) => setCurrencyDraft(e.target.value)}
                >
                  <option value="₱">₱ (Philippine Peso)</option>
                  <option value="$">$ (US Dollar)</option>
                  <option value="€">€ (Euro)</option>
                  <option value="£">£ (British Pound)</option>
                  <option value="¥">¥ (Japanese Yen)</option>
                  <option value="₹">₹ (Indian Rupee)</option>
                  <option value="A$">A$ (Australian Dollar)</option>
                  <option value="C$">C$ (Canadian Dollar)</option>
                </Select>
              </label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={handleSaveDefaults}>Save defaults</Button>
              </div>
              {defaultsError && <p className="text-[11px] font-medium text-macos-red dark:text-red-300">{defaultsError}</p>}
            </div>

            <GlassCard className="space-y-4 p-4">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.22em] text-macos-text-muted dark:text-zinc-500">Current Defaults</h3>
              <div className="space-y-3 text-[10px]">
                <div className="flex justify-between gap-3"><span className="font-bold uppercase tracking-wider text-macos-text-muted">VAT Rate</span><span className="font-mono font-bold text-macos-text dark:text-zinc-200">{vatRate}%</span></div>
                <div className="flex justify-between gap-3"><span className="font-bold uppercase tracking-wider text-macos-text-muted">Currency</span><span className="font-mono font-bold text-macos-text dark:text-zinc-200">{currencySymbol}</span></div>
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
          <div className="flex rounded-full border bg-[var(--app-surface-raised)] p-1 shadow-[var(--shadow-card)] dark:bg-[#3d3d3f]">
            {(['light', 'dark', 'system'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTheme(item)}
                className={cn('h-8 flex-1 cursor-pointer rounded-full px-3 text-[10px] font-bold uppercase tracking-[0.18em] transition-all', theme === item ? 'bg-macos-blue text-white shadow-[0_8px_18px_rgb(0_122_255/0.22)]' : 'text-macos-text-muted hover:bg-[var(--app-state-hover)] dark:text-zinc-400 dark:hover:bg-[#414143]')}
              >
                {item}
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Card variant="elevated" padding="lg" className="overflow-hidden">
          <CardHeader className="border-b pb-4">
            <div className="flex items-start gap-3">
              <SettingIcon><Download className="h-5 w-5" aria-hidden="true" /></SettingIcon>
              <div>
                <CardTitle>Data Export</CardTitle>
                <CardDescription>Download your business data as CSV for backup or analysis.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-5">
            {exportError && <p className="text-[11px] font-medium text-macos-red dark:text-red-300">{exportError}</p>}
            <button
              type="button"
              onClick={handleExportOrders}
              className="flex w-full cursor-pointer items-center justify-between rounded-[var(--radius-card)] border bg-[var(--app-surface-raised)] p-3 text-left shadow-[var(--shadow-card)] transition-all hover:border-[var(--app-border-control)] hover:bg-[var(--app-state-hover)] dark:bg-[#39393b] dark:hover:bg-[#414143]"
            >
              <span className="text-xs font-semibold text-macos-text dark:text-zinc-200">Export Orders</span>
              <span className="text-[10px] text-macos-text-muted dark:text-zinc-500">CSV</span>
            </button>
            <button
              type="button"
              onClick={handleExportInventory}
              className="flex w-full cursor-pointer items-center justify-between rounded-[var(--radius-card)] border bg-[var(--app-surface-raised)] p-3 text-left shadow-[var(--shadow-card)] transition-all hover:border-[var(--app-border-control)] hover:bg-[var(--app-state-hover)] dark:bg-[#39393b] dark:hover:bg-[#414143]"
            >
              <span className="text-xs font-semibold text-macos-text dark:text-zinc-200">Export Inventory</span>
              <span className="text-[10px] text-macos-text-muted dark:text-zinc-500">CSV</span>
            </button>
            <button
              type="button"
              onClick={handleExportTransactions}
              className="flex w-full cursor-pointer items-center justify-between rounded-[var(--radius-card)] border bg-[var(--app-surface-raised)] p-3 text-left shadow-[var(--shadow-card)] transition-all hover:border-[var(--app-border-control)] hover:bg-[var(--app-state-hover)] dark:bg-[#39393b] dark:hover:bg-[#414143]"
            >
              <span className="text-xs font-semibold text-macos-text dark:text-zinc-200">Export Transactions</span>
              <span className="text-[10px] text-macos-text-muted dark:text-zinc-500">CSV</span>
            </button>
          </CardContent>
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
