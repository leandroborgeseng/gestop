'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Sheet } from '@/components/ui/sheet';
import { LoadingState } from '@/components/ui-states';
import { useSnackbar } from '@/components/ui/snackbar';
import { coletarAssinaturaDocumento, fetchDocumentoPdfBlobUrl } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { DocumentoDetalhe } from '@/lib/types';

const QUALIFICACOES = [
  'Autuado',
  'Notificado',
  'Responsável pelo local',
  'Recebedor',
  'Testemunha',
  'Outro',
];

type Props = {
  open: boolean;
  documento: DocumentoDetalhe;
  onClose: () => void;
  onDone: () => void;
};

function useIsPortraitMobile() {
  const [state, setState] = useState({ mobile: false, portrait: false });

  useEffect(() => {
    function update() {
      const mobile = window.matchMedia('(max-width: 767px)').matches;
      const portrait = window.matchMedia('(orientation: portrait)').matches;
      setState({ mobile, portrait });
    }
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return state;
}

export function ColetarAssinaturaDialog({ open, documento, onClose, onDone }: Props) {
  const snackbar = useSnackbar();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const drawing = useRef(false);
  const [step, setStep] = useState<'conferencia' | 'dados' | 'assinatura'>('conferencia');
  const [busy, setBusy] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfVariante, setPdfVariante] = useState<'original' | 'assinado'>('original');
  const [pdfEmbedFailed, setPdfEmbedFailed] = useState(false);
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [cpfNaoInformado, setCpfNaoInformado] = useState(false);
  const [emailNaoInformado, setEmailNaoInformado] = useState(false);
  const [justificativaIdentificacao, setJustificativaIdentificacao] = useState('');
  const [qualificacao, setQualificacao] = useState(QUALIFICACOES[0]);
  const [qualificacaoOutro, setQualificacaoOutro] = useState('');
  const { mobile, portrait } = useIsPortraitMobile();

  const temAssinaturaVigente = Boolean(documento.possuiPdfAssinado);

  function prepareCanvas() {
    const canvas = canvasRef.current;
    const wrap = canvasWrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cssWidth = Math.max(320, Math.floor(wrap.clientWidth));
    const cssHeight = Math.max(180, Math.floor(wrap.clientHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cssWidth, cssHeight);
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = Math.max(2, 2.5 * (cssWidth / 640));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  useEffect(() => {
    if (!open) {
      setStep('conferencia');
      setNome('');
      setCpf('');
      setEmail('');
      setCpfNaoInformado(false);
      setEmailNaoInformado(false);
      setJustificativaIdentificacao('');
      setQualificacao(QUALIFICACOES[0]);
      setQualificacaoOutro('');
      setPdfError(null);
      setPdfEmbedFailed(false);
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
        setPdfUrl(null);
      }
      return;
    }

    const variante: 'original' | 'assinado' = temAssinaturaVigente ? 'assinado' : 'original';
    setPdfVariante(variante);
    setPdfLoading(true);
    setPdfError(null);
    setPdfEmbedFailed(false);

    let active = true;
    let objectUrl: string | null = null;

    fetchDocumentoPdfBlobUrl(documento.id, variante)
      .then((url) => {
        if (!active) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setPdfUrl(url);
      })
      .catch((err) => {
        if (!active) return;
        setPdfUrl(null);
        setPdfError(
          err instanceof Error
            ? err.message
            : 'Documento em geração. Aguarde para coletar assinatura.',
        );
      })
      .finally(() => {
        if (active) setPdfLoading(false);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, documento.id, documento.possuiPdfAssinado, temAssinaturaVigente]);

  useEffect(() => {
    if (step !== 'assinatura' || !open) return;

    prepareCanvas();
    const wrap = canvasWrapRef.current;
    if (!wrap || typeof ResizeObserver === 'undefined') {
      const onResize = () => prepareCanvas();
      window.addEventListener('resize', onResize);
      window.addEventListener('orientationchange', onResize);
      return () => {
        window.removeEventListener('resize', onResize);
        window.removeEventListener('orientationchange', onResize);
      };
    }

    const observer = new ResizeObserver(() => prepareCanvas());
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [step, open, mobile, portrait]);

  function pointerPos(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    // Contexto já está escalado por DPR: desenhar em coordenadas CSS.
    return {
      x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * (canvas.clientWidth || rect.width),
      y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * (canvas.clientHeight || rect.height),
    };
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    drawing.current = true;
    canvas.setPointerCapture(event.pointerId);
    const { x, y } = pointerPos(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = pointerPos(event);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function onPointerUp() {
    drawing.current = false;
  }

  function clearCanvas() {
    prepareCanvas();
  }

  function validarDadosAssinante(): string | null {
    if (nome.trim().length < 2) return 'Informe o nome completo do assinante.';
    if (!cpfNaoInformado && cpf.replace(/\D/g, '').length < 11) {
      return 'Informe um CPF válido ou marque que o CPF não foi informado.';
    }
    if (!emailNaoInformado && !email.includes('@')) {
      return 'Informe um e-mail válido ou marque que o e-mail não foi informado.';
    }
    if ((cpfNaoInformado || emailNaoInformado) && justificativaIdentificacao.trim().length < 5) {
      return 'Informe a justificativa da ausência de CPF e/ou e-mail (mín. 5 caracteres).';
    }
    if (qualificacao === 'Outro' && !qualificacaoOutro.trim()) {
      return 'Informe a qualificação.';
    }
    return null;
  }

  function irParaAssinatura() {
    const erro = validarDadosAssinante();
    if (erro) {
      snackbar.show(erro, 'error');
      return;
    }
    setStep('assinatura');
  }

  async function salvar() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const erro = validarDadosAssinante();
    if (erro) {
      snackbar.show(erro, 'error');
      setStep('dados');
      return;
    }

    setBusy(true);
    try {
      await coletarAssinaturaDocumento(documento.id, {
        assinanteNome: nome.trim(),
        assinanteDocumento: cpfNaoInformado ? undefined : cpf.trim(),
        assinanteEmail: emailNaoInformado ? undefined : email.trim(),
        cpfNaoInformado: cpfNaoInformado || undefined,
        emailNaoInformado: emailNaoInformado || undefined,
        justificativaIdentificacao:
          cpfNaoInformado || emailNaoInformado ? justificativaIdentificacao.trim() : undefined,
        qualificacao,
        qualificacaoOutro: qualificacao === 'Outro' ? qualificacaoOutro.trim() : undefined,
        assinaturaDataUrl: canvas.toDataURL('image/png'),
        mimeType: 'image/png',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        dispositivo: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
        sessaoId: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : undefined,
      });
      snackbar.show('Assinatura coletada e PDF assinado gerado.', 'success');
      onDone();
      onClose();
    } catch (err) {
      snackbar.show(err instanceof Error ? err.message : 'Falha ao coletar assinatura.', 'error');
    } finally {
      setBusy(false);
    }
  }

  const podeContinuar = Boolean(pdfUrl) && !pdfLoading && !pdfError;
  const assinaturaStep = step === 'assinatura';
  const conferenciaStep = step === 'conferencia';

  function abrirDocumentoPdf() {
    if (!pdfUrl) return;
    const opened = window.open(pdfUrl, '_blank', 'noopener,noreferrer');
    if (!opened) {
      const anchor = document.createElement('a');
      anchor.href = pdfUrl;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.download = `${documento.codigo.replace(/[^a-zA-Z0-9-]/g, '')}-${pdfVariante}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      snackbar.show('Se o PDF não abriu, use o arquivo baixado para conferir o documento.', 'info');
    }
  }

  const sheetClassName = cn(
    step === 'conferencia' || step === 'dados' ? 'md:max-w-3xl' : 'md:max-w-4xl',
    (assinaturaStep || conferenciaStep) &&
      mobile &&
      'inset-0 max-h-[100dvh] rounded-none pb-[env(safe-area-inset-bottom)]',
  );

  const sheetTitle =
    step === 'assinatura'
      ? 'Desenhar assinatura'
      : step === 'dados'
        ? 'Dados do assinante'
        : 'Conferir documento para assinatura';

  const footerAssinatura = assinaturaStep ? (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="text" onClick={() => setStep('dados')}>
        Voltar
      </Button>
      <Button type="button" variant="outlined" onClick={clearCanvas}>
        Limpar assinatura
      </Button>
      <Button type="button" variant="ghost" onClick={onClose}>
        Cancelar
      </Button>
      <Button type="button" variant="filled" disabled={busy} onClick={() => void salvar()}>
        Salvar assinatura
      </Button>
    </div>
  ) : undefined;

  return (
    <Sheet open={open} onClose={onClose} title={sheetTitle} className={sheetClassName} footer={footerAssinatura}>
      <div
        className={cn(
          'flex flex-col gap-4',
          assinaturaStep
            ? 'h-[min(88dvh,760px)] max-h-[min(88dvh,760px)] md:h-[min(78vh,640px)]'
            : conferenciaStep
              ? 'h-[min(88dvh,820px)] max-h-[min(88dvh,820px)] md:h-[min(80vh,720px)]'
              : 'max-h-[min(85dvh,720px)]',
          (assinaturaStep || conferenciaStep) && mobile && 'h-[calc(100dvh-7.5rem)] max-h-none',
        )}
      >
        {step === 'conferencia' ? (
          <>
            <div className="shrink-0 rounded-[12px] border border-[var(--line)] bg-[var(--canvas-2)] p-3 text-[12px] text-[var(--ink-2)]">
              <p className="font-semibold text-[var(--ink)]">{documento.titulo}</p>
              <p className="mono text-[12px] text-[var(--brand-hover)]">{documento.codigo}</p>
              <p className="mt-1 text-[var(--ink-3)]">
                Visualizando o PDF {pdfVariante === 'assinado' ? 'assinado vigente' : 'original'} que receberá a
                assinatura.
              </p>
            </div>

            <div
              className={cn(
                'relative min-h-0 flex-1 overflow-hidden rounded-[12px] border border-[var(--line)] bg-[var(--canvas-2)]',
                mobile ? 'min-h-[45dvh]' : 'min-h-[320px]',
              )}
            >
              {pdfLoading ? (
                <div className="flex h-full min-h-[40vh] items-center justify-center p-4">
                  <LoadingState label="Carregando documento..." />
                </div>
              ) : null}
              {pdfError ? (
                <div className="flex h-full min-h-[30vh] items-center justify-center p-4 text-center text-[13px] text-[var(--danger)]">
                  {pdfError.includes('não disponível') || pdfError.includes('Falha')
                    ? 'Documento em geração. Aguarde para coletar assinatura.'
                    : pdfError}
                </div>
              ) : null}
              {pdfUrl && !pdfEmbedFailed ? (
                mobile ? (
                  <object
                    data={`${pdfUrl}#view=FitH`}
                    type="application/pdf"
                    className="h-full min-h-[45dvh] w-full bg-white"
                    aria-label="Documento para conferência"
                  >
                    <div className="flex h-full min-h-[40dvh] flex-col items-center justify-center gap-3 p-4 text-center">
                      <p className="text-[13px] text-[var(--ink-2)]">
                        Não foi possível exibir o PDF neste dispositivo. Toque em Abrir documento para visualizar.
                      </p>
                      <Button type="button" variant="filled" onClick={abrirDocumentoPdf}>
                        Abrir documento
                      </Button>
                    </div>
                  </object>
                ) : (
                  <iframe
                    title="Documento para conferência"
                    src={`${pdfUrl}#view=FitH`}
                    className="h-full min-h-[min(55vh,520px)] w-full bg-white"
                    onError={() => setPdfEmbedFailed(true)}
                  />
                )
              ) : null}
              {pdfUrl && pdfEmbedFailed ? (
                <div className="flex h-full min-h-[40dvh] flex-col items-center justify-center gap-3 p-4 text-center">
                  <p className="text-[13px] text-[var(--ink-2)]">
                    Não foi possível exibir o PDF neste dispositivo. Toque em Abrir documento para visualizar.
                  </p>
                  <Button type="button" variant="filled" onClick={abrirDocumentoPdf}>
                    Abrir documento
                  </Button>
                </div>
              ) : null}
            </div>

            {pdfUrl ? (
              <div className="shrink-0 space-y-2">
                {mobile || pdfEmbedFailed ? (
                  <p className="text-[12px] text-[var(--ink-3)]">
                    {mobile
                      ? 'Se a prévia aparecer escura ou incompleta, abra o documento no visualizador do aparelho e volte para continuar a assinatura.'
                      : 'Não foi possível exibir o PDF neste navegador. Abra o documento para conferir antes de continuar.'}
                  </p>
                ) : null}
                <Button
                  type="button"
                  variant={mobile || pdfEmbedFailed ? 'outlined' : 'text'}
                  className="w-full"
                  onClick={abrirDocumentoPdf}
                >
                  Abrir documento
                </Button>
              </div>
            ) : null}

            <div className="shrink-0">
              <Button
                type="button"
                variant="filled"
                className="w-full"
                disabled={!podeContinuar}
                onClick={() => setStep('dados')}
              >
                Continuar para dados do assinante
              </Button>
            </div>
          </>
        ) : null}

        {step === 'dados' ? (
          <div className="space-y-3 overflow-y-auto">
            <p className="rounded-[10px] border border-[var(--line)] bg-[var(--canvas-2)] px-3 py-2 text-[12px] text-[var(--ink-3)]">
              CPF e e-mail são recomendados para reforçar a identificação da assinatura externa. A assinatura
              pode ser registrada sem esses dados quando a pessoa não informar ou não possuir a informação.
            </p>
            <Field label="Nome completo">
              <Input value={nome} onChange={(event) => setNome(event.target.value)} />
            </Field>
            <Field label="CPF">
              <Input
                value={cpf}
                onChange={(event) => setCpf(event.target.value)}
                placeholder="000.000.000-00"
                disabled={cpfNaoInformado}
              />
            </Field>
            <label className="flex items-center gap-2 text-[12px] text-[var(--ink-2)]">
              <input
                type="checkbox"
                checked={cpfNaoInformado}
                onChange={(event) => {
                  setCpfNaoInformado(event.target.checked);
                  if (event.target.checked) setCpf('');
                }}
              />
              CPF não informado pelo assinante
            </label>
            <Field label="E-mail">
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={emailNaoInformado}
              />
            </Field>
            <label className="flex items-center gap-2 text-[12px] text-[var(--ink-2)]">
              <input
                type="checkbox"
                checked={emailNaoInformado}
                onChange={(event) => {
                  setEmailNaoInformado(event.target.checked);
                  if (event.target.checked) setEmail('');
                }}
              />
              E-mail não informado pelo assinante
            </label>
            {cpfNaoInformado || emailNaoInformado ? (
              <Field
                label="Justificativa da identificação"
                hint="Obrigatória quando CPF e/ou e-mail não forem informados"
              >
                <Input
                  value={justificativaIdentificacao}
                  onChange={(event) => setJustificativaIdentificacao(event.target.value)}
                  placeholder="Ex.: Assinante recusou informar CPF"
                  list="justificativas-identificacao"
                />
                <datalist id="justificativas-identificacao">
                  <option value="Assinante recusou informar CPF" />
                  <option value="Assinante não possui e-mail" />
                  <option value="Assinante não soube informar" />
                  <option value="Coleta realizada em campo sem disponibilidade da informação" />
                </datalist>
              </Field>
            ) : null}
            <Field label="Qualificação">
              <Select value={qualificacao} onChange={(event) => setQualificacao(event.target.value)}>
                {QUALIFICACOES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            </Field>
            {qualificacao === 'Outro' ? (
              <Field label="Qualificação (outro)">
                <Input value={qualificacaoOutro} onChange={(event) => setQualificacaoOutro(event.target.value)} />
              </Field>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="text" onClick={() => setStep('conferencia')}>
                Voltar
              </Button>
              <Button type="button" variant="filled" onClick={irParaAssinatura}>
                Ir para assinatura
              </Button>
            </div>
          </div>
        ) : null}

        {step === 'assinatura' ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <p className="shrink-0 text-[13px] text-[var(--ink-2)]">
              Assine com o dedo, caneta touch ou mouse. A imagem será incorporada ao PDF assinado vigente.
            </p>
            {mobile && portrait ? (
              <p className="shrink-0 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                Para assinar com mais conforto, vire o celular na horizontal.
              </p>
            ) : null}
            <div
              ref={canvasWrapRef}
              className={cn(
                'min-h-0 flex-1 overflow-hidden rounded-[12px] border border-[var(--line)] bg-white shadow-[inset_0_0_0_1px_rgba(0,0,0,0.02)]',
                'h-[min(52vh,420px)] md:h-[min(48vh,380px)]',
                mobile && 'h-auto min-h-[42dvh]',
                mobile && !portrait && 'min-h-[58dvh]',
              )}
            >
              <canvas
                ref={canvasRef}
                className="h-full w-full touch-none cursor-crosshair"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
              />
            </div>
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}
