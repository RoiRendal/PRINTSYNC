import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../shared/components/ui';

interface SectionCardProps {
  children: React.ReactNode;
  icon: LucideIcon;
  title: string;
  description: string;
  controls?: React.ReactNode;
}

export function SectionCard({ children, icon: Icon, title, description, controls }: SectionCardProps) {
  return (
    <Card variant="elevated" padding="lg" className="overflow-hidden">
      <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          {/*
            * The section medallion, matching the dashboard's stat cards and the
            * order summary tiles: a recess punched into the panel rather than a
            * chip resting on it.
            *
            * The gradient and the ring are both gone. `bg-gradient-to-br
            * from-macos-blue/18 to-white/40` was a lit dome and
            * `ring-1 ring-macos-blue/20` was its outline — the two together are
            * the glass badge this redesign is removing, and neither survives a
            * recessed read: a tinted hole is not a hole. The blue is still here,
            * on the glyph, which is the part that carries meaning.
            *
            * `mat-well` is what keeps the recess `--app-surface`; without it the
            * engine paints its own `--amb-albedo` and the well comes out grey in
            * light and lighter than the panel in dark.
            */}
          <div className="amb-groove mat-well flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.95rem] border border-[var(--app-hairline)] text-macos-blue dark:text-macos-cyan">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
        {controls && <div className="shrink-0">{controls}</div>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
