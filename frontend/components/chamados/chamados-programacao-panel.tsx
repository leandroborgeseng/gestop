'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Map as MapIcon, UsersRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Select } from '@/components/ui/select';
import { ChamadosProgramacaoMap } from '@/components/chamados/chamados-programacao-map';
import { useSnackbar } from '@/components/ui/snackbar';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui-states';
import { listChamadosProgramacao, updateChamadoPlanejamento } from '@/lib/api';
import { chamadoLocalLabel } from '@/lib/chamado-geo';
import { prioridadeVariant } from '@/lib/chamado-status';
import { buildCalendarCells, monthBounds, toInputDate } from '@/lib/cronograma';
import { cn } from '@/lib/cn';
import { ChamadoProgramacaoResponse, ChamadoResumo, EquipeOpcao } from '@/lib/types';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKDAYS_FULL = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

type ViewMode = 'mensal' | 'semanal';

function chamadoTitulo(chamado: Pick<ChamadoResumo, 'titulo' | 'descricao'>) {
  return chamado.titulo?.trim() || chamado.descricao;
}

function isoDateNoon(dateKey: string) {
  return `${dateKey}T12:00:00.000Z`;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function ChamadosProgramacaoPanel({
  equipes,
  onScheduled,
}: {
  equipes: EquipeOpcao[];
  onScheduled?: () => void;
}) {
  const snackbar = useSnackbar();
  const requestSeq = useRef(0);
  const agendarFormRef = useRef<HTMLDivElement | null>(null);
  const [month, setMonth] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('mensal');
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const start = new Date(today);
    start.setDate(today.getDate() - day);
    return start;
  });
  const [equipeFilter, setEquipeFilter] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(() => toInputDate(new Date()));
  const [data, setData] = useState<ChamadoProgramacaoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formChamadoId, setFormChamadoId] = useState('');
  const [formEquipeId, setFormEquipeId] = useState('');
  const [formDate, setFormDate] = useState('');
  const [equipeDraft, setEquipeDraft] = useState<Record<string, string>>({});

  const bounds = useMemo(() => {
    if (viewMode === 'semanal') {
      const start = new Date(weekStart);
      const end = new Date(weekStart);
      end.setDate(end.getDate() + 6);
      return { start, end };
    }
    return monthBounds(month);
  }, [month, viewMode, weekStart]);
  const minDate = toInputDate(new Date());

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const response = await listChamadosProgramacao({
        from: toInputDate(bounds.start),
        to: toInputDate(bounds.end),
        equipeId: equipeFilter || undefined,
      });
      if (seq !== requestSeq.current) return;
      setData(response);
      setEquipeDraft({});
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setError(err instanceof Error ? err.message : 'Falha ao carregar programação.');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [bounds.end, bounds.start, equipeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

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

  const allChamadosMapa = useMemo(() => {
    const map = new Map<string, ChamadoResumo>();
    for (const chamado of (data?.porDia ?? []).flatMap((dia) => dia.chamados)) {
      map.set(chamado.id, chamado);
    }
    for (const chamado of data?.pendentes ?? []) {
      map.set(chamado.id, chamado);
    }
    return map;
  }, [data]);

  function handleProgramarFromMap(chamadoId: string) {
    const chamado = allChamadosMapa.get(chamadoId);
    if (!chamado) return;

    const dateKey = chamado.previstaExecucaoEm?.slice(0, 10) ?? selectedDate ?? minDate;
    setFormChamadoId(chamado.id);
    setFormDate(dateKey);
    setSelectedDate(dateKey);
    setFormEquipeId(chamado.equipe?.id ?? '');

    window.requestAnimationFrame(() => {
      agendarFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    snackbar.show(`${chamado.codigo}: preencha data e equipe para programar.`, 'success');
  }

  function renderChamadosDoDiaList(options?: { showEmpty?: boolean }) {
    if (!selectedDate) {
      return <p className="text-[12px] text-[var(--ink-3)]">Selecione um dia para ver os chamados.</p>;
    }

    if (chamadosDoDia.length === 0) {
      return options?.showEmpty ? (
        <EmptyState
          title="Nenhum chamado neste dia"
          description="Use o formulário abaixo para agendar chamados pendentes."
        />
      ) : (
        <p className="text-[12px] text-[var(--ink-3)]">Nenhum chamado programado neste dia.</p>
      );
    }

    return (
      <ul className="space-y-2">
        {chamadosDoDia.map((chamado) => {
          const currentEquipeId = chamado.equipe?.id ?? '';
          const draftEquipeId = equipeDraft[chamado.id] ?? currentEquipeId;
          const equipeChanged = draftEquipeId !== currentEquipeId;

          return (
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
                  value={draftEquipeId}
                  onChange={(event) =>
                    setEquipeDraft((current) => ({ ...current, [chamado.id]: event.target.value }))
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
                  variant="outlined"
                  size="sm"
                  disabled={busyId === chamado.id || !equipeChanged}
                  onClick={() =>
                    void saveProgramacao(
                      chamado.id,
                      chamado.codigo,
                      chamado.previstaExecucaoEm ?? null,
                      draftEquipeId || null,
                    )
                  }
                >
                  Salvar equipe
                </Button>
                <Button
                  variant="text"
                  size="sm"
                  disabled={busyId === chamado.id}
                  onClick={() => void saveProgramacao(chamado.id, chamado.codigo, null, undefined)}
                >
                  Remover data
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  async function saveProgramacao(
    chamadoId: string,
    codigo: string,
    previstaExecucaoEm: string | null,
    equipeId?: string | null,
  ) {
    setBusyId(chamadoId);
    try {
      await updateChamadoPlanejamento(chamadoId, {
        previstaExecucaoEm,
        ...(equipeId !== undefined ? { equipeId } : {}),
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

  function navigateToScheduledDate(dateKey: string) {
    const [year, monthIndex] = dateKey.split('-').map(Number);
    setMonth(new Date(year, monthIndex - 1, 1));
    setSelectedDate(dateKey);
  }

  async function handleAgendarPendente() {
    if (!formChamadoId || !formDate || !formEquipeId) {
      snackbar.show('Selecione chamado, data futura e equipe.', 'warning');
      return;
    }
    if (formDate < minDate) {
      snackbar.show('A data deve ser hoje ou uma data futura.', 'warning');
      return;
    }
    const chamado = data?.pendentes.find((item) => item.id === formChamadoId);
    if (!chamado) return;

    const scheduledMonth = formDate.slice(0, 7);
    const currentMonth = monthKey(month);

    await saveProgramacao(chamado.id, chamado.codigo, isoDateNoon(formDate), formEquipeId);
    setFormChamadoId('');

    if (scheduledMonth !== currentMonth) {
      navigateToScheduledDate(formDate);
      snackbar.show(
        `Agendado para ${new Date(`${formDate}T12:00:00`).toLocaleDateString('pt-BR')} — calendário atualizado.`,
        'success',
      );
    }
  }

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      const key = toInputDate(date);
      return { date, key, chamados: eventosPorDia.get(key) ?? [] };
    });
  }, [weekStart, eventosPorDia]);

  const weekRangeLabel = useMemo(() => {
    if (weekDays.length === 0) return '';
    return `${weekDays[0].date.toLocaleDateString('pt-BR')} – ${weekDays[6].date.toLocaleDateString('pt-BR')}`;
  }, [weekDays]);

  function formatWeeklyDayLabel(date: Date) {
    return `${WEEKDAYS_FULL[date.getDay()]} - ${date.toLocaleDateString('pt-BR')}`;
  }

  const cells = buildCalendarCells(month);
  const monthLabel = month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const pendentesLabel = data?.pendentesTruncados
    ? `${data.pendentes.length} de ${data.totalPendentes} aguardando data`
    : `${data?.totalPendentes ?? 0} aguardando data`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-2">
          <Chip active={viewMode === 'mensal'} onClick={() => setViewMode('mensal')}>
            Mensal
          </Chip>
          <Chip active={viewMode === 'semanal'} onClick={() => setViewMode('semanal')}>
            Semanal
          </Chip>
        </div>
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
        <Badge variant="warning">{pendentesLabel}</Badge>
      </div>

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {loading ? <LoadingState label="Carregando programação..." /> : null}

      {!loading ? (
        <>
          <Card elevation={1}>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <MapIcon className="h-4 w-4 text-[var(--brand)]" />
                <h3 className="text-[14px] font-semibold text-[var(--ink)]">Mapa da programação</h3>
              </div>
              <ChamadosProgramacaoMap
                programados={(data?.porDia ?? []).flatMap((dia) => dia.chamados)}
                pendentes={data?.pendentes ?? []}
                selectedId={formChamadoId || null}
                onSelect={handleProgramarFromMap}
              />
            </CardContent>
          </Card>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <Card elevation={1}>
            <CardContent className="p-4">
              {viewMode === 'mensal' ? (
              <>
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
              </>
              ) : (
                <div className="space-y-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setWeekStart((value) => {
                          const next = new Date(value);
                          next.setDate(next.getDate() - 7);
                          return next;
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-[var(--r-sm)] px-2 py-1.5 text-[13px] font-semibold text-[var(--brand)] hover:bg-[var(--surface-2)]"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Semana anterior
                    </button>
                    <h2 className="text-[15px] font-bold text-[var(--ink)]">
                      Visão semanal{weekRangeLabel ? ` · ${weekRangeLabel}` : ''}
                    </h2>
                    <button
                      type="button"
                      onClick={() =>
                        setWeekStart((value) => {
                          const next = new Date(value);
                          next.setDate(next.getDate() + 7);
                          return next;
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-[var(--r-sm)] px-2 py-1.5 text-[13px] font-semibold text-[var(--brand)] hover:bg-[var(--surface-2)]"
                    >
                      Próxima semana
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                  {weekDays.map((day) => {
                    const isSelected = selectedDate === day.key;
                    return (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => setSelectedDate(day.key)}
                        className={cn(
                          'w-full rounded-[var(--r-md)] border p-3 text-left transition-colors',
                          isSelected
                            ? 'border-[var(--brand)] bg-[var(--brand-soft)]'
                            : 'border-[var(--line)] bg-[var(--surface-2)] hover:bg-[var(--surface)]',
                        )}
                      >
                        <p className="text-[13px] font-semibold text-[var(--ink)]">{formatWeeklyDayLabel(day.date)}</p>
                        {day.chamados.length === 0 ? (
                          <p className="mt-1 text-[12px] text-[var(--ink-3)]">Nenhum chamado programado</p>
                        ) : (
                          <ul className="mt-2 space-y-1">
                            {day.chamados.map((chamado) => (
                              <li key={chamado.id} className="text-[12px] text-[var(--ink-2)]">
                                · {chamado.codigo} — {chamadoTitulo(chamado).slice(0, 60)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </button>
                    );
                  })}

                  {selectedDate && weekDays.some((day) => day.key === selectedDate) ? (
                    <div className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] p-4">
                      <h3 className="text-[14px] font-semibold text-[var(--ink)]">
                        {new Date(`${selectedDate}T12:00:00`).toLocaleDateString('pt-BR', {
                          weekday: 'long',
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </h3>
                      <p className="mt-1 text-[12px] text-[var(--ink-3)]">
                        Detalhamento dos chamados programados para o dia selecionado.
                      </p>
                      <div className="mt-3">{renderChamadosDoDiaList()}</div>
                    </div>
                  ) : null}
                </div>
              )}
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

                <div className="mt-3">{renderChamadosDoDiaList({ showEmpty: true })}</div>
              </CardContent>
            </Card>

            <div ref={agendarFormRef}>
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
        </div>
        </>
      ) : null}
    </div>
  );
}
