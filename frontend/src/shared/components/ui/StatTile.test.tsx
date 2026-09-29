import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StatTile, StatTileRow } from './StatTile';

/*
 * The stat-tile contract, pinned once for the whole app.
 *
 * Seven implementations existed before this component, and they disagreed on
 * padding, on the label treatment, on the figure size and on whether the figure
 * was allowed to be green. jsdom applies no stylesheet, so these assertions are
 * about the *contract* — which classes are emitted — not about pixels. That is
 * the half that can drift silently: a tile that picks up a `text-green-700` or
 * a `text-3xl` still renders, still type-checks, and still looks plausible in
 * review, and it is the drift this file exists to catch.
 *
 * Measured proof of the rendered result — 11px uppercase label, 20px ink figure,
 * hairline box — belongs in a real browser, which is why P2 onwards carries a
 * Chromium step. This file stops the contract moving between those checks.
 */

/** The tile's box, and the two `<p>` elements inside it. */
function parts(container: HTMLElement) {
  const box = container.firstElementChild;
  const paragraphs = container.querySelectorAll('p');
  if (!box) throw new Error('the tile rendered no box');
  if (paragraphs.length < 2) throw new Error('the tile rendered fewer than two paragraphs');
  return { box, label: paragraphs[0]!, figure: paragraphs[1]! };
}

describe('StatTile', () => {
  it('labels every tile with the one caps treatment', () => {
    const { container } = render(<StatTile label="Pending orders" value={12} />);

    expect(parts(container).label.className).toContain('label-caps');
    expect(parts(container).label.className).toContain('text-app-text-muted');

    // `text-app-text-muted` is theme-aware on its own — `--color-app-text-muted`
    // is redefined under `.dark` — so a `dark:` partner here overrides the token
    // it is supposed to be reading. All six hand-rolled tiles carried
    // `dark:text-zinc-500`, which measures 3.52:1 on the dark page: under the
    // 4.5:1 floor. Alone the token is 6.82:1 light / 6.64:1 dark.
    expect(parts(container).label.className).not.toMatch(/\bdark:text-/);
  });

  it('gives the figure the dark partner the ink token needs', () => {
    const { container } = render(<StatTile label="Total stock" value={1284} />);

    // The other half of the same rule: `--color-app-ink` is NOT redefined under
    // `.dark`, so unlike muted it does need a partner or it stays near-black on
    // a near-black page.
    expect(parts(container).figure.className).toMatch(/\bdark:text-/);
  });

  it('draws the figure at one size, in ink, and never in a hue', () => {
    const { container } = render(<StatTile label="Total stock" value={1284} />);
    const figure = parts(container).figure.className;

    expect(figure).toContain('text-xl');
    expect(figure).toContain('tabular-nums');
    expect(figure).toContain('text-app-ink');

    // The decision was that a figure is never coloured. A hue word here is the
    // drift this test is for — the figure reads as emphasis either way, so it
    // never fails a review that only asks "does the number show up".
    expect(figure).not.toMatch(/\btext-(green|red|orange|purple|amber)-/);
    expect(figure).not.toContain('text-app-accent');
    expect(figure).not.toContain('text-app-danger');
  });

  it('is a hairline panel with no fill and no icon', () => {
    const { container } = render(<StatTile label="Low stock items" value={3} />);
    const box = parts(container).box;

    expect(box.className).toContain('surface-panel');
    expect(box.className).toContain('p-4');
    // `.surface-panel` is an outline by design; a fill here would put back the
    // shade ladder the flat-UI rounds deleted.
    expect(box.className).not.toMatch(/\bbg-/);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('makes the whole tile the link when a route is given', () => {
    const { container } = render(
      <MemoryRouter>
        <StatTile label="Pending orders" value={12} to="/orders?status=Pending" />
      </MemoryRouter>,
    );
    const link = container.querySelector('a');

    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('/orders?status=Pending');
    // The count and the label are both inside the link: the tile is the way to
    // the list behind it, not a box with a link sitting in it.
    expect(link?.textContent).toContain('Pending orders');
    expect(link?.textContent).toContain('12');
  });

  it('renders no link when there is nowhere to go', () => {
    const { container } = render(<StatTile label="Total stock" value={1284} />);

    expect(container.querySelector('a')).toBeNull();
  });
});

describe('StatTileRow', () => {
  it('emits a literal grid-cols class for every column count', () => {
    const counts = [2, 3, 4, 5] as const;

    for (const columns of counts) {
      const { container } = render(
        <StatTileRow columns={columns}>
          <StatTile label="Total stock" value={1284} />
        </StatTileRow>,
      );
      const row = container.firstElementChild?.className ?? '';

      // Tailwind reads source text, so a class built by interpolation is never
      // emitted and the row collapses to one stacked column. Asserting a real
      // numeric grid class — and the absence of a template — is what catches it.
      expect(row).toMatch(/\bgrid-cols-\d/);
      expect(row).not.toContain('undefined');
      expect(row).not.toContain('${');
    }
  });

  it('lays every row out on the same grid gap', () => {
    const counts = [2, 3, 4, 5] as const;

    for (const columns of counts) {
      const { container } = render(
        <StatTileRow columns={columns}>
          <StatTile label="Total stock" value={1284} />
        </StatTileRow>,
      );

      expect(container.firstElementChild?.className).toContain('gap-3');
    }
  });
});
