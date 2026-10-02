import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DropdownMenu } from './DropdownMenu';

/*
 * The dropdown primitive's contract.
 *
 * This is new shared infrastructure with real keyboard and focus behaviour, and
 * jsdom can exercise all of it — unlike the positioning, which is a browser
 * measurement and is verified in Chromium instead. What is pinned here is the
 * part that silently rots: the roles, the checked state, Escape, click-outside,
 * and focus landing back on the trigger rather than being dropped to the top of
 * the document.
 */

const OPTIONS = [
  { value: 'list' as const, label: 'List View' },
  { value: 'image' as const, label: 'Image View' },
];

function setup(props: Partial<React.ComponentProps<typeof DropdownMenu<'list' | 'image'>>> = {}) {
  const onChange = vi.fn();
  const result = render(
    <DropdownMenu value="list" options={OPTIONS} onChange={onChange} ariaLabel="Stock view" {...props} />,
  );
  return { ...result, onChange, trigger: () => screen.getByRole('button', { name: 'Stock view' }) };
}

describe('DropdownMenu — the trigger', () => {
  it('shows the current choice as its visible text', () => {
    const { trigger } = setup();
    expect(trigger()).toHaveTextContent('List View');
  });

  it('is named for what is being chosen, not what is chosen', () => {
    // The visible text says "List View"; the accessible name must say what the
    // control does, or a screen reader hears only the current value.
    const { trigger } = setup();
    expect(trigger()).toHaveAttribute('aria-label', 'Stock view');
    expect(trigger()).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('reports whether the menu is open', () => {
    const { trigger } = setup();
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger());
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
  });

  it('opens on ArrowDown, which is what a native select does', () => {
    const { trigger } = setup();
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' });
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });
});

describe('DropdownMenu — the panel', () => {
  it('renders nothing until it is opened', () => {
    setup();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('lists every option, marking the current one checked', () => {
    const { trigger } = setup();
    fireEvent.click(trigger());
    const options = screen.getAllByRole('menuitemradio');
    expect(options.map((option) => option.textContent)).toEqual(['List View', 'Image View']);
    expect(options[0]).toHaveAttribute('aria-checked', 'true');
    expect(options[1]).toHaveAttribute('aria-checked', 'false');
  });

  it('hands the chosen value back and closes', () => {
    const { trigger, onChange } = setup();
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Image View' }));
    expect(onChange).toHaveBeenCalledWith('image');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes on Escape', () => {
    const { trigger } = setup();
    fireEvent.click(trigger());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes when the pointer goes down outside it', () => {
    const { trigger } = setup();
    fireEvent.click(trigger());
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('stays open when the pointer goes down inside it', () => {
    const { trigger } = setup();
    fireEvent.click(trigger());
    fireEvent.mouseDown(screen.getByRole('menu'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });
});

describe('DropdownMenu — keyboard and focus', () => {
  it('focuses the current option when it opens', () => {
    const { trigger } = setup({ value: 'image' });
    fireEvent.click(trigger());
    expect(document.activeElement).toBe(screen.getByRole('menuitemradio', { name: 'Image View' }));
  });

  it('moves with the arrow keys and wraps at both ends', () => {
    const { trigger } = setup();
    fireEvent.click(trigger());
    const options = screen.getAllByRole('menuitemradio');

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(options[1]);
    // Wraps forward past the last item.
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(options[0]);
    // Wraps backward past the first.
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(options[1]);
  });

  it('jumps to the ends with Home and End', () => {
    const { trigger } = setup();
    fireEvent.click(trigger());
    const options = screen.getAllByRole('menuitemradio');
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'End' });
    expect(document.activeElement).toBe(options[1]);
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Home' });
    expect(document.activeElement).toBe(options[0]);
  });

  it('returns focus to the trigger when it closes on Escape', () => {
    // Without this, focus is dropped to the top of the document when the panel
    // unmounts, and the next Tab starts from the sidebar.
    const { trigger } = setup();
    fireEvent.click(trigger());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement).toBe(trigger());
  });

  it('returns focus to the trigger after a choice', () => {
    const { trigger } = setup();
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Image View' }));
    expect(document.activeElement).toBe(trigger());
  });
});
