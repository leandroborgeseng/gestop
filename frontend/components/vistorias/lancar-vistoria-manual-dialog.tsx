'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { ClipboardPen } from 'lucide-react';
import {
  buildRespostaPayload,
  ChecklistItemCard,
  getResponseEvidencias,
  newEvidenceId,
  ResponseDraft,
  validateItemResponse,
} from '@/components/mobile/checklist-item-card';
import { getPublishedVersion } from '@/components/checklists/checklist-shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Sheet } from '@/components/ui/sheet';
import { useSnackbar } from '@/components/ui/snackbar';
import { LoadingState } from '@/components/ui-states';
import { UsuarioSinglePicker } from '@/components/usuarios/usuario-multi-picker';
import { getFiscalizacaoOpcoesManuais, getStoredAuth, lancarVistoriaManual } from '@/lib/api';
import { filterChecklistsForUnidade } from '@/lib/checklist-matching';
import { formatUnidadeTipo } from '@/lib/unidade-tipo';
import type { FiscalizacaoOpcoesManuais, UsuarioExecucaoOpcao } from '@/lib/types';

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Falha ao ler arquivo.'));
    reader.readAsDataURL(file);
  });
}

function toDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function LancarVistoriaManualDialog({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const snackbar = useSnackbar();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opcoes, setOpcoes] = useState<FiscalizacaoOpcoesManuais | null>(null);
  const [unidadeId, setUnidadeId] = useState('');
  const [checklistId, setChecklistId] = useState('');
  const [dataVistoria, setDataVistoria] = useState(toDateInputValue());
  const [observacoes, setObservacoes] = useState('');
  const [responses, setResponses] = useState<Record<string, ResponseDraft>>({});
  const [realizadaPorId, setRealizadaPorId] = useState('');
  const [realizadaPorUser, setRealizadaPorUser] = useState<UsuarioExecucaoOpcao | null>(null);
  const [realizadaPorNome, setRealizadaPorNome] = useState('');
  const [usarNomeLivre, setUsarNomeLivre] = useState(false);
  const authUser = useMemo(() => getStoredAuth()?.user ?? null, []);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError(null);
    getFiscalizacaoOpcoesManuais()
      .then((data) => {
        if (!active) return;
        setOpcoes(data);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Falha ao carregar opções.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setUnidadeId('');
      setChecklistId('');
      setDataVistoria(toDateInputValue());
      setObservacoes('');
      setResponses({});
      setRealizadaPorId(authUser?.id ?? '');
      setRealizadaPorUser(
        authUser
          ? {
              id: authUser.id,
              nome: authUser.nome,
              email: authUser.email,
              cpf: null,
              cargo: null,
            }
          : null,
      );
      setRealizadaPorNome('');
      setUsarNomeLivre(false);
      setError(null);
      setSubmitting(false);
    } else if (authUser) {
      setRealizadaPorId(authUser.id);
      setRealizadaPorUser({
        id: authUser.id,
        nome: authUser.nome,
        email: authUser.email,
        cpf: null,
        cargo: null,
      });
    }
  }, [open, authUser]);

  const selectedUnit = useMemo(
    () => opcoes?.unidades.find((unidade) => unidade.id === unidadeId) ?? null,
    [opcoes, unidadeId],
  );

  const availableChecklists = useMemo(
    () => (selectedUnit && opcoes ? filterChecklistsForUnidade(opcoes.checklists, selectedUnit) : []),
    [opcoes, selectedUnit],
  );

  const selectedChecklist = useMemo(
    () => availableChecklists.find((checklist) => checklist.id === checklistId) ?? null,
    [availableChecklists, checklistId],
  );

  const selectedVersion = useMemo(
    () => (selectedChecklist ? getPublishedVersion(selectedChecklist.versoes) : null),
    [selectedChecklist],
  );

  useEffect(() => {
    if (!checklistId) return;
    if (!availableChecklists.some((checklist) => checklist.id === checklistId)) {
      setChecklistId('');
      setResponses({});
    }
  }, [availableChecklists, checklistId]);

  function updateResponse(itemId: string, patch: Partial<ResponseDraft>) {
    setResponses((current) => ({
      ...current,
      [itemId]: {
        ...(current[itemId] ?? { conformidade: 'CONFORME', comentario: '' }),
        ...patch,
      },
    }));
  }

  async function handleEvidence(itemId: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setResponses((current) => {
      const previous = current[itemId] ?? { conformidade: 'CONFORME' as const, comentario: '' };
      const evidencias = [
        ...getResponseEvidencias(previous),
        {
          id: newEvidenceId(),
          dataUrl,
          mimeType: file.type,
          size: file.size,
        },
      ];
      return {
        ...current,
        [itemId]: {
          ...previous,
          evidencias,
          evidenceDataUrl: undefined,
          evidenceMimeType: undefined,
          evidenceSize: undefined,
        },
      };
    });
  }

  function handleRemoveEvidence(itemId: string, evidenceId: string) {
    setResponses((current) => {
      const previous = current[itemId];
      if (!previous) return current;
      const evidencias = getResponseEvidencias(previous).filter((item) => item.id !== evidenceId);
      return {
        ...current,
        [itemId]: {
          ...previous,
          evidencias,
          evidenceDataUrl: undefined,
          evidenceMimeType: undefined,
          evidenceSize: undefined,
        },
      };
    });
  }

  async function handleSubmit() {
    setError(null);
    if (!selectedUnit || !selectedVersion) {
      setError('Selecione o próprio e o checklist.');
      return;
    }
    if (!dataVistoria) {
      setError('Informe a data da vistoria.');
      return;
    }
    if (!usarNomeLivre && !realizadaPorId) {
      setError('Informe quem realizou a vistoria em campo.');
      return;
    }
    if (usarNomeLivre && !realizadaPorNome.trim()) {
      setError('Informe o nome de quem realizou a vistoria em campo.');
      return;
    }

    const dataVistoriaIso = new Date(`${dataVistoria}T12:00:00`).toISOString();
    if (Number.isNaN(new Date(dataVistoriaIso).getTime())) {
      setError('Data da vistoria inválida.');
      return;
    }

    const invalidMessage = selectedVersion.itens
      .map((item) => validateItemResponse(item, responses[item.id]))
      .find(Boolean);
    if (invalidMessage) {
      setError(invalidMessage);
      return;
    }

    const fallbackGeo = {
      latitude: 0,
      longitude: 0,
      precisaoMetros: 0,
    };

    setSubmitting(true);
    try {
      await lancarVistoriaManual({
        unidadeId: selectedUnit.id,
        checklistVersaoId: selectedVersion.id,
        dataVistoria: dataVistoriaIso,
        observacoes: observacoes.trim() || undefined,
        realizadaPorId: usarNomeLivre ? undefined : realizadaPorId,
        realizadaPorNome: usarNomeLivre ? realizadaPorNome.trim() : undefined,
        respostas: selectedVersion.itens.map((item) =>
          buildRespostaPayload(
            item,
            responses[item.id] ?? { conformidade: 'CONFORME', comentario: '' },
            fallbackGeo,
            dataVistoriaIso,
          ),
        ),
      });
      snackbar.show('Vistoria manual lançada com sucesso.', 'success');
      onSuccess?.();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao lançar vistoria manual.';
      setError(message);
      snackbar.show(message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Lançar vistoria manual"
      className="md:max-w-2xl"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outlined" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button variant="filled" onClick={() => void handleSubmit()} disabled={submitting || loading}>
            <ClipboardPen className="mr-1.5 h-4 w-4" />
            {submitting ? 'Salvando...' : 'Lançar vistoria'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-[13px] text-[var(--ink-3)]">
          Use para registrar no sistema uma vistoria feita em papel. A data informada é a data real da vistoria; a data
          de lançamento fica na auditoria. O raio GPS é ignorado.
        </p>
        {error ? <Alert variant="error">{error}</Alert> : null}
        {loading ? <LoadingState label="Carregando opções..." /> : null}

        {opcoes ? (
          <>
            <Field label="Próprio">
              <Select
                value={unidadeId}
                onChange={(event) => {
                  setUnidadeId(event.target.value);
                  setChecklistId('');
                  setResponses({});
                }}
              >
                <option value="">Selecione</option>
                {opcoes.unidades.map((unidade) => (
                  <option key={unidade.id} value={unidade.id}>
                    {opcoes.secretariaEscopo?.todas
                      ? `${unidade.secretaria.sigla} · ${unidade.nome} · ${formatUnidadeTipo(unidade.tipo)}`
                      : `${unidade.nome} · ${formatUnidadeTipo(unidade.tipo)}`}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Checklist">
              <Select
                value={checklistId}
                onChange={(event) => {
                  setChecklistId(event.target.value);
                  setResponses({});
                }}
                disabled={!selectedUnit}
              >
                <option value="">{selectedUnit ? 'Selecione' : 'Selecione um próprio primeiro'}</option>
                {availableChecklists.map((checklist) => (
                  <option key={checklist.id} value={checklist.id}>
                    {checklist.nome}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Data da vistoria">
              <input
                type="date"
                value={dataVistoria}
                max={toDateInputValue()}
                onChange={(event) => setDataVistoria(event.target.value)}
                className="h-10 w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-3 text-[13px]"
                required
              />
            </Field>

            {!usarNomeLivre ? (
              <UsuarioSinglePicker
                label="Vistoria realizada por"
                hint="Usuário que efetivamente realizou a vistoria em campo (conta para produtividade)."
                value={realizadaPorId}
                selectedUser={realizadaPorUser}
                preferSecretariaId={selectedUnit?.secretaria.id}
                onChange={(id, user) => {
                  setRealizadaPorId(id);
                  setRealizadaPorUser(user);
                }}
              />
            ) : (
              <Field label="Vistoria realizada por (nome)">
                <input
                  value={realizadaPorNome}
                  onChange={(event) => setRealizadaPorNome(event.target.value)}
                  placeholder="Nome do servidor/funcionário"
                  className="h-10 w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-3 text-[13px]"
                />
              </Field>
            )}
            <button
              type="button"
              className="text-[12px] font-semibold text-[var(--brand)] hover:underline"
              onClick={() => {
                setUsarNomeLivre((current) => !current);
                setRealizadaPorNome('');
                if (usarNomeLivre && authUser) {
                  setRealizadaPorId(authUser.id);
                  setRealizadaPorUser({
                    id: authUser.id,
                    nome: authUser.nome,
                    email: authUser.email,
                    cpf: null,
                    cargo: null,
                  });
                } else {
                  setRealizadaPorId('');
                  setRealizadaPorUser(null);
                }
              }}
            >
              {usarNomeLivre ? 'Selecionar usuário cadastrado' : 'Informar nome sem usuário no sistema'}
            </button>

            <Field label="Observações (opcional)">
              <textarea
                value={observacoes}
                onChange={(event) => setObservacoes(event.target.value)}
                rows={2}
                className="w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px]"
              />
            </Field>

            {selectedVersion ? (
              <section className="space-y-3">
                <p className="text-[12px] font-semibold text-[var(--ink-2)]">
                  Respostas ({selectedVersion.itens.length} itens)
                </p>
                {selectedVersion.itens.map((item) => (
                  <ChecklistItemCard
                    key={item.id}
                    item={item}
                    value={responses[item.id]}
                    onChange={(patch) => updateResponse(item.id, patch)}
                    onEvidence={(event) => void handleEvidence(item.id, event)}
                    onRemoveEvidence={(evidenceId) => handleRemoveEvidence(item.id, evidenceId)}
                  />
                ))}
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </Sheet>
  );
}
