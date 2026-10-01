import { Skeleton } from '../ui';
import { cn } from '../../lib/cn';

/**
 * The page-body placeholder: a title bar over a short row of cards, then a
 * second title bar over a taller grid.
 *
 * That shape is ERPNext's, lifted from
 * `frappe/public/js/frappe/ui/workspace_loading_skeleton.html` — two
 * `widget-group`s, each a heading plus a three-column body — and the two block
 * heights are its own numbers, from `desktop.scss`:
 * `.workspace-skeleton .shortcut-widget-box { height: 60px }` and
 * `.links-widget-box { height: 200px }`. Copying the silhouette is the point: the
 * skeleton is only convincing if the real content lands where the blocks were.
 *
 * It renders inside whatever container it is given, so the same component serves
 * both places a page can be missing — the lazy-route fallback and the session
 * restore, where the shell around it is already drawn. It deliberately draws no
 * sidebar or header of its own; those belong to `Layout`, and a second copy here
 * would be a second thing to keep in step with the real shell.
 *
 * `aria-busy` is the contract `Skeleton` documents: the blocks themselves are
 * hidden from assistive tech, and the region says "wait" instead.
 */
export function PageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-6', className)} role="status" aria-busy="true" aria-label="Loading page">
      <PageSkeletonGroup blocks={3} blockClassName="h-[60px]" />
      <PageSkeletonGroup blocks={5} blockClassName="h-[200px]" />
    </div>
  );
}

function PageSkeletonGroup({ blocks, blockClassName }: { blocks: number; blockClassName: string }) {
  return (
    <div className="space-y-3">
      {/* ERPNext's `.widget-group-title` is a 200x15 bar — a heading's worth of
          line, not a heading. */}
      <Skeleton className="h-[15px] w-[200px]" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: blocks }, (_, index) => (
          <Skeleton key={index} className={blockClassName} />
        ))}
      </div>
    </div>
  );
}
