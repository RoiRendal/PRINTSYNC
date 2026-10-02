import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PrintableDocumentView } from './PrintableDocumentView';
import type { PrintableDocument } from '../../types/printableDocument';

/**
 * What the paper tells a customer.
 *
 * The renderer is the last place a document can mislead, so these assertions are
 * about words a person reads — "Paid via Cash", "BALANCE DUE" — rather than about
 * markup. The branding hook is stubbed instead of wrapped in its provider: the
 * real provider fetches settings over the network on mount, which would make a
 * layout test depend on an API being up.
 *
 * The stub mirrors the provider's real shape, including `businessAddress`, so a test
 * can drive the shop's identity without a network. `branding` is mutable per-test
 * because the identity is exactly what the receipt-header tests vary.
 */
const branding = {
  businessDisplayName: 'IC Printing Services - Balayan',
  businessAddress: 'Balayan, Batangas',
  currencySymbol: '₱',
};

vi.mock('../../../../app/providers/BusinessBrandingProvider', () => ({
  useBusinessBranding: () => branding,
}));

function makeRetailDocument(overrides: Partial<PrintableDocument> = {}): PrintableDocument {
  return {
    kind: 'receipt',
    reference: 'TRX-ABCD1234',
    date: '17/09/2026, 09:30',
    lines: [{ id: 'line-1', name: 'Glossy Paper A4', qty: 2, unitPrice: 100 }],
    totals: { subtotal: 200, discount: 0, tax: 24, taxLabel: 'VAT (12%)', total: 224 },
    payment: { method: 'Cash', settled: true },
    customerName: 'Walk-in',
    ...overrides,
  };
}

function makeOrderDocument(overrides: Partial<PrintableDocument> = {}): PrintableDocument {
  return {
    kind: 'order',
    reference: 'ORD-000123',
    date: '15/09/2026',
    lines: [{ id: 'line-1', name: 'Business Cards', qty: 500, unitPrice: 10 }],
    totals: { subtotal: 5000, discount: 0, tax: 0, taxLabel: '', total: 5000 },
    payment: { method: 'Custom Order', settled: false },
    customerName: 'Acme Trading',
    balance: { totalPaid: 2000, balanceDue: 3000 },
    ...overrides,
  };
}

describe('a retail receipt reads as proof of payment', () => {
  it('says how the customer paid', () => {
    render(<PrintableDocumentView document={makeRetailDocument()} />);

    expect(screen.getByText(/paid via cash/i)).toBeInTheDocument();
  });

  it('prints the reference so the sale can be looked up later', () => {
    render(<PrintableDocumentView document={makeRetailDocument()} />);

    expect(screen.getByText('TRX-ABCD1234')).toBeInTheDocument();
  });

  it('prices each line as quantity times unit price', () => {
    render(
      <PrintableDocumentView
        document={makeRetailDocument({
          // Two lines with unlike prices. On a single-line receipt the line total
          // and the subtotal are necessarily equal, so one line proves nothing.
          lines: [
            { id: 'line-1', name: 'Glossy Paper A4', qty: 3, unitPrice: 262.5 },
            { id: 'line-2', name: 'Ink Cartridge', qty: 2, unitPrice: 106.25 },
          ],
          totals: { subtotal: 1000, discount: 0, tax: 120, taxLabel: 'VAT (12%)', total: 1120 },
        })}
      />,
    );

    // 3 x 262.50 and 2 x 106.25, neither of which equals the unit price it came
    // from — so a receipt printing unit prices as line totals would fail here.
    expect(screen.getByText('₱787.50')).toBeInTheDocument();
    expect(screen.getByText('₱212.50')).toBeInTheDocument();
    /*
     * R5 prints the RATE under each line, with its unit — `₱262.50 / pc`. That
     * reverses what this test used to assert (that a unit price never appeared
     * at all), and it is deliberate: the plan asks for `uom` to be spent on the
     * receipt, and the rate is where a unit belongs.
     *
     * The guard this test was protecting survives intact. The two figures are
     * still distinct and each still appears exactly once, so a slip that printed
     * the rate in the line total's place would show 262.50 where 787.50 belongs
     * and fail the assertions above.
     */
    expect(screen.getByText('₱262.50')).toBeInTheDocument();
    expect(screen.getByText('₱106.25')).toBeInTheDocument();
  });

  it('attaches a design reference to the line that carries it', () => {
    render(
      <PrintableDocumentView
        document={makeRetailDocument({
          lines: [{ id: 'line-1', name: 'Business Cards', qty: 1, unitPrice: 500, designId: 'DSN-77' }],
        })}
      />,
    );

    // The design reference is what the shop floor works from; losing it turns a
    // reprint into a guessing game.
    expect(screen.getByText(/DSN-77/)).toBeInTheDocument();
  });

  it('never shows a balance on a settled sale', () => {
    render(<PrintableDocumentView document={makeRetailDocument()} />);

    expect(screen.queryByText(/balance due/i)).not.toBeInTheDocument();
  });
});

describe('a voided sale cannot be mistaken for a live one', () => {
  it('stamps the document as void', () => {
    render(<PrintableDocumentView document={makeRetailDocument({ voided: true })} />);

    // The word now appears twice — the banner across the top and the status pill
    // in the header — and that is the point rather than an accident: a customer
    // glancing at either end of the slip should see it.
    expect(screen.getAllByText(/voided/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/not a valid receipt/i)).toBeInTheDocument();
  });

  it('leaves a live sale unstamped', () => {
    render(<PrintableDocumentView document={makeRetailDocument({ voided: false })} />);

    expect(screen.queryByText(/voided/i)).not.toBeInTheDocument();
  });

  it('still shows the amounts it was voided for', () => {
    render(<PrintableDocumentView document={makeRetailDocument({ voided: true })} />);

    // The amounts are left as recorded. A reversal is proved by the paper
    // showing what was reversed, not by zeroing the record.
    //
    // `getAllByText`: the figure appears in the header (the headline amount) and
    // again in the Payments block (what was handed over). That repetition is how
    // a receipt reads — the top line is the total, the bottom is the detail —
    // so the assertion is "the amount is still on the paper", not "exactly once".
    expect(screen.getAllByText('₱224.00').length).toBeGreaterThan(0);
  });
});

describe('a custom order summary reads as an acknowledgement, not a receipt', () => {
  it('names the customer and the order reference', () => {
    render(<PrintableDocumentView document={makeOrderDocument()} />);

    expect(screen.getByText('Acme Trading')).toBeInTheDocument();
    expect(screen.getByText('ORD-000123')).toBeInTheDocument();
  });

  it('never claims the job was paid at the till', () => {
    render(<PrintableDocumentView document={makeOrderDocument()} />);

    // The failure this guards: printing "Paid via Cash" on a job whose balance
    // is still outstanding, which a customer would reasonably read as a receipt.
    expect(screen.queryByText(/paid via/i)).not.toBeInTheDocument();
  });

  it('states the balance still owed', () => {
    render(<PrintableDocumentView document={makeOrderDocument()} />);

    // Matched by the label node specifically: the footer sentence also contains
    // the words "balance due", so a loose text query would match two elements.
    expect(screen.getByText('BALANCE DUE')).toBeInTheDocument();
    expect(screen.getByText('₱3000.00')).toBeInTheDocument();
    expect(screen.getByText('₱2000.00')).toBeInTheDocument();
  });

  it('drops the balance line once the job is fully paid', () => {
    render(
      <PrintableDocumentView
        document={makeOrderDocument({
          // A paid amount unlike the line total, so the assertion can only be
          // satisfied by the Amount Paid row.
          lines: [{ id: 'line-1', name: 'Business Cards', qty: 500, unitPrice: 10 }],
          balance: { totalPaid: 4321, balanceDue: 0 },
          payment: { method: 'Custom Order', settled: true },
        })}
      />,
    );

    // "BALANCE DUE ₱0.00" reads as a demand for money to a customer holding the
    // slip, so the line goes; what was paid stays, because that is the record.
    expect(screen.queryByText('BALANCE DUE')).not.toBeInTheDocument();
    expect(screen.getByText('₱4321.00')).toBeInTheDocument();
    expect(screen.getByText(/fully paid/i)).toBeInTheDocument();
  });

  it('prints the discount line only when there is one', () => {
    const { unmount } = render(<PrintableDocumentView document={makeOrderDocument()} />);
    expect(screen.queryByText(/^discount$/i)).not.toBeInTheDocument();
    unmount();

    render(
      <PrintableDocumentView
        document={makeRetailDocument({
          totals: { subtotal: 200, discount: 50, tax: 18, taxLabel: 'VAT (12%)', total: 168 },
        })}
      />,
    );
    expect(screen.getByText(/^discount$/i)).toBeInTheDocument();
  });

  it('omits the VAT line when the document is not taxed', () => {
    render(<PrintableDocumentView document={makeOrderDocument()} />);

    expect(screen.queryByText(/VAT/i)).not.toBeInTheDocument();
  });
});

/*
 * R5's recomposition, as the reader sees it: the three labelled blocks, the
 * two-half header with the status pill, `Sold by`, and the per-line figures the
 * new columns made printable.
 */
describe('the slip is composed as labelled blocks', () => {
  it('heads the three sections ERPNext heads', () => {
    render(<PrintableDocumentView document={makeRetailDocument()} />);

    // The reader is looking for one of three things; the headings are what tell
    // them where to stop.
    expect(screen.getByText('Items')).toBeInTheDocument();
    expect(screen.getByText('Totals')).toBeInTheDocument();
    expect(screen.getByText('Payments')).toBeInTheDocument();
  });

  it('prints the reference under the amount it belongs to', () => {
    render(<PrintableDocumentView document={makeRetailDocument()} />);

    // The reference is what you look for when the sale has to be found again —
    // and after R5 it is the STORED sale's id, not a browser-minted timestamp.
    expect(screen.getByText('TRX-ABCD1234')).toBeInTheDocument();
  });

  it('names the cashier who served the sale', () => {
    render(<PrintableDocumentView document={makeRetailDocument({ soldBy: 'mika@printsync.com' })} />);

    expect(screen.getByText(/sold by: mika@printsync\.com/i)).toBeInTheDocument();
  });

  it('prints no `Sold by` when the record does not carry one', () => {
    // A reprint: `sales_transactions.created_by` is not in the `Transaction`
    // contract, so the document genuinely does not know. Printing a guess would
    // be worse than printing nothing.
    render(<PrintableDocumentView document={makeRetailDocument()} />);

    expect(screen.queryByText(/sold by/i)).not.toBeInTheDocument();
  });

  it('marks a settled sale Paid and an outstanding job Balance due', () => {
    const { unmount } = render(<PrintableDocumentView document={makeRetailDocument()} />);
    expect(screen.getByText('Paid')).toBeInTheDocument();
    unmount();

    render(<PrintableDocumentView document={makeOrderDocument()} />);
    expect(screen.getByText('Balance due')).toBeInTheDocument();
  });

  it('prints the unit beside the rate', () => {
    render(
      <PrintableDocumentView
        document={makeRetailDocument({
          lines: [{ id: 'line-1', name: 'Bond Paper', qty: 2, unitPrice: 250, uom: 'ream' }],
        })}
      />,
    );

    // The unit is a property of the item, so it rides on the rate.
    expect(screen.getByText('₱250.00 / ream')).toBeInTheDocument();
  });

  it('prints a line discount against its own line', () => {
    render(
      <PrintableDocumentView
        document={makeRetailDocument({
          lines: [{ id: 'line-1', name: 'Banner', qty: 1, unitPrice: 1200, lineDiscount: 150 }],
          totals: { subtotal: 1200, discount: 150, tax: 126, taxLabel: 'VAT (12%)', total: 1176 },
        })}
      />,
    );

    // A customer given ₱150 off one item should see it against that item, not
    // only as one unexplained figure in the totals — so it appears twice: once
    // under the line it belongs to, once in the Totals block it rolls into.
    expect(screen.getAllByText('−₱150.00')).toHaveLength(2);
    // …and the line still prices net of it.
    expect(screen.getByText('₱1050.00')).toBeInTheDocument();
  });

  it('never claims an order collected money at the till', () => {
    render(<PrintableDocumentView document={makeOrderDocument()} />);

    // The order's Totals block already carries Amount Paid and the balance;
    // repeating the deposit under Payments would print one figure twice under
    // two headings, and "collected at the till" would be untrue of a deposit.
    expect(screen.getByText('No payment collected at the till.')).toBeInTheDocument();
    // Anchored at the start of a node's text: the negative CONTAINS the positive,
    // so an unanchored query would match the very sentence it is excluding.
    expect(screen.queryByText(/^collected at the till/i)).not.toBeInTheDocument();
  });
});

/*
 * The shop's identity on the paper.
 *
 * This is the fix for a real defect: the app took its displayed identity from the
 * branch-blind public branding route even when signed in, so a receipt printed at
 * one shop was headed with the other shop's name. Nothing looked wrong while there
 * was only one shop, which is exactly why it survived to the second one.
 *
 * `beforeEach` restores the stub because these tests mutate it, and a leak here
 * would make the rest of the file depend on execution order.
 */
describe('the receipt is headed by the branch that printed it', () => {
  beforeEach(() => {
    branding.businessDisplayName = 'IC Printing Services - Balayan';
    branding.businessAddress = 'Balayan, Batangas';
  });

  it('prints the branch name it was given', () => {
    branding.businessDisplayName = 'IC Printing Services - Nasugbu';

    render(<PrintableDocumentView document={makeRetailDocument()} />);

    expect(screen.getByText('IC Printing Services - Nasugbu')).toBeInTheDocument();
  });

  it('prints the address under the name', () => {
    branding.businessAddress = 'Balayan, Batangas';

    render(<PrintableDocumentView document={makeRetailDocument()} />);

    expect(screen.getByText('Balayan, Batangas')).toBeInTheDocument();
  });

  it('keeps a multi-line address on its own lines', () => {
    // Multi-line is still a supported shape even though both seeded addresses are
    // now a single line — a shop may add a barangay or landmark line in Settings.
    branding.businessAddress = 'Poblacion, Balayan\nBatangas';

    render(<PrintableDocumentView document={makeRetailDocument()} />);

    // The receipt renders the address with `whitespace-pre-line`, so the newline
    // survives. Without it a two-line address collapses onto one line — which is
    // still readable, so the failure would go unnoticed.
    const address = screen.getByText(/Poblacion, Balayan/);
    expect(address).toHaveClass('whitespace-pre-line');
  });

  it('prints no address line at all when the shop has none', () => {
    branding.businessAddress = '';

    const { container } = render(<PrintableDocumentView document={makeRetailDocument()} />);

    // An empty address must produce NO element. A rendered empty paragraph would
    // leave a blank gap under the name, and `getByText('')` would match it.
    expect(container.querySelector('.whitespace-pre-line')).toBeNull();
  });

  it('does not restate the shop name in the address line', () => {
    // The defect this pins: the address used to begin with the shop name, which the
    // receipt ALREADY prints as its bold heading — so every slip carried the name
    // twice. The address is the town and province only.
    branding.businessDisplayName = 'IC Printing Services - Balayan';
    branding.businessAddress = 'Balayan, Batangas';

    const { container } = render(<PrintableDocumentView document={makeRetailDocument()} />);

    const address = container.querySelector('.whitespace-pre-line');
    expect(address?.textContent).toBe('Balayan, Batangas');
    expect(address?.textContent).not.toContain('IC Printing Services');
  });

  it('heads an order ticket the same way as a receipt', () => {
    // One component serves both papers, so a fix applied to the receipt alone
    // would leave job tickets carrying the other branch's name.
    branding.businessDisplayName = 'IC Printing Services - Nasugbu';
    branding.businessAddress = 'Nasugbu, Batangas';

    render(<PrintableDocumentView document={makeOrderDocument()} />);

    expect(screen.getByText('IC Printing Services - Nasugbu')).toBeInTheDocument();
    expect(screen.getByText('Nasugbu, Batangas')).toBeInTheDocument();
  });
});
