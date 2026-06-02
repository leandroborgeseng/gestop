'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ClipboardList } from 'lucide-react';
import { RequirePermissions } from '@/components/auth/require-permissions';
import {
  ArchivedVersionsPanel,
  ChecklistHeader,
  getArchivedVersions,
  getDraftVersion,
  getPublishedVersion,
  ItemsReadonlyPanel,
  VersionEditor,
} from '@/components/checklists/checklist-shared';
import { PageShell } from '@/components/layout/page-shell';
import { Alert } from '@/components/ui/alert';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui-states';
import {
  createChecklistVersion,
  deactivateChecklist,
  listChecklists,
  publishChecklistVersion,
  updateChecklistVersion,
} from '@/lib/api';
import { ChecklistModel } from '@/lib/types';
import { formatChecklistVinculo } from '@/lib/unidade-tipo';

export default function ChecklistDetalhePage() {
  const params = useParams<{ id: string }>();
  const [checklist, setChecklist] = useState<ChecklistModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedArchivedId, setSelectedArchivedId] = useState<string | null>(null);

  const published = useMemo(
    () => (checklist ? getPublishedVersion(checklist.versoes) : null),
    [checklist],
  );
  const archived = useMemo(() => (checklist ? getArchivedVersions(checklist.versoes) : []), [checklist]);
  const draft = useMemo(() => (checklist ? getDraftVersion(checklist.versoes) : null), [checklist]);
  const selectedArchived = useMemo(
    () => archived.find((version) => version.id === selectedArchivedId) ?? null,
    [archived, selectedArchivedId],
  );

  async function load() {
    if (!params.id) return;
    setLoading(true);
    setError(null);
    try {
      const checklists = await listChecklists();
      const found = checklists.find((item) => item.id === params.id) ?? null;
      if (!found) {
        setChecklist(null);
        setError('Checklist não encontrado.');
        return;
      }
      setChecklist(found);
      setSelectedArchivedId((current) => {
        if (current && found.versoes.some((version) => version.id === current)) return current;
        return null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar checklist.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [params.id]);

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
        kicker="Modelo de checklist"
        icon={ClipboardList}
        title={checklist?.nome ?? 'Detalhe do checklist'}
        description={
          checklist
            ? formatChecklistVinculo(checklist)
            : 'Carregando informações do modelo'
        }
        backHref="/checklists"
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
        {loading ? <LoadingState label="Carregando checklist..." /> : null}

        {!loading && checklist ? (
          <div className="space-y-6">
            <ChecklistHeader
              checklist={checklist}
              onNewVersion={() => mutate(() => createChecklistVersion(checklist.id), 'Nova versão em rascunho criada.')}
              onDeactivate={() => mutate(() => deactivateChecklist(checklist.id), 'Checklist inativado.')}
            />

            {published ? (
              <ItemsReadonlyPanel
                title="Itens da versão publicada"
                subtitle={`Versão ${published.versao} · somente leitura`}
                items={published.itens}
              />
            ) : (
              <EmptyState
                title="Nenhuma versão publicada"
                description="Publique um rascunho para que os itens apareçam nesta área."
              />
            )}

            <ArchivedVersionsPanel
              versions={archived}
              selectedId={selectedArchivedId}
              onSelect={setSelectedArchivedId}
            />

            {selectedArchived ? (
              <ItemsReadonlyPanel
                title={`Consulta — versão ${selectedArchived.versao} arquivada`}
                subtitle="Versão arquivada · apenas consulta"
                items={selectedArchived.itens}
              />
            ) : null}

            {draft ? (
              <VersionEditor
                version={draft}
                onSave={(items) =>
                  mutate(
                    () =>
                      updateChecklistVersion(draft.id, {
                        estrutura: { atualizadoVia: 'ui' },
                        itens: items,
                      }),
                    'Versão em rascunho salva.',
                  )
                }
                onPublish={() => mutate(() => publishChecklistVersion(draft.id), 'Versão publicada com sucesso.')}
              />
            ) : (
              <EmptyState
                title="Sem rascunho ativo"
                description="Crie uma nova versão para alterar o conteúdo deste checklist."
              />
            )}
          </div>
        ) : null}
      </PageShell>
    </RequirePermissions>
  );
}
