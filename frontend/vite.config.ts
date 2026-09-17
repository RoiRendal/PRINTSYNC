import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
// `vitest/config` re-exports Vite's `defineConfig` with the `test` block typed.
// It is a drop-in for the plain `vite` import, so the build is unaffected — and
// keeping one config file means the test runner cannot drift from the app's
// module aliases.
import {defineConfig} from 'vitest/config';

export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify — file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': 'http://127.0.0.1:4000',
      },
    },
    test: {
      // jsdom, not node: the realtime client and the revalidation hook both
      // touch `window`, `document` and `EventSource`, and those are exactly the
      // modules whose timing logic regresses silently.
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['./src/test/setup.ts'],
      // Every test starts from a clean slate; a spy left installed by an
      // earlier test is a classic source of order-dependent flakes.
      restoreMocks: true,
      // `@printsync/shared-types` is deliberately NOT aliased here. The frontend
      // consumes it as a type-only dependency, and the missing alias is what
      // makes an accidental *value* import fail the build instead of silently
      // bundling the package. Keep it that way.
    },
});
