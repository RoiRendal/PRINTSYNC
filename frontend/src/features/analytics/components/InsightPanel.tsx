import { Brain } from '../../../shared/components/ui/icons';
import { Badge, Button, Checkbox, SurfaceCard } from '../../../shared/components/ui';
import { formatInsightTime, type InsightState } from './analytics-types';

interface InsightPanelProps {
  state: InsightState;
  onToggleAutoGenerate: () => void;
  onGenerate: () => Promise<void>;
}

export function InsightPanel({ state, onToggleAutoGenerate, onGenerate }: InsightPanelProps) {
  return (
    <SurfaceCard className="mt-4 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/*
          A checkbox, not a switch — and not a second copy of the one that used
          to live in Settings. The two were byte-identical apart from the label,
          which is the same drift `SegmentedControl`'s doc-comment describes for
          the five hand-rolled radio groups it replaced.
        */}
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-app-ink dark:text-zinc-200">
          <Checkbox checked={state.autoGenerate} onChange={onToggleAutoGenerate} />
          Auto-generate insights
        </label>
        <Button type="button" size="sm" onClick={onGenerate} isLoading={state.isLoading} leftIcon={<Brain className="h-3.5 w-3.5" aria-hidden="true" />}>
          {state.isLoading ? 'Generating...' : 'Generate Insights'}
        </Button>
      </div>
      <p className="mt-2 text-2xs font-bold text-app-text-muted dark:text-zinc-500">Last generated: {formatInsightTime(state.lastGeneratedAt)}</p>

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
