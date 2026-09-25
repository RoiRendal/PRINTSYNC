import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeleteConfirmModal } from './DeleteConfirmModal';

/*
 * The delete confirmation contract, pinned once for the whole app.
 *
 * Every surface that deletes something renders this component, so these tests
 * are what stops the pages drifting apart again: previously each one grew its
 * own dialog and they disagreed on the wording, the confirm label and whether a
 * warning icon was involved.
 *
 * The failure mode being guarded against is decoration creeping back in. A red
 * panel or a warning triangle looks like a considered design decision and would
 * pass any review that only checks "does it delete the row".
 */

const noop = () => undefined;

/** The block holding the message, excluding the modal's own close button. */
function messageBlock(): HTMLElement {
  const intro = screen.getByText('Are you sure you want to delete:');
  const block = intro.parentElement;
  if (!block) throw new Error('the intro paragraph has no parent to inspect');
  return block;
}

describe('DeleteConfirmModal', () => {
  it('asks the question using the agreed wording', () => {
    render(<DeleteConfirmModal isOpen itemLabels={['Black T-Shirt']} onClose={noop} onConfirm={noop} />);

    expect(screen.getByText('Are you sure you want to delete:')).toBeTruthy();
    expect(screen.getByText('This action cannot be undone.')).toBeTruthy();
  });

  it('names every object it is about to delete, not just a count', () => {
    render(
      <DeleteConfirmModal
        isOpen
        itemLabels={['Black T-Shirt', 'White T-Shirt', 'Cap']}
        onClose={noop}
        onConfirm={noop}
      />,
    );

    for (const label of ['Black T-Shirt', 'White T-Shirt', 'Cap']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    // The count is not a substitute for the names.
    expect(screen.queryByText(/3 (items|stock items|objects)/)).toBeNull();
  });

  it('lists a single object the same way it lists many', () => {
    render(<DeleteConfirmModal isOpen itemLabels={['Cap']} onClose={noop} onConfirm={noop} />);

    expect(screen.getByText('Cap')).toBeTruthy();
    expect(screen.queryByText(/^1 /)).toBeNull();
  });

  it('labels the destructive button Confirm, not Confirm Delete', () => {
    render(<DeleteConfirmModal isOpen itemLabels={['Cap']} onClose={noop} onConfirm={noop} />);

    expect(screen.getByRole('button', { name: 'Confirm' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /confirm delete/i })).toBeNull();
  });

  it('carries no warning icon', () => {
    render(<DeleteConfirmModal isOpen itemLabels={['Cap']} onClose={noop} onConfirm={noop} />);

    expect(messageBlock().querySelectorAll('svg')).toHaveLength(0);
  });

  it('renders the message in the normal text colour, not red', () => {
    render(<DeleteConfirmModal isOpen itemLabels={['Cap']} onClose={noop} onConfirm={noop} />);

    const intro = screen.getByText('Are you sure you want to delete:');
    expect(intro.className).toContain('text-macos-text');
    expect(intro.className).not.toMatch(/text-red|app-tint-red/);

    const block = messageBlock();
    const painted = [...block.querySelectorAll('*')].filter((element) =>
      /text-red|app-tint-red/.test(element.getAttribute('class') ?? ''),
    );
    expect(painted).toHaveLength(0);
  });

  it('calls onConfirm when Confirm is clicked', () => {
    const onConfirm = vi.fn();
    render(<DeleteConfirmModal isOpen itemLabels={['Cap']} onClose={noop} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<DeleteConfirmModal isOpen itemLabels={['Cap']} onClose={onClose} onConfirm={noop} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('blocks a second confirm while the delete is already running', () => {
    render(<DeleteConfirmModal isOpen itemLabels={['Cap']} onClose={noop} onConfirm={noop} isBusy />);

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
  });

  it('renders caller-specific context under the message', () => {
    render(
      <DeleteConfirmModal isOpen itemLabels={['Cap']} onClose={noop} onConfirm={noop}>
        <p>This customer has 3 orders on record.</p>
      </DeleteConfirmModal>,
    );

    expect(screen.getByText('This customer has 3 orders on record.')).toBeTruthy();
  });

  it('renders nothing while closed', () => {
    render(<DeleteConfirmModal isOpen={false} itemLabels={['Cap']} onClose={noop} onConfirm={noop} />);

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
