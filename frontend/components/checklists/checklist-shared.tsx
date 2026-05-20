'use client';

import { FormEvent, useState } from 'react';
import { ClipboardList, GitBranch, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Field } from '@/components/ui/field';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  AdminSecretaria,
  ChecklistItem,
  ChecklistItemTipo,
  ChecklistModel,
  ChecklistVersao,
  UnidadeTipo,
} from '@/lib/types';

export const tiposItem: ChecklistItemTipo[] = [
  'TEXTO',
  'NUMERO',
  'BOOLEANO',
  'MULTIPLA_ESCOLHA',
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
  ordem: number;
  codigo: string;
  titulo: string;
  tipo: ChecklistItemTipo;
  obrigatorio: boolean;
  geraNaoConformidade: boolean;
  exigeEvidencia: boolean;
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

export function CreateChecklistForm({
  secretarias,
  onSubmit,
  onCancel,
}: {
  secretarias: AdminSecretaria[];
  onSubmit: (payload: Record<string, unknown>) => void;
  onCancel?: () => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSubmit({
      nome: String(form.get('nome')),
      descricao: String(form.get('descricao') || ''),
      escopo: String(form.get('escopo')),
      secretariaId: String(form.get('secretariaId') || ''),
      unidadeTipo: String(form.get('unidadeTipo') || '') || undefined,
      ativo: true,
    });
    event.currentTarget.reset();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Nome">
        <Input name="nome" required />
      </Field>
      <Field label="Descrição">
        <Input name="descricao" />
      </Field>
      <Field label="Escopo">
        <Select name="escopo" required defaultValue="GLOBAL">
          <option value="GLOBAL">Global</option>
          <option value="SECRETARIA">Secretaria</option>
          <option value="UNIDADE_TIPO">Tipo de unidade</option>
        </Select>
      </Field>
      <Field label="Secretaria">
        <Select name="secretariaId" defaultValue="">
          <option value="">Sem secretaria</option>
          {secretarias.map((secretaria) => (
            <option key={secretaria.id} value={secretaria.id}>
              {secretaria.sigla} — {secretaria.nome}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Tipo de unidade">
        <Select name="unidadeTipo" defaultValue="">
          <option value="">Não aplicado</option>
          {tiposUnidade.map((tipo) => (
            <option key={tipo} value={tipo}>
              {tipo}
            </option>
          ))}
        </Select>
      </Field>
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
        {checklist.escopo}
        {checklist.secretaria ? ` · ${checklist.secretaria.sigla}` : ''}
        {archivedCount > 0 ? ` · ${archivedCount} versão(ões) arquivada(s)` : ''}
      </p>
    </button>
  );
}

export function ChecklistHeader({
  checklist,
  onNewVersion,
  onDeactivate,
}: {
  checklist: ChecklistModel;
  onNewVersion: () => void;
  onDeactivate: () => void;
}) {
  return (
    <Card elevation={1}>
      <CardContent className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div>
          <Chip variant={checklist.ativo ? 'brand' : 'default'} className="gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" />
            {checklist.ativo ? 'Ativo' : 'Inativo'}
          </Chip>
          <h2 className="md-headline-md mt-3 text-[var(--md-on-surface)]">{checklist.nome}</h2>
          <p className="md-body-md mt-1 text-[var(--md-on-surface-variant)]">
            {checklist.descricao || 'Sem descrição'} · {checklist.escopo}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="tonal" size="sm" onClick={onNewVersion}>
            Nova versão
          </Button>
          <Button variant="text" size="sm" className="text-red-700" onClick={onDeactivate}>
            Inativar
          </Button>
        </div>
      </CardContent>
    </Card>
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
                <Chip variant="default">{item.tipo}</Chip>
              </div>
              <p className="md-body-md mt-2 text-[var(--md-on-surface-variant)]">
                {item.obrigatorio ? 'Obrigatório' : 'Opcional'}
                {item.geraNaoConformidade ? ' · Gera NC' : ''}
                {item.exigeEvidencia ? ' · Exige evidência' : ''}
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
  onSave: (items: ItemDraft[]) => void;
  onPublish: () => void;
}) {
  const [items, setItems] = useState<ItemDraft[]>(
    version.itens.length
      ? version.itens.map((item) => ({
          ordem: item.ordem,
          codigo: item.codigo,
          titulo: item.titulo,
          tipo: item.tipo,
          obrigatorio: item.obrigatorio,
          geraNaoConformidade: item.geraNaoConformidade,
          exigeEvidencia: item.exigeEvidencia,
        }))
      : [emptyItem(1)],
  );

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
          <Button variant="filled" size="sm" onClick={() => onSave(items)}>
            Salvar rascunho
          </Button>
          <Button variant="filled" size="sm" className="bg-emerald-700 hover:bg-emerald-800" onClick={onPublish}>
            Publicar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {items.map((item, index) => (
          <div
            key={index}
            className="grid gap-3 rounded-[var(--md-shape-md)] bg-[var(--md-surface-container-low)] p-4 lg:grid-cols-2 xl:grid-cols-4"
          >
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
                    {tipo}
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
        ))}
      </CardContent>
    </Card>
  );
}

function emptyItem(ordem: number): ItemDraft {
  return {
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
  setItems(items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
}
