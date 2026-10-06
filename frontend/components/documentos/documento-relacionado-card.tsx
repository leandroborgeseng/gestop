'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  assinaturasVigentesDoCard,
  resolvePodeColetar,
  rotuloAssinaturaVigente,
  rotuloSignatarioPendente,
  signatariosPendentesDoCard,
} from '@/components/documentos/documentos-relacionados-acoes';
import { DOCUMENTO_SITUACAO_META, DOCUMENTO_TIPO_LABELS } from '@/lib/documento-status';
import type { DocumentoResumo } from '@/lib/types';

export type DocumentoRelacionadoAcao = 'preencher' | 'ver' | 'assinar' | 'encaminhar' | 'coletar';

export type DocumentoRelacionadoCardProps = {
  item: DocumentoResumo;
  permissoes: string[];
  user?: { perfilAtivo?: { nome?: string } | null; perfis?: string[] } | null;
  podePreencher: boolean;
  podeAssinar: boolean;
  podeEncaminhar: boolean;
  canAbrirCadastro: boolean;
  ocultarCadastroSemPermissao?: boolean;
  onAcao: (id: string, modo: DocumentoRelacionadoAcao) => void;
  onPdfOriginal: (id: string, codigo: string) => void;
  onPdfAssinado: (id: string, codigo: string) => void;
};

export function DocumentoRelacionadoCard({
  item,
  permissoes,
  user,
  podePreencher,
  podeAssinar,
  podeEncaminhar,
  canAbrirCadastro,
  ocultarCadastroSemPermissao = false,
  onAcao,
  onPdfOriginal,
  onPdfAssinado,
}: DocumentoRelacionadoCardProps) {
  const situacao = DOCUMENTO_SITUACAO_META[item.situacao];
  const pendentes = signatariosPendentesDoCard(item);
  const assinados = assinaturasVigentesDoCard(item);
  const podeColetar = resolvePodeColetar(permissoes, user);

  return (
    <li className="rounded-[12px] border border-[var(--line)] bg-[var(--canvas)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex-1">
          <p className="mono text-[12px] font-semibold text-[var(--brand-hover)]">{item.codigo}</p>
          <p className="mt-0.5 text-[13px] font-medium text-[var(--ink)]">{item.titulo}</p>
          <p className="text-[12px] text-[var(--ink-3)]">
            {DOCUMENTO_TIPO_LABELS[item.tipo]} · {new Date(item.createdAt).toLocaleString('pt-BR')}
          </p>
          {pendentes.length > 0 ? (
            <div className="mt-2 space-y-1">
              <p className="text-[11px] font-medium text-[var(--ink-2)]">Signatários internos pendentes:</p>
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
            <Button type="button" size="sm" variant="filled" onClick={() => onAcao(item.id, 'preencher')}>
              Preencher
            </Button>
          ) : (
            <Button type="button" size="sm" variant="outlined" disabled title="Sem permissão para preencher o documento">
              Preencher
            </Button>
          )
        ) : null}
        {canAbrirCadastro ? (
          <a href={`/documentos?id=${item.id}`}>
            <Button type="button" size="sm" variant="outlined">
              Abrir
            </Button>
          </a>
        ) : ocultarCadastroSemPermissao ? null : (
          <Button type="button" size="sm" variant="outlined" disabled title="Sem permissão para abrir o cadastro do documento">
            Abrir
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" onClick={() => onAcao(item.id, 'ver')}>
          Ver respostas do documento
        </Button>
        {item.possuiPdfOriginal ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => onPdfOriginal(item.id, item.codigo)}>
            PDF original
          </Button>
        ) : null}
        {item.possuiPdfAssinado ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => onPdfAssinado(item.id, item.codigo)}>
            PDF assinado
          </Button>
        ) : null}
        {item.possuiPdfOriginal && item.situacao !== 'RASCUNHO' && item.situacao !== 'CANCELADO' && podeAssinar ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => onAcao(item.id, 'assinar')}>
            Assinar com usuário e senha
          </Button>
        ) : null}
        {item.possuiPdfOriginal && item.situacao !== 'RASCUNHO' && item.situacao !== 'CANCELADO' && podeEncaminhar ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => onAcao(item.id, 'encaminhar')}>
            Encaminhar para assinatura
          </Button>
        ) : null}
        {item.possuiPdfOriginal && item.situacao !== 'CANCELADO' && podeColetar ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => onAcao(item.id, 'coletar')}>
            Coletar nova assinatura
          </Button>
        ) : null}
      </div>
      {!canAbrirCadastro && !ocultarCadastroSemPermissao ? (
        <p className="mt-1.5 text-[11px] text-[var(--ink-3)]">Sem permissão para abrir o cadastro do documento</p>
      ) : null}
    </li>
  );
}
