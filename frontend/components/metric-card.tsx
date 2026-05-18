import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/cn';

export function MetricCard({
  title,
  value,
  hint,
  icon: Icon,
  className,
}: {
  title: string;
  value: number;
  hint: string;
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <Card className={cn('transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md', className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-zinc-500">{title}</p>
            <strong className="mt-3 block text-3xl font-semibold tracking-tight text-zinc-950">{value}</strong>
            <p className="mt-1 text-xs leading-5 text-zinc-400">{hint}</p>
          </div>
          <span className="rounded-2xl bg-blue-50 p-3 text-blue-600 ring-1 ring-blue-600/10">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
