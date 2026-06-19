'use client';

import { FormEvent, Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Save } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { LoadingState } from '@/components/ui-states';
import {
  createAdminPerfil,
  getAdminPerfilMatriz,
  listAdminPerfisConfiguraveis,
  saveAdminPerfilMatriz,
} from '@/lib/api';
import {
  PERMISSION_ACTIONS,
  PERMISSION_ACTION_LABELS,
  PermissionAction,
  PermissionCatalogScreen,
  buildMatrixKey,
  getScreenFunctionRows,
  screenActionState,
  setScreenAction,
  setFunctionAction,
} from '@/lib/permissions-matrix';

type ConfigurablePerfil = {
  id: string;
  nome: string;
  descricao?: string | null;
  sistema: boolean;
  ativo: boolean;
};

export function PermissoesMatrizPanel({
  mutate,
}: {
  mutate: (action: () => Promise<unknown>, message: string) => Promise<boolean>;
}) {
  const [perfis, setPerfis] = useState<ConfigurablePerfil[]>([]);
  const [selectedPerfilId, setSelectedPerfilId] = useState('');
  const [catalogo, setCatalogo] = useState<PermissionCatalogScreen[]>([]);
  const [chaves, setChaves] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMatriz, setLoadingMatriz] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialKeysRef = useRef<Set<string>>(new Set());

  const loadPerfis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await listAdminPerfisConfiguraveis();
      setPerfis(items);
      if (!selectedPerfilId && items.length > 0) {
        setSelectedPerfilId(items[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar perfis.');
    } finally {
      setLoading(false);
    }
  }, [selectedPerfilId]);

  useEffect(() => {
    void loadPerfis();
  }, [loadPerfis]);

  useEffect(() => {
    if (!selectedPerfilId) return;
    setLoadingMatriz(true);
    setError(null);
    void getAdminPerfilMatriz(selectedPerfilId)
      .then((data) => {
        setCatalogo(data.catalogo);
        const next = new Set(data.chaves);
        setChaves(next);
        initialKeysRef.current = new Set(data.chaves);
        setDirty(false);
        const expandedDefaults: Record<string, boolean> = {};
        for (const tela of data.catalogo) {
          expandedDefaults[tela.id] = false;
        }
        setExpanded(expandedDefaults);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Falha ao carregar permissões do perfil.');
      })
      .finally(() => setLoadingMatriz(false));
  }, [selectedPerfilId]);

  const selectedPerfil = perfis.find((item) => item.id === selectedPerfilId);

  const screenRows = useMemo(
    () =>
      catalogo.map((tela) => ({
        tela,
        functions: getScreenFunctionRows(tela),
      })),
    [catalogo],
  );

  function updateKeys(updater: (current: Set<string>) => Set<string>) {
    setChaves((current) => {
      const next = updater(new Set(current));
      setDirty(true);
      return next;
    });
  }

  function toggleScreen(telaId: string) {
    setExpanded((current) => ({ ...current, [telaId]: !current[telaId] }));
  }

  function handleScreenCheckbox(telaId: string, acao: PermissionAction, checked: boolean) {
    const tela = catalogo.find((item) => item.id === telaId);
    if (!tela) return;
    updateKeys((current) => setScreenAction(current, tela, acao, checked));
  }

  function handleFunctionCheckbox(telaId: string, funcaoId: string, acao: PermissionAction, checked: boolean) {
    const tela = catalogo.find((item) => item.id === telaId);
    const funcao = tela?.functions.find((item) => item.id === funcaoId);
    if (!tela || !funcao) return;
    updateKeys((current) => setFunctionAction(current, telaId, funcao, acao, checked));
  }

  async function handleSave() {
    if (!selectedPerfilId || saving) return;
    setSaving(true);
    setError(null);
    try {
      const ok = await mutate(
        () => saveAdminPerfilMatriz(selectedPerfilId, [...chaves]),
        'Permissões do perfil salvas.',
      );
      if (ok) {
        initialKeysRef.current = new Set(chaves);
        setDirty(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleCreatePerfil(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nome = String(form.get('nomePerfil') || '').trim();
    const descricao = String(form.get('descricaoPerfil') || '').trim();
    if (!nome) return;

    const ok = await mutate(
      () => createAdminPerfil({ nome, descricao: descricao || undefined, ativo: true }),
      'Perfil criado. Configure as permissões abaixo.',
    );
    if (ok) {
      event.currentTarget.reset();
      await loadPerfis();
    }
  }

  if (loading) return <LoadingState label="Carregando perfis..." />;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(280px,360px)_1fr]">
        <FormSection title="Novo perfil">
          <form onSubmit={handleCreatePerfil} className="space-y-4">
            <Field label="Nome do perfil">
              <Input name="nomePerfil" required placeholder="Ex.: Coordenador de Zeladoria" />
            </Field>
            <Field label="Descrição">
              <Input name="descricaoPerfil" placeholder="Opcional" />
            </Field>
            <Button type="submit" variant="outlined" className="w-full">
              <Plus className="h-4 w-4" />
              Criar perfil
            </Button>
          </form>
          <p className="mt-3 text-[12px] text-[var(--ink-3)]">
            Novos perfis nascem sem permissões. Selecione o perfil ao lado e marque as funções desejadas.
          </p>
        </FormSection>

        <FormSection title="Permissões por perfil">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <Field label="Perfil" className="flex-1">
              <Select
                value={selectedPerfilId}
                onChange={(event) => setSelectedPerfilId(event.target.value)}
                disabled={perfis.length === 0}
              >
                {perfis.length === 0 ? <option value="">Nenhum perfil configurável</option> : null}
                {perfis.map((perfil) => (
                  <option key={perfil.id} value={perfil.id}>
                    {perfil.nome}
                    {perfil.sistema ? ' (sistema)' : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Button
              type="button"
              variant="filled"
              disabled={!selectedPerfilId || saving || !dirty || loadingMatriz}
              onClick={() => void handleSave()}
            >
              <Save className="h-4 w-4" />
              {saving ? 'Salvando…' : 'Salvar permissões'}
            </Button>
          </div>

          {selectedPerfil ? (
            <p className="mb-4 text-[13px] text-[var(--ink-3)]">
              {selectedPerfil.descricao || 'Configure telas e funções para este perfil.'}
            </p>
          ) : null}

          {error ? <Alert variant="error" className="mb-4">{error}</Alert> : null}
          {loadingMatriz ? <LoadingState label="Carregando matriz de permissões..." /> : null}

          {!loadingMatriz && catalogo.length > 0 ? (
            <div className="overflow-x-auto rounded-[var(--r-md)] border border-[var(--line)]">
              <table className="min-w-[720px] w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--line)] bg-[var(--surface-2)]">
                    <th className="px-3 py-2 text-left font-semibold text-[var(--ink-3)]">Tela / Função</th>
                    {PERMISSION_ACTIONS.map((acao) => (
                      <th key={acao} className="px-2 py-2 text-center font-semibold text-[var(--ink-3)]">
                        {PERMISSION_ACTION_LABELS[acao]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {screenRows.map(({ tela, functions }) => {
                    const isOpen = expanded[tela.id] ?? false;
                    const screenRow = functions.find((item) => item.id === '_tela') ?? functions[0];
                    return (
                      <Fragment key={tela.id}>
                        <tr key={`${tela.id}-screen`} className="border-b border-[var(--line-2)] bg-[var(--surface)]">
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              className="flex items-center gap-2 font-semibold text-[var(--ink)]"
                              onClick={() => toggleScreen(tela.id)}
                            >
                              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              {tela.label}
                            </button>
                          </td>
                          {PERMISSION_ACTIONS.map((acao) => {
                            if (!screenRow.actions.includes(acao)) {
                              return <td key={acao} className="px-2 py-2 text-center text-[var(--ink-3)]">—</td>;
                            }
                            const state = screenActionState(chaves, tela, acao);
                            return (
                              <td key={acao} className="px-2 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={state === 'all'}
                                  ref={(node) => {
                                    if (node) node.indeterminate = state === 'partial';
                                  }}
                                  onChange={(event) => handleScreenCheckbox(tela.id, acao, event.target.checked)}
                                  aria-label={`${tela.label} · ${PERMISSION_ACTION_LABELS[acao]}`}
                                />
                              </td>
                            );
                          })}
                        </tr>
                        {isOpen
                          ? functions
                              .filter((funcao) => funcao.id !== '_tela')
                              .map((funcao) => (
                                <tr key={`${tela.id}-${funcao.id}`} className="border-b border-[var(--line-2)]">
                                  <td className="px-3 py-2 pl-10 text-[var(--ink-2)]">{funcao.label}</td>
                                  {PERMISSION_ACTIONS.map((acao) => {
                                    if (!funcao.actions.includes(acao)) {
                                      return (
                                        <td key={acao} className="px-2 py-2 text-center text-[var(--ink-3)]">
                                          —
                                        </td>
                                      );
                                    }
                                    const key = buildMatrixKey(tela.id, funcao.id, acao);
                                    return (
                                      <td key={acao} className="px-2 py-2 text-center">
                                        <input
                                          type="checkbox"
                                          checked={chaves.has(key)}
                                          onChange={(event) =>
                                            handleFunctionCheckbox(tela.id, funcao.id, acao, event.target.checked)
                                          }
                                          aria-label={`${funcao.label} · ${PERMISSION_ACTION_LABELS[acao]}`}
                                        />
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))
                          : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </FormSection>
      </div>
    </div>
  );
}
