import { useRealtimeStatus } from '../hooks/useRealtimeStatus';
import { useIsSyncing } from '../hooks/useIsSyncing';
import type { RealtimeStatus } from '../../shared/realtime/eventStream';
import { Tooltip } from '../../shared/components/ui';
import { cn } from '../../shared/lib/cn';

/**
 * Whether this workstation is receiving live updates.
 *
 * Exists because the app now refreshes itself, and staff have no other way to
 * tell "this screen is current" from "this screen stopped updating ten minutes
 * ago". Without it, the first symptom of a dropped stream is someone making a
 * decision on stale stock — which is precisely the problem the live channel was
 * built to remove.
 *
 * The wording is deliberately non-technical: "Live", not "SSE connected".
 */

type VisibleStatus = Exclude<RealtimeStatus, 'idle'>;

interface StatusPresentation {
  label: string;
  /** Solid dot colour. */
  dot: string;
  /** Chip border + background + text. */
  chip: string;
  /** Whether the dot should pulse. */
  pulse: boolean;
  /** Plain-language explanation shown on hover. */
  hint: string;
}

/**
 * Hover text is kept short on purpose: `Tooltip` renders it in a
 * `whitespace-nowrap` pill, so a full sentence would run off the edge of the
 * screen. The longer explanation lives in the chip's `aria-label`.
 */
const STATUS_PRESENTATION: Record<VisibleStatus, StatusPresentation> = {
  live: {
    label: 'Live',
    dot: 'bg-macos-green',
    chip: 'border-[var(--app-border-hairline)] bg-[var(--app-tint-green)] text-green-700 dark:text-green-300',
    pulse: true,
    hint: 'Updating automatically',
  },
  connecting: {
    label: 'Connecting',
    dot: 'bg-macos-gray',
    /* Gray tint rather than neutral: `text-gray-500` measures 4.47:1 on the
       neutral tint — just under the floor — and the dark text has to take the
       same step up the gray badge already took, because zinc-400 is only
       4.23:1 on this fill. */
    chip: 'border-[var(--app-border-hairline)] bg-[var(--app-tint-gray)] text-gray-500 dark:text-zinc-300',
    pulse: true,
    hint: 'Starting live updates',
  },
  reconnecting: {
    label: 'Reconnecting',
    dot: 'bg-macos-orange',
    chip: 'border-[var(--app-border-hairline)] bg-[var(--app-tint-orange)] text-orange-700 dark:text-orange-300',
    pulse: true,
    hint: 'Restoring live updates',
  },
  offline: {
    label: 'Offline',
    dot: 'bg-macos-red',
    chip: 'border-[var(--app-border-hairline)] bg-[var(--app-tint-red)] text-red-700 dark:text-red-300',
    pulse: false,
    hint: 'May be out of date',
  },
};

/** Spoken by screen readers, where a full sentence costs nothing. */
const STATUS_DESCRIPTION: Record<VisibleStatus, string> = {
  live: 'Connected. Changes made by other staff appear here on their own.',
  connecting: 'Setting up live updates. This takes a moment after signing in.',
  reconnecting:
    'The connection dropped and is being restored. This screen may be a little behind until it reconnects.',
  offline:
    'No connection. Changes made on other devices will not appear here until this screen is back online.',
};

/**
 * Shown in place of `live` while a background refresh is taking a noticeable
 * amount of time.
 *
 * Being connected and being current are different claims, and the app can be
 * one without the other: the stream can be perfectly healthy while a slow fetch
 * leaves the numbers on screen a moment out of date. This is the only place a
 * staff member can see that difference, so it is worth the extra state.
 */
const SYNCING_PRESENTATION: StatusPresentation = {
  label: 'Syncing',
  dot: 'bg-macos-blue',
  chip: 'border-[var(--app-border-hairline)] bg-[var(--app-tint-blue)] text-blue-700 dark:text-blue-300',
  pulse: true,
  hint: 'Fetching the latest data',
};

const SYNCING_DESCRIPTION =
  'Connected, and fetching the latest data now. What is on screen is still usable.';

export function ConnectionStatus({ className }: { className?: string }) {
  const { status } = useRealtimeStatus();
  const isSyncing = useIsSyncing();

  // Nothing is running before sign-in, and an "idle" chip would be noise on a
  // login screen.
  if (status === 'idle') return null;

  const syncing = status === 'live' && isSyncing;
  const presentation = syncing ? SYNCING_PRESENTATION : STATUS_PRESENTATION[status];
  const description = syncing ? SYNCING_DESCRIPTION : STATUS_DESCRIPTION[status];

  return (
    <Tooltip content={presentation.hint}>
      <span
        role="status"
        aria-live="polite"
        aria-label={`Live updates: ${presentation.label}. ${description}`}
        className={cn(
          'inline-flex select-none items-center gap-1.5 rounded-[var(--radius-pill)] border px-2.5 py-1 text-2xs font-bold',
          presentation.chip,
          className,
        )}
      >
        <span
          aria-hidden="true"
          className={cn('h-1.5 w-1.5 shrink-0 rounded-full', presentation.dot, presentation.pulse && '')}
        />
        {presentation.label}
      </span>
    </Tooltip>
  );
}
