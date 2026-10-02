import { describe, it, expect } from 'vitest';
import { TOOLBAR_ROW_CLASS, TOOLBAR_SEARCH_WIDTH_CLASS } from './toolbar';

/*
 * The toolbar constants exist to stop the search box's width drifting between
 * list tables — the drift arose because each surface wrote its own clamp
 * (`md:max-w-md`, `md:max-w-xl`, `sm:max-w-xs`, …) and nobody owned the number.
 *
 * These are thin string assertions, and that is the point: the contract is that
 * every call site shares ONE literal, so a future edit that "just tweaks this
 * table's width" has to change it here, where the reasoning lives, rather than
 * inline at a call site where it will not be noticed.
 */
describe('toolbar constants', () => {
  it('gives the search box a full width on mobile and a fixed width from sm up', () => {
    expect(TOOLBAR_SEARCH_WIDTH_CLASS).toBe('w-full sm:w-80');
  });

  it('lays the toolbar out as a column that becomes a row at sm', () => {
    expect(TOOLBAR_ROW_CLASS).toContain('flex-col');
    expect(TOOLBAR_ROW_CLASS).toContain('sm:flex-row');
    expect(TOOLBAR_ROW_CLASS).toContain('sm:items-center');
  });

  it('carries no per-page max-width, which is what caused the drift', () => {
    expect(TOOLBAR_ROW_CLASS).not.toMatch(/max-w-/);
    expect(TOOLBAR_SEARCH_WIDTH_CLASS).not.toMatch(/max-w-/);
  });
});
