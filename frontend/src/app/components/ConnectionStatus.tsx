import type { IconComponent } from '../../shared/components/ui/icons';
import { AlertCircle, CheckCircle2, Clock, Download, RefreshCw } from '../../shared/components/ui/icons';
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
 * The state is carried by the GLYPH, not by colour. It used to be a tinted pill
 * with a pulsing dot, then plain coloured text; both asked staff to read a hue to
 * know whether the screen was current, which is the one thing a colour-blind user
 * cannot do reliably. The label now takes the app's ordinary text colour and a
 * distinct outline glyph sits to its right, so the state reads the same to
 * everyone. The hover tooltip and the `aria-label` are unchanged.
 */

type VisibleStatus = Exclude<RealtimeStatus, 'idle'>;

interface StatusPresentation {
  label: string;
  icon: IconComponent;
  /** Plain-language explanation shown on hover. */
  hint: string;
}

/**
 * Every glyph is drawn in the same box by `ICON_CLASS` below, so swapping one
 * state for another never moves the text or resizes the toolbar. The icons are
 * also deliberately distinct in SHAPE, because shape is now the only channel
 * carrying the state: a tick, a clock, a circular arrow, a warning, a download.
 */
const ICON_CLASS = 'h-3.5 w-3.5 shrink-0';

/**
 * Hover text stays short, but no longer because it has to: `Tooltip` now wraps
 * inside a width cap and clamps itself to the viewport, so a longer sentence
 * would render correctly. It is short because a glance at a status indicator
 * wants a phrase — the full explanation still lives in the `aria-label`, where
 * it costs nothing and can be as long as it needs to be.
 */
const STATUS_PRESENTATION: Record<VisibleStatus, StatusPresentation> = {
  live: {
    label: 'Live',
    icon: CheckCircle2,
    hint: 'Updating automatically',
  },
  connecting: {
    label: 'Connecting',
    icon: Clock,
    hint: 'Starting live updates',
  },
  reconnecting: {
    label: 'Reconnecting',
    icon: RefreshCw,
    hint: 'Restoring live updates',
  },
  offline: {
    label: 'Offline',
    icon: AlertCircle,
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
  icon: Download,
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
  const StatusIcon = presentation.icon;

  return (
    <Tooltip content={presentation.hint}>
      <span
        role="status"
        aria-live="polite"
        aria-label={`Live updates: ${presentation.label}. ${description}`}
        className={cn(
          'inline-flex select-none items-center gap-1.5 whitespace-nowrap text-2xs font-bold text-app-ink dark:text-zinc-100',
          className,
        )}
      >
        {presentation.label}
        <StatusIcon className={ICON_CLASS} aria-hidden="true" />
      </span>
    </Tooltip>
  );
}
