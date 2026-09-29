import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { POSCheckout } from './POSCheckout';
import { makeCartItem, makeCheckoutError, makeInsufficientStock, makeTotals } from '../../../../test/fixtures';

/*
 * The first component test in this project. Everything before it exercised pure
 * logic — the stores, the error readers, the realtime client — which left the
 * checkout JSX itself uncovered, and the checkout JSX is where the wording that
 * stops a cashier double-charging actually lives.
 *
 * `POSCheckout` is the right first target precisely because it is
 * props-driven: no stores, no router, no providers. `POSPage` wraps it in all
 * three, so it would have to be tested through a pile of scaffolding that has
 * nothing to do with the assertions.
 *
 * It became a panel rather than a dialog (R4), and the assertions below are the
 * ones that had to survive that move: the reconciliation wording, the per-line
 * shortfall, the in-flight lock, and the confirm/cancel pair. A conversion that
 * kept the pixels and lost the wording would be the expensive kind of refactor.
 */

type CheckoutProps = ComponentProps<typeof POSCheckout>;

function renderCheckout(overrides: Partial<CheckoutProps> = {}) {
  const props: CheckoutProps = {
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
    onBack: vi.fn(),
    onPrintReceipt: vi.fn(),
    ...overrides,
  };

  return { ...render(<POSCheckout {...props} />), props };
}

describe('an unconfirmed checkout is never presented as a failure', () => {
  it('tells the cashier nothing was charged when the sale did not commit', () => {
    renderCheckout({
      checkoutError: makeCheckoutError({
        message: 'The connection dropped before the sale was confirmed.',
        reconciliation: { kind: 'not-committed' },
      }),
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Nothing was charged — safe to try again');
  });

  it('tells the cashier retrying is safe when the outcome could not be established', () => {
    renderCheckout({
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
    const first = renderCheckout({
      checkoutError: makeCheckoutError({ reconciliation: { kind: 'not-committed' } }),
    });
    const notCommitted = screen.getByRole('alert').textContent ?? '';
    first.unmount();

    const second = renderCheckout({
      checkoutError: makeCheckoutError({ reconciliation: { kind: 'unknown' } }),
    });
    const unknown = screen.getByRole('alert').textContent ?? '';
    second.unmount();

    expect(notCommitted).not.toBe('');
    expect(unknown).not.toBe('');
    expect(notCommitted).not.toBe(unknown);
  });

  it('shows the plain message for an ordinary failure with no reconciliation', () => {
    renderCheckout({
      checkoutError: makeCheckoutError({ message: 'Only staff can process a sale.' }),
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Only staff can process a sale.');
  });
});

describe('a short cart line is named with the real numbers', () => {
  it('points at the item and reports what is actually left', () => {
    renderCheckout({
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
    renderCheckout({
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
    renderCheckout({ isSubmitting: true });

    expect(screen.getByRole('button', { name: /processing/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });

  it('offers an enabled confirm button when idle', () => {
    renderCheckout();

    expect(screen.getByRole('button', { name: /confirm/i })).toBeEnabled();
  });

  it('confirms the sale when the cashier clicks through', async () => {
    const user = userEvent.setup();
    const { props } = renderCheckout();

    await user.click(screen.getByRole('button', { name: /confirm/i }));

    expect(props.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('closes without confirming when the cashier cancels', async () => {
    const user = userEvent.setup();
    const { props } = renderCheckout();

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(props.onBack).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });
});

describe('a recovered sale is called out, an ordinary one is not', () => {
  it('says the sale had already been saved when reconciliation rescued it', () => {
    renderCheckout({ checkoutSuccess: true, recovered: true });

    // The cashier believes this sale failed. Leaving them to find out otherwise
    // is how a paid sale gets rung up a second time.
    expect(screen.getByText(/already been saved/i)).toBeInTheDocument();
  });

  it('does not claim a rescue after an ordinary successful sale', () => {
    renderCheckout({ checkoutSuccess: true, recovered: false });

    expect(screen.getByText('Transaction Successful')).toBeInTheDocument();
    expect(screen.queryByText(/already been saved/i)).not.toBeInTheDocument();
  });
});

describe('custom orders are not sales', () => {
  it('offers to create an order and asks for no payment method', () => {
    renderCheckout({ posMode: 'custom' });

    expect(screen.getByRole('button', { name: /create order/i })).toBeInTheDocument();
    // A custom job is entered into production, not paid for at the till, so
    // offering Cash/Card here would invite a payment that never happened.
    expect(screen.queryByText(/payment method/i)).not.toBeInTheDocument();
  });

  it('asks for a payment method on a retail sale', () => {
    renderCheckout({ posMode: 'retail' });

    expect(screen.getByText(/payment method/i)).toBeInTheDocument();
    /*
     * A radio group, not two buttons.
     *
     * Cash/Card used to be a pair of Buttons whose `variant` was keyed off the
     * selection, so one of them was always the darkest thing in the dialog —
     * competing with "Confirm & Pay" directly beneath it. It is now a
     * SegmentedControl, which is a radio group because "choose one of two" is
     * what it is; the role is what tells a screen reader that, and it also gets
     * arrow-key navigation for free. The assertions move from `button` to
     * `radio` with it — the contract being pinned is still "a retail sale offers
     * Cash and Card", only the mechanism that expresses it changed.
     */
    expect(screen.getByRole('radiogroup', { name: /payment method/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /cash/i })).toBeChecked();
    expect(screen.getByRole('radio', { name: /card/i })).not.toBeChecked();
  });
});

/*
 * The tendered amount and the three-cell strip.
 *
 * The strip is ERPNext's, and it is only worth having because the cashier can
 * enter what the customer handed over — with `Paid Amount` pinned to the total,
 * `Remaining` would be a hard-coded zero in a coloured box. These tests pin the
 * two states that make it information rather than ornament, and the rule the
 * server imposes on one of them: `create_transaction_with_payment` requires the
 * received amount to equal the total, so a short payment cannot be confirmed.
 */
describe('the cash tendered drives the totals strip', () => {
  const cashField = () => screen.getByLabelText(/cash received/i);
  const confirm = () => screen.getByRole('button', { name: /confirm/i });

  it('shows the three cells with nothing outstanding by default', () => {
    renderCheckout();

    expect(screen.getByText(/grand total/i)).toBeInTheDocument();
    expect(screen.getByText(/paid amount/i)).toBeInTheDocument();
    // The fixture totals are 200 + 24 = 224, paid in full when nothing is typed.
    expect(screen.getByText(/^change$/i)).toBeInTheDocument();
    expect(screen.getByText('PHP 0.00')).toBeInTheDocument();
  });

  it('refuses to confirm while the customer is short', async () => {
    const user = userEvent.setup();
    renderCheckout();

    await user.type(cashField(), '100');

    // 224 − 100 = 124 outstanding.
    expect(screen.getByText(/remaining/i)).toBeInTheDocument();
    expect(screen.getByText('PHP 124.00')).toBeInTheDocument();
    expect(confirm()).toBeDisabled();
  });

  it('reports the change when the customer overpays, and allows the sale', async () => {
    const user = userEvent.setup();
    renderCheckout();

    await user.type(cashField(), '250');

    // 250 − 224 = 26 back.
    expect(screen.getByText(/^change$/i)).toBeInTheDocument();
    expect(screen.getByText('PHP 26.00')).toBeInTheDocument();
    expect(confirm()).toBeEnabled();
  });

  it('asks for nothing tendered on a card', () => {
    renderCheckout({ paymentMethod: 'Card' });

    // A card is tendered for the exact amount by definition — there is nothing
    // for the cashier to type and nothing to give back.
    expect(screen.queryByLabelText(/cash received/i)).not.toBeInTheDocument();
    expect(screen.getByText(/^change$/i)).toBeInTheDocument();
  });
});
