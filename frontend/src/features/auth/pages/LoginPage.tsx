import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Lock, Mail } from 'lucide-react';
import { motion } from 'motion/react';
import { useBusinessBranding } from '../../../app/providers/BusinessBrandingProvider';
import { Button, SurfaceCard, Input } from '../../../shared/components/ui';
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--app-surface)] px-4 py-10 text-macos-text dark:text-zinc-100">
      <motion.section
        className="relative w-full max-w-md"
        initial={{ opacity: 0, y: 22, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-[1.75rem] border bg-[var(--app-surface-raised)] shadow-[var(--shadow-card)] dark:bg-[#414143]">
            <img src={effectiveBusinessLogoUrl} alt="PRINTSYNC logo" className="max-h-12 max-w-14 object-contain" />
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-macos-text dark:text-zinc-100">Welcome back</h1>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-macos-text-muted dark:text-zinc-400">
            Sign in to manage print jobs, inventory, point-of-sale activity, and production analytics.
          </p>
        </div>

        <SurfaceCard className="p-5 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-[11px] font-bold uppercase tracking-[0.2em] text-macos-text-muted dark:text-zinc-500">
                Email address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-macos-text-muted dark:text-zinc-500" aria-hidden="true" />
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
              <label htmlFor="password" className="text-[11px] font-bold uppercase tracking-[0.2em] text-macos-text-muted dark:text-zinc-500">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-macos-text-muted dark:text-zinc-500" aria-hidden="true" />
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
              <div className="rounded-xl border bg-[var(--app-tint-red)] px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300">
                {authError}
              </div>
            )}

            <Button type="submit" size="lg" fullWidth isLoading={isSessionLoading} disabled={isSessionLoading}>
              Login
            </Button>
          </form>
        </SurfaceCard>
      </motion.section>
    </main>
  );
}
