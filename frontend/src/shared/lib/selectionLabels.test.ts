import { describe, expect, it } from 'vitest';
import { formatSelectedCount } from './selectionLabels';

/**
 * The label is the user-visible contract for the "X items selected" header.
 * Centralising it in one function is only worthwhile if every list table ends
 * up reading the same string — these tests pin that.
 */
describe('formatSelectedCount', () => {
  it('returns null when nothing is selected, so the caller can fall back to the column label', () => {
    expect(formatSelectedCount(0)).toBeNull();
  });

  it('uses the singular form for exactly one row', () => {
    expect(formatSelectedCount(1)).toBe('1 item selected');
  });

  it('uses the plural form for two rows', () => {
    expect(formatSelectedCount(2)).toBe('2 items selected');
  });

  it('keeps the same string for any larger count, so a regression to a headcount-only label is caught', () => {
    expect(formatSelectedCount(10)).toBe('10 items selected');
    expect(formatSelectedCount(73)).toBe('73 items selected');
  });

  it('never returns a count-only label (e.g. "3 items") — the word "selected" must always follow', () => {
    for (const count of [1, 2, 5, 17]) {
      const label = formatSelectedCount(count);
      expect(label).not.toBeNull();
      expect(label!.endsWith(' selected')).toBe(true);
    }
  });
});