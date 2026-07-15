'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { listUsuariosAtivosExecucao } from '@/lib/api';
import type { UsuarioExecucaoOpcao } from '@/lib/types';
import { cn } from '@/lib/cn';

function cargoLabel(usuario: UsuarioExecucaoOpcao) {
  return usuario.cargoRef?.nome ?? usuario.cargo ?? null;
}

function optionLabel(usuario: UsuarioExecucaoOpcao) {
  const parts = [usuario.nome];
  const cargo = cargoLabel(usuario);
  if (cargo) parts.push(cargo);
  if (usuario.secretaria?.sigla) parts.push(usuario.secretaria.sigla);
  return parts.join(' · ');
}

export function MembroExternoPicker({
  selectedIds,
  excludeIds = [],
  disabled,
  onChange,
}: {
  selectedIds: string[];
  /** IDs que não devem ser escolhíveis (ex.: membros da equipe principal). */
  excludeIds?: string[];
  disabled?: boolean;
  onChange: (ids: string[], selectedUsers: UsuarioExecucaoOpcao[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<UsuarioExecucaoOpcao[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UsuarioExecucaoOpcao[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const excludeSet = useMemo(() => new Set(excludeIds), [excludeIds]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener('mousedown', onPointerDown);
    return () => window.removeEventListener('mousedown', onPointerDown);
  }, []);

  useEffect(() => {
    let active = true;
    const handle = window.setTimeout(() => {
      setLoading(true);
      listUsuariosAtivosExecucao(query)
        .then((rows) => {
          if (!active) return;
          setOptions(rows.filter((usuario) => !excludeSet.has(usuario.id)));
        })
        .catch(() => {
          if (active) setOptions([]);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 220);

    return () => {
      active = false;
      window.clearTimeout(handle);
    };
  }, [query, excludeSet]);

  useEffect(() => {
    setSelectedUsers((current) => current.filter((usuario) => selectedIds.includes(usuario.id)));
  }, [selectedIds]);

  function toggle(usuario: UsuarioExecucaoOpcao) {
    if (disabled || excludeSet.has(usuario.id)) return;
    const already = selectedIds.includes(usuario.id);
    const nextIds = already ? selectedIds.filter((id) => id !== usuario.id) : [...selectedIds, usuario.id];
    const nextUsers = already
      ? selectedUsers.filter((item) => item.id !== usuario.id)
      : [...selectedUsers.filter((item) => item.id !== usuario.id), usuario];
    setSelectedUsers(nextUsers);
    onChange(nextIds, nextUsers);
  }

  function remove(id: string) {
    if (disabled) return;
    const nextIds = selectedIds.filter((item) => item !== id);
    const nextUsers = selectedUsers.filter((item) => item.id !== id);
    setSelectedUsers(nextUsers);
    onChange(nextIds, nextUsers);
  }

  return (
    <div ref={rootRef} className="space-y-2">
      <p className="text-[12px] font-semibold text-[var(--ink-2)]">Membro externo à equipe (opcional)</p>
      <p className="text-[11px] text-[var(--ink-3)]">
        Selecione usuários ativos cadastrados. Quem ainda não estiver no sistema deve ser cadastrado/ativado antes.
      </p>

      {selectedUsers.length > 0 || selectedIds.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {(selectedUsers.length > 0
            ? selectedUsers
            : selectedIds.map((id) => ({ id, nome: id, email: '', cpf: null, cargo: null }))
          ).map((usuario) => (
            <li
              key={usuario.id}
              className="inline-flex max-w-full items-center gap-1 rounded-[var(--r-pill)] border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--ink-2)]"
            >
              <span className="truncate">{optionLabel(usuario as UsuarioExecucaoOpcao)}</span>
              <button
                type="button"
                className="shrink-0 text-[var(--danger)] disabled:opacity-40"
                aria-label={`Remover ${usuario.nome}`}
                disabled={disabled}
                onClick={() => remove(usuario.id)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--ink-3)]" />
        <input
          value={query}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          placeholder="Buscar por nome, e-mail ou CPF"
          className="h-9 w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] pr-3 pl-9 text-[13px] focus:border-[var(--brand)] focus:outline-none focus:shadow-[0_0_0_3px_var(--brand-soft)]"
        />

        {open ? (
          <div className="absolute inset-x-0 z-30 mt-1 max-h-56 overflow-y-auto overscroll-contain rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--sh-md)]">
            {loading ? <p className="px-3 py-2 text-[12px] text-[var(--ink-3)]">Buscando usuários...</p> : null}
            {!loading && options.length === 0 ? (
              <p className="px-3 py-2 text-[12px] text-[var(--ink-3)]">Nenhum usuário ativo encontrado.</p>
            ) : null}
            {options.map((usuario) => {
              const checked = selectedIds.includes(usuario.id);
              return (
                <button
                  key={usuario.id}
                  type="button"
                  onClick={() => toggle(usuario)}
                  className={cn(
                    'flex w-full items-start gap-2 px-3 py-2 text-left text-[12.5px] hover:bg-[var(--surface-2)]',
                    checked && 'bg-[var(--brand-soft)]',
                  )}
                >
                  <input type="checkbox" readOnly checked={checked} className="mt-0.5" tabIndex={-1} />
                  <span className="min-w-0">
                    <span className="block font-semibold text-[var(--ink)]">{usuario.nome}</span>
                    <span className="block truncate text-[11px] text-[var(--ink-3)]">
                      {[cargoLabel(usuario), usuario.secretaria?.sigla, usuario.email].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
