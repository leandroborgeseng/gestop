'use client';

import Link from 'next/link';
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardList, ClipboardPen, CloudUpload, MapPin, Printer, RefreshCcw, Save, Smartphone, Satellite, Wifi, WifiOff, Megaphone } from 'lucide-react';
import { RequirePermissions } from '@/components/auth/require-permissions';
import {
  buildRespostaPayload,
  ChecklistItemCard,
  getResponseEvidencias,
  newEvidenceId,
  ResponseDraft,
  validateItemResponse,
} from '@/components/mobile/checklist-item-card';
import { ChamadosPendentesUnidadeSheet } from '@/components/mobile/chamados-pendentes-unidade-sheet';
import { VistoriasProgramadasPanel } from '@/components/mobile/vistorias-programadas-panel';
import { ImprimirVistoriaManualDialog } from '@/components/vistorias/imprimir-vistoria-manual-dialog';
import { LancarVistoriaManualDialog } from '@/components/vistorias/lancar-vistoria-manual-dialog';
import { getPublishedVersion } from '@/components/checklists/checklist-shared';
import { CabecalhoSecao } from '@/components/checklists/cabecalho-secao';
import { PageShell } from '@/components/layout/page-shell';
import { TipBanner } from '@/components/help/tip-banner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Fab } from '@/components/ui/fab';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useSnackbar } from '@/components/ui/snackbar';
import { ErrorState, LoadingState } from '@/components/ui-states';
import { toGeoCheckin } from '@/lib/geolocation';
import {
  CheckinGps,
  distanciaMetros,
  fazerCheckinGps,
  MENSAGEM_SEM_CONEXAO,
  mensagemForaDoRaio,
  PRECISAO_CHECKIN_PADRAO_METROS,
} from '@/lib/checkin-gps';
import { gravarRascunho, lerRascunho, limparRascunho, rascunhoTemConteudo } from '@/lib/mobile-draft';
import { avisoPacoteVencido, pacoteVencido, rotuloDadosLocais } from '@/lib/pacote-offline';
import { classificarErroSync, rotuloErroSync } from '@/lib/fila-sync';
import { IndicadorCampo, OnboardingPermissoes, usePermissoesCampo } from '@/components/mobile/estado-campo';
import { filterChecklistsForUnidade } from '@/lib/checklist-matching';
import { migrateLegacyQueueIfNeeded, readMobileQueue, writeMobileQueue } from '@/lib/mobile-queue';
import { formatUnidadeTipo } from '@/lib/unidade-tipo';
import { getMobileFieldPackage, syncMobileInspection } from '@/lib/api';
import { useSafeBackHref } from '@/lib/use-safe-back-href';
import { readCachedFieldPackage, writeCachedFieldPackage } from '@/lib/mobile-field-cache';
import { useEffectiveOnline } from '@/lib/use-effective-online';
import { prepareOfflineShell, registerServiceWorker, requestNotificationPermission, showLocalNotification } from '@/lib/pwa';
import { PwaInstallBanner } from '@/components/mobile/pwa-install-banner';
import { useSessionUser } from '@/components/auth/session-context';
import { MobileFieldPackage, MobileQueuedInspection, VistoriaProgramadaItem } from '@/lib/types';
import { cn } from '@/lib/cn';

const DEVICE_KEY = 'gestop.mobile.device';

export default function MobilePage() {
  const backHref = useSafeBackHref('/cco');
  const snackbar = useSnackbar();
  const sessionUser = useSessionUser();
  const secretariaEscopoKey = `${sessionUser?.secretaria?.id ?? 'todas'}|${sessionUser?.secretariaEscopoTodas ? '1' : '0'}`;
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
  const [chamadosPendentesOpen, setChamadosPendentesOpen] = useState(false);
  const [imprimirOpen, setImprimirOpen] = useState(false);
  const [lancarOpen, setLancarOpen] = useState(false);
  const [vistoriaTab, setVistoriaTab] = useState<'programadas' | 'avulsa'>('programadas');
  const [programadaCtx, setProgramadaCtx] = useState<{
    cronogramaId: string;
    dataProgramada: string;
    checklistNome: string;
    programacaoAtualizadaEm?: string;
  } | null>(null);
  const queueRef = useRef<MobileQueuedInspection[]>([]);
  // 303/G3: check-in (GPS validado na hora); o Concluir usa estes dados e não chama o GPS de novo.
  const [checkin, setCheckin] = useState<CheckinGps | null>(null);
  const [checkinErro, setCheckinErro] = useState<string | null>(null);
  const [fazendoCheckin, setFazendoCheckin] = useState(false);
  const permissoes = usePermissoesCampo();
  // 303/G5: rascunho local — restaurado uma vez, depois salvo a cada alteração.
  const rascunhoPronto = useRef(false);
  const [rascunhoRestaurado, setRascunhoRestaurado] = useState(false);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const syncQueue = useCallback(async (manual = true) => {
    if (queueRef.current.length === 0 || syncing) return;
    // Automático (ao reconectar): não reenvia o que o servidor já recusou (conflito, escopo, validação);
    // esses itens esperam o usuário agir (botão Sincronizar ou "Enviar como avulsa").
    const pendentesAuto = queueRef.current.filter((item) => !item.sync || item.sync.tipo === 'REDE' || item.sync.tipo === 'ERRO');
    if (!manual && pendentesAuto.length === 0) return;

    const initialCount = queueRef.current.length;
    setSyncing(true);
    setError(null);
    const remaining: MobileQueuedInspection[] = [];

    for (const item of queueRef.current) {
      if (!manual && !pendentesAuto.includes(item)) {
        remaining.push(item);
        continue;
      }
      try {
        // O5b: reenvio já gravado volta como sucesso (mesmo id, programação baixada) e sai da fila.
        await syncMobileInspection(item);
      } catch (err) {
        // O6/O10: o item fica na fila com o motivo visível; nada se perde.
        remaining.push({ ...item, sync: classificarErroSync(err, new Date(), item.sync) });
      }
    }
    if (remaining.some((item) => item.sync && item.sync.tipo !== 'REDE')) {
      setError('Algumas vistorias não sincronizaram. Veja o motivo de cada uma na fila.');
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
      // Prepara shell PWA (HTML + /_next/static) para abrir sem internet.
      await prepareOfflineShell().catch(() => undefined);
      if (showToast) {
        snackbar.show('Pacote e aplicativo preparados para uso offline.', 'success');
      }
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
    // Ao abrir online, reforça o cache do shell para o próximo uso offline.
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      void prepareOfflineShell().catch(() => undefined);
    }

    migrateLegacyQueueIfNeeded()
      .then(() => readMobileQueue())
      .then((itens) => {
        queueRef.current = itens;
        setQueue(itens);
      })
      .catch(() => setQueue([]))
      .finally(() => setFilaCarregada(true));
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);

      let cachedPackage: MobileFieldPackage | null = null;
      try {
        cachedPackage = await readCachedFieldPackage();
        if (
          cachedPackage &&
          (!cachedPackage.secretariaEscopo ||
            (cachedPackage.secretariaEscopo.ativaId ?? null) === (sessionUser?.secretaria?.id ?? null))
        ) {
          if (!cancelled) {
            setFieldPackage(cachedPackage);
            setCachedAt(cachedPackage.downloadedAt);
          }
        } else {
          cachedPackage = null;
        }
      } catch {
        // cache opcional
      }

      try {
        const payload = await getMobileFieldPackage();
        if (cancelled) return;
        setFieldPackage(payload);
        await writeCachedFieldPackage(payload);
        setCachedAt(payload.downloadedAt);
      } catch (err) {
        if (!cancelled && !cachedPackage) {
          setError(err instanceof Error ? err.message : 'Falha ao baixar pacote de vistoria.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [secretariaEscopoKey, sessionUser?.secretaria?.id]);

  useEffect(() => {
    if (!fieldPackage || rascunhoPronto.current) return;
    void lerRascunho()
      .then((r) => {
        if (!r || r.escopoKey !== secretariaEscopoKey || !fieldPackage.unidades.some((u) => u.id === r.unidadeId)) return;
        setUnidadeId(r.unidadeId);
        setChecklistId(r.checklistId);
        setProgramadaCtx(r.programadaCtx);
        setResponses(r.responses as Record<string, ResponseDraft>);
        setCheckin(r.checkin);
        setVistoriaTab('avulsa');
        setRascunhoRestaurado(true);
      })
      .catch(() => undefined)
      .finally(() => {
        rascunhoPronto.current = true;
      });
  }, [fieldPackage, secretariaEscopoKey]);

  useEffect(() => {
    if (!rascunhoPronto.current) return;
    const dados = { unidadeId, checklistId, responses, checkin };
    const handle = window.setTimeout(() => {
      if (rascunhoTemConteudo(dados)) {
        void gravarRascunho({ versao: 1, escopoKey: secretariaEscopoKey, programadaCtx, atualizadoEm: new Date().toISOString(), ...dados }).catch(() => undefined);
      } else {
        void limparRascunho().catch(() => undefined);
      }
    }, 250);
    return () => window.clearTimeout(handle);
  }, [unidadeId, checklistId, responses, checkin, programadaCtx, secretariaEscopoKey]);

  useEffect(() => {
    if (!fieldPackage) return;
    if (unidadeId && !fieldPackage.unidades.some((unidade) => unidade.id === unidadeId)) {
      setUnidadeId('');
      setChecklistId('');
      setResponses({});
    }
  }, [fieldPackage, unidadeId]);

  // Sync automático só na transição para online (não em loop a cada render do `syncing`).
  const [filaCarregada, setFilaCarregada] = useState(false);
  const syncQueueRef = useRef(syncQueue);
  syncQueueRef.current = syncQueue;
  useEffect(() => {
    if (!online || queueRef.current.length === 0) return;
    void syncQueueRef.current(false);
  }, [online, filaCarregada]);

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
    if (programadaCtx) return;
    if (!availableChecklists.some((checklist) => checklist.id === checklistId)) {
      setChecklistId('');
      setResponses({});
    }
  }, [availableChecklists, checklistId, programadaCtx]);

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
    setResponses((current) => {
      const previous = current[itemId] ?? { conformidade: 'CONFORME' as const, comentario: '' };
      const evidencias = [
        ...getResponseEvidencias(previous),
        {
          id: newEvidenceId(),
          dataUrl,
          mimeType: file.type,
          size: file.size,
        },
      ];
      return {
        ...current,
        [itemId]: {
          ...previous,
          evidencias,
          evidenceDataUrl: undefined,
          evidenceMimeType: undefined,
          evidenceSize: undefined,
        },
      };
    });
  }

  function handleRemoveEvidence(itemId: string, evidenceId: string) {
    setResponses((current) => {
      const previous = current[itemId];
      if (!previous) return current;
      const evidencias = getResponseEvidencias(previous).filter((item) => item.id !== evidenceId);
      return {
        ...current,
        [itemId]: {
          ...previous,
          evidencias,
          evidenceDataUrl: undefined,
          evidenceMimeType: undefined,
          evidenceSize: undefined,
        },
      };
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

    // G3: Concluir NÃO chama o GPS — usa o check-in feito no início.
    if (!checkin) {
      throw new Error('Faça o check-in no local antes de concluir a vistoria.');
    }

    const geo = toGeoCheckin(checkin);
    const now = new Date().toISOString();
    return {
      clientEventId: `${getDeviceId()}:${Date.now()}`,
      deviceId: getDeviceId(),
      unidadeId: selectedUnit.id,
      checklistVersaoId: selectedVersion.id,
      // G3a: início = horário do check-in; fim = agora (Concluir).
      iniciadaEm: checkin.capturadoEm,
      concluidaEm: now,
      ...(programadaCtx
        ? {
            cronogramaId: programadaCtx.cronogramaId,
            dataProgramada: programadaCtx.dataProgramada,
            ...(programadaCtx.programacaoAtualizadaEm ? { programacaoAtualizadaEm: programadaCtx.programacaoAtualizadaEm } : {}),
          }
        : {}),
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

      let enviarParaFila = !online;
      if (online) {
        try {
          await syncMobileInspection(inspection);
        } catch (err) {
          // Caiu a conexão no envio: vai para a fila (G4/G5), não perde nada.
          if (!(err as { rede?: boolean })?.rede) throw err;
          enviarParaFila = true;
        }
      }
      if (!enviarParaFila) {
        setResponses({});
        setCheckin(null);
        await limparRascunho().catch(() => undefined);
        setChecklistId('');
        const wasProgramada = Boolean(programadaCtx);
        setProgramadaCtx(null);
        if (wasProgramada) setVistoriaTab('programadas');
        snackbar.show('Vistoria registrada com sucesso.', 'success');
        showLocalNotification('SIGMA Vistoria', 'Vistoria enviada e registrada no sistema.');
        return;
      }

      const nextQueue = [...queue, inspection];
      setQueue(nextQueue);
      await writeMobileQueue(nextQueue);
      setResponses({});
      setCheckin(null);
      await limparRascunho().catch(() => undefined);
      setChecklistId('');
      const wasProgramada = Boolean(programadaCtx);
      setProgramadaCtx(null);
      if (wasProgramada) setVistoriaTab('programadas');
      snackbar.show('Vistoria salva na fila offline.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao salvar vistoria.';
      setError(message);
      snackbar.show(message, 'error');
    } finally {
      setSaving(false);
    }
  }

  function resetPreenchimento() {
    setProgramadaCtx(null);
    setUnidadeId('');
    setChecklistId('');
    setResponses({});
    setCheckin(null);
    setCheckinErro(null);
    setRascunhoRestaurado(false);
  }

  const limitePrecisao = fieldPackage?.config?.precisaoMaxCheckinMetros ?? PRECISAO_CHECKIN_PADRAO_METROS;

  async function fazerCheckin() {
    if (!selectedUnit) return;
    setFazendoCheckin(true);
    setCheckinErro(null);
    try {
      const r = await fazerCheckinGps({ limiteMetros: limitePrecisao });
      if (!r.ok) {
        setCheckinErro(r.mensagem);
        return;
      }
      const distancia = distanciaMetros(r.checkin, selectedUnit);
      if (distancia > selectedUnit.raioValidacaoMetros) {
        setCheckinErro(mensagemForaDoRaio(distancia, selectedUnit.raioValidacaoMetros));
        return;
      }
      setCheckin(r.checkin);
    } finally {
      setFazendoCheckin(false);
      void permissoes.atualizar();
    }
  }

  async function enviarComoAvulsa(clientEventId: string) {
    const next = queue.map((item) => {
      if (item.clientEventId !== clientEventId) return item;
      const { cronogramaId: _c, dataProgramada: _d, programacaoAtualizadaEm: _p, sync: _s, ...resto } = item;
      void _c; void _d; void _p; void _s;
      return resto;
    });
    setQueue(next);
    await writeMobileQueue(next);
    snackbar.show('A vistoria será enviada sem vínculo com a programação.', 'info');
  }

  function startProgramada(item: VistoriaProgramadaItem) {
    if (!fieldPackage) {
      snackbar.show('Baixe o pacote de vistoria antes de iniciar.', 'error');
      return;
    }
    const unidade = fieldPackage.unidades.find((entry) => entry.id === item.unidade.id);
    if (!unidade) {
      snackbar.show('Este próprio não está no pacote de vistoria. Baixe os dados offline novamente.', 'error');
      return;
    }
    const checklist = fieldPackage.checklists.find((entry) => entry.id === item.checklist.id);
    if (!checklist || !getPublishedVersion(checklist.versoes)) {
      snackbar.show('Checklist programado indisponível no pacote. Baixe os dados offline novamente.', 'error');
      return;
    }
    setUnidadeId(item.unidade.id);
    setChecklistId(item.checklist.id);
    setResponses({});
    setCheckin(null);
    setCheckinErro(null);
    setProgramadaCtx({
      cronogramaId: item.cronogramaId,
      dataProgramada: item.data,
      checklistNome: item.checklist.nome,
      programacaoAtualizadaEm: item.cronogramaAtualizadoEm,
    });
    setVistoriaTab('avulsa');
  }

  const fillingFromProgramada = Boolean(programadaCtx);
  const showProgramadas = vistoriaTab === 'programadas' && !fillingFromProgramada;

  return (
    <RequirePermissions permissions={['fiscalizacoes.executar']}>
      <PageShell
        kicker="PWA Vistoria"
        icon={Smartphone}
        title="Vistoria em campo"
        description="Preencha a vistoria com GPS real. Online, o envio é imediato; offline, salve na fila para sincronizar depois."
        backHref={backHref}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outlined" size="sm" disabled={!online} onClick={() => setImprimirOpen(true)}>
              <Printer className="mr-1.5 h-4 w-4" />
              Imprimir vistoria manual
            </Button>
            <Button variant="tonal" size="sm" disabled={!online} onClick={() => setLancarOpen(true)}>
              <ClipboardPen className="mr-1.5 h-4 w-4" />
              Lançar vistoria manual
            </Button>
            <Button variant="tonal" size="sm" disabled={downloading || !online} onClick={() => void downloadFieldPackage(true)}>
              <RefreshCcw className={cn('mr-1.5 h-4 w-4', downloading && 'animate-spin')} />
              {downloading ? 'Baixando...' : 'Baixar dados offline'}
            </Button>
            {online ? (
              <Link href="/vistorias">
                <Button variant="outlined" size="sm">
                  <ClipboardList className="mr-1.5 h-4 w-4" />
                  Consultar vistorias
                </Button>
              </Link>
            ) : null}
          </div>
        }
      >
        <div className={cn('w-full min-w-0 max-w-full overflow-x-hidden', showProgramadas ? 'space-y-4 pb-32' : 'mx-auto max-w-2xl space-y-4 pb-32')}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1">
              <PwaInstallBanner />
            </div>
            <ConnectionPill online={online} browserOnline={browserOnline} onRefresh={() => void refreshConnectivity()} />
          </div>
          <IndicadorCampo gps={permissoes.gps} camera={permissoes.camera} online={online} ultimoGps={checkin ? `${checkin.precisaoMetros} m` : null} />
          <OnboardingPermissoes gps={permissoes.gps} camera={permissoes.camera} onAtualizar={() => void permissoes.atualizar()} />

          <TipBanner id="mobile-offline-queue">
            {online
              ? 'Use “Baixar dados offline” para salvar o pacote e preparar o PWA. Depois disso, o app abre sem internet.'
              : 'Modo Offline ativo. Use os próprios e checklists do pacote baixado; a vistoria entra na fila e sincroniza ao reconectar.'}
          </TipBanner>

          {error ? <ErrorState message={error} /> : null}
          {fieldPackage && pacoteVencido(fieldPackage) ? (
            <div data-testid="aviso-pacote-vencido">
              <Alert variant="warning">{avisoPacoteVencido(fieldPackage)}</Alert>
            </div>
          ) : null}
          {rascunhoRestaurado ? (
            <div data-testid="aviso-rascunho-restaurado">
              <Alert variant="info">Vistoria em andamento restaurada do rascunho local (respostas, fotos e check-in).</Alert>
            </div>
          ) : null}
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
                    <p className="mt-1 text-[11px] text-[var(--ink-3)]" data-testid="pacote-dados-locais">
                      {rotuloDadosLocais(cachedAt)}
                    </p>
                  ) : null}
                </div>
                <div className="grid grid-cols-4 divide-x divide-[var(--line-2)]">
                  <HeroStat label="Checklists" value={fieldPackage.checklists.length} />
                  <HeroStat label="Programações" value={fieldPackage.contadores?.programacoes ?? fieldPackage.programacoes?.length ?? 0} testid="contador-programacoes" />
                  <HeroStat label="Na fila" value={queue.length} highlight={queue.length > 0} />
                  <HeroStat label="Conexão" value={online ? 'Online' : 'Offline'} />
                </div>
              </section>

              <div className="flex w-full min-w-0 flex-wrap items-center gap-2">
                <Chip
                  active={showProgramadas}
                  onClick={() => {
                    resetPreenchimento();
                    setVistoriaTab('programadas');
                  }}
                >
                  Vistorias programadas
                </Chip>
                <Chip
                  active={!showProgramadas}
                  onClick={() => {
                    if (fillingFromProgramada) {
                      resetPreenchimento();
                    }
                    setVistoriaTab('avulsa');
                  }}
                >
                  Vistoria avulsa
                </Chip>
              </div>

              {fillingFromProgramada ? (
                <Alert variant="info" className="break-words">
                  Vistoria programada em andamento
                  {programadaCtx?.checklistNome ? ` · ${programadaCtx.checklistNome}` : ''}
                  {programadaCtx?.dataProgramada
                    ? ` · ${new Date(`${programadaCtx.dataProgramada}T12:00:00`).toLocaleDateString('pt-BR')}`
                    : ''}
                  .{' '}
                  <button
                    type="button"
                    className="font-semibold underline"
                    onClick={() => {
                      resetPreenchimento();
                      setVistoriaTab('programadas');
                    }}
                  >
                    Voltar às programadas
                  </button>
                </Alert>
              ) : null}

              {showProgramadas ? (
                <VistoriasProgramadasPanel fieldPackage={fieldPackage} onIniciar={startProgramada} online={online} usuarioId={sessionUser?.id} />
              ) : (
                <>
              <Card elevation={1}>
                <CardHeader>
                  <CardTitle>{fillingFromProgramada ? 'Vistoria programada' : 'Configurar vistoria'}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <Field label="Próprio público">
                    <SearchableSelect
                      value={unidadeId}
                      placeholder="Selecione"
                      disabled={fillingFromProgramada}
                      onChange={(next) => {
                        setUnidadeId(next);
                        setChecklistId('');
                        setResponses({});
                        setCheckin(null);
                        setCheckinErro(null);
                      }}
                      options={fieldPackage.unidades.map((unidade) => ({
                        value: unidade.id,
                        label: fieldPackage.secretariaEscopo?.todas
                          ? `${unidade.secretaria.sigla} · ${unidade.nome} · ${formatUnidadeTipo(unidade.tipo)}`
                          : `${unidade.nome} · ${formatUnidadeTipo(unidade.tipo)}`,
                      }))}
                    />
                  </Field>
                  <Field label="Checklist">
                    <Select
                      value={checklistId}
                      onChange={(e) => {
                        setChecklistId(e.target.value);
                        setResponses({});
                      }}
                      disabled={!selectedUnit || fillingFromProgramada}
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
                    <p className="flex min-w-0 items-start gap-2 text-[15px] font-semibold text-[var(--ink)]">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand)]" />
                      <span className="min-w-0 break-words">{selectedUnit.nome}</span>
                    </p>
                    <p className="mt-1 break-words text-[13px] text-[var(--ink-3)]">
                      {formatUnidadeTipo(selectedUnit.tipo)} · {selectedUnit.secretaria.sigla} ·{' '}
                      {selectedUnit.bairro ?? 'Sem bairro'} · raio {selectedUnit.raioValidacaoMetros} m
                    </p>
                    <div className="mt-3 space-y-2" data-testid="checkin-card">
                      {checkin ? (
                        <p data-testid="checkin-ok" className="text-[13px] font-semibold text-[var(--ok)]">
                          Check-in feito às {new Date(checkin.capturadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · precisão{' '}
                          {checkin.precisaoMetros} m
                        </p>
                      ) : (
                        <Button type="button" variant="filled" size="sm" disabled={fazendoCheckin} onClick={() => void fazerCheckin()} data-testid="fazer-checkin">
                          <Satellite className="mr-1.5 h-4 w-4" />
                          {fazendoCheckin ? 'Obtendo localização...' : 'Fazer check-in'}
                        </Button>
                      )}
                      {checkinErro ? (
                        <div data-testid="checkin-erro">
                          <Alert variant="warning">{checkinErro}</Alert>
                        </div>
                      ) : null}
                      {!online ? (
                        <p data-testid="checkin-sem-conexao" className="text-[12px] text-[var(--ink-3)]">
                          {MENSAGEM_SEM_CONEXAO}
                        </p>
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outlined"
                        size="sm"
                        onClick={() => setChamadosPendentesOpen(true)}
                      >
                        <Megaphone className="mr-1.5 h-3.5 w-3.5" />
                        Chamados pendentes
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {selectedVersion ? (
                <section className="space-y-3">
                  {selectedVersion.itens.map((item, index) => (
                    <div key={item.id} className="space-y-2">
                    <CabecalhoSecao atual={item.secao} anterior={selectedVersion.itens[index - 1]?.secao} />
                    <ChecklistItemCard
                      item={item}
                      value={responses[item.id]}
                      onChange={(patch) => updateResponse(item.id, patch)}
                      onEvidence={(event) => void handleEvidence(item.id, event)}
                      onRemoveEvidence={(evidenceId) => handleRemoveEvidence(item.id, evidenceId)}
                    />
                    </div>
                  ))}
                </section>
              ) : null}
                </>
              )}

              <Card elevation={1}>
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-[15px] font-semibold text-[var(--ink)]">Fila de sincronização</h2>
                    <p className="text-[13px] text-[var(--ink-3)]">
                      {queue.length} vistoria(s) pendente(s) · sync automático ao voltar online
                    </p>
                  </div>
                  <Button variant="filled" disabled={queue.length === 0 || syncing || !online} onClick={() => void syncQueue(true)}>
                    {syncing ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
                    Sincronizar
                  </Button>
                </CardContent>
                {queue.some((item) => item.sync) ? (
                  <ul className="space-y-2 border-t border-[var(--line-2)] px-4 py-3" data-testid="fila-erros">
                    {queue
                      .filter((item) => item.sync)
                      .map((item) => {
                        const unidade = fieldPackage.unidades.find((u) => u.id === item.unidadeId);
                        return (
                          <li key={item.clientEventId} data-testid="fila-item-erro" data-tipo={item.sync!.tipo} className="text-[12px]">
                            <p className="font-semibold text-[var(--ink)]">
                              {unidade?.nome ?? 'Próprio'} · {new Date(item.concluidaEm).toLocaleString('pt-BR')}
                              {item.cronogramaId ? ' · programada' : ' · avulsa'}
                            </p>
                            <p className={item.sync!.tipo === 'REDE' ? 'text-[var(--ink-3)]' : 'text-[var(--danger)]'}>{rotuloErroSync(item.sync!)}</p>
                            {item.sync!.tipo === 'CONFLITO' && item.cronogramaId ? (
                              <Button type="button" variant="text" size="sm" onClick={() => void enviarComoAvulsa(item.clientEventId)}>
                                Enviar como vistoria avulsa (sem baixar a programação)
                              </Button>
                            ) : null}
                          </li>
                        );
                      })}
                  </ul>
                ) : null}
              </Card>

              {selectedVersion ? (
                <MobileInspectionFooter online={online} saving={saving} semCheckin={!checkin} onSubmit={() => void submitInspection()} />
              ) : null}

              {queue.length > 0 && online ? (
                <Fab
                  size="icon"
                  onClick={() => void syncQueue(true)}
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
      {selectedUnit ? (
        <ChamadosPendentesUnidadeSheet
          open={chamadosPendentesOpen}
          onClose={() => setChamadosPendentesOpen(false)}
          unidadeId={selectedUnit.id}
          unidadeNome={selectedUnit.nome}
        />
      ) : null}
      <ImprimirVistoriaManualDialog open={imprimirOpen} onClose={() => setImprimirOpen(false)} />
      <LancarVistoriaManualDialog open={lancarOpen} onClose={() => setLancarOpen(false)} />
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
  semCheckin,
  onSubmit,
}: {
  online: boolean;
  saving: boolean;
  semCheckin: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 border-t border-[var(--line-2)] bg-[var(--surface)]/95 px-4 py-3 shadow-[var(--sh-md)] backdrop-blur-sm lg:bottom-0">
      <div className="mx-auto flex w-full max-w-2xl justify-center">
        {online ? (
          <Button
            variant="filled"
            size="lg"
            disabled={saving || semCheckin}
            title={semCheckin ? 'Faça o check-in antes de concluir' : undefined}
            data-testid="concluir-vistoria"
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
            disabled={saving || semCheckin}
            title={semCheckin ? 'Faça o check-in antes de concluir' : undefined}
            data-testid="concluir-vistoria"
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

function HeroStat({ label, value, highlight = false, testid }: { label: string; value: string | number; highlight?: boolean; testid?: string }) {
  return (
    <div className="px-3 py-3 text-center" data-testid={testid}>
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
