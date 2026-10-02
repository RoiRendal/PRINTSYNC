import type { ReactNode } from 'react';
import { Image as ImageIcon } from '../../../shared/components/ui/icons';
import { EmptyState } from '../../../shared/components/feedback/EmptyState';
import {
  Checkbox,
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
} from '../../../shared/components/ui';
import { formatSelectedCount } from '../../../shared/lib/selectionLabels';
import type { RowSelection } from '../../../shared/hooks/useRowSelection';
import type { Design } from '../types';

interface DesignTableProps {
  designs: Design[];
  /** Opens the edit modal for the row that was clicked. */
  onEdit: (design: Design) => void;
  /** Tick state, owned by the page. See `useRowSelection`. */
  selection: RowSelection;
  /** Rendered under the table — the shared pagination control. */
  footer?: ReactNode;
}

/** The number of data columns to the right of the tick column. */
const DATA_COLUMNS = 3;

/**
 * The design repository drawn as a table — the List View of the card grid.
 *
 * It is the same table every other list screen draws, down to the parts: a tick
 * column, the columns the record actually has, a clickable row and no Actions
 * column. A design is edited by clicking its row and deleted with the one delete
 * square in the toolbar, which acts on whatever is ticked — so the four per-row
 * buttons this table used to carry are gone, and with them the width they needed.
 * A staff member who has used the stock list should already know this screen.
 */
export function DesignTable({ designs, onEdit, selection, footer }: DesignTableProps) {
  return (
    <>
      {/* The list pages nest the table inside a card and cancel the container's
          own frame, so this does the same. */}
      <TableContainer className="rounded-none border-0 bg-transparent">
        <Table>
          <colgroup>
            <col style={{ width: '44px' }} />
            <col style={{ width: '340px' }} />
            <col style={{ width: '200px' }} />
            <col style={{ width: '180px' }} />
          </colgroup>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableSelectHead>
                <Checkbox
                  checked={selection.allSelected}
                  indeterminate={selection.isIndeterminate}
                  disabled={designs.length === 0}
                  onChange={selection.toggleAll}
                  aria-label="Select all designs on this page"
                />
              </TableSelectHead>
              {/*
                When rows are ticked the whole header collapses to just the
                "# items selected" message (ERPNext item-list behaviour); every
                column label disappears. colSpan 3 = all three data columns.
              */}
              {selection.count === 0 ? (
                <>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Added</TableHead>
                </>
              ) : (
                <TableHead colSpan={DATA_COLUMNS} className="font-semibold text-app-ink dark:text-zinc-100">
                  {formatSelectedCount(selection.count)}
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {designs.map((design) => (
              <TableRow key={design.id} className="cursor-pointer" onClick={() => onEdit(design)}>
                {/*
                  The tick box sits inside the row that opens the editor, so it
                  stops the click from reaching it — otherwise ticking a design
                  would also open it. Same reason as the stock table.
                */}
                <TableSelectCell onClick={(event) => event.stopPropagation()}>
                  <Checkbox
                    checked={selection.has(design.id)}
                    onChange={() => selection.toggle(design.id)}
                    aria-label={`Select ${design.name}`}
                  />
                </TableSelectCell>
                <TableCell className="text-app-ink dark:text-zinc-100" title={cellTitle('Name', design.name)}>
                  {design.name}
                </TableCell>
                <TableCell title={cellTitle('Category', design.category)}>{design.category}</TableCell>
                <TableCell className="tabular-nums text-app-text-muted dark:text-zinc-500" title={cellTitle('Added', design.createdAt)}>
                  {design.createdAt}
                </TableCell>
              </TableRow>
            ))}
            {designs.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={DATA_COLUMNS + 1} className="whitespace-normal py-14 text-center">
                  <EmptyState title="No designs found" icon={<ImageIcon className="h-8 w-8 opacity-20" aria-hidden="true" />} />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {footer ? <div className="border-t px-4 py-3">{footer}</div> : null}
    </>
  );
}
