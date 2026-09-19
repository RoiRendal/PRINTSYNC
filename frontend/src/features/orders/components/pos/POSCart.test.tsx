import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { POSCart } from './POSCart';
import { makeCartItem, makeTotals } from '../../../../test/fixtures';

/*
 * The cart's controls, after Phase 5 rebuilt them.
 *
 * Phase 5 replaced the quantity stepper's markup: it was two one-line buttons
 * either side of a span, and it is now a recessed track with two raised keycaps.
 * A restyle like that has one failure mode that nothing else in this project can
 * catch — the two keys are visually symmetric, so wiring `+` to the decrement and
 * `−` to the increment produces code that type-checks, renders, and looks
 * entirely plausible in a screenshot. The cashier finds out at the till.
 *
 * So these assert the *contract* the restyle had to preserve, not the classes it
 * introduced: which callback fires with which argument, and what each control is
 * called. The class names are deliberately not asserted — they are the thing
 * this phase was expected to change, and a test that pins them would have to be
 * rewritten by the next phase instead of protecting it.
 */

function renderCart(overrides: Partial<Parameters<typeof POSCart>[0]> = {}) {
  const props: Parameters<typeof POSCart>[0] = {
    cart: [makeCartItem({ id: 'item-1', name: 'Glossy Paper A4', price: 125, qty: 3 })],
    designs: [],
    posMode: 'retail',
    editingOrderId: null,
    customers: [],
    customerId: null,
    customerName: '',
    orderNotes: '',
    cartDiscount: 0,
    vatRatePercent: 12,
    totals: makeTotals(),
    currencySymbol: '₱',
    onCustomerNameChange: vi.fn(),
    onCustomerIdChange: vi.fn(),
    onOrderNotesChange: vi.fn(),
    onCartDiscountChange: vi.fn(),
    onVatRatePercentChange: vi.fn(),
    onUpdateQty: vi.fn(),
    onRemoveFromCart: vi.fn(),
    onOpenDesignSelector: vi.fn(),
    onReset: vi.fn(),
    onCheckout: vi.fn(),
    ...overrides,
  };

  return { ...render(<POSCart {...props} />), props };
}

describe('the quantity stepper still increments and decrements the right way round', () => {
  it('decrements when the cashier presses minus', async () => {
    const user = userEvent.setup();
    const { props } = renderCart();

    await user.click(screen.getByRole('button', { name: 'Decrease Glossy Paper A4' }));

    expect(props.onUpdateQty).toHaveBeenCalledWith(0, -1);
  });

  it('increments when the cashier presses plus', async () => {
    const user = userEvent.setup();
    const { props } = renderCart();

    await user.click(screen.getByRole('button', { name: 'Increase Glossy Paper A4' }));

    expect(props.onUpdateQty).toHaveBeenCalledWith(0, 1);
  });

  it('names each key after the line it changes, so the direction is never in doubt', () => {
    // The keys are a 10px glyph apart in a two-key group. The accessible name is
    // the only thing that says which is which without looking at the glyph.
    renderCart();

    expect(screen.getByRole('button', { name: 'Decrease Glossy Paper A4' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Increase Glossy Paper A4' })).toBeInTheDocument();
  });
});

describe('removing a line', () => {
  it('reports the index of the line that was removed', async () => {
    const user = userEvent.setup();
    const { props } = renderCart({
      cart: [
        makeCartItem({ id: 'a', name: 'Glossy Paper A4' }),
        makeCartItem({ id: 'b', name: 'Photo Satin A3' }),
      ],
    });

    await user.click(screen.getByRole('button', { name: 'Remove Photo Satin A3' }));

    // The second line, not the first — an off-by-one here silently deletes the
    // wrong item from the sale.
    expect(props.onRemoveFromCart).toHaveBeenCalledWith(1);
  });
});

describe('a line still states what is being charged for', () => {
  it('shows the name, the quantity and the extended price', () => {
    renderCart();

    expect(screen.getByText('Glossy Paper A4')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    /*
     * 125 x 3, not 125 and not the subtotal. The fixture's totals are left at
     * their defaults (subtotal 200) precisely so this figure cannot collide with
     * a row in the summary below it — an ambiguous `getByText` here would pass
     * for the wrong reason the moment the two happened to agree.
     */
    expect(screen.getByText('₱375.00')).toBeInTheDocument();
  });

  it('does not offer a checkout when there is nothing in the cart', () => {
    renderCart({ cart: [] });

    expect(screen.getByRole('button', { name: /quick pay/i })).toBeDisabled();
  });
});
