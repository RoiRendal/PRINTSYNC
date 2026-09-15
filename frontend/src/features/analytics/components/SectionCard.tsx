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
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.95rem] bg-gradient-to-br from-macos-blue/18 to-white/40 text-macos-blue shadow-[var(--shadow-card)] ring-1 ring-macos-blue/20 dark:from-macos-blue-dark/20 dark:to-white/5 dark:text-macos-cyan">
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
