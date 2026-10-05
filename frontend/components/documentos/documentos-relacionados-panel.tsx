'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import { useSessionUser } from '@/components/auth/session-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui-states';
import {
  downloadDocumentoPdfAssinado,
  downloadDocumentoPdfOriginal,
  getDocumento,
  listDocumentosPorChamado,
  listDocumentosPorFiscalizacao,
} from '@/lib/api';
import { DOCUMENTO_SITUACAO_META, DOCUMENTO_TIPO_LABELS } from '@/lib/documento-status';
import {
  canAssinarDocumentoInterno,
  canCriarDocumentoAvulso,
  canDisponibilizarAssinaturaInterna,
  canVerDocumentosRelacionados,
  hasDocumentosModuloAccess,
} from '@/lib/permissions-matrix';
import {
  assinaturasVigentesDoCard,
  resolvePodeColetar,
  rotuloAssinaturaVigente,
  rotuloSignatarioPendente,
  signatariosPendentesDoCard,
} from '@/components/documentos/documentos-relacionados-acoes';
import { DocumentoDetalhe, DocumentoResumo } from '@/lib/types';
import { NovoDocumentoAvulsoDialog, type DocumentoAvulsoVinculo } from '@/components/documentos/novo-documento-avulso-dialog';
import { DocumentoPreencherDialog, DocumentoRespostasDialog } from '@/components/documentos/documento-consulta-dialogs';
import { AssinarInternoDialog, DisponibilizarAssinaturaDialog } from '@/components/documentos/assinatura-interna-dialogs';
import { ColetarAssinaturaDialog } from '@/components/documentos/coletar-assinatura-dialog';
import { useSnackbar } from '@/components/ui/snackbar';

type Props = {
  chamadoId?: string;
  fiscalizacaoId?: string;
  onClose?: () => void;
  /** Em Meus chamados, esconde o atalho do cadastro quando o usuário não tem o módulo Documentos. */
  ocultarCadastroSemPermissao?: boolean;
  /** Dados do chamado para pré-preencher o documento avulso. */
  vinculo?: Omit<DocumentoAvulsoVinculo, 'chamadoId'> | null;
};

export function DocumentosRelacionadosPanel({
  chamadoId,
  fiscalizacaoId,
  onClose,
  ocultarCadastroSemPermissao = false,
  vinculo,
}: Props) {
  const sessionUser = useSessionUser();
  const permissoes = sessionUser?.permissoes ?? [];
  const canAbrirCadastro = hasDocumentosModuloAccess(permissoes);
  const canNovo =
    Boolean(chamadoId && vinculo) && canCriarDocumentoAvulso(permissoes) && canVerDocumentosRelacionados(permissoes);
  const [items, setItems] = useState<DocumentoResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [novoOpen, setNovoOpen] = useState(false);
  const [detalhe, setDetalhe] = useState<DocumentoDetalhe | null>(null);
  const [modo, setModo] = useState<'preencher' | 'ver' | 'assinar' | 'encaminhar' | 'coletar' | null>(null);
  const snackbar = useSnackbar();
  const podePreencher = hasDocumentosModuloAccess(permissoes) || canCriarDocumentoAvulso(permissoes);
  const podeAssinar = canAssinarDocumentoInterno(permissoes);
  const podeEncaminhar = canDisponibilizarAssinaturaInterna(permissoes);
  const podeColetar = resolvePodeColetar(permissoes);

  async function abrirDocumento(id: string, proximo: NonNullable<typeof modo>) {
    try {
      const documento = await getDocumento(id);
      setDetalhe(documento);
      setModo(proximo);
    } catch (err) {
      snackbar.show(err instanceof Error ? err.message : 'Falha ao abrir o documento.', 'error');
    }
  }

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    const loader = chamadoId
      ? listDocumentosPorChamado(chamadoId)
      : fiscalizacaoId
        ? listDocumentosPorFiscalizacao(fiscalizacaoId)
        : Promise.resolve({ total: 0, items: [] });
    return loader
      .then((response) => setItems(response.items))
      .catch((err) => setError(err instanceof Error ? err.message : 'Falha ao carregar documentos.'))
      .finally(() => setLoading(false));
  }, [chamadoId, fiscalizacaoId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    const loader = chamadoId
      ? listDocumentosPorChamado(chamadoId)
      : fiscalizacaoId
        ? listDocumentosPorFiscalizacao(fiscalizacaoId)
        : Promise.resolve({ total: 0, items: [] });

    loader
      .then((response) => {
        if (active) setItems(response.items);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Falha ao carregar documentos.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [chamadoId, fiscalizacaoId]);

  return (
    <div className="space-y-3 rounded-[14px] border border-[var(--line)] bg-[var(--canvas-2)] p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-[var(--brand)]" />
          <h3 className="text-[14px] font-semibold text-[var(--ink)]">Documentos relacionados</h3>
        </div>
        <div className="flex items-center gap-1.5">
          {canNovo && chamadoId && vinculo ? (
            <Button type="button" variant="filled" size="sm" onClick={() => setNovoOpen(true)}>
              Novo documento
            </Button>
          ) : null}
          {onClose ? (
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Fechar
            </Button>
          ) : null}
        </div>
      </div>
      {canNovo && chamadoId && vinculo ? (
        <NovoDocumentoAvulsoDialog
          open={novoOpen}
          vinculo={{ ...vinculo, chamadoId }}
          onClose={() => setNovoOpen(false)}
          onCreated={() => {
            setNovoOpen(false);
            void reload();
          }}
        />
      ) : null}

      {loading ? <LoadingState label="Carregando documentos..." /> : null}
      {error ? <ErrorState message={error} /> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState title="Nenhum documento" description="Nenhum documento vinculado a este registro." />
      ) : null}

      <ul className="space-y-2">
        {items.map((item) => {
          const situacao = DOCUMENTO_SITUACAO_META[item.situacao];
          const pendentes = signatariosPendentesDoCard(item);
          const assinados = assinaturasVigentesDoCard(item);
          return (
            <li
              key={item.id}
              className="rounded-[12px] border border-[var(--line)] bg-[var(--canvas)] p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="mono text-[12px] font-semibold text-[var(--brand-hover)]">{item.codigo}</p>
                  <p className="mt-0.5 text-[13px] font-medium text-[var(--ink)]">{item.titulo}</p>
                  <p className="text-[12px] text-[var(--ink-3)]">
                    {DOCUMENTO_TIPO_LABELS[item.tipo]} · {new Date(item.createdAt).toLocaleString('pt-BR')}
                  </p>
                  {pendentes.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      <p className="text-[11px] font-medium text-[var(--ink-2)]">
                        Signatários pendentes:
                      </p>
                      <ul className="space-y-0.5">
                        {pendentes.map((sig) => (
                          <li key={sig.id} className="text-[11px] text-[var(--ink-3)]">
                            • {rotuloSignatarioPendente(sig)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {assinados.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      <p className="text-[11px] font-medium text-[var(--ink-2)]">Assinados:</p>
                      <ul className="space-y-0.5">
                        {assinados.map((sig) => (
                          <li key={sig.id} className="text-[11px] text-[var(--ink-3)]">
                            • {rotuloAssinaturaVigente(sig)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
                <Badge variant={situacao.badge}>{situacao.label}</Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.origem === 'AVULSO' && item.situacao === 'RASCUNHO' && !item.possuiPdfOriginal ? (
                  podePreencher ? (
                    <Button type="button" size="sm" variant="filled" onClick={() => void abrirDocumento(item.id, 'preencher')}>
                      Preencher
                    </Button>
                  ) : (
                    <Button type="button" size="sm" variant="outlined" disabled title="Sem permissão para preencher o documento">
                      Preencher
                    </Button>
                  )
                ) : null}
                {canAbrirCadastro ? (
                  <Link href={`/documentos?id=${item.id}`}>
                    <Button type="button" size="sm" variant="outlined">
                      Abrir
                    </Button>
                  </Link>
                ) : ocultarCadastroSemPermissao ? null : (
                  <Button type="button" size="sm" variant="outlined" disabled title="Sem permissão para abrir o cadastro do documento">
                    Abrir
                  </Button>
                )}
                <Button type="button" size="sm" variant="ghost" onClick={() => void abrirDocumento(item.id, 'ver')}>
                  Ver respostas do documento
                </Button>
                {item.possuiPdfOriginal ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => void downloadDocumentoPdfOriginal(item.id, item.codigo)}
                  >
                    PDF original
                  </Button>
                ) : null}
                {item.possuiPdfAssinado ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => void downloadDocumentoPdfAssinado(item.id, item.codigo)}
                  >
                    PDF assinado
                  </Button>
                ) : null}
                {item.possuiPdfOriginal && item.situacao !== 'RASCUNHO' && item.situacao !== 'CANCELADO' && podeAssinar ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => void abrirDocumento(item.id, 'assinar')}>
                    Assinar com usuário e senha
                  </Button>
                ) : null}
                {item.possuiPdfOriginal && item.situacao !== 'RASCUNHO' && item.situacao !== 'CANCELADO' && podeEncaminhar ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => void abrirDocumento(item.id, 'encaminhar')}>
                    Encaminhar para assinatura
                  </Button>
                ) : null}
                {item.possuiPdfOriginal && item.situacao !== 'CANCELADO' && podeColetar ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => void abrirDocumento(item.id, 'coletar')}>
                    Coletar nova assinatura
                  </Button>
                ) : null}
              </div>
              {!canAbrirCadastro && !ocultarCadastroSemPermissao ? (
                <p className="mt-1.5 text-[11px] text-[var(--ink-3)]">
                  Sem permissão para abrir o cadastro do documento
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      <DocumentoPreencherDialog
        documento={modo === 'preencher' ? detalhe : null}
        onClose={() => setModo(null)}
        onSaved={async (info) => {
          await reload();
          if (info?.concluido) setModo(null);
          else if (detalhe) {
            const atualizado = await getDocumento(detalhe.id).catch(() => null);
            if (atualizado) setDetalhe(atualizado);
          }
        }}
      />
      <DocumentoRespostasDialog documento={modo === 'ver' ? detalhe : null} onClose={() => setModo(null)} />
      {detalhe && modo === 'assinar' ? (
        <AssinarInternoDialog open documentoId={detalhe.id} onClose={() => setModo(null)} onDone={() => { setModo(null); void reload(); }} />
      ) : null}
      {detalhe && modo === 'encaminhar' ? (
        <DisponibilizarAssinaturaDialog open documento={detalhe} onClose={() => setModo(null)} onDone={() => { setModo(null); void reload(); }} />
      ) : null}
      {detalhe && modo === 'coletar' ? (
        <ColetarAssinaturaDialog open documento={detalhe} onClose={() => setModo(null)} onDone={() => { setModo(null); void reload(); }} />
      ) : null}
    </div>
  );
}
