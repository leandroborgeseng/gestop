'use client';

/**
 * #311 — corpo do detalhe de uma vistoria, compartilhado por Vistorias realizadas e pelo modal de consulta do CCO.
 * Só leitura: não dispara escrita. Fonte única da UI do detalhe (sem segunda implementação).
 */
import Link from 'next/link';
import { CabecalhoSecao } from '@/components/checklists/cabecalho-secao';
import { Button } from '@/components/ui/button';
import { AuthenticatedImage } from '@/components/ui/authenticated-image';
import { ImageGalleryLightbox } from '@/components/ui/image-gallery-lightbox';
import { ClipboardList, Download, ExternalLink, FileText, ZoomIn } from 'lucide-react';
import { useState } from 'react';
import { abrirStorageAutenticado, baixarStorageAutenticado } from '@/lib/storage-url';
import { isEvidenciaImagem, particionarEvidencias, rotuloAnexo } from '@/lib/evidencia-midia';
import { formatRespostaValor } from '@/lib/checklist-item-opcoes';
import { formatNotaBr, notaCorHex } from '@/lib/vistoria-nota';
import type { FiscalizacaoDetalhe, FiscalizacaoResumo, FiscalizacaoStatus } from '@/lib/types';

export const STATUS_OPTIONS: Array<{ value: '' | FiscalizacaoStatus; label: string }> = [
  { value: '', label: 'Todas' },
  { value: 'CONCLUIDA', label: 'Concluídas' },
  { value: 'EM_ANDAMENTO', label: 'Em andamento' },
  { value: 'PLANEJADA', label: 'Planejadas' },
  { value: 'SINCRONIZACAO_PENDENTE', label: 'Sincronização pendente' },
  { value: 'CANCELADA', label: 'Canceladas' },
];

export const STATUS_BADGE: Record<FiscalizacaoStatus, 'success' | 'warning' | 'info' | 'muted' | 'danger'> = {
  CONCLUIDA: 'success',
  EM_ANDAMENTO: 'warning',
  PLANEJADA: 'info',
  SINCRONIZACAO_PENDENTE: 'warning',
  CANCELADA: 'muted',
};

export function statusLabel(status: FiscalizacaoStatus) {
  return STATUS_OPTIONS.find((item) => item.value === status)?.label ?? status;
}

export function formatDateTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString('pt-BR') : '—';
}

export function NotaVistoriaDestaque({ notaGeral }: { notaGeral: number }) {
  const color = notaCorHex(notaGeral);
  return (
    <div
      className="flex min-w-[92px] flex-col items-center rounded-[var(--r-md)] border px-3 py-2 text-center"
      style={{
        borderColor: `${color}55`,
        backgroundColor: `${color}14`,
      }}
      title="Nota média dos itens Likert nesta vistoria (0 a 10)"
    >
      <span className="text-[10px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Nota do próprio</span>
      <span className="text-[26px] font-bold leading-tight" style={{ color }}>
        {formatNotaBr(notaGeral)}
      </span>
    </div>
  );
}

export function VistoriaDetalheCorpo({
  resumo,
  detail,
  detailLoading,
  onExibirQuestionario,
}: {
  resumo: FiscalizacaoResumo;
  detail: FiscalizacaoDetalhe | null;
  detailLoading: boolean;
  onExibirQuestionario?: () => void;
}) {
  return (
    <>
    <dl className="grid gap-3 sm:grid-cols-2">
      <DetailField label="Checklist">{resumo.checklistVersao.checklist.nome} (v{resumo.checklistVersao.versao})</DetailField>
      <DetailField label="Origem">{(detail ?? resumo).origemLabel ?? resumo.origem}</DetailField>
      {resumo.avulsaPorConflito ? (
        <DetailField label="Enviada como avulsa por conflito">
          <span data-testid="detalhe-avulsa-motivo">
            {resumo.conflitoCodigo ? `${resumo.conflitoCodigo} · ` : ''}
            Programação de {resumo.conflitoDataProgramada ? formatDateTime(resumo.conflitoDataProgramada).slice(0, 10) : '—'}
            {' · '}Motivo: {resumo.avulsaMotivo ?? '—'}
          </span>
        </DetailField>
      ) : null}
      <DetailField label="Vistoria realizada por">
        {(detail ?? resumo).realizadaPorLabel ?? resumo.agente.nome}
      </DetailField>
      {(detail ?? resumo).responsaveisPrevistosLabel ? (
        <DetailField label="Responsável previsto no cronograma">
          {(detail ?? resumo).responsaveisPrevistosLabel}
        </DetailField>
      ) : null}
      {(detail ?? resumo).lancamentoManual || resumo.origem === 'MANUAL' ? (
        <DetailField label="Lançada no sistema por">
          {(detail ?? resumo).lancadoPorLabel ?? '—'}
        </DetailField>
      ) : null}
      <DetailField label="Lançamento manual">
        {(detail ?? resumo).lancamentoManual || resumo.origem === 'MANUAL' ? 'Sim' : 'Não'}
      </DetailField>
      {(detail ?? resumo).lancamentoManual || resumo.origem === 'MANUAL' ? (
        <>
          <DetailField label="Data da vistoria">
            {formatDateTime((detail ?? resumo).dataVistoriaInformada ?? resumo.iniciadaEm)}
          </DetailField>
          <DetailField label="Data do lançamento">
            {formatDateTime((detail ?? resumo).dataLancamento ?? resumo.createdAt)}
          </DetailField>
        </>
      ) : (
        <>
          <DetailField label="Iniciada em">{formatDateTime(resumo.iniciadaEm)}</DetailField>
          <DetailField label="Concluída em">{formatDateTime(resumo.concluidaEm)}</DetailField>
        </>
      )}
      <DetailField label="Dentro do raio">
        {resumo.dentroRaioPermitido == null ? '—' : resumo.dentroRaioPermitido ? 'Sim' : 'Não'}
      </DetailField>
      <DetailField label="Distância check-in">
        {resumo.distanciaCheckinMetros != null ? `${Math.round(resumo.distanciaCheckinMetros)} m` : '—'}
      </DetailField>
      {resumo.checkinLatitude != null && resumo.checkinLongitude != null ? (
        <DetailField label="Coordenadas do check-in">
          <span className="mono">{resumo.checkinLatitude.toFixed(6)}, {resumo.checkinLongitude.toFixed(6)}</span>
        </DetailField>
      ) : null}
    </dl>

    {!detailLoading && detail?.nota?.notasPorCategoria?.length ? (
      <div>
        <p className="mb-2 text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Notas por categoria</p>
        <div className="flex flex-wrap gap-2">
          {detail.nota.notasPorCategoria.map((item) => (
            <div
              key={item.categoriaId}
              className="rounded-[var(--r-md)] border px-3 py-2 text-center"
              style={{
                borderColor: `${notaCorHex(item.nota)}44`,
                backgroundColor: `${notaCorHex(item.nota)}10`,
              }}
            >
              <p className="text-[11px] font-semibold text-[var(--ink-3)]">{item.categoriaNome}</p>
              <p className="text-[16px] font-bold" style={{ color: notaCorHex(item.nota) }}>
                {formatNotaBr(item.nota)}
              </p>
            </div>
          ))}
        </div>
      </div>
    ) : null}

    {detail?.respostas?.length && onExibirQuestionario ? (
      <Button variant="outlined" size="sm" onClick={onExibirQuestionario}>
        <ClipboardList className="mr-1.5 h-3.5 w-3.5" />
        Exibir questionário
      </Button>
    ) : null}

    {detail?.observacoes ? (
      <div>
        <p className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Observações</p>
        <p className="mt-1 text-[13px] text-[var(--ink-2)]">{detail.observacoes}</p>
      </div>
    ) : null}

    {detail?.naoConformidades?.length ? (
      <div>
        <p className="mb-2 text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Não conformidades</p>
        <div className="space-y-2">
          {detail.naoConformidades.map((nc) => (
            <div key={nc.id} className="rounded-[var(--r-md)] border border-[var(--warn-bd)] bg-[var(--warn-bg)] p-3 text-[13px]">
              <p className="font-semibold text-[var(--warn)]">{nc.item.titulo}</p>
              <p className="mt-1 text-[var(--ink-2)]">{nc.descricao}</p>
              {nc.chamado ? (
                <p className="mt-2 text-[12px]">
                  Chamado gerado:{' '}
                  <Link href={`/chamados?search=${encodeURIComponent(nc.chamado.codigo)}`} className="font-semibold text-[var(--brand)] hover:underline">
                    {nc.chamado.codigo}
                  </Link>
                  {nc.chamado.status ? ` · ${nc.chamado.status}` : ''}
                </p>
              ) : nc.status === 'BAIXADA_MANUAL' ? (
                <p className="mt-2 text-[12px] text-[var(--ink-3)]">
                  Baixada manualmente{nc.motivoBaixa ? `: ${nc.motivoBaixa}` : ''}
                </p>
              ) : (
                <p className="mt-2 text-[12px] font-medium text-[var(--warn)]">
                  Pendente sem chamado
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    ) : null}

    {detail?.respostas?.length ? (
      <div>
        <p className="mb-2 text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Respostas do checklist</p>
        <div className="space-y-2">
          {detail.respostas.map((resposta, index) => (
            <div key={resposta.id}>
              <CabecalhoSecao
                atual={resposta.item.secao}
                anterior={index > 0 ? detail.respostas?.[index - 1]?.item.secao : undefined}
              />
              <div className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-3">
                <p className="text-[12px] font-semibold text-[var(--ink)]">
                  {resposta.item.titulo}
                </p>
                <p className="mt-1 text-[13px] text-[var(--ink-2)]">
                  {formatRespostaValor(resposta)}
                </p>
                {resposta.comentario ? (
                  <p className="mt-1 text-[12px] text-[var(--ink-3)]">{resposta.comentario}</p>
                ) : null}
                <RespostaEvidencias evidencias={resposta.evidencias} altPrefix={resposta.item.titulo} />
                {resposta.naoConformidade?.chamado ? (
                  <p className="mt-2 text-[12px]">
                    Chamado gerado:{' '}
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
      </div>
    ) : null}
    </>
  );
}

export function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">{label}</dt>
      <dd className="mt-0.5 text-[13px] font-medium text-[var(--ink-2)]">{children}</dd>
    </div>
  );
}

export function RespostaEvidencias({
  evidencias,
  altPrefix,
}: {
  evidencias?: Array<{ id: string; url: string; tipo?: string | null; mimeType?: string | null }>;
  altPrefix: string;
}) {
  const [fotoIndex, setFotoIndex] = useState<number | null>(null);
  if (!evidencias?.length) return null;

  const { fotos, anexos } = particionarEvidencias(evidencias);
  // Microcopy UX: omitir bloco "0 evidências"; só listamos o que existe.
  const gallery = fotos.map((foto, index) => ({
    id: foto.id,
    src: foto.url,
    alt: `${altPrefix} — evidência ${index + 1}`,
  }));

  return (
    <div className="mt-2 space-y-2">
      {fotos.length ? (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold text-[var(--ink-3)]">
            Evidências ({fotos.length})
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {fotos.map((foto, index) => (
              <button
                key={foto.id}
                type="button"
                data-testid="evidencia-foto-thumb"
                onClick={() => setFotoIndex(index)}
                className="group relative block w-full overflow-hidden rounded-[var(--r-md)] border border-[var(--line)] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                aria-label={`Ampliar ${gallery[index].alt}`}
              >
                <AuthenticatedImage src={foto.url} alt={gallery[index].alt} className="aspect-[4/3] w-full object-cover" />
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/25">
                  <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white opacity-0 transition group-hover:opacity-100">
                    <ZoomIn className="h-3.5 w-3.5" />
                    Ampliar
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {anexos.length ? (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold text-[var(--ink-3)]">Anexos</p>
          <ul className="space-y-1.5">
            {anexos.map((anexo, index) => {
              const nome = rotuloAnexo(anexo, index);
              return (
                <li
                  key={anexo.id}
                  data-testid="evidencia-anexo"
                  className="flex flex-wrap items-center gap-2 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2"
                >
                  <FileText className="h-4 w-4 shrink-0 text-[var(--ink-3)]" />
                  <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-[var(--ink-2)]">{nome}</span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--brand)] hover:underline"
                    onClick={() => void abrirStorageAutenticado(anexo.url)}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Abrir anexo
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--brand)] hover:underline"
                    onClick={() => void baixarStorageAutenticado(anexo.url, nome)}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Baixar
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {fotoIndex != null ? (
        <ImageGalleryLightbox
          fotos={gallery}
          index={fotoIndex}
          onIndexChange={setFotoIndex}
          onClose={() => setFotoIndex(null)}
        />
      ) : null}
    </div>
  );
}

// Re-export helpers used by testes/documentação
export { isEvidenciaImagem, particionarEvidencias };
