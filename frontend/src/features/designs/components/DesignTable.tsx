import type { ReactNode } from 'react';
import { Download, Edit, Eye, Image as ImageIcon, Trash2 } from '../../../shared/components/ui/icons';
import { EmptyState } from '../../../shared/components/feedback/EmptyState';
import {
  Button,
  StatusLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  cellTitle,
} from '../../../shared/components/ui';
import type { Design } from '../types';

interface DesignTableProps {
  designs: Design[];
  onView: (design: Design) => void;
  onEdit: (design: Design) => void;
  onDelete: (design: Design) => void;
  /** Rendered under the table — the shared pagination control. */
  footer?: ReactNode;
}

/**
 * The design repository drawn as a table — the List View of the card grid.
 *
 * The four per-card actions move into the row unchanged: View and Download came
 * off the hover overlay, Edit and Delete out of the card body. Nothing about
 * them is rethought here, because a staff member who switches shape should find
 * the same four controls in the same order, just laid out horizontally.
 *
 * There is no select column, and that is deliberate rather than an omission:
 * the repository has no bulk action. Deleting a design is a single, confirmed
 * decision made against one named record, and a checkbox column that could only
 * ever hold one tick would be an affordance without a use.
 *
 * The row is not clickable either. The stock gallery's cards open their editor
 * because a card is a big target with nothing else on it; a table row already
 * carries four buttons, and making the whole row a fifth target is how people
 * open a record they meant only to select.
 */
export function DesignTable({ designs, onView, onEdit, onDelete, footer }: DesignTableProps) {
  return (
    <>
      {/* The list pages nest the table inside a card and cancel the container's
          own frame, so this does the same. */}
      <TableContainer className="rounded-none border-0 bg-transparent">
        <Table>
          <colgroup>
            <col style={{ width: '340px' }} />
            <col style={{ width: '160px' }} />
            <col style={{ width: '150px' }} />
            <col style={{ width: '150px' }} />
          </colgroup>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {designs.map((design) => (
              <TableRow key={design.id}>
                <TableCell className="text-app-ink dark:text-zinc-100" title={cellTitle('Name', design.name)}>
                  {design.name}
                </TableCell>
                <TableCell title={cellTitle('Category', design.category)}>
                  <StatusLabel tone="gray">{design.category}</StatusLabel>
                </TableCell>
                <TableCell className="tabular-nums text-app-text-muted dark:text-zinc-500" title={cellTitle('Added', design.createdAt)}>
                  {design.createdAt}
                </TableCell>
                {/*
                  The buttons are the shared `size="icon"` (28px) rather than the
                  card's `h-8 w-8` (32px), and the cell drops its own vertical
                  padding, so the ROW stays the one-line height every other list
                  table has (~33px) instead of being stretched to 45px by its own
                  controls. A table row is dense by design; the card can afford
                  the larger target because it has the room.
                */}
                <TableCell className="py-0 text-right">
                  <div className="flex justify-end gap-1">
                    <Button type="button" variant="ghost" size="icon" onClick={() => onView(design)} title="View details" aria-label={`View ${design.name}`}>
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => window.open(design.imageUrl, '_blank', 'noopener,noreferrer')}
                      title="Download design"
                      aria-label={`Download ${design.name}`}
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => onEdit(design)} title="Edit design" aria-label={`Edit ${design.name}`}>
                      <Edit className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(design)}
                      title="Delete design"
                      aria-label={`Delete ${design.name}`}
                      className="text-app-danger hover:text-app-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {designs.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="whitespace-normal py-14 text-center">
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
