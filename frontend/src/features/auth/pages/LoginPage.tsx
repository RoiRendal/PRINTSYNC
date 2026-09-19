import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Lock, Mail } from 'lucide-react';
import { useBusinessBranding } from '../../../app/providers/BusinessBrandingProvider';
import { Button, GlassCard, Input } from '../../../shared/components/ui';
import { useAuth } from '../../../app/stores/useAuthStore';

export default function LoginPage() {
  const { login, currentUser, isSessionLoading, authError } = useAuth();
  const { effectiveBusinessLogoUrl } = useBusinessBranding();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (currentUser) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ok = await login(email, password);
    if (!ok) {
      return;
    }
  };

  /*
   * This screen used to carry the strongest of the three coloured washes, plus a
   * soft white bloom laid across the top — two competing light sources on a
   * screen whose entire content is one card. Both are gone.
   *
   * The page background now comes from the body in `index.css`, so this element
   * stays transparent; the logo chip and the card are what carry the depth.
   */
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 text-macos-text dark:text-zinc-100">
      <section className="relative w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="ambient amb-elevation-2 mb-4 flex h-20 w-20 items-center justify-center rounded-[1.75rem] border border-[var(--app-hairline)] bg-[var(--app-surface-raised)]">
            <img src={effectiveBusinessLogoUrl} alt="PRINTSYNC logo" className="max-h-12 max-w-14 object-contain" />
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-macos-text dark:text-zinc-100">Welcome back</h1>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-macos-text-muted">
            Sign in to manage print jobs, inventory, point-of-sale activity, and production analytics.
          </p>
        </div>

        <GlassCard className="p-5 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-[11px] font-bold uppercase tracking-[0.2em] text-macos-text-muted">
                Email address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-macos-text-muted" aria-hidden="true" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-11 pl-10"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-[11px] font-bold uppercase tracking-[0.2em] text-macos-text-muted">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-macos-text-muted" aria-hidden="true" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-11 pl-10"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            {authError && (
              <div className="rounded-xl border border-macos-red/20 bg-macos-red/10 px-3 py-2 text-xs font-medium text-red-700 dark:border-macos-red/25 dark:bg-macos-red/15 dark:text-red-300">
                {authError}
              </div>
            )}

            <Button type="submit" size="lg" fullWidth isLoading={isSessionLoading} disabled={isSessionLoading}>
              Login
            </Button>
          </form>
        </GlassCard>
      </section>
    </main>
  );
}
