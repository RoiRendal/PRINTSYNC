/**
 * "10 items selected" — what the header reads when the user has ticked rows.
 *
 * Returns `null` when nothing is selected, so the caller can fall back to the
 * real column labels without an extra conditional. Every list table renders
 * this as a single header cell spanning all data columns when any row is
 * ticked, and the normal column labels while nothing is:
 *
 *   {count === 0
 *     ? <><TableHead>Order ID</TableHead> …</>
 *     : <TableHead colSpan={9}>{"10 items selected"}</TableHead>}
 *
 * Centralised so every list table (orders, inventory, customers, users) reads
 * the same string. The ERPNext item list collapses the WHOLE header to this
 * message while rows are ticked — see the increment-2 reference screenshots.
 */
export function formatSelectedCount(count: number): string | null {
  if (count === 0) return null;
  return `${count} item${count === 1 ? '' : 's'} selected`;
}