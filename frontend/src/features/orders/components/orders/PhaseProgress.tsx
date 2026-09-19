import { cn } from '../../../../shared/lib/cn';
import type { Order } from '../../types';

const workPhases: Order['status'][] = [
  'Pending',
  'In Production',
  'Designing',
  'Ready for Pickup',
  'Delivered',
  'Completed',
];

export { workPhases };

export function PhaseProgress({ status }: { status: Order['status'] }) {
  const activeIndex = workPhases.indexOf(status);

  return (
    <div className="flex gap-1.5">
      {workPhases.map((phase, index) => {
        const isDone = index <= activeIndex;
        return (
          <span
            key={phase}
            /*
             * A solid token, not a gradient with a glow.
             *
             * This is deliberately *not* given the groove-and-raised-fill
             * treatment the dashboard's progress bar got. That bar is a 12px
             * surface with room for a bevel; these are six 6px ticks inside a
             * table row. At this size a groove reads as mush, and six of them
             * would turn a quiet progress hint into the busiest thing in the
             * row. The brief is to reduce, so the indicator keeps its colour and
             * loses its lighting.
             *
             * The track becomes `--app-hairline` — the app's own theme-aware
             * subtle line — which replaces the `bg-black/8 dark:bg-white/10`
             * literal pair and its per-theme override.
             */
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors duration-200',
              isDone ? 'bg-macos-blue' : 'bg-[var(--app-hairline)]',
            )}
          />
        );
      })}
    </div>
  );
}
