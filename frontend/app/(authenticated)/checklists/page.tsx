'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, Plus } from 'lucide-react';
import { RequirePermissions } from '@/components/auth/require-permissions';
import { ChecklistModelCard, CreateChecklistForm } from '@/components/checklists/checklist-shared';
import { PageShell } from '@/components/layout/page-shell';
import { Alert } from '@/components/ui/alert';
import { Fab } from '@/components/ui/fab';
import { Sheet } from '@/components/ui/sheet';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui-states';
import { listAdminSecretarias, listChecklists, saveChecklist } from '@/lib/api';
import { AdminSecretaria, ChecklistModel } from '@/lib/types';

export default function ChecklistsPage() {
  const router = useRouter();
  const [checklists, setChecklists] = useState<ChecklistModel[]>([]);
  const [secretarias, setSecretarias] = useState<AdminSecretaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [nextChecklists, nextSecretarias] = await Promise.all([listChecklists(), listAdminSecretarias()]);
      setChecklists(nextChecklists);
      setSecretarias(nextSecretarias);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar checklists.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleCreate(payload: Record<string, unknown>) {
    setError(null);
    setSuccess(null);
    try {
      const created = await saveChecklist(payload);
      setSuccess('Checklist criado com versão 1 em rascunho.');
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
        kicker="Construtor Operacional"
        icon={ClipboardList}
        title="Checklists e versionamento"
        description="Visualize os modelos de checklist. Toque em um modelo para ver itens publicados e histórico de versões."
        backHref="/cco"
      >
        {error ? (
          <div className="mb-4">
            <ErrorState message={error} onRetry={() => void load()} />
          </div>
        ) : null}
        {success ? (
          <Alert variant="success" className="mb-4">
            {success}
          </Alert>
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
              <section aria-label="Modelos de checklist" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {checklists.map((checklist) => (
                  <ChecklistModelCard
                    key={checklist.id}
                    checklist={checklist}
                    onClick={() => router.push(`/checklists/${checklist.id}`)}
                  />
                ))}
              </section>
            )}

            <Fab extended aria-label="Criar checklist" onClick={() => setCreateOpen(true)}>
              <Plus className="h-6 w-6" />
              Criar
            </Fab>

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
