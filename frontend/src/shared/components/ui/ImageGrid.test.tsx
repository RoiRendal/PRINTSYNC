import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ImageGrid, ImageGridCard } from './ImageGrid';

/*
 * The image-grid contract, pinned once for both grids that use it.
 *
 * jsdom applies no stylesheet, so nothing here measures pixels — these are
 * assertions about the classes and slots the primitive emits, which is the half
 * that drifts without anyone noticing. Two of them carry more weight than the
 * rest:
 *
 * - `group` on the card, and `group-hover:opacity-100` on the overlay. Pairing
 *   them is the whole hover mechanism: drop either one and the design repo's
 *   View / Download buttons become permanently invisible, with no error, no
 *   failing build, and a card that still looks correct in review.
 * - the responsive track living on `ImageGrid` alone. The design repo's grid and
 *   its loading skeleton used to carry their own copy of the same breakpoints,
 *   so a column-count change had to be made twice or it silently applied once.
 */

/** Every breakpoint of the shared track, in source order. */
const TRACK = ['grid-cols-1', 'sm:grid-cols-2', 'md:grid-cols-3', 'xl:grid-cols-5', '2xl:grid-cols-6'];

describe('ImageGrid', () => {
  it('carries the shared responsive track', () => {
    const { container } = render(<ImageGrid />);
    const className = container.firstElementChild?.className ?? '';
    for (const step of TRACK) expect(className).toContain(step);
  });

  it('passes role and aria through to the track', () => {
    const { container } = render(<ImageGrid role="status" aria-busy="true" aria-label="Loading designs" />);
    const track = container.firstElementChild;
    expect(track?.getAttribute('role')).toBe('status');
    expect(track?.getAttribute('aria-busy')).toBe('true');
    expect(track?.getAttribute('aria-label')).toBe('Loading designs');
  });
});

describe('ImageGridCard', () => {
  it('renders the photo under the caller-supplied alt text', () => {
    const { getByAltText } = render(<ImageGridCard imageUrl="https://example.test/a.png" imageAlt="Zipper" />);
    const image = getByAltText('Zipper');
    expect(image.tagName).toBe('IMG');
    expect(image.getAttribute('src')).toBe('https://example.test/a.png');
  });

  const noPhoto: [string, string | null | undefined][] = [
    ['an empty string', ''],
    ['whitespace', '   '],
    ['undefined', undefined],
    ['null', null],
  ];
  for (const [label, imageUrl] of noPhoto) {
    it(`treats ${label} as no photo, and shows the fallback`, () => {
      const { container } = render(<ImageGridCard imageUrl={imageUrl} imageAlt="Zipper" fallbackLabel="ZI" />);
      expect(container.querySelector('img')).toBeNull();
      expect(container.textContent).toContain('ZI');
    });
  }

  it('keeps `group` on the card, because the hover overlay reads it', () => {
    const { container } = render(<ImageGridCard imageUrl="https://example.test/a.png" imageAlt="Zipper" />);
    expect(container.firstElementChild?.className).toContain('group');
  });

  it('draws no overlay or leading slot unless the caller passes one', () => {
    const { container } = render(<ImageGridCard imageUrl="https://example.test/a.png" imageAlt="Zipper" />);
    expect(container.querySelector('.absolute')).toBeNull();
  });

  it('renders both slots, with the overlay hidden until hover', () => {
    const { container, getByRole } = render(
      <ImageGridCard
        imageUrl="https://example.test/a.png"
        imageAlt="Zipper"
        leading={<span>Logo</span>}
        overlay={<button type="button">View</button>}
      />,
    );
    expect(container.textContent).toContain('Logo');
    expect(getByRole('button', { name: 'View' })).toBeTruthy();

    const wrapper = getByRole('button', { name: 'View' }).parentElement;
    const className = wrapper?.className ?? '';
    expect(className).toContain('opacity-0');
    expect(className).toContain('group-hover:opacity-100');
  });

  it('renders the caller body', () => {
    const { getByText } = render(
      <ImageGridCard imageUrl="https://example.test/a.png" imageAlt="Zipper">
        <p>Body</p>
      </ImageGridCard>,
    );
    expect(getByText('Body')).toBeTruthy();
  });
});
