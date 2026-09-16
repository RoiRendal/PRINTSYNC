import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { POSCheckoutModal } from './POSCheckoutModal';
import { makeCartItem, makeCheckoutError, makeInsufficientStock, makeTotals } from '../../../../test/fixtures';

/*
 * The first component test in this project. Everything before it exercised pure
 * logic — the stores, the error readers, the realtime client — which left the
 * checkout JSX itself uncovered, and the checkout JSX is where the wording that
 * stops a cashier double-charging actually lives.
 *
 * `POSCheckoutModal` is the right first target precisely because it is
 * props-driven: no stores, no router, no providers. `POSPage` wraps it in all
 * three, so it would have to be tested through a pile of scaffolding that has
 * nothing to do with the assertions.
 *
 * `Modal` portals into `document.body`, which Testing Library's `screen` queries
 * like any other node, so no special handling is needed for that.
 */

type ModalProps = ComponentProps<typeof POSCheckoutModal>;

function renderModal(overrides: Partial<ModalProps> = {}) {
  const props: ModalProps = {
    isOpen: true,
    checkoutSuccess: false,
    isSubmitting: false,
    checkoutError: null,
    posMode: 'retail',
    cart: [makeCartItem()],
    totals: makeTotals(),
    paymentMethod: 'Cash',
    currencySymbol: 'PHP ',
    onPaymentMethodChange: vi.fn(),
    onConfirm: vi.fn(),
    onClose: vi.fn(),
    onPrintReceipt: vi.fn(),
    ...overrides,
  };

  return { ...render(<POSCheckoutModal {...props} />), props };
}

describe('an unconfirmed checkout is never presented as a failure', () => {
  it('tells the cashier nothing was charged when the sale did not commit', () => {
    renderModal({
      checkoutError: makeCheckoutError({
        message: 'The connection dropped before the sale was confirmed.',
        reconciliation: { kind: 'not-committed' },
      }),
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Nothing was charged — safe to try again');
  });

  it('tells the cashier retrying is safe when the outcome could not be established', () => {
    renderModal({
      checkoutError: makeCheckoutError({
        message: 'The server could not confirm the sale.',
        reconciliation: { kind: 'unknown' },
      }),
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Could not confirm — retrying is safe');
  });

  /*
   * There is deliberately no test here for a `committed` outcome arriving as an
   * error, and that is a property of the *types* rather than an omission.
   * `CheckoutError.reconciliation` is narrowed to `CheckoutFailureOutcome`, which
   * excludes `committed` — a committed attempt is a completed sale and the page
   * shows a receipt instead. Without that narrowing this component would happily
   * render a paid sale as "The transaction could not be completed." in red, which
   * is the one message guaranteed to make a cashier charge a customer twice.
   * A test can no longer construct the bad input because the type forbids it.
   */

  it('words the two uncertain outcomes differently', () => {
    // Identical shape to the code, opposite instructions to a cashier: one means
    // "ring it up again", the other means "the till is still owed a sale". They
    // must never collapse into one generic sentence.
    const first = renderModal({
      checkoutError: makeCheckoutError({ reconciliation: { kind: 'not-committed' } }),
    });
    const notCommitted = screen.getByRole('alert').textContent ?? '';
    first.unmount();

    const second = renderModal({
      checkoutError: makeCheckoutError({ reconciliation: { kind: 'unknown' } }),
    });
    const unknown = screen.getByRole('alert').textContent ?? '';
    second.unmount();

    expect(notCommitted).not.toBe('');
    expect(unknown).not.toBe('');
    expect(notCommitted).not.toBe(unknown);
  });

  it('shows the plain message for an ordinary failure with no reconciliation', () => {
    renderModal({
      checkoutError: makeCheckoutError({ message: 'Only staff can process a sale.' }),
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Only staff can process a sale.');
  });
});

describe('a short cart line is named with the real numbers', () => {
  it('points at the item and reports what is actually left', () => {
    renderModal({
      cart: [makeCartItem({ id: 'item-1', name: 'Glossy Paper A4', qty: 5 })],
      checkoutError: makeCheckoutError({
        message: 'Not enough stock to complete this sale.',
        stock: makeInsufficientStock({ itemId: 'item-1', available: 3, requested: 5 }),
      }),
    });

    // The structured details are what make this possible — a sentence alone could
    // not say which line was short or by how much.
    expect(screen.getByText('Only 3 left — 5 requested')).toBeInTheDocument();
  });

  it('does not flag a cart line the shortfall does not apply to', () => {
    renderModal({
      cart: [makeCartItem({ id: 'item-1', name: 'Glossy Paper A4' })],
      checkoutError: makeCheckoutError({
        stock: makeInsufficientStock({ itemId: 'item-other', available: 3, requested: 5 }),
      }),
    });

    expect(screen.queryByText(/left —/)).not.toBeInTheDocument();
  });
});

describe('the sale cannot be submitted twice', () => {
  it('disables both actions and says it is processing while a sale is in flight', () => {
    renderModal({ isSubmitting: true });

    expect(screen.getByRole('button', { name: /processing/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });

  it('offers an enabled confirm button when idle', () => {
    renderModal();

    expect(screen.getByRole('button', { name: /confirm/i })).toBeEnabled();
  });

  it('confirms the sale when the cashier clicks through', async () => {
    const user = userEvent.setup();
    const { props } = renderModal();

    await user.click(screen.getByRole('button', { name: /confirm/i }));

    expect(props.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('closes without confirming when the cashier cancels', async () => {
    const user = userEvent.setup();
    const { props } = renderModal();

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });
});

describe('a recovered sale is called out, an ordinary one is not', () => {
  it('says the sale had already been saved when reconciliation rescued it', () => {
    renderModal({ checkoutSuccess: true, recovered: true });

    // The cashier believes this sale failed. Leaving them to find out otherwise
    // is how a paid sale gets rung up a second time.
    expect(screen.getByText(/already been saved/i)).toBeInTheDocument();
  });

  it('does not claim a rescue after an ordinary successful sale', () => {
    renderModal({ checkoutSuccess: true, recovered: false });

    expect(screen.getByText('Transaction Successful')).toBeInTheDocument();
    expect(screen.queryByText(/already been saved/i)).not.toBeInTheDocument();
  });
});

describe('custom orders are not sales', () => {
  it('offers to create an order and asks for no payment method', () => {
    renderModal({ posMode: 'custom' });

    expect(screen.getByRole('button', { name: /create order/i })).toBeInTheDocument();
    // A custom job is entered into production, not paid for at the till, so
    // offering Cash/Card here would invite a payment that never happened.
    expect(screen.queryByText(/payment method/i)).not.toBeInTheDocument();
  });

  it('asks for a payment method on a retail sale', () => {
    renderModal({ posMode: 'retail' });

    expect(screen.getByText(/payment method/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cash/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /card/i })).toBeInTheDocument();
  });
});
