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
} from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { AuthenticatedImage } from '@/components/ui/authenticated-image';
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
  getChamadoExecucao,
} from '@/lib/api';
import { chamadoLocalLabel, chamadoTitulo } from '@/lib/chamado-geo';
import { CHAMADO_STATUS_META, prioridadeVariant } from '@/lib/chamado-status';
import { captureCurrentPosition, GeoPosition } from '@/lib/geolocation';
import { ChamadoEvidencia, ChamadoExecucaoDetalhe } from '@/lib/types';
import { cn } from '@/lib/cn';

type Step = 'chegada' | 'registro' | 'encerramento';

const STEPS: Array<{ id: Step; label: string }> = [
  { id: 'chegada', label: 'Chegada' },
  { id: 'registro', label: 'Execução' },
  { id: 'encerramento', label: 'Encerramento' },
];

import { formatEvidenceSizeLimitMb, prepareEvidenceImage } from '@/lib/evidence-image';

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

  async function handleConcluir() {
    if (!detail) return;
    if (relatorio.trim().length < 10) {
      setError('Descreva o serviço realizado com ao menos 10 caracteres.');
      return;
    }
    if (impedimento && impedimentoMotivo.trim().length < 5) {
      setError('Informe o motivo do impedimento.');
      return;
    }
    if (evidencias.length < 1) {
      setError('Anexe ao menos uma foto como evidência da execução.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const checkin = checkinPayloadFrom(await resolvePosition());
      await concluirChamadoExecucao(chamadoId, {
        relatorio: relatorio.trim(),
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
                (item.id === 'registro' && checkinDone && evidencias.length > 0) ||
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
            <Field label="Relatório do serviço realizado">
              <textarea
                value={relatorio}
                onChange={(event) => setRelatorio(event.target.value)}
                rows={5}
                placeholder="Descreva o que foi feito: materiais usados, pontos verificados, pendências remanescentes…"
                className="w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-[14px] focus:border-[var(--brand)] focus:outline-none focus:shadow-[0_0_0_3px_var(--brand-soft)]"
              />
            </Field>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold text-[var(--ink)]">Evidências fotográficas</p>
                <Badge variant={evidencias.length > 0 ? 'ok' : 'warn'}>{evidencias.length} foto(s)</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {evidencias.map((evidencia) => (
                  <figure key={evidencia.id} className="overflow-hidden rounded-[var(--r-md)] border border-[var(--line-2)] bg-[var(--surface-2)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <AuthenticatedImage src={evidencia.url} alt="Evidência da execução" className="aspect-[4/3] w-full object-cover" />
                    <figcaption className="px-2 py-1 text-[11px] text-[var(--ink-3)]">
                      {new Date(evidencia.capturadaEm).toLocaleString('pt-BR')}
                    </figcaption>
                  </figure>
                ))}
                <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--r-md)] border border-dashed border-[var(--line)] bg-[var(--surface-2)] text-[13px] font-semibold text-[var(--brand-hover)] hover:bg-[var(--brand-soft)]">
                  <Camera className="h-6 w-6" />
                  Adicionar foto
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleEvidence} disabled={busy} />
                </label>
              </div>
              <p className="mt-2 text-[12px] text-[var(--ink-3)]">
                Fotos da câmera do celular são aceitas (até {formatEvidenceSizeLimitMb()}). Imagens grandes são otimizadas
                automaticamente antes do envio.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => setStep('chegada')}>
                Voltar
              </Button>
              <Button variant="filled" onClick={() => setStep('encerramento')} disabled={relatorio.trim().length < 10 || evidencias.length < 1}>
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
              Encerramento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <p className="text-[14px] text-[var(--ink-2)]">
              Revise o relatório e as evidências. Conclua a execução ou registre um impedimento se não foi possível
              finalizar o serviço.
            </p>

            <label className="flex items-start gap-3 rounded-[var(--r-md)] border border-[var(--line-2)] px-3 py-3">
              <input
                type="checkbox"
                checked={impedimento}
                onChange={(event) => setImpedimento(event.target.checked)}
                className="mt-1"
              />
              <span>
                <span className="block text-[14px] font-semibold text-[var(--ink)]">Registrar impedimento</span>
                <span className="block text-[13px] text-[var(--ink-3)]">Use quando faltar peça, acesso ou condição para concluir agora.</span>
              </span>
            </label>

            {impedimento ? (
              <Field label="Motivo do impedimento">
                <textarea
                  value={impedimentoMotivo}
                  onChange={(event) => setImpedimentoMotivo(event.target.value)}
                  rows={3}
                  className="w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-[14px] focus:border-[var(--brand)] focus:outline-none focus:shadow-[0_0_0_3px_var(--brand-soft)]"
                />
              </Field>
            ) : null}

            <div className="rounded-[var(--r-md)] border border-[var(--line-2)] bg-[var(--surface-2)] px-4 py-3 text-[13px] text-[var(--ink-2)]">
              <p className="font-semibold text-[var(--ink)]">Resumo</p>
              <p className="mt-2 line-clamp-4 whitespace-pre-wrap">{relatorio || '—'}</p>
              <p className="mt-2 text-[var(--ink-3)]">{evidencias.length} evidência(s) anexada(s)</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => setStep('registro')}>
                Voltar
              </Button>
              <Button
                variant={impedimento ? 'outlined' : 'filled'}
                onClick={handleConcluir}
                disabled={busy}
              >
                {busy ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : impedimento ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {impedimento ? 'Registrar impedimento' : 'Concluir execução'}
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={detail.fotoUrl} alt="Foto do chamado" className="max-h-64 w-full rounded-[var(--r-md)] object-cover" />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
