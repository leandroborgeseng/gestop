'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Camera, CloudUpload, MapPin, RefreshCcw, Save } from 'lucide-react';
import { AuthGate } from '@/components/auth-gate';
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
      <main className="gestop-shell min-h-screen p-3">
        <div className="mx-auto max-w-md space-y-4">
          <Link href="/cco" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
            <ArrowLeft className="h-4 w-4" />
            CCO
          </Link>

          <header className="rounded-3xl bg-blue-700 p-5 text-white shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-100">PWA Campo</p>
            <h1 className="mt-2 text-2xl font-bold">Fiscalização offline</h1>
            <p className="mt-2 text-sm text-blue-50">Preencha em campo, salve localmente e sincronize quando houver conexão.</p>
          </header>

          {error ? <ErrorState message={error} /> : null}
          {success ? <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">{success}</div> : null}
          {loading ? <LoadingState label="Baixando pacote de campo..." /> : null}

          {fieldPackage ? (
            <>
              <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <label className="mb-3 flex flex-col gap-1 text-sm font-semibold text-slate-700">
                  Próprio público
                  <select value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)} className="min-h-11 rounded-xl border border-slate-200 px-3">
                    <option value="">Selecione</option>
                    {fieldPackage.unidades.map((unidade) => (
                      <option key={unidade.id} value={unidade.id}>{unidade.nome}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">
                  Checklist
                  <select value={checklistId} onChange={(e) => setChecklistId(e.target.value)} className="min-h-11 rounded-xl border border-slate-200 px-3">
                    <option value="">Selecione</option>
                    {fieldPackage.checklists.map((checklist) => (
                      <option key={checklist.id} value={checklist.id}>{checklist.nome}</option>
                    ))}
                  </select>
                </label>
              </section>

              {selectedUnit ? (
                <section className="rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
                  <p className="flex items-center gap-2 font-semibold text-slate-950"><MapPin className="h-4 w-4 text-blue-700" />{selectedUnit.nome}</p>
                  <p className="mt-1">{selectedUnit.bairro ?? 'Sem bairro'} · raio {selectedUnit.raioValidacaoMetros} m</p>
                </section>
              ) : null}

              {selectedVersion ? (
                <section className="space-y-3">
                  {selectedVersion.itens.map((item) => (
                    <ChecklistItemCard key={item.id} item={item} value={responses[item.id]} onChange={(patch) => updateResponse(item.id, patch)} onEvidence={(event) => handleEvidence(item.id, event)} />
                  ))}
                  <button onClick={saveOffline} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-700 px-4 font-bold text-white">
                    <Save className="h-5 w-5" />
                    Salvar na fila offline
                  </button>
                </section>
              ) : null}

              <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-slate-950">Fila de sincronização</h2>
                    <p className="text-sm text-slate-600">{queue.length} fiscalização(ões) pendente(s)</p>
                  </div>
                  <button disabled={queue.length === 0 || syncing} onClick={syncQueue} className="inline-flex items-center gap-2 rounded-xl bg-green-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">
                    {syncing ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
                    Sincronizar
                  </button>
                </div>
              </section>
            </>
          ) : null}
        </div>
      </main>
    </AuthGate>
  );
}

function ChecklistItemCard({ item, value, onChange, onEvidence }: { item: ChecklistItem; value?: ResponseDraft; onChange: (patch: Partial<ResponseDraft>) => void; onEvidence: (event: ChangeEvent<HTMLInputElement>) => void }) {
  const current = value ?? { conformidade: 'CONFORME', comentario: '' };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-blue-700">{item.codigo}</p>
      <h3 className="mt-1 font-bold text-slate-950">{item.titulo}</h3>
      <select value={current.conformidade} onChange={(e) => onChange({ conformidade: e.target.value as ResponseDraft['conformidade'] })} className="mt-3 min-h-11 w-full rounded-xl border border-slate-200 px-3">
        <option value="CONFORME">Conforme</option>
        <option value="NAO_CONFORME">Não conforme</option>
        <option value="NAO_APLICAVEL">Não aplicável</option>
      </select>
      <textarea value={current.comentario} onChange={(e) => onChange({ comentario: e.target.value })} placeholder="Observação" className="mt-3 min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm" />
      <label className="mt-3 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 text-sm font-semibold text-slate-700">
        <Camera className="h-4 w-4" />
        {current.evidenceDataUrl ? 'Foto anexada' : 'Anexar foto'}
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onEvidence} />
      </label>
      {item.exigeEvidencia ? <p className="mt-2 text-xs text-amber-700">Não conformidade exige evidência.</p> : null}
    </div>
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
