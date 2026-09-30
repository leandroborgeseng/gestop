'use client';

import { ChangeEvent, useMemo, useState } from 'react';
import { ChecklistItemCard } from '@/components/mobile/checklist-item-card';
import { Button } from '@/components/ui/button';
import { useSnackbar } from '@/components/ui/snackbar';
import { concluirDocumento, salvarDocumentoRespostas } from '@/lib/api';
import {
  getResponseEvidencias,
  newEvidenceId,
  validateItemResponse,
  type ResponseDraft,
} from '@/lib/checklist-response-draft';
import type { ChecklistItem, DocumentoDetalhe } from '@/lib/types';

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Falha ao ler o anexo.'));
    reader.readAsDataURL(file);
  });
}

function draftFromResposta(documento: DocumentoDetalhe, itemId: string): ResponseDraft | undefined {
  const resposta = (documento.respostas ?? []).find((item) => item.itemId === itemId);
  if (!resposta) return undefined;
  const stored = (resposta.evidencias ?? [])
    .filter((item) => item.url)
    .map((item, index) => ({
      id: `stored-${itemId}-${index}`,
      dataUrl: item.url,
      mimeType: item.mimeType ?? undefined,
    }));
  return {
    conformidade: 'CONFORME',
    comentario: resposta.comentario ?? '',
    valorTexto: resposta.valorTexto ?? (resposta.valorNumero != null ? String(resposta.valorNumero) : ''),
    valorNumero: resposta.valorNumero ?? undefined,
    valorBooleano: resposta.valorBooleano ?? null,
    evidencias: stored,
  };
}

function itemHasAnswer(item: ChecklistItem, draft?: ResponseDraft) {
  if (!draft) return false;
  if (item.tipo === 'BOOLEANO') return draft.valorBooleano != null;
  if (item.tipo === 'FOTO' || item.tipo === 'ASSINATURA') return getResponseEvidencias(draft).length > 0;
  if (draft.valorTexto?.trim()) return true;
  if (draft.comentario?.trim()) return true;
  if (item.exigeEvidencia && getResponseEvidencias(draft).length > 0) return true;
  return false;
}

export function DocumentoAvulsoForm({
  documento,
  onSaved,
}: {
  documento: DocumentoDetalhe;
  onSaved: () => void | Promise<void>;
}) {
  const snackbar = useSnackbar();
  const itens = useMemo(
    () => [...(documento.checklistItens ?? [])].sort((a, b) => a.ordem - b.ordem),
    [documento.checklistItens],
  );
  const [drafts, setDrafts] = useState<Record<string, ResponseDraft>>(() => {
    const initial: Record<string, ResponseDraft> = {};
    for (const item of documento.checklistItens ?? []) {
      const draft = draftFromResposta(documento, item.id);
      if (draft) initial[item.id] = draft;
    }
    return initial;
  });
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [busy, setBusy] = useState<'salvar' | 'concluir' | null>(null);

  function patchDraft(itemId: string, patch: Partial<ResponseDraft>) {
    setPendingIds((current) => current.filter((id) => id !== itemId));
    setDrafts((current) => ({
      ...current,
      [itemId]: {
        conformidade: 'CONFORME',
        comentario: '',
        ...current[itemId],
        ...patch,
      },
    }));
  }

  async function handleEvidence(itemId: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setDrafts((current) => {
      const previous = current[itemId] ?? { conformidade: 'CONFORME' as const, comentario: '' };
      return {
        ...current,
        [itemId]: {
          ...previous,
          evidencias: [
            ...getResponseEvidencias(previous),
            { id: newEvidenceId(), dataUrl, mimeType: file.type, size: file.size },
          ],
        },
      };
    });
    setPendingIds((current) => current.filter((id) => id !== itemId));
  }

  function buildPayload() {
    return itens
      .filter((item) => drafts[item.id])
      .map((item) => {
        const draft = drafts[item.id];
        const novas = getResponseEvidencias(draft).filter((itemEvidencia) => itemEvidencia.dataUrl.startsWith('data:'));
        const numero =
          item.tipo === 'NUMERO' && draft.valorTexto?.trim() ? Number(draft.valorTexto.replace(',', '.')) : null;
        return {
          itemId: item.id,
          valorTexto: draft.valorTexto?.trim() || null,
          valorNumero: numero != null && Number.isFinite(numero) ? numero : null,
          valorBooleano: item.tipo === 'BOOLEANO' ? (draft.valorBooleano ?? null) : null,
          comentario: draft.comentario?.trim() || null,
          evidenciaDataUrls: novas.map((itemEvidencia) => itemEvidencia.dataUrl),
        };
      });
  }

  function collectPendencias() {
    const ids: string[] = [];
    const messages: string[] = [];
    for (const item of itens) {
      const message = validateItemResponse(item, itemHasAnswer(item, drafts[item.id]) ? drafts[item.id] : undefined);
      if (message) {
        ids.push(item.id);
        messages.push(message);
      }
    }
    return { ids, messages };
  }

  async function salvar(concluir: boolean) {
    if (concluir) {
      const pendencias = collectPendencias();
      if (pendencias.ids.length) {
        setPendingIds(pendencias.ids);
        snackbar.show(pendencias.messages[0] ?? 'Preencha os itens obrigatórios destacados.', 'error');
        return;
      }
    }
    setBusy(concluir ? 'concluir' : 'salvar');
    try {
      await salvarDocumentoRespostas(documento.id, { respostas: buildPayload() });
      if (concluir) {
        await concluirDocumento(documento.id);
      }
      snackbar.show(concluir ? 'Documento concluído.' : 'Rascunho salvo.', 'success');
      setPendingIds([]);
      await onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao salvar o documento.';
      if (concluir) {
        const highlighted = itens.filter((item) => message.includes(item.titulo)).map((item) => item.id);
        if (highlighted.length) setPendingIds(highlighted);
      }
      snackbar.show(message, 'error');
    } finally {
      setBusy(null);
    }
  }

  if (itens.length === 0) {
    return (
      <p className="text-[13px] text-[var(--ink-3)]">
        Este rascunho não tem itens de checklist para preencher.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-[14px] font-semibold text-[var(--ink)]">Preencher documento</h3>
        <p className="text-[12px] text-[var(--ink-3)]">
          Responda os itens na ordem do modelo. O rascunho pode ser salvo sem completar os obrigatórios. A conclusão
          destaca o que ainda falta.
        </p>
      </div>
      {itens.map((item) => {
        const pending = pendingIds.includes(item.id);
        return (
          <div
            key={item.id}
            className={pending ? 'rounded-[16px] ring-2 ring-[var(--danger)]' : undefined}
          >
            {pending ? (
              <p className="mb-1 text-[12px] font-semibold text-[var(--danger)]">Item obrigatório pendente</p>
            ) : null}
            <ChecklistItemCard
              item={item}
              value={drafts[item.id]}
              ocultarConformidade
              onChange={(patch) => patchDraft(item.id, patch)}
              onEvidence={(event) => void handleEvidence(item.id, event)}
              onRemoveEvidence={(evidenceId) => {
                if (evidenceId.startsWith('stored-')) {
                  snackbar.show('Anexos já salvos permanecem no documento.', 'error');
                  return;
                }
                patchDraft(item.id, {
                  evidencias: getResponseEvidencias(drafts[item.id]).filter((itemEvidencia) => itemEvidencia.id !== evidenceId),
                });
              }}
            />
          </div>
        );
      })}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outlined" size="sm" disabled={busy != null} onClick={() => void salvar(false)}>
          {busy === 'salvar' ? 'Salvando…' : 'Salvar rascunho'}
        </Button>
        <Button type="button" variant="filled" size="sm" disabled={busy != null} onClick={() => void salvar(true)}>
          {busy === 'concluir' ? 'Concluindo…' : 'Concluir documento'}
        </Button>
      </div>
    </div>
  );
}

export function DocumentoAvulsoRespostasLeitura({ documento }: { documento: DocumentoDetalhe }) {
  const itens = [...(documento.checklistItens ?? [])].sort((a, b) => a.ordem - b.ordem);
  const respostas = documento.respostas ?? [];
  if (itens.length === 0 && respostas.length === 0) return null;

  const rows = itens.length
    ? itens.map((item) => ({ item, resposta: respostas.find((entry) => entry.itemId === item.id) }))
    : respostas.map((resposta) => ({
        item: {
          id: resposta.itemId,
          titulo: resposta.item?.titulo ?? 'Item',
          obrigatorio: resposta.item?.obrigatorio ?? false,
        },
        resposta,
      }));

  return (
    <div className="space-y-2">
      <h3 className="text-[14px] font-semibold text-[var(--ink)]">Respostas</h3>
      <ul className="space-y-2">
        {rows.map(({ item, resposta }) => (
          <li key={item.id} className="rounded-[12px] border border-[var(--line)] bg-[var(--canvas-2)] px-3 py-2">
            <p className="text-[13px] font-medium text-[var(--ink)]">
              {item.titulo}
              {item.obrigatorio ? <span className="text-[var(--danger)]"> *</span> : null}
            </p>
            <p className="mt-0.5 text-[12px] text-[var(--ink-2)]">
              {resposta?.valorTexto?.trim() ||
                (resposta?.valorNumero != null ? String(resposta.valorNumero) : '') ||
                (resposta?.valorBooleano === true ? 'Sim' : resposta?.valorBooleano === false ? 'Não' : '—')}
            </p>
            {resposta?.comentario?.trim() ? (
              <p className="mt-1 text-[12px] text-[var(--ink-3)]">{resposta.comentario}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
