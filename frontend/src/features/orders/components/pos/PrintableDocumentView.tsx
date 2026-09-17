import { useBusinessBranding } from '../../../../app/providers/BusinessBrandingProvider';
import type { PrintableDocument } from '../../types/printableDocument';

interface PrintableDocumentViewProps {
  document: PrintableDocument;
  /** Optional footer line, e.g. "Reprinted 17/09/2026". */
  reprintNote?: string;
}

/**
 * The paper itself: a retail receipt or a custom-order job ticket.
 *
 * Pure presentation — it reads nothing but the `document` prop and the business
 * branding, so the same markup is produced whether the sale just happened or is
 * being reopened from three months of history.
 *
 * The id is load-bearing: `@media print` in `index.css` hides everything except
 * `#receipt-content`, which is what makes `window.print()` emit the slip rather
 * than the whole application.
 */
export function PrintableDocumentView({ document, reprintNote }: PrintableDocumentViewProps) {
  const { businessDisplayName, currencySymbol } = useBusinessBranding();
  const { kind, lines, totals, payment, customerName, notes, balance, voided } = document;
  const isOrder = kind === 'order';
  const money = (value: number) => `${currencySymbol}${value.toFixed(2)}`;

  return (
    <div
      id="receipt-content"
      className="space-y-4 rounded-[var(--radius-card)] border border-black/10 bg-white p-6 text-black shadow-sm dark:border-white/10 dark:bg-zinc-100 dark:text-zinc-900"
    >
      {/*
        Stamped across the top, not tucked into the footer. A reprint of a
        reversed sale that "looks valid" is the one way this paperwork can do
        harm: it would be handed to a customer as proof of a purchase that was
        cancelled. The banner is deliberately the first thing on the page.
      */}
      {voided && (
        <div className="rounded-[var(--radius-card)] border border-black/25 py-1.5 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em]">Voided — not a valid receipt</p>
        </div>
      )}

      <div className="text-center">
        <h3 className="text-sm font-bold uppercase tracking-widest">{businessDisplayName}</h3>
        <p className="mt-1 text-[10px] text-zinc-500">{document.date}</p>
        <p className="mt-0.5 text-[10px] text-zinc-500">
          {isOrder ? 'CUSTOM ORDER SUMMARY' : 'SALES RECEIPT'}
        </p>
      </div>

      <div className="border-b border-dashed border-black/20 pb-3 dark:border-zinc-400">
        <div className="mb-2 text-[10px]">
          <p>
            <strong>{isOrder ? 'Customer:' : 'Ref:'}</strong> {customerName || 'Walk-in'}
          </p>
          <p>
            <strong>{isOrder ? 'Order Ref:' : 'Receipt No:'}</strong> {document.reference}
          </p>
        </div>
        <div className="space-y-1.5">
          {lines.map((line) => (
            <div key={line.id} className="flex justify-between gap-2 text-[10px]">
              <span className="min-w-0 flex-1">
                {line.qty}x {line.name}
                {line.designId && <span className="ml-1 text-zinc-500">(Design {line.designId})</span>}
              </span>
              <span className="shrink-0 font-mono">{money(line.unitPrice * line.qty)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1 text-[10px]">
        <div className="flex justify-between"><span>Subtotal</span><span className="font-mono">{money(totals.subtotal)}</span></div>
        {totals.discount > 0 && (
          <div className="flex justify-between">
            <span>Discount</span>
            <span className="font-mono">&minus;{money(totals.discount)}</span>
          </div>
        )}
        {totals.taxLabel && (
          <div className="flex justify-between"><span>{totals.taxLabel}</span><span className="font-mono">{money(totals.tax)}</span></div>
        )}
        <div className="flex justify-between border-t border-dashed border-black/20 pt-1.5 text-sm font-bold dark:border-zinc-400">
          <span>{isOrder ? 'ORDER TOTAL' : 'TOTAL'}</span>
          <span className="font-mono">{money(totals.total)}</span>
        </div>

        {balance && (
          <>
            <div className="flex justify-between pt-1.5">
              <span>Amount Paid</span>
              <span className="font-mono">{money(balance.totalPaid)}</span>
            </div>
            {/*
              The balance line is dropped once nothing is owed. A settled job
              still prints what was paid — that is the record — but "BALANCE DUE
              ₱0.00" reads to a customer like a demand for money.
            */}
            {balance.balanceDue > 0 && (
              <div className="flex justify-between text-sm font-bold">
                <span>BALANCE DUE</span>
                <span className="font-mono">{money(balance.balanceDue)}</span>
              </div>
            )}
          </>
        )}
      </div>

      {notes && (
        <div className="border-t border-dashed border-black/20 pt-2 text-[10px] dark:border-zinc-400">
          <p><strong>Notes:</strong> {notes}</p>
        </div>
      )}

      {!isOrder && (
        <div className="text-center text-[10px]">
          <p className="font-bold uppercase">Paid via {payment.method}</p>
          <p className="mt-2 text-zinc-500">Thank you for your business!</p>
        </div>
      )}

      {isOrder && (
        <div className="text-center text-[10px]">
          <p className="font-bold uppercase text-macos-purple">
            {payment.settled ? 'Custom Order — Fully Paid' : 'Custom Order — Balance due on pickup'}
          </p>
          <p className="mt-2 text-zinc-500">Please keep this summary for your records.</p>
        </div>
      )}

      {reprintNote && <p className="border-t border-dashed border-black/20 pt-2 text-center text-[9px] text-zinc-500 dark:border-zinc-400">{reprintNote}</p>}
    </div>
  );
}
