import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ViewSelect, parseViewShape } from './ViewSelect';

/*
 * The view vocabulary, and the URL parser both surfaces share.
 *
 * The parser is worth its own tests because it is the single place a bad URL
 * value is turned into a safe one. Each surface used to do that inline, which is
 * how one of them ends up falling back differently from the other.
 */

describe('parseViewShape', () => {
  it('accepts both real views', () => {
    expect(parseViewShape('list', 'image')).toBe('list');
    expect(parseViewShape('image', 'list')).toBe('image');
  });

  it('falls back when the param is absent', () => {
    expect(parseViewShape(null, 'list')).toBe('list');
    expect(parseViewShape(undefined, 'image')).toBe('image');
    expect(parseViewShape('', 'list')).toBe('list');
  });

  it('falls back on a value that was never a view', () => {
    // A stale bookmark must still land on a usable screen.
    expect(parseViewShape('gallery', 'list')).toBe('list');
    expect(parseViewShape('TABLE', 'image')).toBe('image');
    expect(parseViewShape('1', 'list')).toBe('list');
  });

  it('keeps each surface own default', () => {
    expect(parseViewShape('nonsense', 'list')).toBe('list');
    expect(parseViewShape('nonsense', 'image')).toBe('image');
  });
});

describe('ViewSelect', () => {
  it('offers exactly the two views, in reading order', () => {
    render(<ViewSelect value="list" onChange={vi.fn()} ariaLabel="Stock view" />);
    fireEvent.click(screen.getByRole('button', { name: 'Stock view' }));
    expect(screen.getAllByRole('menuitemradio').map((o) => o.textContent)).toEqual(['List View', 'Image View']);
  });

  it('reports the choice with the shared vocabulary', () => {
    const onChange = vi.fn();
    render(<ViewSelect value="list" onChange={onChange} ariaLabel="Stock view" />);
    fireEvent.click(screen.getByRole('button', { name: 'Stock view' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Image View' }));
    expect(onChange).toHaveBeenCalledWith('image');
  });

  it('names the control for the surface it belongs to', () => {
    render(<ViewSelect value="image" onChange={vi.fn()} ariaLabel="Design view" />);
    expect(screen.getByRole('button', { name: 'Design view' })).toHaveTextContent('Image View');
  });
});
