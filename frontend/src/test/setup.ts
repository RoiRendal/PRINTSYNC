/**
 * Vitest global setup — runs once per test file, before the file's own code.
 *
 * Two jobs, both small on purpose:
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
 */

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
