import type { ReactNode } from 'react';
import { LoaderCircle, Plus, RefreshCw, Trash2 } from '../../../../shared/components/ui/icons';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  SearchInput,
  StatusLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableSelectCell,
  TableSelectHead,
  cellTitle,
  getStatusBadgeVariant,
} from '../../../../shared/components/ui';
import { formatSelectedCount } from '../../../../shared/lib/selectionLabels';
import { TOOLBAR_ROW_CLASS, TOOLBAR_SEARCH_WIDTH_CLASS } from '../../../../shared/lib/toolbar';
import { useBusinessBranding } from '../../../../app/providers/BusinessBrandingProvider';
import type { RowSelection } from '../../../../shared/hooks/useRowSelection';
import type { Order } from '../../types';
import { isCustomOrder } from '../../utils/orderType';

interface OrdersTableProps {
  orders: Order[];
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onSelectOrder: (order: Order) => void;
  /** Opens the POS to ring up a new sale — the header's "+" control. */
  onNewOrder: () => void;
  /** Re-reads the current page of orders from the server. */
  onRefresh: () => void;
  /**
   * Deletes every ticked row. The table no longer deletes one row at a time: the
   * row's trash button was removed so a delete can only come from the header
   * control, which is the one place that can state how many rows it will take.
   */
  onDeleteSelected: () => void;
  /** Tick state, owned by the page. See `useRowSelection`. */
  selection: RowSelection;
  /**
   * Orders whose phase move has been sent but not yet answered. The row shows a
   * small spinner beside the status while the write is in flight, so a slow save
   * does not look like nothing is happening. Phase is now advanced only from the
   * Order Production Detail modal, so this no longer guards an in-row click.
   */
  pendingOrderIds: ReadonlySet<string>;
  /** Rendered inside the card, below the table — the shared pagination control. */
  footer?: ReactNode;
}

export function OrdersTable({
  orders,
  searchTerm,
  onSearchTermChange,
  onSelectOrder,
  onNewOrder,
  onRefresh,
  onDeleteSelected,
  selection,
  pendingOrderIds,
  footer,
}: OrdersTableProps) {
  const { currencySymbol } = useBusinessBranding();
  return (
    <Card padding="none" className="overflow-hidden">
      {/*
        No title or description: the toolbar sits flush against the top edge of
        the card so the table reads as a list, not a labelled section. The
        delete control is now an icon-only square, gray like Cancel, and the
        header cell to its right swaps to "# items selected" while rows are
        ticked — see the increment-2 reference (ERPNext item list).
      */}
      <CardHeader className="mb-0 flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-end">
        <div className={TOOLBAR_ROW_CLASS}>
          <SearchInput
            className={TOOLBAR_SEARCH_WIDTH_CLASS}
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
          />
          {/*
            Re-reads the list. To the LEFT of delete — the rule for every table
            that has one — so the toolbar reads search, refresh, delete, add.
          */}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={onRefresh}
            aria-label="Refresh"
            title="Refresh"
            className="shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          {/*
            The table's only delete control. It is icon-only and gray (the same
            tone as Cancel) so it does not advertise itself as a destructive
            action at a glance — the confirmation modal does that work. The
            hover title is the only place the user sees *why* it is disabled.
          */}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            disabled={selection.count === 0}
            onClick={onDeleteSelected}
            aria-label={selection.count > 0 ? `Delete ${selection.count} selected order${selection.count === 1 ? '' : 's'}` : 'Delete selected orders'}
            title={selection.count === 0 ? 'Tick the rows you want to delete first.' : `Delete ${selection.count} order${selection.count === 1 ? '' : 's'}`}
            className="shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          {/*
            "New POS Order" as a bare plus, to the right of delete — the same pair
            the Inventory, Customers and Users tables show. The words live in the
            accessible name now; the primary fill stays, because ringing up a sale
            is still this screen's one dominant action (R23).
          */}
          <Button
            type="button"
            variant="primary"
            size="icon"
            onClick={onNewOrder}
            aria-label="New POS Order"
            title="New POS Order"
            className="shrink-0"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <TableContainer className="rounded-none border-0 bg-transparent">
          <Table>
            {/*
              Seven columns: the tick box, then six data columns. "Type" and
              "Paid" were cut — see the header comment below for why.
            */}
            <colgroup>
              <col style={{ width: '44px' }} />
              <col style={{ width: '150px' }} />
              <col style={{ width: '300px' }} />
              <col style={{ width: '170px' }} />
              <col style={{ width: '140px' }} />
              <col style={{ width: '140px' }} />
              <col style={{ width: '140px' }} />
            </colgroup>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableSelectHead>
                  <Checkbox
                    checked={selection.allSelected}
                    indeterminate={selection.isIndeterminate}
                    disabled={orders.length === 0}
                    onChange={selection.toggleAll}
                    aria-label="Select all orders on this page"
                  />
                </TableSelectHead>
                {/*
                  When rows are ticked the whole header collapses to just the
                  "# items selected" message (ERPNext item-list behaviour) — every
                  column label disappears. The message spans all six data columns
                  so nothing reads as a stray header.

                  Two columns were cut. "Type" said only Custom or Retail, which
                  the row already carries: a retail sale's Value, Paid and
                  Balance cells all read "—", so its shape is the label. "Paid"
                  was a running total the staff never act on from this list —
                  the balance is the figure that decides whether to chase a
                  payment, and it stays. Six columns is also inside ERPNext's
                  own four-to-six band.
                */}
                {selection.count === 0 ? (
                  <>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Project / Client</TableHead>
                    <TableHead>Work Phase</TableHead>
                    <TableHead className="text-right">Due Date</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </>
                ) : (
                  <TableHead colSpan={6} className="font-semibold text-app-ink dark:text-zinc-100">
                    {formatSelectedCount(selection.count)}
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const isPending = pendingOrderIds.has(order.id);
                const isCustom = isCustomOrder(order);
                /*
                  The display strings are built once and handed to BOTH the cell
                  and its tooltip, so the two cannot drift apart — the tooltip
                  completes the text on screen rather than restating something
                  else. `undefined` where the cell shows the em dash, which
                  `cellTitle` turns into no tooltip at all.
                */
                const orderRef = `#${order.id.length > 10 ? order.id.replace('ORD-', 'PS-').slice(-8) : order.id}`;
                const balanceText = isCustom ? `${currencySymbol}${(order.balanceDue ?? 0).toFixed(2)}` : undefined;
                return (
                  <TableRow key={order.id} className="cursor-pointer" onClick={() => onSelectOrder(order)}>
                    {/*
                      The tick has to stop here. The whole row opens the order, and
                      without this a click on the box would open the detail modal
                      on top of the tick the user was aiming for.
                    */}
                    <TableSelectCell onClick={(event) => event.stopPropagation()}>
                      <Checkbox
                        checked={selection.has(order.id)}
                        onChange={() => selection.toggle(order.id)}
                        aria-label={`Select order ${order.id}`}
                      />
                    </TableSelectCell>
                    <TableCell className="text-app-ink dark:text-zinc-100" title={cellTitle('Order ID', orderRef)}>
                      {orderRef}
                    </TableCell>
                    <TableCell title={cellTitle('Project / Client', order.customer)}>
                      <span className="text-app-ink dark:text-zinc-100">{order.customer}</span>
                    </TableCell>
                    <TableCell title={cellTitle('Work Phase', order.status)}>
                      {/* `min-w-0`: a flex child refuses to shrink below its
                          content, so without it the row is cut with no ellipsis. */}
                      <div className="flex min-w-0 items-center gap-1.5">
                        <StatusLabel tone={getStatusBadgeVariant(order.status)}>{order.status}</StatusLabel>
                        {/*
                          The phase on screen has already moved — this says the
                          server has not confirmed it yet. Without it, a slow
                          write looks like nothing is happening.
                        */}
                        {isPending && (
                          <span role="status" aria-label="Saving phase change" className="inline-flex">
                            <LoaderCircle className="h-3 w-3 text-app-text-muted dark:text-zinc-500" aria-hidden="true" />
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums" title={cellTitle('Due Date', order.dueDate)}>
                      {order.dueDate ? (
                        new Date(order.dueDate) < new Date(new Date().toISOString().slice(0, 10)) && order.status !== 'Completed' && order.status !== 'Delivered' ? (
                          <span className="text-app-danger dark:text-red-300">{order.dueDate}</span>
                        ) : (
                          <span className="text-app-text-muted dark:text-zinc-500">{order.dueDate}</span>
                        )
                      ) : (
                        <span className="text-app-text-muted dark:text-zinc-500">—</span>
                      )}
                    </TableCell>
                    <TableCell
                      className="text-right tabular-nums text-app-ink dark:text-zinc-100"
                      title={cellTitle('Value', `${currencySymbol}${order.amount.toFixed(2)}`)}
                    >
                      {currencySymbol}{order.amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums" title={cellTitle('Balance', balanceText)}>
                      {isCustom && (order.balanceDue ?? 0) > 0 ? (
                        <StatusLabel tone="red">{balanceText}</StatusLabel>
                      ) : (
                        <span className="text-app-text-muted dark:text-zinc-500">{isCustom ? balanceText : '—'}</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {orders.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="whitespace-normal py-12">
                    <div className="text-center text-sm text-app-text-muted dark:text-zinc-500">No matching orders found.</div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
      {footer ? <div className="border-t px-4 py-3">{footer}</div> : null}
    </Card>
  );
}
