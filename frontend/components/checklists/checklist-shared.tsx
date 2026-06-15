'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ClipboardList, GitBranch, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Sheet } from '@/components/ui/sheet';
import {
  CHECKLIST_ESCOPO_LABELS,
  formatChecklistVinculo,
  formatUnidadeTipo,
  UNIDADE_TIPO_LABELS,
} from '@/lib/unidade-tipo';
import {
  AdminSecretaria,
  ChecklistEscopo,
  ChecklistItem,
  ChecklistItemTipo,
  ChecklistModel,
  ChecklistVersao,
  UnidadeTipo,
} from '@/lib/types';
import { LikertScale } from '@/components/checklists/likert-scale';
import {
  defaultOpcoesForTipo,
  formatOpcoesResumo,
  LIKERT_CATEGORIA_LABELS,
  LIKERT_CATALOGO,
  LIKERT_NIVEIS_ORDEM,
  LIKERT_NIVEIS_PADRAO,
  MULTIPLA_ESCOLHA_MODO_LABELS,
  parseLikertConfig,
  parseMultiplaEscolhaOpcoes,
  parseTextoOpcoes,
  serializeItemOpcoes,
  TEXTO_FORMATO_LABELS,
  validateItemOpcoes,
  type LikertNivelId,
} from '@/lib/checklist-item-opcoes';

export const TIPO_ITEM_LABEL: Record<ChecklistItemTipo, string> = {
  TEXTO: 'Texto',
  NUMERO: 'Número',
  BOOLEANO: 'Sim/Não',
  MULTIPLA_ESCOLHA: 'Múltipla escolha',
  ESCALA_LIKERT: 'Escala Likert',
  FOTO: 'Foto',
  ASSINATURA: 'Assinatura',
  DATA: 'Data',
};

export const tiposItem: ChecklistItemTipo[] = [
  'TEXTO',
  'NUMERO',
  'BOOLEANO',
  'MULTIPLA_ESCOLHA',
  'ESCALA_LIKERT',
  'FOTO',
  'ASSINATURA',
  'DATA',
];
export const tiposUnidade: UnidadeTipo[] = [
  'ESCOLA',
  'UBS',
  'PRACA',
  'PREDIO_ADMINISTRATIVO',
  'ESPACO_ESPORTIVO',
  'OUTRO',
];

export type ItemDraft = {
  draftKey: string;
  ordem: number;
  codigo: string;
  titulo: string;
  tipo: ChecklistItemTipo;
  obrigatorio: boolean;
  geraNaoConformidade: boolean;
  exigeEvidencia: boolean;
  opcoes?: unknown;
};

export function getPublishedVersion(versoes: ChecklistVersao[]) {
  return versoes.find((version) => version.status === 'PUBLICADA') ?? null;
}

export function getDraftVersion(versoes: ChecklistVersao[]) {
  return versoes.find((version) => version.status === 'RASCUNHO') ?? null;
}

export function getArchivedVersions(versoes: ChecklistVersao[]) {
  return [...versoes.filter((version) => version.status === 'ARQUIVADA')].sort((a, b) => b.versao - a.versao);
}

export const CHECKLIST_ESCOPO_ORDER: ChecklistEscopo[] = ['UNIDADE_TIPO', 'SECRETARIA', 'GLOBAL', 'UNIDADE'];

function createDraftKey() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function ChecklistBindingFields({
  escopo,
  onEscopoChange,
  secretarias,
  defaultSecretariaId = '',
  defaultUnidadeTipo = '',
}: {
  escopo: ChecklistEscopo;
  onEscopoChange: (escopo: ChecklistEscopo) => void;
  secretarias: AdminSecretaria[];
  defaultSecretariaId?: string;
  defaultUnidadeTipo?: string;
}) {
  const showSecretaria = escopo === 'SECRETARIA' || escopo === 'UNIDADE_TIPO';
  const showUnidadeTipo = escopo === 'UNIDADE_TIPO';

  return (
    <>
      <Field label="Como vincular este checklist?">
        <Select
          name="escopo"
          required
          value={escopo}
          onChange={(event) => onEscopoChange(event.target.value as ChecklistEscopo)}
        >
          {CHECKLIST_ESCOPO_ORDER.map((value) => (
            <option key={value} value={value}>
              {CHECKLIST_ESCOPO_LABELS[value]}
            </option>
          ))}
        </Select>
      </Field>
      {showUnidadeTipo ? (
        <Field
          label="Vincular ao tipo do próprio"
          hint="O checklist será aplicado automaticamente a todos os próprios deste tipo (ex.: Escola, UBS, Praça)."
        >
          <Select name="unidadeTipo" required defaultValue={defaultUnidadeTipo}>
            <option value="">Selecione o tipo do próprio</option>
            {tiposUnidade.map((tipo) => (
              <option key={tipo} value={tipo}>
                {UNIDADE_TIPO_LABELS[tipo]}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      {showSecretaria ? (
        <Field label={escopo === 'UNIDADE_TIPO' ? 'Secretaria (opcional)' : 'Secretaria'}>
          <Select name="secretariaId" defaultValue={defaultSecretariaId} required={escopo === 'SECRETARIA'}>
            <option value="">{escopo === 'UNIDADE_TIPO' ? 'Todas as secretarias deste tipo' : 'Selecione'}</option>
            {secretarias.map((secretaria) => (
              <option key={secretaria.id} value={secretaria.id}>
                {secretaria.sigla} — {secretaria.nome}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      {escopo === 'UNIDADE_TIPO' ? (
        <p className="md-body-md rounded-[var(--md-shape-md)] bg-[var(--md-surface-container-low)] px-4 py-3 text-[var(--md-on-surface-variant)]">
          Checklists vinculados ao <strong>tipo do próprio</strong> aparecem no app Vistoria para unidades daquele tipo.
        </p>
      ) : null}
    </>
  );
}

export function CreateChecklistForm({
  secretarias,
  onSubmit,
  onCancel,
  formId = 'create-checklist-form',
  hideActions = false,
}: {
  secretarias: AdminSecretaria[];
  onSubmit: (payload: Record<string, unknown>) => void;
  onCancel?: () => void;
  formId?: string;
  hideActions?: boolean;
}) {
  const [escopo, setEscopo] = useState<ChecklistEscopo>('UNIDADE_TIPO');
  const [formError, setFormError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const form = new FormData(event.currentTarget);
    const selectedEscopo = String(form.get('escopo')) as ChecklistEscopo;
    const unidadeTipo = String(form.get('unidadeTipo') || '');

    if (selectedEscopo === 'UNIDADE_TIPO' && !unidadeTipo) {
      setFormError('Selecione o tipo de próprio para vincular o checklist.');
      return;
    }

    if (selectedEscopo === 'SECRETARIA' && !String(form.get('secretariaId') || '')) {
      setFormError('Selecione a secretaria para vincular o checklist.');
      return;
    }

    onSubmit({
      nome: String(form.get('nome')),
      descricao: String(form.get('descricao') || ''),
      escopo: selectedEscopo,
      secretariaId: String(form.get('secretariaId') || ''),
      unidadeTipo: unidadeTipo || undefined,
      ativo: true,
    });
    event.currentTarget.reset();
    setEscopo('UNIDADE_TIPO');
  }

  return (
    <form id={formId} onSubmit={submit} className="space-y-4">
      <Field label="Nome">
        <Input name="nome" required />
      </Field>
      <Field label="Descrição">
        <Input name="descricao" />
      </Field>
      <ChecklistBindingFields escopo={escopo} onEscopoChange={setEscopo} secretarias={secretarias} />
      {formError ? <p className="md-body-md text-red-700">{formError}</p> : null}
      {hideActions ? null : (
        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="submit" variant="filled" className="flex-1">
            <Plus className="h-4 w-4" />
            Criar checklist
          </Button>
          {onCancel ? (
            <Button type="button" variant="text" onClick={onCancel}>
              Cancelar
            </Button>
          ) : null}
        </div>
      )}
    </form>
  );
}

export function ChecklistModelCard({ checklist, onClick }: { checklist: ChecklistModel; onClick: () => void }) {
  const published = getPublishedVersion(checklist.versoes);
  const draft = getDraftVersion(checklist.versoes);
  const archivedCount = getArchivedVersions(checklist.versoes).length;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-full w-full flex-col rounded-[var(--md-shape-lg)] border border-[var(--md-outline-variant)] bg-[var(--md-surface)] p-5 text-left shadow-[var(--md-elevation-1)] transition-all hover:border-[var(--color-brand-primary)]/40 hover:shadow-[var(--md-elevation-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)]"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Chip variant={checklist.ativo ? 'brand' : 'default'} className="gap-1.5">
          <ClipboardList className="h-3.5 w-3.5" />
          {checklist.ativo ? 'Ativo' : 'Inativo'}
        </Chip>
        {draft ? <Chip variant="warning">Rascunho</Chip> : null}
        {published ? <Chip variant="success">Publicada v{published.versao}</Chip> : null}
      </div>
      <h2 className="md-title-lg mt-4 text-[var(--md-on-surface)]">{checklist.nome}</h2>
      <p className="md-body-md mt-2 line-clamp-2 flex-1 text-[var(--md-on-surface-variant)]">
        {checklist.descricao || 'Sem descrição'}
      </p>
      <p className="md-label-lg mt-4 text-[var(--md-on-surface-variant)]">
        {formatChecklistVinculo(checklist)}
        {archivedCount > 0 ? ` · ${archivedCount} versão(ões) arquivada(s)` : ''}
      </p>
    </button>
  );
}

export function ChecklistHeader({
  checklist,
  secretarias,
  onNewVersion,
  onDeactivate,
  onUpdateBinding,
}: {
  checklist: ChecklistModel;
  secretarias: AdminSecretaria[];
  onNewVersion: () => void;
  onDeactivate: () => void;
  onUpdateBinding: (payload: Record<string, unknown>) => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [escopo, setEscopo] = useState<ChecklistEscopo>(checklist.escopo);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (editOpen) {
      setEscopo(checklist.escopo);
      setFormError(null);
    }
  }, [editOpen, checklist.escopo]);

  function submitBinding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const form = new FormData(event.currentTarget);
    const selectedEscopo = String(form.get('escopo')) as ChecklistEscopo;
    const unidadeTipo = String(form.get('unidadeTipo') || '');

    if (selectedEscopo === 'UNIDADE_TIPO' && !unidadeTipo) {
      setFormError('Selecione o tipo de próprio para vincular o checklist.');
      return;
    }

    if (selectedEscopo === 'SECRETARIA' && !String(form.get('secretariaId') || '')) {
      setFormError('Selecione a secretaria para vincular o checklist.');
      return;
    }

    onUpdateBinding({
      nome: checklist.nome,
      descricao: checklist.descricao ?? '',
      escopo: selectedEscopo,
      secretariaId: String(form.get('secretariaId') || ''),
      unidadeTipo: unidadeTipo || undefined,
      ativo: checklist.ativo,
    });
    setEditOpen(false);
  }

  return (
    <>
      <Card elevation={1}>
        <CardContent className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div>
            <Chip variant={checklist.ativo ? 'brand' : 'default'} className="gap-1.5">
              <ClipboardList className="h-3.5 w-3.5" />
              {checklist.ativo ? 'Ativo' : 'Inativo'}
            </Chip>
            <h2 className="md-headline-md mt-3 text-[var(--md-on-surface)]">{checklist.nome}</h2>
            <p className="md-body-md mt-1 text-[var(--md-on-surface-variant)]">
              {checklist.descricao || 'Sem descrição'} · {formatChecklistVinculo(checklist)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="tonal" size="sm" onClick={() => setEditOpen(true)}>
              Editar vínculo
            </Button>
            <Button variant="tonal" size="sm" onClick={onNewVersion}>
              Nova versão
            </Button>
            <Button variant="text" size="sm" className="text-red-700" onClick={onDeactivate}>
              Inativar
            </Button>
          </div>
        </CardContent>
      </Card>
      <Sheet open={editOpen} onClose={() => setEditOpen(false)} title="Vínculo do checklist">
        <form onSubmit={submitBinding} className="space-y-4">
          <ChecklistBindingFields
            key={`${checklist.id}-${checklist.unidadeTipo ?? ''}-${checklist.secretariaId ?? ''}`}
            escopo={escopo}
            onEscopoChange={setEscopo}
            secretarias={secretarias}
            defaultSecretariaId={checklist.secretariaId ?? ''}
            defaultUnidadeTipo={checklist.unidadeTipo ?? ''}
          />
          {formError ? <p className="md-body-md text-red-700">{formError}</p> : null}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="submit" variant="filled" className="flex-1">
              Salvar vínculo
            </Button>
            <Button type="button" variant="text" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}

export function ItemsReadonlyPanel({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle?: string;
  items: ChecklistItem[];
}) {
  return (
    <Card elevation={1}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {subtitle ? <p className="md-body-md text-[var(--md-on-surface-variant)]">{subtitle}</p> : null}
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {items.length === 0 ? (
          <p className="md-body-md py-6 text-center text-[var(--md-on-surface-variant)]">Nenhum item nesta versão.</p>
        ) : null}
        {items
          .slice()
          .sort((a, b) => a.ordem - b.ordem)
          .map((item) => (
            <div
              key={item.id}
              className="rounded-[var(--md-shape-md)] bg-[var(--md-surface-container-low)] px-4 py-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="md-label-lg text-[var(--md-on-surface-variant)]">#{item.ordem}</span>
                <span className="md-title-md text-[var(--md-on-surface)]">{item.titulo}</span>
                <Chip variant="default">{item.codigo}</Chip>
                <Chip variant="default">{TIPO_ITEM_LABEL[item.tipo] ?? item.tipo}</Chip>
              </div>
              <p className="md-body-md mt-2 text-[var(--md-on-surface-variant)]">
                {item.obrigatorio ? 'Obrigatório' : 'Opcional'}
                {item.geraNaoConformidade ? ' · Gera NC' : ''}
                {item.exigeEvidencia ? ' · Exige evidência' : ''}
                {formatOpcoesResumo(item.tipo, item.opcoes) ? ` · ${formatOpcoesResumo(item.tipo, item.opcoes)}` : ''}
              </p>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}

export function ArchivedVersionsPanel({
  versions,
  selectedId,
  onSelect,
}: {
  versions: ChecklistVersao[];
  selectedId: string | null;
  onSelect: (versionId: string) => void;
}) {
  return (
    <Card elevation={1}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-[var(--color-brand-primary)]" />
          Histórico de versões arquivadas
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 pt-0 sm:grid-cols-2">
        {versions.length === 0 ? (
          <p className="md-body-md col-span-full py-4 text-center text-[var(--md-on-surface-variant)]">
            Nenhuma versão arquivada.
          </p>
        ) : null}
        {versions.map((version) => (
          <button
            key={version.id}
            type="button"
            onClick={() => onSelect(version.id)}
            className={`rounded-[var(--md-shape-md)] p-4 text-left transition-colors ${
              selectedId === version.id
                ? 'bg-[var(--color-brand-primary-subtle)] ring-2 ring-[var(--color-brand-primary)]'
                : 'bg-[var(--md-surface-container-low)] hover:bg-[var(--md-surface-container)]'
            }`}
          >
            <p className="md-title-md">Versão {version.versao}</p>
            <Chip variant="default" className="mt-2">
              ARQUIVADA
            </Chip>
            <p className="md-body-md mt-2 text-[var(--md-on-surface-variant)]">{version.itens.length} item(ns)</p>
            {version.publicadoAt ? (
              <p className="md-label-lg mt-1 text-[var(--md-on-surface-variant)]">
                Publicada em {new Date(version.publicadoAt).toLocaleDateString('pt-BR')}
              </p>
            ) : null}
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

export function VersionEditor({
  version,
  onSave,
  onPublish,
}: {
  version: ChecklistVersao;
  onSave: (items: Array<Omit<ItemDraft, 'draftKey'>>) => void;
  onPublish: (items: Array<Omit<ItemDraft, 'draftKey'>>) => void;
}) {
  const [items, setItems] = useState<ItemDraft[]>(
    version.itens.length
      ? version.itens.map((item) => ({
          draftKey: item.id,
          ordem: item.ordem,
          codigo: item.codigo,
          titulo: item.titulo,
          tipo: item.tipo,
          obrigatorio: item.obrigatorio,
          geraNaoConformidade: item.geraNaoConformidade,
          exigeEvidencia: item.exigeEvidencia,
          opcoes: item.opcoes ?? defaultOpcoesForTipo(item.tipo),
        }))
      : [emptyItem(1)],
  );
  const [editorError, setEditorError] = useState<string | null>(null);

  function prepareItems() {
    return items.map(({ draftKey: _draftKey, ...item }) => ({
      ...item,
      opcoes: serializeItemOpcoes(item.tipo, item.opcoes),
    }));
  }

  function validateItems(prepared: Array<Omit<ItemDraft, 'draftKey'>>) {
    const codes = new Set<string>();
    for (const item of prepared) {
      const opcoesError = validateItemOpcoes(item.tipo, item.opcoes, item.titulo, item.codigo);
      if (opcoesError) return opcoesError;
      if (!item.titulo.trim()) return `Item #${item.ordem}: informe o título.`;
      if (!item.codigo.trim()) return `Item #${item.ordem}: informe o código.`;
      const normalizedCode = item.codigo.trim().toUpperCase();
      if (codes.has(normalizedCode)) return `Código duplicado na versão: ${item.codigo}`;
      codes.add(normalizedCode);
    }
    return null;
  }

  function handleSave() {
    const prepared = prepareItems();
    const error = validateItems(prepared);
    if (error) {
      setEditorError(error);
      return;
    }
    setEditorError(null);
    onSave(prepared);
  }

  function handlePublish() {
    const prepared = prepareItems();
    const error = validateItems(prepared);
    if (error) {
      setEditorError(error);
      return;
    }
    setEditorError(null);
    onPublish(prepared);
  }

  return (
    <Card elevation={1}>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Editor da versão {version.versao}</CardTitle>
          <p className="md-body-md mt-1 text-[var(--md-on-surface-variant)]">Somente rascunhos podem ser editados.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="tonal" size="sm" onClick={() => setItems((current) => [...current, emptyItem(current.length + 1)])}>
            Adicionar item
          </Button>
          <Button variant="filled" size="sm" onClick={handleSave}>
            Salvar rascunho
          </Button>
          <Button variant="filled" size="sm" className="bg-emerald-700 hover:bg-emerald-800" onClick={handlePublish}>
            Publicar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {editorError ? <p className="md-body-md text-red-700">{editorError}</p> : null}
        {items.map((item, index) => (
          <div key={item.draftKey} className="space-y-3 rounded-[var(--md-shape-md)] bg-[var(--md-surface-container-low)] p-4">
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
              <Field label="Ordem">
                <Input
                  type="number"
                  value={item.ordem}
                  onChange={(e) => updateItem(items, setItems, index, { ordem: Number(e.target.value) })}
                />
              </Field>
              <Field label="Código">
                <Input value={item.codigo} onChange={(e) => updateItem(items, setItems, index, { codigo: e.target.value })} />
              </Field>
              <Field label="Título" className="lg:col-span-2">
                <Input value={item.titulo} onChange={(e) => updateItem(items, setItems, index, { titulo: e.target.value })} />
              </Field>
              <Field label="Tipo">
                <Select
                  value={item.tipo}
                  onChange={(e) => updateItem(items, setItems, index, { tipo: e.target.value as ChecklistItemTipo })}
                >
                  {tiposItem.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {TIPO_ITEM_LABEL[tipo]}
                    </option>
                  ))}
                </Select>
              </Field>
              <label className="flex min-h-11 items-center gap-2 md-label-lg">
                <input
                  type="checkbox"
                  checked={item.obrigatorio}
                  onChange={(e) => updateItem(items, setItems, index, { obrigatorio: e.target.checked })}
                />
                Obrigatório
              </label>
              <label className="flex min-h-11 items-center gap-2 md-label-lg">
                <input
                  type="checkbox"
                  checked={item.geraNaoConformidade}
                  onChange={(e) => updateItem(items, setItems, index, { geraNaoConformidade: e.target.checked })}
                />
                Gera NC
              </label>
              <label className="flex min-h-11 items-center gap-2 md-label-lg">
                <input
                  type="checkbox"
                  checked={item.exigeEvidencia}
                  onChange={(e) => updateItem(items, setItems, index, { exigeEvidencia: e.target.checked })}
                />
                Exige evidência
              </label>
              <Button variant="text" size="sm" className="text-red-700" onClick={() => setItems((current) => current.filter((_, i) => i !== index))}>
                Remover
              </Button>
            </div>
            {item.tipo === 'MULTIPLA_ESCOLHA' ? (
              <MultiplaEscolhaEditor
                opcoes={item.opcoes}
                onChange={(opcoes) => updateItem(items, setItems, index, { opcoes })}
              />
            ) : null}
            {item.tipo === 'ESCALA_LIKERT' ? (
              <LikertOpcoesEditor
                opcoes={item.opcoes}
                onChange={(opcoes) => updateItem(items, setItems, index, { opcoes })}
              />
            ) : null}
            {item.tipo === 'TEXTO' ? (
              <TextoOpcoesEditor
                opcoes={item.opcoes}
                onChange={(opcoes) => updateItem(items, setItems, index, { opcoes })}
              />
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function MultiplaEscolhaEditor({
  opcoes,
  onChange,
}: {
  opcoes: unknown;
  onChange: (opcoes: unknown) => void;
}) {
  const config = parseMultiplaEscolhaOpcoes(opcoes);

  function updateOpcoes(nextOpcoes: string[]) {
    onChange({ ...config, opcoes: nextOpcoes });
  }

  return (
    <div className="space-y-3 border-t border-[var(--md-outline-variant)] pt-3">
      <p className="md-title-sm text-[var(--md-on-surface)]">Opções de múltipla escolha</p>
      <div className="space-y-2">
        {config.opcoes.map((opcao, optionIndex) => (
          <div key={optionIndex} className="flex items-end gap-2">
            <Field label={`Opção ${optionIndex + 1}`} className="min-w-0 flex-1">
              <Input
                value={opcao}
                placeholder={`Digite a opção ${optionIndex + 1}`}
                onChange={(e) => {
                  const next = [...config.opcoes];
                  next[optionIndex] = e.target.value;
                  updateOpcoes(next);
                }}
              />
            </Field>
            {config.opcoes.length > 2 ? (
              <Button
                type="button"
                variant="text"
                size="sm"
                className="mb-0.5 shrink-0 text-red-700"
                aria-label={`Remover opção ${optionIndex + 1}`}
                onClick={() => updateOpcoes(config.opcoes.filter((_, i) => i !== optionIndex))}
              >
                <Minus className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="tonal"
        size="sm"
        className="mt-2 gap-1.5"
        onClick={() => updateOpcoes([...config.opcoes, ''])}
      >
        <Plus className="h-4 w-4" />
        Cadastrar mais opções
      </Button>
      <Field label="Modo de exibição" className="mt-3 max-w-md">
        <Select
          value={config.modoExibicao}
          onChange={(e) => onChange({ ...config, modoExibicao: e.target.value })}
        >
          {(Object.keys(MULTIPLA_ESCOLHA_MODO_LABELS) as Array<keyof typeof MULTIPLA_ESCOLHA_MODO_LABELS>).map((modo) => (
            <option key={modo} value={modo}>
              {MULTIPLA_ESCOLHA_MODO_LABELS[modo]}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

function LikertOpcoesEditor({
  opcoes,
  onChange,
}: {
  opcoes: unknown;
  onChange: (opcoes: unknown) => void;
}) {
  const config = parseLikertConfig(opcoes);
  const selected = new Set(config.opcoes.niveis);

  function toggleNivel(id: LikertNivelId, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    onChange({ niveis: LIKERT_NIVEIS_ORDEM.filter((nivelId) => next.has(nivelId)) });
  }

  return (
    <div className="space-y-3 border-t border-[var(--md-outline-variant)] pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="md-title-sm text-[var(--md-on-surface)]">Escala Likert fixa</p>
        <Button type="button" variant="text" size="sm" onClick={() => onChange({ niveis: [...LIKERT_NIVEIS_PADRAO] })}>
          Selecionar todos
        </Button>
      </div>
      <p className="text-[13px] text-[var(--md-on-surface-variant)]">
        Níveis padronizados com pontuação de 0 a 10 (5 = neutro). Escolha quais aparecem na vistoria.
      </p>
      <LikertScale opcoes={config.opcoes} preview />
      <div className="overflow-hidden rounded-[var(--md-shape-md)] border border-[var(--line-2)]">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-[var(--surface-2)] text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">
            <tr>
              <th className="px-3 py-2">Usar</th>
              <th className="px-3 py-2">Nível</th>
              <th className="px-3 py-2">Categoria</th>
              <th className="px-3 py-2">Pontuação</th>
            </tr>
          </thead>
          <tbody>
            {LIKERT_NIVEIS_ORDEM.map((id) => {
              const nivel = LIKERT_CATALOGO[id];
              return (
                <tr key={id} className="border-t border-[var(--line-2)]">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(id)}
                      onChange={(event) => toggleNivel(id, event.target.checked)}
                    />
                  </td>
                  <td className="px-3 py-2 font-semibold text-[var(--ink)]">{nivel.label}</td>
                  <td className="px-3 py-2 text-[var(--ink-2)]">{LIKERT_CATEGORIA_LABELS[nivel.categoria]}</td>
                  <td className="px-3 py-2 font-mono text-[var(--ink-2)]">{nivel.pontuacao}/10</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {selected.size < 2 ? (
        <p className="text-[13px] text-[var(--danger)]">Selecione ao menos 2 níveis para publicar o item.</p>
      ) : null}
    </div>
  );
}

function TextoOpcoesEditor({
  opcoes,
  onChange,
}: {
  opcoes: unknown;
  onChange: (opcoes: unknown) => void;
}) {
  const config = parseTextoOpcoes(opcoes);

  return (
    <div className="space-y-3 border-t border-[var(--md-outline-variant)] pt-3">
      <p className="md-title-sm text-[var(--md-on-surface)]">Formato do texto</p>
      <Field label="Tipo de campo" className="max-w-md">
        <Select
          value={config.formato}
          onChange={(e) => onChange({ formato: e.target.value })}
        >
          {(Object.keys(TEXTO_FORMATO_LABELS) as Array<keyof typeof TEXTO_FORMATO_LABELS>).map((formato) => (
            <option key={formato} value={formato}>
              {TEXTO_FORMATO_LABELS[formato]}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

function emptyItem(ordem: number): ItemDraft {
  return {
    draftKey: createDraftKey(),
    ordem,
    codigo: `ITEM-${ordem}`,
    titulo: '',
    tipo: 'BOOLEANO',
    obrigatorio: true,
    geraNaoConformidade: true,
    exigeEvidencia: true,
  };
}

function updateItem(items: ItemDraft[], setItems: (items: ItemDraft[]) => void, index: number, patch: Partial<ItemDraft>) {
  setItems(
    items.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const next = { ...item, ...patch };
      if (patch.tipo && patch.tipo !== item.tipo) {
        next.opcoes = defaultOpcoesForTipo(patch.tipo);
      }
      return next;
    }),
  );
}
