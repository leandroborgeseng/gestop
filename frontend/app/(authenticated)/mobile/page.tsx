'use client';

import Link from 'next/link';
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardList, CloudUpload, MapPin, RefreshCcw, Save, Smartphone, Satellite, Wifi, WifiOff } from 'lucide-react';
import { RequirePermissions } from '@/components/auth/require-permissions';
import {
  buildRespostaPayload,
  ChecklistItemCard,
  ResponseDraft,
  validateItemResponse,
} from '@/components/mobile/checklist-item-card';
import { getPublishedVersion } from '@/components/checklists/checklist-shared';
import { PageShell } from '@/components/layout/page-shell';
import { TipBanner } from '@/components/help/tip-banner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Fab } from '@/components/ui/fab';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { useSnackbar } from '@/components/ui/snackbar';
import { ErrorState, LoadingState } from '@/components/ui-states';
import { captureCurrentPosition, toGeoCheckin } from '@/lib/geolocation';
import { filterChecklistsForUnidade } from '@/lib/checklist-matching';
import { migrateLegacyQueueIfNeeded, readMobileQueue, writeMobileQueue } from '@/lib/mobile-queue';
import { formatUnidadeTipo } from '@/lib/unidade-tipo';
import { getMobileFieldPackage, syncMobileInspection } from '@/lib/api';
import { readCachedFieldPackage, writeCachedFieldPackage } from '@/lib/mobile-field-cache';
import { useEffectiveOnline } from '@/lib/use-effective-online';
import { registerServiceWorker, requestNotificationPermission, showLocalNotification } from '@/lib/pwa';
import { PwaInstallBanner } from '@/components/mobile/pwa-install-banner';
import { MobileFieldPackage, MobileQueuedInspection } from '@/lib/types';
import { cn } from '@/lib/cn';

const DEVICE_KEY = 'gestop.mobile.device';

export default function MobilePage() {
  const snackbar = useSnackbar();
  const [fieldPackage, setFieldPackage] = useState<MobileFieldPackage | null>(null);
  const [queue, setQueue] = useState<MobileQueuedInspection[]>([]);
  const { online, browserOnline, refreshConnectivity } = useEffectiveOnline();
  const [unidadeId, setUnidadeId] = useState('');
  const [checklistId, setChecklistId] = useState('');
  const [responses, setResponses] = useState<Record<string, ResponseDraft>>({});
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gpsNotice, setGpsNotice] = useState<string | null>(null);
  const queueRef = useRef<MobileQueuedInspection[]>([]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const syncQueue = useCallback(async () => {
    if (queueRef.current.length === 0 || syncing) return;

    const initialCount = queueRef.current.length;
    setSyncing(true);
    setError(null);
    const remaining: MobileQueuedInspection[] = [];

    for (const item of queueRef.current) {
      try {
        await syncMobileInspection(item);
      } catch (err) {
        remaining.push(item);
        setError(err instanceof Error ? err.message : 'Falha ao sincronizar um item.');
      }
    }

    setQueue(remaining);
    await writeMobileQueue(remaining);
    if (remaining.length === 0 && initialCount > 0) {
      snackbar.show('Fila sincronizada com sucesso.', 'success');
      showLocalNotification('SIGMA Vistoria', 'Vistorias sincronizadas com sucesso.');
    }
    setSyncing(false);
  }, [syncing, snackbar]);

  const downloadFieldPackage = useCallback(async (showToast = false) => {
    setDownloading(true);
    setError(null);
    try {
      const payload = await getMobileFieldPackage();
      setFieldPackage(payload);
      await writeCachedFieldPackage(payload);
      setCachedAt(payload.downloadedAt);
      if (showToast) snackbar.show('Pacote de vistoria baixado para uso offline.', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao baixar pacote de vistoria.');
    } finally {
      setDownloading(false);
      setLoading(false);
    }
  }, [snackbar]);

  useEffect(() => {
    registerServiceWorker();
    requestNotificationPermission().catch(() => undefined);

    migrateLegacyQueueIfNeeded()
      .then(() => readMobileQueue())
      .then(setQueue)
      .catch(() => setQueue([]));

    void (async () => {
      let cachedPackage: MobileFieldPackage | null = null;
      try {
        cachedPackage = await readCachedFieldPackage();
        if (cachedPackage) {
          setFieldPackage(cachedPackage);
          setCachedAt(cachedPackage.downloadedAt);
        }
      } catch {
        // cache opcional
      }

      try {
        const payload = await getMobileFieldPackage();
        setFieldPackage(payload);
        await writeCachedFieldPackage(payload);
        setCachedAt(payload.downloadedAt);
      } catch (err) {
        if (!cachedPackage) {
          setError(err instanceof Error ? err.message : 'Falha ao baixar pacote de vistoria.');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!online || queueRef.current.length === 0) return;
    void syncQueue();
  }, [online, syncQueue]);

  const selectedChecklist = useMemo(
    () => fieldPackage?.checklists.find((checklist) => checklist.id === checklistId) ?? null,
    [fieldPackage, checklistId],
  );
  const selectedVersion = useMemo(
    () => (selectedChecklist ? getPublishedVersion(selectedChecklist.versoes) : null),
    [selectedChecklist],
  );
  const selectedUnit = useMemo(
    () => fieldPackage?.unidades.find((unidade) => unidade.id === unidadeId) ?? null,
    [fieldPackage, unidadeId],
  );
  const availableChecklists = useMemo(
    () => (selectedUnit && fieldPackage ? filterChecklistsForUnidade(fieldPackage.checklists, selectedUnit) : []),
    [fieldPackage, selectedUnit],
  );

  useEffect(() => {
    if (!checklistId) return;
    if (!availableChecklists.some((checklist) => checklist.id === checklistId)) {
      setChecklistId('');
      setResponses({});
    }
  }, [availableChecklists, checklistId]);

  function updateResponse(itemId: string, patch: Partial<ResponseDraft>) {
    setResponses((current) => ({
      ...current,
      [itemId]: {
        ...(current[itemId] ?? { conformidade: 'CONFORME', comentario: '' }),
        ...patch,
      },
    }));
  }

  async function handleEvidence(itemId: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    updateResponse(itemId, {
      evidenceDataUrl: dataUrl,
      evidenceMimeType: file.type,
      evidenceSize: file.size,
    });
  }

  async function buildInspectionPayload() {
    if (!selectedUnit || !selectedVersion) {
      throw new Error('Selecione um próprio e um checklist publicado.');
    }

    const invalidMessage = selectedVersion.itens
      .map((item) => validateItemResponse(item, responses[item.id]))
      .find(Boolean);

    if (invalidMessage) {
      throw new Error(invalidMessage);
    }

    const fallback = {
      latitude: selectedUnit.latitude,
      longitude: selectedUnit.longitude,
      precisaoMetros: selectedUnit.raioValidacaoMetros,
      source: 'fallback' as const,
    };

    const checkin = await captureCurrentPosition(fallback);
    if (checkin.source === 'fallback') {
      throw new Error('GPS indisponível. Ative a localização do dispositivo para registrar a vistoria.');
    }

    const geo = toGeoCheckin(checkin);
    const now = new Date().toISOString();
    return {
      clientEventId: `${getDeviceId()}:${Date.now()}`,
      deviceId: getDeviceId(),
      unidadeId: selectedUnit.id,
      checklistVersaoId: selectedVersion.id,
      iniciadaEm: now,
      concluidaEm: now,
      checkin: geo,
      respostas: selectedVersion.itens.map((item) =>
        buildRespostaPayload(item, responses[item.id] ?? { conformidade: 'CONFORME', comentario: '' }, geo, now),
      ),
    } satisfies MobileQueuedInspection;
  }

  async function submitInspection() {
    setError(null);
    setGpsNotice(null);
    setSaving(true);

    try {
      const inspection = await buildInspectionPayload();

      if (online) {
        await syncMobileInspection(inspection);
        setResponses({});
        setChecklistId('');
        snackbar.show('Vistoria registrada com sucesso.', 'success');
        showLocalNotification('SIGMA Vistoria', 'Vistoria enviada e registrada no sistema.');
        return;
      }

      const nextQueue = [...queue, inspection];
      setQueue(nextQueue);
      await writeMobileQueue(nextQueue);
      setResponses({});
      setChecklistId('');
      snackbar.show('Vistoria salva na fila offline.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao salvar vistoria.';
      setError(message);
      snackbar.show(message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <RequirePermissions permissions={['fiscalizacoes.executar']}>
      <PageShell
        kicker="PWA Vistoria"
        icon={Smartphone}
        title="Vistoria em campo"
        description="Preencha a vistoria com GPS real. Online, o envio é imediato; offline, salve na fila para sincronizar depois."
        backHref="/cco"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="tonal" size="sm" disabled={downloading} onClick={() => void downloadFieldPackage(true)}>
              <RefreshCcw className={cn('mr-1.5 h-4 w-4', downloading && 'animate-spin')} />
              {downloading ? 'Baixando...' : 'Baixar dados offline'}
            </Button>
            <Link href="/vistorias">
              <Button variant="outlined" size="sm">
                <ClipboardList className="mr-1.5 h-4 w-4" />
                Consultar vistorias
              </Button>
            </Link>
          </div>
        }
      >
        <div className="mx-auto max-w-2xl space-y-4 pb-32">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1">
              <PwaInstallBanner />
            </div>
            <ConnectionPill online={online} browserOnline={browserOnline} onRefresh={() => void refreshConnectivity()} />
          </div>

          <TipBanner id="mobile-offline-queue">
            {online
              ? 'Com conexão ativa, a vistoria é enviada diretamente ao concluir.'
              : 'Sem sinal? Salve na fila offline — as vistorias sincronizam automaticamente ao reconectar.'}
          </TipBanner>

          {error ? <ErrorState message={error} /> : null}
          {gpsNotice ? <Alert variant="warning">{gpsNotice}</Alert> : null}
          {loading ? <LoadingState label="Baixando pacote de vistoria..." /> : null}

          {fieldPackage ? (
            <>
              <section className="overflow-hidden rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--sh-sm)]">
                <div className="border-b border-[var(--line-2)] bg-[var(--brand-soft)] px-4 py-3">
                  <div className="flex items-center justify-between text-[12px] text-[var(--ink-3)]">
                    <span>Roteiro de vistoria</span>
                    <span>{new Date().toLocaleDateString('pt-BR')}</span>
                  </div>
                  <p className="mt-1 text-[18px] font-semibold text-[var(--ink)]">
                    {fieldPackage.unidades.length} próprios no pacote
                  </p>
                  {cachedAt ? (
                    <p className="mt-1 text-[11px] text-[var(--ink-3)]">
                      Cache local: {new Date(cachedAt).toLocaleString('pt-BR')}
                    </p>
                  ) : null}
                </div>
                <div className="grid grid-cols-3 divide-x divide-[var(--line-2)]">
                  <HeroStat label="Checklists" value={fieldPackage.checklists.length} />
                  <HeroStat label="Na fila" value={queue.length} highlight={queue.length > 0} />
                  <HeroStat label="Conexão" value={online ? 'Online' : 'Offline'} />
                </div>
              </section>
              <Card elevation={1}>
                <CardHeader>
                  <CardTitle>Configurar vistoria</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <Field label="Próprio público">
                    <Select
                      value={unidadeId}
                      onChange={(e) => {
                        setUnidadeId(e.target.value);
                        setChecklistId('');
                        setResponses({});
                      }}
                    >
                      <option value="">Selecione</option>
                      {fieldPackage.unidades.map((unidade) => (
                        <option key={unidade.id} value={unidade.id}>
                          {unidade.nome} · {formatUnidadeTipo(unidade.tipo)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Checklist">
                    <Select
                      value={checklistId}
                      onChange={(e) => {
                        setChecklistId(e.target.value);
                        setResponses({});
                      }}
                      disabled={!selectedUnit}
                    >
                      <option value="">
                        {selectedUnit ? 'Selecione' : 'Selecione um próprio primeiro'}
                      </option>
                      {availableChecklists.map((checklist) => (
                        <option key={checklist.id} value={checklist.id}>
                          {checklist.nome}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {selectedUnit && availableChecklists.length === 0 ? (
                    <p className="text-[13px] text-[var(--ink-3)]">
                      Nenhum checklist publicado vinculado ao tipo{' '}
                      <strong className="text-[var(--ink)]">{formatUnidadeTipo(selectedUnit.tipo)}</strong>. Cadastre um modelo em Checklists
                      com escopo &quot;Por tipo de próprio&quot;.
                    </p>
                  ) : null}
                </CardContent>
              </Card>

              {selectedUnit ? (
                <Card elevation={1}>
                  <CardContent className="p-4">
                    <p className="flex items-center gap-2 text-[15px] font-semibold text-[var(--ink)]">
                      <MapPin className="h-4 w-4 text-[var(--brand)]" />
                      {selectedUnit.nome}
                    </p>
                    <p className="mt-1 text-[13px] text-[var(--ink-3)]">
                      {formatUnidadeTipo(selectedUnit.tipo)} · {selectedUnit.secretaria.sigla} ·{' '}
                      {selectedUnit.bairro ?? 'Sem bairro'} · raio {selectedUnit.raioValidacaoMetros} m
                    </p>
                    <Chip variant="brand" className="mt-3 gap-1.5">
                      <Satellite className="h-3.5 w-3.5" />
                      GPS ativo no check-in
                    </Chip>
                  </CardContent>
                </Card>
              ) : null}

              {selectedVersion ? (
                <section className="space-y-3">
                  {selectedVersion.itens.map((item) => (
                    <ChecklistItemCard
                      key={item.id}
                      item={item}
                      value={responses[item.id]}
                      onChange={(patch) => updateResponse(item.id, patch)}
                      onEvidence={(event) => handleEvidence(item.id, event)}
                    />
                  ))}
                </section>
              ) : null}

              <Card elevation={1}>
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-[15px] font-semibold text-[var(--ink)]">Fila de sincronização</h2>
                    <p className="text-[13px] text-[var(--ink-3)]">
                      {queue.length} vistoria(s) pendente(s) · sync automático ao voltar online
                    </p>
                  </div>
                  <Button variant="filled" disabled={queue.length === 0 || syncing || !online} onClick={() => void syncQueue()}>
                    {syncing ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
                    Sincronizar
                  </Button>
                </CardContent>
              </Card>

              {selectedVersion ? (
                <MobileInspectionFooter online={online} saving={saving} onSubmit={() => void submitInspection()} />
              ) : null}

              {queue.length > 0 && online ? (
                <Fab
                  size="icon"
                  onClick={() => void syncQueue()}
                  aria-label={`Sincronizar ${queue.length} item(ns)`}
                  disabled={syncing || !online}
                  className={cn(
                    'bg-[var(--ink)] text-white hover:bg-[var(--ink-2)]',
                  )}
                >
                  {syncing ? <RefreshCcw className="h-5 w-5 animate-spin" /> : <CloudUpload className="h-5 w-5" />}
                  <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--warn)] px-1 text-[10px] font-bold text-white">
                    {queue.length}
                  </span>
                </Fab>
              ) : null}
            </>
          ) : null}
        </div>
      </PageShell>
    </RequirePermissions>
  );
}

function getDeviceId() {
  let deviceId = window.localStorage.getItem(DEVICE_KEY);
  if (!deviceId) {
    deviceId = `device-${crypto.randomUUID()}`;
    window.localStorage.setItem(DEVICE_KEY, deviceId);
  }
  return deviceId;
}

function MobileInspectionFooter({
  online,
  saving,
  onSubmit,
}: {
  online: boolean;
  saving: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 border-t border-[var(--line-2)] bg-[var(--surface)]/95 px-4 py-3 shadow-[var(--sh-md)] backdrop-blur-sm lg:bottom-0">
      <div className="mx-auto flex w-full max-w-2xl justify-center">
        {online ? (
          <Button
            variant="filled"
            size="lg"
            disabled={saving}
            onClick={onSubmit}
            className="min-h-14 w-full max-w-sm gap-2 rounded-[var(--md-shape-lg)] px-6 shadow-[var(--md-elevation-3)] sm:w-auto"
          >
            {saving ? <RefreshCcw className="h-5 w-5 animate-spin" /> : <CloudUpload className="h-5 w-5" />}
            {saving ? 'Enviando vistoria...' : 'Concluir vistoria'}
          </Button>
        ) : (
          <Button
            variant="filled"
            size="lg"
            disabled={saving}
            onClick={onSubmit}
            aria-label="Salvar na fila offline"
            className="min-h-14 w-full max-w-sm gap-2 rounded-[var(--md-shape-lg)] px-6 shadow-[var(--md-elevation-3)] sm:w-auto"
          >
            {saving ? <RefreshCcw className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            {saving ? 'Salvando...' : 'Salvar offline'}
          </Button>
        )}
      </div>
    </div>
  );
}

function ConnectionPill({
  online,
  browserOnline,
  onRefresh,
}: {
  online: boolean;
  browserOnline: boolean;
  onRefresh: () => void;
}) {
  const label = online ? 'Online' : browserOnline ? 'Sem servidor' : 'Offline';

  return (
    <button
      type="button"
      onClick={onRefresh}
      title="Atualizar status da conexão"
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-[var(--r-pill)] border px-3 py-1.5 text-[12px] font-semibold transition-colors',
        online
          ? 'border-[var(--ok-bd)] bg-[var(--ok-bg)] text-[var(--ok)]'
          : 'border-[var(--warn-bd)] bg-[var(--warn-bg)] text-[var(--warn)]',
      )}
    >
      <span className={cn('h-2 w-2 rounded-full', online ? 'bg-[var(--ok)]' : 'bg-[var(--warn)]')} />
      {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

function HeroStat({ label, value, highlight = false }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="px-3 py-3 text-center">
      <p className={cn('text-[18px] font-semibold', highlight ? 'text-[var(--warn)]' : 'text-[var(--ink)]')}>{value}</p>
      <p className="text-[11px] font-semibold text-[var(--ink-3)]">{label}</p>
    </div>
  );
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
