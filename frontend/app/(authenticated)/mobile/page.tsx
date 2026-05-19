'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { Camera, CloudUpload, MapPin, RefreshCcw, Save, Smartphone } from 'lucide-react';
import { RequirePermissions } from '@/components/auth/require-permissions';
import { PageShell } from '@/components/layout/page-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Fab } from '@/components/ui/fab';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { ErrorState, LoadingState } from '@/components/ui-states';
import { getMobileFieldPackage, syncMobileInspection } from '@/lib/api';
import { ChecklistItem, MobileFieldPackage, MobileQueuedInspection } from '@/lib/types';

const QUEUE_KEY = 'gestop.mobile.queue';
const DEVICE_KEY = 'gestop.mobile.device';

type ResponseDraft = {
  conformidade: 'CONFORME' | 'NAO_CONFORME' | 'NAO_APLICAVEL';
  comentario: string;
  evidenceDataUrl?: string;
  evidenceMimeType?: string;
  evidenceSize?: number;
};

export default function MobilePage() {
  const [fieldPackage, setFieldPackage] = useState<MobileFieldPackage | null>(null);
  const [queue, setQueue] = useState<MobileQueuedInspection[]>([]);
  const [unidadeId, setUnidadeId] = useState('');
  const [checklistId, setChecklistId] = useState('');
  const [responses, setResponses] = useState<Record<string, ResponseDraft>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setQueue(readQueue());
    getMobileFieldPackage()
      .then(setFieldPackage)
      .catch((err) => setError(err instanceof Error ? err.message : 'Falha ao baixar pacote de campo.'))
      .finally(() => setLoading(false));
  }, []);

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

  function saveOffline() {
    setError(null);
    setSuccess(null);

    if (!selectedUnit || !selectedVersion) {
      setError('Selecione um próprio e um checklist publicado.');
      return;
    }

    const invalid = selectedVersion.itens.find((item) => {
      const response = responses[item.id];
      return (
        item.obrigatorio &&
        (!response ||
          (response.conformidade === 'NAO_CONFORME' &&
            (item.exigeEvidencia && !response.evidenceDataUrl || !response.comentario.trim())))
      );
    });

    if (invalid) {
      setError(`Revise o item obrigatório: ${invalid.titulo}. Não conformidade exige comentário e evidência.`);
      return;
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
        latitude: selectedUnit.latitude,
        longitude: selectedUnit.longitude,
        precisaoMetros: 15,
      },
      respostas: selectedVersion.itens.map((item) => {
        const response = responses[item.id] ?? { conformidade: 'CONFORME', comentario: '' };
        return {
          itemId: item.id,
          conformidade: response.conformidade,
          valorBooleano: response.conformidade === 'CONFORME',
          comentario: response.comentario,
          evidencias: response.evidenceDataUrl
            ? [
                {
                  tipo: 'FOTO',
                  url: response.evidenceDataUrl,
                  mimeType: response.evidenceMimeType,
                  tamanhoBytes: response.evidenceSize,
                  capturadaEm: now,
                  localizacao: {
                    latitude: selectedUnit.latitude,
                    longitude: selectedUnit.longitude,
                    precisaoMetros: 15,
                  },
                },
              ]
            : [],
        };
      }),
    };

    const nextQueue = [...queue, inspection];
    setQueue(nextQueue);
    writeQueue(nextQueue);
    setResponses({});
    setSuccess('Fiscalização salva na fila offline.');
  }

  async function syncQueue() {
    setSyncing(true);
    setError(null);
    setSuccess(null);
    const remaining: MobileQueuedInspection[] = [];

    for (const item of queue) {
      try {
        await syncMobileInspection(item);
      } catch (err) {
        remaining.push(item);
        setError(err instanceof Error ? err.message : 'Falha ao sincronizar um item.');
      }
    }

    setQueue(remaining);
    writeQueue(remaining);
    if (remaining.length === 0) setSuccess('Fila sincronizada com sucesso.');
    setSyncing(false);
  }

  return (
    <RequirePermissions permissions={['fiscalizacoes.executar']}>
      <PageShell
        kicker="PWA Campo"
        icon={Smartphone}
        title="Fiscalização offline"
        description="Preencha em campo, salve localmente e sincronize quando houver conexão."
        backHref="/cco"
      >
        <div className="mx-auto max-w-2xl space-y-4 pb-32">
          {error ? <ErrorState message={error} /> : null}
          {success ? <Alert variant="success">{success}</Alert> : null}
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
                      <option key={unidade.id} value={unidade.id}>{unidade.nome}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Checklist">
                  <Select value={checklistId} onChange={(e) => setChecklistId(e.target.value)}>
                    <option value="">Selecione</option>
                    {fieldPackage.checklists.map((checklist) => (
                      <option key={checklist.id} value={checklist.id}>{checklist.nome}</option>
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
                  </CardContent>
                </Card>
              ) : null}

              {selectedVersion ? (
                <section className="space-y-3">
                  {selectedVersion.itens.map((item) => (
                    <ChecklistItemCard key={item.id} item={item} value={responses[item.id]} onChange={(patch) => updateResponse(item.id, patch)} onEvidence={(event) => handleEvidence(item.id, event)} />
                  ))}
                </section>
              ) : null}

              <Card elevation={1}>
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="md-title-md text-[var(--md-on-surface)]">Fila de sincronização</h2>
                    <p className="md-body-md text-[var(--md-on-surface-variant)]">{queue.length} fiscalização(ões) pendente(s)</p>
                  </div>
                  <Button variant="filled" disabled={queue.length === 0 || syncing} onClick={syncQueue}>
                    {syncing ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
                    Sincronizar
                  </Button>
                </CardContent>
              </Card>

              {selectedVersion ? (
                <Fab extended onClick={saveOffline} aria-label="Salvar na fila offline">
                  <Save className="h-5 w-5" />
                  <span>Salvar offline</span>
                </Fab>
              ) : null}
            </>
          ) : null}
        </div>
      </PageShell>
    </RequirePermissions>
  );
}

function ChecklistItemCard({ item, value, onChange, onEvidence }: { item: ChecklistItem; value?: ResponseDraft; onChange: (patch: Partial<ResponseDraft>) => void; onEvidence: (event: ChangeEvent<HTMLInputElement>) => void }) {
  const current = value ?? { conformidade: 'CONFORME', comentario: '' };

  return (
    <Card elevation={1}>
      <CardContent className="space-y-4 p-4">
      <Chip variant="brand">{item.codigo}</Chip>
      <h3 className="md-title-md text-[var(--md-on-surface)]">{item.titulo}</h3>
      <Select value={current.conformidade} onChange={(e) => onChange({ conformidade: e.target.value as ResponseDraft['conformidade'] })}>
        <option value="CONFORME">Conforme</option>
        <option value="NAO_CONFORME">Não conforme</option>
        <option value="NAO_APLICAVEL">Não aplicável</option>
      </Select>
      <textarea
        value={current.comentario}
        onChange={(e) => onChange({ comentario: e.target.value })}
        placeholder="Observação"
        className="min-h-28 w-full rounded-[var(--md-shape-sm)] border border-[var(--md-outline)] bg-[var(--md-surface-container-lowest)] p-4 md-body-md focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-4 focus:ring-[color-mix(in_srgb,var(--color-brand-primary)_12%,transparent)]"
      />
      <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-[var(--md-shape-md)] border border-dashed border-[var(--md-outline)] bg-[var(--md-surface-container-low)] px-3 md-label-lg text-[var(--md-on-surface-variant)] transition hover:bg-[var(--md-surface-container)]">
        <Camera className="h-5 w-5" />
        {current.evidenceDataUrl ? 'Foto anexada' : 'Anexar foto'}
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onEvidence} />
      </label>
      {item.exigeEvidencia ? <p className="md-body-md text-amber-700">Não conformidade exige evidência.</p> : null}
      </CardContent>
    </Card>
  );
}

function readQueue() {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(QUEUE_KEY) ?? '[]') as MobileQueuedInspection[];
  } catch {
    return [];
  }
}

function writeQueue(queue: MobileQueuedInspection[]) {
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
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
