'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ClipboardList, GitBranch, Plus } from 'lucide-react';
import { AuthGate } from '@/components/auth-gate';
import { ErrorState, LoadingState } from '@/components/ui-states';
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
  ChecklistVersaoStatus,
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
    <AuthGate requiredPermissions={['checklists.gerenciar']}>
      <main className="gestop-shell p-4 md:p-6">
        <div className="mx-auto max-w-7xl">
          <Link href="/cco" className="mb-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" />
            Voltar para CCO
          </Link>

          <header className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Construtor Operacional</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">Checklists e versionamento</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Crie modelos, edite versões em rascunho e publique versões imutáveis para fiscalizações futuras.
            </p>
          </header>

          {error ? <div className="mb-4"><ErrorState message={error} /></div> : null}
          {success ? <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">{success}</div> : null}

          {loading ? <LoadingState label="Carregando checklists..." /> : null}

          {!loading ? (
            <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
              <aside className="space-y-4">
                <CreateChecklistForm
                  secretarias={secretarias}
                  onSubmit={(payload) => mutate(() => saveChecklist(payload), 'Checklist criado com versão 1 em rascunho.')}
                />
                <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h2 className="mb-3 text-lg font-bold text-slate-950">Modelos</h2>
                  <div className="space-y-2">
                    {checklists.map((checklist) => (
                      <button
                        key={checklist.id}
                        onClick={() => setSelectedId(checklist.id)}
                        className={`w-full rounded-2xl border p-3 text-left ${
                          selected?.id === checklist.id ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <strong className="block text-sm text-slate-950">{checklist.nome}</strong>
                        <span className="mt-1 block text-xs text-slate-600">
                          {checklist.escopo} · {checklist.versoes.length} versão(ões)
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
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
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600">
                      Não há versão em rascunho. Crie uma nova versão para alterar o conteúdo.
                    </div>
                  )}
                </section>
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
                  Nenhum checklist cadastrado.
                </div>
              )}
            </div>
          ) : null}
        </div>
      </main>
    </AuthGate>
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
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-950">
        <Plus className="h-5 w-5 text-blue-700" />
        Novo checklist
      </h2>
      <form onSubmit={submit} className="space-y-3">
        <Input name="nome" label="Nome" required />
        <Input name="descricao" label="Descrição" />
        <Select name="escopo" label="Escopo" options={[['GLOBAL', 'Global'], ['SECRETARIA', 'Secretaria'], ['UNIDADE_TIPO', 'Tipo de unidade']]} required />
        <Select name="secretariaId" label="Secretaria" options={[['', 'Sem secretaria'], ...secretarias.map((s) => [s.id, `${s.sigla} - ${s.nome}`])]} />
        <Select name="unidadeTipo" label="Tipo de unidade" options={[['', 'Não aplicado'], ...tiposUnidade.map((tipo) => [tipo, tipo])]} />
        <SubmitButton>Criar</SubmitButton>
      </form>
    </section>
  );
}

function ChecklistHeader({ checklist, onNewVersion, onDeactivate }: { checklist: ChecklistModel; onNewVersion: () => void; onDeactivate: () => void }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700">
            <ClipboardList className="h-3.5 w-3.5" />
            {checklist.ativo ? 'Ativo' : 'Inativo'}
          </span>
          <h2 className="mt-3 text-2xl font-bold text-slate-950">{checklist.nome}</h2>
          <p className="mt-1 text-sm text-slate-600">{checklist.descricao || 'Sem descrição'} · {checklist.escopo}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onNewVersion} className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100">Nova versão</button>
          <button onClick={onDeactivate} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100">Inativar</button>
        </div>
      </div>
    </section>
  );
}

function VersionsPanel({ versions }: { versions: ChecklistVersao[] }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-950"><GitBranch className="h-5 w-5 text-blue-700" />Histórico de versões</h3>
      <div className="grid gap-3 md:grid-cols-3">
        {versions.map((version) => (
          <div key={version.id} className="rounded-2xl border border-slate-200 p-4">
            <p className="text-sm font-bold text-slate-950">Versão {version.versao}</p>
            <p className={`mt-1 text-xs font-bold ${statusColor(version.status)}`}>{version.status}</p>
            <p className="mt-2 text-xs text-slate-600">{version.itens.length} item(ns)</p>
          </div>
        ))}
      </div>
    </section>
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
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-950">Editor da versão {version.versao}</h3>
          <p className="text-sm text-slate-600">Somente rascunhos podem ser editados.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setItems((current) => [...current, emptyItem(current.length + 1)])} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Adicionar item</button>
          <button onClick={() => onSave(items)} className="rounded-xl bg-blue-700 px-3 py-2 text-sm font-bold text-white hover:bg-blue-800">Salvar rascunho</button>
          <button onClick={onPublish} className="rounded-xl bg-green-700 px-3 py-2 text-sm font-bold text-white hover:bg-green-800">Publicar</button>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-[80px_120px_1fr_180px]">
            <Input label="Ordem" type="number" value={item.ordem} onChange={(e) => updateItem(items, setItems, index, { ordem: Number(e.target.value) })} />
            <Input label="Código" value={item.codigo} onChange={(e) => updateItem(items, setItems, index, { codigo: e.target.value })} />
            <Input label="Título" value={item.titulo} onChange={(e) => updateItem(items, setItems, index, { titulo: e.target.value })} />
            <Select label="Tipo" value={item.tipo} onChange={(e) => updateItem(items, setItems, index, { tipo: e.target.value as ChecklistItemTipo })} options={tiposItem.map((tipo) => [tipo, tipo])} />
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={item.obrigatorio} onChange={(e) => updateItem(items, setItems, index, { obrigatorio: e.target.checked })} />Obrigatório</label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={item.geraNaoConformidade} onChange={(e) => updateItem(items, setItems, index, { geraNaoConformidade: e.target.checked })} />Gera não conformidade</label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={item.exigeEvidencia} onChange={(e) => updateItem(items, setItems, index, { exigeEvidencia: e.target.checked })} />Exige evidência</label>
            <button onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="text-left text-sm font-semibold text-red-700">Remover</button>
          </div>
        ))}
      </div>
    </section>
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

function statusColor(status: ChecklistVersaoStatus) {
  if (status === 'PUBLICADA') return 'text-green-700';
  if (status === 'RASCUNHO') return 'text-amber-700';
  return 'text-slate-500';
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...inputProps } = props;
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">
      {label}
      <input {...inputProps} className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
    </label>
  );
}

function Select({ label, options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: string[][] }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">
      {label}
      <select {...props} className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
        {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select>
    </label>
  );
}

function SubmitButton({ children }: { children: React.ReactNode }) {
  return <button type="submit" className="min-h-11 w-full rounded-xl bg-blue-700 px-4 font-bold text-white hover:bg-blue-800">{children}</button>;
}
