'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Wrench } from 'lucide-react';
import { createChamado, createOrdemServico, getStoredAuth } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Sheet } from '@/components/ui/sheet';
import { useSnackbar } from '@/components/ui/snackbar';

type SolicitacaoTipo = 'chamado' | 'os';

const PRIORIDADES = ['BAIXA', 'MEDIA', 'ALTA', 'URGENTE'] as const;

const textareaClass =
  'min-h-[96px] w-full resize-y rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-[11px] py-2 text-[13px] text-[var(--ink)] transition-all duration-[var(--md-duration-short)] placeholder:text-[var(--ink-4)] hover:border-[#cdd8e6] focus:border-[var(--brand)] focus:outline-none focus:shadow-[0_0_0_3px_var(--brand-soft)] disabled:cursor-not-allowed disabled:opacity-50';

export function UnidadeAvulsoActions({
  unidadeId,
  unidadeNome,
  onSuccess,
  size = 'sm',
  className,
}: {
  unidadeId: string;
  unidadeNome: string;
  onSuccess?: () => void;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const canManage = getStoredAuth()?.user.permissoes.includes('chamados.gerenciar') ?? false;
  const [sheet, setSheet] = useState<SolicitacaoTipo | null>(null);

  if (!canManage) return null;

  return (
    <>
      <div className={cn('flex flex-wrap gap-2', className)}>
        <Button variant="outlined" size={size} className="gap-1.5" onClick={() => setSheet('chamado')}>
          <Bell className="h-4 w-4" />
          Abrir chamado
        </Button>
        <Button variant="outlined" size={size} className="gap-1.5" onClick={() => setSheet('os')}>
          <Wrench className="h-4 w-4" />
          Abrir OS avulsa
        </Button>
      </div>

      <AvulsoSolicitacaoSheet
        open={sheet === 'chamado'}
        tipo="chamado"
        unidadeId={unidadeId}
        unidadeNome={unidadeNome}
        onClose={() => setSheet(null)}
        onSuccess={onSuccess}
      />
      <AvulsoSolicitacaoSheet
        open={sheet === 'os'}
        tipo="os"
        unidadeId={unidadeId}
        unidadeNome={unidadeNome}
        onClose={() => setSheet(null)}
        onSuccess={onSuccess}
      />
    </>
  );
}

function AvulsoSolicitacaoSheet({
  open,
  tipo,
  unidadeId,
  unidadeNome,
  onClose,
  onSuccess,
}: {
  open: boolean;
  tipo: SolicitacaoTipo;
  unidadeId: string;
  unidadeNome: string;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const snackbar = useSnackbar();
  const [descricao, setDescricao] = useState('');
  const [titulo, setTitulo] = useState('');
  const [prioridade, setPrioridade] = useState<(typeof PRIORIDADES)[number]>('MEDIA');
  const [prazoEm, setPrazoEm] = useState('');
  const [solicitanteNome, setSolicitanteNome] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setDescricao('');
    setTitulo('');
    setPrioridade('MEDIA');
    setPrazoEm('');
    setSolicitanteNome('');
    setError(null);
  }

  function handleClose() {
    if (busy) return;
    resetForm();
    onClose();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      if (tipo === 'chamado') {
        const chamado = await createChamado({
          unidadeId,
          descricao: descricao.trim(),
          prioridade,
          origem: 'MANUAL',
          solicitanteNome: solicitanteNome.trim() || undefined,
        });
        snackbar.show(`Chamado ${chamado.codigo} aberto com sucesso.`, 'success');
        resetForm();
        onClose();
        onSuccess?.();
        router.push(`/chamados?search=${encodeURIComponent(chamado.codigo)}`);
        return;
      }

      const ordem = await createOrdemServico({
        unidadeId,
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        prioridade,
        prazoEm: prazoEm || undefined,
      });
      snackbar.show(`OS ${ordem.codigo} aberta com sucesso.`, 'success');
      resetForm();
      onClose();
      onSuccess?.();
      router.push(`/ordens-servico/${ordem.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível registrar a solicitação.');
    } finally {
      setBusy(false);
    }
  }

  const tituloSheet = tipo === 'chamado' ? 'Abrir chamado avulso' : 'Abrir ordem de serviço avulsa';

  return (
    <Sheet open={open} onClose={handleClose} title={tituloSheet}>
      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
        <p className="text-[13px] text-[var(--ink-3)]">
          Registro manual para <strong className="text-[var(--ink)]">{unidadeNome}</strong>, sem vínculo com
          fiscalização ou não conformidade.
        </p>

        {tipo === 'os' ? (
          <Field label="Título da OS" hint="Resumo objetivo do serviço (mín. 5 caracteres).">
            <Input
              value={titulo}
              onChange={(event) => setTitulo(event.target.value)}
              placeholder="Ex.: Reparo na iluminação externa"
              minLength={5}
              required
              disabled={busy}
            />
          </Field>
        ) : null}

        <Field
          label={tipo === 'chamado' ? 'Descrição do chamado' : 'Descrição detalhada'}
          hint="Descreva o problema ou serviço necessário (mín. 10 caracteres)."
        >
          <textarea
            className={textareaClass}
            value={descricao}
            onChange={(event) => setDescricao(event.target.value)}
            placeholder="Descreva a ocorrência, local interno e urgência percebida..."
            minLength={10}
            required
            disabled={busy}
          />
        </Field>

        <Field label="Prioridade">
          <Select value={prioridade} onChange={(event) => setPrioridade(event.target.value as (typeof PRIORIDADES)[number])} disabled={busy}>
            {PRIORIDADES.map((item) => (
              <option key={item} value={item}>
                {item.charAt(0) + item.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </Field>

        {tipo === 'os' ? (
          <Field label="Prazo (opcional)" hint="Se vazio, o prazo será calculado conforme a prioridade.">
            <Input type="date" value={prazoEm} onChange={(event) => setPrazoEm(event.target.value)} disabled={busy} />
          </Field>
        ) : null}

        {tipo === 'chamado' ? (
          <Field label="Solicitante (opcional)">
            <Input
              value={solicitanteNome}
              onChange={(event) => setSolicitanteNome(event.target.value)}
              placeholder="Nome de quem reportou"
              disabled={busy}
            />
          </Field>
        ) : null}

        {error ? <p className="text-[13px] text-[var(--danger)]">{error}</p> : null}

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button type="button" variant="text" onClick={handleClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" variant="filled" disabled={busy}>
            {busy ? 'Registrando...' : tipo === 'chamado' ? 'Abrir chamado' : 'Abrir OS'}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
