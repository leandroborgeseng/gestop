'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Search } from 'lucide-react';
import { createChamado, getStoredAuth, getUnidades } from '@/lib/api';
import { UnidadeOperacional } from '@/lib/types';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Sheet } from '@/components/ui/sheet';
import { useSnackbar } from '@/components/ui/snackbar';

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
  unidadeId?: string;
  unidadeNome?: string;
  onSuccess?: () => void;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const canManage = getStoredAuth()?.user.permissoes.includes('chamados.gerenciar') ?? false;
  const [open, setOpen] = useState(false);
  const [pickedUnidade, setPickedUnidade] = useState<{ id: string; nome: string } | null>(
    unidadeId && unidadeNome ? { id: unidadeId, nome: unidadeNome } : null,
  );

  useEffect(() => {
    if (unidadeId && unidadeNome) {
      setPickedUnidade({ id: unidadeId, nome: unidadeNome });
    }
  }, [unidadeId, unidadeNome]);

  if (!canManage) return null;

  const resolvedUnidade = pickedUnidade ?? (unidadeId && unidadeNome ? { id: unidadeId, nome: unidadeNome } : null);

  return (
    <>
      <div className={cn('flex flex-wrap gap-2', className)}>
        <Button variant="outlined" size={size} className="gap-1.5" onClick={() => setOpen(true)}>
          <Bell className="h-4 w-4" />
          Abrir chamado
        </Button>
      </div>

      <AbrirChamadoSheet
        open={open}
        unidade={resolvedUnidade}
        onUnidadeChange={setPickedUnidade}
        onClose={() => setOpen(false)}
        onSuccess={onSuccess}
      />
    </>
  );
}

function AbrirChamadoSheet({
  open,
  unidade,
  onUnidadeChange,
  onClose,
  onSuccess,
}: {
  open: boolean;
  unidade: { id: string; nome: string } | null;
  onUnidadeChange: (unidade: { id: string; nome: string } | null) => void;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const snackbar = useSnackbar();
  const [descricao, setDescricao] = useState('');
  const [prioridade, setPrioridade] = useState<(typeof PRIORIDADES)[number]>('MEDIA');
  const [solicitanteNome, setSolicitanteNome] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unidades, setUnidades] = useState<UnidadeOperacional[]>([]);
  const [loadingUnidades, setLoadingUnidades] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  useEffect(() => {
    if (!open || unidade) return;

    let active = true;
    setLoadingUnidades(true);
    getUnidades({})
      .then((items) => {
        if (active) setUnidades(items);
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar a lista de próprios.');
      })
      .finally(() => {
        if (active) setLoadingUnidades(false);
      });

    return () => {
      active = false;
    };
  }, [open, unidade]);

  const filteredUnidades = useMemo(() => {
    const query = pickerSearch.trim().toLowerCase();
    if (!query) return unidades.slice(0, 80);
    return unidades
      .filter((item) =>
        [item.nome, item.codigoPatrimonial, item.endereco, item.bairro, item.secretaria.sigla]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query),
      )
      .slice(0, 80);
  }, [pickerSearch, unidades]);

  function resetForm() {
    setDescricao('');
    setPrioridade('MEDIA');
    setSolicitanteNome('');
    setPickerSearch('');
    setError(null);
  }

  function handleClose() {
    if (busy) return;
    resetForm();
    onClose();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!unidade) {
      setError('Selecione o próprio público antes de continuar.');
      return;
    }

    setError(null);
    setBusy(true);

    try {
      const chamado = await createChamado({
        unidadeId: unidade.id,
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível registrar o chamado.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={handleClose} title="Abrir chamado">
      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
        {!unidade ? (
          <div className="space-y-3">
            <p className="text-[13px] text-[var(--ink-3)]">
              Escolha o próprio público. O chamado seguirá para triagem e atendimento na fila de Chamados.
            </p>
            <Field label="Buscar próprio">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--ink-3)]" />
                <Input
                  value={pickerSearch}
                  onChange={(event) => setPickerSearch(event.target.value)}
                  placeholder="Nome, código ou endereço"
                  className="pl-9"
                  disabled={busy || loadingUnidades}
                />
              </div>
            </Field>
            <div className="max-h-52 space-y-1 overflow-y-auto rounded-[var(--r-md)] border border-[var(--line)] p-1">
              {loadingUnidades ? (
                <p className="px-3 py-4 text-center text-[13px] text-[var(--ink-3)]">Carregando próprios...</p>
              ) : filteredUnidades.length === 0 ? (
                <p className="px-3 py-4 text-center text-[13px] text-[var(--ink-3)]">Nenhum próprio encontrado.</p>
              ) : (
                filteredUnidades.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onUnidadeChange({ id: item.id, nome: item.nome })}
                    className="flex w-full flex-col rounded-[var(--r-sm)] px-3 py-2 text-left hover:bg-[var(--surface-2)]"
                  >
                    <span className="mono text-[11px] font-semibold text-[var(--brand-hover)]">{item.codigoPatrimonial}</span>
                    <span className="text-[13px] font-semibold text-[var(--ink)]">{item.nome}</span>
                    <span className="text-[11px] text-[var(--ink-3)]">
                      {item.secretaria.sigla}
                      {item.bairro ? ` · ${item.bairro}` : ''}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-[var(--ink-3)]">
            Chamado avulso para <strong className="text-[var(--ink)]">{unidade.nome}</strong>. Após abrir, acompanhe a
            triagem e o atendimento em <strong className="text-[var(--ink)]">Chamados</strong>.{' '}
            <button
              type="button"
              className="font-semibold text-[var(--brand)] hover:underline"
              onClick={() => onUnidadeChange(null)}
            >
              Trocar próprio
            </button>
          </p>
        )}

        {unidade ? (
          <>
            <Field label="Descrição do chamado" hint="Descreva o problema ou serviço necessário (mín. 10 caracteres).">
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
              <Select
                value={prioridade}
                onChange={(event) => setPrioridade(event.target.value as (typeof PRIORIDADES)[number])}
                disabled={busy}
              >
                {PRIORIDADES.map((item) => (
                  <option key={item} value={item}>
                    {item.charAt(0) + item.slice(1).toLowerCase()}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Solicitante (opcional)">
              <Input
                value={solicitanteNome}
                onChange={(event) => setSolicitanteNome(event.target.value)}
                placeholder="Nome de quem reportou"
                disabled={busy}
              />
            </Field>
          </>
        ) : null}

        {error ? <p className="text-[13px] text-[var(--danger)]">{error}</p> : null}

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button type="button" variant="text" onClick={handleClose} disabled={busy}>
            Cancelar
          </Button>
          {unidade ? (
            <Button type="submit" variant="filled" disabled={busy}>
              {busy ? 'Registrando...' : 'Abrir chamado'}
            </Button>
          ) : null}
        </div>
      </form>
    </Sheet>
  );
}
