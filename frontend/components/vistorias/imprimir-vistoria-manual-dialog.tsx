'use client';

import { useEffect, useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { getPublishedVersion } from '@/components/checklists/checklist-shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Sheet } from '@/components/ui/sheet';
import { useSnackbar } from '@/components/ui/snackbar';
import { LoadingState } from '@/components/ui-states';
import { downloadVistoriaManualPdf, getFiscalizacaoOpcoesManuais } from '@/lib/api';
import { filterChecklistsForUnidade } from '@/lib/checklist-matching';
import { formatUnidadeTipo, UNIDADE_TIPO_LABELS } from '@/lib/unidade-tipo';
import type { ChecklistModel, FiscalizacaoOpcoesManuais, UnidadeTipo } from '@/lib/types';

function filterUnidadesForChecklist(
  unidades: FiscalizacaoOpcoesManuais['unidades'],
  checklist: ChecklistModel | null,
  tipoFiltro: '' | UnidadeTipo,
) {
  return unidades.filter((unidade) => {
    if (tipoFiltro && unidade.tipo !== tipoFiltro) return false;
    if (!checklist) return true;
    return filterChecklistsForUnidade([checklist], unidade).length > 0;
  });
}

export function ImprimirVistoriaManualDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const snackbar = useSnackbar();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opcoes, setOpcoes] = useState<FiscalizacaoOpcoesManuais | null>(null);
  const [checklistId, setChecklistId] = useState('');
  const [tipo, setTipo] = useState<'' | UnidadeTipo>('');
  const [unidadeIds, setUnidadeIds] = useState<string[]>([]);
  const [ondeEncaminharFotos, setOndeEncaminharFotos] = useState('');

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
      setChecklistId('');
      setTipo('');
      setUnidadeIds([]);
      setOndeEncaminharFotos('');
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const selectedChecklist = useMemo(
    () => opcoes?.checklists.find((item) => item.id === checklistId) ?? null,
    [opcoes, checklistId],
  );
  const selectedVersion = useMemo(
    () => (selectedChecklist ? getPublishedVersion(selectedChecklist.versoes) : null),
    [selectedChecklist],
  );

  const unidadesFiltradas = useMemo(
    () => filterUnidadesForChecklist(opcoes?.unidades ?? [], selectedChecklist, tipo),
    [opcoes, selectedChecklist, tipo],
  );

  useEffect(() => {
    setUnidadeIds(unidadesFiltradas.map((unidade) => unidade.id));
  }, [unidadesFiltradas]);

  function toggleUnidade(id: string) {
    setUnidadeIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function selectAllVisible() {
    setUnidadeIds(unidadesFiltradas.map((unidade) => unidade.id));
  }

  async function handleSubmit() {
    setError(null);
    if (!selectedVersion) {
      setError('Selecione um checklist publicado.');
      return;
    }
    if (unidadeIds.length === 0) {
      setError('Selecione ao menos um próprio.');
      return;
    }
    if (ondeEncaminharFotos.trim().length < 3) {
      setError('Informe onde encaminhar as fotos (mín. 3 caracteres).');
      return;
    }

    setSubmitting(true);
    try {
      await downloadVistoriaManualPdf({
        checklistVersaoId: selectedVersion.id,
        unidadeIds,
        ondeEncaminharFotos: ondeEncaminharFotos.trim(),
      });
      snackbar.show('PDF da vistoria manual gerado.', 'success');
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao gerar PDF.';
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
      title="Imprimir vistoria manual"
      className="md:max-w-2xl"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outlined" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button variant="filled" onClick={() => void handleSubmit()} disabled={submitting || loading}>
            <Printer className="mr-1.5 h-4 w-4" />
            {submitting ? 'Gerando PDF...' : 'Gerar PDF'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-[13px] text-[var(--ink-3)]">
          Gere um PDF com uma página por próprio: dados da unidade, orientação de fotos, chamados pendentes e perguntas
          com checkboxes para preenchimento à caneta.
        </p>
        {error ? <Alert variant="error">{error}</Alert> : null}
        {loading ? <LoadingState label="Carregando checklists e próprios..." /> : null}

        {opcoes ? (
          <>
            <Field label="Checklist">
              <Select
                value={checklistId}
                onChange={(event) => {
                  setChecklistId(event.target.value);
                  setUnidadeIds([]);
                }}
              >
                <option value="">Selecione</option>
                {opcoes.checklists.map((checklist) => (
                  <option key={checklist.id} value={checklist.id}>
                    {checklist.nome}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Tipo de próprio (filtro)">
              <Select value={tipo} onChange={(event) => setTipo(event.target.value as '' | UnidadeTipo)}>
                <option value="">Todos</option>
                {(Object.keys(UNIDADE_TIPO_LABELS) as UnidadeTipo[]).map((item) => (
                  <option key={item} value={item}>
                    {formatUnidadeTipo(item)}
                  </option>
                ))}
              </Select>
            </Field>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <label className="text-[12px] font-semibold text-[var(--ink-2)]">
                  Próprios ({unidadeIds.length} selecionado{unidadeIds.length === 1 ? '' : 's'})
                </label>
                <div className="flex gap-2">
                  <Button type="button" variant="text" size="sm" onClick={selectAllVisible} disabled={!checklistId}>
                    Selecionar todos
                  </Button>
                  <Button type="button" variant="text" size="sm" onClick={() => setUnidadeIds([])}>
                    Limpar
                  </Button>
                </div>
              </div>
              {!checklistId ? (
                <p className="text-[13px] text-[var(--ink-3)]">Selecione um checklist para listar os próprios compatíveis.</p>
              ) : unidadesFiltradas.length === 0 ? (
                <p className="text-[13px] text-[var(--ink-3)]">Nenhum próprio compatível com o filtro atual.</p>
              ) : (
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-[var(--r-md)] border border-[var(--line)] p-2">
                  {unidadesFiltradas.map((unidade) => {
                    const checked = unidadeIds.includes(unidade.id);
                    return (
                      <label
                        key={unidade.id}
                        className="flex cursor-pointer items-start gap-2 rounded-[var(--r-sm)] px-2 py-1.5 hover:bg-[var(--surface-2)]"
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={checked}
                          onChange={() => toggleUnidade(unidade.id)}
                        />
                        <span className="min-w-0">
                          <span className="block text-[13px] font-medium text-[var(--ink)]">{unidade.nome}</span>
                          <span className="block text-[11px] text-[var(--ink-3)]">
                            {unidade.codigoPatrimonial} · {formatUnidadeTipo(unidade.tipo)} · {unidade.secretaria.sigla}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <Field label="Onde encaminhar fotos">
              <textarea
                value={ondeEncaminharFotos}
                onChange={(event) => setOndeEncaminharFotos(event.target.value)}
                rows={3}
                placeholder="Ex.: WhatsApp (16) 99999-0000 · e-mail vistoria@prefeitura.gov.br · pasta Drive X"
                className="w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px]"
              />
            </Field>
          </>
        ) : null}
      </div>
    </Sheet>
  );
}
