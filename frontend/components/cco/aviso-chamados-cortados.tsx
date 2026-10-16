'use client';

import { AlertTriangle } from 'lucide-react';

const numero = (n: number) => new Intl.NumberFormat('pt-BR').format(n);

/** 295 · Texto da faixa (UX §9). */
export function textoChamadosCortados(mostrados: number, total: number) {
  return `Mostrando ${numero(mostrados)} de ${numero(total)} chamados. Refine os filtros para ver todos no mapa.`;
}

/** 295 · Nota curta do mapa de calor/legenda quando o resultado foi cortado. */
export function notaMapaCortado(mostrados: number) {
  return `Mapa com os ${numero(mostrados)} primeiros`;
}

/**
 * 295 · Faixa de "resultados cortados" (CCO › Todos os chamados). Estado, não notificação: sem fechar,
 * role="status" (anuncia sem interromper) e some quando o total volta a caber.
 */
export function AvisoChamadosCortados({
  total,
  mostrados,
  onAjustar,
  espelho = false,
}: {
  total: number;
  mostrados: number;
  onAjustar?: () => void;
  /** cópia visual sobre o mapa no mobile (não é anunciada de novo) */
  espelho?: boolean;
}) {
  return (
    <div
      role={espelho ? undefined : 'status'}
      aria-hidden={espelho || undefined}
      data-testid={espelho ? 'aviso-cortados-mapa' : 'aviso-cortados'}
      className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--r-md)] border border-[var(--warn-bd)] bg-[var(--warn-bg)] px-3 py-2 text-[13px] text-[var(--warn-ink)]"
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--warn)]" aria-hidden />
      <span className="min-w-0 flex-1">{textoChamadosCortados(mostrados, total)}</span>
      {onAjustar && !espelho ? (
        <button
          type="button"
          onClick={onAjustar}
          className="inline-flex min-h-11 shrink-0 items-center font-semibold underline underline-offset-2 sm:min-h-0"
        >
          Ajustar filtros
        </button>
      ) : null}
    </div>
  );
}
