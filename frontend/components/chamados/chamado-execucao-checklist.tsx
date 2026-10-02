'use client';

import { CabecalhoSecao } from '@/components/checklists/cabecalho-secao';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  parseMultiplaEscolhaOpcoes,
  parseValoresMultiplaEscolha,
  serializarValoresMultiplaEscolha,
} from '@/lib/checklist-item-opcoes';
import { ChamadoExecucaoDetalhe } from '@/lib/types';

export type ChecklistRespostaDraft = {
  itemId: string;
  naoSeAplica: boolean;
  valorBooleano?: boolean | null;
  valorTexto?: string;
  valorNumero?: number | null;
  comentario?: string;
  evidenciaUrls: string[];
};

type Item = NonNullable<ChamadoExecucaoDetalhe['checklistComplementar']>['itens'][number];

export function ChamadoExecucaoChecklistSection({
  checklist,
  respostas,
  onChange,
  disabled,
}: {
  checklist: NonNullable<ChamadoExecucaoDetalhe['checklistComplementar']>;
  respostas: Record<string, ChecklistRespostaDraft>;
  onChange: (next: Record<string, ChecklistRespostaDraft>) => void;
  disabled?: boolean;
}) {
  function update(itemId: string, patch: Partial<ChecklistRespostaDraft>) {
    const current = respostas[itemId] ?? {
      itemId,
      naoSeAplica: false,
      evidenciaUrls: [],
    };
    onChange({
      ...respostas,
      [itemId]: { ...current, ...patch, itemId },
    });
  }

  return (
    <div className="space-y-3 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-4">
      <div>
        <p className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">
          Perguntas complementares da execução
        </p>
        <p className="mt-1 text-[13px] text-[var(--ink-2)]">{checklist.checklistNome}</p>
      </div>

      <div className="space-y-3">
        {checklist.itens.map((item, index) => (
          <div key={item.id} className="space-y-2">
            <CabecalhoSecao atual={item.secao} anterior={checklist.itens[index - 1]?.secao} />
          <ChecklistPergunta
            item={item}
            draft={
              respostas[item.id] ?? {
                itemId: item.id,
                naoSeAplica: false,
                evidenciaUrls: [],
              }
            }
            disabled={disabled}
            onChange={(patch) => update(item.id, patch)}
          />
          </div>
        ))}
      </div>
    </div>
  );
}

function ChecklistPergunta({
  item,
  draft,
  disabled,
  onChange,
}: {
  item: Item;
  draft: ChecklistRespostaDraft;
  disabled?: boolean;
  onChange: (patch: Partial<ChecklistRespostaDraft>) => void;
}) {
  const config = parseMultiplaEscolhaOpcoes(item.opcoes);
  const opcoes = config.opcoes.map((opcao) => opcao.trim()).filter(Boolean);
  const selecionadas = parseValoresMultiplaEscolha(draft.valorTexto);
  const selecaoMultipla = config.selecao === 'MULTIPLA';

  return (
    <div className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-[var(--ink)]">
            {item.titulo}
            {item.obrigatorio ? <span className="text-[var(--danger)]"> *</span> : null}
          </p>
          {item.exigeEvidencia ? (
            <p className="mt-0.5 text-[11px] text-[var(--ink-3)]">Exige evidência</p>
          ) : null}
        </div>
        <label className="inline-flex items-center gap-1.5 text-[12px] text-[var(--ink-2)]">
          <input
            type="checkbox"
            checked={draft.naoSeAplica}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                naoSeAplica: event.target.checked,
                valorBooleano: null,
                valorTexto: '',
                valorNumero: null,
                evidenciaUrls: [],
              })
            }
          />
          Não se aplica
        </label>
      </div>

      {!draft.naoSeAplica ? (
        <div className="mt-3 space-y-2">
          {item.tipo === 'BOOLEANO' ? (
            <div className="flex flex-wrap gap-2">
              {[
                { value: true, label: 'Sim' },
                { value: false, label: 'Não' },
              ].map((option) => (
                <button
                  key={String(option.value)}
                  type="button"
                  disabled={disabled}
                  className={`rounded-[var(--r-sm)] border px-3 py-1.5 text-[12px] font-semibold ${
                    draft.valorBooleano === option.value
                      ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-hover)]'
                      : 'border-[var(--line)] text-[var(--ink-2)]'
                  }`}
                  onClick={() => onChange({ valorBooleano: option.value })}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}

          {item.tipo === 'MULTIPLA_ESCOLHA' ? (
            selecaoMultipla && config.modoExibicao === 'LISTA' ? (
              <div className="grid gap-2">
                {opcoes.map((opcao) => (
                  <label key={opcao} className="flex min-h-11 items-center gap-2 text-[13px]">
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={selecionadas.includes(opcao)}
                      onChange={() => {
                        const next = selecionadas.includes(opcao)
                          ? selecionadas.filter((atual) => atual !== opcao)
                          : [...selecionadas, opcao];
                        onChange({ valorTexto: serializarValoresMultiplaEscolha(next) });
                      }}
                    />
                    {opcao}
                  </label>
                ))}
              </div>
            ) : selecaoMultipla ? (
              <div className="space-y-2">
                <Select
                  value=""
                  disabled={disabled}
                  onChange={(event) => {
                    const opcao = event.target.value;
                    if (!opcao || selecionadas.includes(opcao)) return;
                    onChange({ valorTexto: serializarValoresMultiplaEscolha([...selecionadas, opcao]) });
                  }}
                >
                  <option value="">Adicionar opção</option>
                  {opcoes.filter((opcao) => !selecionadas.includes(opcao)).map((opcao) => (
                    <option key={opcao} value={opcao}>
                      {opcao}
                    </option>
                  ))}
                </Select>
                <div className="flex flex-wrap gap-1.5">
                  {selecionadas.map((opcao) => (
                    <button
                      key={opcao}
                      type="button"
                      disabled={disabled}
                      className="rounded-full border border-[var(--brand)] bg-[var(--brand-soft)] px-2 py-1 text-[12px]"
                      onClick={() =>
                        onChange({
                          valorTexto: serializarValoresMultiplaEscolha(selecionadas.filter((atual) => atual !== opcao)),
                        })
                      }
                    >
                      {opcao} ×
                    </button>
                  ))}
                </div>
              </div>
            ) : config.modoExibicao === 'LISTA' ? (
              <div className="flex flex-wrap gap-2">
                {opcoes.map((opcao) => (
                  <button
                    key={opcao}
                    type="button"
                    disabled={disabled}
                    className={`rounded-[var(--r-sm)] border px-3 py-1.5 text-[12px] font-semibold ${
                      draft.valorTexto === opcao
                        ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-hover)]'
                        : 'border-[var(--line)] text-[var(--ink-2)]'
                    }`}
                    onClick={() => onChange({ valorTexto: opcao })}
                  >
                    {opcao}
                  </button>
                ))}
              </div>
            ) : (
              <Select
                value={draft.valorTexto ?? ''}
                disabled={disabled}
                onChange={(event) => onChange({ valorTexto: event.target.value })}
              >
                <option value="">Selecione</option>
                {opcoes.map((opcao) => (
                  <option key={opcao} value={opcao}>
                    {opcao}
                  </option>
                ))}
              </Select>
            )
          ) : null}

          {item.tipo === 'TEXTO' || item.tipo === 'DATA' ? (
            <Input
              type={item.tipo === 'DATA' ? 'date' : 'text'}
              value={draft.valorTexto ?? ''}
              disabled={disabled}
              onChange={(event) => onChange({ valorTexto: event.target.value })}
            />
          ) : null}

          {item.tipo === 'NUMERO' ? (
            <Input
              type="number"
              value={draft.valorNumero ?? ''}
              disabled={disabled}
              onChange={(event) =>
                onChange({
                  valorNumero: event.target.value === '' ? null : Number(event.target.value),
                })
              }
            />
          ) : null}

          {item.tipo === 'FOTO' || item.exigeEvidencia ? (
            <Input
              type="url"
              placeholder="URL da evidência (anexo já enviado ou link)"
              value={draft.evidenciaUrls[0] ?? ''}
              disabled={disabled}
              onChange={(event) =>
                onChange({ evidenciaUrls: event.target.value.trim() ? [event.target.value.trim()] : [] })
              }
            />
          ) : null}

          <Input
            placeholder="Observação (opcional)"
            value={draft.comentario ?? ''}
            disabled={disabled}
            onChange={(event) => onChange({ comentario: event.target.value })}
          />
        </div>
      ) : null}
    </div>
  );
}

export function validateChecklistRespostasDraft(
  checklist: NonNullable<ChamadoExecucaoDetalhe['checklistComplementar']> | null | undefined,
  respostas: Record<string, ChecklistRespostaDraft>,
  impedimento: boolean,
) {
  if (!checklist || impedimento) return null;
  for (const item of checklist.itens) {
    const draft = respostas[item.id];
    if (draft?.naoSeAplica) continue;
    if (!item.obrigatorio && !draft) continue;

    const hasValue =
      draft?.valorBooleano != null ||
      (item.tipo === 'MULTIPLA_ESCOLHA'
        ? parseValoresMultiplaEscolha(draft?.valorTexto).length > 0
        : Boolean(draft?.valorTexto?.trim())) ||
      draft?.valorNumero != null ||
      (draft?.evidenciaUrls?.length ?? 0) > 0;

    if (item.obrigatorio && !hasValue) {
      return `Responda a pergunta obrigatória: ${item.titulo}`;
    }
    if (item.exigeEvidencia && !(draft?.evidenciaUrls?.length)) {
      return `Anexe a evidência exigida para: ${item.titulo}`;
    }
  }
  return null;
}

export function toChecklistRespostasPayload(respostas: Record<string, ChecklistRespostaDraft>) {
  return Object.values(respostas).map((item) => ({
    itemId: item.itemId,
    naoSeAplica: item.naoSeAplica,
    valorBooleano: item.naoSeAplica ? null : item.valorBooleano ?? null,
    valorTexto: item.naoSeAplica ? undefined : item.valorTexto,
    valorNumero: item.naoSeAplica ? undefined : item.valorNumero ?? undefined,
    comentario: item.comentario,
    evidenciaUrls: item.naoSeAplica ? [] : item.evidenciaUrls,
  }));
}
