'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, ExternalLink, RefreshCw } from 'lucide-react';
import { getWebmapImportStatus, syncWebmapImport } from '@/lib/api';
import { WebmapImportResult, WebmapImportStatus } from '@/lib/types';
import { WebmapImportReport } from '@/components/admin/webmap-import-report';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState, LoadingState } from '@/components/ui-states';

export function ImportacaoPanel({
  onSynced,
}: {
  onSynced?: () => void;
}) {
  const [status, setStatus] = useState<WebmapImportStatus | null>(null);
  const [result, setResult] = useState<WebmapImportResult | null>(null);
  const [lastReport, setLastReport] = useState<WebmapImportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextStatus = await getWebmapImportStatus();
      setStatus(nextStatus);
      if (nextStatus.lastSync?.skippedUnits?.length) {
        setLastReport({
          dryRun: false,
          featuresRead: 0,
          uniqueUnits: nextStatus.lastSync.uniqueUnits ?? 0,
          created: nextStatus.lastSync.created ?? 0,
          updated: nextStatus.lastSync.updated ?? 0,
          skipped: nextStatus.lastSync.skipped ?? 0,
          skippedUnits: nextStatus.lastSync.skippedUnits,
          rejectedFeatures: nextStatus.lastSync.rejectedFeatures,
          secretariasCadastradas: [],
          layersProcessed: 38,
          layersFailed: nextStatus.lastSync.layersFailed ?? 0,
          totalUnidadesInDb: nextStatus.unidadesCount,
          github: nextStatus.github,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar status do webmap.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSync(dryRun: boolean) {
    setSyncing(true);
    setError(null);
    setResult(null);
    try {
      const syncResult = await syncWebmapImport(dryRun);
      setResult(syncResult);
      if (!dryRun) {
        await load();
        onSynced?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao sincronizar webmap.');
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return <LoadingState label="Consultando repositório QGIS no GitHub..." />;
  }

  if (error && !status) {
    return <ErrorState message={error} onRetry={() => void load()} />;
  }

  if (!status) return null;

  return (
    <div className="space-y-6">
      {error ? <Alert variant="error">{error}</Alert> : null}

      <Card elevation={2}>
        <CardHeader>
          <CardTitle className="md-title-lg">Webmap QGIS (GitHub)</CardTitle>
          <CardDescription>
            Sincroniza próprios públicos municipais, unidades escolares e imóveis públicos do repositório{' '}
            <a
              href={status.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--color-brand-primary)] hover:underline"
            >
              SMMAFRANCA/webmap
            </a>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[var(--md-shape-md)] bg-[var(--md-surface-container-low)] p-3">
              <dt className="md-label-md text-[var(--md-on-surface-variant)]">Commit no GitHub</dt>
              <dd className="md-body-md mt-1 font-mono">{status.github.commitSha.slice(0, 7)}</dd>
              <dd className="md-body-md mt-1 text-[var(--md-on-surface-variant)]">{status.github.commitMessage}</dd>
              <dd className="md-label-md mt-2 text-[var(--md-on-surface-variant)]">
                {new Date(status.github.committedAt).toLocaleString('pt-BR')}
              </dd>
            </div>
            <div className="rounded-[var(--md-shape-md)] bg-[var(--md-surface-container-low)] p-3">
              <dt className="md-label-md text-[var(--md-on-surface-variant)]">Última sync GestOP</dt>
              {status.lastSync ? (
                <>
                  <dd className="md-body-md mt-1 font-mono">{status.lastSync.githubCommitSha.slice(0, 7)}</dd>
                  <dd className="md-body-md mt-1 text-[var(--md-on-surface-variant)]">
                    {new Date(status.lastSync.syncedAt).toLocaleString('pt-BR')} — {status.lastSync.usuario.nome}
                  </dd>
                  <dd className="md-label-md mt-2">
                    +{status.lastSync.created ?? 0} criadas · {status.lastSync.updated ?? 0} atualizadas
                  </dd>
                </>
              ) : (
                <dd className="md-body-md mt-1 text-[var(--md-on-surface-variant)]">Nunca sincronizado</dd>
              )}
            </div>
            <div className="rounded-[var(--md-shape-md)] bg-[var(--md-surface-container-low)] p-3">
              <dt className="md-label-md text-[var(--md-on-surface-variant)]">Unidades no banco</dt>
              <dd className="md-headline-md mt-1 text-[var(--color-brand-primary)]">{status.unidadesCount}</dd>
            </div>
            <div className="rounded-[var(--md-shape-md)] bg-[var(--md-surface-container-low)] p-3">
              <dt className="md-label-md text-[var(--md-on-surface-variant)]">Camadas configuradas</dt>
              <dd className="md-headline-md mt-1">{status.layersConfigured}</dd>
            </div>
          </dl>

          {status.hasUpdates ? (
            <Alert variant="warning">
              Há alterações no GitHub desde a última sincronização. Execute a importação para atualizar o mapa CCO.
            </Alert>
          ) : status.lastSync ? (
            <Alert variant="success">Banco alinhado com o último commit importado do webmap.</Alert>
          ) : null}

          {status.lastSync?.skipped && status.lastSync.skipped > 0 && !status.lastSync.skippedUnits.length ? (
            <Alert variant="warning">
              A última importação ignorou {status.lastSync.skipped} unidades. Execute uma simulação (dry-run) para
              gerar o relatório detalhado com CSV para a equipe do QGIS.
            </Alert>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button
              variant="filled"
              disabled={syncing}
              onClick={() => void handleSync(false)}
            >
              <Download className="h-4 w-4" />
              {syncing ? 'Importando...' : 'Importar do GitHub agora'}
            </Button>
            <Button variant="tonal" disabled={syncing} onClick={() => void handleSync(true)}>
              <RefreshCw className="h-4 w-4" />
              Simular (dry-run)
            </Button>
            <a
              href={status.github.htmlUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--md-shape-full)] border border-[var(--md-outline)] px-5 md-label-lg font-medium text-[var(--color-brand-primary)] transition hover:bg-[var(--color-brand-primary-subtle)]"
            >
              <ExternalLink className="h-4 w-4" />
              Ver commit
            </a>
            <Button variant="ghost" disabled={syncing} onClick={() => void load()}>
              Atualizar status
            </Button>
          </div>
        </CardContent>
      </Card>

      {result ? (
        <WebmapImportReport
          result={result}
          title={result.dryRun ? 'Resultado da simulação' : 'Resultado da importação'}
        />
      ) : lastReport && lastReport.skipped > 0 ? (
        <WebmapImportReport
          result={lastReport}
          title="Relatório da última importação (unidades ignoradas)"
        />
      ) : null}
    </div>
  );
}
