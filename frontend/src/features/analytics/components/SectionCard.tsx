import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../shared/components/ui';

/**
 * A titled section of the analytics page: heading, one-line description, optional
 * controls on the right, then the body.
 *
 * No icon. The heading used to lead with a ringed badge holding a Lucide glyph,
 * and the ring around it was the only thing giving the badge a shape — so the
 * glyph and its frame were one ornament, not two. Neither carried meaning the
 * title did not already state, and both pushed the heading off the card's own
 * left edge. Same rule the number cards follow: a card carries its figure, not
 * decoration.
 */
interface SectionCardProps {
  children: React.ReactNode;
  title: string;
  description: string;
  controls?: React.ReactNode;
}

export function SectionCard({ children, title, description, controls }: SectionCardProps) {
  return (
    <Card padding="lg" className="overflow-hidden">
      <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {controls && <div className="shrink-0">{controls}</div>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
