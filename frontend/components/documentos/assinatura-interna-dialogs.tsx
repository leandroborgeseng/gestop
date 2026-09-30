'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { useSnackbar } from '@/components/ui/snackbar';
import {
  assinarDocumentoInterno,
  disponibilizarAssinaturaInterna,
  listSignatariosInternos,
  retirarPedidoAssinatura,
} from '@/lib/api';
import type { DocumentoDetalhe } from '@/lib/types';

export function AssinarInternoDialog({
  open,
  documentoId,
  onClose,
  onDone,
}: {
  open: boolean;
  documentoId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const snackbar = useSnackbar();
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setSenha('');
      setConfirmacao(false);
    }
  }, [open]);

  async function submit() {
    if (!confirmacao) {
      snackbar.show('Confirme a assinatura deste documento.', 'error');
      return;
    }
    setBusy(true);
    try {
      await assinarDocumentoInterno(documentoId, { senha, confirmacao: true });
      setSenha('');
      snackbar.show('Documento assinado.', 'success');
      onDone();
      onClose();
    } catch (err) {
      snackbar.show(err instanceof Error ? err.message : 'Falha ao assinar.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Assinar com usuário e senha">
      <div className="space-y-3">
        <p className="text-[13px] text-[var(--ink-3)]">
          A assinatura interna usa a senha do usuário logado. Ela não substitui a assinatura desenhada de “Coletar assinatura”.
        </p>
        <Field label="Senha atual">
          <Input type="password" value={senha} autoComplete="current-password" onChange={(event) => setSenha(event.target.value)} />
        </Field>
        <label className="flex items-start gap-2 text-[13px] text-[var(--ink)]">
          <input type="checkbox" className="mt-1" checked={confirmacao} onChange={(event) => setConfirmacao(event.target.checked)} />
          Confirmo a assinatura deste documento
        </label>
        <div className="flex gap-2">
          <Button type="button" variant="filled" size="sm" disabled={busy || !senha} onClick={() => void submit()}>
            {busy ? 'Assinando…' : 'Assinar documento'}
          </Button>
          <Button type="button" variant="text" size="sm" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

export function DisponibilizarAssinaturaDialog({
  open,
  documento,
  onClose,
  onDone,
}: {
  open: boolean;
  documento: DocumentoDetalhe;
  onClose: () => void;
  onDone: () => void;
}) {
  const snackbar = useSnackbar();
  const [busca, setBusca] = useState('');
  const [opcoes, setOpcoes] = useState<Array<{ id: string; nome: string; email: string; cargo?: string | null; secretaria?: { sigla: string } | null; perfil?: string | null }>>([]);
  const [selecionados, setSelecionados] = useState<Array<{ id: string; nome: string }>>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => {
      listSignatariosInternos(busca)
        .then(setOpcoes)
        .catch((err) => snackbar.show(err instanceof Error ? err.message : 'Falha ao buscar usuários.', 'error'));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [open, busca, snackbar]);

  async function enviar() {
    if (!selecionados.length) {
      snackbar.show('Selecione ao menos um usuário.', 'error');
      return;
    }
    setBusy(true);
    try {
      await disponibilizarAssinaturaInterna(documento.id, selecionados.map((item) => item.id));
      snackbar.show('Documento encaminhado para assinatura.', 'success');
      setSelecionados([]);
      onDone();
      onClose();
    } catch (err) {
      snackbar.show(err instanceof Error ? err.message : 'Falha ao encaminhar.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Encaminhar para assinatura interna">
      <div className="space-y-3">
        <Field label="Buscar usuário">
          <Input value={busca} placeholder="Nome, e-mail, secretaria, cargo ou perfil" onChange={(event) => setBusca(event.target.value)} />
        </Field>
        {selecionados.length ? (
          <div className="flex flex-wrap gap-1.5">
            {selecionados.map((item) => (
              <button
                key={item.id}
                type="button"
                className="rounded-full bg-[var(--brand-soft)] px-2 py-1 text-[12px] text-[var(--brand-hover)]"
                onClick={() => setSelecionados((current) => current.filter((entry) => entry.id !== item.id))}
              >
                {item.nome} ×
              </button>
            ))}
          </div>
        ) : null}
        <ul className="max-h-56 space-y-1 overflow-y-auto">
          {opcoes.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="w-full rounded-[10px] border border-[var(--line)] px-3 py-2 text-left text-[13px] hover:bg-[var(--canvas-2)]"
                onClick={() =>
                  setSelecionados((current) => (current.some((entry) => entry.id === item.id) ? current : [...current, { id: item.id, nome: item.nome }]))
                }
              >
                <span className="font-medium text-[var(--ink)]">{item.nome}</span>
                <span className="block text-[11px] text-[var(--ink-3)]">
                  {[item.email, item.secretaria?.sigla, item.cargo, item.perfil].filter(Boolean).join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {(documento.signatariosPendentes ?? []).length ? (
          <div className="text-[12px] text-[var(--ink-3)]">
            Pendentes:{' '}
            {documento.signatariosPendentes?.map((item) => (
              <button
                key={item.id}
                type="button"
                className="mr-2 underline"
                onClick={() =>
                  void retirarPedidoAssinatura(item.id)
                    .then(() => onDone())
                    .catch((err) => snackbar.show(err instanceof Error ? err.message : 'Falha ao retirar.', 'error'))
                }
              >
                Retirar {item.nome}
              </button>
            ))}
          </div>
        ) : null}
        <Button type="button" variant="filled" size="sm" disabled={busy} onClick={() => void enviar()}>
          {busy ? 'Enviando…' : 'Disponibilizar'}
        </Button>
      </div>
    </Sheet>
  );
}
