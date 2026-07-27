'use client';

import { FormEvent, Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Power, Save } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Field } from '@/components/ui/field';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { LoadingState } from '@/components/ui-states';
import {
  createAdminPerfil,
  getAdminPerfilMatriz,
  getAdminUsuarioMatriz,
  listAdminPerfisConfiguraveis,
  listAdminUsuarios,
  saveAdminPerfilMatriz,
  saveAdminUsuarioMatriz,
  setAdminPerfilAtivo,
  updateAdminPerfil,
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
import { AdminUsuario } from '@/lib/types';

type ConfigurablePerfil = {
  id: string;
  nome: string;
  descricao?: string | null;
  sistema: boolean;
  ativo: boolean;
  usuariosVinculados?: number;
};

type MatrizMode = 'perfil' | 'usuario';

export function PermissoesMatrizPanel({
  mutate,
}: {
  mutate: (action: () => Promise<unknown>, message: string) => Promise<boolean>;
}) {
  const [mode, setMode] = useState<MatrizMode>('perfil');
  const [perfis, setPerfis] = useState<ConfigurablePerfil[]>([]);
  const [usuarios, setUsuarios] = useState<AdminUsuario[]>([]);
  const [selectedPerfilId, setSelectedPerfilId] = useState('');
  const [selectedUsuarioId, setSelectedUsuarioId] = useState('');
  const [perfisVinculados, setPerfisVinculados] = useState<Array<{ id: string; nome: string }>>([]);
  const [catalogo, setCatalogo] = useState<PermissionCatalogScreen[]>([]);
  const [chaves, setChaves] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMatriz, setLoadingMatriz] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editDescricao, setEditDescricao] = useState('');
  const [savingPerfilMeta, setSavingPerfilMeta] = useState(false);
  const initialKeysRef = useRef<Set<string>>(new Set());

  const loadPerfis = useCallback(async (preferId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const items = await listAdminPerfisConfiguraveis();
      setPerfis(items);
      const nextId =
        (preferId && items.some((item) => item.id === preferId) ? preferId : null) ||
        (selectedPerfilId && items.some((item) => item.id === selectedPerfilId) ? selectedPerfilId : null) ||
        items[0]?.id ||
        '';
      setSelectedPerfilId(nextId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar perfis.');
    } finally {
      setLoading(false);
    }
  }, [selectedPerfilId]);

  const loadUsuarios = useCallback(async () => {
    setError(null);
    try {
      const items = await listAdminUsuarios();
      setUsuarios(items);
      if (!selectedUsuarioId && items.length > 0) {
        setSelectedUsuarioId(items[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar usuários.');
    }
  }, [selectedUsuarioId]);

  useEffect(() => {
    void loadPerfis();
  }, [loadPerfis]);

  useEffect(() => {
    if (mode === 'usuario') {
      void loadUsuarios();
    }
  }, [mode, loadUsuarios]);

  useEffect(() => {
    if (mode !== 'perfil' || !selectedPerfilId) return;
    setLoadingMatriz(true);
    setError(null);
    void getAdminPerfilMatriz(selectedPerfilId)
      .then((data) => {
        setCatalogo(data.catalogo);
        const next = new Set(data.chaves);
        setChaves(next);
        initialKeysRef.current = new Set(data.chaves);
        setDirty(false);
        setPerfisVinculados([]);
        setEditNome(data.perfil.nome);
        setEditDescricao(data.perfil.descricao ?? '');
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
  }, [mode, selectedPerfilId]);

  useEffect(() => {
    if (mode !== 'usuario' || !selectedUsuarioId) return;
    setLoadingMatriz(true);
    setError(null);
    void getAdminUsuarioMatriz(selectedUsuarioId)
      .then((data) => {
        setCatalogo(data.catalogo);
        const next = new Set(data.chaves);
        setChaves(next);
        initialKeysRef.current = new Set(data.chaves);
        setDirty(false);
        setPerfisVinculados(data.perfisVinculados);
        const expandedDefaults: Record<string, boolean> = {};
        for (const tela of data.catalogo) {
          expandedDefaults[tela.id] = false;
        }
        setExpanded(expandedDefaults);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Falha ao carregar permissões do usuário.');
      })
      .finally(() => setLoadingMatriz(false));
  }, [mode, selectedUsuarioId]);

  const selectedPerfil = perfis.find((item) => item.id === selectedPerfilId);
  const selectedUsuario = usuarios.find((item) => item.id === selectedUsuarioId);
  const hasSelection = mode === 'perfil' ? Boolean(selectedPerfilId) : Boolean(selectedUsuarioId);
  const perfilMetaDirty =
    Boolean(selectedPerfil) &&
    (editNome.trim() !== selectedPerfil!.nome || editDescricao.trim() !== (selectedPerfil!.descricao ?? ''));

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

  function switchMode(next: MatrizMode) {
    if (next === mode) return;
    setMode(next);
    setDirty(false);
    setError(null);
    setCatalogo([]);
    setChaves(new Set());
    setPerfisVinculados([]);
  }

  async function handleSave() {
    if (!hasSelection || saving) return;
    setSaving(true);
    setError(null);
    try {
      const ok =
        mode === 'perfil'
          ? await mutate(
              () => saveAdminPerfilMatriz(selectedPerfilId, [...chaves]),
              'Permissões do perfil salvas.',
            )
          : await mutate(
              () => saveAdminUsuarioMatriz(selectedUsuarioId, [...chaves]),
              'Permissões individuais do usuário salvas.',
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
      const items = await listAdminPerfisConfiguraveis();
      setPerfis(items);
      const created = items.find((item) => item.nome === nome);
      setMode('perfil');
      if (created) setSelectedPerfilId(created.id);
    }
  }

  async function handleSavePerfilMeta() {
    if (!selectedPerfilId || !perfilMetaDirty || savingPerfilMeta) return;
    setSavingPerfilMeta(true);
    setError(null);
    try {
      const ok = await mutate(
        () =>
          updateAdminPerfil(selectedPerfilId, {
            nome: editNome.trim(),
            descricao: editDescricao.trim() || null,
          }),
        'Dados do perfil atualizados.',
      );
      if (ok) {
        await loadPerfis(selectedPerfilId);
      }
    } finally {
      setSavingPerfilMeta(false);
    }
  }

  async function handleToggleAtivo() {
    if (!selectedPerfil) return;
    const nextAtivo = !selectedPerfil.ativo;
    const vinculados = selectedPerfil.usuariosVinculados ?? 0;

    if (!nextAtivo && vinculados > 0) {
      const confirmed = window.confirm(
        `Este perfil possui ${vinculados} usuário(s) vinculado(s).\n\n` +
          'A inativação não apaga histórico, permissões nem vínculos — apenas impede novos usos do perfil.\n\n' +
          'Deseja inativar mesmo assim?',
      );
      if (!confirmed) return;
    }

    const ok = await mutate(
      () => setAdminPerfilAtivo(selectedPerfil.id, nextAtivo),
      nextAtivo ? 'Perfil reativado.' : 'Perfil inativado.',
    );
    if (ok) {
      await loadPerfis(selectedPerfil.id);
    }
  }

  if (loading) return <LoadingState label="Carregando perfis..." />;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(300px,380px)_1fr]">
        <div className="space-y-6">
          <FormSection title="Gestão de perfis">
            <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
              {perfis.length === 0 ? (
                <p className="text-[13px] text-[var(--ink-3)]">Nenhum perfil configurável ainda.</p>
              ) : (
                perfis.map((perfil) => {
                  const active = perfil.id === selectedPerfilId && mode === 'perfil';
                  return (
                    <button
                      key={perfil.id}
                      type="button"
                      onClick={() => {
                        setMode('perfil');
                        setSelectedPerfilId(perfil.id);
                      }}
                      className={`w-full rounded-[var(--r-md)] border px-3 py-2.5 text-left transition-colors ${
                        active
                          ? 'border-[var(--brand)] bg-[var(--brand-soft)]'
                          : 'border-[var(--line)] hover:bg-[var(--surface-2)]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-[var(--ink)]">{perfil.nome}</p>
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-[var(--ink-3)]">
                            {perfil.descricao || 'Sem descrição'}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-[var(--r-pill)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            perfil.ativo
                              ? 'bg-[var(--ok-soft,rgba(16,185,129,0.12))] text-[var(--ok,#059669)]'
                              : 'bg-[var(--surface-2)] text-[var(--ink-3)]'
                          }`}
                        >
                          {perfil.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11px] text-[var(--ink-3)]">
                        {perfil.usuariosVinculados ?? 0} usuário(s) vinculado(s)
                        {perfil.sistema ? ' · sistema' : ''}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </FormSection>

          <FormSection title="Novo perfil">
            <form onSubmit={(event) => void handleCreatePerfil(event)} className="space-y-4">
              <Field label="Nome do perfil">
                <Input name="nomePerfil" required placeholder="Ex.: Solicitação" />
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
              Novos perfis nascem sem permissões. Selecione o perfil e marque as funções desejadas.
            </p>
          </FormSection>
        </div>

        <FormSection title={mode === 'perfil' ? 'Permissões por perfil' : 'Permissões individuais por usuário'}>
          <div className="mb-4 flex flex-wrap gap-1.5">
            <Chip active={mode === 'perfil'} onClick={() => switchMode('perfil')}>
              Perfil
            </Chip>
            <Chip active={mode === 'usuario'} onClick={() => switchMode('usuario')}>
              Usuário
            </Chip>
          </div>

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            {mode === 'perfil' ? (
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
                      {!perfil.ativo ? ' — inativo' : ''}
                      {perfil.sistema ? ' (sistema)' : ''}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <Field label="Usuário" className="flex-1">
                <Select
                  value={selectedUsuarioId}
                  onChange={(event) => setSelectedUsuarioId(event.target.value)}
                  disabled={usuarios.length === 0}
                >
                  {usuarios.length === 0 ? <option value="">Nenhum usuário encontrado</option> : null}
                  {usuarios.map((usuario) => (
                    <option key={usuario.id} value={usuario.id}>
                      {usuario.nome} ({usuario.email})
                      {!usuario.ativo ? ' — inativo' : ''}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Button
              type="button"
              variant="filled"
              disabled={!hasSelection || saving || !dirty || loadingMatriz}
              onClick={() => void handleSave()}
            >
              <Save className="h-4 w-4" />
              {saving ? 'Salvando…' : 'Salvar permissões'}
            </Button>
          </div>

          {mode === 'perfil' && selectedPerfil ? (
            <div className="mb-4 space-y-3 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nome">
                  <Input value={editNome} onChange={(event) => setEditNome(event.target.value)} disabled={savingPerfilMeta} />
                </Field>
                <Field label="Descrição">
                  <Input
                    value={editDescricao}
                    onChange={(event) => setEditDescricao(event.target.value)}
                    disabled={savingPerfilMeta}
                  />
                </Field>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outlined"
                  size="sm"
                  disabled={!perfilMetaDirty || savingPerfilMeta}
                  onClick={() => void handleSavePerfilMeta()}
                >
                  <Save className="h-4 w-4" />
                  Salvar dados
                </Button>
                <Button type="button" variant="outlined" size="sm" onClick={() => void handleToggleAtivo()}>
                  <Power className="h-4 w-4" />
                  {selectedPerfil.ativo ? 'Inativar perfil' : 'Reativar perfil'}
                </Button>
                <p className="text-[12px] text-[var(--ink-3)]">
                  {selectedPerfil.usuariosVinculados ?? 0} usuário(s) · inativação preserva vínculos e permissões
                </p>
              </div>
            </div>
          ) : null}

          {mode === 'usuario' && selectedUsuario ? (
            <div className="mb-4 space-y-1 text-[13px] text-[var(--ink-3)]">
              <p>Permissões individuais adicionais ao(s) perfil(is) do usuário.</p>
              <p>
                Perfis vinculados:{' '}
                <strong className="text-[var(--ink-2)]">
                  {perfisVinculados.length > 0
                    ? perfisVinculados.map((item) => item.nome).join(', ')
                    : 'nenhum'}
                </strong>
              </p>
            </div>
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
