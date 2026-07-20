'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Chip } from '@/components/ui/chip';
import { Select } from '@/components/ui/select';
import { TipoChamadoSelect } from '@/components/chamados/tipo-chamado-select';
import { cn } from '@/lib/cn';
import { SlaFilter, summarizeChamadoFiltros } from '@/lib/chamado-filtros';
import { ChamadoStatus, EquipeOpcao, SecretariaOption, TipoChamadoOpcao } from '@/lib/types';
import { CHAMADO_STATUS_META } from '@/lib/chamado-status';

type PrioridadeFilter = 'TODAS' | string;

const PRIORIDADE_CHIPS: Array<{ value: PrioridadeFilter; label: string }> = [
  { value: 'TODAS', label: 'Todas' },
  { value: 'BAIXA', label: 'Baixa' },
  { value: 'MEDIA', label: 'Média' },
  { value: 'ALTA', label: 'Alta' },
  { value: 'URGENTE', label: 'Urgente' },
];

const SLA_CHIPS: Array<{ value: SlaFilter; label: string }> = [
  { value: 'TODOS', label: 'Todos' },
  { value: 'DENTRO', label: 'Dentro do prazo' },
  { value: 'FORA', label: 'Fora do prazo' },
  { value: 'SEM', label: 'Sem SLA' },
];

const STATUS_CHIPS: Array<{ value: 'TODOS' | ChamadoStatus; label: string }> = [
  { value: 'TODOS', label: 'Todos' },
  ...Object.entries(CHAMADO_STATUS_META).map(([value, meta]) => ({
    value: value as ChamadoStatus,
    label: meta.label,
  })),
];

export type ChamadosFiltrosValue = {
  statuses: Set<ChamadoStatus> | 'TODOS';
  prioridade: PrioridadeFilter;
  sla: SlaFilter;
  equipeId: string;
  secretariaProprioId: string;
  secretariaExecucaoId: string;
  tipoChamadoId: string;
};

export function ChamadosFiltrosPanel({
  value,
  onChange,
  statusCounts,
  equipes,
  tiposChamado,
  secretariasProprio,
  secretariasExecucao,
  showSemSla = true,
  className,
}: {
  value: ChamadosFiltrosValue;
  onChange: (next: ChamadosFiltrosValue) => void;
  statusCounts: Record<string, number>;
  equipes: EquipeOpcao[];
  tiposChamado: TipoChamadoOpcao[];
  secretariasProprio: SecretariaOption[];
  secretariasExecucao: SecretariaOption[];
  showSemSla?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = () => setOpen(!mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const selectedStatuses = value.statuses === 'TODOS' ? null : value.statuses;
  const statusTodos = selectedStatuses == null;
  const statusCount = selectedStatuses ? selectedStatuses.size : 0;

  const summary = useMemo(() => {
    const equipe =
      value.equipeId === 'sem-equipe'
        ? 'Sem equipe'
        : equipes.find((item) => item.id === value.equipeId)?.nome;
    return summarizeChamadoFiltros({
      statusTodos,
      statusCount,
      prioridade: value.prioridade,
      sla: value.sla,
      equipe: value.equipeId,
      secretariaProprio: value.secretariaProprioId,
      secretariaExecucao: value.secretariaExecucaoId,
      tipoChamado: value.tipoChamadoId,
      tipoNome: tiposChamado.find((item) => item.id === value.tipoChamadoId)?.nome,
      equipeNome: equipe,
      secretariaProprioNome: secretariasProprio.find((item) => item.id === value.secretariaProprioId)?.sigla,
      secretariaExecucaoNome: secretariasExecucao.find((item) => item.id === value.secretariaExecucaoId)?.sigla,
    });
  }, [
    equipes,
    secretariasExecucao,
    secretariasProprio,
    statusCount,
    statusTodos,
    tiposChamado,
    value.equipeId,
    value.prioridade,
    value.secretariaExecucaoId,
    value.secretariaProprioId,
    value.sla,
    value.tipoChamadoId,
  ]);

  function toggleStatus(next: 'TODOS' | ChamadoStatus) {
    if (next === 'TODOS') {
      onChange({ ...value, statuses: 'TODOS' });
      return;
    }
    const current = value.statuses === 'TODOS' ? new Set<ChamadoStatus>() : new Set(value.statuses);
    if (current.has(next)) current.delete(next);
    else current.add(next);
    onChange({ ...value, statuses: current.size === 0 ? 'TODOS' : current });
  }

  const slaChips = showSemSla ? SLA_CHIPS : SLA_CHIPS.filter((item) => item.value !== 'SEM');

  return (
    <div className={cn('rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)]', className)}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[var(--ink)]">Filtros de chamados</p>
          {!open ? <p className="mt-0.5 truncate text-[11px] text-[var(--ink-3)]">{summary}</p> : null}
        </div>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-[var(--ink-3)] transition-transform', open ? 'rotate-180' : '')}
        />
      </button>

      {open ? (
        <div className="space-y-4 border-t border-[var(--line-2)] px-3.5 py-3.5">
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Status</p>
            <div className="situ-chips flex flex-wrap gap-1.5">
              {STATUS_CHIPS.map((item) => {
                const active =
                  item.value === 'TODOS'
                    ? statusTodos
                    : Boolean(selectedStatuses?.has(item.value));
                return (
                  <Chip
                    key={item.value}
                    active={active}
                    count={statusCounts[item.value] ?? 0}
                    onClick={() => toggleStatus(item.value)}
                  >
                    {item.label}
                  </Chip>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Prioridade</p>
            <div className="flex flex-wrap gap-1.5">
              {PRIORIDADE_CHIPS.map((item) => (
                <Chip
                  key={item.value}
                  active={value.prioridade === item.value}
                  onClick={() => onChange({ ...value, prioridade: item.value })}
                >
                  {item.label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Prazo SLA</p>
            <div className="flex flex-wrap gap-1.5">
              {slaChips.map((item) => (
                <Chip
                  key={item.value}
                  active={value.sla === item.value}
                  onClick={() => onChange({ ...value, sla: item.value })}
                >
                  {item.label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="mb-1 text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Equipe</p>
              <Select
                value={value.equipeId}
                onChange={(event) => onChange({ ...value, equipeId: event.target.value })}
                className="h-8 w-full text-xs"
                aria-label="Filtrar por equipe"
              >
                <option value="">Todas as equipes</option>
                {equipes.map((equipe) => (
                  <option key={equipe.id} value={equipe.id}>
                    {equipe.nome}
                    {equipe.secretaria?.sigla ? ` · ${equipe.secretaria.sigla}` : ''}
                  </option>
                ))}
                <option value="sem-equipe">Sem equipe</option>
              </Select>
            </div>

            <div>
              <p className="mb-1 text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">
                Secretaria responsável pelo próprio
              </p>
              <Select
                value={value.secretariaProprioId}
                onChange={(event) => onChange({ ...value, secretariaProprioId: event.target.value })}
                className="h-8 w-full text-xs"
                aria-label="Secretaria responsável pelo próprio"
              >
                <option value="">Todas</option>
                {secretariasProprio.map((secretaria) => (
                  <option key={secretaria.id} value={secretaria.id}>
                    {secretaria.sigla} — {secretaria.nome}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <p className="mb-1 text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">
                Secretaria responsável pelo chamado
              </p>
              <Select
                value={value.secretariaExecucaoId}
                onChange={(event) => onChange({ ...value, secretariaExecucaoId: event.target.value })}
                className="h-8 w-full text-xs"
                aria-label="Secretaria responsável pelo chamado"
              >
                <option value="">Todas</option>
                {secretariasExecucao.map((secretaria) => (
                  <option key={secretaria.id} value={secretaria.id}>
                    {secretaria.sigla} — {secretaria.nome}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <p className="mb-1 text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Tipo de chamado</p>
              <TipoChamadoSelect
                value={value.tipoChamadoId}
                onChange={(tipoChamadoId) => onChange({ ...value, tipoChamadoId })}
                tipos={tiposChamado}
                allowEmpty
                emptyOptionLabel="Todos os tipos"
                searchable
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
