import { UnidadeSituacao } from '@/lib/types';
import { cn } from '@/lib/cn';

const statusConfig: Record<
  UnidadeSituacao,
  { label: string; role: 'ok' | 'warn' | 'muted' | 'off' }
> = {
  OPERACIONAL: { label: 'Operacional', role: 'ok' },
  COM_PENDENCIAS: { label: 'Com pendências', role: 'warn' },
  SEM_LOCALIZACAO: { label: 'Sem localização', role: 'muted' },
  INATIVA: { label: 'Inativa', role: 'off' },
};

const roleStyles = {
  ok: 'bg-[var(--ok-bg)] text-[var(--ok)]',
  warn: 'bg-[var(--warn-bg)] text-[var(--warn)]',
  muted: 'bg-[var(--muted-bg)] text-[var(--muted)]',
  off: 'bg-[#eef1f5] text-[var(--off)]',
} as const;

const dotStyles = {
  ok: 'bg-[var(--ok)]',
  warn: 'bg-[var(--warn)]',
  muted: 'bg-[var(--muted)]',
  off: 'bg-[var(--off)]',
} as const;

export function StatusBadge({
  situacao,
  size = 'md',
  className,
}: {
  situacao: UnidadeSituacao;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const config = statusConfig[situacao];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[var(--r-pill)] font-semibold whitespace-nowrap',
        size === 'md' ? 'px-2.5 py-0.5 text-xs' : 'px-2 py-0.5 text-[11px]',
        roleStyles[config.role],
        className,
      )}
    >
      <span className={cn('h-[7px] w-[7px] shrink-0 rounded-full', dotStyles[config.role])} aria-hidden />
      {config.label}
    </span>
  );
}

export function situacaoRailColor(situacao: UnidadeSituacao) {
  const map: Record<UnidadeSituacao, string> = {
    OPERACIONAL: 'var(--ok)',
    COM_PENDENCIAS: 'var(--warn)',
    SEM_LOCALIZACAO: 'var(--muted)',
    INATIVA: 'var(--off)',
  };
  return map[situacao];
}
