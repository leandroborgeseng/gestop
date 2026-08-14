'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Map as MapIcon, MapPinned, Navigation, UserCheck } from 'lucide-react';
import { ChamadosExecucaoMap } from '@/components/chamados/chamados-execucao-map';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Sheet } from '@/components/ui/sheet';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui-states';
import { listVistoriasProgramadas } from '@/lib/api';
import { cn } from '@/lib/cn';
import { CRONOGRAMA_FREQUENCIA_LABELS, monthBounds, toInputDate } from '@/lib/cronograma';
import { openMapsRoute } from '@/lib/maps-route';
import { formatUnidadeTipo } from '@/lib/unidade-tipo';
import { ChamadoMapPoint, MobileFieldPackage, VistoriaProgramadaItem } from '@/lib/types';

type MobilePanel = 'mapa' | 'lista';

function todayKey() {
  return toInputDate(new Date());
}

function situacaoMeta(item: VistoriaProgramadaItem) {
  if (item.tipo === 'ATRASADA') {
    return { label: 'Atrasada', badge: 'danger' as const };
  }
  if (item.tipo === 'REALIZADA') {
    return { label: 'Realizada', badge: 'success' as const };
  }
  if (item.data === todayKey()) {
    return { label: 'Hoje', badge: 'warning' as const };
  }
  return { label: 'Agendada', badge: 'info' as const };
}

export function VistoriasProgramadasPanel({
  fieldPackage,
  onIniciar,
}: {
  fieldPackage: MobileFieldPackage | null;
  onIniciar: (item: VistoriaProgramadaItem) => void;
}) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [atribuidoAMim, setAtribuidoAMim] = useState(false);
  const [tipo, setTipo] = useState('');
  const [unidadeId, setUnidadeId] = useState('');
  const [items, setItems] = useState<VistoriaProgramadaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('lista');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [confirmItem, setConfirmItem] = useState<VistoriaProgramadaItem | null>(null);

  const tipoOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const unidade of fieldPackage?.unidades ?? []) {
      if (!seen.has(unidade.tipo)) {
        seen.set(unidade.tipo, formatUnidadeTipo(unidade.tipo));
      }
    }
    for (const item of items) {
      if (!seen.has(item.unidade.tipo)) {
        seen.set(item.unidade.tipo, formatUnidadeTipo(item.unidade.tipo));
      }
    }
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [fieldPackage, items]);

  const unidadeOptions = useMemo(() => {
    const source = fieldPackage?.unidades ?? [];
    return source
      .filter((unidade) => !tipo || unidade.tipo === tipo)
      .map((unidade) => ({
        value: unidade.id,
        label: fieldPackage?.secretariaEscopo?.todas
          ? `${unidade.secretaria.sigla} · ${unidade.nome}`
          : unidade.nome,
      }));
  }, [fieldPackage, tipo]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listVistoriasProgramadas({
      from: from || undefined,
      to: to || undefined,
      atribuidoAMim: atribuidoAMim || undefined,
      tipo: tipo || undefined,
      unidadeId: unidadeId || undefined,
    })
      .then((response) => {
        setItems(response.items);
        setSelectedId((current) => current && response.items.some((item) => item.id === current) ? current : null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Falha ao carregar vistorias programadas.'))
      .finally(() => setLoading(false));
  }, [from, to, atribuidoAMim, tipo, unidadeId]);

  useEffect(() => {
    const handle = window.setTimeout(() => load(), 150);
    return () => window.clearTimeout(handle);
  }, [load]);

  useEffect(() => {
    if (unidadeId && !unidadeOptions.some((option) => option.value === unidadeId)) {
      setUnidadeId('');
    }
  }, [unidadeId, unidadeOptions]);

  const mapPoints = useMemo<ChamadoMapPoint[]>(
    () =>
      items
        .filter((item) => item.unidade.latitude != null && item.unidade.longitude != null)
        .map((item) => ({
          id: item.id,
          codigo: item.unidade.secretaria.sigla,
          titulo: item.unidade.nome,
          latitude: item.unidade.latitude as number,
          longitude: item.unidade.longitude as number,
          unidadeNome: item.checklist.nome,
          prioridade: item.tipo === 'ATRASADA' ? 'URGENTE' : item.data === todayKey() ? 'ALTA' : 'MEDIA',
          previstaExecucaoEm: `${item.data}T12:00:00`,
          programado: true,
          equipeNome: item.responsaveis.map((pessoa) => pessoa.nome).join(', ') || null,
        })),
    [items],
  );

  function applyHoje() {
    const today = todayKey();
    setFrom(today);
    setTo(today);
  }

  function applyEsteMes() {
    const { start, end } = monthBounds(new Date());
    setFrom(toInputDate(start));
    setTo(toInputDate(end));
  }

  function openItem(id: string) {
    const match = items.find((item) => item.id === id);
    if (!match) return;
    setSelectedId(id);
    setConfirmItem(match);
  }

  return (
    <div className="space-y-3 pb-28">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Data inicial" className="min-w-[140px] flex-1 sm:flex-none">
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="h-9 w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px]"
          />
        </Field>
        <Field label="Data final" className="min-w-[140px] flex-1 sm:flex-none">
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="h-9 w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px]"
          />
        </Field>
        <Chip active={Boolean(from && to && from === to && from === todayKey())} onClick={applyHoje}>
          Hoje
        </Chip>
        <Chip
          active={(() => {
            const { start, end } = monthBounds(new Date());
            return from === toInputDate(start) && to === toInputDate(end);
          })()}
          onClick={applyEsteMes}
        >
          Este mês
        </Chip>
        <Chip active={atribuidoAMim} onClick={() => setAtribuidoAMim((value) => !value)}>
          <span className="inline-flex items-center gap-1.5">
            <UserCheck className="h-3.5 w-3.5" />
            Atribuído a mim
          </span>
        </Chip>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Tipo de próprio">
          <Select
            value={tipo}
            onChange={(event) => {
              setTipo(event.target.value);
              setUnidadeId('');
            }}
          >
            <option value="">Todos</option>
            {tipoOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Próprio público">
          <SearchableSelect
            value={unidadeId}
            placeholder="Todos"
            onChange={setUnidadeId}
            options={[{ value: '', label: 'Todos' }, ...unidadeOptions]}
          />
        </Field>
      </div>

      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {loading ? <LoadingState label="Carregando vistorias programadas..." /> : null}

      {!loading && items.length === 0 ? (
        <EmptyState
          title="Nenhuma vistoria programada"
          description="Não há vistorias previstas no período e nos filtros selecionados."
        />
      ) : null}

      {!loading && items.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="brand">{items.length} programada{items.length === 1 ? '' : 's'}</Badge>
            <Badge variant="neutral">{mapPoints.length} no mapa</Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:hidden">
            <Chip active={mobilePanel === 'mapa'} onClick={() => setMobilePanel('mapa')}>
              <span className="inline-flex items-center gap-1.5">
                <MapIcon className="h-3.5 w-3.5" />
                Mapa
              </span>
            </Chip>
            <Chip active={mobilePanel === 'lista'} onClick={() => setMobilePanel('lista')}>
              <span className="inline-flex items-center gap-1.5">
                <MapPinned className="h-3.5 w-3.5" />
                Lista
              </span>
            </Chip>
          </div>

          <div className="cco-workspace grid min-h-0 gap-3 xl:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] xl:items-stretch">
            <section
              className={cn(
                'flex max-h-[min(420px,48vh)] min-h-[220px] flex-col overflow-hidden rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--sh-sm)] xl:h-[min(640px,calc(100dvh-280px))] xl:max-h-[min(640px,calc(100dvh-280px))]',
                mobilePanel === 'lista' ? 'flex' : 'hidden xl:flex',
              )}
            >
              <div className="shrink-0 border-b border-[var(--line-2)] px-3.5 py-3">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-[var(--brand)]" />
                  <span className="text-[13px] font-semibold text-[var(--ink)]">Vistorias programadas</span>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
                {items.map((item) => {
                  const meta = situacaoMeta(item);
                  const isSelected = selectedId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openItem(item.id)}
                      onMouseEnter={() => setHoveredId(item.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      className={cn(
                        'mb-0.5 flex w-full flex-col gap-1 rounded-[var(--r-md)] border border-transparent px-3 py-2.5 text-left transition-colors',
                        item.tipo === 'ATRASADA' && 'bg-[var(--danger-bg)]/40',
                        item.data === todayKey() && item.tipo !== 'ATRASADA' && 'bg-[var(--warn-bg)]/50',
                        isSelected
                          ? 'border-[color-mix(in_srgb,var(--brand)_30%,transparent)] bg-[var(--brand-soft)]'
                          : 'hover:bg-[var(--surface-2)]',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-semibold text-[var(--ink)]">{item.unidade.nome}</span>
                        <Badge variant={meta.badge}>{meta.label}</Badge>
                      </div>
                      <p className="text-[12px] text-[var(--ink-3)]">
                        {item.unidade.endereco}
                        {item.unidade.bairro ? ` · ${item.unidade.bairro}` : ''}
                      </p>
                      <p className="text-[12px] text-[var(--ink-2)]">
                        {item.checklist.nome} · {CRONOGRAMA_FREQUENCIA_LABELS[item.frequencia]}
                      </p>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--ink-3)]">
                        <span>
                          {new Date(`${item.data}T12:00:00`).toLocaleDateString('pt-BR')} · {item.unidade.secretaria.sigla}
                        </span>
                        <span className="truncate">
                          {item.responsaveis.length
                            ? item.responsaveis.map((pessoa) => pessoa.nome).join(', ')
                            : 'Sem responsável'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <div
              className={cn(
                'cco-map-host flex min-h-[280px] min-w-0 flex-col overflow-hidden xl:h-[min(640px,calc(100dvh-280px))]',
                mobilePanel === 'mapa' ? 'flex' : 'hidden xl:flex',
              )}
            >
              <section className="cco-map-panel min-h-0 flex-1 overflow-hidden">
                <ChamadosExecucaoMap
                  pontos={mapPoints}
                  selectedId={selectedId}
                  hoveredId={hoveredId}
                  onSelect={openItem}
                  onHover={setHoveredId}
                  popupActionLabel="Iniciar vistoria"
                  popupActionKind="modal"
                />
              </section>
            </div>
          </div>
        </>
      ) : null}

      <Sheet
        open={Boolean(confirmItem)}
        onClose={() => setConfirmItem(null)}
        title="Confirmar presença"
        footer={
          confirmItem ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outlined"
                onClick={() =>
                  openMapsRoute(
                    confirmItem.unidade.latitude ?? 0,
                    confirmItem.unidade.longitude ?? 0,
                    confirmItem.unidade.endereco,
                  )
                }
              >
                <Navigation className="mr-1.5 h-4 w-4" />
                Obter rota
              </Button>
              <Button
                type="button"
                variant="filled"
                onClick={() => {
                  const item = confirmItem;
                  setConfirmItem(null);
                  onIniciar(item);
                }}
              >
                Confirmar presença
              </Button>
            </div>
          ) : null
        }
      >
        {confirmItem ? (
          <div className="space-y-3">
            <p className="text-[16px] font-semibold text-[var(--ink)]">{confirmItem.unidade.nome}</p>
            <p className="text-[13px] text-[var(--ink-3)]">
              {confirmItem.unidade.endereco}
              {confirmItem.unidade.bairro ? ` · ${confirmItem.unidade.bairro}` : ''}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Info label="Checklist programado" value={confirmItem.checklist.nome} />
              <Info
                label="Data prevista"
                value={new Date(`${confirmItem.data}T12:00:00`).toLocaleDateString('pt-BR')}
              />
              <Info label="Periodicidade" value={CRONOGRAMA_FREQUENCIA_LABELS[confirmItem.frequencia]} />
              <Info label="Secretaria" value={confirmItem.unidade.secretaria.sigla} />
            </div>
            <Info
              label="Responsáveis previstos"
              value={
                confirmItem.responsaveis.length
                  ? confirmItem.responsaveis.map((pessoa) => pessoa.nome).join(', ')
                  : 'Não informado'
              }
            />
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--r-md)] bg-[var(--muted-bg)] px-3 py-2">
      <p className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">{label}</p>
      <p className="mt-0.5 text-[13px] text-[var(--ink)]">{value}</p>
    </div>
  );
}
