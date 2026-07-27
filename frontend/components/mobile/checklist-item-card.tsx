'use client';

import { ChangeEvent, useRef } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { LikertScale } from '@/components/checklists/likert-scale';
import { ChecklistItem } from '@/lib/types';
import {
  getResponseEvidencias,
  type ResponseDraft,
} from '@/lib/checklist-response-draft';
import {
  LIKERT_CATEGORIA_LABELS,
  parseLikertConfig,
  resolveLikertConformidade,
  resolveLikertNivel,
} from '@/lib/likert-scale';
import {
  CONFORMIDADE_BINARIA_LABELS,
  parseBooleanoOpcoes,
  parseMultiplaEscolhaOpcoes,
  parseTextoOpcoes,
} from '@/lib/checklist-item-opcoes';
import { ZoomableAuthenticatedImage } from '@/components/ui/zoomable-authenticated-image';
import { Card, CardContent } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Field } from '@/components/ui/field';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

export type { EvidenceDraft, ResponseDraft } from '@/lib/checklist-response-draft';
export {
  buildRespostaPayload,
  getResponseEvidencias,
  newEvidenceId,
  validateItemResponse,
} from '@/lib/checklist-response-draft';

function booleanoSelectValue(current: ResponseDraft): '' | 'SIM' | 'NAO' | 'NAO_APLICAVEL' {
  if (current.conformidade === 'NAO_APLICAVEL') return 'NAO_APLICAVEL';
  if (current.valorBooleano === true) return 'SIM';
  if (current.valorBooleano === false) return 'NAO';
  return '';
}

export function ChecklistItemCard({
  item,
  value,
  onChange,
  onEvidence,
  onRemoveEvidence,
}: {
  item: ChecklistItem;
  value?: ResponseDraft;
  onChange: (patch: Partial<ResponseDraft>) => void;
  onEvidence: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveEvidence?: (evidenceId: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const current = value ?? { conformidade: 'CONFORME', comentario: '' };
  const evidencias = getResponseEvidencias(current);
  const multiplaEscolha = parseMultiplaEscolhaOpcoes(item.opcoes);
  const opcoesVisiveis = multiplaEscolha.opcoes.map((opcao) => opcao.trim()).filter(Boolean);
  const likertConfig = parseLikertConfig(item.opcoes);
  const selectedLikert = resolveLikertNivel(current.valorTexto);
  const textoOpcoes = parseTextoOpcoes(item.opcoes);
  const booleanoOpcoes = parseBooleanoOpcoes(item.opcoes);
  const needsEvidence =
    item.tipo === 'FOTO' ||
    item.tipo === 'ASSINATURA' ||
    (current.conformidade === 'NAO_CONFORME' && item.exigeEvidencia);
  const showEvidenceUi = needsEvidence || item.tipo === 'FOTO' || item.tipo === 'ASSINATURA';
  const attachLabel =
    item.tipo === 'ASSINATURA'
      ? evidencias.length > 0
        ? 'Anexar outra assinatura'
        : 'Anexar assinatura'
      : evidencias.length > 0
        ? 'Anexar outra foto'
        : 'Anexar foto';

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
            value={booleanoSelectValue(current)}
            onChange={(e) => {
              const selected = e.target.value;
              if (selected === 'NAO_APLICAVEL') {
                onChange({ valorBooleano: null, conformidade: 'NAO_APLICAVEL' });
                return;
              }
              if (selected === 'SIM') {
                onChange({
                  valorBooleano: true,
                  conformidade: booleanoOpcoes.simConformidade ?? 'CONFORME',
                });
                return;
              }
              if (selected === 'NAO') {
                onChange({
                  valorBooleano: false,
                  conformidade: booleanoOpcoes.naoConformidade ?? 'NAO_CONFORME',
                });
              }
            }}
          >
            <option value="">Selecione</option>
            <option value="SIM">
              Sim ({CONFORMIDADE_BINARIA_LABELS[booleanoOpcoes.simConformidade ?? 'CONFORME']})
            </option>
            <option value="NAO">
              Não ({CONFORMIDADE_BINARIA_LABELS[booleanoOpcoes.naoConformidade ?? 'NAO_CONFORME']})
            </option>
            <option value="NAO_APLICAVEL">Não aplicável</option>
          </Select>
        ) : item.tipo === 'ESCALA_LIKERT' ? (
          <>
            <Field label="Avaliação">
              <LikertScale
                opcoes={likertConfig.opcoes}
                value={current.valorTexto}
                onChange={(nivel) =>
                  onChange({
                    valorTexto: nivel.id,
                    valorNumero: nivel.pontuacao,
                    conformidade: resolveLikertConformidade(nivel, likertConfig.opcoes),
                  })
                }
              />
            </Field>
            {selectedLikert ? (
              <p className="text-[13px] text-[var(--md-on-surface-variant)]">
                Pontuação <strong className="text-[var(--md-on-surface)]">{selectedLikert.pontuacao}/10</strong> ·{' '}
                categoria <strong className="text-[var(--md-on-surface)]">{LIKERT_CATEGORIA_LABELS[selectedLikert.categoria]}</strong>{' '}
                · registrado como{' '}
                <strong className="text-[var(--md-on-surface)]">
                  {current.conformidade === 'NAO_CONFORME' ? 'não conforme' : 'conforme'}
                </strong>
              </p>
            ) : null}
          </>
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

        {showEvidenceUi ? (
          <div className="space-y-3">
            <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-[var(--md-shape-md)] border border-dashed border-[var(--md-outline)] bg-[var(--md-surface-container-low)] px-3 md-label-lg text-[var(--md-on-surface-variant)] transition hover:bg-[var(--md-surface-container)]">
              <Camera className="h-5 w-5" />
              {attachLabel}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(event) => {
                  onEvidence(event);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              />
            </label>

            {evidencias.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {evidencias.map((evidencia, index) => (
                  <div
                    key={evidencia.id}
                    className="group relative overflow-hidden rounded-[var(--md-shape-sm)] border border-[var(--md-outline)] bg-[var(--md-surface-container-lowest)]"
                  >
                    <ZoomableAuthenticatedImage
                      src={evidencia.dataUrl}
                      alt={`Evidência ${index + 1} — ${item.titulo}`}
                      className="aspect-[4/3] w-full object-cover"
                    />
                    {onRemoveEvidence ? (
                      <IconButton
                        type="button"
                        size="sm"
                        variant="filled"
                        className="absolute top-1.5 right-1.5 bg-black/55 text-white hover:bg-black/75"
                        aria-label={`Remover evidência ${index + 1}`}
                        onClick={() => onRemoveEvidence(evidencia.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </IconButton>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {item.geraNaoConformidade && current.conformidade === 'NAO_CONFORME' ? (
          <div className="space-y-2 rounded-[var(--md-shape-sm)] border border-[var(--md-outline)] bg-[var(--md-surface-container-low)] p-3">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-[var(--color-brand-primary)]"
                checked={current.gerarChamado !== false}
                onChange={(e) => onChange({ gerarChamado: e.target.checked })}
              />
              <span className="space-y-1">
                <span className="block md-label-lg text-[var(--md-on-surface)]">
                  Gerar chamado / Abrir chamado automaticamente
                </span>
                <span className="block md-body-md text-[var(--md-on-surface-variant)]">
                  Esta resposta pode gerar chamado de não conformidade. Desmarque se já existir chamado
                  pendente para este problema.
                </span>
              </span>
            </label>
          </div>
        ) : item.geraNaoConformidade ? (
          <p className="md-body-md text-[var(--md-on-surface-variant)]">
            Item gera chamado NC se marcado como não conforme.
          </p>
        ) : null}
        {needsEvidence && current.conformidade === 'NAO_CONFORME' ? (
          <p className="md-body-md text-amber-700">Não conformidade exige evidência fotográfica e comentário.</p>
        ) : null}
        {needsEvidence && evidencias.length === 0 ? (
          <p className="md-body-md text-amber-700">Esta pergunta exige evidência fotográfica.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
