'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, DatabaseBackup, HardDrive, Play, Save } from 'lucide-react';
import {
  getBackupStatus,
  listBackupObjects,
  restoreBackup,
  runBackupNow,
  saveBackupConfig,
} from '@/lib/api';
import { BackupS3ObjectItem, BackupS3StatusResponse } from '@/lib/types';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useSnackbar } from '@/components/ui/snackbar';
import { ErrorState, LoadingState } from '@/components/ui-states';

function FieldsGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

const HOURS = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour),
  label: `${String(hour).padStart(2, '0')}:00`,
}));

const STATUS_LABEL: Record<BackupS3StatusResponse['status'], string> = {
  ativo: 'Ativo',
  desabilitado: 'Desabilitado',
  incompleto: 'Incompleto',
  em_execucao: 'Em execução',
};

const STATUS_VARIANT: Record<
  BackupS3StatusResponse['status'],
  'success' | 'muted' | 'warning' | 'info'
> = {
  ativo: 'success',
  desabilitado: 'muted',
  incompleto: 'warning',
  em_execucao: 'info',
};

type FormState = {
  enabled: boolean;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  prefix: string;
  dailyHour: number;
  keepDaily: number;
  keepWeekly: number;
  keepMonthly: number;
  endpoint: string;
  timezone: string;
  forcePathStyle: boolean;
};

function emptyForm(): FormState {
  return {
    enabled: false,
    bucket: '',
    region: 'auto',
    accessKeyId: '',
    secretAccessKey: '',
    prefix: 'sigma-backups',
    dailyHour: 2,
    keepDaily: 7,
    keepWeekly: 5,
    keepMonthly: 12,
    endpoint: '',
    timezone: 'America/Sao_Paulo',
    forcePathStyle: false,
  };
}

function formFromStatus(status: BackupS3StatusResponse): FormState {
  const c = status.config;
  return {
    enabled: c.enabled,
    bucket: c.bucket ?? '',
    region: c.region || 'auto',
    accessKeyId: c.accessKeyId ?? '',
    secretAccessKey: '',
    prefix: c.prefix || 'sigma-backups',
    dailyHour: c.dailyHour,
    keepDaily: c.keepDaily,
    keepWeekly: c.keepWeekly,
    keepMonthly: c.keepMonthly,
    endpoint: c.endpoint ?? '',
    timezone: c.timezone || 'America/Sao_Paulo',
    forcePathStyle: c.forcePathStyle,
  };
}

function formatBytes(bytes: number | null) {
  if (bytes == null || Number.isNaN(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(value: string | null) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function BackupPanel() {
  const snackbar = useSnackbar();
  const [status, setStatus] = useState<BackupS3StatusResponse | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [objects, setObjects] = useState<BackupS3ObjectItem[]>([]);
  const [objectsLoading, setObjectsLoading] = useState(false);
  const [restoreKey, setRestoreKey] = useState('');
  const [restoreConfirm, setRestoreConfirm] = useState('');
  const [restoring, setRestoring] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await getBackupStatus();
      setStatus(next);
      setForm(formFromStatus(next));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar backup S3.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadObjects = useCallback(async () => {
    setObjectsLoading(true);
    try {
      const result = await listBackupObjects();
      setObjects(result.items);
      if (result.items[0] && !restoreKey) {
        setRestoreKey(result.items[0].key);
      }
    } catch {
      setObjects([]);
    } finally {
      setObjectsLoading(false);
    }
  }, [restoreKey]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (status?.config.hasSecretAccessKey && status.config.bucket) {
      void loadObjects();
    }
  }, [status?.config.bucket, status?.config.hasSecretAccessKey, loadObjects]);

  const secretHint = useMemo(() => {
    if (status?.config.hasSecretAccessKey) {
      return 'Secret já salvo. Deixe em branco para manter o valor atual.';
    }
    return 'Obrigatório para ativar o backup automático.';
  }, [status?.config.hasSecretAccessKey]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const next = await saveBackupConfig({
        enabled: form.enabled,
        bucket: form.bucket || null,
        region: form.region || 'auto',
        accessKeyId: form.accessKeyId || null,
        secretAccessKey: form.secretAccessKey || null,
        prefix: form.prefix || 'sigma-backups',
        dailyHour: form.dailyHour,
        keepDaily: form.keepDaily,
        keepWeekly: form.keepWeekly,
        keepMonthly: form.keepMonthly,
        endpoint: form.endpoint || null,
        timezone: form.timezone || 'America/Sao_Paulo',
        forcePathStyle: form.forcePathStyle,
      });
      setStatus(next);
      setForm(formFromStatus(next));
      snackbar.show('Configuração de backup salva.', 'success');
      void loadObjects();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar configuração.';
      setError(msg);
      snackbar.show(msg, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleRunNow() {
    setRunning(true);
    setError(null);
    try {
      const result = await runBackupNow();
      setStatus(result.status);
      setForm(formFromStatus(result.status));
      snackbar.show(
        `Backup enviado (${result.objectKeys.length} cópia(s), ${formatBytes(result.bytes)}).`,
        'success',
      );
      void loadObjects();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao executar backup.';
      setError(msg);
      snackbar.show(msg, 'error');
      await load();
    } finally {
      setRunning(false);
    }
  }

  async function handleRestore() {
    if (restoreConfirm !== 'RESTAURAR') {
      snackbar.show('Digite exatamente RESTAURAR para confirmar.', 'error');
      return;
    }
    if (!restoreKey) {
      snackbar.show('Selecione um arquivo de backup.', 'error');
      return;
    }
    const ok = window.confirm(
      'Esta operação sobrescreve o banco de dados atual (e arquivos locais, se houver no backup). Continuar?',
    );
    if (!ok) return;

    setRestoring(true);
    setError(null);
    try {
      const result = await restoreBackup({ objectKey: restoreKey, confirmacao: 'RESTAURAR' });
      snackbar.show(result.message ?? 'Backup restaurado com sucesso.', 'success');
      setRestoreConfirm('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao restaurar backup.';
      setError(msg);
      snackbar.show(msg, 'error');
    } finally {
      setRestoring(false);
    }
  }

  if (loading) return <LoadingState label="Carregando backup automático..." />;
  if (error && !status) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DatabaseBackup className="h-4 w-4 text-[var(--brand)]" />
                Backup automático (S3)
              </CardTitle>
              <CardDescription>
                Dump completo do banco + uploads locais, enviado diariamente para bucket S3-compatible
                (AWS, R2, MinIO). Retenção GFS com prune automático.
              </CardDescription>
            </div>
            {status ? (
              <Badge variant={STATUS_VARIANT[status.status]}>{STATUS_LABEL[status.status]}</Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? <Alert variant="error">{error}</Alert> : null}

          <div className="grid gap-3 rounded-[var(--r-md)] border border-[var(--line-2)] bg-[var(--muted-bg)] p-3 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-3)]">
                Última execução
              </p>
              <p className="mt-1 text-[13px] text-[var(--ink)]">
                {formatDateTime(status?.lastRun.at ?? null)}
              </p>
              <p className="mt-0.5 text-[12px] text-[var(--ink-3)]">
                {status?.lastRun.status === 'success'
                  ? `Sucesso · ${status.lastRun.trigger === 'cron' ? 'automático' : status.lastRun.trigger === 'manual' ? 'manual' : '—'}`
                  : status?.lastRun.status === 'error'
                    ? `Erro · ${status.lastRun.error ?? 'falha'}`
                    : 'Nenhuma execução registrada'}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-3)]">
                Detalhes
              </p>
              <p className="mt-1 text-[12px] text-[var(--ink-3)] break-all">
                {status?.lastRun.objectKey
                  ? `${status.lastRun.objectKey} · ${formatBytes(status.lastRun.bytes)}`
                  : '—'}
              </p>
              <p className="mt-0.5 text-[12px] text-[var(--ink-3)]">
                Cron: {status?.cronRegistered ? 'registrado' : 'não registrado'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <label className="flex items-center gap-2 text-[13px] text-[var(--ink)]">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(event) => setForm((prev) => ({ ...prev, enabled: event.target.checked }))}
              />
              Ativar backup diário automático
            </label>

            <div>
              <h3 className="mb-3 text-[13.5px] font-semibold text-[var(--ink)]">Destino S3</h3>
              <FieldsGrid>
                <Field label="Nome do bucket">
                  <Input
                    value={form.bucket}
                    onChange={(event) => setForm((prev) => ({ ...prev, bucket: event.target.value }))}
                    placeholder="meu-bucket-backups"
                    autoComplete="off"
                  />
                </Field>
                <Field label="Região">
                  <Input
                    value={form.region}
                    onChange={(event) => setForm((prev) => ({ ...prev, region: event.target.value }))}
                    placeholder="auto"
                    autoComplete="off"
                  />
                </Field>
                <Field label="Access Key ID">
                  <Input
                    value={form.accessKeyId}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, accessKeyId: event.target.value }))
                    }
                    autoComplete="off"
                  />
                </Field>
                <Field label="Secret Access Key" hint={secretHint}>
                  <Input
                    type="password"
                    value={form.secretAccessKey}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, secretAccessKey: event.target.value }))
                    }
                    placeholder={status?.config.hasSecretAccessKey ? '••••••••' : ''}
                    autoComplete="new-password"
                  />
                </Field>
                <Field label="Pasta / prefixo no bucket">
                  <Input
                    value={form.prefix}
                    onChange={(event) => setForm((prev) => ({ ...prev, prefix: event.target.value }))}
                    placeholder="sigma-backups"
                    autoComplete="off"
                  />
                </Field>
                <Field label="Horário do backup diário" hint="Fuso padrão: America/Sao_Paulo">
                  <Select
                    value={String(form.dailyHour)}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, dailyHour: Number(event.target.value) }))
                    }
                  >
                    {HOURS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </FieldsGrid>
            </div>

            <div>
              <h3 className="mb-3 text-[13.5px] font-semibold text-[var(--ink)]">Retenção (GFS)</h3>
              <FieldsGrid>
                <Field label="Cópias diárias" hint="Pasta daily/ — padrão 7">
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={form.keepDaily}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, keepDaily: Number(event.target.value) || 1 }))
                    }
                  />
                </Field>
                <Field label="Cópias semanais" hint="Gerada no domingo — pasta weekly/">
                  <Input
                    type="number"
                    min={1}
                    max={104}
                    value={form.keepWeekly}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, keepWeekly: Number(event.target.value) || 1 }))
                    }
                  />
                </Field>
                <Field label="Cópias mensais" hint="Gerada no dia 1 — pasta monthly/">
                  <Input
                    type="number"
                    min={1}
                    max={120}
                    value={form.keepMonthly}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, keepMonthly: Number(event.target.value) || 1 }))
                    }
                  />
                </Field>
              </FieldsGrid>
            </div>

            <div className="rounded-[var(--r-md)] border border-[var(--line)]">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-left text-[13px] font-semibold text-[var(--ink)]"
                onClick={() => setAdvancedOpen((open) => !open)}
              >
                Opções avançadas
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {advancedOpen ? (
                <div className="border-t border-[var(--line)] px-4 py-4">
                  <FieldsGrid>
                    <Field label="Endpoint (R2 / MinIO)" hint="Deixe vazio para AWS S3 padrão">
                      <Input
                        value={form.endpoint}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, endpoint: event.target.value }))
                        }
                        placeholder="https://..."
                        autoComplete="off"
                      />
                    </Field>
                    <Field label="Fuso horário">
                      <Input
                        value={form.timezone}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, timezone: event.target.value }))
                        }
                        placeholder="America/Sao_Paulo"
                        autoComplete="off"
                      />
                    </Field>
                    <label className="flex items-center gap-2 text-[13px] text-[var(--ink)] sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={form.forcePathStyle}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, forcePathStyle: event.target.checked }))
                        }
                      />
                      Force path-style (recomendado para MinIO / alguns S3-compatible)
                    </label>
                  </FieldsGrid>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saving || running || restoring}>
                <Save className="h-4 w-4" />
                {saving ? 'Salvando...' : 'Salvar configuração'}
              </Button>
              <Button
                type="button"
                variant="outlined"
                disabled={saving || running || restoring || status?.status === 'em_execucao'}
                onClick={() => void handleRunNow()}
              >
                <Play className="h-4 w-4" />
                {running ? 'Executando...' : 'Executar backup agora'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-[var(--brand)]" />
            Restaurar a partir do S3
          </CardTitle>
          <CardDescription>
            Operação destrutiva. Digite <strong>RESTAURAR</strong> para confirmar. Exige{' '}
            <code className="text-[12px]">psql</code> no ambiente do backend.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="Arquivo de backup">
            <Select
              value={restoreKey}
              onChange={(event) => setRestoreKey(event.target.value)}
              disabled={objectsLoading || objects.length === 0}
            >
              {objects.length === 0 ? (
                <option value="">Nenhum backup listado</option>
              ) : (
                objects.map((item) => (
                  <option key={item.key} value={item.key}>
                    [{item.tier}] {item.key} ({formatBytes(item.size)})
                  </option>
                ))
              )}
            </Select>
          </Field>
          <Field label='Confirmação (digite RESTAURAR)'>
            <Input
              value={restoreConfirm}
              onChange={(event) => setRestoreConfirm(event.target.value)}
              placeholder="RESTAURAR"
              autoComplete="off"
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outlined"
              disabled={objectsLoading}
              onClick={() => void loadObjects()}
            >
              Atualizar lista
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={restoring || running || !restoreKey}
              onClick={() => void handleRestore()}
            >
              {restoring ? 'Restaurando...' : 'Restaurar backup'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
