'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Search, Wrench } from 'lucide-react';
import { createChamado, createOrdemServico, getStoredAuth, getUnidades } from '@/lib/api';
import { UnidadeOperacional } from '@/lib/types';
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
  showChamado = true,
  showOs = true,
}: {
  unidadeId?: string;
  unidadeNome?: string;
  onSuccess?: () => void;
  size?: 'sm' | 'md';
  className?: string;
  showChamado?: boolean;
  showOs?: boolean;
}) {
  const canManage = getStoredAuth()?.user.permissoes.includes('chamados.gerenciar') ?? false;
  const [sheet, setSheet] = useState<SolicitacaoTipo | null>(null);
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

  function openTipo(tipo: SolicitacaoTipo) {
    if (resolvedUnidade) {
      setSheet(tipo);
      return;
    }
    setSheet(tipo);
  }

  return (
    <>
      <div className={cn('flex flex-wrap gap-2', className)}>
        {showChamado ? (
          <Button variant="outlined" size={size} className="gap-1.5" onClick={() => openTipo('chamado')}>
            <Bell className="h-4 w-4" />
            Abrir chamado
          </Button>
        ) : null}
        {showOs ? (
          <Button variant="outlined" size={size} className="gap-1.5" onClick={() => openTipo('os')}>
            <Wrench className="h-4 w-4" />
            Abrir OS avulsa
          </Button>
        ) : null}
      </div>

      <AvulsoSolicitacaoSheet
        open={sheet === 'chamado'}
        tipo="chamado"
        unidade={resolvedUnidade}
        onUnidadeChange={setPickedUnidade}
        onClose={() => setSheet(null)}
        onSuccess={onSuccess}
      />
      <AvulsoSolicitacaoSheet
        open={sheet === 'os'}
        tipo="os"
        unidade={resolvedUnidade}
        onUnidadeChange={setPickedUnidade}
        onClose={() => setSheet(null)}
        onSuccess={onSuccess}
      />
    </>
  );
}

function AvulsoSolicitacaoSheet({
  open,
  tipo,
  unidade,
  onUnidadeChange,
  onClose,
  onSuccess,
}: {
  open: boolean;
  tipo: SolicitacaoTipo;
  unidade: { id: string; nome: string } | null;
  onUnidadeChange: (unidade: { id: string; nome: string } | null) => void;
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
    setTitulo('');
    setPrioridade('MEDIA');
    setPrazoEm('');
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
      if (tipo === 'chamado') {
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
        return;
      }

      const ordem = await createOrdemServico({
        unidadeId: unidade.id,
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
        {!unidade ? (
          <div className="space-y-3">
            <p className="text-[13px] text-[var(--ink-3)]">Escolha o próprio público para registrar a solicitação avulsa.</p>
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
            Registro manual para <strong className="text-[var(--ink)]">{unidade.nome}</strong>, sem vínculo com
            fiscalização ou não conformidade.{' '}
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
          </>
        ) : null}

        {error ? <p className="text-[13px] text-[var(--danger)]">{error}</p> : null}

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button type="button" variant="text" onClick={handleClose} disabled={busy}>
            Cancelar
          </Button>
          {unidade ? (
            <Button type="submit" variant="filled" disabled={busy}>
              {busy ? 'Registrando...' : tipo === 'chamado' ? 'Abrir chamado' : 'Abrir OS'}
            </Button>
          ) : null}
        </div>
      </form>
    </Sheet>
  );
}
