'use client';

import { formatSecretariaLabel } from '@/lib/format-secretaria';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardList, ClipboardPen, FileDown, FileText, MapPin, Printer, Search, UserRound } from 'lucide-react';
import { RequirePermissions } from '@/components/auth/require-permissions';
import { useSessionUser } from '@/components/auth/session-context';
import { CabecalhoSecao } from '@/components/checklists/cabecalho-secao';
import { DocumentosRelacionadosPanel } from '@/components/documentos/documentos-relacionados-panel';
import { PageShell } from '@/components/layout/page-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Sheet } from '@/components/ui/sheet';
import { useSnackbar } from '@/components/ui/snackbar';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui-states';
import { ImprimirVistoriaManualDialog } from '@/components/vistorias/imprimir-vistoria-manual-dialog';
import { LancarVistoriaManualDialog } from '@/components/vistorias/lancar-vistoria-manual-dialog';
import {
  formatDateTime,
  NotaVistoriaDestaque,
  RespostaEvidencias,
  STATUS_BADGE,
  STATUS_OPTIONS,
  statusLabel,
  VistoriaDetalheCorpo,
} from '@/components/vistorias/vistoria-detalhe-consulta';
import { AVISO_REGISTRO_URL, detalheCobreLista } from '@/lib/estado-url';
import { useEstadoVistorias } from '@/lib/use-estado-vistorias';
import { downloadFiscalizacaoPdf, getFiscalizacao, getSecretarias, listAdminUsuarios, listFiscalizacoes } from '@/lib/api';
import { buscarRegistroPorIdDaUrl, idTemFormatoPrisma } from '@/lib/id-prisma';
import { formatRespostaValor } from '@/lib/checklist-item-opcoes';
import { cn } from '@/lib/cn';
import { formatUnidadeTipo, UNIDADE_TIPO_LABELS } from '@/lib/unidade-tipo';
import { formatNotaBr, notaCorHex } from '@/lib/vistoria-nota';
import type {
  AdminUsuario,
  FiscalizacaoDetalhe,
  FiscalizacaoResumo,
  FiscalizacaoStatus,
  SecretariaOption,
  UnidadeTipo,
} from '@/lib/types';

const PAGE_SIZE = 50;

export default function VistoriasPage() {
  return (
    <Suspense>
      <VistoriasPageContent />
    </Suspense>
  );
}

function VistoriasPageContent() {
  const sessionUser = useSessionUser();
  const snackbar = useSnackbar();
  const [pdfBusy, setPdfBusy] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const canFilterSecretaria = Boolean(
    sessionUser?.permissoes.some((permission) =>
      ['dashboard.visualizar', 'chamados.gerenciar', 'secretarias.gerenciar'].includes(permission),
    ),
  );
  const canFilterAgente = Boolean(sessionUser?.permissoes.includes('usuarios.gerenciar'));

  const [items, setItems] = useState<FiscalizacaoResumo[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { estado, definir } = useEstadoVistorias();
  const [selectedId, setSelectedId] = useState<string | null>(estado.id);
  const [detail, setDetail] = useState<FiscalizacaoDetalhe | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [questionarioOpen, setQuestionarioOpen] = useState(false);

  const search = estado.search;
  const status = estado.status;
  const tipo = estado.tipo;
  const secretariaId = estado.secretaria;
  const agenteId = estado.agente;
  const from = estado.de;
  const to = estado.ate;
  const avulsaConflito = estado.avulsa;
  const [semAcesso, setSemAcesso] = useState(false);
  const fechadoRef = useRef(false);
  const tinhaIdRef = useRef(Boolean(estado.id));

  const [secretarias, setSecretarias] = useState<SecretariaOption[]>([]);
  const [usuarios, setUsuarios] = useState<AdminUsuario[]>([]);
  const [imprimirOpen, setImprimirOpen] = useState(false);
  const [lancarOpen, setLancarOpen] = useState(false);

  const canExecutar = Boolean(sessionUser?.permissoes.includes('fiscalizacoes.executar'));

  useEffect(() => {
    if (canFilterSecretaria) {
      getSecretarias()
        .then(setSecretarias)
        .catch(() => undefined);
    }
    if (canFilterAgente) {
      listAdminUsuarios()
        .then(setUsuarios)
        .catch(() => undefined);
    }
  }, [canFilterSecretaria, canFilterAgente]);

  const filters = useMemo(
    () => ({
      q: search.trim() || undefined,
      status: status || undefined,
      tipo: tipo || undefined,
      secretariaId: secretariaId || undefined,
      agenteId: agenteId || undefined,
      from: from || undefined,
      to: to || undefined,
      avulsaPorConflito: avulsaConflito || undefined,
    }),
    [search, status, tipo, secretariaId, agenteId, from, to, avulsaConflito],
  );

  useEffect(() => {
    if (estado.id) {
      fechadoRef.current = false;
      setSelectedId(estado.id);
      setSemAcesso(!idTemFormatoPrisma(estado.id));
    } else if (tinhaIdRef.current) {
      fechadoRef.current = true;
      setSelectedId(null);
      setDetail(null);
      setSemAcesso(false);
    }
    tinhaIdRef.current = Boolean(estado.id);
  }, [estado.id]);

  useEffect(() => {
    if (!canFilterSecretaria && secretariaId) definir({ secretaria: '' });
    if (!canFilterAgente && agenteId) definir({ agente: '' });
  }, [canFilterSecretaria, canFilterAgente, secretariaId, agenteId, definir]);

  useEffect(() => {
    if (secretarias.length && secretariaId && !secretarias.some((item) => item.id === secretariaId)) definir({ secretaria: '' });
  }, [secretarias, secretariaId, definir]);

  useEffect(() => {
    if (usuarios.length && agenteId && !usuarios.some((item) => item.id === agenteId)) definir({ agente: '' });
  }, [usuarios, agenteId, definir]);

  const loadList = useCallback(async (offset = 0, append = false) => {
    if (offset === 0) setLoading(true);
    else setLoadingMore(true);
    setError(null);

    try {
      const response = await listFiscalizacoes({ ...filters, limit: PAGE_SIZE, offset });
      setItems((current) => (append ? [...current, ...response.items] : response.items));
      setTotal(response.total);
      setHasMore(response.hasMore);
      if (!append) {
        setSelectedId((current) => (fechadoRef.current ? null : (current ?? response.items[0]?.id ?? null)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar vistorias.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadList(0, false);
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }

    let active = true;
    setDetailLoading(true);
    void buscarRegistroPorIdDaUrl(selectedId, getFiscalizacao)
      .then((resultado) => {
        if (!active) return;
        if (resultado.tipo === 'formato') {
          setSemAcesso(true);
          setDetail(null);
          return;
        }
        if (resultado.tipo === 'ok') setDetail(resultado.data);
      })
      .catch((err) => {
        if (!active) return;
        const statusHttp = (err as { status?: number } | null)?.status;
        if (statusHttp === 403 || statusHttp === 404) {
          setSemAcesso(true);
          setDetail(null);
          return;
        }
        setError(err instanceof Error ? err.message : 'Falha ao carregar detalhe da vistoria.');
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedId]);

  const selected = useMemo(
    () =>
      items.find((item) => item.id === selectedId) ??
      (detail && detail.id === selectedId ? detail : null),
    [items, selectedId, detail],
  );

  return (
    <RequirePermissions permissions={['fiscalizacoes.executar', 'dashboard.visualizar', 'chamados.gerenciar']} match="any">
      <PageShell
        kicker="Consulta operacional"
        icon={ClipboardList}
        title="Vistorias realizadas"
        description="Consulte vistorias registradas no sistema com filtros por período, agente e unidade."
        backHref="/mobile"
        action={
          <div className="flex flex-wrap gap-2">
            {canExecutar ? (
              <>
                <Button variant="outlined" size="sm" onClick={() => setImprimirOpen(true)}>
                  <Printer className="mr-1.5 h-4 w-4" />
                  Imprimir vistoria manual
                </Button>
                <Button variant="tonal" size="sm" onClick={() => setLancarOpen(true)}>
                  <ClipboardPen className="mr-1.5 h-4 w-4" />
                  Lançar vistoria manual
                </Button>
              </>
            ) : null}
            <Link href="/mobile">
              <Button variant="outlined" size="sm">
                Nova vistoria
              </Button>
            </Link>
          </div>
        }
      >
        {error ? <ErrorState message={error} /> : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <section className="space-y-4">
            <Card elevation={1}>
              <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="relative sm:col-span-2 lg:col-span-3">
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--ink-3)]" />
                  <input
                    value={search}
                    onChange={(event) => definir({ search: event.target.value })}
                    placeholder="Buscar por unidade, código patrimonial, agente ou checklist…"
                    className="h-10 w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] pr-3 pl-9 text-[13px]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[var(--ink-3)]">Status</label>
                  <Select value={status} onChange={(event) => definir({ status: event.target.value as '' | FiscalizacaoStatus })} className="h-9 w-full text-xs">
                    {STATUS_OPTIONS.map((item) => (
                      <option key={item.value || 'all'} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[var(--ink-3)]" htmlFor="filtro-avulsa-conflito">
                    Avulsa por conflito
                  </label>
                  <Select
                    id="filtro-avulsa-conflito"
                    data-testid="filtro-avulsa-conflito"
                    value={avulsaConflito}
                    onChange={(event) => definir({ avulsa: event.target.value as '' | 'true' | 'false' })}
                    className="h-9 w-full text-xs"
                  >
                    <option value="">Todas</option>
                    <option value="true">Só avulsas por conflito</option>
                    <option value="false">Sem avulsas por conflito</option>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[var(--ink-3)]">Tipo de próprio</label>
                  <Select value={tipo} onChange={(event) => definir({ tipo: event.target.value as '' | UnidadeTipo })} className="h-9 w-full text-xs">
                    <option value="">Todos</option>
                    {(Object.keys(UNIDADE_TIPO_LABELS) as UnidadeTipo[]).map((item) => (
                      <option key={item} value={item}>
                        {formatUnidadeTipo(item)}
                      </option>
                    ))}
                  </Select>
                </div>
                {canFilterSecretaria ? (
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-[var(--ink-3)]">Secretaria</label>
                    <Select value={secretariaId} onChange={(event) => definir({ secretaria: event.target.value })} className="h-9 w-full text-xs">
                      <option value="">Todas</option>
                      {secretarias.map((item) => (
                        <option key={item.id} value={item.id}>
                          {formatSecretariaLabel(item)}
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : null}
                {canFilterAgente ? (
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-[var(--ink-3)]">Agente</label>
                    <Select value={agenteId} onChange={(event) => definir({ agente: event.target.value })} className="h-9 w-full text-xs">
                      <option value="">Todos</option>
                      {usuarios.filter((item) => item.ativo).map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nome}
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : null}
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[var(--ink-3)]">De</label>
                  <input type="date" value={from} onChange={(event) => definir({ de: event.target.value })} className="h-9 w-full rounded-[var(--r-md)] border border-[var(--line)] px-3 text-[13px]" />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[var(--ink-3)]">Até</label>
                  <input type="date" value={to} onChange={(event) => definir({ ate: event.target.value })} className="h-9 w-full rounded-[var(--r-md)] border border-[var(--line)] px-3 text-[13px]" />
                </div>
              </CardContent>
            </Card>

            <Card elevation={1} className="overflow-hidden">
              <div className="border-b border-[var(--line-2)] px-4 py-3 text-[12px] text-[var(--ink-3)]">
                {total} vistoria{total === 1 ? '' : 's'} encontrada{total === 1 ? '' : 's'}
              </div>
              <div className="max-h-[min(520px,70vh)] overflow-y-auto p-2">
                {loading ? (
                  <LoadingState label="Carregando vistorias..." />
                ) : items.length === 0 ? (
                  <EmptyState title="Nenhuma vistoria" description="Ajuste os filtros ou registre uma nova vistoria em campo." />
                ) : (
                  items.map((item) => {
                    const isSelected = selectedId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          fechadoRef.current = false;
                          setSemAcesso(false);
                          setSelectedId(item.id);
                          definir({ id: item.id }, detalheCobreLista() ? 'push' : 'replace');
                        }}
                        className={cn(
                          'mb-1 flex w-full flex-col gap-1.5 rounded-[var(--r-md)] border border-transparent px-3 py-3 text-left transition-colors',
                          isSelected
                            ? 'border-[color-mix(in_srgb,var(--brand)_30%,transparent)] bg-[var(--brand-soft)]'
                            : 'hover:bg-[var(--surface-2)]',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-semibold text-[var(--ink)]">{item.unidade.nome}</span>
                          <div className="flex shrink-0 items-center gap-1.5">
                            {item.nota?.notaGeral != null ? (
                              <span
                                className="inline-flex min-w-[2.25rem] items-center justify-center rounded-[var(--r-sm)] border px-1.5 py-0.5 text-[11px] font-bold tabular-nums"
                                style={{
                                  borderColor: `${notaCorHex(item.nota.notaGeral)}55`,
                                  backgroundColor: `${notaCorHex(item.nota.notaGeral)}14`,
                                  color: notaCorHex(item.nota.notaGeral),
                                }}
                                title="Nota do próprio"
                              >
                                {formatNotaBr(item.nota.notaGeral)}
                              </span>
                            ) : null}
                            <Badge variant={STATUS_BADGE[item.status]}>{statusLabel(item.status)}</Badge>
                            {item.lancamentoManual || item.origem === 'MANUAL' ? (
                              <Badge variant="info">Lançamento manual</Badge>
                            ) : null}
                            {item.avulsaPorConflito ? (
                              <span data-testid="badge-avulsa-conflito">
                                <Badge variant="warning">Avulsa por conflito</Badge>
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <p className="text-[12px] text-[var(--ink-3)]">
                          {item.unidade.codigoPatrimonial} · {item.secretaria.sigla}
                        </p>
                        <p className="text-[12px] text-[var(--ink-2)]">{item.checklistVersao.checklist.nome}</p>
                        <div className="flex flex-wrap gap-3 pt-1 text-[11px] text-[var(--ink-3)]">
                          <span className="inline-flex items-center gap-1">
                            <UserRound className="h-3 w-3" />
                            {item.realizadaPorLabel ?? item.agente.nome}
                          </span>
                          <span>{formatDateTime(item.concluidaEm ?? item.iniciadaEm)}</span>
                          <span>Origem: {item.origemLabel ?? item.origem}</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
              {hasMore ? (
                <div className="border-t border-[var(--line-2)] p-3">
                  <Button variant="outlined" size="sm" className="w-full" disabled={loadingMore} onClick={() => void loadList(items.length, true)}>
                    {loadingMore ? 'Carregando...' : 'Carregar mais'}
                  </Button>
                </div>
              ) : null}
            </Card>
          </section>

          <section className="min-h-[320px]">
            {selectedId && semAcesso ? (
              <div role="status" data-testid="aviso-registro-url" className="flex items-center justify-between gap-3 rounded-[var(--r-md)] border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-[13px] text-amber-950">{AVISO_REGISTRO_URL}</p>
                <button type="button" className="text-[13px] font-semibold text-amber-950" onClick={() => definir({ id: null })}>
                  Fechar
                </button>
              </div>
            ) : !selected ? (
              <Card elevation={1} className="flex h-full min-h-[320px] items-center justify-center p-8 text-center">
                <div>
                  <MapPin className="mx-auto h-8 w-8 text-[var(--ink-3)]" />
                  <p className="mt-3 text-[15px] font-semibold text-[var(--ink)]">Selecione uma vistoria</p>
                  <p className="mt-1 text-[13px] text-[var(--ink-3)]">Os detalhes do checklist e das respostas aparecem aqui.</p>
                </div>
              </Card>
            ) : (
              <Card elevation={1} className="h-full overflow-hidden">
                <CardContent className="flex h-full flex-col p-0">
                  <div className="border-b border-[var(--line-2)] p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Unidade</p>
                        <h2 className="mt-1 text-[17px] font-semibold text-[var(--ink)]">{selected.unidade.nome}</h2>
                        <p className="mt-1 text-[13px] text-[var(--ink-3)]">
                          {selected.unidade.codigoPatrimonial} · {selected.secretaria.sigla}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {!detailLoading && detail?.nota?.notaGeral != null ? (
                          <NotaVistoriaDestaque notaGeral={detail.nota.notaGeral} />
                        ) : null}
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            variant="outlined"
                            size="sm"
                            disabled={pdfBusy}
                            onClick={() => {
                              setPdfBusy(true);
                              void downloadFiscalizacaoPdf(selected.id)
                                .then(() => snackbar.show('PDF gerado.', 'success'))
                                .catch((err) =>
                                  snackbar.show(err instanceof Error ? err.message : 'Falha ao gerar PDF.', 'error'),
                                )
                                .finally(() => setPdfBusy(false));
                            }}
                          >
                            <FileDown className="h-3.5 w-3.5" />
                            {pdfBusy ? 'Gerando…' : 'PDF'}
                          </Button>
                          <Button
                            type="button"
                            variant="outlined"
                            size="sm"
                            onClick={() => setDocsOpen((current) => !current)}
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Documentos relacionados
                          </Button>
                          <Badge variant={STATUS_BADGE[selected.status]}>{statusLabel(selected.status)}</Badge>
                        </div>
                        {(detail ?? selected).lancamentoManual || selected.origem === 'MANUAL' ? (
                          <Badge variant="info">Lançamento manual</Badge>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 space-y-4 overflow-y-auto p-5">
                    {detailLoading ? <LoadingState label="Carregando detalhe..." /> : null}
                    {docsOpen ? (
                      <DocumentosRelacionadosPanel
                        fiscalizacaoId={selected.id}
                        onClose={() => setDocsOpen(false)}
                      />
                    ) : null}
                    <VistoriaDetalheCorpo
                      resumo={selected}
                      detail={detail}
                      detailLoading={detailLoading}
                      onExibirQuestionario={() => setQuestionarioOpen(true)}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </section>
        </div>

        <Sheet open={questionarioOpen} onClose={() => setQuestionarioOpen(false)} title="Questionário da vistoria">
          <div className="space-y-3">
            {(detail?.respostas ?? []).map((resposta, index) => (
              <div key={resposta.id}>
                <CabecalhoSecao
                  atual={resposta.item.secao}
                  anterior={index > 0 ? detail?.respostas?.[index - 1]?.item.secao : undefined}
                />
                <div className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-3">
                  <p className="text-[12px] font-semibold text-[var(--ink)]">
                    {resposta.item.titulo}
                  </p>
                  <p className="mt-1 text-[13px] text-[var(--ink-2)]">
                    {formatRespostaValor(resposta)}
                  </p>
                  {resposta.comentario ? <p className="mt-1 text-[12px] text-[var(--ink-3)]">{resposta.comentario}</p> : null}
                  <RespostaEvidencias evidencias={resposta.evidencias} altPrefix={resposta.item.titulo} />
                  {resposta.naoConformidade?.chamado ? (
                    <p className="mt-2 text-[12px]">
                      Chamado:{' '}
                      <Link href={`/chamados?search=${encodeURIComponent(resposta.naoConformidade.chamado.codigo)}`} className="font-semibold text-[var(--brand)] hover:underline">
                        {resposta.naoConformidade.chamado.codigo}
                      </Link>
                    </p>
                  ) : resposta.naoConformidade ? (
                    <p className="mt-2 text-[12px] font-medium text-[var(--warn)]">
                      {resposta.naoConformidade.status === 'BAIXADA_MANUAL'
                        ? 'NC baixada manualmente (sem chamado)'
                        : 'NC pendente sem chamado'}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Sheet>

        <ImprimirVistoriaManualDialog open={imprimirOpen} onClose={() => setImprimirOpen(false)} />
        <LancarVistoriaManualDialog
          open={lancarOpen}
          onClose={() => setLancarOpen(false)}
          onSuccess={() => void loadList(0, false)}
        />
      </PageShell>
    </RequirePermissions>
  );
}
