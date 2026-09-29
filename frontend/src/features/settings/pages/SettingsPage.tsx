import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../../app/providers/ThemeProvider';
import { useBusinessBranding } from '../../../app/providers/BusinessBrandingProvider';
import { useNotifications } from '../../../app/providers/NotificationProvider';
import { BRAND_LOGO_URL, BUSINESS_LOGO_CONTENT_TYPES, DEFAULT_BUSINESS_DISPLAY_NAME } from '../../../shared/constants/branding';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, SurfaceCard, Input, Select, SegmentedControl } from '../../../shared/components/ui';
import { InlineAlert } from '../../../shared/components/feedback/InlineAlert';
import { cn } from '../../../shared/lib/cn';
import { exportApi } from '../api/exportApi';

function ToggleSwitch({ label, enabled, onToggle }: { label: string; enabled: boolean; onToggle?: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={enabled}
      onClick={onToggle}
      className="flex w-full cursor-pointer items-center justify-between rounded-[var(--radius-card)] border p-3 text-left hover:border-[var(--app-border-control)] hover:bg-[var(--app-state-hover)] dark:hover:bg-[var(--app-tint-neutral)]"
    >
      <span className="text-xs font-semibold text-app-ink dark:text-zinc-200">{label}</span>
      <span className={cn('relative h-5 w-9 rounded-full p-0.5', enabled ? 'bg-app-success' : 'bg-[var(--app-state-selected)] dark:bg-[var(--app-state-hover-sub)]')}>
        <span className={cn('block h-4 w-4 rounded-full bg-white ring-1 ring-black/20', enabled && 'translate-x-4')} />
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
  /**
   * The logo row can fail from either side — the upload, or the branding
   * provider behind it — and the banner shows whichever spoke. Hoisted out of
   * the JSX so the guard and the message read the same value; `brandingError` is
   * `string | null`, which the inline `||` could not narrow for the prop.
   */
  const logoError = logoUploadError || brandingError;

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
        <h1 className="text-2xl font-bold tracking-tight text-app-ink dark:text-zinc-100 lg:text-title">Settings</h1>
        <p className="mt-1 text-sm text-app-text-muted dark:text-zinc-400">Manage business identity, defaults, appearance, and data export.</p>
      </div>

      <Card padding="lg" className="overflow-hidden">
        <CardHeader className="border-b pb-4">
          <CardTitle>Business identity</CardTitle>
          <CardDescription>Company name and logo shown in the header, login screen, and reports.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 pt-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.45fr)]">
          <div className="space-y-5">
            <label className="block space-y-1.5" htmlFor="company-display-name">
              <span className="text-2xs font-bold text-app-text-muted dark:text-zinc-500">Company name</span>
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

          <SurfaceCard className="p-4">
            <div className="flex items-center gap-4">
              {/* The logo stands on its own — no 80px rounded bordered tile. It
                  is the preview of what the sidebar and login screen print, not a
                  badge, and it now matches how those two render it. */}
              <img src={effectiveBusinessLogoUrl} alt="" className="h-14 w-14 shrink-0 object-contain" />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-xs font-bold text-app-ink dark:text-zinc-100">Business logo</p>
                <p className="text-xs leading-relaxed text-app-text-muted dark:text-zinc-400">
                  Stored in Supabase Storage, up to{' '}
                  <span className="font-mono text-2xs">{Math.round(maxBusinessLogoBytes / (1024 * 1024))} MB</span>. Falls back to{' '}
                  <span className="font-mono text-2xs">{BRAND_LOGO_URL}</span> when unset.
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
                {logoError && <InlineAlert variant="inline" message={logoError} />}
              </div>
            </div>
          </SurfaceCard>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <Card padding="lg" className="overflow-hidden">
          <CardHeader className="border-b pb-4">
          <CardTitle>Business Defaults</CardTitle>
          <CardDescription>System-wide values applied to POS transactions and reports.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 pt-5 md:grid-cols-2">
            <div className="space-y-5">
              <label className="block space-y-1.5" htmlFor="vat-rate">
                <span className="text-2xs font-bold text-app-text-muted dark:text-zinc-500">Default VAT Rate (%)</span>
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
                <span className="text-2xs font-bold text-app-text-muted dark:text-zinc-500">Currency Symbol</span>
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
              {defaultsError && <InlineAlert variant="inline" message={defaultsError} />}
            </div>

            <SurfaceCard className="space-y-4 p-4">
              <h3 className="label-caps text-app-text-muted dark:text-zinc-500">Current Defaults</h3>
              <div className="space-y-3 text-2xs">
                <div className="flex justify-between gap-3"><span className="font-bold text-app-text-muted">VAT Rate</span><span className="tabular-nums font-bold text-app-ink dark:text-zinc-200">{vatRate}%</span></div>
                <div className="flex justify-between gap-3"><span className="font-bold text-app-text-muted">Currency</span><span className="tabular-nums font-bold text-app-ink dark:text-zinc-200">{currencySymbol}</span></div>
              </div>
            </SurfaceCard>
          </CardContent>
        </Card>

        <Card variant="raised" padding="lg">
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Apply a persistent app color scheme.</CardDescription>
          </CardHeader>
          <SegmentedControl
            aria-label="Color scheme"
            fill
            value={theme}
            onChange={setTheme}
            options={([
              { value: 'light', label: 'light' },
              { value: 'dark', label: 'dark' },
              { value: 'system', label: 'system' },
            ])}
          />
        </Card>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Card padding="lg" className="overflow-hidden">
          <CardHeader className="border-b pb-4">
          <CardTitle>Data Export</CardTitle>
          <CardDescription>Download your business data as CSV for backup or analysis.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-5">
            {exportError && <InlineAlert variant="inline" message={exportError} />}
            <button
              type="button"
              onClick={handleExportOrders}
              className="flex w-full cursor-pointer items-center justify-between rounded-[var(--radius-card)] border p-3 text-left hover:border-[var(--app-border-control)] hover:bg-[var(--app-state-hover)] dark:hover:bg-[var(--app-tint-neutral)]"
            >
              <span className="text-xs font-semibold text-app-ink dark:text-zinc-200">Export Orders</span>
              <span className="text-2xs text-app-text-muted dark:text-zinc-500">CSV</span>
            </button>
            <button
              type="button"
              onClick={handleExportInventory}
              className="flex w-full cursor-pointer items-center justify-between rounded-[var(--radius-card)] border p-3 text-left hover:border-[var(--app-border-control)] hover:bg-[var(--app-state-hover)] dark:hover:bg-[var(--app-tint-neutral)]"
            >
              <span className="text-xs font-semibold text-app-ink dark:text-zinc-200">Export Inventory</span>
              <span className="text-2xs text-app-text-muted dark:text-zinc-500">CSV</span>
            </button>
            <button
              type="button"
              onClick={handleExportTransactions}
              className="flex w-full cursor-pointer items-center justify-between rounded-[var(--radius-card)] border p-3 text-left hover:border-[var(--app-border-control)] hover:bg-[var(--app-state-hover)] dark:hover:bg-[var(--app-tint-neutral)]"
            >
              <span className="text-xs font-semibold text-app-ink dark:text-zinc-200">Export Transactions</span>
              <span className="text-2xs text-app-text-muted dark:text-zinc-500">CSV</span>
            </button>
          </CardContent>
        </Card>

        <Card variant="raised" padding="lg">
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Control operational alerts across exports and stock.</CardDescription>
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
