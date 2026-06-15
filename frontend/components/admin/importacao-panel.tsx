'use client';

import { useCallback, useEffect, useState } from 'react';
import { Database, Download, ExternalLink, RefreshCw } from 'lucide-react';
import {
  applyWebmapImport,
  getWebmapImportStatus,
  previewWebmapImport,
  syncWebmapImport,
  syncWebmapImportAll,
} from '@/lib/api';
import { WebmapImportResult, WebmapImportSelection, WebmapImportStatus } from '@/lib/types';
import { WebmapImportPreview } from '@/components/admin/webmap-import-preview';
import { WebmapImportReport } from '@/components/admin/webmap-import-report';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState, LoadingState } from '@/components/ui-states';

export function ImportacaoPanel({ onSynced }: { onSynced?: () => void }) {
  const [status, setStatus] = useState<WebmapImportStatus | null>(null);
  const [preview, setPreview] = useState<WebmapImportResult | null>(null);
  const [result, setResult] = useState<WebmapImportResult | null>(null);
  const [lastReport, setLastReport] = useState<WebmapImportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextStatus = await getWebmapImportStatus();
      setStatus(nextStatus);
      const importResult = nextStatus.lastSync?.importResult;
      if (importResult) {
        setLastReport(importResult);
      } else if (nextStatus.lastSync?.skippedUnits?.length) {
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
          layersProcessed: nextStatus.layersConfigured,
          layersFailed: nextStatus.lastSync.layersFailed ?? 0,
          totalUnidadesInDb: nextStatus.unidadesCount,
          github: nextStatus.github,
        });
      } else {
        setLastReport(null);
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

  async function handlePreview() {
    setSyncing(true);
    setError(null);
    setResult(null);
    setPreview(null);
    try {
      const previewResult = await previewWebmapImport();
      setPreview(previewResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao simular importação.');
    } finally {
      setSyncing(false);
    }
  }

  async function handleApply(payload: {
    selections: WebmapImportSelection[];
    applyDeactivations: boolean;
  }) {
    setApplying(true);
    setError(null);
    try {
      const applyResult = await applyWebmapImport(payload);
      setResult(applyResult);
      setPreview(null);
      await load();
      onSynced?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao aplicar importação.');
    } finally {
      setApplying(false);
    }
  }

  async function handleSync(dryRun: boolean) {
    setSyncing(true);
    setError(null);
    setResult(null);
    setPreview(null);
    try {
      const syncResult = await syncWebmapImport(dryRun);
      if (dryRun) {
        setPreview(syncResult);
      } else {
        setResult(syncResult);
        await load();
        onSynced?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao sincronizar webmap.');
    } finally {
      setSyncing(false);
    }
  }

  async function handleSyncAll(dryRun: boolean) {
    setSyncing(true);
    setError(null);
    setResult(null);
    setPreview(null);
    try {
      const syncResult = await syncWebmapImportAll(dryRun);
      if (dryRun) {
        setPreview(syncResult.webmap);
      } else {
        setResult(syncResult.webmap);
        await load();
        onSynced?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na importação completa.');
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
            Sincroniza camadas do{' '}
            <a href={status.repoUrl} target="_blank" rel="noreferrer" className="text-[var(--color-brand-primary)] hover:underline">
              SMMAFRANCA/webmap
            </a>
            . Simule antes de aplicar, edite dados errados em Próprios e proteja correções manuais.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-[var(--md-shape-md)] bg-[var(--md-surface-container-low)] p-3">
              <dt className="md-label-md text-[var(--md-on-surface-variant)]">Commit GitHub</dt>
              <dd className="md-body-md mt-1 font-mono">{status.github.commitSha.slice(0, 7)}</dd>
              <dd className="md-body-md mt-1 text-[var(--md-on-surface-variant)]">{status.github.commitMessage}</dd>
            </div>
            <div className="rounded-[var(--md-shape-md)] bg-[var(--md-surface-container-low)] p-3">
              <dt className="md-label-md text-[var(--md-on-surface-variant)]">Última sync</dt>
              {status.lastSync ? (
                <>
                  <dd className="md-body-md mt-1 font-mono">{status.lastSync.githubCommitSha.slice(0, 7)}</dd>
                  <dd className="md-body-md mt-1 text-[var(--md-on-surface-variant)]">
                    {status.lastSync.usuario.nome} · {status.lastSync.triggeredBy ?? 'manual'}
                  </dd>
                  <dd className="md-label-md mt-2">
                    +{status.lastSync.created ?? 0} · ~{status.lastSync.updated ?? 0} · {status.lastSync.skipped ?? 0} ignoradas
                  </dd>
                </>
              ) : (
                <dd className="md-body-md mt-1">Nunca sincronizado</dd>
              )}
            </div>
            <div className="rounded-[var(--md-shape-md)] bg-[var(--md-surface-container-low)] p-3">
              <dt className="md-label-md text-[var(--md-on-surface-variant)]">Unidades ativas</dt>
              <dd className="md-headline-md mt-1 text-[var(--color-brand-primary)]">{status.unidadesCount}</dd>
            </div>
            <div className="rounded-[var(--md-shape-md)] bg-[var(--md-surface-container-low)] p-3">
              <dt className="md-label-md text-[var(--md-on-surface-variant)]">Camadas</dt>
              <dd className="md-headline-md mt-1">{status.layersConfigured}</dd>
              {status.automation ? (
                <dd className="md-label-md mt-2 text-[var(--md-on-surface-variant)]">
                  Cron {status.automation.cronEnabled ? 'on' : 'off'} · Webhook {status.automation.webhookEnabled ? 'on' : 'off'}
                </dd>
              ) : null}
            </div>
          </dl>

          {status.hasUpdates ? (
            <Alert variant="warning">Há alterações no GitHub desde a última sync. Simule antes de aplicar.</Alert>
          ) : status.lastSync ? (
            <Alert variant="success">Banco alinhado com o último commit importado.</Alert>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button variant="filled" disabled={syncing || applying} onClick={() => void handlePreview()}>
              <RefreshCw className="h-4 w-4" />
              {syncing ? 'Simulando...' : 'Simular importação'}
            </Button>
            <Button variant="tonal" disabled={syncing || applying} onClick={() => void handleSyncAll(false)}>
              <Database className="h-4 w-4" />
              {syncing ? 'Importando...' : 'Aplicar tudo (Secretarias + Webmap)'}
            </Button>
            <Button variant="tonal" disabled={syncing || applying} onClick={() => void handleSync(false)}>
              <Download className="h-4 w-4" />
              Aplicar tudo (só Webmap)
            </Button>
            <a
              href={status.github.htmlUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--md-shape-full)] border border-[var(--md-outline)] px-5 md-label-lg font-medium text-[var(--color-brand-primary)]"
            >
              <ExternalLink className="h-4 w-4" />
              Ver commit
            </a>
            <Button variant="ghost" disabled={syncing || applying} onClick={() => void load()}>
              Atualizar status
            </Button>
          </div>
        </CardContent>
      </Card>

      {preview ? (
        <WebmapImportPreview result={preview} onApply={handleApply} applying={applying} />
      ) : null}

      {result ? (
        <WebmapImportReport result={result} title={result.dryRun ? 'Resultado da simulação' : 'Resultado da importação aplicada'} />
      ) : lastReport && (lastReport.skipped > 0 || lastReport.rejectedFeatures.length > 0) ? (
        <WebmapImportReport result={lastReport} title="Relatório da última importação" />
      ) : null}
    </div>
  );
}
