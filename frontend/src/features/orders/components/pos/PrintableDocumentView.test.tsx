import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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
 */
vi.mock('../../../../app/providers/BusinessBrandingProvider', () => ({
  useBusinessBranding: () => ({ businessDisplayName: 'IC Printing Services', currencySymbol: '₱' }),
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
    expect(screen.queryByText('₱262.50')).not.toBeInTheDocument();
    expect(screen.queryByText('₱106.25')).not.toBeInTheDocument();
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

    expect(screen.getByText(/voided/i)).toBeInTheDocument();
  });

  it('leaves a live sale unstamped', () => {
    render(<PrintableDocumentView document={makeRetailDocument({ voided: false })} />);

    expect(screen.queryByText(/voided/i)).not.toBeInTheDocument();
  });

  it('still shows the amounts it was voided for', () => {
    render(<PrintableDocumentView document={makeRetailDocument({ voided: true })} />);

    // The amounts are left as recorded. A reversal is proved by the paper
    // showing what was reversed, not by zeroing the record.
    expect(screen.getByText('₱224.00')).toBeInTheDocument();
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
