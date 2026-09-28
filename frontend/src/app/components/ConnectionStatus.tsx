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
 *
 * It renders as plain coloured text. It used to be a tinted pill with a pulsing
 * dot, which made a one-word status read as a button in the toolbar and cost the
 * bar height it could not spare. The colour still carries the state (green when
 * live, orange while reconnecting, red when offline), the hover tooltip still
 * says what to do about it, and the full sentence still lives in the `aria-label`
 * — so nothing informational was dropped with the chrome.
 */

type VisibleStatus = Exclude<RealtimeStatus, 'idle'>;

interface StatusPresentation {
  label: string;
  /**
   * Text colour only — no fill, no border.
   *
   * These are the same steps the pill used, re-checked against the toolbar's own
   * fill (`--app-surface`) rather than against the tint the pill used to sit on.
   * That matters for the gray: `text-gray-500` cleared 4.47:1 on the neutral
   * tint, but on the lighter surface it drops to about 4.29:1 — under the floor
   * for a 10px label — so it steps up to `gray-600`.
   */
  text: string;
  /** Plain-language explanation shown on hover. */
  hint: string;
}

/**
 * Hover text is kept short on purpose: `Tooltip` renders it in a
 * `whitespace-nowrap` pill, so a full sentence would run off the edge of the
 * screen. The longer explanation lives in the status's `aria-label`.
 */
const STATUS_PRESENTATION: Record<VisibleStatus, StatusPresentation> = {
  live: {
    label: 'Live',
    text: 'text-green-700 dark:text-green-300',
    hint: 'Updating automatically',
  },
  connecting: {
    label: 'Connecting',
    text: 'text-gray-600 dark:text-zinc-300',
    hint: 'Starting live updates',
  },
  reconnecting: {
    label: 'Reconnecting',
    text: 'text-orange-700 dark:text-orange-300',
    hint: 'Restoring live updates',
  },
  offline: {
    label: 'Offline',
    text: 'text-red-700 dark:text-red-300',
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
  text: 'text-blue-700 dark:text-blue-300',
  hint: 'Fetching the latest data',
};

const SYNCING_DESCRIPTION =
  'Connected, and fetching the latest data now. What is on screen is still usable.';

export function ConnectionStatus({ className }: { className?: string }) {
  const { status } = useRealtimeStatus();
  const isSyncing = useIsSyncing();

  // Nothing is running before sign-in, and an "idle" label would be noise on a
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
          'inline-flex select-none items-center whitespace-nowrap text-2xs font-bold',
          presentation.text,
          className,
        )}
      >
        {presentation.label}
      </span>
    </Tooltip>
  );
}
