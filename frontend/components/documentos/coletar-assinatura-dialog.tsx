'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Sheet } from '@/components/ui/sheet';
import { useSnackbar } from '@/components/ui/snackbar';
import { coletarAssinaturaDocumento } from '@/lib/api';
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

export function ColetarAssinaturaDialog({ open, documento, onClose, onDone }: Props) {
  const snackbar = useSnackbar();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [step, setStep] = useState<'conferencia' | 'dados' | 'assinatura'>('conferencia');
  const [busy, setBusy] = useState(false);
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [qualificacao, setQualificacao] = useState(QUALIFICACOES[0]);
  const [qualificacaoOutro, setQualificacaoOutro] = useState('');

  useEffect(() => {
    if (!open) {
      setStep('conferencia');
      setNome('');
      setCpf('');
      setEmail('');
      setQualificacao(QUALIFICACOES[0]);
      setQualificacaoOutro('');
    }
  }, [open]);

  useEffect(() => {
    if (step !== 'assinatura') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
  }, [step]);

  function pointerPos(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
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
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  async function salvar() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (nome.trim().length < 2 || cpf.replace(/\D/g, '').length < 11 || !email.includes('@')) {
      snackbar.show('Preencha nome, CPF e e-mail válidos.', 'error');
      return;
    }
    if (qualificacao === 'Outro' && !qualificacaoOutro.trim()) {
      snackbar.show('Informe a qualificação.', 'error');
      return;
    }

    setBusy(true);
    try {
      await coletarAssinaturaDocumento(documento.id, {
        assinanteNome: nome.trim(),
        assinanteDocumento: cpf.trim(),
        assinanteEmail: email.trim(),
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

  return (
    <Sheet open={open} onClose={onClose} title="Coletar assinatura externa">
      <div className="max-h-[75vh] space-y-4 overflow-y-auto pr-1">
        {step === 'conferencia' ? (
          <>
            <p className="text-[13px] text-[var(--ink-2)]">
              Confira o documento que será assinado. A assinatura externa é opcional e destinada a terceiros (autuado,
              notificado, responsável, etc.).
            </p>
            <div className="rounded-[12px] border border-[var(--line)] bg-[var(--canvas-2)] p-3 text-[13px]">
              <p className="font-semibold text-[var(--ink)]">{documento.titulo}</p>
              <p className="mono text-[12px] text-[var(--brand-hover)]">{documento.codigo}</p>
              <p className="mt-2 text-[var(--ink-3)]">
                {documento.secretaria ? `${documento.secretaria.sigla} · ${documento.secretaria.nome}` : '—'}
              </p>
              <p className="text-[var(--ink-3)]">
                Checklist: {documento.checklist?.nome ?? '—'}
                {documento.checklist ? ` (v${documento.checklist.versao})` : ''}
              </p>
              <p className="mt-2 text-[var(--ink-2)]">
                Respostas: {(documento as { respostas?: unknown[] }).respostas?.length ?? 0} item(ns) · PDF original:{' '}
                {documento.possuiPdfOriginal ? 'disponível' : 'pendente'}
              </p>
            </div>
            <Button type="button" variant="filled" onClick={() => setStep('dados')} disabled={!documento.possuiPdfOriginal}>
              Continuar para dados do assinante
            </Button>
          </>
        ) : null}

        {step === 'dados' ? (
          <>
            <Field label="Nome completo">
              <Input value={nome} onChange={(event) => setNome(event.target.value)} />
            </Field>
            <Field label="CPF">
              <Input value={cpf} onChange={(event) => setCpf(event.target.value)} placeholder="000.000.000-00" />
            </Field>
            <Field label="E-mail">
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </Field>
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
              <Button type="button" variant="filled" onClick={() => setStep('assinatura')}>
                Ir para assinatura
              </Button>
            </div>
          </>
        ) : null}

        {step === 'assinatura' ? (
          <>
            <p className="text-[13px] text-[var(--ink-2)]">
              Assine com o dedo, caneta touch ou mouse. A imagem será incorporada ao PDF assinado vigente.
            </p>
            <canvas
              ref={canvasRef}
              width={640}
              height={220}
              className="w-full touch-none rounded-[12px] border border-[var(--line)] bg-white"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
            />
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
          </>
        ) : null}
      </div>
    </Sheet>
  );
}
