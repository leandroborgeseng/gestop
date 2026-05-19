import { cn } from '@/lib/cn';

const elevations = {
  0: 'shadow-none',
  1: 'md-elevation-1',
  2: 'md-elevation-2',
  3: 'md-elevation-3',
  4: 'md-elevation-4',
} as const;

const tones = {
  lowest: 'bg-[var(--md-surface-container-lowest)]',
  low: 'bg-[var(--md-surface-container-low)]',
  default: 'bg-[var(--md-surface)]',
  high: 'bg-[var(--md-surface-container-high)]',
  highest: 'bg-[var(--md-surface-container-highest)]',
} as const;

export function Surface({
  elevation = 1,
  tone = 'default',
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  elevation?: keyof typeof elevations;
  tone?: keyof typeof tones;
}) {
  return (
    <div
      className={cn(
        'rounded-[var(--md-shape-lg)] border border-[var(--md-outline-variant)]',
        tones[tone],
        elevations[elevation],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
