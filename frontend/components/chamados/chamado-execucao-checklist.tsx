'use client';

import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
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

function parseOpcoes(opcoes: unknown): string[] {
  if (Array.isArray(opcoes)) return opcoes.map(String);
  if (opcoes && typeof opcoes === 'object' && Array.isArray((opcoes as { opcoes?: unknown }).opcoes)) {
    return ((opcoes as { opcoes: unknown[] }).opcoes).map(String);
  }
  return [];
}

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
        {checklist.itens.map((item) => (
          <ChecklistPergunta
            key={item.id}
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
  const opcoes = parseOpcoes(item.opcoes);

  return (
    <div className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-[var(--ink)]">
            {item.titulo}
            {item.obrigatorio ? <span className="text-[var(--danger)]"> *</span> : null}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--ink-3)]">
            {item.codigo}
            {item.exigeEvidencia ? ' · Exige evidência' : ''}
          </p>
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
      Boolean(draft?.valorTexto?.trim()) ||
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
