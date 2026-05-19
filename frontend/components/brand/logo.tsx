import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/cn';

type LogoVariant = 'full' | 'compact' | 'mark';
type LogoTheme = 'default' | 'light';

const INSTITUTIONAL_LOGO = {
  src: '/prefeitura-franca-logo.png',
  width: 751,
  height: 377,
} as const;

const variantStyles: Record<LogoVariant, string> = {
  full: 'h-10 w-auto max-w-[220px]',
  compact: 'h-8 w-auto max-w-[180px]',
  mark: 'h-10 w-10 object-cover object-left',
};

export function Logo({
  variant = 'full',
  theme = 'default',
  href,
  className,
  priority = false,
}: {
  variant?: LogoVariant;
  theme?: LogoTheme;
  href?: string;
  className?: string;
  priority?: boolean;
}) {
  const image = (
    <Image
      src={INSTITUTIONAL_LOGO.src}
      alt="Prefeitura de Franca"
      width={INSTITUTIONAL_LOGO.width}
      height={INSTITUTIONAL_LOGO.height}
      priority={priority}
      className={cn(
        'shrink-0 object-contain',
        theme === 'default' && 'brightness-0',
        variantStyles[variant],
        className,
      )}
    />
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex shrink-0 items-center" aria-label="Ir para início">
        {image}
      </Link>
    );
  }

  return image;
}

export function ProductLabel({ className }: { className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-brand-primary)]">GestOP</p>
      <p className="text-[11px] text-[var(--color-text-secondary)]">Central Operacional</p>
    </div>
  );
}
