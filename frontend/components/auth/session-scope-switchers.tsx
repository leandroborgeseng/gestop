'use client';

import { useState } from 'react';
import { switchPerfilAtivo, switchSecretariaAtiva } from '@/lib/api';
import type { AuthUser } from '@/lib/types';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/cn';

async function afterSessionSwitch() {
  window.location.assign('/cco');
}

export function SessionScopeSwitchers({
  user,
  dense = false,
  className,
}: {
  user: AuthUser;
  dense?: boolean;
  className?: string;
}) {
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const perfisDisponiveis = user.perfisDisponiveis ?? [];
  const secretariasDisponiveis = user.secretariasDisponiveis ?? [];
  const acessoTodas = Boolean(user.acessoTodasSecretarias);
  const showPerfilSelect = perfisDisponiveis.length > 1;
  const showSecretariaSelect = secretariasDisponiveis.length > 1 || acessoTodas;

  const perfilLabel = user.perfilAtivo?.nome ?? user.perfis[0] ?? 'Usuário';
  const secretariaLabel =
    user.secretariaAtiva?.sigla ?? user.secretaria?.sigla ?? null;

  const perfilValue = user.perfilAtivo?.id ?? '';
  const secretariaValue = user.secretariaEscopoTodas
    ? ''
    : (user.secretariaAtiva?.id ?? '');

  async function onPerfilChange(perfilId: string) {
    if (!perfilId || perfilId === perfilValue || switching) return;
    setError(null);
    setSwitching(true);
    try {
      await switchPerfilAtivo(perfilId);
      await afterSessionSwitch();
    } catch (err) {
      setSwitching(false);
      setError(err instanceof Error ? err.message : 'Falha ao trocar perfil.');
    }
  }

  async function onSecretariaChange(raw: string) {
    const nextId = raw === '' ? null : raw;
    const currentId = secretariaValue === '' ? null : secretariaValue;
    if (nextId === currentId || switching) return;
    setError(null);
    setSwitching(true);
    try {
      await switchSecretariaAtiva(nextId);
      await afterSessionSwitch();
    } catch (err) {
      setSwitching(false);
      setError(err instanceof Error ? err.message : 'Falha ao trocar secretaria.');
    }
  }

  const labelClass = dense
    ? 'mb-1 block text-[10.5px] font-semibold tracking-[0.04em] uppercase text-[var(--ink-4)]'
    : 'mb-1 block text-[11px] font-medium text-[var(--ink-3)]';
  const selectClass = dense ? 'h-8 text-xs' : 'h-9 text-[12.5px]';

  return (
    <div className={cn('space-y-2', className)}>
      {showPerfilSelect ? (
        <label className="block">
          <span className={labelClass}>Perfil ativo</span>
          <Select
            value={perfilValue}
            disabled={switching}
            className={selectClass}
            aria-label="Perfil ativo"
            onChange={(event) => void onPerfilChange(event.target.value)}
          >
            {perfisDisponiveis.map((perfil) => (
              <option key={perfil.id} value={perfil.id}>
                {perfil.nome}
              </option>
            ))}
          </Select>
        </label>
      ) : (
        <p className="truncate text-[11px] text-[var(--ink-3)]">{perfilLabel}</p>
      )}

      {showSecretariaSelect ? (
        <label className="block">
          <span className={labelClass}>Secretaria</span>
          <Select
            value={secretariaValue}
            disabled={switching}
            className={selectClass}
            aria-label="Secretaria ativa"
            onChange={(event) => void onSecretariaChange(event.target.value)}
          >
            {acessoTodas ? <option value="">Todas as Secretarias</option> : null}
            {secretariasDisponiveis.map((secretaria) => (
              <option key={secretaria.id} value={secretaria.id}>
                {secretaria.sigla} — {secretaria.nome}
              </option>
            ))}
          </Select>
        </label>
      ) : secretariaLabel ? (
        <p className="truncate text-[11px] text-[var(--ink-3)]">{secretariaLabel}</p>
      ) : null}

      {error ? <p className="text-[11px] text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
