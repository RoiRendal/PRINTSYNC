import { useBusinessBranding } from '../../../../app/providers/BusinessBrandingProvider';
import type { PrintableDocument } from '../../types/printableDocument';

interface PrintableDocumentViewProps {
  document: PrintableDocument;
  /** Optional footer line, e.g. "Reprinted 17/09/2026". */
  reprintNote?: string;
}

/**
 * A labelled block on the slip — `Items`, `Totals`, `Payments`.
 *
 * ERPNext heads each of its three sections this way, and it earns its place on a
 * receipt: the reader is looking for one of three things, and a heading tells
 * them where to stop. The rule above the label is what separates the blocks on
 * paper, where a background would not survive the printer.
 */
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="border-b border-black/15 pb-1 text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-500 dark:border-zinc-400">
        {label}
      </p>
      {children}
    </div>
  );
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
 * than the whole application. **The preview and the paper are this one node** —
 * there is no separate print layout — so anything changed here changes both, and
 * the print path has to be re-measured after any layout change (see the
 * `printsync-print-layout-verification` skill; the slip once printed as 125px of
 * itself because three ancestors were clipping it).
 */
export function PrintableDocumentView({ document, reprintNote }: PrintableDocumentViewProps) {
  const { businessDisplayName, businessAddress, currencySymbol } = useBusinessBranding();
  const { kind, lines, totals, payment, customerName, soldBy, notes, balance, voided } = document;
  const isOrder = kind === 'order';
  const money = (value: number) => `${currencySymbol}${value.toFixed(2)}`;

  /**
   * The status pill.
   *
   * `Voided` wins over everything: a reversed sale must never be labelled Paid.
   * An order is `Balance due` until it is settled — a job ticket is an
   * acknowledgement, not proof of payment.
   */
  const statusLabel = voided ? 'Voided' : isOrder ? (payment.settled ? 'Paid' : 'Balance due') : 'Paid';

  return (
    <div
      id="receipt-content"
      className="mx-auto w-full max-w-[320px] space-y-4 rounded-[var(--radius-card)] border border-black/10 bg-white p-5 text-black dark:border-white/10 dark:bg-zinc-100 dark:text-zinc-900"
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

      {/*
        The shop's identity, as printed.

        The name and address come from the SIGNED-IN caller's own branch — see
        `BusinessBrandingProvider`, which replaces the public branding with
        `GET /branding/current` the moment a session exists. Before that change the
        app used the public route for both purposes, and since that route runs before
        anyone has a session it can only serve one shop's row — so a receipt printed
        at Nasugbu came out headed with Balayan's name. Nothing looked wrong in a
        one-branch business, which is exactly why it survived.

        The address is rendered only when there is one: `whitespace-pre-line` keeps a
        multi-line Philippine street address on the lines the manager typed, and an
        unset address prints nothing rather than an empty gap. A wrong address on a
        customer's receipt is worse than no address.
      */}
      <div className="text-center">
        <h3 className="text-sm font-bold uppercase tracking-widest">{businessDisplayName}</h3>
        {businessAddress && (
          <p className="mt-0.5 whitespace-pre-line text-[10px] leading-snug text-zinc-500">{businessAddress}</p>
        )}
        <p className="mt-1 text-[10px] text-zinc-500">{document.date}</p>
        <p className="mt-0.5 text-[10px] text-zinc-500">
          {isOrder ? 'CUSTOM ORDER SUMMARY' : 'SALES RECEIPT'}
        </p>
      </div>

      {/*
        The two-half header: who it is for on the left, what it came to on the
        right, and the reference tucked under the figure it belongs to. Reading
        order matters — the eye lands on the name and the amount, and the
        reference is what you look for when you have to find the sale again.
      */}
      <div className="flex items-start justify-between gap-3 border-y border-black/15 py-2.5 dark:border-zinc-400">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-bold">{customerName || 'Walk-in'}</p>
          {/* Only a live sale knows who served it; a reprint does not. */}
          {soldBy && <p className="mt-0.5 truncate text-[9px] text-zinc-500">Sold by: {soldBy}</p>}
        </div>
        <div className="shrink-0 text-right">
          <p className="tabular-nums text-base font-bold">{money(totals.total)}</p>
          <p className="mt-0.5 break-all text-[9px] text-zinc-500">{document.reference}</p>
          <p className="mt-1 inline-block rounded-full border border-black/25 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
            {statusLabel}
          </p>
        </div>
      </div>

      <Section label="Items">
        {/*
          A tinted panel, as ERPNext has it. The border carries the grouping on
          paper: browsers do not print background colours by default, so a panel
          that relied on its fill alone would come out as loose rows.
        */}
        <div className="space-y-1.5 rounded-[6px] border border-black/10 bg-zinc-50 p-2 dark:border-zinc-300 dark:bg-zinc-200">
          {lines.map((line) => {
            const gross = line.unitPrice * line.qty;
            const discount = Math.min(line.lineDiscount ?? 0, gross);
            return (
              <div key={line.id} className="text-[10px]">
                <div className="flex justify-between gap-2">
                  <span className="min-w-0 flex-1">
                    {line.qty}x {line.name}
                    {line.designId && <span className="ml-1 text-zinc-500">(Design {line.designId})</span>}
                  </span>
                  <span className="shrink-0 tabular-nums">{money(gross - discount)}</span>
                </div>
                <div className="flex justify-between gap-2 text-[9px] text-zinc-500">
                  <span className="min-w-0 flex-1 truncate">
                    {money(line.unitPrice)}
                    {line.uom && ` / ${line.uom}`}
                  </span>
                  {/* The discount sits under its own line, not only in the totals. */}
                  {discount > 0 && <span className="shrink-0 tabular-nums">−{money(discount)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section label="Totals">
        <div className="space-y-1 text-[10px]">
          <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{money(totals.subtotal)}</span></div>
          {totals.discount > 0 && (
            <div className="flex justify-between">
              <span>Discount</span>
              <span className="tabular-nums">&minus;{money(totals.discount)}</span>
            </div>
          )}
          {totals.taxLabel && (
            <div className="flex justify-between"><span>{totals.taxLabel}</span><span className="tabular-nums">{money(totals.tax)}</span></div>
          )}
          <div className="flex justify-between border-t border-dashed border-black/20 pt-1.5 text-sm font-bold dark:border-zinc-400">
            <span>{isOrder ? 'ORDER TOTAL' : 'TOTAL'}</span>
            <span className="tabular-nums">{money(totals.total)}</span>
          </div>

          {balance && (
            <>
              <div className="flex justify-between pt-1.5">
                <span>Amount Paid</span>
                <span className="tabular-nums">{money(balance.totalPaid)}</span>
              </div>
              {/*
                The balance line is dropped once nothing is owed. A settled job
                still prints what was paid — that is the record — but "BALANCE DUE
                ₱0.00" reads to a customer like a demand for money.
              */}
              {balance.balanceDue > 0 && (
                <div className="flex justify-between text-sm font-bold">
                  <span>BALANCE DUE</span>
                  <span className="tabular-nums">{money(balance.balanceDue)}</span>
                </div>
              )}
            </>
          )}
        </div>
      </Section>

      {/*
        `Payments` is its own block because it answers a different question from
        `Totals`: not what the goods cost, but what was handed over and how. On a
        custom order nothing was collected at the till, so the block says so
        rather than printing a method that was never used.
      */}
      <Section label="Payments">
        {/*
          A receipt records what was handed over. An ORDER has no payment to
          record — nothing is collected at the till — and its Totals block
          already carries `Amount Paid` and the balance, so repeating the deposit
          here would print the same figure twice under two different headings.
          Saying plainly that nothing was taken is both shorter and truer.
        */}
        {isOrder ? (
          <p className="text-[10px] text-zinc-500">No payment collected at the till.</p>
        ) : (
          <div className="flex justify-between text-[10px]">
            <span>Paid via {payment.method}</span>
            <span className="tabular-nums">{money(totals.total)}</span>
          </div>
        )}
      </Section>

      {notes && (
        <div className="border-t border-dashed border-black/20 pt-2 text-[10px] dark:border-zinc-400">
          <p><strong>Notes:</strong> {notes}</p>
        </div>
      )}

      <div className="text-center text-[10px]">
        <p className="font-bold uppercase">
          {isOrder
            ? payment.settled
              ? 'Custom Order — Fully Paid'
              : 'Custom Order — Balance due on pickup'
            : 'Thank you for your business!'}
        </p>
        {isOrder && <p className="mt-2 text-zinc-500">Please keep this summary for your records.</p>}
      </div>

      {reprintNote && <p className="border-t border-dashed border-black/20 pt-2 text-center text-[9px] text-zinc-500 dark:border-zinc-400">{reprintNote}</p>}
    </div>
  );
}
