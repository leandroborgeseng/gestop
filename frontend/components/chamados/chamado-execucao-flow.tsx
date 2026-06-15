'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Building2,
  Camera,
  CheckCircle2,
  Crosshair,
  LoaderCircle,
  MapPin,
  Wrench,
  X,
} from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { AuthenticatedImage } from '@/components/ui/authenticated-image';
import { ZoomableAuthenticatedImage } from '@/components/ui/zoomable-authenticated-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { useSnackbar } from '@/components/ui/snackbar';
import { ErrorState, LoadingState } from '@/components/ui-states';
import { useCanGerenciarChamados } from '@/components/auth/session-context';
import {
  addChamadoExecucaoEvidencia,
  checkinChamadoExecucao,
  concluirChamadoExecucao,
  deleteChamadoExecucaoEvidencia,
  getChamadoExecucao,
} from '@/lib/api';
import { chamadoLocalLabel, chamadoTitulo } from '@/lib/chamado-geo';
import { CHAMADO_STATUS_META, prioridadeVariant } from '@/lib/chamado-status';
import { formatEvidenceSizeLimitMb, prepareEvidenceImage } from '@/lib/evidence-image';
import { captureCurrentPosition, GeoPosition } from '@/lib/geolocation';
import { ChamadoEvidencia, ChamadoExecucaoDetalhe } from '@/lib/types';
import { cn } from '@/lib/cn';

type Step = 'chegada' | 'registro' | 'encerramento';

const STEPS: Array<{ id: Step; label: string }> = [
  { id: 'chegada', label: 'Chegada' },
  { id: 'registro', label: 'Execução' },
  { id: 'encerramento', label: 'Encerramento' },
];

function openMapsRoute(latitude: number, longitude: number) {
  const destination = `${latitude},${longitude}`;
  const isApple = typeof navigator !== 'undefined' && /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);
  const url = isApple
    ? `maps://?daddr=${destination}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function buildRelatorioFinal(impedimento: boolean, motivo: string, relatorio: string) {
  if (!impedimento) return relatorio.trim();

  const motivoTrim = motivo.trim();
  const extra = relatorio.trim();
  const prefix = `Impedimento: ${motivoTrim}`;
  if (!extra || extra === motivoTrim) return prefix;
  if (extra.startsWith('Impedimento:')) return extra;
  return `${prefix}\n\n${extra}`;
}

function EvidenceLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Visualizar evidência"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
        aria-label="Fechar"
      >
        <X className="h-5 w-5" />
      </button>
      <div className="max-h-[85vh] w-full max-w-4xl" onClick={(event) => event.stopPropagation()}>
        <AuthenticatedImage src={src} alt="Evidência ampliada" className="mx-auto max-h-[80vh] w-auto rounded-[var(--r-md)] object-contain" />
      </div>
    </div>
  );
}

export function ChamadoExecucaoFlow({ chamadoId }: { chamadoId: string }) {
  const router = useRouter();
  const snackbar = useSnackbar();
  const canGerenciar = useCanGerenciarChamados();
  const [detail, setDetail] = useState<ChamadoExecucaoDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('chegada');
  const [gpsNotice, setGpsNotice] = useState<string | null>(null);
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [relatorio, setRelatorio] = useState('');
  const [impedimento, setImpedimento] = useState(false);
  const [impedimentoMotivo, setImpedimentoMotivo] = useState('');
  const [evidencias, setEvidencias] = useState<ChamadoEvidencia[]>([]);
  const [previewEvidenceUrl, setPreviewEvidenceUrl] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getChamadoExecucao(chamadoId);
      setDetail(data);
      setEvidencias(data.evidencias);
      if (data.execucaoCheckin) {
        setStep('registro');
        setPosition({
          latitude: data.execucaoCheckin.latitude,
          longitude: data.execucaoCheckin.longitude,
          precisaoMetros: data.execucaoCheckin.precisaoMetros ?? 0,
          source: 'gps',
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar chamado.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [chamadoId]);

  const st = useMemo(
    () => (detail ? CHAMADO_STATUS_META[detail.status] ?? { label: detail.status, badge: 'neutral' as const } : null),
    [detail],
  );

  const checkinDone = Boolean(detail?.execucaoCheckin);
  const relatorioFinal = useMemo(
    () => buildRelatorioFinal(impedimento, impedimentoMotivo, relatorio),
    [impedimento, impedimentoMotivo, relatorio],
  );

  const execucaoPreenchida = useMemo(() => {
    if (impedimento) return impedimentoMotivo.trim().length >= 5;
    return relatorio.trim().length >= 10 && evidencias.length >= 1;
  }, [impedimento, impedimentoMotivo, relatorio, evidencias.length]);

  async function resolvePosition(options?: { allowFallback?: boolean }) {
    const fallback =
      options?.allowFallback && detail?.unidadeExecucao != null
        ? {
            latitude: detail.unidadeExecucao.latitude,
            longitude: detail.unidadeExecucao.longitude,
            precisaoMetros: detail.unidadeExecucao.raioValidacaoMetros,
            source: 'fallback' as const,
          }
        : undefined;

    const next = await captureCurrentPosition(fallback);
    if (next.source === 'fallback') {
      throw new Error('GPS indisponível ou impreciso. Ative a localização e tente novamente no local do serviço.');
    }
    setGpsNotice(null);
    setPosition(next);
    return next;
  }

  function checkinPayloadFrom(positionSource: GeoPosition) {
    return {
      latitude: positionSource.latitude,
      longitude: positionSource.longitude,
      precisaoMetros: positionSource.precisaoMetros,
    };
  }

  function resolveCheckinForSubmit() {
    if (position) return checkinPayloadFrom(position);
    if (detail?.execucaoCheckin) {
      return {
        latitude: detail.execucaoCheckin.latitude,
        longitude: detail.execucaoCheckin.longitude,
        precisaoMetros: detail.execucaoCheckin.precisaoMetros ?? 0,
      };
    }
    return null;
  }

  async function handleCheckin() {
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      const checkin = await resolvePosition();
      const updated = await checkinChamadoExecucao(chamadoId, { checkin: checkinPayloadFrom(checkin) });
      setDetail(updated);
      setEvidencias(updated.evidencias);
      setStep('registro');
      snackbar.show('Check-in confirmado no local.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha no check-in.';
      setError(message);
      snackbar.show(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleEvidence(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !detail) return;

    if (!checkinDone) {
      setError('Confirme o check-in no local antes de anexar evidências.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const geo = resolveCheckinForSubmit() ?? checkinPayloadFrom(await resolvePosition());
      const prepared = await prepareEvidenceImage(file);
      const created = await addChamadoExecucaoEvidencia(chamadoId, {
        url: prepared.dataUrl,
        mimeType: prepared.mimeType,
        capturadaEm: new Date().toISOString(),
        localizacao: {
          latitude: geo.latitude,
          longitude: geo.longitude,
          precisaoMetros: geo.precisaoMetros,
        },
      });
      setEvidencias((current) => [...current, created]);
      snackbar.show('Evidência anexada.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao anexar evidência.';
      setError(message);
      snackbar.show(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveEvidence(evidenciaId: string) {
    if (!detail || busy) return;

    setBusy(true);
    setError(null);
    try {
      await deleteChamadoExecucaoEvidencia(chamadoId, evidenciaId);
      setEvidencias((current) => current.filter((item) => item.id !== evidenciaId));
      snackbar.show('Foto removida.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao remover evidência.';
      setError(message);
      snackbar.show(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  function validateExecucaoStep() {
    if (impedimento) {
      if (impedimentoMotivo.trim().length < 5) {
        setError('Informe o motivo do impedimento com ao menos 5 caracteres.');
        return false;
      }
      return true;
    }
    if (relatorio.trim().length < 10) {
      setError('Descreva o serviço realizado com ao menos 10 caracteres.');
      return false;
    }
    if (evidencias.length < 1) {
      setError('Anexe ao menos uma foto como evidência da execução.');
      return false;
    }
    return true;
  }

  function handleIrParaEncerramento() {
    setError(null);
    if (!validateExecucaoStep()) return;
    setStep('encerramento');
  }

  async function handleConcluir() {
    if (!detail) return;
    if (!validateExecucaoStep()) return;

    setBusy(true);
    setError(null);
    try {
      const checkin = checkinPayloadFrom(await resolvePosition());
      await concluirChamadoExecucao(chamadoId, {
        relatorio: relatorioFinal,
        checkin,
        impedimento,
        impedimentoMotivo: impedimento ? impedimentoMotivo.trim() : undefined,
      });
      snackbar.show(impedimento ? 'Impedimento registrado.' : 'Execução concluída com sucesso.', 'success');
      router.push('/execucao');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao encerrar execução.';
      setError(message);
      snackbar.show(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingState label="Carregando execução de campo..." />;
  if (error && !detail) return <ErrorState message={error} onRetry={load} />;
  if (!detail || !st) return <ErrorState message="Chamado não encontrado." onRetry={load} />;

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-24">
      {previewEvidenceUrl ? (
        <EvidenceLightbox src={previewEvidenceUrl} onClose={() => setPreviewEvidenceUrl(null)} />
      ) : null}

      <Card elevation={1}>
        <CardHeader className="border-b border-[var(--line-2)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mono text-[12px] font-semibold text-[var(--brand-hover)]">{detail.codigo}</span>
                <Badge variant={prioridadeVariant(detail.prioridade)}>{detail.prioridade}</Badge>
                <Badge variant={st.badge}>{st.label}</Badge>
              </div>
              <CardTitle className="mt-2 text-[20px] leading-snug">{chamadoTitulo(detail)}</CardTitle>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--ink-3)]">
                <span className="inline-flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  {chamadoLocalLabel(detail)}
                </span>
                {detail.unidadeExecucao?.latitude != null && detail.unidadeExecucao?.longitude != null ? (
                  <Button
                    type="button"
                    variant="text"
                    size="sm"
                    className="h-auto px-0 text-[var(--brand)]"
                    onClick={() =>
                      openMapsRoute(detail.unidadeExecucao!.latitude!, detail.unidadeExecucao!.longitude!)
                    }
                  >
                    Obter rota
                  </Button>
                ) : null}
                {detail.equipe ? (
                  <span className="inline-flex items-center gap-1">
                    <Wrench className="h-3.5 w-3.5" />
                    {detail.equipe.nome}
                  </span>
                ) : null}
              </p>
            </div>
            {canGerenciar ? (
              <Link href={`/chamados?id=${detail.id}`} className="text-[13px] font-semibold text-[var(--brand-hover)]">
                Ver na triagem
              </Link>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <ol className="grid grid-cols-3 gap-2">
            {STEPS.map((item, index) => {
              const active = item.id === step;
              const done =
                (item.id === 'chegada' && checkinDone) ||
                (item.id === 'registro' && checkinDone && execucaoPreenchida && step === 'encerramento') ||
                (item.id === 'encerramento' && false);
              return (
                <li
                  key={item.id}
                  className={cn(
                    'rounded-[var(--r-md)] border px-3 py-2 text-center text-[12px] font-semibold',
                    active
                      ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-hover)]'
                      : done
                        ? 'border-[var(--ok)] bg-[var(--ok-bg)] text-[var(--ok)]'
                        : 'border-[var(--line-2)] text-[var(--ink-3)]',
                  )}
                >
                  <span className="mono block text-[10px] opacity-70">{index + 1}</span>
                  {item.label}
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>

      {error ? <Alert variant="error">{error}</Alert> : null}
      {gpsNotice ? <Alert variant="warning">{gpsNotice}</Alert> : null}

      {step === 'chegada' ? (
        <Card elevation={1}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crosshair className="h-5 w-5 text-[var(--brand)]" />
              Check-in no local
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <p className="text-[14px] text-[var(--ink-2)]">
              Confirme que você está no próprio público antes de iniciar a execução do serviço. O GPS valida a distância
              em relação ao endereço cadastrado.
            </p>
            {detail.unidadeExecucao ? (
              <div className="rounded-[var(--r-md)] border border-[var(--line-2)] bg-[var(--surface-2)] px-4 py-3 text-[13px] text-[var(--ink-2)]">
                <p className="font-semibold text-[var(--ink)]">{detail.unidadeExecucao.endereco}</p>
                {detail.unidadeExecucao.bairro ? <p className="mt-1">{detail.unidadeExecucao.bairro}</p> : null}
                <p className="mono mt-2 text-[12px] text-[var(--ink-3)]">
                  Raio permitido: {detail.unidadeExecucao.raioValidacaoMetros} m
                </p>
              </div>
            ) : null}
            {detail.execucaoCheckin ? (
              <Alert variant="success">
                Check-in registrado em {new Date(detail.execucaoCheckin.createdAt).toLocaleString('pt-BR')}
                {detail.execucaoCheckin.distanciaMetros != null
                  ? ` · ${Math.round(detail.execucaoCheckin.distanciaMetros)} m do ponto`
                  : ''}
              </Alert>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button variant="filled" onClick={handleCheckin} disabled={busy}>
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                {checkinDone ? 'Refazer check-in' : 'Confirmar presença'}
              </Button>
              {checkinDone ? (
                <Button variant="outlined" onClick={() => setStep('registro')}>
                  Continuar para execução
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 'registro' && checkinDone ? (
        <Card elevation={1}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-[var(--brand)]" />
              Registro da execução
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <label className="flex items-start gap-3 rounded-[var(--r-md)] border border-[var(--line-2)] px-3 py-3">
              <input
                type="checkbox"
                checked={impedimento}
                onChange={(event) => {
                  setImpedimento(event.target.checked);
                  setError(null);
                }}
                className="mt-1"
              />
              <span>
                <span className="block text-[14px] font-semibold text-[var(--ink)]">Registrar impedimento</span>
                <span className="block text-[13px] text-[var(--ink-3)]">
                  Marque se não foi possível executar o serviço (falta de acesso, peça, condição no local, etc.).
                </span>
              </span>
            </label>

            {impedimento ? (
              <Field label="Motivo do impedimento">
                <textarea
                  value={impedimentoMotivo}
                  onChange={(event) => setImpedimentoMotivo(event.target.value)}
                  rows={4}
                  placeholder="Descreva o que impediu a execução: acesso negado, material indisponível, risco no local…"
                  className="w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-[14px] focus:border-[var(--brand)] focus:outline-none focus:shadow-[0_0_0_3px_var(--brand-soft)]"
                />
              </Field>
            ) : (
              <Field label="Relatório do serviço realizado">
                <textarea
                  value={relatorio}
                  onChange={(event) => setRelatorio(event.target.value)}
                  rows={5}
                  placeholder="Descreva o que foi feito: materiais usados, pontos verificados, pendências remanescentes…"
                  className="w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-[14px] focus:border-[var(--brand)] focus:outline-none focus:shadow-[0_0_0_3px_var(--brand-soft)]"
                />
              </Field>
            )}

            {impedimento ? (
              <Field label="Observações adicionais (opcional)">
                <textarea
                  value={relatorio}
                  onChange={(event) => setRelatorio(event.target.value)}
                  rows={3}
                  placeholder="Detalhes complementares sobre a visita ou tentativa de execução."
                  className="w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-[14px] focus:border-[var(--brand)] focus:outline-none focus:shadow-[0_0_0_3px_var(--brand-soft)]"
                />
              </Field>
            ) : null}

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold text-[var(--ink)]">
                  Evidências fotográficas{impedimento ? ' (opcional)' : ''}
                </p>
                <Badge variant={evidencias.length > 0 ? 'ok' : impedimento ? 'neutral' : 'warn'}>
                  {evidencias.length} foto(s)
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {evidencias.map((evidencia) => (
                  <div
                    key={evidencia.id}
                    className="relative overflow-hidden rounded-[var(--r-md)] border border-[var(--line-2)] bg-[var(--surface-2)]"
                  >
                    <button
                      type="button"
                      onClick={() => setPreviewEvidenceUrl(evidencia.url)}
                      className="block w-full text-left"
                    >
                      <AuthenticatedImage src={evidencia.url} alt="Evidência da execução" className="aspect-[4/3] w-full object-cover" />
                      <span className="block px-2 py-1 text-[11px] text-[var(--ink-3)]">
                        {new Date(evidencia.capturadaEm).toLocaleString('pt-BR')}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label="Remover foto"
                      disabled={busy}
                      onClick={() => void handleRemoveEvidence(evidencia.id)}
                      className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] shadow-[var(--sh-sm)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--r-md)] border border-dashed border-[var(--line)] bg-[var(--surface-2)] text-[13px] font-semibold text-[var(--brand-hover)] hover:bg-[var(--brand-soft)]">
                  <Camera className="h-6 w-6" />
                  Adicionar foto
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleEvidence} disabled={busy} />
                </label>
              </div>
              {!impedimento ? (
                <p className="mt-2 text-[12px] text-[var(--ink-3)]">
                  Fotos da câmera do celular são aceitas (até {formatEvidenceSizeLimitMb()}). Imagens grandes são otimizadas
                  automaticamente antes do envio.
                </p>
              ) : (
                <p className="mt-2 text-[12px] text-[var(--ink-3)]">
                  Você pode anexar fotos que documentem o impedimento, mas não é obrigatório.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => setStep('chegada')}>
                Voltar
              </Button>
              <Button variant="filled" onClick={handleIrParaEncerramento} disabled={!execucaoPreenchida}>
                Ir para encerramento
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 'encerramento' ? (
        <Card elevation={1}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-[var(--brand)]" />
              Revisão e encerramento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <p className="text-[14px] text-[var(--ink-2)]">
              Confira os dados registrados na execução. Se estiver tudo correto, conclua o chamado.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-semibold text-[var(--ink-3)]">Resultado:</span>
              {impedimento ? (
                <Badge variant="warning">
                  <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
                  Impedimento registrado
                </Badge>
              ) : (
                <Badge variant="ok">
                  <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                  Serviço executado
                </Badge>
              )}
            </div>

            <div className="rounded-[var(--r-md)] border border-[var(--line-2)] bg-[var(--surface-2)] px-4 py-3">
              <p className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">
                {impedimento ? 'Descrição do impedimento' : 'Relatório da execução'}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--ink)]">{relatorioFinal || '—'}</p>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold text-[var(--ink)]">Evidências fotográficas</p>
                <Badge variant={evidencias.length > 0 ? 'ok' : 'neutral'}>{evidencias.length} foto(s)</Badge>
              </div>
              {evidencias.length === 0 ? (
                <p className="rounded-[var(--r-md)] border border-dashed border-[var(--line)] px-4 py-6 text-center text-[13px] text-[var(--ink-3)]">
                  Nenhuma foto anexada.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {evidencias.map((evidencia) => (
                    <div
                      key={evidencia.id}
                      className="relative overflow-hidden rounded-[var(--r-md)] border border-[var(--line-2)] bg-[var(--surface-2)]"
                    >
                      <button
                        type="button"
                        onClick={() => setPreviewEvidenceUrl(evidencia.url)}
                        className="group block w-full text-left transition-shadow hover:shadow-[var(--sh-sm)]"
                      >
                        <AuthenticatedImage src={evidencia.url} alt="Evidência da execução" className="aspect-[4/3] w-full object-cover" />
                        <span className="block px-2 py-1.5 text-[11px] text-[var(--brand-hover)] group-hover:underline">
                          Abrir foto · {new Date(evidencia.capturadaEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label="Remover foto"
                        disabled={busy}
                        onClick={() => void handleRemoveEvidence(evidencia.id)}
                        className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] shadow-[var(--sh-sm)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] disabled:opacity-50"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => setStep('registro')}>
                Voltar e editar
              </Button>
              <Button variant={impedimento ? 'outlined' : 'filled'} onClick={handleConcluir} disabled={busy}>
                {busy ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : impedimento ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {impedimento ? 'Confirmar impedimento' : 'Confirmar conclusão'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {detail.fotoUrl ? (
        <Card elevation={1}>
          <CardHeader>
            <CardTitle className="text-[15px]">Foto original do chamado</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ZoomableAuthenticatedImage
              src={detail.fotoUrl}
              alt="Foto do chamado"
              className="max-h-64 w-full object-cover"
              previewClassName="max-h-[88vh] object-contain"
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
