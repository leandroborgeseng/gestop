'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ClipboardList, GitBranch, Plus } from 'lucide-react';
import { RequirePermissions } from '@/components/auth/require-permissions';
import { PageShell } from '@/components/layout/page-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Field } from '@/components/ui/field';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui-states';
import {
  createChecklistVersion,
  deactivateChecklist,
  listAdminSecretarias,
  listChecklists,
  publishChecklistVersion,
  saveChecklist,
  updateChecklistVersion,
} from '@/lib/api';
import {
  AdminSecretaria,
  ChecklistItemTipo,
  ChecklistModel,
  ChecklistVersao,
  UnidadeTipo,
} from '@/lib/types';

const tiposItem: ChecklistItemTipo[] = ['TEXTO', 'NUMERO', 'BOOLEANO', 'MULTIPLA_ESCOLHA', 'FOTO', 'ASSINATURA', 'DATA'];
const tiposUnidade: UnidadeTipo[] = ['ESCOLA', 'UBS', 'PRACA', 'PREDIO_ADMINISTRATIVO', 'ESPACO_ESPORTIVO', 'OUTRO'];

type ItemDraft = {
  ordem: number;
  codigo: string;
  titulo: string;
  tipo: ChecklistItemTipo;
  obrigatorio: boolean;
  geraNaoConformidade: boolean;
  exigeEvidencia: boolean;
};

export default function ChecklistsPage() {
  const [checklists, setChecklists] = useState<ChecklistModel[]>([]);
  const [secretarias, setSecretarias] = useState<AdminSecretaria[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selected = useMemo(
    () => checklists.find((checklist) => checklist.id === selectedId) ?? checklists[0] ?? null,
    [checklists, selectedId],
  );

  const draftVersion = selected?.versoes.find((version) => version.status === 'RASCUNHO') ?? null;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [nextChecklists, nextSecretarias] = await Promise.all([listChecklists(), listAdminSecretarias()]);
      setChecklists(nextChecklists);
      setSecretarias(nextSecretarias);
      setSelectedId((current) => current ?? nextChecklists[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar checklists.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function mutate(action: () => Promise<unknown>, message: string) {
    setError(null);
    setSuccess(null);
    try {
      await action();
      setSuccess(message);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operação não concluída.');
    }
  }

  return (
    <RequirePermissions permissions={['checklists.gerenciar']}>
      <PageShell
        kicker="Construtor Operacional"
        icon={ClipboardList}
        title="Checklists e versionamento"
        description="Crie modelos, edite versões em rascunho e publique versões imutáveis para fiscalizações futuras."
        backHref="/cco"
      >
        {error ? <div className="mb-4"><ErrorState message={error} onRetry={() => void load()} /></div> : null}
        {success ? <Alert variant="success" className="mb-4">{success}</Alert> : null}
        {loading ? <LoadingState label="Carregando checklists..." /> : null}

        {!loading ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,22rem)_1fr]">
            <aside className="space-y-4">
              <CreateChecklistForm
                secretarias={secretarias}
                onSubmit={(payload) => mutate(() => saveChecklist(payload), 'Checklist criado com versão 1 em rascunho.')}
              />
              <Card elevation={1}>
                <CardHeader>
                  <CardTitle>Modelos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {checklists.length === 0 ? (
                    <p className="md-body-md py-4 text-center text-[var(--md-on-surface-variant)]">Nenhum modelo.</p>
                  ) : null}
                  {checklists.map((checklist) => (
                    <button
                      key={checklist.id}
                      type="button"
                      onClick={() => setSelectedId(checklist.id)}
                      className={`w-full rounded-[var(--md-shape-md)] p-3 text-left transition-colors ${
                        selected?.id === checklist.id
                          ? 'bg-[var(--color-brand-primary-subtle)] text-[var(--color-brand-primary)]'
                          : 'bg-[var(--md-surface-container-low)] hover:bg-[var(--md-surface-container)]'
                      }`}
                    >
                      <strong className="md-title-md block">{checklist.nome}</strong>
                      <span className="md-body-md mt-1 block opacity-80">
                        {checklist.escopo} · {checklist.versoes.length} versão(ões)
                      </span>
                    </button>
                  ))}
                </CardContent>
              </Card>
            </aside>

            {selected ? (
              <section className="space-y-6">
                <ChecklistHeader
                  checklist={selected}
                  onNewVersion={() => mutate(() => createChecklistVersion(selected.id), 'Nova versão em rascunho criada.')}
                  onDeactivate={() => mutate(() => deactivateChecklist(selected.id), 'Checklist inativado.')}
                />
                <VersionsPanel versions={selected.versoes} />
                {draftVersion ? (
                  <VersionEditor
                    version={draftVersion}
                    onSave={(items) =>
                      mutate(
                        () => updateChecklistVersion(draftVersion.id, { estrutura: { atualizadoVia: 'ui' }, itens: items }),
                        'Versão em rascunho salva.',
                      )
                    }
                    onPublish={() => mutate(() => publishChecklistVersion(draftVersion.id), 'Versão publicada com sucesso.')}
                  />
                ) : (
                  <EmptyState
                    title="Sem rascunho ativo"
                    description="Crie uma nova versão para alterar o conteúdo deste checklist."
                  />
                )}
              </section>
            ) : (
              <EmptyState title="Nenhum checklist" description="Cadastre um novo checklist para começar." />
            )}
          </div>
        ) : null}
      </PageShell>
    </RequirePermissions>
  );
}

function CreateChecklistForm({ secretarias, onSubmit }: { secretarias: AdminSecretaria[]; onSubmit: (payload: Record<string, unknown>) => void }) {
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
    <FormSection title="Novo checklist">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nome"><Input name="nome" required /></Field>
        <Field label="Descrição"><Input name="descricao" /></Field>
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
            {secretarias.map((s) => <option key={s.id} value={s.id}>{s.sigla} — {s.nome}</option>)}
          </Select>
        </Field>
        <Field label="Tipo de unidade">
          <Select name="unidadeTipo" defaultValue="">
            <option value="">Não aplicado</option>
            {tiposUnidade.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
          </Select>
        </Field>
        <Button type="submit" variant="filled" className="w-full">
          <Plus className="h-4 w-4" />
          Criar
        </Button>
      </form>
    </FormSection>
  );
}

function ChecklistHeader({ checklist, onNewVersion, onDeactivate }: { checklist: ChecklistModel; onNewVersion: () => void; onDeactivate: () => void }) {
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
          <Button variant="tonal" size="sm" onClick={onNewVersion}>Nova versão</Button>
          <Button variant="text" size="sm" className="text-red-700" onClick={onDeactivate}>Inativar</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function VersionsPanel({ versions }: { versions: ChecklistVersao[] }) {
  return (
    <Card elevation={1}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-[var(--color-brand-primary)]" />
          Histórico de versões
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 pt-0 sm:grid-cols-2 lg:grid-cols-3">
        {versions.map((version) => (
          <div key={version.id} className="rounded-[var(--md-shape-md)] bg-[var(--md-surface-container-low)] p-4">
            <p className="md-title-md">Versão {version.versao}</p>
            <Chip variant={version.status === 'PUBLICADA' ? 'success' : version.status === 'RASCUNHO' ? 'warning' : 'default'} className="mt-2">
              {version.status}
            </Chip>
            <p className="md-body-md mt-2 text-[var(--md-on-surface-variant)]">{version.itens.length} item(ns)</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function VersionEditor({ version, onSave, onPublish }: { version: ChecklistVersao; onSave: (items: ItemDraft[]) => void; onPublish: () => void }) {
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
          <Button variant="filled" size="sm" onClick={() => onSave(items)}>Salvar rascunho</Button>
          <Button variant="filled" size="sm" className="bg-emerald-700 hover:bg-emerald-800" onClick={onPublish}>
            Publicar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {items.map((item, index) => (
          <div key={index} className="grid gap-3 rounded-[var(--md-shape-md)] bg-[var(--md-surface-container-low)] p-4 lg:grid-cols-2 xl:grid-cols-4">
            <Field label="Ordem">
              <Input type="number" value={item.ordem} onChange={(e) => updateItem(items, setItems, index, { ordem: Number(e.target.value) })} />
            </Field>
            <Field label="Código">
              <Input value={item.codigo} onChange={(e) => updateItem(items, setItems, index, { codigo: e.target.value })} />
            </Field>
            <Field label="Título" className="lg:col-span-2">
              <Input value={item.titulo} onChange={(e) => updateItem(items, setItems, index, { titulo: e.target.value })} />
            </Field>
            <Field label="Tipo">
              <Select value={item.tipo} onChange={(e) => updateItem(items, setItems, index, { tipo: e.target.value as ChecklistItemTipo })}>
                {tiposItem.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
              </Select>
            </Field>
            <label className="flex min-h-11 items-center gap-2 md-label-lg">
              <input type="checkbox" checked={item.obrigatorio} onChange={(e) => updateItem(items, setItems, index, { obrigatorio: e.target.checked })} />
              Obrigatório
            </label>
            <label className="flex min-h-11 items-center gap-2 md-label-lg">
              <input type="checkbox" checked={item.geraNaoConformidade} onChange={(e) => updateItem(items, setItems, index, { geraNaoConformidade: e.target.checked })} />
              Gera NC
            </label>
            <label className="flex min-h-11 items-center gap-2 md-label-lg">
              <input type="checkbox" checked={item.exigeEvidencia} onChange={(e) => updateItem(items, setItems, index, { exigeEvidencia: e.target.checked })} />
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
  return { ordem, codigo: `ITEM-${ordem}`, titulo: '', tipo: 'BOOLEANO', obrigatorio: true, geraNaoConformidade: true, exigeEvidencia: true };
}

function updateItem(items: ItemDraft[], setItems: (items: ItemDraft[]) => void, index: number, patch: Partial<ItemDraft>) {
  setItems(items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
}
