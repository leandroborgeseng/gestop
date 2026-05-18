import { cn } from '@/lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('md-shimmer rounded-[var(--md-shape-md)]', className)}
      aria-hidden
    />
  );
}

export function MetricSkeleton() {
  return (
    <div className="rounded-[var(--md-shape-lg)] border border-[var(--md-outline-variant)] bg-[var(--md-surface)] p-5 md-elevation-1">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-4 h-9 w-16" />
      <Skeleton className="mt-2 h-3 w-32" />
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="rounded-[var(--md-shape-lg)] border border-[var(--md-outline-variant)] bg-[var(--md-surface)] p-4"
        >
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="mt-3 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6 py-2">
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricSkeleton />
        <MetricSkeleton />
        <MetricSkeleton />
        <MetricSkeleton />
      </div>
      <Skeleton className="h-[420px] w-full" />
    </div>
  );
}
