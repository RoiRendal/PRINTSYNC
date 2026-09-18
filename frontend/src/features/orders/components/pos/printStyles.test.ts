import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * What the printed sheet is allowed to inherit.
 *
 * A receipt is the one screen that leaves the building, and it is printed from
 * whichever theme the cashier happens to be using. The app's global
 * `* { border-color: var(--app-hairline) }` is a light-mode grey that was never
 * meant for white paper — on the dark theme the same token is white at 10%
 * opacity, which is invisible on the white slip the receipt forces.
 *
 * These are assertions about the stylesheet rather than the DOM because the rule
 * only exists inside `@media print`, and jsdom does not apply media-specific
 * stylesheets: a rendering test would pass whether or not the rule is present,
 * which is exactly the kind of green check that hides this class of bug. The two
 * rules are checked together because either one alone still produces a receipt
 * with no dividers — the failure was the *combination*.
 */
const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, '../../../../index.css'), 'utf8');

/** The text of the single `@media print { ... }` block. */
function printBlock(): string {
  const start = css.indexOf('@media print');
  expect(start, 'index.css must contain an @media print block').toBeGreaterThan(-1);

  // Walk braces so a nested block would still be captured whole.
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(start, i + 1);
    }
  }
  throw new Error('unbalanced braces in @media print');
}

/**
 * The block with its comments stripped.
 *
 * The prose in this block deliberately names `--app-hairline` while explaining
 * why it is wrong for paper, so checking for the token against the raw text
 * would fail on the explanation rather than on the rule.
 */
function printDeclarations(): string {
  return printBlock().replace(/\/\*[\s\S]*?\*\//g, '');
}

describe('the printed receipt is self-contained', () => {
  it('pins the divider colour so it does not follow the cashier theme', () => {
    const declarations = printDeclarations();

    // The rule that makes the two dashed dividers visible. Without it the slip
    // inherits a near-invisible hairline and prints as an undivided block.
    expect(declarations).toMatch(
      /#receipt-content\s*,\s*#receipt-content \*\s*\{[^}]*border-color:\s*#000\s*!important/,
    );

    // And it must not silently defer to the theme token again.
    expect(declarations).not.toMatch(/border-color:\s*var\(--app-hairline\)/);
  });

  it('still prints only the document, never the surrounding application', () => {
    const declarations = printDeclarations();

    expect(declarations).toMatch(/body \*\s*\{[^}]*visibility:\s*hidden/);
    expect(declarations).toMatch(/#receipt-content\s*,\s*#receipt-content \*\s*\{[^}]*visibility:\s*visible/);
  });

  it('forces black-on-white so a dark-theme screen prints readable paper', () => {
    const declarations = printDeclarations();

    expect(declarations).toMatch(/#receipt-content \*\s*\{[^}]*color:\s*#000\s*!important/);
    expect(declarations).toMatch(/#receipt-content \*\s*\{[^}]*background:\s*transparent\s*!important/);
    expect(declarations).toMatch(/#receipt-content\s*\{[^}]*background:\s*#fff/);
  });

  it('leaves no other theme token able to reach the paper', () => {
    const declarations = printDeclarations();

    // `--app-hairline` was the value that broke; the point is that *no* theme
    // token belongs inside the printed slip, because a clerk printing a receipt
    // should not be able to change what the paper looks like by switching theme.
    expect(declarations).not.toMatch(/var\(--app-/);
    expect(declarations).not.toMatch(/var\(--glass-/);
  });
});

/**
 * The slip's own colour utilities must not depend on the theme either.
 *
 * `--app-hairline` was the token that actually broke, but the same class of bug
 * lurks in any utility that resolves through a token redefined under `.dark`.
 * `text-zinc-500` and `text-macos-purple` are fixed palette values that are not
 * redefined per theme, and the slip's own `dark:` variants are overridden by the
 * print block's `!important` rules. This pins that reasoning: if someone later
 * adds a `text-app-*`-style token to the slip, this fails on the way in rather
 * than on the way out of the printer.
 */
describe('the slip does not inherit a theme-dependent colour utility', () => {
  const view = readFileSync(resolve(here, 'PrintableDocumentView.tsx'), 'utf8');

  it('uses no app-theme text or border token', () => {
    // Global tokens, as opposed to Tailwind's fixed palette (`text-zinc-500`)
    // and the app's fixed brand colours (`text-macos-purple`, a literal hex).
    expect(view).not.toMatch(/text-app-/);
    expect(view).not.toMatch(/border-app-/);
    expect(view).not.toMatch(/bg-app-/);
  });

  it('keeps the load-bearing id the print block targets', () => {
    // If this id changes, `@media print` silently matches nothing and the whole
    // application goes to the printer again.
    expect(view).toMatch(/id="receipt-content"/);
  });
});
