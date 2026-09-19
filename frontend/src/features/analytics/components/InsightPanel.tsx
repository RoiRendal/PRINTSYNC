import { Brain } from 'lucide-react';
import { Badge, Button, GlassCard } from '../../../shared/components/ui';
import { cn } from '../../../shared/lib/cn';
import { formatInsightTime, type InsightState } from './analytics-types';

interface InsightPanelProps {
  state: InsightState;
  onToggleAutoGenerate: () => void;
  onGenerate: () => Promise<void>;
}

export function InsightPanel({ state, onToggleAutoGenerate, onGenerate }: InsightPanelProps) {
  return (
    <GlassCard className="mt-4 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={onToggleAutoGenerate} className="mat-focus inline-flex cursor-pointer items-center gap-2 rounded text-xs font-semibold text-macos-text dark:text-zinc-200" aria-pressed={state.autoGenerate}>
          {/*
            * The switch becomes a channel with a cap in it.
            *
            * The track cannot be tinted green in the on state any more, and it
            * is worth being precise about why: `amb-groove.mat-well` is
            * unlayered and sets `background-color`, so a Tailwind `bg-macos-green`
            * on the same element is inert — the same trap that made the groove
            * unusable for a selected chip. Rather than fight it, the colour
            * moved to the cap, which is where a real switch carries it anyway:
            * a white cap sitting in a neutral channel when off, a green one when
            * on. The position does the rest.
            *
            * The cap keeps `transition-transform`, which is one of the few
            * movements worth keeping — it is the difference between a control
            * that changed state and one that was replaced. It is a CSS
            * transition, so `prefers-reduced-motion` still governs it.
            *
            * Geometry is unchanged (`h-5 w-9` track, `p-0.5`, `h-4 w-4` cap,
            * `translate-x-4`) and was re-checked rather than assumed: the cap
            * travels from x=2..18 to x=18..34 inside a 36px track, so at the end
            * of its travel it lands exactly on the track's 2px inset, and its
            * circular cap stays inside the track's own rounded end at every
            * point. `box-sizing: border-box` means the new hairline border does
            * not grow the cap.
            */}
          <span className="amb-groove mat-well relative h-5 w-9 rounded-full p-0.5">
            <span className={cn('ambient amb-elevation-0 block h-4 w-4 rounded-full border border-[var(--app-hairline)] transition-transform', state.autoGenerate ? 'bg-macos-green' : 'bg-[var(--app-surface-raised)]')} />
          </span>
          Auto-generate insights
        </button>
        <Button type="button" size="sm" onClick={onGenerate} isLoading={state.isLoading} leftIcon={<Brain className="h-3.5 w-3.5" aria-hidden="true" />}>
          {state.isLoading ? 'Generating...' : 'Generate Insights'}
        </Button>
      </div>
      <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-macos-text-muted">Last generated: {formatInsightTime(state.lastGeneratedAt)}</p>

      {state.report ? (
        <div className="mt-4 space-y-3 text-xs leading-relaxed text-macos-text dark:text-zinc-300">
          <p><span className="font-bold text-macos-text dark:text-zinc-100">Overview:</span> {state.report.overview}</p>
          <div>
            <p className="font-bold text-macos-text dark:text-zinc-100">Key Findings:</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {state.report.keyFindings.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
          <p><span className="font-bold text-macos-text dark:text-zinc-100">Risk / Watchout:</span> {state.report.riskWatchout}</p>
          <p><span className="font-bold text-macos-text dark:text-zinc-100">Recommended Action:</span> {state.report.recommendedAction}</p>
          <Badge variant="blue">Confidence {Math.max(0, Math.min(100, state.report.confidence)).toFixed(1)}%</Badge>
        </div>
      ) : (
        <p className="mt-4 text-xs text-macos-text-muted">Generate insights to view a fixed mini-report.</p>
      )}
    </GlassCard>
  );
}
