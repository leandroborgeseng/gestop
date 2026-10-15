'use client';

import { useEffect, useRef } from 'react';
import { Clock, MapPin, MapPinOff, User, UsersRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import { TAREFA_PRIORIDADE_LABEL, TAREFA_STATUS_LABEL, type ChamadoTarefaResumo } from '@/lib/chamado-tarefa';
import { prioridadeVariant } from '@/lib/chamado-status';
import { comportamentoRolagem } from '@/components/documentos/documento-avulso-form';
import { TAREFA_STATUS_BADGE, coordenadaTarefa, prazoTarefaInfo, resumoTipoTarefa, tarefaAriaLabel } from '@/lib/tarefa-card';

/**
 * 286: badges do card com texto em tokens *-ink (≥ 4,5:1 sobre o fundo do badge e sobre --brand-soft).
 * O Badge global não muda (decisão do 2º ciclo): warning/ok/danger são reforçados só aqui, na aba Tarefas.
 */
export const BADGE_INK = {
  ok: 'text-[var(--ok-ink)]',
  danger: 'text-[var(--danger-ink)]',
  warning: 'text-[var(--warn-ink)]',
  neutral: '',
  info: '',
} as const;

export function TarefasExecucaoList({
  tarefas,
  selectedId = null,
  destacadas = [],
  hoveredId = null,
  onOpen,
  onHover,
  rolarParaSelecionada = 0,
  hoje,
}: {
  tarefas: ChamadoTarefaResumo[];
  selectedId?: string | null;
  /** Tarefas do mesmo pin agrupado: só destacadas, sem filtrar. */
  destacadas?: string[];
  hoveredId?: string | null;
  onOpen: (id: string) => void;
  onHover?: (id: string | null) => void;
  /** Muda quando a seleção veio do pin; o card selecionado é rolado para a vista. */
  rolarParaSelecionada?: number;
  hoje?: Date;
}) {
  const refs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    if (!rolarParaSelecionada || !selectedId) return;
    const el = refs.current.get(selectedId);
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest', behavior: comportamentoRolagem(typeof window === 'undefined' ? undefined : window) });
    }
  }, [rolarParaSelecionada, selectedId]);

  return (
    <ul role="list" className="tarefas-lista m-0 list-none divide-y divide-[var(--line-2)] p-0">
      {tarefas.map((item) => {
        const selecionada = selectedId === item.id;
        const ativa = selecionada || hoveredId === item.id || destacadas.includes(item.id);
        const prazo = prazoTarefaInfo(item, hoje);
        const atrasada = item.atrasada || prazo.diasAtraso != null;
        const encerrada = item.status === 'CONCLUIDA' || item.status === 'CANCELADA';
        const coord = coordenadaTarefa(item);
        const statusVariant = TAREFA_STATUS_BADGE[item.status] ?? 'neutral';
        const prioVariant = prioridadeVariant(item.prioridade);
        const meta = ativa ? 'text-[var(--ink-2)]' : 'text-[var(--ink-3)]';
        return (
          <li key={item.id}>
            <button
              type="button"
              data-tarefa-id={item.id}
              ref={(el) => {
                if (el) refs.current.set(item.id, el);
                else refs.current.delete(item.id);
              }}
              aria-label={tarefaAriaLabel(item, hoje)}
              aria-current={selecionada ? 'true' : undefined}
              onClick={() => onOpen(item.id)}
              onMouseEnter={() => onHover?.(item.id)}
              onMouseLeave={() => onHover?.(null)}
              className={cn(
                'ch-row block min-h-11 w-full bg-[var(--surface)] px-3.5 py-3 text-left transition-colors hover:bg-[var(--surface-2)]',
                'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--brand)]',
                ativa && 'bg-[var(--brand-soft)] hover:bg-[var(--brand-soft)]',
                selecionada && 'is-selected shadow-[inset_3px_0_0_var(--brand)]',
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="unit-code mono text-[11px] font-semibold text-[var(--brand-hover)]">{item.chamado.codigo}</span>
                <span className={cn('text-[10.5px] font-bold tracking-[.06em] uppercase', meta)}>Tarefa do chamado</span>
              </span>
              <span
                title={item.titulo}
                className={cn(
                  'tarefa-titulo mt-1 line-clamp-2 block text-[15px] font-bold',
                  item.status === 'CONCLUIDA' && 'text-[var(--ink-2)]',
                  item.status === 'CANCELADA' && 'text-[var(--ink-3)] line-through',
                  !encerrada && 'text-[var(--ink)]',
                )}
              >
                {item.titulo}
              </span>
              <span title={resumoTipoTarefa(item)} className="tarefa-resumo mt-0.5 block truncate text-[12.5px] text-[var(--ink-2)]">
                {resumoTipoTarefa(item)}
              </span>
              <span className="tarefa-tags mt-2 flex flex-wrap items-center gap-1.5">
                <Badge variant={statusVariant} className={BADGE_INK[statusVariant]}>
                  {TAREFA_STATUS_LABEL[item.status] ?? item.status}
                </Badge>
                <Badge variant={prioVariant} className={BADGE_INK[prioVariant]}>
                  {TAREFA_PRIORIDADE_LABEL[item.prioridade] ?? item.prioridade}
                </Badge>
                {atrasada && !encerrada ? (
                  <Badge variant="danger" className={BADGE_INK.danger}>
                    ⚠ Atrasada
                  </Badge>
                ) : null}
                {coord ? null : (
                  <span className={cn('inline-flex items-center gap-1 text-[11px]', meta)}>
                    <MapPinOff className="h-3 w-3" aria-hidden />
                    Sem localização
                  </span>
                )}
                {coord?.origem === 'chamado' ? (
                  <span className={cn('inline-flex items-center gap-1 text-[11px]', meta)}>
                    <MapPin className="h-3 w-3" aria-hidden />
                    Local do chamado
                  </span>
                ) : null}
              </span>
              <span
                className={cn(
                  'tarefa-prazo mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold',
                  prazo.tom === 'danger' && (ativa ? 'text-[var(--danger-ink)]' : 'text-[var(--danger)]'),
                  prazo.tom === 'warning' && 'text-[var(--warn-ink)]',
                  prazo.tom === 'success' && 'text-[var(--ok-ink)]',
                  prazo.tom === 'neutral' && meta,
                )}
              >
                <Clock className="h-3 w-3" aria-hidden />
                {prazo.texto}
              </span>
              <span className={cn('unit-meta mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]', meta)}>
                <span title={item.secretaria?.nome}>{item.secretaria?.sigla ?? 'Sem Secretaria'}</span>
                <span className="inline-flex items-center gap-1">
                  <UsersRound className="h-3 w-3" aria-hidden />
                  {item.equipe ? item.equipe.nome : <em>Sem equipe</em>}
                </span>
                <span className="inline-flex items-center gap-1">
                  <User className="h-3 w-3" aria-hidden />
                  {item.responsavel ? item.responsavel.nome : <em>Sem responsável</em>}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
