import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Lock, Mail } from '../../../shared/components/ui/icons';
import { useBusinessBranding } from '../../../app/providers/BusinessBrandingProvider';
import { Button, SurfaceCard, Input } from '../../../shared/components/ui';
import { InlineAlert } from '../../../shared/components/feedback/InlineAlert';
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

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--app-surface)] px-4 py-10 text-app-ink dark:text-zinc-100">
      <section className="relative w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          {/*
            The logo stands on its own. It used to sit in an 80px rounded bordered
            tile, which was the same box the icon frames were; a logo is not a
            badge and does not need one. Same bare treatment the sidebar brand
            block already uses.
          */}
          <img src={effectiveBusinessLogoUrl} alt="PRINTSYNC logo" className="mb-4 h-14 w-14 object-contain" />

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-app-ink dark:text-zinc-100">Welcome back</h1>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-app-text-muted dark:text-zinc-400">
            Sign in to manage print jobs, inventory, point-of-sale activity, and production analytics.
          </p>
        </div>

        <SurfaceCard className="p-4 sm:p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-xs font-bold text-app-text-muted dark:text-zinc-500">
                Email address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-text-muted dark:text-zinc-500" aria-hidden="true" />
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
              <label htmlFor="password" className="text-xs font-bold text-app-text-muted dark:text-zinc-500">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-text-muted dark:text-zinc-500" aria-hidden="true" />
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

            {authError && <InlineAlert message={authError} />}

            <Button type="submit" variant="primary" size="lg" fullWidth isLoading={isSessionLoading} disabled={isSessionLoading}>
              Login
            </Button>
          </form>
        </SurfaceCard>
      </section>
    </main>
  );
}
