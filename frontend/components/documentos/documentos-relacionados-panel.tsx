'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { useSessionUser } from '@/components/auth/session-context';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui-states';
import {
  downloadDocumentoPdfAssinado,
  downloadDocumentoPdfOriginal,
  getDocumento,
  listDocumentosPorChamado,
  listDocumentosPorFiscalizacao,
} from '@/lib/api';
import {
  canAssinarDocumentoInterno,
  canCriarDocumentoAvulso,
  canDisponibilizarAssinaturaInterna,
  canVerDocumentosRelacionados,
  hasDocumentosModuloAccess,
} from '@/lib/permissions-matrix';
import { DocumentoDetalhe, DocumentoResumo } from '@/lib/types';
import { NovoDocumentoAvulsoDialog, type DocumentoAvulsoVinculo } from '@/components/documentos/novo-documento-avulso-dialog';
import { DocumentoPreencherDialog, DocumentoRespostasDialog } from '@/components/documentos/documento-consulta-dialogs';
import { AssinarInternoDialog, DisponibilizarAssinaturaDialog } from '@/components/documentos/assinatura-interna-dialogs';
import { ColetarAssinaturaDialog } from '@/components/documentos/coletar-assinatura-dialog';
import { DocumentoRelacionadoCard } from '@/components/documentos/documento-relacionado-card';
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
        {items.map((item) => (
          <DocumentoRelacionadoCard
            key={item.id}
            item={item}
            permissoes={permissoes}
            user={sessionUser}
            podePreencher={podePreencher}
            podeAssinar={podeAssinar}
            podeEncaminhar={podeEncaminhar}
            canAbrirCadastro={canAbrirCadastro}
            ocultarCadastroSemPermissao={ocultarCadastroSemPermissao}
            onAcao={(id, modo) => void abrirDocumento(id, modo)}
            onPdfOriginal={(id, codigo) => void downloadDocumentoPdfOriginal(id, codigo)}
            onPdfAssinado={(id, codigo) => void downloadDocumentoPdfAssinado(id, codigo)}
          />
        ))}
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
