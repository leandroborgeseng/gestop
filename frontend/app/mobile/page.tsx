'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { Camera, CloudUpload, MapPin, RefreshCcw, Save, Smartphone } from 'lucide-react';
import { AuthGate } from '@/components/auth-gate';
import { PageShell } from '@/components/layout/page-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <AuthGate requiredPermissions={['fiscalizacoes.executar']}>
      <PageShell
        kicker="PWA Campo"
        icon={Smartphone}
        title="Fiscalização offline"
        description="Preencha em campo, salve localmente e sincronize quando houver conexão."
        backHref="/cco"
      >
        <div className="mx-auto max-w-2xl space-y-4 pb-28">
          {error ? <ErrorState message={error} /> : null}
          {success ? <Alert variant="success">{success}</Alert> : null}
          {loading ? <LoadingState label="Baixando pacote de campo..." /> : null}

          {fieldPackage ? (
            <>
              <Card>
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
                <Card>
                  <CardContent className="p-4 text-sm">
                  <p className="flex items-center gap-2 font-semibold text-[var(--color-text-primary)]"><MapPin className="h-4 w-4 text-[var(--color-brand-primary)]" />{selectedUnit.nome}</p>
                  <p className="mt-1 text-zinc-500">{selectedUnit.bairro ?? 'Sem bairro'} · raio {selectedUnit.raioValidacaoMetros} m</p>
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

              <Card>
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-semibold text-zinc-950">Fila de sincronização</h2>
                    <p className="text-sm text-zinc-500">{queue.length} fiscalização(ões) pendente(s)</p>
                  </div>
                  <Button variant="brand" disabled={queue.length === 0 || syncing} onClick={syncQueue}>
                    {syncing ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
                    Sincronizar
                  </Button>
                </CardContent>
              </Card>

              {selectedVersion ? (
                <div className="fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 border-t border-zinc-200/80 bg-white/95 px-4 py-3 backdrop-blur-xl lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
                  <Button variant="brand" size="lg" className="w-full" onClick={saveOffline}>
                    <Save className="h-5 w-5" />
                    Salvar na fila offline
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </PageShell>
    </AuthGate>
  );
}

function ChecklistItemCard({ item, value, onChange, onEvidence }: { item: ChecklistItem; value?: ResponseDraft; onChange: (patch: Partial<ResponseDraft>) => void; onEvidence: (event: ChangeEvent<HTMLInputElement>) => void }) {
  const current = value ?? { conformidade: 'CONFORME', comentario: '' };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-brand-primary)]">{item.codigo}</p>
      <h3 className="text-base font-semibold text-zinc-950">{item.titulo}</h3>
      <Select value={current.conformidade} onChange={(e) => onChange({ conformidade: e.target.value as ResponseDraft['conformidade'] })}>
        <option value="CONFORME">Conforme</option>
        <option value="NAO_CONFORME">Não conforme</option>
        <option value="NAO_APLICAVEL">Não aplicável</option>
      </Select>
      <textarea value={current.comentario} onChange={(e) => onChange({ comentario: e.target.value })} placeholder="Observação" className="min-h-24 w-full rounded-2xl border border-zinc-200 bg-white p-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10" />
      <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100">
        <Camera className="h-4 w-4" />
        {current.evidenceDataUrl ? 'Foto anexada' : 'Anexar foto'}
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onEvidence} />
      </label>
      {item.exigeEvidencia ? <p className="text-xs text-amber-700">Não conformidade exige evidência.</p> : null}
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
