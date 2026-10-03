import { Badge, Button, SurfaceCard } from '../../../shared/components/ui';
import { formatInsightTime, type InsightState } from './analytics-types';

interface InsightPanelProps {
  state: InsightState;
  onGenerate: () => Promise<void>;
}

/**
 * The insight report is generated ON REQUEST ONLY — there is deliberately no
 * unattended-generation control here.
 *
 * The research paper (Requirement 1.4, the context diagram, the DFD and §3.4)
 * describes an *option to generate* that the admin takes as a specific action;
 * §3.4 says the system "will only call the API" when users "take specific
 * actions". A checkbox that armed a background generator was the opposite of
 * that, and — because the generating effect re-ran whenever its computed inputs
 * changed — it was an unbounded call path rather than one call per session.
 * Do not reintroduce one.
 */
export function InsightPanel({ state, onGenerate }: InsightPanelProps) {
  return (
    <SurfaceCard className="mt-4 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Button type="button" size="sm" onClick={onGenerate} isLoading={state.isLoading}>
          {state.isLoading ? 'Generating...' : 'Generate Insights'}
        </Button>
      </div>
      <p className="mt-2 text-2xs font-bold text-app-text-muted dark:text-zinc-500">Last generated: {formatInsightTime(state.lastGeneratedAt)}</p>

      {/*
        The failure is a line of text, not a replacement for the card. The chart
        and tiles behind this panel are unaffected by the AI service being down,
        so they stay — the manager loses the written interpretation and nothing
        else, and is told why.

        No hue and no glyph, matching `ErrorState`: the sentence says what
        happened, so colour and an icon would only repeat it. `role="status"`
        rather than `role="alert"` because this arrives after a deliberate click,
        not unbidden.
      */}
      {state.error && (
        <p role="status" className="mt-2 text-xs leading-relaxed text-app-ink dark:text-zinc-300">
          {state.error}
        </p>
      )}

      {state.report ? (
        <div className="mt-4 space-y-3 text-xs leading-relaxed text-app-ink dark:text-zinc-300">
          <p><span className="font-bold text-app-ink dark:text-zinc-100">Overview:</span> {state.report.overview}</p>
          <div>
            <p className="font-bold text-app-ink dark:text-zinc-100">Key Findings:</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {state.report.keyFindings.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
          <p><span className="font-bold text-app-ink dark:text-zinc-100">Risk / Watchout:</span> {state.report.riskWatchout}</p>
          <p><span className="font-bold text-app-ink dark:text-zinc-100">Recommended Action:</span> {state.report.recommendedAction}</p>
          <Badge variant="accent">Confidence {Math.max(0, Math.min(100, state.report.confidence)).toFixed(1)}%</Badge>
        </div>
      ) : (
        <p className="mt-4 text-xs text-app-text-muted dark:text-zinc-500">Generate insights to view a fixed mini-report.</p>
      )}
    </SurfaceCard>
  );
}
