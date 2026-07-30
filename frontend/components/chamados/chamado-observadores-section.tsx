'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useSnackbar } from '@/components/ui/snackbar';
import {
  addMeuChamadoObservador,
  listUsuariosObservador,
  removeMeuChamadoObservador,
  updateChamadoObservadores,
} from '@/lib/api';
import { ChamadoObservador, ChamadoResumo } from '@/lib/types';

type UsuarioOpcao = {
  id: string;
  nome: string;
  email: string;
  cargo?: string | null;
  secretaria?: { id: string; nome: string; sigla: string } | null;
};

export function ChamadoObservadoresSection({
  chamado,
  canManage,
  mode = 'meus',
  onChanged,
}: {
  chamado: ChamadoResumo;
  canManage: boolean;
  mode?: 'meus' | 'chamados';
  onChanged: () => void;
}) {
  const snackbar = useSnackbar();
  const [usuarios, setUsuarios] = useState<UsuarioOpcao[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [busy, setBusy] = useState(false);
  const observadores = chamado.observadores ?? [];

  useEffect(() => {
    if (!canManage) return;
    void listUsuariosObservador()
      .then(setUsuarios)
      .catch(() => setUsuarios([]));
  }, [canManage]);

  const options = useMemo(() => {
    const taken = new Set([
      ...observadores.map((item) => item.usuarioId),
      ...(chamado.registradoPor?.id ? [chamado.registradoPor.id] : []),
    ]);
    return usuarios
      .filter((usuario) => !taken.has(usuario.id))
      .map((usuario) => ({
        value: usuario.id,
        label: `${usuario.nome}${usuario.secretaria?.sigla ? ` · ${usuario.secretaria.sigla}` : ''}`,
      }));
  }, [usuarios, observadores, chamado.registradoPor?.id]);

  async function handleAdd() {
    if (!selectedId) return;
    setBusy(true);
    try {
      if (mode === 'meus') {
        await addMeuChamadoObservador(chamado.id, selectedId);
      } else {
        const next = [...observadores.map((item) => item.usuarioId), selectedId];
        await updateChamadoObservadores(chamado.id, next);
      }
      setSelectedId('');
      onChanged();
      snackbar.show('Observador adicionado.', 'success');
    } catch (err) {
      snackbar.show(err instanceof Error ? err.message : 'Falha ao adicionar observador.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(observador: ChamadoObservador) {
    setBusy(true);
    try {
      if (mode === 'meus') {
        await removeMeuChamadoObservador(chamado.id, observador.usuarioId);
      } else {
        const next = observadores
          .map((item) => item.usuarioId)
          .filter((id) => id !== observador.usuarioId);
        await updateChamadoObservadores(chamado.id, next);
      }
      onChanged();
      snackbar.show('Observador removido.', 'success');
    } catch (err) {
      snackbar.show(err instanceof Error ? err.message : 'Falha ao remover observador.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-bold tracking-wide text-[var(--ink-2)] uppercase">Observadores</p>
        <Badge variant="muted">{observadores.length}</Badge>
      </div>

      {observadores.length === 0 ? (
        <p className="text-[13px] text-[var(--ink-3)]">Nenhum observador neste chamado.</p>
      ) : (
        <ul className="space-y-1.5">
          {observadores.map((observador) => (
            <li
              key={observador.id}
              className="flex items-center justify-between gap-2 rounded-[var(--r-sm)] bg-[var(--muted-bg)] px-2.5 py-1.5"
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-[var(--ink)]">{observador.nome}</p>
                {observador.email ? (
                  <p className="truncate text-[11px] text-[var(--ink-3)]">{observador.email}</p>
                ) : null}
              </div>
              {canManage ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleRemove(observador)}
                  className="rounded p-1 text-[var(--ink-3)] hover:bg-[var(--danger-bg)] hover:text-[var(--danger)]"
                  aria-label={`Remover ${observador.nome}`}
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <SearchableSelect
              value={selectedId}
              options={options}
              onChange={setSelectedId}
              placeholder="Buscar usuário…"
              disabled={busy}
              emptyLabel="Nenhum usuário disponível"
            />
          </div>
          <Button type="button" size="sm" disabled={busy || !selectedId} onClick={() => void handleAdd()}>
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        </div>
      ) : null}
    </div>
  );
}
