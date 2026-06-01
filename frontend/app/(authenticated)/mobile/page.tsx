'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CloudUpload, MapPin, RefreshCcw, Save, Smartphone, Satellite } from 'lucide-react';
import { RequirePermissions } from '@/components/auth/require-permissions';
import {
  buildRespostaPayload,
  ChecklistItemCard,
  ResponseDraft,
  validateItemResponse,
} from '@/components/mobile/checklist-item-card';
import { PageShell } from '@/components/layout/page-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Fab } from '@/components/ui/fab';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { ErrorState, LoadingState } from '@/components/ui-states';
import { captureCurrentPosition } from '@/lib/geolocation';
import { migrateLegacyQueueIfNeeded, readMobileQueue, writeMobileQueue } from '@/lib/mobile-queue';
import { getMobileFieldPackage, syncMobileInspection } from '@/lib/api';
import { registerServiceWorker, requestNotificationPermission, showLocalNotification } from '@/lib/pwa';
import { PwaInstallBanner } from '@/components/mobile/pwa-install-banner';
import { MobileFieldPackage, MobileQueuedInspection } from '@/lib/types';

const DEVICE_KEY = 'gestop.mobile.device';

export default function MobilePage() {
  const [fieldPackage, setFieldPackage] = useState<MobileFieldPackage | null>(null);
  const [queue, setQueue] = useState<MobileQueuedInspection[]>([]);
  const [unidadeId, setUnidadeId] = useState('');
  const [checklistId, setChecklistId] = useState('');
  const [responses, setResponses] = useState<Record<string, ResponseDraft>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [gpsNotice, setGpsNotice] = useState<string | null>(null);
  const queueRef = useRef<MobileQueuedInspection[]>([]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const syncQueue = useCallback(async () => {
    if (queueRef.current.length === 0 || syncing) return;

    setSyncing(true);
    setError(null);
    setSuccess(null);
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
    if (remaining.length === 0) {
      setSuccess('Fila sincronizada com sucesso.');
      showLocalNotification('GestOP Campo', 'Fiscalizacoes sincronizadas com sucesso.');
    }
    setSyncing(false);
  }, [syncing]);

  useEffect(() => {
    registerServiceWorker();
    requestNotificationPermission().catch(() => undefined);

    migrateLegacyQueueIfNeeded()
      .then(() => readMobileQueue())
      .then(setQueue)
      .catch(() => setQueue([]));

    getMobileFieldPackage()
      .then(setFieldPackage)
      .catch((err) => setError(err instanceof Error ? err.message : 'Falha ao baixar pacote de campo.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function handleOnline() {
      if (navigator.onLine && queueRef.current.length > 0) {
        void syncQueue();
      }
    }

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [syncQueue]);

  const selectedChecklist = useMemo(
    () => fieldPackage?.checklists.find((checklist) => checklist.id === checklistId) ?? null,
    [fieldPackage, checklistId],
  );
  const selectedVersion = selectedChecklist?.versoes[0] ?? null;
  const selectedUnit = useMemo(
    () => fieldPackage?.unidades.find((unidade) => unidade.id === unidadeId) ?? null,
    [fieldPackage, unidadeId],
  );

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

  async function saveOffline() {
    setError(null);
    setSuccess(null);
    setGpsNotice(null);

    if (!selectedUnit || !selectedVersion) {
      setError('Selecione um próprio e um checklist publicado.');
      return;
    }

    const invalidMessage = selectedVersion.itens
      .map((item) => validateItemResponse(item, responses[item.id]))
      .find(Boolean);

    if (invalidMessage) {
      setError(invalidMessage);
      return;
    }

    setSaving(true);

    try {
      const fallback = {
        latitude: selectedUnit.latitude,
        longitude: selectedUnit.longitude,
        precisaoMetros: selectedUnit.raioValidacaoMetros,
        source: 'fallback' as const,
      };

      const checkin = await captureCurrentPosition(fallback);
      if (checkin.source === 'fallback') {
        setGpsNotice('GPS indisponível — check-in usou coordenadas do próprio. Ative a localização para validação em campo.');
      }

      const now = new Date().toISOString();
      const inspection: MobileQueuedInspection = {
        clientEventId: `${getDeviceId()}:${Date.now()}`,
        deviceId: getDeviceId(),
        unidadeId: selectedUnit.id,
        checklistVersaoId: selectedVersion.id,
        iniciadaEm: now,
        concluidaEm: now,
        checkin: {
          latitude: checkin.latitude,
          longitude: checkin.longitude,
          precisaoMetros: checkin.precisaoMetros,
        },
        respostas: selectedVersion.itens.map((item) =>
          buildRespostaPayload(item, responses[item.id] ?? { conformidade: 'CONFORME', comentario: '' }, checkin, now),
        ),
      };

      const nextQueue = [...queue, inspection];
      setQueue(nextQueue);
      await writeMobileQueue(nextQueue);
      setResponses({});
      setSuccess('Fiscalização salva na fila offline.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar fiscalização.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <RequirePermissions permissions={['fiscalizacoes.executar']}>
      <PageShell
        kicker="PWA Campo"
        icon={Smartphone}
        title="Fiscalização offline"
        description="Preencha em campo com GPS real, salve localmente e sincronize automaticamente ao voltar online."
        backHref="/cco"
      >
        <div className="mx-auto max-w-2xl space-y-4 pb-32">
          <PwaInstallBanner />
          {error ? <ErrorState message={error} /> : null}
          {success ? <Alert variant="success">{success}</Alert> : null}
          {gpsNotice ? <Alert variant="warning">{gpsNotice}</Alert> : null}
          {loading ? <LoadingState label="Baixando pacote de campo..." /> : null}

          {fieldPackage ? (
            <>
              <Card elevation={1}>
                <CardHeader>
                  <CardTitle>Configurar vistoria</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <Field label="Próprio público">
                    <Select value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)}>
                      <option value="">Selecione</option>
                      {fieldPackage.unidades.map((unidade) => (
                        <option key={unidade.id} value={unidade.id}>
                          {unidade.nome}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Checklist">
                    <Select value={checklistId} onChange={(e) => setChecklistId(e.target.value)}>
                      <option value="">Selecione</option>
                      {fieldPackage.checklists.map((checklist) => (
                        <option key={checklist.id} value={checklist.id}>
                          {checklist.nome}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </CardContent>
              </Card>

              {selectedUnit ? (
                <Card elevation={1}>
                  <CardContent className="p-4">
                    <p className="md-title-md flex items-center gap-2 text-[var(--md-on-surface)]">
                      <MapPin className="h-4 w-4 text-[var(--color-brand-primary)]" />
                      {selectedUnit.nome}
                    </p>
                    <p className="md-body-md mt-1 text-[var(--md-on-surface-variant)]">
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
                    <h2 className="md-title-md text-[var(--md-on-surface)]">Fila de sincronização</h2>
                    <p className="md-body-md text-[var(--md-on-surface-variant)]">
                      {queue.length} fiscalização(ões) pendente(s) · sync automático ao voltar online
                    </p>
                  </div>
                  <Button variant="filled" disabled={queue.length === 0 || syncing} onClick={() => void syncQueue()}>
                    {syncing ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
                    Sincronizar
                  </Button>
                </CardContent>
              </Card>

              {selectedVersion ? (
                <Fab extended onClick={() => void saveOffline()} aria-label="Salvar na fila offline" disabled={saving}>
                  <Save className="h-5 w-5" />
                  <span>{saving ? 'Salvando...' : 'Salvar offline'}</span>
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

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
