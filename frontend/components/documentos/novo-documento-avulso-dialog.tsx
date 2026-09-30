'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Sheet } from '@/components/ui/sheet';
import { useSnackbar } from '@/components/ui/snackbar';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { LoadingState } from '@/components/ui-states';
import { createDocumentoAvulso, getSecretarias, listDocumentosChecklistsAvulso } from '@/lib/api';
import { DOCUMENTO_TIPO_LABELS } from '@/lib/documento-status';
import type { DocumentoTipo, SecretariaOption } from '@/lib/types';

type ChecklistAvulsoOption = {
  id: string;
  nome: string;
  versaoPublicada: { id: string; versao: number };
  secretaria?: { id: string } | null;
};

export type DocumentoAvulsoVinculo = {
  chamadoId: string;
  codigo: string;
  titulo?: string | null;
  secretariaId: string;
  unidadeId?: string | null;
  enderecoTexto?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (documentoId: string) => void;
  vinculo?: DocumentoAvulsoVinculo | null;
};

export function NovoDocumentoAvulsoDialog({ open, onClose, onCreated, vinculo }: Props) {
  const snackbar = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [secretarias, setSecretarias] = useState<SecretariaOption[]>([]);
  const [checklists, setChecklists] = useState<ChecklistAvulsoOption[]>([]);
  const [tipo, setTipo] = useState<DocumentoTipo>('DOCUMENTO_AVULSO');
  const [secretariaId, setSecretariaId] = useState('');
  const [checklistVersaoId, setChecklistVersaoId] = useState('');
  const [titulo, setTitulo] = useState('');
  const [enderecoTexto, setEnderecoTexto] = useState('');

  useEffect(() => {
    if (!open) return;
    setTipo('DOCUMENTO_AVULSO');
    setChecklistVersaoId('');
    setTitulo(vinculo ? `${vinculo.codigo}${vinculo.titulo?.trim() ? ` — ${vinculo.titulo.trim()}` : ''}` : '');
    setEnderecoTexto(vinculo?.enderecoTexto?.trim() ?? '');
    setSecretariaId(vinculo?.secretariaId ?? '');
    setLoading(true);
    Promise.all([getSecretarias(), listDocumentosChecklistsAvulso()])
      .then(([secs, checks]) => {
        setSecretarias(secs);
        setChecklists(checks as ChecklistAvulsoOption[]);
        setSecretariaId((current) => current || vinculo?.secretariaId || secs[0]?.id || '');
      })
      .catch((err) => snackbar.show(err instanceof Error ? err.message : 'Falha ao carregar opções.', 'error'))
      .finally(() => setLoading(false));
    // Recarrega ao abrir ou quando o chamado vinculado muda. O objeto vinculo pode ser recriado a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, vinculo?.chamadoId, vinculo?.secretariaId, vinculo?.codigo, vinculo?.titulo, vinculo?.enderecoTexto]);

  const checklistOptions = useMemo(
    () =>
      checklists.map((item) => ({
        value: item.versaoPublicada.id,
        label: `${item.nome} · v${item.versaoPublicada.versao}`,
      })),
    [checklists],
  );

  async function handleCreate(concluir = false) {
    if (!secretariaId || !checklistVersaoId) {
      snackbar.show('Informe Secretaria e checklist/modelo.', 'error');
      return;
    }
    setBusy(true);
    try {
      const created = await createDocumentoAvulso({
        tipo,
        secretariaId,
        checklistVersaoId,
        titulo: titulo.trim() || undefined,
        enderecoTexto: enderecoTexto.trim() || undefined,
        chamadoId: vinculo?.chamadoId,
        unidadeId: vinculo?.unidadeId || undefined,
        latitude: vinculo?.latitude ?? undefined,
        longitude: vinculo?.longitude ?? undefined,
        concluir,
      });
      snackbar.show(concluir ? 'Documento criado e concluído.' : 'Rascunho criado.', 'success');
      onCreated(created.id);
      onClose();
    } catch (err) {
      snackbar.show(err instanceof Error ? err.message : 'Falha ao criar documento.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Novo documento avulso">
      {loading ? (
        <LoadingState label="Carregando modelos..." />
      ) : (
        <div className="space-y-4">
          <p className="text-[13px] text-[var(--ink-3)]">
            {vinculo
              ? `Documento vinculado ao chamado ${vinculo.codigo}. Escolha o checklist e ajuste os dados sugeridos antes de salvar.`
              : 'Selecione um checklist/modelo já cadastrado. A estrutura de perguntas continua no cadastro de Checklists.'}
          </p>
          <Field label="Tipo de documento">
            <Select value={tipo} onChange={(event) => setTipo(event.target.value as DocumentoTipo)}>
              {Object.entries(DOCUMENTO_TIPO_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Secretaria">
            <SearchableSelect
              value={secretariaId}
              onChange={setSecretariaId}
              options={secretarias.map((item) => ({ value: item.id, label: `${item.sigla} · ${item.nome}` }))}
              placeholder="Selecionar secretaria..."
            />
          </Field>
          <Field label="Checklist / modelo">
            <SearchableSelect
              value={checklistVersaoId}
              onChange={setChecklistVersaoId}
              options={checklistOptions}
              placeholder="Pesquisar modelo..."
              emptyLabel="Nenhum checklist com finalidade Documento avulso"
            />
          </Field>
          <Field label="Título (opcional)">
            <Input value={titulo} onChange={(event) => setTitulo(event.target.value)} placeholder="Ex.: Notificação de fiscalização" />
          </Field>
          <Field label="Endereço / local (opcional)">
            <Input value={enderecoTexto} onChange={(event) => setEnderecoTexto(event.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" variant="filled" disabled={busy} onClick={() => void handleCreate(false)}>
              Salvar rascunho
            </Button>
            <Button type="button" variant="outlined" disabled={busy} onClick={() => void handleCreate(true)}>
              Criar e concluir
            </Button>
            <Button type="button" variant="text" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
