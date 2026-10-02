'use client';

import { ChangeEvent, FormEvent, useState } from 'react';
import { History, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSnackbar } from '@/components/ui/snackbar';
import { registrarChamadoHistorico } from '@/lib/api';
import {
  ANEXOS_ABERTURA_ACCEPT,
  ANEXOS_ABERTURA_FORMATOS,
  mensagemArquivoAbertura,
  mimeDeArquivo,
  lerArquivoComoDataUrl,
  type AnexoAberturaDraft,
} from '@/lib/chamado-anexos-abertura';

type AnexoDraft = { dataUrl: string; mimeType: string; nome: string };

export function ChamadoHistoricoForm({
  chamadoId,
  disabled,
  onSaved,
}: {
  chamadoId: string;
  disabled?: boolean;
  onSaved: () => void;
}) {
  const snackbar = useSnackbar();
  const [open, setOpen] = useState(false);
  const [descricao, setDescricao] = useState('');
  const [anexos, setAnexos] = useState<AnexoDraft[]>([]);
  const [busy, setBusy] = useState(false);

  async function onPickFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files?.length) return;

    const aceitos: AnexoDraft[] = [];
    let atuais: AnexoAberturaDraft[] = anexos.map((item) => ({
      id: item.nome,
      nome: item.nome,
      mimeType: item.mimeType,
      dataUrl: item.dataUrl,
      categoria: item.mimeType.startsWith('video/') ? 'video' : item.mimeType === 'application/pdf' ? 'pdf' : 'imagem',
    }));
    for (const file of Array.from(files)) {
      const mensagem = mensagemArquivoAbertura(file, atuais);
      if (mensagem) {
        snackbar.show(
          mensagem.startsWith('Formato não permitido')
            ? `Formato não permitido. Formatos permitidos: ${ANEXOS_ABERTURA_FORMATOS}.`
            : mensagem.replace(' na abertura', ''),
          'warning',
        );
        continue;
      }
      const mimeType = mimeDeArquivo(file);
      if (!mimeType) continue;
      const dataUrl = await lerArquivoComoDataUrl(file);
      const anexo = { dataUrl, mimeType, nome: file.name };
      aceitos.push(anexo);
      atuais = [
        ...atuais,
        {
          id: file.name,
          nome: file.name,
          mimeType,
          dataUrl,
          categoria: mimeType.startsWith('video/') ? 'video' : mimeType === 'application/pdf' ? 'pdf' : 'imagem',
        },
      ];
    }
    if (aceitos.length) setAnexos((current) => [...current, ...aceitos]);
    event.target.value = '';
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!descricao.trim()) {
      snackbar.show('Informe a descrição do histórico.', 'warning');
      return;
    }

    setBusy(true);
    try {
      await registrarChamadoHistorico(chamadoId, {
        descricao: descricao.trim(),
        anexos: anexos.map((item) => ({
          dataUrl: item.dataUrl,
          mimeType: item.mimeType,
          nome: item.nome,
        })),
      });
      snackbar.show('Histórico registrado.', 'success');
      setDescricao('');
      setAnexos([]);
      setOpen(false);
      onSaved();
    } catch (err) {
      snackbar.show(err instanceof Error ? err.message : 'Falha ao registrar histórico.', 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outlined" size="sm" disabled={disabled} onClick={() => setOpen(true)}>
        <History className="mr-1.5 h-3.5 w-3.5" />
        Registrar histórico
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="w-full space-y-3 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-4">
      <p className="text-[11px] font-bold tracking-wide text-[var(--ink-3)] uppercase">Registrar histórico</p>
      <textarea
        value={descricao}
        onChange={(event) => setDescricao(event.target.value)}
        rows={4}
        placeholder="Descreva a atualização…"
        disabled={busy || disabled}
        className="w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] focus:border-[var(--brand)] focus:outline-none focus:shadow-[0_0_0_3px_var(--brand-soft)]"
      />
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--r-sm)] border border-[var(--line)] px-3 py-1.5 text-[12px] font-semibold text-[var(--ink-2)] hover:bg-[var(--surface)]">
          <Paperclip className="h-3.5 w-3.5" />
          Anexar arquivos
          <input type="file" multiple accept={ANEXOS_ABERTURA_ACCEPT} className="hidden" onChange={onPickFiles} disabled={busy || disabled} />
        </label>
        {anexos.length > 0 ? <span className="text-[12px] text-[var(--ink-3)]">{anexos.length} anexo(s)</span> : null}
      </div>
      <p className="text-[12px] text-[var(--ink-3)]">Formatos permitidos: {ANEXOS_ABERTURA_FORMATOS}.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="filled" size="sm" disabled={busy || disabled}>
          Salvar histórico
        </Button>
        <Button type="button" variant="text" size="sm" disabled={busy} onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
