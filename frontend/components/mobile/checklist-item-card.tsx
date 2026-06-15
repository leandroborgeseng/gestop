'use client';

import { ChangeEvent } from 'react';
import { Camera } from 'lucide-react';
import { ChecklistItem } from '@/lib/types';
import {
  parseMultiplaEscolhaOpcoes,
  parseTextoOpcoes,
} from '@/lib/checklist-item-opcoes';
import { Card, CardContent } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

export type ResponseDraft = {
  conformidade: 'CONFORME' | 'NAO_CONFORME' | 'NAO_APLICAVEL';
  comentario: string;
  valorTexto?: string;
  evidenceDataUrl?: string;
  evidenceMimeType?: string;
  evidenceSize?: number;
};

export function ChecklistItemCard({
  item,
  value,
  onChange,
  onEvidence,
}: {
  item: ChecklistItem;
  value?: ResponseDraft;
  onChange: (patch: Partial<ResponseDraft>) => void;
  onEvidence: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const current = value ?? { conformidade: 'CONFORME', comentario: '' };
  const multiplaEscolha = parseMultiplaEscolhaOpcoes(item.opcoes);
  const opcoesVisiveis = multiplaEscolha.opcoes.map((opcao) => opcao.trim()).filter(Boolean);
  const textoOpcoes = parseTextoOpcoes(item.opcoes);
  const needsEvidence =
    item.tipo === 'FOTO' ||
    item.tipo === 'ASSINATURA' ||
    (current.conformidade === 'NAO_CONFORME' && item.exigeEvidencia);

  return (
    <Card elevation={1}>
      <CardContent className="space-y-4 p-4">
        <Chip variant="brand">{item.codigo}</Chip>
        <h3 className="md-title-md text-[var(--md-on-surface)]">{item.titulo}</h3>
        {item.descricao ? (
          <p className="md-body-md text-[var(--md-on-surface-variant)]">{item.descricao}</p>
        ) : null}

        {item.tipo === 'BOOLEANO' ? (
          <Select
            value={current.conformidade}
            onChange={(e) => onChange({ conformidade: e.target.value as ResponseDraft['conformidade'] })}
          >
            <option value="CONFORME">Conforme</option>
            <option value="NAO_CONFORME">Não conforme</option>
            <option value="NAO_APLICAVEL">Não aplicável</option>
          </Select>
        ) : (
          <>
            <Field label="Resposta">
              {item.tipo === 'TEXTO' ? (
                textoOpcoes.formato === 'LONGO' ? (
                  <textarea
                    value={current.valorTexto ?? ''}
                    onChange={(e) => onChange({ valorTexto: e.target.value })}
                    placeholder="Descreva a verificação"
                    className="min-h-28 w-full resize-y rounded-[var(--md-shape-sm)] border border-[var(--md-outline)] bg-[var(--md-surface-container-lowest)] p-4 md-body-md focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-4 focus:ring-[color-mix(in_srgb,var(--color-brand-primary)_12%,transparent)]"
                  />
                ) : (
                  <Input
                    value={current.valorTexto ?? ''}
                    onChange={(e) => onChange({ valorTexto: e.target.value })}
                    placeholder="Descreva a verificação"
                  />
                )
              ) : null}
              {item.tipo === 'NUMERO' ? (
                <Input
                  type="number"
                  value={current.valorTexto ?? ''}
                  onChange={(e) => onChange({ valorTexto: e.target.value })}
                />
              ) : null}
              {item.tipo === 'DATA' ? (
                <Input
                  type="date"
                  value={current.valorTexto ?? ''}
                  onChange={(e) => onChange({ valorTexto: e.target.value })}
                />
              ) : null}
              {item.tipo === 'MULTIPLA_ESCOLHA' ? (
                multiplaEscolha.modoExibicao === 'LISTA' ? (
                  <div className="flex flex-wrap gap-2">
                    {opcoesVisiveis.map((opcao, optionIndex) => (
                      <Chip
                        key={`${opcao}-${optionIndex}`}
                        active={current.valorTexto === opcao}
                        onClick={() => onChange({ valorTexto: opcao })}
                      >
                        {opcao}
                      </Chip>
                    ))}
                  </div>
                ) : (
                  <Select
                    value={current.valorTexto ?? ''}
                    onChange={(e) => onChange({ valorTexto: e.target.value })}
                  >
                    <option value="">Selecione</option>
                    {opcoesVisiveis.map((opcao) => (
                      <option key={opcao} value={opcao}>
                        {opcao}
                      </option>
                    ))}
                  </Select>
                )
              ) : null}
              {item.tipo === 'FOTO' || item.tipo === 'ASSINATURA' ? (
                <p className="md-body-md text-[var(--md-on-surface-variant)]">
                  Anexe {item.tipo === 'ASSINATURA' ? 'a assinatura' : 'a foto'} abaixo.
                </p>
              ) : null}
            </Field>
            <Select
              value={current.conformidade}
              onChange={(e) => onChange({ conformidade: e.target.value as ResponseDraft['conformidade'] })}
            >
              <option value="CONFORME">Conforme</option>
              <option value="NAO_CONFORME">Não conforme</option>
              <option value="NAO_APLICAVEL">Não aplicável</option>
            </Select>
          </>
        )}

        <textarea
          value={current.comentario}
          onChange={(e) => onChange({ comentario: e.target.value })}
          placeholder="Observação"
          className="min-h-28 w-full rounded-[var(--md-shape-sm)] border border-[var(--md-outline)] bg-[var(--md-surface-container-lowest)] p-4 md-body-md focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-4 focus:ring-[color-mix(in_srgb,var(--color-brand-primary)_12%,transparent)]"
        />

        {(needsEvidence || item.tipo === 'FOTO' || item.tipo === 'ASSINATURA') ? (
          <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-[var(--md-shape-md)] border border-dashed border-[var(--md-outline)] bg-[var(--md-surface-container-low)] px-3 md-label-lg text-[var(--md-on-surface-variant)] transition hover:bg-[var(--md-surface-container)]">
            <Camera className="h-5 w-5" />
            {current.evidenceDataUrl ? 'Arquivo anexado' : item.tipo === 'ASSINATURA' ? 'Anexar assinatura' : 'Anexar foto'}
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onEvidence} />
          </label>
        ) : null}

        {item.geraNaoConformidade ? (
          <p className="md-body-md text-[var(--md-on-surface-variant)]">Item gera não conformidade se marcado como não conforme.</p>
        ) : null}
        {needsEvidence && current.conformidade === 'NAO_CONFORME' ? (
          <p className="md-body-md text-amber-700">Não conformidade exige evidência e comentário.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function validateItemResponse(item: ChecklistItem, response?: ResponseDraft) {
  if (!item.obrigatorio) return null;
  if (!response) return `Preencha o item obrigatório: ${item.titulo}.`;

  const needsValue = ['TEXTO', 'NUMERO', 'DATA', 'MULTIPLA_ESCOLHA'].includes(item.tipo);
  if (needsValue && !response.valorTexto?.trim()) {
    return `Informe a resposta do item: ${item.titulo}.`;
  }

  const needsEvidence =
    item.tipo === 'FOTO' ||
    item.tipo === 'ASSINATURA' ||
    (response.conformidade === 'NAO_CONFORME' && item.exigeEvidencia);

  if (needsEvidence && !response.evidenceDataUrl) {
    return `Anexe evidência no item: ${item.titulo}.`;
  }

  if (response.conformidade === 'NAO_CONFORME' && item.exigeEvidencia) {
    if (!response.evidenceDataUrl || !response.comentario.trim()) {
      return `Não conformidade exige comentário e evidência: ${item.titulo}.`;
    }
  }

  return null;
}

export function buildRespostaPayload(
  item: ChecklistItem,
  response: ResponseDraft,
  checkin: { latitude: number; longitude: number; precisaoMetros: number },
  capturedAt: string,
) {
  return {
    itemId: item.id,
    conformidade: response.conformidade,
    valorBooleano: item.tipo === 'BOOLEANO' ? response.conformidade === 'CONFORME' : undefined,
    valorTexto: response.valorTexto,
    comentario: response.comentario,
    evidencias: response.evidenceDataUrl
      ? [
          {
            tipo: 'FOTO' as const,
            url: response.evidenceDataUrl,
            mimeType: response.evidenceMimeType,
            tamanhoBytes: response.evidenceSize,
            capturadaEm: capturedAt,
            localizacao: checkin,
          },
        ]
      : [],
  };
}
