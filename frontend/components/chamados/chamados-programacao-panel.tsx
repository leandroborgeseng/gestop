'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, UsersRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { useSnackbar } from '@/components/ui/snackbar';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui-states';
import { listChamadosProgramacao, updateChamadoPlanejamento } from '@/lib/api';
import { chamadoLocalLabel } from '@/lib/chamado-geo';
import { prioridadeVariant } from '@/lib/chamado-status';
import { buildCalendarCells, monthBounds, toInputDate } from '@/lib/cronograma';
import { cn } from '@/lib/cn';
import { ChamadoProgramacaoResponse, ChamadoResumo, EquipeOpcao } from '@/lib/types';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function chamadoTitulo(chamado: Pick<ChamadoResumo, 'titulo' | 'descricao'>) {
  return chamado.titulo?.trim() || chamado.descricao;
}

function isoDateNoon(dateKey: string) {
  return `${dateKey}T12:00:00.000Z`;
}

export function ChamadosProgramacaoPanel({
  equipes,
  onScheduled,
}: {
  equipes: EquipeOpcao[];
  onScheduled?: () => void;
}) {
  const snackbar = useSnackbar();
  const [month, setMonth] = useState(() => new Date());
  const [equipeFilter, setEquipeFilter] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(() => toInputDate(new Date()));
  const [data, setData] = useState<ChamadoProgramacaoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formChamadoId, setFormChamadoId] = useState('');
  const [formEquipeId, setFormEquipeId] = useState('');
  const [formDate, setFormDate] = useState('');

  const bounds = useMemo(() => monthBounds(month), [month]);
  const minDate = toInputDate(new Date());

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await listChamadosProgramacao({
        from: toInputDate(bounds.start),
        to: toInputDate(bounds.end),
        equipeId: equipeFilter || undefined,
      });
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar programação.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [month, equipeFilter]);

  useEffect(() => {
    if (selectedDate) setFormDate(selectedDate);
  }, [selectedDate]);

  const eventosPorDia = useMemo(() => {
    const map = new Map<string, ChamadoResumo[]>();
    for (const dia of data?.porDia ?? []) {
      map.set(dia.data, dia.chamados);
    }
    return map;
  }, [data]);

  const chamadosDoDia = selectedDate ? (eventosPorDia.get(selectedDate) ?? []) : [];

  async function saveProgramacao(
    chamadoId: string,
    codigo: string,
    previstaExecucaoEm: string | null,
    equipeId: string | null,
  ) {
    setBusyId(chamadoId);
    try {
      await updateChamadoPlanejamento(chamadoId, {
        previstaExecucaoEm,
        equipeId: equipeId || null,
      });
      await load();
      onScheduled?.();
      snackbar.show(`${codigo}: programação atualizada`, 'success');
    } catch (err) {
      snackbar.show(err instanceof Error ? err.message : 'Falha ao programar chamado.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleAgendarPendente() {
    if (!formChamadoId || !formDate || !formEquipeId) {
      snackbar.show('Selecione chamado, data futura e equipe.', 'warning');
      return;
    }
    const chamado = data?.pendentes.find((item) => item.id === formChamadoId);
    if (!chamado) return;
    await saveProgramacao(chamado.id, chamado.codigo, isoDateNoon(formDate), formEquipeId);
    setFormChamadoId('');
  }

  const cells = buildCalendarCells(month);
  const monthLabel = month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <label htmlFor="prog-equipe" className="mb-1 block text-[11px] font-semibold text-[var(--ink-3)]">
            Filtrar por equipe
          </label>
          <Select
            id="prog-equipe"
            value={equipeFilter}
            onChange={(event) => setEquipeFilter(event.target.value)}
            className="h-9 w-full max-w-md text-xs"
          >
            <option value="">Todas as equipes</option>
            {equipes.map((equipe) => (
              <option key={equipe.id} value={equipe.id}>
                {equipe.nome}
                {equipe.secretaria?.sigla ? ` · ${equipe.secretaria.sigla}` : ''}
              </option>
            ))}
            <option value="sem-equipe">Sem equipe atribuída</option>
          </Select>
        </div>
        <Badge variant="neutral">{data?.totalProgramados ?? 0} programados no mês</Badge>
        <Badge variant="warning">{data?.pendentes.length ?? 0} aguardando data</Badge>
      </div>

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {loading ? <LoadingState label="Carregando programação..." /> : null}

      {!loading ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <Card elevation={1}>
            <CardContent className="p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))}
                  className="inline-flex items-center gap-1 rounded-[var(--r-sm)] px-2 py-1.5 text-[13px] font-semibold text-[var(--brand)] hover:bg-[var(--surface-2)]"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </button>
                <h2 className="flex items-center gap-2 text-[15px] font-bold capitalize text-[var(--ink)]">
                  <CalendarDays className="h-4 w-4 text-[var(--brand)]" />
                  {monthLabel}
                </h2>
                <button
                  type="button"
                  onClick={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))}
                  className="inline-flex items-center gap-1 rounded-[var(--r-sm)] px-2 py-1.5 text-[13px] font-semibold text-[var(--brand)] hover:bg-[var(--surface-2)]"
                >
                  Próximo
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {WEEKDAYS.map((day) => (
                  <div key={day} className="py-1 text-center text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">
                    {day}
                  </div>
                ))}
                {cells.map((cell) => {
                  if (!cell.date) {
                    return <div key={cell.key} className="min-h-20 rounded-[var(--r-sm)] bg-transparent" />;
                  }
                  const dateKey = toInputDate(cell.date);
                  const eventos = eventosPorDia.get(dateKey) ?? [];
                  const isSelected = selectedDate === dateKey;
                  const isToday = dateKey === minDate;
                  const isPast = dateKey < minDate;

                  return (
                    <button
                      key={cell.key}
                      type="button"
                      onClick={() => setSelectedDate(dateKey)}
                      className={cn(
                        'min-h-20 rounded-[var(--r-sm)] border p-2 text-left transition-colors',
                        isSelected
                          ? 'border-[var(--brand)] bg-[var(--brand-soft)]'
                          : 'border-[var(--line)] bg-[var(--surface-2)] hover:bg-[var(--surface)]',
                        isPast && !isSelected && 'opacity-60',
                      )}
                    >
                      <span
                        className={cn(
                          'inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold',
                          isToday && 'bg-[var(--brand)] text-white',
                          !isToday && 'text-[var(--ink)]',
                        )}
                      >
                        {cell.date.getDate()}
                      </span>
                      {eventos.length > 0 ? (
                        <div className="mt-1 space-y-0.5">
                          <span className="block text-[10px] font-semibold text-[var(--brand-hover)]">
                            {eventos.length} chamado{eventos.length > 1 ? 's' : ''}
                          </span>
                          {eventos.slice(0, 2).map((chamado) => (
                            <span key={chamado.id} className="block truncate text-[10px] text-[var(--ink-3)]">
                              {chamado.codigo}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card elevation={1}>
              <CardContent className="p-4">
                <h3 className="text-[14px] font-semibold text-[var(--ink)]">
                  {selectedDate
                    ? new Date(`${selectedDate}T12:00:00`).toLocaleDateString('pt-BR', {
                        weekday: 'long',
                        day: '2-digit',
                        month: 'long',
                      })
                    : 'Selecione um dia'}
                </h3>
                <p className="mt-1 text-[12px] text-[var(--ink-3)]">
                  Chamados programados para execução nesta data.
                </p>

                {selectedDate && chamadosDoDia.length === 0 ? (
                  <EmptyState
                    title="Nenhum chamado neste dia"
                    description="Use o formulário abaixo para agendar chamados pendentes."
                  />
                ) : null}

                <ul className="mt-3 space-y-2">
                  {chamadosDoDia.map((chamado) => (
                    <li
                      key={chamado.id}
                      className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="mono text-[11px] font-semibold text-[var(--brand-hover)]">{chamado.codigo}</p>
                          <p className="mt-0.5 line-clamp-2 text-[13px] font-semibold text-[var(--ink)]">
                            {chamadoTitulo(chamado)}
                          </p>
                          <p className="mt-1 truncate text-[11px] text-[var(--ink-3)]">{chamadoLocalLabel(chamado)}</p>
                        </div>
                        <Badge variant={prioridadeVariant(chamado.prioridade)}>{chamado.prioridade}</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[var(--ink-3)]">
                        <UsersRound className="h-3.5 w-3.5" />
                        {chamado.equipe?.nome ?? 'Sem equipe'}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Select
                          value={chamado.equipe?.id ?? ''}
                          onChange={(event) =>
                            void saveProgramacao(
                              chamado.id,
                              chamado.codigo,
                              chamado.previstaExecucaoEm ?? null,
                              event.target.value || null,
                            )
                          }
                          className="h-8 min-w-[140px] flex-1 text-xs"
                          disabled={busyId === chamado.id}
                        >
                          <option value="">Sem equipe</option>
                          {equipes.map((equipe) => (
                            <option key={equipe.id} value={equipe.id}>
                              {equipe.nome}
                            </option>
                          ))}
                        </Select>
                        <Button
                          variant="text"
                          size="sm"
                          disabled={busyId === chamado.id}
                          onClick={() => void saveProgramacao(chamado.id, chamado.codigo, null, chamado.equipe?.id ?? null)}
                        >
                          Remover data
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card elevation={1}>
              <CardContent className="space-y-3 p-4">
                <h3 className="text-[14px] font-semibold text-[var(--ink)]">Agendar chamado</h3>
                <p className="text-[12px] text-[var(--ink-3)]">
                  Selecione um chamado pendente, a data de execução (futura) e a equipe responsável.
                </p>
                <Select
                  value={formChamadoId}
                  onChange={(event) => setFormChamadoId(event.target.value)}
                  className="h-9 w-full text-xs"
                >
                  <option value="">Chamado pendente de programação</option>
                  {(data?.pendentes ?? []).map((chamado) => (
                    <option key={chamado.id} value={chamado.id}>
                      {chamado.codigo} — {chamadoTitulo(chamado).slice(0, 48)}
                    </option>
                  ))}
                </Select>
                <input
                  type="date"
                  min={minDate}
                  value={formDate}
                  onChange={(event) => setFormDate(event.target.value)}
                  className="h-9 w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-3 text-[13px] focus:border-[var(--brand)] focus:outline-none focus:shadow-[0_0_0_3px_var(--brand-soft)]"
                />
                <Select
                  value={formEquipeId}
                  onChange={(event) => setFormEquipeId(event.target.value)}
                  className="h-9 w-full text-xs"
                >
                  <option value="">Equipe de execução</option>
                  {equipes.map((equipe) => (
                    <option key={equipe.id} value={equipe.id}>
                      {equipe.nome}
                      {equipe.secretaria?.sigla ? ` · ${equipe.secretaria.sigla}` : ''}
                    </option>
                  ))}
                </Select>
                <Button
                  variant="filled"
                  size="sm"
                  className="w-full"
                  disabled={!formChamadoId || !formDate || !formEquipeId || busyId !== null}
                  onClick={() => void handleAgendarPendente()}
                >
                  Programar execução
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}
