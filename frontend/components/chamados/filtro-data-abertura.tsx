'use client';

/**
 * 295 · Grupo "Data de abertura" — o mesmo componente em Chamados › Triagem e CCO › Todos os chamados.
 * Datas: só aplica no change (date completo), com debounce; período inválido não é aplicado (lista mantém o último válido).
 * Rápidos: aplicam na hora; preenchem a Data final só como referência visual (para o servidor vai o número de dias).
 */
import { useEffect, useRef, useState } from 'react';
import { Chip } from '@/components/ui/chip';
import { cn } from '@/lib/cn';
import {
  DIAS_ABERTURA_RAPIDOS,
  type DiasAberturaRapido,
  type FiltroDataAberturaValue,
  filtroAberturaAtivo,
  MSG_PERIODO_INVERTIDO,
  periodoInvertido,
  referenciaRapido,
} from '@/lib/filtro-data-abertura';

export const DEBOUNCE_DATA_ABERTURA_MS = 400;

const INPUT =
  'h-11 w-full min-w-0 rounded-[var(--r-md)] border bg-[var(--surface)] px-3 text-[13px] text-[var(--ink)] focus:border-[var(--brand)] focus:outline-none focus:shadow-[0_0_0_3px_var(--brand-soft)] sm:h-9';

export function FiltroDataAbertura({
  value,
  onChange,
  idPrefixo = 'abertura',
  agora,
}: {
  value: FiltroDataAberturaValue;
  onChange: (next: FiltroDataAberturaValue) => void;
  idPrefixo?: string;
  /** para testes */
  agora?: () => Date;
}) {
  const [rascunho, setRascunho] = useState<{ de: string; ate: string }>({ de: value.de ?? '', ate: value.ate ?? '' });
  const timer = useRef<number | null>(null);
  // Edição manual desmarca o rápido na hora (o período manual é aplicado depois do debounce).
  const [editado, setEditado] = useState(false);
  const rapido = editado ? undefined : value.rapido;

  // Valor externo (Limpar filtros, chip) manda no rascunho.
  useEffect(() => {
    setRascunho({ de: value.de ?? '', ate: value.ate ?? '' });
    setEditado(false);
  }, [value.de, value.ate, value.rapido]);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const invalido = periodoInvertido(rascunho);
  const ajuda = rapido ? referenciaRapido(rapido, agora?.() ?? new Date()).ajuda : null;

  function editarData(campo: 'de' | 'ate', texto: string) {
    const proximo = { ...rascunho, [campo]: texto };
    setRascunho(proximo);
    setEditado(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    if (periodoInvertido(proximo)) return; // não consulta enquanto inválido
    timer.current = window.setTimeout(() => {
      timer.current = null;
      onChange({ de: proximo.de || undefined, ate: proximo.ate || undefined });
    }, DEBOUNCE_DATA_ABERTURA_MS);
  }

  function escolherRapido(n: DiasAberturaRapido | null) {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    if (n === null) {
      onChange({});
      return;
    }
    onChange({ rapido: n, ate: referenciaRapido(n, agora?.() ?? new Date()).ate });
  }

  const ativo = filtroAberturaAtivo(value) || Boolean(rascunho.de || rascunho.ate);

  return (
    <div className="min-w-0 space-y-1.5" data-testid="filtro-data-abertura">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3">
        <p id={`${idPrefixo}-titulo`} className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">
          Data de abertura
        </p>
        {ativo ? (
          <button
            type="button"
            className="inline-flex min-h-11 items-center text-[12px] font-semibold text-[var(--brand-hover)] underline-offset-2 hover:underline sm:min-h-0"
            onClick={() => escolherRapido(null)}
          >
            Limpar período
          </button>
        ) : null}
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:max-w-[420px] sm:grid-cols-2">
        {(
          [
            ['de', 'Data inicial'],
            ['ate', 'Data final'],
          ] as const
        ).map(([campo, rotulo]) => (
          <label key={campo} className="block min-w-0">
            <span className="mb-1 block text-[11px] font-semibold text-[var(--ink-3)]">{rotulo}</span>
            <input
              type="date"
              lang="pt-BR"
              data-autofocus-filtro={campo === 'de' ? '' : undefined}
              value={rascunho[campo]}
              onChange={(e) => editarData(campo, e.target.value)}
              aria-invalid={invalido || undefined}
              aria-describedby={invalido ? `${idPrefixo}-erro` : ajuda ? `${idPrefixo}-ajuda` : undefined}
              className={cn(INPUT, invalido ? 'border-[var(--danger)]' : 'border-[var(--line)]')}
            />
          </label>
        ))}
      </div>
      {invalido ? (
        <p id={`${idPrefixo}-erro`} role="alert" className="text-[12px] text-[var(--danger-ink)]">
          {MSG_PERIODO_INVERTIDO}
        </p>
      ) : null}
      <div role="group" aria-label="Tempo desde a abertura" className="flex min-w-0 flex-wrap gap-1.5">
        <Chip className="min-h-11 sm:min-h-0" active={!rapido} pressed={!rapido} onClick={() => escolherRapido(null)}>
          Todos
        </Chip>
        {DIAS_ABERTURA_RAPIDOS.map((n) => (
          <Chip key={n} className="min-h-11 sm:min-h-0" active={rapido === n} pressed={rapido === n} onClick={() => escolherRapido(n)}>
            Há mais de {n} dias
          </Chip>
        ))}
      </div>
      {ajuda && !invalido ? (
        <p id={`${idPrefixo}-ajuda`} className="text-[12px] text-[var(--ink-3)]">
          {ajuda}
        </p>
      ) : null}
    </div>
  );
}
