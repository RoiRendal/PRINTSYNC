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
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.95rem] bg-[var(--app-surface-sub)] text-macos-blue ring-1 ring-[var(--app-border-hairline)] dark:text-macos-cyan">
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
