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

function sortPreferSecretaria(rows: UsuarioExecucaoOpcao[], preferSecretariaId?: string) {
  if (!preferSecretariaId) return rows;
  return [...rows].sort((a, b) => {
    const aMatch = a.secretaria?.id === preferSecretariaId ? 0 : 1;
    const bMatch = b.secretaria?.id === preferSecretariaId ? 0 : 1;
    if (aMatch !== bMatch) return aMatch - bMatch;
    return a.nome.localeCompare(b.nome, 'pt-BR');
  });
}

export function UsuarioMultiPicker({
  label = 'Responsável(is)',
  hint,
  selectedIds,
  initialUsers = [],
  preferSecretariaId,
  disabled,
  onChange,
}: {
  label?: string;
  hint?: string;
  selectedIds: string[];
  initialUsers?: UsuarioExecucaoOpcao[];
  preferSecretariaId?: string;
  disabled?: boolean;
  onChange: (ids: string[], selectedUsers: UsuarioExecucaoOpcao[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<UsuarioExecucaoOpcao[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UsuarioExecucaoOpcao[]>(initialUsers);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
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
          setOptions(sortPreferSecretaria(rows, preferSecretariaId));
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
  }, [query, preferSecretariaId]);

  useEffect(() => {
    setSelectedUsers((current) => {
      const kept = current.filter((usuario) => selectedIds.includes(usuario.id));
      const missing = initialUsers.filter(
        (usuario) => selectedIds.includes(usuario.id) && !kept.some((item) => item.id === usuario.id),
      );
      return [...kept, ...missing];
    });
  }, [selectedIds, initialUsers]);

  function toggle(usuario: UsuarioExecucaoOpcao) {
    if (disabled) return;
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
      <p className="text-[12px] font-semibold text-[var(--ink-2)]">{label}</p>
      {hint ? <p className="text-[11px] text-[var(--ink-3)]">{hint}</p> : null}

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
          placeholder="Buscar por nome ou e-mail"
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

export function UsuarioSinglePicker({
  label = 'Usuário',
  hint,
  value,
  selectedUser,
  preferSecretariaId,
  disabled,
  onChange,
}: {
  label?: string;
  hint?: string;
  value: string;
  selectedUser?: UsuarioExecucaoOpcao | null;
  preferSecretariaId?: string;
  disabled?: boolean;
  onChange: (id: string, user: UsuarioExecucaoOpcao | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<UsuarioExecucaoOpcao[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
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
          setOptions(sortPreferSecretaria(rows, preferSecretariaId));
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
  }, [query, preferSecretariaId]);

  return (
    <div ref={rootRef} className="space-y-2">
      <p className="text-[12px] font-semibold text-[var(--ink-2)]">{label}</p>
      {hint ? <p className="text-[11px] text-[var(--ink-3)]">{hint}</p> : null}

      {value && selectedUser ? (
        <div className="inline-flex max-w-full items-center gap-1 rounded-[var(--r-pill)] border border-[var(--brand)] bg-[var(--brand-soft)] px-2 py-1 text-[11px] text-[var(--brand-hover)]">
          <span className="truncate">{optionLabel(selectedUser)}</span>
          <button
            type="button"
            className="shrink-0 text-[var(--danger)] disabled:opacity-40"
            aria-label="Limpar seleção"
            disabled={disabled}
            onClick={() => onChange('', null)}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
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
          placeholder="Buscar por nome ou e-mail"
          className="h-9 w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] pr-3 pl-9 text-[13px] focus:border-[var(--brand)] focus:outline-none focus:shadow-[0_0_0_3px_var(--brand-soft)]"
        />
        {open ? (
          <div className="absolute inset-x-0 z-30 mt-1 max-h-56 overflow-y-auto overscroll-contain rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--sh-md)]">
            {loading ? <p className="px-3 py-2 text-[12px] text-[var(--ink-3)]">Buscando usuários...</p> : null}
            {!loading && options.length === 0 ? (
              <p className="px-3 py-2 text-[12px] text-[var(--ink-3)]">Nenhum usuário ativo encontrado.</p>
            ) : null}
            {options.map((usuario) => (
              <button
                key={usuario.id}
                type="button"
                onClick={() => {
                  onChange(usuario.id, usuario);
                  setOpen(false);
                  setQuery('');
                }}
                className={cn(
                  'flex w-full items-start gap-2 px-3 py-2 text-left text-[12.5px] hover:bg-[var(--surface-2)]',
                  value === usuario.id && 'bg-[var(--brand-soft)]',
                )}
              >
                <span className="min-w-0">
                  <span className="block font-semibold text-[var(--ink)]">{usuario.nome}</span>
                  <span className="block truncate text-[11px] text-[var(--ink-3)]">
                    {[cargoLabel(usuario), usuario.secretaria?.sigla, usuario.email].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
