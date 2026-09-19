import { Brain } from 'lucide-react';
import { Badge, Button, SurfaceCard } from '../../../shared/components/ui';
import { cn } from '../../../shared/lib/cn';
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
        <button type="button" onClick={onToggleAutoGenerate} className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-macos-text dark:text-zinc-200" aria-pressed={state.autoGenerate}>
          <span className={cn('relative h-5 w-9 rounded-full p-0.5 transition-colors', state.autoGenerate ? 'bg-macos-green' : 'bg-[#d9d9d9] dark:bg-[#525254]')}>
            <span className={cn('block h-4 w-4 rounded-full bg-white ring-1 ring-black/20 transition-transform', state.autoGenerate && 'translate-x-4')} />
          </span>
          Auto-generate insights
        </button>
        <Button type="button" size="sm" onClick={onGenerate} isLoading={state.isLoading} leftIcon={<Brain className="h-3.5 w-3.5" aria-hidden="true" />}>
          {state.isLoading ? 'Generating...' : 'Generate Insights'}
        </Button>
      </div>
      <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-macos-text-muted dark:text-zinc-500">Last generated: {formatInsightTime(state.lastGeneratedAt)}</p>

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
        <p className="mt-4 text-xs text-macos-text-muted dark:text-zinc-500">Generate insights to view a fixed mini-report.</p>
      )}
    </SurfaceCard>
  );
}
