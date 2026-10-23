'use client';

/**
 * 307 — combobox multi-seleção de responsáveis do cronograma (esboço UX 307).
 * Lista NO FLUXO do modal (empurra o conteúdo; nunca cobre o rodapé), altura máx. ~6 itens com rolagem,
 * fecha com clique fora, Esc (só a lista) ou clique no campo; marcar não fecha a lista.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Search, X } from 'lucide-react';
import { listResponsaveisCronograma } from '@/lib/api';
import {
  agruparResponsaveis,
  avisoRegularizacao,
  DICA_FORA_ESCOPO,
  pendentesRegularizacao,
  ROTULO_SITUACAO,
  siglasDe,
} from '@/lib/cronograma-responsaveis';
import type { ResponsavelCronogramaOpcao, SituacaoResponsavel } from '@/lib/types';
import { cn } from '@/lib/cn';

const CHIPS_VISIVEIS = 6;

export function ResponsaveisCombobox({
  label = 'Responsável(is)',
  hint,
  selectedIds,
  selectedUsers,
  situacoes,
  escopoTodas,
  escopoVersao,
  disabled,
  onChange,
}: {
  label?: string;
  hint?: string;
  selectedIds: string[];
  selectedUsers: ResponsavelCronogramaOpcao[];
  situacoes: Record<string, SituacaoResponsavel | undefined>;
  escopoTodas: boolean;
  /** Muda a cada troca de Secretaria ativa: recarrega as opções. */
  escopoVersao: number;
  disabled?: boolean;
  onChange: (ids: string[], users: ResponsavelCronogramaOpcao[]) => void;
}) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(false);
  const [options, setOptions] = useState<ResponsavelCronogramaOpcao[]>([]);
  const [ativo, setAtivo] = useState(0);
  const [tentativa, setTentativa] = useState(0);
  const [mostrarTodosChips, setMostrarTodosChips] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener('mousedown', onPointerDown);
    return () => window.removeEventListener('mousedown', onPointerDown);
  }, []);

  useEffect(() => {
    let vivo = true;
    setLoading(true);
    setErro(false);
    const handle = window.setTimeout(() => {
      listResponsaveisCronograma(query)
        .then((rows) => {
          if (vivo) setOptions(rows);
        })
        .catch(() => {
          if (vivo) {
            setOptions([]);
            setErro(true);
          }
        })
        .finally(() => {
          if (vivo) setLoading(false);
        });
    }, 220);
    return () => {
      vivo = false;
      window.clearTimeout(handle);
    };
  }, [query, escopoVersao, tentativa]);

  const grupos = useMemo(() => agruparResponsaveis(options, escopoTodas), [options, escopoTodas]);
  const planos = useMemo(() => grupos.flatMap((g) => g.usuarios), [grupos]);
  useEffect(() => setAtivo(0), [options]);

  const chips = useMemo(() => {
    const porId = new Map(selectedUsers.map((u) => [u.id, u]));
    return selectedIds.map((id) => porId.get(id) ?? ({ id, nome: id, email: '', cpf: null, cargo: null } as ResponsavelCronogramaOpcao));
  }, [selectedIds, selectedUsers]);
  const pendentes = pendentesRegularizacao(selectedIds, situacoes);
  const chipsVisiveis = mostrarTodosChips ? chips : chips.slice(0, CHIPS_VISIVEIS);

  const toggle = useCallback(
    (usuario: ResponsavelCronogramaOpcao) => {
      if (disabled) return;
      const ja = selectedIds.includes(usuario.id);
      const ids = ja ? selectedIds.filter((id) => id !== usuario.id) : [...selectedIds, usuario.id];
      const users = ja
        ? selectedUsers.filter((u) => u.id !== usuario.id)
        : [...selectedUsers.filter((u) => u.id !== usuario.id), usuario];
      onChange(ids, users);
    },
    [disabled, selectedIds, selectedUsers, onChange],
  );

  function remove(id: string) {
    if (disabled) return;
    onChange(
      selectedIds.filter((item) => item !== id),
      selectedUsers.filter((u) => u.id !== id),
    );
    inputRef.current?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      if (open) {
        // Esc fecha só a lista; o modal continua aberto e o foco fica no campo.
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      }
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      if (!planos.length) return;
      setAtivo((i) => (event.key === 'ArrowDown' ? (i + 1) % planos.length : (i - 1 + planos.length) % planos.length));
      return;
    }
    if ((event.key === 'Enter' || (event.key === ' ' && open && !query)) && open && planos[ativo]) {
      event.preventDefault();
      toggle(planos[ativo]);
    } else if (event.key === 'Enter') {
      event.preventDefault(); // Enter no campo não envia o formulário
    }
  }

  const ativoId = planos[ativo] ? `${listId}-opt-${planos[ativo].id}` : undefined;

  return (
    <div ref={rootRef} className="space-y-2" data-testid="responsaveis-combobox">
      <p className="text-[12px] font-semibold text-[var(--ink-2)]" id={`${listId}-label`}>
        {label}
      </p>
      {hint ? <p className="text-[11px] text-[var(--ink-3)]">{hint}</p> : null}

      {pendentes.length ? (
        <p role="status" className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--warning,#b45309)]" data-testid="aviso-regularizar">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          {avisoRegularizacao(pendentes.length)}
        </p>
      ) : null}

      <div
        className={cn(
          'flex min-h-9 flex-wrap items-center gap-1.5 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-2 py-1 focus-within:border-[var(--brand)] focus-within:shadow-[0_0_0_3px_var(--brand-soft)]',
          disabled && 'opacity-60',
        )}
        onMouseDown={(event) => {
          // Clique no campo (fora dos chips) alterna a lista.
          if ((event.target as HTMLElement).closest('button')) return;
          event.preventDefault();
          inputRef.current?.focus();
          if (!disabled) setOpen((v) => !v);
        }}
      >
        {chipsVisiveis.map((usuario) => {
          const sit = situacoes[usuario.id];
          const fora = sit && sit !== 'OK';
          return (
            <span
              key={usuario.id}
              data-testid="chip-responsavel"
              data-situacao={sit ?? 'OK'}
              title={fora ? DICA_FORA_ESCOPO : undefined}
              className={cn(
                'inline-flex max-w-full items-center gap-1 rounded-[var(--r-pill)] border px-2 py-0.5 text-[11px]',
                fora
                  ? 'border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink-3)]'
                  : 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-hover)]',
              )}
            >
              {fora ? <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden /> : null}
              <span className="truncate">{usuario.nome}</span>
              {fora ? <span className="font-semibold">· {ROTULO_SITUACAO[sit as 'INATIVO' | 'OUTRA_SECRETARIA']}</span> : null}
              <button
                type="button"
                className="shrink-0 rounded text-[var(--danger)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)] disabled:opacity-40"
                aria-label={`Remover ${usuario.nome}`}
                disabled={disabled}
                onClick={() => remove(usuario.id)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          );
        })}
        {chips.length > CHIPS_VISIVEIS ? (
          <button
            type="button"
            className="text-[11px] font-semibold text-[var(--brand)]"
            onClick={() => setMostrarTodosChips((v) => !v)}
          >
            {mostrarTodosChips ? 'Mostrar menos' : `+${chips.length - CHIPS_VISIVEIS}`}
          </button>
        ) : null}
        {chips.length > 0 ? (
          <span className="sr-only" aria-live="polite">{`${chips.length} selecionados`}</span>
        ) : null}
        {/* Ajuste 1: sem espaço ao lado dos chips, a busca quebra para a linha inteira (placeholder nunca cortado). */}
        <span className="relative flex min-w-[15rem] flex-1 basis-[15rem] items-center">
          <Search className="pointer-events-none absolute left-1 h-4 w-4 text-[var(--ink-3)]" aria-hidden />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded={open}
            aria-controls={`${listId}-lista`}
            aria-labelledby={`${listId}-label`}
            aria-activedescendant={open ? ativoId : undefined}
            aria-autocomplete="list"
            value={query}
            disabled={disabled}
            onKeyDown={onKeyDown}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            placeholder="Buscar por nome ou e-mail"
            className="h-7 w-full bg-transparent pl-6 text-[13px] focus:outline-none"
          />
        </span>
      </div>
      {chips.length > 0 ? (
        <p className="text-[11px] text-[var(--ink-3)]" data-testid="contador-selecionados">
          {chips.length === 1 ? '1 selecionado' : `${chips.length} selecionados`}
        </p>
      ) : null}

      {open ? (
        // No fluxo (sem position:absolute): empurra o conteúdo; ~6 itens (288 px) com rolagem interna.
        <div
          id={`${listId}-lista`}
          role="listbox"
          aria-multiselectable="true"
          aria-labelledby={`${listId}-label`}
          data-testid="lista-responsaveis"
          className="max-h-[288px] overflow-y-auto overscroll-contain rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] max-md:max-h-[50dvh]"
        >
          {loading ? (
            <div aria-label="Carregando usuários" className="space-y-2 p-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-4 animate-pulse rounded bg-[var(--surface-2)]" />
              ))}
            </div>
          ) : erro ? (
            <p className="px-3 py-2 text-[12px] text-[var(--danger)]">
              Não foi possível carregar os usuários.{' '}
              <button type="button" className="font-semibold underline" onClick={() => setTentativa((t) => t + 1)}>
                Tentar de novo
              </button>
            </p>
          ) : planos.length === 0 ? (
            <p className="px-3 py-2 text-[12px] text-[var(--ink-3)]">Nenhum usuário encontrado nesta Secretaria</p>
          ) : (
            grupos.map((grupo) => (
              <div key={grupo.chave} role="group" aria-label={grupo.titulo ?? undefined}>
                {grupo.titulo ? (
                  <p className="sticky top-0 bg-[var(--surface-2)] px-3 py-1 text-[11px] font-semibold text-[var(--ink-2)]">
                    {grupo.titulo}
                  </p>
                ) : null}
                {grupo.usuarios.map((usuario) => {
                  const checked = selectedIds.includes(usuario.id);
                  const idx = planos.indexOf(usuario);
                  return (
                    <div
                      key={usuario.id}
                      id={`${listId}-opt-${usuario.id}`}
                      role="option"
                      aria-selected={checked}
                      data-testid="opcao-responsavel"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => toggle(usuario)}
                      onMouseEnter={() => setAtivo(idx)}
                      className={cn(
                        'flex h-12 cursor-pointer items-start gap-2 px-3 py-1.5 text-left text-[12.5px] hover:bg-[var(--surface-2)]',
                        checked && 'bg-[var(--brand-soft)]',
                        idx === ativo && 'outline outline-2 -outline-offset-2 outline-[var(--brand)]',
                      )}
                    >
                      <input type="checkbox" readOnly checked={checked} className="mt-0.5" tabIndex={-1} aria-hidden />
                      <span className="min-w-0">
                        <span className="block font-semibold text-[var(--ink)]">{usuario.nome}</span>
                        <span className="block truncate text-[11px] text-[var(--ink-3)]">
                          {[usuario.cargoRef?.nome ?? usuario.cargo, escopoTodas ? siglasDe(usuario) : null, usuario.email]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
