'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Copy, FileText, Search } from 'lucide-react';
import { RequirePermissions } from '@/components/auth/require-permissions';
import { useSessionUser } from '@/components/auth/session-context';
import { TipBanner } from '@/components/help/tip-banner';
import { PageShell } from '@/components/layout/page-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui-states';
import {
  cancelarDocumentoAssinado,
  concluirDocumento,
  downloadDocumentoPdfAssinado,
  downloadDocumentoPdfOriginal,
  gerarDocumentoPdfOriginal,
  getDocumento,
  listDocumentos,
  updateDocumentoVinculos,
  listMinhasPendenciasAssinatura,
  toggleAssinaturaPendenteDocumento,
} from '@/lib/api';
import { AssinarInternoDialog, DisponibilizarAssinaturaDialog } from '@/components/documentos/assinatura-interna-dialogs';
import { ColetarAssinaturaDialog } from '@/components/documentos/coletar-assinatura-dialog';
import { DocumentoAvulsoForm, DocumentoAvulsoRespostasLeitura } from '@/components/documentos/documento-avulso-form';
import { NovoDocumentoAvulsoDialog } from '@/components/documentos/novo-documento-avulso-dialog';
import { ChamadosRelacionadosField, type ChamadoRelacionadoChip } from '@/components/documentos/chamados-relacionados-field';
import { DOCUMENTO_SITUACAO_META, DOCUMENTO_TIPO_LABELS } from '@/lib/documento-status';
import { cn } from '@/lib/cn';
import { hasDocumentosModuloAccess } from '@/lib/permissions-matrix';
import { useSafeBackHref } from '@/lib/use-safe-back-href';
import { useSnackbar } from '@/components/ui/snackbar';
import { DocumentoDetalhe, DocumentoResumo, DocumentoSituacao, DocumentoTipo } from '@/lib/types';

const PAGE_SIZE = 50;

const TIPO_OPTIONS = [
  { value: 'TODOS', label: 'Todos os tipos' },
  ...Object.entries(DOCUMENTO_TIPO_LABELS).map(([value, label]) => ({ value, label })),
];

const SITUACAO_OPTIONS = [
  { value: 'TODOS', label: 'Todas as situações' },
  ...Object.entries(DOCUMENTO_SITUACAO_META).map(([value, meta]) => ({ value, label: meta.label })),
];

export default function DocumentosPage() {
  return (
    <Suspense fallback={<LoadingState label="Carregando documentos..." />}>
      <DocumentosGate />
    </Suspense>
  );
}

function DocumentosGate() {
  const searchParams = useSearchParams();
  if (searchParams.get('pendentes') === '1') {
    return <DocumentosPageContent modoPendencias />;
  }
  return (
    <RequirePermissions permissions={['documentos.visualizar']} match="any">
      <DocumentosPageContent />
    </RequirePermissions>
  );
}

function DocumentosPageContent({ modoPendencias = false }: { modoPendencias?: boolean }) {
  const searchParams = useSearchParams();
  const sessionUser = useSessionUser();
  const gestaoDocumentos = hasDocumentosModuloAccess(sessionUser?.permissoes ?? []);
  const backHref = useSafeBackHref('/dashboard');
  const snackbar = useSnackbar();
  const [items, setItems] = useState<DocumentoResumo[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '');
  const [tipo, setTipo] = useState('TODOS');
  const [situacao, setSituacao] = useState('TODOS');
  const [assinatura, setAssinatura] = useState('TODOS');
  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get('id'));
  const [detail, setDetail] = useState<DocumentoDetalhe | null>(null);
  const [busyAction, setBusyAction] = useState(false);
  const [novoOpen, setNovoOpen] = useState(false);
  const [assinaturaOpen, setAssinaturaOpen] = useState(false);
  const [assinarInternoOpen, setAssinarInternoOpen] = useState(false);
  const [disponibilizarOpen, setDisponibilizarOpen] = useState(false);
  const [preencherAberto, setPreencherAberto] = useState(() => searchParams.get('preencher') === '1');

  useEffect(() => {
    setPreencherAberto(searchParams.get('id') === selectedId && searchParams.get('preencher') === '1');
    // Só ao trocar o documento. O clique em Preencher não pode ser desfeito por uma nova referência dos search params.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  function loadList() {
    setLoading(true);
    setError(null);
    const lista = modoPendencias
      ? listMinhasPendenciasAssinatura()
      : listDocumentos({
          limit: PAGE_SIZE,
          offset: 0,
          search: search.trim() || undefined,
          tipo: tipo === 'TODOS' ? undefined : tipo,
          situacao: situacao === 'TODOS' ? undefined : situacao,
          assinatura: assinatura === 'TODOS' || assinatura === 'minha' ? undefined : assinatura,
          pendentesAssinatura: assinatura === 'minha' ? '1' : undefined,
        });
    lista
      .then((response) => {
        setItems(response.items);
        setTotal(response.total);
        setSelectedId((current) => current ?? response.items[0]?.id ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Falha ao carregar documentos.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const handle = window.setTimeout(() => loadList(), 200);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, tipo, situacao, assinatura, modoPendencias]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let active = true;
    setDetailLoading(true);
    getDocumento(selectedId)
      .then((data) => {
        if (active) setDetail(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Falha ao carregar detalhe.');
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? detail ?? null,
    [items, selectedId, detail],
  );

  async function refreshSelected() {
    if (!selectedId) return;
    const [list, nextDetail] = await Promise.all([
      modoPendencias
        ? listMinhasPendenciasAssinatura()
        : listDocumentos({
            limit: Math.max(items.length, PAGE_SIZE),
            offset: 0,
            search: search.trim() || undefined,
            tipo: tipo === 'TODOS' ? undefined : tipo,
            situacao: situacao === 'TODOS' ? undefined : situacao,
            assinatura: assinatura === 'TODOS' || assinatura === 'minha' ? undefined : assinatura,
            pendentesAssinatura: assinatura === 'minha' ? '1' : undefined,
          }),
      getDocumento(selectedId),
    ]);
    setItems(list.items);
    setTotal(list.total);
    setDetail(nextDetail);
  }

  async function runAction(action: () => Promise<unknown>, success: string) {
    setBusyAction(true);
    try {
      await action();
      await refreshSelected();
      snackbar.show(success, 'success');
    } catch (err) {
      snackbar.show(err instanceof Error ? err.message : 'Falha na ação.', 'error');
    } finally {
      setBusyAction(false);
    }
  }

  return (
      <PageShell
        kicker="Gestão documental"
        icon={FileText}
        title="Documentos"
        description="Central de consulta, geração, assinatura e validação dos documentos produzidos no SIGMA."
        backHref={backHref}
        action={
          modoPendencias ? null : (
            <Button type="button" variant="filled" size="sm" onClick={() => setNovoOpen(true)}>
              Novo documento
            </Button>
          )
        }
      >
        <TipBanner id="documentos-central">
          Documentos de vistorias e execuções aparecem aqui automaticamente. Documentos avulsos usam checklists já
          cadastrados. Use o código de validação e o QR Code do PDF para consulta pública.
        </TipBanner>

        <NovoDocumentoAvulsoDialog
          open={novoOpen}
          onClose={() => setNovoOpen(false)}
          onCreated={(id) => {
            setSelectedId(id);
            loadList();
          }}
        />
        {detail ? (
          <>
          <ColetarAssinaturaDialog
            open={assinaturaOpen}
            documento={detail}
            onClose={() => setAssinaturaOpen(false)}
            onDone={() => void refreshSelected()}
          />
          <AssinarInternoDialog
            open={assinarInternoOpen}
            documentoId={detail.id}
            onClose={() => setAssinarInternoOpen(false)}
            onDone={() => void refreshSelected()}
          />
          <DisponibilizarAssinaturaDialog
            open={disponibilizarOpen}
            documento={detail}
            onClose={() => setDisponibilizarOpen(false)}
            onDone={() => void refreshSelected()}
          />
          </>
        ) : null}

        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="relative block sm:col-span-2">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--ink-3)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar código, validação, chamado, próprio..."
              className="h-10 w-full rounded-[12px] border border-[var(--line)] bg-[var(--canvas)] pr-3 pl-9 text-[13px] outline-none focus:border-[var(--brand)]"
            />
          </label>
          <Select value={tipo} onChange={(event) => setTipo(event.target.value)}>
            {TIPO_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Select value={situacao} onChange={(event) => setSituacao(event.target.value)}>
            {SITUACAO_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Select value={assinatura} onChange={(event) => setAssinatura(event.target.value)}>
            <option value="TODOS">Assinatura: todas</option>
            <option value="pendente">Assinatura pendente</option>
            <option value="assinado">Assinado</option>
            <option value="cancelado">Cancelado</option>
            <option value="substituido">Substituído</option>
            <option value="minha">Pendentes para minha assinatura</option>
          </Select>
        </div>

        {error ? <ErrorState message={error} /> : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <section className="rounded-[16px] border border-[var(--line)] bg-[var(--canvas)]">
            <div className="border-b border-[var(--line-2)] px-4 py-3 text-[12px] text-[var(--ink-3)]">
              {loading ? 'Carregando…' : `${total} documento(s)`}
            </div>
            {loading ? (
              <div className="p-4">
                <LoadingState label="Carregando lista..." />
              </div>
            ) : items.length === 0 ? (
              <div className="p-4">
                <EmptyState title="Nenhum documento" description="Ajuste os filtros ou conclua uma vistoria/execução." />
              </div>
            ) : (
              <ul className="max-h-[70vh] divide-y divide-[var(--line-2)] overflow-y-auto">
                {items.map((item) => {
                  const meta = DOCUMENTO_SITUACAO_META[item.situacao as DocumentoSituacao];
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className={cn(
                          'w-full px-4 py-3 text-left transition-colors hover:bg-[var(--canvas-2)]',
                          selectedId === item.id && 'bg-[var(--brand-soft)]',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="mono text-[12px] font-semibold text-[var(--brand-hover)]">{item.codigo}</p>
                            <p className="mt-0.5 text-[13px] font-medium text-[var(--ink)]">{item.titulo}</p>
                            <p className="text-[12px] text-[var(--ink-3)]">
                              {DOCUMENTO_TIPO_LABELS[item.tipo as DocumentoTipo]}
                              {rotuloChamados(item) ? ` · ${rotuloChamados(item)}` : ''}
                              {item.unidade ? ` · ${item.unidade.nome}` : ''}
                            </p>
                          </div>
                          <Badge variant={meta.badge}>{meta.label}</Badge>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded-[16px] border border-[var(--line)] bg-[var(--canvas)] p-4">
            {!selected ? (
              <EmptyState title="Selecione um documento" description="Escolha um item à esquerda para ver detalhes." />
            ) : detailLoading && !detail ? (
              <LoadingState label="Carregando detalhe..." />
            ) : (
              <DocumentoDetail
                documento={(detail ?? selected) as DocumentoDetalhe}
                gestaoDocumentos={gestaoDocumentos}
                busy={busyAction}
                onCopyLink={() => {
                  const link = detail?.linkValidacao || selected.linkValidacao || `/documento/validar/${selected.codigoValidacao}`;
                  void navigator.clipboard.writeText(
                    link.startsWith('http') ? link : `${window.location.origin}${link}`,
                  );
                  snackbar.show('Link de validação copiado.', 'success');
                }}
                onPdfOriginal={() =>
                  void runAction(
                    () => downloadDocumentoPdfOriginal(selected.id, selected.codigo),
                    'PDF original baixado.',
                  )
                }
                onPdfAssinado={() =>
                  void runAction(
                    () => downloadDocumentoPdfAssinado(selected.id, selected.codigo),
                    'PDF assinado baixado.',
                  )
                }
                onGerarPdf={() =>
                  void runAction(() => gerarDocumentoPdfOriginal(selected.id), 'PDF original gerado.')
                }
                onConcluir={() => void runAction(() => concluirDocumento(selected.id), 'Documento concluído.')}
                preencherAberto={preencherAberto && selected.id === selectedId}
                onPreencher={() => setPreencherAberto(true)}
                onFormSaved={() => refreshSelected()}
                onColetar={() => setAssinaturaOpen(true)}
                onAssinarInterno={() => setAssinarInternoOpen(true)}
                onDisponibilizar={() => setDisponibilizarOpen(true)}
                onPendente={() =>
                  void runAction(
                    () => toggleAssinaturaPendenteDocumento(selected.id),
                    (detail?.situacao ?? selected.situacao) === 'ASSINATURA_PENDENTE'
                      ? 'Pendência de assinatura removida.'
                      : 'Assinatura marcada como pendente.',
                  )
                }
                onCancelar={() => {
                  const motivo = window.prompt(
                    'Justificativa obrigatória: ao cancelar o PDF assinado vigente, todas as assinaturas externas serão invalidadas e deverão ser coletadas novamente.',
                  );
                  if (!motivo || motivo.trim().length < 5) {
                    snackbar.show('Informe uma justificativa com ao menos 5 caracteres.', 'error');
                    return;
                  }
                  void runAction(() => cancelarDocumentoAssinado(selected.id, motivo.trim()), 'PDF assinado cancelado.');
                }}
              />
            )}
          </section>
        </div>
      </PageShell>
  );
}

function DocumentoDetail({
  documento,
  gestaoDocumentos,
  busy,
  onCopyLink,
  onPdfOriginal,
  onPdfAssinado,
  onGerarPdf,
  onConcluir,
  preencherAberto,
  onPreencher,
  onFormSaved,
  onColetar,
  onAssinarInterno,
  onDisponibilizar,
  onPendente,
  onCancelar,
}: {
  documento: DocumentoDetalhe;
  gestaoDocumentos: boolean;
  busy: boolean;
  onCopyLink: () => void;
  onPdfOriginal: () => void;
  onPdfAssinado: () => void;
  onGerarPdf: () => void;
  onConcluir: () => void;
  preencherAberto: boolean;
  onPreencher: () => void;
  onFormSaved: () => void | Promise<void>;
  onColetar: () => void;
  onAssinarInterno: () => void;
  onDisponibilizar: () => void;
  onPendente: () => void;
  onCancelar: () => void;
}) {
  const situacao = DOCUMENTO_SITUACAO_META[documento.situacao];
  const origemAutomatica =
    documento.origem === 'CHAMADO_EXECUCAO' || documento.origem === 'VISTORIA';
  const situacaoPermitePdf =
    documento.situacao !== 'ASSINADO_VIGENTE' &&
    documento.situacao !== 'CANCELADO' &&
    documento.situacao !== 'SUBSTITUIDO' &&
    documento.situacao !== 'INVALIDO' &&
    !documento.conteudoTravado;
  const precisaCorrigirPdfExecucao =
    documento.origem === 'CHAMADO_EXECUCAO' &&
    documento.possuiPdfOriginal &&
    documento.pdfOriginalCanonico === false &&
    situacaoPermitePdf;
  const podeRecuperarPdfExecucao =
    documento.origem === 'CHAMADO_EXECUCAO' && !documento.possuiPdfOriginal && situacaoPermitePdf;
  const podePreencherAvulso =
    documento.origem === 'AVULSO' &&
    documento.situacao === 'RASCUNHO' &&
    !documento.possuiPdfOriginal &&
    !documento.conteudoTravado;
  const podeGerarPdfOriginal =
    (!origemAutomatica &&
      !documento.possuiPdfOriginal &&
      (documento.situacao === 'RASCUNHO' ||
        documento.situacao === 'GERADO' ||
        documento.situacao === 'SEM_ASSINATURA_EXTERNA' ||
        documento.situacao === 'ASSINATURA_PENDENTE')) ||
    precisaCorrigirPdfExecucao ||
    podeRecuperarPdfExecucao;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="mono text-[13px] font-bold text-[var(--brand-hover)]">{documento.codigo}</p>
          <h2 className="mt-1 text-[17px] font-semibold text-[var(--ink)]">{documento.titulo}</h2>
          <p className="mt-1 text-[12px] text-[var(--ink-3)]">
            Validação: <span className="mono font-semibold">{documento.codigoValidacao}</span>
          </p>
        </div>
        <Badge variant={situacao.badge}>{situacao.label}</Badge>
      </div>

      <dl className="grid gap-2 text-[13px] sm:grid-cols-2">
        <Detail label="Tipo" value={DOCUMENTO_TIPO_LABELS[documento.tipo]} />
        <Detail label="Origem" value={documento.origem} />
        <Detail label="Secretaria" value={documento.secretaria ? `${documento.secretaria.sigla} · ${documento.secretaria.nome}` : '—'} />
        <Detail label="Próprio" value={documento.unidade ? `${documento.unidade.codigoPatrimonial} · ${documento.unidade.nome}` : '—'} />
        <DocumentoChamadosBloco documento={documento} onSaved={onFormSaved} />
        <Detail
          label="Vistoria"
          value={
            documento.fiscalizacao
              ? `${documento.fiscalizacao.unidadeNome ?? documento.fiscalizacao.id.slice(0, 8)}${documento.fiscalizacao.concluidaEm ? ` · ${new Date(documento.fiscalizacao.concluidaEm).toLocaleString('pt-BR')}` : ''}`
              : '—'
          }
        />
        <Detail label="Endereço" value={documento.enderecoTexto || documento.unidade?.endereco || '—'} />
        <Detail label="Responsável" value={documento.responsavel?.nome ?? '—'} />
        <Detail label="Criado em" value={new Date(documento.createdAt).toLocaleString('pt-BR')} />
        <Detail label="Checklist" value={documento.checklist?.nome ? `${documento.checklist.nome} (v${documento.checklist.versao})` : '—'} />
      </dl>

      <div className="flex flex-wrap gap-1.5">
        {gestaoDocumentos && podePreencherAvulso ? (
          <Button type="button" size="sm" variant="filled" disabled={busy} onClick={onPreencher}>
            Preencher documento
          </Button>
        ) : null}
        {gestaoDocumentos && !documento.possuiPdfOriginal && documento.situacao === 'RASCUNHO' && !podePreencherAvulso ? (
          <Button type="button" size="sm" variant="outlined" disabled={busy} onClick={onConcluir}>
            Concluir documento
          </Button>
        ) : null}
        {gestaoDocumentos && podeGerarPdfOriginal ? (
          <Button type="button" size="sm" variant="outlined" disabled={busy} onClick={onGerarPdf}>
            {precisaCorrigirPdfExecucao
              ? 'Corrigir PDF original'
              : podeRecuperarPdfExecucao
                ? 'Tentar gerar PDF original'
                : 'Gerar PDF original'}
          </Button>
        ) : null}
        {documento.possuiPdfOriginal ? (
          <Button type="button" size="sm" variant="outlined" disabled={busy} onClick={onPdfOriginal}>
            Visualizar PDF original
          </Button>
        ) : origemAutomatica ? (
          <span className="inline-flex items-center rounded-[8px] border border-amber-200 bg-amber-50 px-2.5 py-1 text-[12px] font-medium text-amber-800">
            PDF original pendente
          </span>
        ) : null}
        {documento.possuiPdfAssinado ? (
          <Button type="button" size="sm" variant="outlined" disabled={busy} onClick={onPdfAssinado}>
            Visualizar PDF assinado
          </Button>
        ) : null}
        {documento.podeAssinarInterno && documento.possuiPdfOriginal && documento.situacao !== 'RASCUNHO' ? (
          <Button type="button" size="sm" variant="filled" disabled={busy} onClick={onAssinarInterno}>
            Assinar com usuário e senha
          </Button>
        ) : null}
        {documento.podeDisponibilizarAssinatura && documento.possuiPdfOriginal && documento.situacao !== 'RASCUNHO' ? (
          <Button type="button" size="sm" variant="outlined" disabled={busy} onClick={onDisponibilizar}>
            Encaminhar para assinatura
          </Button>
        ) : null}
        {gestaoDocumentos ? (
          <Button
            type="button"
            size="sm"
            variant="filled"
            disabled={busy || !documento.possuiPdfOriginal || documento.situacao === 'CANCELADO'}
            onClick={onColetar}
          >
            {documento.possuiPdfAssinado ? 'Coletar nova assinatura' : 'Coletar assinatura'}
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="ghost" onClick={onCopyLink}>
          <Copy className="h-3.5 w-3.5" />
          Copiar link de validação
        </Button>
        {gestaoDocumentos ? (
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onPendente}>
            {documento.situacao === 'ASSINATURA_PENDENTE'
              ? 'Desmarcar assinatura pendente'
              : 'Marcar assinatura pendente'}
          </Button>
        ) : null}
        {gestaoDocumentos &&
        documento.possuiPdfAssinado &&
        (documento.situacao === 'ASSINADO_VIGENTE' || documento.situacao === 'ASSINATURA_PENDENTE') ? (
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onCancelar}>
            Cancelar PDF assinado vigente
          </Button>
        ) : null}
      </div>

      {(documento.signatariosPendentes ?? []).length ? (
        <p className="text-[12px] text-[var(--ink-3)]">
          Signatários internos pendentes: {documento.signatariosPendentes?.map((item) => item.nome).join(', ')}
        </p>
      ) : null}

      {gestaoDocumentos && podePreencherAvulso && preencherAberto ? (
        <DocumentoAvulsoForm key={documento.id} documento={documento} onSaved={onFormSaved} />
      ) : null}
      {documento.origem === 'AVULSO' && !podePreencherAvulso ? (
        <DocumentoAvulsoRespostasLeitura documento={documento} />
      ) : null}

      <div>
        <p className="mb-2 text-[12px] font-semibold text-[var(--ink)]">Assinaturas vigentes</p>
        {documento.assinaturas?.length ? (
          <ul className="space-y-2 text-[12px] text-[var(--ink-2)]">
            {documento.assinaturas.map((item) => (
              <li key={item.id} className="rounded-[10px] border border-[var(--line)] bg-[var(--canvas-2)] px-3 py-2">
                <p className="font-medium text-[var(--ink)]">{item.assinanteNome}</p>
                <p>
                  {item.qualificacaoOutro || item.qualificacao || '—'}
                  {' · '}
                  CPF{' '}
                  {item.cpfNaoInformado || item.assinanteDocumento === 'não informado'
                    ? 'não informado'
                    : item.assinanteDocumento || '—'}
                  {' · '}
                  E-mail{' '}
                  {item.emailNaoInformado || item.assinanteEmail === 'não informado'
                    ? 'não informado'
                    : item.assinanteEmail || '—'}
                </p>
                <p className="text-[var(--ink-3)]">
                  {new Date(item.coletadaEm).toLocaleString('pt-BR')}
                  {item.coletadaPor?.nome ? ` · coletada por ${item.coletadaPor.nome}` : ''}
                </p>
                {item.justificativaIdentificacao ? (
                  <p className="text-[var(--ink-3)]">Justificativa: {item.justificativaIdentificacao}</p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-[var(--ink-3)]">Nenhuma assinatura vigente</p>
        )}
      </div>

      {documento.podeVerAssinaturasAnteriores ? (
        <div>
          <p className="mb-1 text-[12px] font-semibold text-[var(--ink)]">Assinaturas anteriores</p>
          <p className="mb-2 text-[11px] text-[var(--ink-3)]">
            Assinaturas de PDFs assinados cancelados ou substituídos — apenas histórico/auditoria, não vigentes.
          </p>
          {documento.assinaturasAnteriores?.length ? (
            <ul className="space-y-2 text-[12px] text-[var(--ink-2)]">
              {documento.assinaturasAnteriores.map((item) => (
                <li
                  key={item.id}
                  className="rounded-[10px] border border-dashed border-[var(--line)] bg-[var(--surface)] px-3 py-2"
                >
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="font-medium text-[var(--ink)]">{item.assinanteNome}</span>
                    <Badge variant="muted">Não vigente</Badge>
                  </div>
                  <p>
                    {item.qualificacaoOutro || item.qualificacao || '—'}
                    {' · '}
                    CPF{' '}
                    {item.cpfNaoInformado || item.assinanteDocumento === 'não informado'
                      ? 'não informado'
                      : item.assinanteDocumento || '—'}
                    {' · '}
                    E-mail{' '}
                    {item.emailNaoInformado || item.assinanteEmail === 'não informado'
                      ? 'não informado'
                      : item.assinanteEmail || '—'}
                  </p>
                  <p className="text-[var(--ink-3)]">
                    Assinada em {new Date(item.coletadaEm).toLocaleString('pt-BR')}
                    {item.coletadaPor?.nome ? ` · coletada por ${item.coletadaPor.nome}` : ''}
                  </p>
                  {item.invalidadaEm ? (
                    <p className="text-[var(--ink-3)]">
                      Invalidada em {new Date(item.invalidadaEm).toLocaleString('pt-BR')}
                      {item.invalidadaPorNome ? ` · por ${item.invalidadaPorNome}` : ''}
                    </p>
                  ) : null}
                  {item.invalidadaMotivo ? (
                    <p className="text-[var(--ink-2)]">Motivo: {item.invalidadaMotivo}</p>
                  ) : null}
                  {item.justificativaIdentificacao ? (
                    <p className="text-[var(--ink-3)]">
                      Justificativa de identificação: {item.justificativaIdentificacao}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12px] text-[var(--ink-3)]">Nenhuma assinatura anterior registrada</p>
          )}
        </div>
      ) : null}

      {documento.historico?.length ? (
        <div>
          <p className="mb-2 text-[12px] font-semibold text-[var(--ink)]">Histórico</p>
          <ol className="space-y-2 border-l-2 border-[var(--line)] pl-3">
            {documento.historico.map((item) => {
              const meta =
                item.metadata && typeof item.metadata === 'object'
                  ? (item.metadata as Record<string, unknown>)
                  : null;
              const assinaturasInvalidas = Array.isArray(meta?.assinaturasInvalidas)
                ? (meta.assinaturasInvalidas as Array<Record<string, unknown>>)
                : [];
              return (
                <li key={item.id} className="text-[12px]">
                  <p className="font-semibold text-[var(--ink)]">
                    {item.statusAnterior ? `${item.statusAnterior} → ` : ''}
                    {item.statusNovo}
                  </p>
                  <p className="text-[var(--ink-3)]">
                    {new Date(item.createdAt).toLocaleString('pt-BR')}
                    {item.alteradoPor ? ` · ${item.alteradoPor.nome}` : ''}
                  </p>
                  {item.motivo ? <p className="text-[var(--ink-2)]">{item.motivo}</p> : null}
                  {typeof meta?.assinanteNome === 'string' ? (
                    <p className="text-[var(--ink-3)]">
                      Assinante: {meta.assinanteNome}
                      {typeof meta.assinanteDocumento === 'string' ? ` · CPF ${meta.assinanteDocumento}` : ''}
                      {typeof meta.assinanteEmail === 'string' ? ` · E-mail ${meta.assinanteEmail}` : ''}
                      {typeof meta.qualificacao === 'string' ? ` · ${meta.qualificacao}` : ''}
                    </p>
                  ) : null}
                  {typeof meta?.justificativaIdentificacao === 'string' ? (
                    <p className="text-[var(--ink-3)]">
                      Justificativa: {meta.justificativaIdentificacao}
                    </p>
                  ) : null}
                  {assinaturasInvalidas.length > 0 ? (
                    <ul className="mt-1 space-y-0.5 text-[var(--ink-3)]">
                      {assinaturasInvalidas.map((assinatura, index) => (
                        <li key={String(assinatura.id ?? index)}>
                          Invalidada: {String(assinatura.assinanteNome ?? '—')}
                          {assinatura.assinanteDocumento
                            ? ` · CPF ${String(assinatura.assinanteDocumento)}`
                            : ''}
                          {assinatura.assinanteEmail
                            ? ` · E-mail ${String(assinatura.assinanteEmail)}`
                            : ''}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

function rotuloChamados(item: { chamado?: { codigo: string } | null; chamados?: Array<{ codigo: string }> }) {
  const codigos = item.chamados?.length ? item.chamados.map((chamado) => chamado.codigo) : item.chamado ? [item.chamado.codigo] : [];
  return codigos.join(', ');
}

function DocumentoChamadosBloco({
  documento,
  onSaved,
}: {
  documento: DocumentoDetalhe;
  onSaved: () => void | Promise<void>;
}) {
  const snackbar = useSnackbar();
  const lista: ChamadoRelacionadoChip[] = documento.chamados?.length
    ? documento.chamados
    : documento.chamado
      ? [{ id: documento.chamado.id, codigo: documento.chamado.codigo }]
      : [];
  const [chamados, setChamados] = useState<ChamadoRelacionadoChip[]>(lista);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setChamados(lista);
    // Recarrega a seleção quando o documento muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documento.id, documento.updatedAt]);

  async function salvar() {
    setBusy(true);
    try {
      await updateDocumentoVinculos(documento.id, { chamadoIds: chamados.map((item) => item.id) });
      snackbar.show('Chamados relacionados atualizados.', 'success');
      await onSaved();
    } catch (err) {
      snackbar.show(err instanceof Error ? err.message : 'Falha ao atualizar os chamados.', 'error');
    } finally {
      setBusy(false);
    }
  }

  if (documento.origem !== 'AVULSO') {
    return <Detail label="Chamado" value={lista.map((item) => item.codigo).join(', ') || '—'} />;
  }

  return (
    <div className="sm:col-span-2">
      <p className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Chamados relacionados</p>
      {documento.podeEditarChamados ? (
        <div className="mt-2 space-y-2">
          <ChamadosRelacionadosField value={chamados} onChange={setChamados} disabled={busy} />
          <Button type="button" size="sm" variant="outlined" disabled={busy} onClick={() => void salvar()}>
            Salvar chamados
          </Button>
        </div>
      ) : lista.length ? (
        <ul className="mt-1 space-y-1 text-[13px] text-[var(--ink)]">
          {lista.map((item) => (
            <li key={item.id}>
              <span className="font-semibold">{item.codigo}</span>
              {item.titulo ? ` · ${item.titulo}` : ''}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-[13px] text-[var(--ink)]">Nenhum chamado relacionado.</p>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">{label}</dt>
      <dd className="mt-0.5 text-[var(--ink)]">{value}</dd>
    </div>
  );
}
