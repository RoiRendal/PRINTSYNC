/**
 * Vitest global setup — runs once per test file, before the file's own code.
 *
 * Three jobs, all small on purpose:
 *
 *   1. Register the `jest-dom` matchers so DOM assertions read as intent
 *      (`expect(el).toBeDisabled()`) rather than as implementation detail.
 *      The `/vitest` entry point is the one that augments *Vitest's* `expect`;
 *      the plain `/jest-dom` entry targets Jest's global and would silently
 *      leave the matchers untyped here.
 *   2. Unmount whatever a test rendered. Testing Library only auto-cleans when
 *      the runner exposes globals, and this project imports `describe`/`it`
 *      explicitly from `vitest` instead — so without this, a component rendered
 *      by one test stays mounted and is found by the next one's queries.
 *   3. Give jsdom the `matchMedia` the animation library asks for.
 */

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});

/*
 * jsdom implements no `matchMedia` at all, and `motion/react` calls it while
 * resolving `prefers-reduced-motion`. Without a stub, merely importing a
 * component that animates throws before a test can assert anything about it.
 *
 * Reports "no preference" — what a browser with the setting untouched reports —
 * so components are exercised in their default presentation rather than an
 * accessibility variant. A test that wants the reduced-motion path can override
 * `matches` itself.
 */
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
