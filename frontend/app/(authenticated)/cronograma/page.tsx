'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CalendarDays, CalendarClock, CheckCircle2, Clock, Plus } from 'lucide-react';
import { RequirePermissions } from '@/components/auth/require-permissions';
import { ChecagemCalendario, EventoChecagemCard } from '@/components/cronograma/checagem-calendario';
import { PageShell } from '@/components/layout/page-shell';
import { TipBanner } from '@/components/help/tip-banner';
import { MetricCard } from '@/components/metric-card';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Fab } from '@/components/ui/fab';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Sheet } from '@/components/ui/sheet';
import { ErrorState, LoadingState } from '@/components/ui-states';
import { checklistAppliesToUnidade } from '@/lib/checklist-matching';
import { getStoredAuth, deactivateCronograma, getCalendarioChecagens, getSecretarias, getUnidades, listChecklists, listCronogramas, saveCronograma } from '@/lib/api';
import { CRONOGRAMA_FREQUENCIAS, CRONOGRAMA_FREQUENCIA_LABELS, monthBounds, toInputDate } from '@/lib/cronograma';
import { formatUnidadeTipo } from '@/lib/unidade-tipo';
import {
  CalendarioChecagemResponse,
  ChecklistModel,
  CronogramaChecagem,
  CronogramaFrequencia,
  SecretariaOption,
  UnidadeOperacional,
} from '@/lib/types';

export default function CronogramaPage() {
  const [month, setMonth] = useState(() => new Date());
  const [secretariaId, setSecretariaId] = useState('');
  const [unidadeId, setUnidadeId] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [secretarias, setSecretarias] = useState<SecretariaOption[]>([]);
  const [unidades, setUnidades] = useState<UnidadeOperacional[]>([]);
  const [checklists, setChecklists] = useState<ChecklistModel[]>([]);
  const [cronogramas, setCronogramas] = useState<CronogramaChecagem[]>([]);
  const [calendario, setCalendario] = useState<CalendarioChecagemResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CronogramaChecagem | null>(null);
  const [formUnidadeId, setFormUnidadeId] = useState('');
  const canManage = useMemo(
    () => getStoredAuth()?.user.permissoes.includes('checklists.gerenciar') ?? false,
    [],
  );

  const bounds = useMemo(() => monthBounds(month), [month]);

  async function loadStatic() {
    const [nextSecretarias, nextChecklists] = await Promise.all([getSecretarias(), listChecklists()]);
    setSecretarias(nextSecretarias);
    setChecklists(nextChecklists.filter((item) => item.ativo));
  }

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const filters = {
        secretariaId: secretariaId || undefined,
        unidadeId: unidadeId || undefined,
      };

      const [nextUnidades, nextCronogramas, nextCalendario] = await Promise.all([
        getUnidades(filters),
        listCronogramas(filters),
        getCalendarioChecagens({
          from: toInputDate(bounds.start),
          to: toInputDate(bounds.end),
          ...filters,
        }),
      ]);

      setUnidades(nextUnidades);
      setCronogramas(nextCronogramas);
      setCalendario(nextCalendario);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar cronograma.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatic().catch((err) => {
      setError(err instanceof Error ? err.message : 'Falha ao carregar dados base.');
    });
  }, []);

  useEffect(() => {
    void loadData();
  }, [month, secretariaId, unidadeId]);

  const eventosPorDia = useMemo(() => {
    const map = new Map<string, CalendarioChecagemResponse['eventos']>();
    for (const evento of calendario?.eventos ?? []) {
      const current = map.get(evento.data) ?? [];
      current.push(evento);
      map.set(evento.data, current);
    }
    return map;
  }, [calendario]);

  const eventosSelecionados = selectedDate ? (eventosPorDia.get(selectedDate) ?? []) : [];

  const formUnidade = useMemo(
    () => unidades.find((unidade) => unidade.id === formUnidadeId) ?? null,
    [formUnidadeId, unidades],
  );

  const checklistsDisponiveis = useMemo(() => {
    if (!formUnidade) return [];
    return checklists.filter((checklist) =>
      checklistAppliesToUnidade(checklist, {
        id: formUnidade.id,
        tipo: formUnidade.tipo,
        secretaria: { id: formUnidade.secretaria.id },
      }),
    );
  }, [checklists, formUnidade]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      unidadeId: String(form.get('unidadeId')),
      checklistId: String(form.get('checklistId')),
      frequencia: String(form.get('frequencia')) as CronogramaFrequencia,
      proximaChecagemEm: String(form.get('proximaChecagemEm')),
      observacoes: String(form.get('observacoes') || ''),
      ativo: true,
    };

    try {
      await saveCronograma(payload, editing?.id);
      setSuccess(editing ? 'Cronograma atualizado.' : 'Cronograma cadastrado.');
      setFormOpen(false);
      setEditing(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o cronograma.');
    }
  }

  function openCreate() {
    setEditing(null);
    setFormUnidadeId(unidadeId);
    setFormOpen(true);
  }

  function openEdit(item: CronogramaChecagem) {
    setEditing(item);
    setFormUnidadeId(item.unidadeId);
    setFormOpen(true);
  }

  return (
    <RequirePermissions permissions={['dashboard.visualizar']}>
      <PageShell
        kicker="Fiscalização programada"
        icon={CalendarDays}
        title="Cronograma de checagens"
        description="Defina a periodicidade de vistoria por próprio e acompanhe o calendário de checagens realizadas, agendadas e atrasadas."
        backHref="/cco"
      >
        <TipBanner id="cronograma-checagens">
          Cadastre a periodicidade por próprio + checklist. Após cada fiscalização em campo, a próxima data avança automaticamente.
        </TipBanner>

        {error ? (
          <div className="mb-4">
            <ErrorState message={error} onRetry={() => void loadData()} />
          </div>
        ) : null}
        {success ? (
          <Alert variant="success" className="mb-4">
            {success}
          </Alert>
        ) : null}

        <Card elevation={1} className="mb-6">
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Refine o calendário e a lista de cronogramas cadastrados.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Secretaria">
              <Select value={secretariaId} onChange={(event) => setSecretariaId(event.target.value)}>
                <option value="">Todas</option>
                {secretarias.map((secretaria) => (
                  <option key={secretaria.id} value={secretaria.id}>
                    {secretaria.sigla} — {secretaria.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Próprio">
              <Select value={unidadeId} onChange={(event) => setUnidadeId(event.target.value)}>
                <option value="">Todos</option>
                {unidades.map((unidade) => (
                  <option key={unidade.id} value={unidade.id}>
                    {unidade.nome}
                  </option>
                ))}
              </Select>
            </Field>
          </CardContent>
        </Card>

        {loading ? <LoadingState label="Carregando calendário..." /> : null}

        {!loading && calendario ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard title="Total no mês" value={calendario.resumo.total} hint="eventos" icon={CalendarDays} />
                <MetricCard title="Agendadas" value={calendario.resumo.agendadas} hint="pendentes" icon={CalendarClock} />
                <MetricCard title="Realizadas" value={calendario.resumo.realizadas} hint="concluídas" icon={CheckCircle2} />
                <MetricCard
                  title="Atrasadas"
                  value={calendario.resumo.atrasadas}
                  hint="requer ação"
                  icon={Clock}
                  deltaTone={calendario.resumo.atrasadas > 0 ? 'warn' : undefined}
                />
              </div>

              <ChecagemCalendario
                month={month}
                eventosPorDia={eventosPorDia}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                onPrevMonth={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                onNextMonth={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
              />

              <Card elevation={1}>
                <CardHeader>
                  <CardTitle>Cronogramas cadastrados</CardTitle>
                  <CardDescription>Uma regra por próprio + checklist. A próxima data avança automaticamente após a vistoria em campo.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {cronogramas.length === 0 ? (
                    <p className="py-6 text-center text-[13px] text-[var(--ink-3)]">
                      Nenhum cronograma cadastrado para os filtros atuais.
                    </p>
                  ) : null}
                  {cronogramas.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col gap-3 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-4 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div>
                        <h3 className="text-[14px] font-semibold text-[var(--ink)]">{item.unidade.nome}</h3>
                        <p className="mt-1 text-[13px] text-[var(--ink-3)]">
                          {item.checklist.nome} · {CRONOGRAMA_FREQUENCIA_LABELS[item.frequencia]} ·{' '}
                          {formatUnidadeTipo(item.unidade.tipo)}
                        </p>
                        <p className="mt-1 text-[13px] text-[var(--ink-3)]">
                          Próxima: {new Date(item.proximaChecagemEm).toLocaleDateString('pt-BR')}
                          {item.ultimaChecagemEm
                            ? ` · Última: ${new Date(item.ultimaChecagemEm).toLocaleDateString('pt-BR')}`
                            : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="tonal" size="sm" onClick={() => openEdit(item)}>
                          Editar
                        </Button>
                        {item.ativo ? (
                          <Button
                            variant="text"
                            size="sm"
                            className="text-red-700"
                            onClick={() =>
                              void deactivateCronograma(item.id)
                                .then(() => {
                                  setSuccess('Cronograma inativado.');
                                  return loadData();
                                })
                                .catch((err) =>
                                  setError(err instanceof Error ? err.message : 'Falha ao inativar cronograma.'),
                                )
                            }
                          >
                            Inativar
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card elevation={1} className="h-fit">
              <CardHeader>
                <CardTitle>{selectedDate ? `Dia ${selectedDate.split('-').reverse().join('/')}` : 'Selecione um dia'}</CardTitle>
                <CardDescription>
                  {selectedDate
                    ? `${eventosSelecionados.length} evento(s) neste dia.`
                    : 'Clique em um dia do calendário para ver detalhes.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {!selectedDate ? (
                  <p className="text-[13px] text-[var(--ink-3)]">
                    O calendário combina checagens programadas (cronograma) e fiscalizações já concluídas em campo.
                  </p>
                ) : null}
                {eventosSelecionados.map((evento) => (
                  <EventoChecagemCard key={evento.id} evento={evento} />
                ))}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {canManage ? (
          <>
            <Fab extended aria-label="Novo cronograma" onClick={openCreate}>
              <Plus className="h-6 w-6" />
              Cronograma
            </Fab>

            <Sheet
              open={formOpen}
              onClose={() => {
                setFormOpen(false);
                setEditing(null);
              }}
              title={editing ? 'Editar cronograma' : 'Novo cronograma de checagem'}
            >
              <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
                <Field label="Próprio público">
                  <Select
                    name="unidadeId"
                    required
                    value={formUnidadeId}
                    onChange={(event) => setFormUnidadeId(event.target.value)}
                  >
                    <option value="">Selecione</option>
                    {unidades.map((unidade) => (
                      <option key={unidade.id} value={unidade.id}>
                        {unidade.nome} · {formatUnidadeTipo(unidade.tipo)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Checklist">
                  <Select
                    name="checklistId"
                    required
                    defaultValue={editing?.checklistId ?? ''}
                    disabled={!formUnidade}
                  >
                    <option value="">{formUnidade ? 'Selecione' : 'Selecione um próprio primeiro'}</option>
                    {checklistsDisponiveis.map((checklist) => (
                      <option key={checklist.id} value={checklist.id}>
                        {checklist.nome}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Frequência">
                  <Select name="frequencia" required defaultValue={editing?.frequencia ?? 'MENSAL'}>
                    {CRONOGRAMA_FREQUENCIAS.map((frequencia) => (
                      <option key={frequencia} value={frequencia}>
                        {CRONOGRAMA_FREQUENCIA_LABELS[frequencia]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Próxima checagem">
                  <Input
                    name="proximaChecagemEm"
                    type="date"
                    required
                    defaultValue={
                      editing ? toInputDate(new Date(editing.proximaChecagemEm)) : toInputDate(new Date())
                    }
                  />
                </Field>
                <Field label="Observações">
                  <Input name="observacoes" defaultValue={editing?.observacoes ?? ''} />
                </Field>
                <Button type="submit" variant="filled" className="w-full">
                  {editing ? 'Salvar alterações' : 'Cadastrar cronograma'}
                </Button>
              </form>
            </Sheet>
          </>
        ) : null}
      </PageShell>
    </RequirePermissions>
  );
}
