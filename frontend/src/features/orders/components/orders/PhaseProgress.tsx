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
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors duration-200',
              isDone ? 'bg-macos-blue shadow-[0_0_10px_rgb(0_122_255/0.25)]' : 'bg-black/8 dark:bg-white/10',
            )}
          />
        );
      })}
    </div>
  );
}
