'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, Layers, Plus, Settings2 } from 'lucide-react';
import { RequirePermissions } from '@/components/auth/require-permissions';
import {
  CreateChecklistForm,
  getDraftVersion,
  getPublishedVersion,
} from '@/components/checklists/checklist-shared';
import { PageShell } from '@/components/layout/page-shell';
import { TipBanner } from '@/components/help/tip-banner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sheet } from '@/components/ui/sheet';
import { useSnackbar } from '@/components/ui/snackbar';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui-states';
import { cn } from '@/lib/cn';
import { listAdminSecretarias, listChecklists, saveChecklist } from '@/lib/api';
import { formatChecklistVinculo } from '@/lib/unidade-tipo';
import { AdminSecretaria, ChecklistModel } from '@/lib/types';

const TIPO_LABEL: Record<string, string> = {
  BOOLEANO: 'Sim/Não',
  FOTO: 'Foto',
  TEXTO: 'Texto',
  NUMERO: 'Número',
  MULTIPLA_ESCOLHA: 'Múltipla',
  ASSINATURA: 'Assinatura',
  DATA: 'Data',
};

function tipoBadgeVariant(tipo: string): 'info' | 'warning' | 'neutral' {
  if (tipo === 'BOOLEANO') return 'info';
  if (tipo === 'FOTO') return 'warning';
  return 'neutral';
}

export default function ChecklistsPage() {
  const router = useRouter();
  const snackbar = useSnackbar();
  const [checklists, setChecklists] = useState<ChecklistModel[]>([]);
  const [secretarias, setSecretarias] = useState<AdminSecretaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const selected = useMemo(() => {
    if (selectedId) return checklists.find((item) => item.id === selectedId) ?? null;
    return checklists[0] ?? null;
  }, [checklists, selectedId]);

  async function handleCreate(payload: Record<string, unknown>) {
    setError(null);
    try {
      const created = await saveChecklist(payload);
      snackbar.show('Checklist criado com versão 1 em rascunho.', 'success');
      setCreateOpen(false);
      await load();
      router.push(`/checklists/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar o checklist.');
    }
  }

  return (
    <RequirePermissions permissions={['checklists.gerenciar']}>
      <PageShell
        kicker="Modelos de vistoria"
        icon={ClipboardList}
        title="Checklists"
        description="Modelos versionados aplicados pelos agentes em vistoria. Publique versões sem quebrar histórico."
        backHref="/cco"
        action={
          <Button variant="filled" size="md" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Criar
          </Button>
        }
      >
        <TipBanner id="checklists-versionamento">
          Selecione um modelo para ver itens publicados. Use &quot;Abrir editor&quot; para rascunho, publicação e histórico de versões.
        </TipBanner>

        {error ? (
          <div className="mb-4">
            <ErrorState message={error} onRetry={() => void load()} />
          </div>
        ) : null}
        {loading ? <LoadingState label="Carregando modelos..." /> : null}

        {!loading ? (
          <>
            {checklists.length === 0 ? (
              <EmptyState
                title="Nenhum modelo cadastrado"
                description="Use o botão Criar para cadastrar o primeiro checklist."
              />
            ) : (
              <div className="grid min-h-0 flex-1 gap-3.5 xl:grid-cols-[minmax(320px,388px)_1fr]">
                <section className="flex min-h-[420px] flex-col overflow-hidden rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--sh-sm)] xl:min-h-[520px]">
                  <div className="flex shrink-0 items-center gap-2 border-b border-[var(--line-2)] px-4 py-3">
                    <Layers className="h-4 w-4 text-[var(--brand)]" />
                    <h2 className="text-[13.5px] font-semibold text-[var(--ink)]">Modelos</h2>
                    <span className="mono ml-auto rounded-[var(--r-pill)] border border-[var(--line)] bg-[var(--surface-2)] px-2 py-0.5 text-xs font-semibold text-[var(--ink-3)]">
                      {checklists.length}
                    </span>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
                    {checklists.map((checklist) => {
                      const published = getPublishedVersion(checklist.versoes);
                      const draft = getDraftVersion(checklist.versoes);
                      const isSelected = selected?.id === checklist.id;

                      return (
                        <button
                          key={checklist.id}
                          type="button"
                          onClick={() => setSelectedId(checklist.id)}
                          className={cn(
                            'mb-0.5 flex w-full flex-col gap-1.5 rounded-[var(--r-md)] border border-transparent px-3 py-2.5 text-left transition-colors',
                            isSelected
                              ? 'border-[color-mix(in_srgb,var(--brand)_30%,transparent)] bg-[var(--brand-soft)]'
                              : 'hover:bg-[var(--surface-2)]',
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="mono text-[11px] font-semibold text-[var(--brand-hover)]">
                              v{published?.versao ?? draft?.versao ?? 1}
                            </span>
                            <Badge variant={published ? 'success' : draft ? 'warning' : 'muted'}>
                              {published ? 'Publicado' : draft ? 'Rascunho' : 'Sem versão'}
                            </Badge>
                          </div>
                          <p className="line-clamp-2 text-[13px] font-semibold text-[var(--ink)]">{checklist.nome}</p>
                          <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px] text-[var(--ink-3)]">
                            <span className="inline-flex items-center gap-1">
                              <Layers className="h-3 w-3" />
                              {published?.itens.length ?? draft?.itens.length ?? 0} itens
                            </span>
                            <span>{formatChecklistVinculo(checklist)}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="min-h-[320px]">
                  <ChecklistPreviewPanel
                    checklist={selected}
                    onOpenEditor={() => selected && router.push(`/checklists/${selected.id}`)}
                  />
                </section>
              </div>
            )}

            <Sheet open={createOpen} onClose={() => setCreateOpen(false)} title="Novo checklist">
              <CreateChecklistForm
                secretarias={secretarias}
                onSubmit={(payload) => void handleCreate(payload)}
                onCancel={() => setCreateOpen(false)}
              />
            </Sheet>
          </>
        ) : null}
      </PageShell>
    </RequirePermissions>
  );
}

function ChecklistPreviewPanel({
  checklist,
  onOpenEditor,
}: {
  checklist: ChecklistModel | null;
  onOpenEditor: () => void;
}) {
  if (!checklist) {
    return (
      <Card elevation={1} className="flex h-full min-h-[320px] flex-col items-center justify-center text-center">
        <CardContent className="flex flex-col items-center gap-2 p-8">
          <ClipboardList className="h-8 w-8 text-[var(--ink-3)]" />
          <p className="text-[15px] font-semibold text-[var(--ink)]">Selecione um modelo</p>
          <p className="max-w-xs text-[13px] text-[var(--ink-3)]">Escolha um checklist na lista para ver os itens publicados.</p>
        </CardContent>
      </Card>
    );
  }

  const published = getPublishedVersion(checklist.versoes);
  const draft = getDraftVersion(checklist.versoes);
  const items = published?.itens ?? [];

  return (
    <Card elevation={1} className="h-full overflow-hidden">
      <CardContent className="flex h-full flex-col p-0">
        <div className="border-b border-[var(--line-2)] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <span className="mono text-[13px] font-semibold text-[var(--brand-hover)]">
              v{published?.versao ?? draft?.versao ?? 1}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {published ? <Badge variant="success">Publicado</Badge> : null}
              {draft ? <Badge variant="warning">Rascunho ativo</Badge> : null}
              {!checklist.ativo ? <Badge variant="muted">Inativo</Badge> : null}
            </div>
          </div>
          <h2 className="mt-3 text-[17px] font-semibold leading-snug text-[var(--ink)]">{checklist.nome}</h2>
          <p className="mt-2 text-[13px] text-[var(--ink-3)]">
            {formatChecklistVinculo(checklist)}
            {checklist.descricao ? ` · ${checklist.descricao}` : ''}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {!published ? (
            <EmptyState
              title="Nenhuma versão publicada"
              description="Abra o editor para publicar a primeira versão deste modelo."
            />
          ) : (
            <div className="space-y-2">
              {items
                .slice()
                .sort((a, b) => a.ordem - b.ordem)
                .map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5"
                  >
                    <span className="mono text-[11px] font-semibold text-[var(--ink-3)]">{index + 1}</span>
                    <span className="min-w-0 flex-1 text-[13px] font-medium text-[var(--ink)]">{item.titulo}</span>
                    <Badge variant={tipoBadgeVariant(item.tipo)}>{TIPO_LABEL[item.tipo] ?? item.tipo}</Badge>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="border-t border-[var(--line-2)] p-4">
          <Button variant="filled" className="w-full gap-2 sm:w-auto" onClick={onOpenEditor}>
            <Settings2 className="h-4 w-4" />
            Abrir editor
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
