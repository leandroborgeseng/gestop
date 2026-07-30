'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Building2, Briefcase, ClipboardList, DatabaseBackup, Download, Layers3, MapPin, Shield, Tags, UserRound, UsersRound } from 'lucide-react';
import { RequirePermissions } from '@/components/auth/require-permissions';
import { ImportacaoPanel } from '@/components/admin/importacao-panel';
import { BackupPanel } from '@/components/admin/backup-panel';
import { PageShell } from '@/components/layout/page-shell';
import { TipBanner } from '@/components/help/tip-banner';
import { useSafeBackHref } from '@/lib/use-safe-back-href';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { FormSection } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { MaskedInput } from '@/components/ui/masked-input';
import { Select } from '@/components/ui/select';
import { Sheet } from '@/components/ui/sheet';
import { Tabs } from '@/components/ui/tabs';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableFilterCell,
  DataTableFilterRow,
  DataTableFiltersBar,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  DataTableSelectFilter,
  DataTableTextFilter,
} from '@/components/ui/data-table';
import { useSnackbar } from '@/components/ui/snackbar';
import { ErrorState, LoadingState } from '@/components/ui-states';
import {
  deleteAdminSecretaria,
  deleteAdminUnidade,
  listAdminEquipes,
  listAdminPerfis,
  listAdminSecretarias,
  listAdminTiposChamado,
  listAdminUnidades,
  listAdminUsuarios,
  saveAdminEquipe,
  saveAdminSecretaria,
  saveAdminTipoChamado,
  saveAdminUnidade,
  saveAdminUsuario,
  deleteAdminTipoChamado,
  deleteAdminTipoProprio,
  deleteAdminCategoriaVistoria,
  listAdminCategoriasVistoria,
  listAdminTiposProprio,
  saveAdminCategoriaVistoria,
  saveAdminTipoProprio,
  listAdminCargos,
  saveAdminCargo,
  anonymizeUsuarioLgpd,
  purgeAuditoriaLgpd,
} from '@/lib/api';
import {
  AdminCategoriaVistoria,
  AdminCargo,
  AdminEquipe,
  AdminPerfil,
  AdminSecretaria,
  AdminTipoChamado,
  AdminTipoProprio,
  AdminUnidade,
  AdminUsuario,
} from '@/lib/types';
import {
  formatCpfInput,
  formatPhoneInput,
  isValidCpf,
  isValidEmail,
  normalizeCpfForApi,
  normalizePhoneForApi,
} from '@/lib/br-input-masks';
import { REGIAO_UNIDADE_LABELS, RegiaoUnidade } from '@/lib/regiao-unidade';
import { PermissoesMatrizPanel } from '@/components/admin/permissoes-matriz-panel';
import { formatUnidadeTipo } from '@/lib/unidade-tipo';
import { formatUnidadeOrigem, getLockedFields, getUnidadeMetadata, isQgisImported } from '@/lib/unidade-metadata';
import {
  PASSWORD_MIN_LENGTH_NEW,
  PASSWORD_POLICY_HINT,
  validatePasswordPolicy,
} from '@/lib/password-policy';

type Tab =
  | 'secretarias'
  | 'unidades'
  | 'usuarios'
  | 'equipes'
  | 'cargos'
  | 'tipos-chamado'
  | 'tipos-proprio'
  | 'categorias-vistoria'
  | 'permissoes'
  | 'backup'
  | 'importacao';

const regioes: RegiaoUnidade[] = ['NORTE', 'SUL', 'LESTE', 'OESTE', 'CENTRO'];

export default function AdminPage() {
  const backHref = useSafeBackHref('/cco');
  const snackbar = useSnackbar();
  const [tab, setTab] = useState<Tab>('secretarias');
  const [secretarias, setSecretarias] = useState<AdminSecretaria[]>([]);
  const [unidades, setUnidades] = useState<AdminUnidade[]>([]);
  const [usuarios, setUsuarios] = useState<AdminUsuario[]>([]);
  const [equipes, setEquipes] = useState<AdminEquipe[]>([]);
  const [tiposChamado, setTiposChamado] = useState<AdminTipoChamado[]>([]);
  const [tiposProprio, setTiposProprio] = useState<AdminTipoProprio[]>([]);
  const [categoriasVistoria, setCategoriasVistoria] = useState<AdminCategoriaVistoria[]>([]);
  const [cargos, setCargos] = useState<AdminCargo[]>([]);
  const [perfis, setPerfis] = useState<AdminPerfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [
        nextSecretarias,
        nextUnidades,
        nextUsuarios,
        nextEquipes,
        nextPerfis,
        nextTiposChamado,
        nextTiposProprio,
        nextCategorias,
        nextCargos,
      ] = await Promise.all([
        listAdminSecretarias(),
        listAdminUnidades(),
        listAdminUsuarios(),
        listAdminEquipes(),
        listAdminPerfis(),
        listAdminTiposChamado(),
        listAdminTiposProprio(),
        listAdminCategoriasVistoria(),
        listAdminCargos(),
      ]);
      setSecretarias(nextSecretarias);
      setUnidades(nextUnidades);
      setUsuarios(nextUsuarios);
      setEquipes(nextEquipes);
      setPerfis(nextPerfis);
      setTiposChamado(nextTiposChamado);
      setTiposProprio(nextTiposProprio);
      setCategoriasVistoria(nextCategorias);
      setCargos(nextCargos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar administração.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function mutate(action: () => Promise<unknown>, message: string) {
    setError(null);
    setSuccess(null);
    try {
      await action();
      setSuccess(message);
      snackbar.show(message, 'success');
      await load();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Operação não concluída.';
      setError(msg);
      snackbar.show(msg, 'error');
      return false;
    }
  }

  return (
    <RequirePermissions permissions={['usuarios.gerenciar']}>
      <PageShell
        kicker="Administração"
        icon={Building2}
        title="Cadastros e acesso"
        description="Gestão de secretarias, próprios e usuários — com controles de LGPD."
        backHref={backHref}
      >
        <TipBanner id="admin-cadastros">
          Alterações em secretarias, próprios e usuários são registradas na trilha de auditoria. Use a aba Importação para sincronizar o webmap QGIS.
        </TipBanner>

        {error ? <div className="mb-4"><ErrorState message={error} onRetry={() => void load()} /></div> : null}
        {success ? <Alert variant="success" className="mb-4">{success}</Alert> : null}

        <div className="mb-6 rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] px-4 shadow-[var(--sh-sm)]">
          <Tabs
            value={tab}
            onChange={(value) => setTab(value as Tab)}
            items={[
              { id: 'secretarias', label: 'Secretarias', icon: <Building2 className="h-4 w-4" />, count: secretarias.length },
              { id: 'unidades', label: 'Próprios', icon: <MapPin className="h-4 w-4" />, count: unidades.length },
              { id: 'usuarios', label: 'Usuários', icon: <UserRound className="h-4 w-4" />, count: usuarios.length },
              { id: 'equipes', label: 'Equipes', icon: <UsersRound className="h-4 w-4" />, count: equipes.length },
              { id: 'cargos', label: 'Cargos', icon: <Briefcase className="h-4 w-4" />, count: cargos.length },
              { id: 'tipos-chamado', label: 'Tipos de chamado', icon: <ClipboardList className="h-4 w-4" />, count: tiposChamado.length },
              { id: 'tipos-proprio', label: 'Tipos de próprio', icon: <Tags className="h-4 w-4" />, count: tiposProprio.length },
              { id: 'categorias-vistoria', label: 'Categorias vistoria', icon: <Layers3 className="h-4 w-4" />, count: categoriasVistoria.length },
              { id: 'permissoes', label: 'Permissões', icon: <Shield className="h-4 w-4" /> },
              { id: 'backup', label: 'Backup S3', icon: <DatabaseBackup className="h-4 w-4" /> },
              { id: 'importacao', label: 'Importação', icon: <Download className="h-4 w-4" /> },
            ]}
          />
        </div>

        {loading && tab !== 'backup' ? <LoadingState label="Carregando cadastros..." /> : null}

        {!loading && tab === 'secretarias' ? (
          <SecretariasPanel secretarias={secretarias} mutate={mutate} />
        ) : null}
        {!loading && tab === 'unidades' ? (
          <UnidadesPanel secretarias={secretarias} unidades={unidades} tiposProprio={tiposProprio} mutate={mutate} />
        ) : null}
        {!loading && tab === 'usuarios' ? (
          <UsuariosPanel secretarias={secretarias} usuarios={usuarios} equipes={equipes} perfis={perfis} cargos={cargos} mutate={mutate} />
        ) : null}
        {!loading && tab === 'equipes' ? (
          <EquipesPanel secretarias={secretarias} usuarios={usuarios} equipes={equipes} mutate={mutate} />
        ) : null}
        {!loading && tab === 'cargos' ? (
          <CargosPanel cargos={cargos} mutate={mutate} />
        ) : null}
        {!loading && tab === 'tipos-chamado' ? (
          <TiposChamadoPanel tipos={tiposChamado} mutate={mutate} />
        ) : null}
        {!loading && tab === 'tipos-proprio' ? (
          <TiposProprioPanel tipos={tiposProprio} mutate={mutate} />
        ) : null}
        {!loading && tab === 'categorias-vistoria' ? (
          <CategoriasVistoriaPanel categorias={categoriasVistoria} mutate={mutate} />
        ) : null}
        {!loading && tab === 'permissoes' ? (
          <PermissoesMatrizPanel mutate={mutate} />
        ) : null}
        {tab === 'backup' ? <BackupPanel /> : null}
        {!loading && tab === 'importacao' ? (
          <ImportacaoPanel onSynced={() => void load()} />
        ) : null}

        {!loading && tab !== 'importacao' && tab !== 'backup' ? (
          <section className="mt-8 rounded-[var(--r-card)] border border-[var(--warn-bd)] bg-[var(--warn-bg)] p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--warn)] shadow-[var(--sh-sm)]">
                <Shield className="h-4 w-4" />
              </span>
              <div className="flex-1">
                <h3 className="text-[14px] font-bold text-[var(--ink)]">Proteção de dados (LGPD)</h3>
                <p className="mt-1 text-[13px] text-[var(--ink-3)]">Ações sensíveis — registradas na auditoria.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="outlined"
                    size="sm"
                    onClick={() =>
                      void mutate(async () => purgeAuditoriaLgpd(), 'Retenção de auditoria aplicada.')
                    }
                  >
                    Expurgar auditoria antiga
                  </Button>
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </PageShell>
    </RequirePermissions>
  );
}

function matchesText(value: string | null | undefined, filter: string) {
  if (!filter.trim()) return true;
  return String(value ?? '').toLowerCase().includes(filter.trim().toLowerCase());
}

function matchesStatus(ativo: boolean, filter: string) {
  if (!filter) return true;
  if (filter === 'ativo') return ativo;
  if (filter === 'inativo') return !ativo;
  return true;
}

const STATUS_FILTER_OPTIONS = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'inativo', label: 'Inativo' },
];

function SecretariasPanel({ secretarias, mutate }: { secretarias: AdminSecretaria[]; mutate: (action: () => Promise<unknown>, message: string) => Promise<boolean> }) {
  const [editing, setEditing] = useState<AdminSecretaria | null>(null);
  const [filterSigla, setFilterSigla] = useState('');
  const [filterNome, setFilterNome] = useState('');
  const [filterResponsavel, setFilterResponsavel] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const filtersActive = Boolean(filterSigla || filterNome || filterResponsavel || filterStatus);

  const filtered = useMemo(
    () =>
      secretarias.filter(
        (secretaria) =>
          matchesText(secretaria.sigla, filterSigla) &&
          matchesText(secretaria.nome, filterNome) &&
          matchesText(secretaria.responsavelNome, filterResponsavel) &&
          matchesStatus(secretaria.ativo, filterStatus),
      ),
    [secretarias, filterSigla, filterNome, filterResponsavel, filterStatus],
  );

  function clearFilters() {
    setFilterSigla('');
    setFilterNome('');
    setFilterResponsavel('');
    setFilterStatus('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const isEdit = Boolean(editing);
    const ok = await mutate(
      () =>
        saveAdminSecretaria(
          {
            nome: String(form.get('nome')),
            sigla: String(form.get('sigla')),
            descricao: String(form.get('descricao') || ''),
            responsavelNome: String(form.get('responsavelNome') || ''),
            responsavelEmail: String(form.get('responsavelEmail') || ''),
            ativo: editing?.ativo ?? true,
          },
          editing?.id,
        ),
      isEdit ? 'Secretaria atualizada.' : 'Secretaria cadastrada.',
    );
    if (ok) {
      setEditing(null);
      event.currentTarget.reset();
    }
  }

  return (
    <div className="space-y-6">
      <FormSection title={editing ? 'Editar secretaria' : 'Nova secretaria'}>
        <form key={editing?.id ?? 'new-secretaria'} onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Nome"><Input name="nome" required defaultValue={editing?.nome} /></Field>
            <Field label="Sigla"><Input name="sigla" required defaultValue={editing?.sigla} /></Field>
            <Field label="Descrição"><Input name="descricao" defaultValue={editing?.descricao ?? ''} /></Field>
            <Field label="Responsável"><Input name="responsavelNome" defaultValue={editing?.responsavelNome ?? ''} /></Field>
            <Field label="E-mail do responsável"><Input name="responsavelEmail" type="email" defaultValue={editing?.responsavelEmail ?? ''} /></Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="filled">{editing ? 'Salvar alterações' : 'Cadastrar secretaria'}</Button>
            {editing ? (
              <Button type="button" variant="text" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
            ) : null}
          </div>
        </form>
      </FormSection>

      <div>
        <DataTableFiltersBar
          active={filtersActive}
          onClear={clearFilters}
          resultCount={filtered.length}
          totalCount={secretarias.length}
        />
        <DataTable>
          <DataTableHead>
            <tr>
              <DataTableHeaderCell>Sigla</DataTableHeaderCell>
              <DataTableHeaderCell>Secretaria</DataTableHeaderCell>
              <DataTableHeaderCell>Responsável</DataTableHeaderCell>
              <DataTableHeaderCell>Status</DataTableHeaderCell>
              <DataTableHeaderCell>Ações</DataTableHeaderCell>
            </tr>
            <DataTableFilterRow>
              <DataTableFilterCell>
                <DataTableTextFilter value={filterSigla} onChange={setFilterSigla} placeholder="Sigla" aria-label="Filtrar sigla" />
              </DataTableFilterCell>
              <DataTableFilterCell>
                <DataTableTextFilter value={filterNome} onChange={setFilterNome} placeholder="Nome" aria-label="Filtrar secretaria" />
              </DataTableFilterCell>
              <DataTableFilterCell>
                <DataTableTextFilter value={filterResponsavel} onChange={setFilterResponsavel} placeholder="Responsável" aria-label="Filtrar responsável" />
              </DataTableFilterCell>
              <DataTableFilterCell>
                <DataTableSelectFilter value={filterStatus} onChange={setFilterStatus} options={STATUS_FILTER_OPTIONS} aria-label="Filtrar status" />
              </DataTableFilterCell>
              <DataTableFilterCell />
            </DataTableFilterRow>
          </DataTableHead>
          <DataTableBody>
            {filtered.length === 0 ? (
              <DataTableRow>
                <DataTableCell colSpan={5} className="py-6 text-center text-[var(--ink-3)]">
                  {secretarias.length === 0 ? 'Nenhuma secretaria cadastrada.' : 'Nenhum registro corresponde aos filtros.'}
                </DataTableCell>
              </DataTableRow>
            ) : (
              filtered.map((secretaria) => (
                <DataTableRow key={secretaria.id}>
                  <DataTableCell mono>{secretaria.sigla}</DataTableCell>
                  <DataTableCell>{secretaria.nome}</DataTableCell>
                  <DataTableCell>{secretaria.responsavelNome ?? '—'}</DataTableCell>
                  <DataTableCell>
                    <Badge variant={secretaria.ativo ? 'success' : 'muted'}>{secretaria.ativo ? 'Ativo' : 'Inativo'}</Badge>
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex flex-wrap gap-1">
                      <Button variant="text" size="sm" onClick={() => setEditing(secretaria)}>
                        Editar
                      </Button>
                      {secretaria.ativo ? (
                        <Button variant="text" size="sm" className="text-red-700" onClick={() => void mutate(() => deleteAdminSecretaria(secretaria.id), 'Secretaria inativada.')}>
                          Inativar
                        </Button>
                      ) : null}
                    </div>
                  </DataTableCell>
                </DataTableRow>
              ))
            )}
          </DataTableBody>
        </DataTable>
      </div>
    </div>
  );
}

function UnidadesPanel({
  secretarias,
  unidades,
  tiposProprio,
  mutate,
}: {
  secretarias: AdminSecretaria[];
  unidades: AdminUnidade[];
  tiposProprio: AdminTipoProprio[];
  mutate: (action: () => Promise<unknown>, message: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState<AdminUnidade | null>(null);
  const [filterCodigo, setFilterCodigo] = useState('');
  const [filterNome, setFilterNome] = useState('');
  const [filterOrigem, setFilterOrigem] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterSecretaria, setFilterSecretaria] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const filtersActive = Boolean(filterCodigo || filterNome || filterOrigem || filterTipo || filterSecretaria || filterStatus);

  const secretariaOptions = useMemo(
    () =>
      [...new Map(unidades.map((u) => [u.secretaria.sigla, u.secretaria.sigla])).entries()].map(([, sigla]) => ({
        value: sigla,
        label: sigla,
      })),
    [unidades],
  );

  const tiposAtivos = useMemo(() => tiposProprio.filter((tipo) => tipo.ativo), [tiposProprio]);
  const tiposParaSelect = useMemo(() => {
    if (!editing) return tiposAtivos;
    if (tiposAtivos.some((tipo) => tipo.codigo === editing.tipo)) return tiposAtivos;
    const atual = tiposProprio.find((tipo) => tipo.codigo === editing.tipo);
    return atual ? [atual, ...tiposAtivos] : tiposAtivos;
  }, [editing, tiposAtivos, tiposProprio]);

  const tipoOptions = useMemo(
    () =>
      [...new Set(unidades.map((u) => u.tipo))]
        .sort()
        .map((tipo) => ({
          value: tipo,
          label: formatUnidadeTipo(tipo, tiposProprio.map((item) => ({ codigo: item.codigo, nome: item.nome }))),
        })),
    [unidades, tiposProprio],
  );

  const origemOptions = useMemo(() => {
    const values = new Set(unidades.map((u) => formatUnidadeOrigem(u)));
    return [...values].sort().map((label) => ({ value: label, label }));
  }, [unidades]);

  const filteredUnidades = useMemo(
    () =>
      unidades.filter((unidade) => {
        const origem = formatUnidadeOrigem(unidade);
        return (
          matchesText(unidade.codigoPatrimonial, filterCodigo) &&
          matchesText(unidade.nome, filterNome) &&
          (!filterOrigem || origem === filterOrigem) &&
          (!filterTipo || unidade.tipo === filterTipo) &&
          (!filterSecretaria || unidade.secretaria.sigla === filterSecretaria) &&
          matchesStatus(unidade.ativo, filterStatus)
        );
      }),
    [unidades, filterCodigo, filterNome, filterOrigem, filterTipo, filterSecretaria, filterStatus],
  );

  function clearFilters() {
    setFilterCodigo('');
    setFilterNome('');
    setFilterOrigem('');
    setFilterTipo('');
    setFilterSecretaria('');
    setFilterStatus('');
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await mutate(
      () => {
        const latitude = parseCoordinate(form.get('latitude'));
        const longitude = parseCoordinate(form.get('longitude'));
        return saveAdminUnidade({
          secretariaId: String(form.get('secretariaId')),
          codigoPatrimonial: String(form.get('codigoPatrimonial')),
          nome: String(form.get('nome')),
          tipo: String(form.get('tipo')),
          endereco: String(form.get('endereco')),
          bairro: String(form.get('bairro') || ''),
          cep: String(form.get('cep') || ''),
          regiao: String(form.get('regiao') || '') || undefined,
          latitude,
          longitude,
          raioValidacaoMetros: Number(form.get('raioValidacaoMetros') || 200),
          ativo: true,
        });
      },
      'Próprio público cadastrado.',
    );
    if (ok) event.currentTarget.reset();
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;

    const form = new FormData(event.currentTarget);
    const ok = await mutate(
      () => {
        const latitude = parseCoordinate(form.get('latitude'));
        const longitude = parseCoordinate(form.get('longitude'));
        return saveAdminUnidade(
          {
            secretariaId: String(form.get('secretariaId')),
            codigoPatrimonial: String(form.get('codigoPatrimonial')),
            nome: String(form.get('nome')),
            tipo: String(form.get('tipo')),
            endereco: String(form.get('endereco')),
            bairro: String(form.get('bairro') || ''),
            cep: String(form.get('cep') || ''),
            regiao: String(form.get('regiao') || '') || undefined,
            latitude,
            longitude,
            raioValidacaoMetros: Number(form.get('raioValidacaoMetros') || 200),
            ativo: editing.ativo,
          },
          editing.id,
        );
      },
      'Próprio atualizado. Campos alterados ficam protegidos na próxima sync QGIS.',
    );
    if (ok) setEditing(null);
  }

  const editingMetadata = editing ? getUnidadeMetadata(editing) : null;
  const editingLockedFields = editing ? getLockedFields(editing) : [];

  return (
    <div className="space-y-6">
      <FormSection title="Novo próprio">
        <form onSubmit={submitCreate} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Secretaria">
              <Select name="secretariaId" required>
                {secretarias.map((s) => (
                  <option key={s.id} value={s.id}>{s.sigla} — {s.nome}</option>
                ))}
              </Select>
            </Field>
            <Field label="Código patrimonial"><Input name="codigoPatrimonial" required /></Field>
            <Field label="Nome"><Input name="nome" required /></Field>
            <Field label="Tipo">
              <Select name="tipo" required>
                {tiposAtivos.map((tipo) => (
                  <option key={tipo.codigo} value={tipo.codigo}>
                    {tipo.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Endereço"><Input name="endereco" required /></Field>
            <Field label="Bairro"><Input name="bairro" /></Field>
            <Field label="CEP"><Input name="cep" /></Field>
            <Field label="Região">
              <Select name="regiao">
                <option value="">Não informada</option>
                {regioes.map((regiao) => (
                  <option key={regiao} value={regiao}>
                    {REGIAO_UNIDADE_LABELS[regiao]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Latitude"><Input name="latitude" type="number" step="0.000001" required /></Field>
            <Field label="Longitude"><Input name="longitude" type="number" step="0.000001" required /></Field>
            <Field label="Raio (m)"><Input name="raioValidacaoMetros" type="number" defaultValue="200" /></Field>
          </div>
          <Button type="submit" variant="filled">Cadastrar próprio</Button>
        </form>
      </FormSection>

      <div>
        <DataTableFiltersBar
          active={filtersActive}
          onClear={clearFilters}
          resultCount={filteredUnidades.length}
          totalCount={unidades.length}
        />
        <DataTable>
          <DataTableHead>
            <tr>
              <DataTableHeaderCell>Código</DataTableHeaderCell>
              <DataTableHeaderCell>Unidade</DataTableHeaderCell>
              <DataTableHeaderCell>Origem</DataTableHeaderCell>
              <DataTableHeaderCell>Tipo</DataTableHeaderCell>
              <DataTableHeaderCell>Secretaria</DataTableHeaderCell>
              <DataTableHeaderCell>Status</DataTableHeaderCell>
              <DataTableHeaderCell>Ações</DataTableHeaderCell>
            </tr>
            <DataTableFilterRow>
              <DataTableFilterCell>
                <DataTableTextFilter value={filterCodigo} onChange={setFilterCodigo} placeholder="Código" aria-label="Filtrar código" />
              </DataTableFilterCell>
              <DataTableFilterCell>
                <DataTableTextFilter value={filterNome} onChange={setFilterNome} placeholder="Unidade" aria-label="Filtrar unidade" />
              </DataTableFilterCell>
              <DataTableFilterCell>
                <DataTableSelectFilter value={filterOrigem} onChange={setFilterOrigem} options={origemOptions} aria-label="Filtrar origem" />
              </DataTableFilterCell>
              <DataTableFilterCell>
                <DataTableSelectFilter value={filterTipo} onChange={setFilterTipo} options={tipoOptions} aria-label="Filtrar tipo" />
              </DataTableFilterCell>
              <DataTableFilterCell>
                <DataTableSelectFilter value={filterSecretaria} onChange={setFilterSecretaria} options={secretariaOptions} aria-label="Filtrar secretaria" />
              </DataTableFilterCell>
              <DataTableFilterCell>
                <DataTableSelectFilter value={filterStatus} onChange={setFilterStatus} options={STATUS_FILTER_OPTIONS} aria-label="Filtrar status" />
              </DataTableFilterCell>
              <DataTableFilterCell />
            </DataTableFilterRow>
          </DataTableHead>
          <DataTableBody>
            {filteredUnidades.length === 0 ? (
              <DataTableRow>
                <DataTableCell colSpan={7} className="py-6 text-center text-[var(--ink-3)]">
                  {unidades.length === 0 ? 'Nenhum próprio cadastrado.' : 'Nenhum registro corresponde aos filtros.'}
                </DataTableCell>
              </DataTableRow>
            ) : (
              filteredUnidades.map((unidade) => (
                <DataTableRow key={unidade.id}>
                  <DataTableCell mono>{unidade.codigoPatrimonial}</DataTableCell>
                  <DataTableCell>{unidade.nome}</DataTableCell>
                  <DataTableCell>
                    <Badge variant={isQgisImported(unidade) ? 'info' : 'muted'}>
                      {formatUnidadeOrigem(unidade)}
                    </Badge>
                  </DataTableCell>
                  <DataTableCell>
                    {formatUnidadeTipo(
                      unidade.tipo,
                      tiposProprio.map((item) => ({ codigo: item.codigo, nome: item.nome })),
                    )}
                  </DataTableCell>
                  <DataTableCell mono>{unidade.secretaria.sigla}</DataTableCell>
                  <DataTableCell>
                    <Badge variant={unidade.ativo ? 'success' : 'muted'}>{unidade.ativo ? 'Ativo' : 'Inativo'}</Badge>
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex flex-wrap gap-1">
                      <Button variant="text" size="sm" onClick={() => setEditing(unidade)}>
                        Editar
                      </Button>
                      {unidade.ativo ? (
                        <Button variant="text" size="sm" className="text-red-700" onClick={() => void mutate(() => deleteAdminUnidade(unidade.id), 'Próprio inativado.')}>
                          Inativar
                        </Button>
                      ) : null}
                    </div>
                  </DataTableCell>
                </DataTableRow>
              ))
            )}
          </DataTableBody>
        </DataTable>
      </div>

      <Sheet
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `Editar — ${editing.nome}` : 'Editar próprio'}
        footer={
          editing ? (
            <div className="flex gap-2">
              <Button type="submit" form="edit-unidade-form" variant="filled" className="flex-1">
                Salvar alterações
              </Button>
              <Button type="button" variant="text" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
            </div>
          ) : null
        }
      >
        {editing ? (
          <form id="edit-unidade-form" onSubmit={submitEdit} className="space-y-4">
            {isQgisImported(editing) ? (
              <Alert variant="info">
                Importado do QGIS
                {editingMetadata?.webmapSource?.layerFile ? ` · camada ${editingMetadata.webmapSource.layerFile}` : ''}
                {editingMetadata?.webmapSource?.githubCommitSha
                  ? ` · commit ${editingMetadata.webmapSource.githubCommitSha.slice(0, 7)}`
                  : ''}
                . Campos editados não serão sobrescritos na próxima sync.
              </Alert>
            ) : null}

            {editingLockedFields.length > 0 ? (
              <p className="text-xs text-[var(--ink-3)]">
                Campos protegidos: {editingLockedFields.join(', ')}
              </p>
            ) : null}

            <Field label="Secretaria">
              <Select name="secretariaId" defaultValue={editing.secretariaId} required>
                {secretarias.map((s) => (
                  <option key={s.id} value={s.id}>{s.sigla} — {s.nome}</option>
                ))}
              </Select>
            </Field>
            <Field label="Código patrimonial">
              <Input name="codigoPatrimonial" defaultValue={editing.codigoPatrimonial} required />
            </Field>
            <Field label="Nome">
              <Input name="nome" defaultValue={editing.nome} required />
            </Field>
            <Field label="Tipo">
              <Select name="tipo" defaultValue={editing.tipo} required>
                {tiposParaSelect.map((tipo) => (
                  <option key={tipo.codigo} value={tipo.codigo}>
                    {tipo.nome}{tipo.ativo ? '' : ' (inativo)'}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Endereço">
              <Input name="endereco" defaultValue={editing.endereco} required />
            </Field>
            <Field label="Bairro">
              <Input name="bairro" defaultValue={editing.bairro ?? ''} />
            </Field>
            <Field label="CEP">
              <Input name="cep" defaultValue={editing.cep ?? ''} />
            </Field>
            <Field label="Região">
              <Select name="regiao" defaultValue={editing.regiao ?? ''}>
                <option value="">Não informada</option>
                {regioes.map((regiao) => (
                  <option key={regiao} value={regiao}>
                    {REGIAO_UNIDADE_LABELS[regiao]}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Latitude">
                <Input name="latitude" type="number" step="0.000001" defaultValue={String(editing.latitude)} required />
              </Field>
              <Field label="Longitude">
                <Input name="longitude" type="number" step="0.000001" defaultValue={String(editing.longitude)} required />
              </Field>
              <Field label="Raio (m)">
                <Input name="raioValidacaoMetros" type="number" defaultValue={String(editing.raioValidacaoMetros)} />
              </Field>
            </div>
          </form>
        ) : null}
      </Sheet>
    </div>
  );
}

function usuarioPayloadFromForm(
  form: FormData,
  defaultPerfil: string,
  ativo: boolean,
  equipeIds: string[],
  editingId?: string,
  cpfValue?: string,
  telefoneValue?: string,
) {
  const senha = String(form.get('senha') || '').trim();
  const payload: Record<string, unknown> = {
    secretariaId: String(form.get('secretariaId') || ''),
    secretariaIds: form.getAll('secretariaIds').map(String).filter(Boolean),
    acessoTodasSecretarias: form.get('acessoTodasSecretarias') === 'on',
    nome: String(form.get('nome')),
    email: String(form.get('email')),
    cpf: normalizeCpfForApi(cpfValue ?? String(form.get('cpf') || '')) ?? '',
    telefone: normalizePhoneForApi(telefoneValue ?? String(form.get('telefone') || '')) ?? '',
    cargoId: String(form.get('cargoId') || ''),
    perfilIds: form.getAll('perfilIds').map(String).filter(Boolean).length
      ? form.getAll('perfilIds').map(String)
      : [String(form.get('perfilId') || defaultPerfil)].filter(Boolean),
    equipeIds,
    ativo,
  };

  if (editingId) {
    if (senha) {
      const policyError = validatePasswordPolicy(senha);
      if (policyError) throw new Error(policyError);
      payload.senha = senha;
    }
  } else {
    const policyError = validatePasswordPolicy(senha);
    if (policyError) {
      throw new Error(policyError);
    }
    payload.senha = senha;
  }

  return payload;
}

function usuarioPayloadFromRecord(usuario: AdminUsuario, ativo: boolean) {
  return {
    secretariaId: usuario.secretariaId ?? '',
    secretariaIds: usuario.secretariasVinculos?.map((item) => item.secretaria.id) ??
      (usuario.secretariaId ? [usuario.secretariaId] : []),
    acessoTodasSecretarias: Boolean(usuario.acessoTodasSecretarias),
    nome: usuario.nome,
    email: usuario.email,
    cpf: usuario.cpf ?? '',
    telefone: usuario.telefone ?? '',
    cargoId: usuario.cargoId ?? usuario.cargoRef?.id ?? '',
    perfilIds: usuario.perfis.map((item) => item.perfil.id),
    equipeIds: usuario.equipes?.map((item) => item.equipe.id) ?? [],
    ativo,
  };
}

function equipePayloadFromForm(form: FormData, usuarioIds: string[], ativo: boolean) {
  return {
    secretariaId: String(form.get('secretariaId') || ''),
    codigo: String(form.get('codigo')),
    nome: String(form.get('nome')),
    descricao: String(form.get('descricao') || ''),
    tipo: String(form.get('tipo') || 'PROPRIA'),
    emailEquipe: String(form.get('emailEquipe')),
    usuarioIds,
    ativo,
  };
}

function equipePayloadFromRecord(equipe: AdminEquipe, ativo: boolean) {
  return {
    secretariaId: equipe.secretariaId ?? '',
    codigo: equipe.codigo,
    nome: equipe.nome,
    descricao: equipe.descricao ?? '',
    tipo: equipe.tipo ?? 'PROPRIA',
    emailEquipe: equipe.emailEquipe ?? '',
    usuarioIds: equipe.membros.map((item) => item.usuario.id),
    ativo,
  };
}

function UsuariosPanel({
  secretarias,
  usuarios,
  equipes,
  perfis,
  cargos,
  mutate,
}: {
  secretarias: AdminSecretaria[];
  usuarios: AdminUsuario[];
  equipes: AdminEquipe[];
  perfis: AdminPerfil[];
  cargos: AdminCargo[];
  mutate: (action: () => Promise<unknown>, message: string) => Promise<boolean>;
}) {
  const snackbar = useSnackbar();
  const defaultPerfil = useMemo(() => perfis[0]?.id ?? '', [perfis]);
  const [editing, setEditing] = useState<AdminUsuario | null>(null);
  const [selectedEquipeIds, setSelectedEquipeIds] = useState<string[]>([]);
  const [cpfValue, setCpfValue] = useState('');
  const [telefoneValue, setTelefoneValue] = useState('');
  const [emailValue, setEmailValue] = useState('');
  const [filterUsuario, setFilterUsuario] = useState('');
  const [filterPerfil, setFilterPerfil] = useState('');
  const [filterEquipe, setFilterEquipe] = useState('');
  const [filterSecretaria, setFilterSecretaria] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const filtersActive = Boolean(filterUsuario || filterPerfil || filterEquipe || filterSecretaria || filterStatus);

  useEffect(() => {
    setSelectedEquipeIds(editing?.equipes?.map((item) => item.equipe.id) ?? []);
    setCpfValue(formatCpfInput(editing?.cpf ?? ''));
    setTelefoneValue(formatPhoneInput(editing?.telefone ?? ''));
    setEmailValue(editing?.email ?? '');
  }, [editing?.id, editing?.equipes, editing?.cpf, editing?.telefone, editing?.email]);

  const perfilOptions = useMemo(
    () => [...new Set(usuarios.flatMap((u) => u.perfis.map((p) => p.perfil.nome)))].sort().map((nome) => ({ value: nome, label: nome })),
    [usuarios],
  );
  const equipeOptions = useMemo(
    () => [...new Set(usuarios.flatMap((u) => u.equipes?.map((e) => e.equipe.nome) ?? []))].sort().map((nome) => ({ value: nome, label: nome })),
    [usuarios],
  );
  const secretariaOptions = useMemo(
    () => [...new Set(usuarios.map((u) => u.secretaria?.sigla).filter(Boolean) as string[])].sort().map((sigla) => ({ value: sigla, label: sigla })),
    [usuarios],
  );

  const filtered = useMemo(
    () =>
      usuarios.filter((usuario) => {
        return (
          (matchesText(usuario.nome, filterUsuario) || matchesText(usuario.email, filterUsuario)) &&
          (!filterPerfil || usuario.perfis.some((p) => p.perfil.nome === filterPerfil)) &&
          (!filterEquipe || Boolean(usuario.equipes?.some((e) => e.equipe.nome === filterEquipe))) &&
          (!filterSecretaria || usuario.secretaria?.sigla === filterSecretaria) &&
          matchesStatus(usuario.ativo, filterStatus)
        );
      }),
    [usuarios, filterUsuario, filterPerfil, filterEquipe, filterSecretaria, filterStatus],
  );

  function clearFilters() {
    setFilterUsuario('');
    setFilterPerfil('');
    setFilterEquipe('');
    setFilterSecretaria('');
    setFilterStatus('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = emailValue.trim();
    if (!isValidEmail(email)) {
      snackbar.show('Informe um e-mail válido.', 'warning');
      return;
    }
    const cpfDigits = normalizeCpfForApi(cpfValue);
    if (cpfDigits && !isValidCpf(cpfDigits)) {
      snackbar.show('CPF inválido.', 'warning');
      return;
    }

    const isEdit = Boolean(editing);
    const ok = await mutate(
      () => {
        const payload = usuarioPayloadFromForm(
          form,
          defaultPerfil,
          editing?.ativo ?? true,
          selectedEquipeIds,
          editing?.id,
          cpfValue,
          telefoneValue,
        );
        payload.email = email;
        return saveAdminUsuario(payload, editing?.id);
      },
      isEdit ? 'Usuário atualizado.' : 'Usuário cadastrado.',
    );
    if (ok) {
      setEditing(null);
      setSelectedEquipeIds([]);
      setCpfValue('');
      setTelefoneValue('');
      setEmailValue('');
      event.currentTarget.reset();
    }
  }

  async function toggleAtivo(usuario: AdminUsuario) {
    const nextAtivo = !usuario.ativo;
    await mutate(
      () => saveAdminUsuario(usuarioPayloadFromRecord(usuario, nextAtivo), usuario.id),
      nextAtivo ? 'Usuário reativado.' : 'Usuário inativado.',
    );
    if (editing?.id === usuario.id) {
      setEditing({ ...usuario, ativo: nextAtivo });
    }
  }

  return (
    <div className="space-y-6">
      <FormSection title={editing ? 'Editar usuário' : 'Novo usuário'}>
        <form key={editing?.id ?? 'new'} onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Nome" tooltip="Nome completo do usuário para identificação no sistema.">
              <Input name="nome" required defaultValue={editing?.nome} />
            </Field>
            <Field label="E-mail" tooltip="Use um e-mail válido. Será usado para login e notificações.">
              <Input
                name="email"
                type="email"
                required
                value={emailValue}
                onChange={(event) => setEmailValue(event.target.value)}
              />
            </Field>
            <Field label="CPF" tooltip="Digite apenas números. A máscara é aplicada automaticamente.">
              <MaskedInput name="cpf" mask="cpf" value={cpfValue} onValueChange={(_, formatted) => setCpfValue(formatted)} />
            </Field>
            <Field
              label="Telefone"
              tooltip="Digite apenas números com DDD. Aceita 8 ou 9 dígitos após o DDD (fixo ou celular)."
            >
              <MaskedInput
                name="telefone"
                mask="phone"
                value={telefoneValue}
                onValueChange={(_, formatted) => setTelefoneValue(formatted)}
              />
            </Field>
            <Field label="Cargo" tooltip="Selecione um cargo cadastrado para relatórios futuros por função.">
              <Select name="cargoId" defaultValue={editing?.cargoId ?? editing?.cargoRef?.id ?? ''}>
                <option value="">Sem cargo</option>
                {cargos
                  .filter((cargo) => cargo.ativo)
                  .map((cargo) => (
                    <option key={cargo.id} value={cargo.id}>
                      {cargo.nome}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field
              label={editing ? 'Nova senha (opcional)' : `Senha inicial (mín. ${PASSWORD_MIN_LENGTH_NEW} caracteres)`}
              tooltip={PASSWORD_POLICY_HINT}
              hint={PASSWORD_POLICY_HINT}
            >
              <Input
                name="senha"
                type="password"
                autoComplete="new-password"
                minLength={editing ? undefined : PASSWORD_MIN_LENGTH_NEW}
                required={!editing}
                placeholder={editing ? 'Deixe em branco para manter a atual' : 'Defina uma senha forte'}
              />
            </Field>
            <Field label="Secretaria principal" tooltip="Secretaria padrão inicial da sessão do usuário.">
              <Select name="secretariaId" defaultValue={editing?.secretariaId ?? ''}>
                <option value="">Sem secretaria</option>
                {secretarias.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.sigla} — {s.nome}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field
            label="Secretarias vinculadas"
            tooltip="Secretarias em que o usuário pode atuar (alternáveis na sessão)."
          >
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-[var(--r-md)] border border-[var(--line)] p-3">
              {secretarias.length === 0 ? (
                <p className="text-[12px] text-[var(--ink-3)]">Nenhuma secretaria cadastrada.</p>
              ) : (
                secretarias.map((s) => {
                  const linkedIds =
                    editing?.secretariasVinculos?.map((item) => item.secretaria.id) ??
                    (editing?.secretariaId ? [editing.secretariaId] : []);
                  return (
                    <label key={s.id} className="flex items-center gap-2 text-[13px] text-[var(--ink-2)]">
                      <input
                        type="checkbox"
                        name="secretariaIds"
                        value={s.id}
                        defaultChecked={linkedIds.includes(s.id)}
                      />
                      <span>
                        {s.sigla} — {s.nome}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </Field>
          <label className="flex items-center gap-2 text-[13px] text-[var(--ink-2)]">
            <input
              type="checkbox"
              name="acessoTodasSecretarias"
              defaultChecked={Boolean(editing?.acessoTodasSecretarias)}
            />
            <span>Permitir atuação em “Todas as Secretarias”</span>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Perfis">
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-[var(--r-md)] border border-[var(--line)] p-3">
                {perfis.filter((p) => p.ativo !== false).map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-[13px] text-[var(--ink-2)]">
                    <input
                      type="checkbox"
                      name="perfilIds"
                      value={p.id}
                      defaultChecked={editing?.perfis.some((item) => item.perfil.id === p.id) ?? p.id === defaultPerfil}
                    />
                    <span>{p.nome}</span>
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Equipes">
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-[var(--r-md)] border border-[var(--line)] p-3">
                {equipes.filter((equipe) => equipe.ativo).length === 0 ? (
                  <p className="text-[12px] text-[var(--ink-3)]">Nenhuma equipe cadastrada.</p>
                ) : (
                  equipes
                    .filter((equipe) => equipe.ativo)
                    .map((equipe) => (
                      <label key={equipe.id} className="flex items-center gap-2 text-[13px] text-[var(--ink-2)]">
                        <input
                          type="checkbox"
                          checked={selectedEquipeIds.includes(equipe.id)}
                          onChange={(event) => {
                            setSelectedEquipeIds((current) =>
                              event.target.checked
                                ? [...current, equipe.id]
                                : current.filter((id) => id !== equipe.id),
                            );
                          }}
                        />
                        <span>
                          {equipe.nome}
                          {equipe.secretaria?.sigla ? ` · ${equipe.secretaria.sigla}` : ''}
                        </span>
                      </label>
                    ))
                )}
              </div>
            </Field>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" variant="filled">
              {editing ? 'Salvar alterações' : 'Cadastrar usuário'}
            </Button>
            {editing ? (
              <Button type="button" variant="outlined" onClick={() => setEditing(null)}>
                Cancelar edição
              </Button>
            ) : null}
          </div>
        </form>
      </FormSection>

      <div>
        <p className="mb-2 text-[12px] text-[var(--ink-3)]">
          O sistema não remove usuários do banco: inativar impede o login; use Reativar para restaurar o acesso.
        </p>
        <DataTableFiltersBar
          active={filtersActive}
          onClear={clearFilters}
          resultCount={filtered.length}
          totalCount={usuarios.length}
        />
        <DataTable>
          <DataTableHead>
            <tr>
              <DataTableHeaderCell>Usuário</DataTableHeaderCell>
              <DataTableHeaderCell>Perfil</DataTableHeaderCell>
              <DataTableHeaderCell>Equipes</DataTableHeaderCell>
              <DataTableHeaderCell>Secretaria</DataTableHeaderCell>
              <DataTableHeaderCell>Status</DataTableHeaderCell>
              <DataTableHeaderCell>Ações</DataTableHeaderCell>
            </tr>
            <DataTableFilterRow>
              <DataTableFilterCell>
                <DataTableTextFilter value={filterUsuario} onChange={setFilterUsuario} placeholder="Nome ou e-mail" aria-label="Filtrar usuário" />
              </DataTableFilterCell>
              <DataTableFilterCell>
                <DataTableSelectFilter value={filterPerfil} onChange={setFilterPerfil} options={perfilOptions} aria-label="Filtrar perfil" />
              </DataTableFilterCell>
              <DataTableFilterCell>
                <DataTableSelectFilter value={filterEquipe} onChange={setFilterEquipe} options={equipeOptions} aria-label="Filtrar equipe" />
              </DataTableFilterCell>
              <DataTableFilterCell>
                <DataTableSelectFilter value={filterSecretaria} onChange={setFilterSecretaria} options={secretariaOptions} aria-label="Filtrar secretaria" />
              </DataTableFilterCell>
              <DataTableFilterCell>
                <DataTableSelectFilter value={filterStatus} onChange={setFilterStatus} options={STATUS_FILTER_OPTIONS} aria-label="Filtrar status" />
              </DataTableFilterCell>
              <DataTableFilterCell />
            </DataTableFilterRow>
          </DataTableHead>
          <DataTableBody>
            {filtered.length === 0 ? (
              <DataTableRow>
                <DataTableCell colSpan={6} className="py-6 text-center text-[var(--ink-3)]">
                  {usuarios.length === 0 ? 'Nenhum usuário cadastrado.' : 'Nenhum registro corresponde aos filtros.'}
                </DataTableCell>
              </DataTableRow>
            ) : (
              filtered.map((usuario) => (
                <DataTableRow key={usuario.id}>
                  <DataTableCell>
                    <div>
                      <p className="font-semibold text-[var(--ink)]">{usuario.nome}</p>
                      <p className="text-[12px] text-[var(--ink-3)]">{usuario.email}</p>
                    </div>
                  </DataTableCell>
                  <DataTableCell>{usuario.perfis.map((p) => p.perfil.nome).join(', ') || '—'}</DataTableCell>
                  <DataTableCell>{usuario.equipes?.map((e) => e.equipe.nome).join(', ') || '—'}</DataTableCell>
                  <DataTableCell mono>{usuario.secretaria?.sigla ?? '—'}</DataTableCell>
                  <DataTableCell>
                    <Badge variant={usuario.ativo ? 'success' : 'muted'}>{usuario.ativo ? 'Ativo' : 'Inativo'}</Badge>
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      <Button variant="text" size="sm" onClick={() => setEditing(usuario)}>
                        Editar
                      </Button>
                      {usuario.ativo ? (
                        <Button variant="text" size="sm" className="text-red-700" onClick={() => void toggleAtivo(usuario)}>
                          Inativar
                        </Button>
                      ) : (
                        <>
                          <Button variant="text" size="sm" className="text-emerald-700" onClick={() => void toggleAtivo(usuario)}>
                            Reativar
                          </Button>
                          <Button
                            variant="text"
                            size="sm"
                            className="text-red-700"
                            onClick={() =>
                              void mutate(
                                () => anonymizeUsuarioLgpd(usuario.id),
                                `Usuário ${usuario.nome} anonimizado.`,
                              )
                            }
                          >
                            Anonimizar
                          </Button>
                        </>
                      )}
                    </div>
                  </DataTableCell>
                </DataTableRow>
              ))
            )}
          </DataTableBody>
        </DataTable>
      </div>
    </div>
  );
}

function EquipesPanel({
  secretarias,
  usuarios,
  equipes,
  mutate,
}: {
  secretarias: AdminSecretaria[];
  usuarios: AdminUsuario[];
  equipes: AdminEquipe[];
  mutate: (action: () => Promise<unknown>, message: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState<AdminEquipe | null>(null);
  const [selectedUsuarioIds, setSelectedUsuarioIds] = useState<string[]>([]);
  const [filterEquipe, setFilterEquipe] = useState('');
  const [filterSecretaria, setFilterSecretaria] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const filtersActive = Boolean(filterEquipe || filterSecretaria || filterStatus);

  useEffect(() => {
    setSelectedUsuarioIds(editing?.membros.map((item) => item.usuario.id) ?? []);
  }, [editing?.id, editing?.membros]);

  const secretariaOptions = useMemo(
    () => [...new Set(equipes.map((e) => e.secretaria?.sigla).filter(Boolean) as string[])].sort().map((sigla) => ({ value: sigla, label: sigla })),
    [equipes],
  );

  const filtered = useMemo(
    () =>
      equipes.filter(
        (equipe) =>
          (matchesText(equipe.nome, filterEquipe) || matchesText(equipe.codigo, filterEquipe) || matchesText(equipe.descricao, filterEquipe)) &&
          (!filterSecretaria || equipe.secretaria?.sigla === filterSecretaria) &&
          matchesStatus(equipe.ativo, filterStatus),
      ),
    [equipes, filterEquipe, filterSecretaria, filterStatus],
  );

  function clearFilters() {
    setFilterEquipe('');
    setFilterSecretaria('');
    setFilterStatus('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const isEdit = Boolean(editing);
    const ok = await mutate(
      () => {
        const payload = equipePayloadFromForm(form, selectedUsuarioIds, editing?.ativo ?? true);
        return saveAdminEquipe(payload, editing?.id);
      },
      isEdit ? 'Equipe atualizada.' : 'Equipe cadastrada.',
    );
    if (ok) {
      setEditing(null);
      setSelectedUsuarioIds([]);
      event.currentTarget.reset();
    }
  }

  async function toggleAtivo(equipe: AdminEquipe) {
    const nextAtivo = !equipe.ativo;
    await mutate(
      () => saveAdminEquipe(equipePayloadFromRecord(equipe, nextAtivo), equipe.id),
      nextAtivo ? 'Equipe reativada.' : 'Equipe inativada.',
    );
    if (editing?.id === equipe.id) {
      setEditing({ ...equipe, ativo: nextAtivo });
    }
  }

  return (
    <div className="space-y-6">
      <FormSection title={editing ? 'Editar equipe' : 'Nova equipe'}>
        <form key={editing?.id ?? 'new-equipe'} onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Código" tooltip="Código único da equipe (ex.: ZEL-A). Não pode repetir em outra equipe.">
              <Input
                name="codigo"
                required
                defaultValue={editing?.codigo ?? ''}
                placeholder="Ex.: ZEL-A"
                className="uppercase"
              />
            </Field>
            <Field label="Nome" tooltip="Nome da equipe. Não pode repetir na mesma secretaria.">
              <Input name="nome" required defaultValue={editing?.nome} placeholder="Ex.: Zeladoria Bloco A" />
            </Field>
            <Field label="Descrição">
              <Input name="descricao" defaultValue={editing?.descricao ?? ''} placeholder="Opcional" />
            </Field>
            <Field label="Tipo da equipe">
              <Select name="tipo" defaultValue={editing?.tipo ?? 'PROPRIA'}>
                <option value="PROPRIA">Própria</option>
                <option value="TERCEIRIZADA">Terceirizada</option>
              </Select>
            </Field>
            <Field label="E-mail da equipe">
              <Input name="emailEquipe" type="email" required defaultValue={editing?.emailEquipe ?? ''} placeholder="equipe@franca.sp.gov.br" />
            </Field>
            <Field label="Secretaria">
              <Select name="secretariaId" defaultValue={editing?.secretariaId ?? ''}>
                <option value="">Sem secretaria</option>
                {secretarias.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.sigla} — {s.nome}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Membros">
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-[var(--r-md)] border border-[var(--line)] p-3">
              {usuarios.filter((usuario) => usuario.ativo).length === 0 ? (
                <p className="text-[12px] text-[var(--ink-3)]">Nenhum usuário ativo cadastrado.</p>
              ) : (
                usuarios
                  .filter((usuario) => usuario.ativo)
                  .map((usuario) => (
                    <label key={usuario.id} className="flex items-center gap-2 text-[13px] text-[var(--ink-2)]">
                      <input
                        type="checkbox"
                        checked={selectedUsuarioIds.includes(usuario.id)}
                        onChange={(event) => {
                          setSelectedUsuarioIds((current) =>
                            event.target.checked
                              ? [...current, usuario.id]
                              : current.filter((id) => id !== usuario.id),
                          );
                        }}
                      />
                      <span>
                        {usuario.nome} · {usuario.email}
                      </span>
                    </label>
                  ))
              )}
            </div>
          </Field>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" variant="filled">
              {editing ? 'Salvar alterações' : 'Cadastrar equipe'}
            </Button>
            {editing ? (
              <Button type="button" variant="outlined" onClick={() => setEditing(null)}>
                Cancelar edição
              </Button>
            ) : null}
          </div>
        </form>
      </FormSection>

      <div>
        <DataTableFiltersBar
          active={filtersActive}
          onClear={clearFilters}
          resultCount={filtered.length}
          totalCount={equipes.length}
        />
        <DataTable>
          <DataTableHead>
            <tr>
              <DataTableHeaderCell>Equipe</DataTableHeaderCell>
              <DataTableHeaderCell>Secretaria</DataTableHeaderCell>
              <DataTableHeaderCell>Membros</DataTableHeaderCell>
              <DataTableHeaderCell>Chamados</DataTableHeaderCell>
              <DataTableHeaderCell>Status</DataTableHeaderCell>
              <DataTableHeaderCell>Ações</DataTableHeaderCell>
            </tr>
            <DataTableFilterRow>
              <DataTableFilterCell>
                <DataTableTextFilter value={filterEquipe} onChange={setFilterEquipe} placeholder="Código ou nome" aria-label="Filtrar equipe" />
              </DataTableFilterCell>
              <DataTableFilterCell>
                <DataTableSelectFilter value={filterSecretaria} onChange={setFilterSecretaria} options={secretariaOptions} aria-label="Filtrar secretaria" />
              </DataTableFilterCell>
              <DataTableFilterCell />
              <DataTableFilterCell />
              <DataTableFilterCell>
                <DataTableSelectFilter value={filterStatus} onChange={setFilterStatus} options={STATUS_FILTER_OPTIONS} aria-label="Filtrar status" />
              </DataTableFilterCell>
              <DataTableFilterCell />
            </DataTableFilterRow>
          </DataTableHead>
          <DataTableBody>
            {filtered.length === 0 ? (
              <DataTableRow>
                <DataTableCell colSpan={6} className="py-6 text-center text-[var(--ink-3)]">
                  {equipes.length === 0 ? 'Nenhuma equipe cadastrada.' : 'Nenhum registro corresponde aos filtros.'}
                </DataTableCell>
              </DataTableRow>
            ) : (
              filtered.map((equipe) => (
                <DataTableRow key={equipe.id}>
                  <DataTableCell>
                    <div>
                      <p className="mono text-[11px] text-[var(--ink-3)]">{equipe.codigo}</p>
                      <p className="font-semibold text-[var(--ink)]">{equipe.nome}</p>
                      {equipe.descricao ? <p className="text-[12px] text-[var(--ink-3)]">{equipe.descricao}</p> : null}
                    </div>
                  </DataTableCell>
                  <DataTableCell mono>{equipe.secretaria?.sigla ?? '—'}</DataTableCell>
                  <DataTableCell>{equipe.membros.length}</DataTableCell>
                  <DataTableCell>{equipe._count?.chamados ?? 0}</DataTableCell>
                  <DataTableCell>
                    <Badge variant={equipe.ativo ? 'success' : 'muted'}>{equipe.ativo ? 'Ativa' : 'Inativa'}</Badge>
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      <Button variant="text" size="sm" onClick={() => setEditing(equipe)}>
                        Editar
                      </Button>
                      {equipe.ativo ? (
                        <Button variant="text" size="sm" className="text-red-700" onClick={() => void toggleAtivo(equipe)}>
                          Inativar
                        </Button>
                      ) : (
                        <Button variant="text" size="sm" className="text-emerald-700" onClick={() => void toggleAtivo(equipe)}>
                          Reativar
                        </Button>
                      )}
                    </div>
                  </DataTableCell>
                </DataTableRow>
              ))
            )}
          </DataTableBody>
        </DataTable>
      </div>
    </div>
  );
}

function TiposProprioPanel({
  tipos,
  mutate,
}: {
  tipos: AdminTipoProprio[];
  mutate: (action: () => Promise<unknown>, message: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState<AdminTipoProprio | null>(null);
  const [filterNome, setFilterNome] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const filtersActive = Boolean(filterNome || filterStatus);

  const filtered = useMemo(
    () =>
      tipos.filter(
        (tipo) =>
          (matchesText(tipo.nome, filterNome) || matchesText(tipo.codigo, filterNome)) &&
          matchesStatus(tipo.ativo, filterStatus),
      ),
    [tipos, filterNome, filterStatus],
  );

  function clearFilters() {
    setFilterNome('');
    setFilterStatus('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      nome: String(form.get('nome')),
      descricao: String(form.get('descricao') || ''),
      ativo: editing?.ativo ?? true,
    };
    const ok = await mutate(
      () => saveAdminTipoProprio(payload, editing?.id),
      editing ? 'Tipo de próprio atualizado.' : 'Tipo de próprio cadastrado.',
    );
    if (ok) {
      setEditing(null);
      event.currentTarget.reset();
    }
  }

  async function toggleAtivo(tipo: AdminTipoProprio) {
    const nextAtivo = !tipo.ativo;
    await mutate(
      () =>
        saveAdminTipoProprio(
          { nome: tipo.nome, descricao: tipo.descricao ?? '', ativo: nextAtivo },
          tipo.id,
        ),
      nextAtivo ? 'Tipo de próprio reativado.' : 'Tipo de próprio inativado.',
    );
    if (editing?.id === tipo.id) setEditing({ ...tipo, ativo: nextAtivo });
  }

  return (
    <div className="space-y-6">
      <TipBanner id="admin-tipos-proprio">
        Tipos parametrizam o campo &quot;tipo&quot; dos próprios e o vínculo de checklists por tipo. Tipos do sistema
        podem ser editados ou inativados, mas não excluídos.
      </TipBanner>

      <FormSection title={editing ? 'Editar tipo de próprio' : 'Novo tipo de próprio'}>
        <form key={editing?.id ?? 'new-tipo-proprio'} onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Nome"
              hint={editing ? `Código: ${editing.codigo}` : 'O código é gerado automaticamente a partir do nome.'}
            >
              <Input name="nome" required defaultValue={editing?.nome} placeholder="Ex.: Biblioteca" />
            </Field>
            <Field label="Descrição">
              <Input name="descricao" defaultValue={editing?.descricao ?? ''} />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="filled">
              {editing ? 'Salvar' : 'Cadastrar'}
            </Button>
            {editing ? (
              <Button type="button" variant="text" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
            ) : null}
          </div>
        </form>
      </FormSection>

      <div>
        <DataTableFiltersBar
          active={filtersActive}
          onClear={clearFilters}
          resultCount={filtered.length}
          totalCount={tipos.length}
        />
        <DataTable>
          <DataTableHead>
            <tr>
              <DataTableHeaderCell>Nome</DataTableHeaderCell>
              <DataTableHeaderCell>Código</DataTableHeaderCell>
              <DataTableHeaderCell>Descrição</DataTableHeaderCell>
              <DataTableHeaderCell>Status</DataTableHeaderCell>
              <DataTableHeaderCell>Ações</DataTableHeaderCell>
            </tr>
            <DataTableFilterRow>
              <DataTableFilterCell>
                <DataTableTextFilter
                  value={filterNome}
                  onChange={setFilterNome}
                  placeholder="Nome ou código"
                  aria-label="Filtrar nome"
                />
              </DataTableFilterCell>
              <DataTableFilterCell />
              <DataTableFilterCell />
              <DataTableFilterCell>
                <DataTableSelectFilter
                  value={filterStatus}
                  onChange={setFilterStatus}
                  options={STATUS_FILTER_OPTIONS}
                  aria-label="Filtrar status"
                />
              </DataTableFilterCell>
              <DataTableFilterCell />
            </DataTableFilterRow>
          </DataTableHead>
          <DataTableBody>
            {filtered.length === 0 ? (
              <DataTableRow>
                <DataTableCell colSpan={5} className="py-6 text-center text-[var(--ink-3)]">
                  {tipos.length === 0 ? 'Nenhum tipo cadastrado.' : 'Nenhum registro corresponde aos filtros.'}
                </DataTableCell>
              </DataTableRow>
            ) : (
              filtered.map((tipo) => (
                <DataTableRow key={tipo.id}>
                  <DataTableCell>
                    {tipo.nome}
                    {tipo.sistema ? (
                      <Badge variant="muted" className="ml-2">
                        Sistema
                      </Badge>
                    ) : null}
                  </DataTableCell>
                  <DataTableCell mono>{tipo.codigo}</DataTableCell>
                  <DataTableCell>{tipo.descricao || '—'}</DataTableCell>
                  <DataTableCell>
                    <Badge variant={tipo.ativo ? 'success' : 'muted'}>{tipo.ativo ? 'Ativo' : 'Inativo'}</Badge>
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="text" size="sm" onClick={() => setEditing(tipo)}>
                        Editar
                      </Button>
                      <Button variant="text" size="sm" onClick={() => void toggleAtivo(tipo)}>
                        {tipo.ativo ? 'Inativar' : 'Reativar'}
                      </Button>
                      {!tipo.sistema && !tipo.ativo ? (
                        <Button
                          variant="text"
                          size="sm"
                          className="text-red-700"
                          onClick={() => void mutate(() => deleteAdminTipoProprio(tipo.id), 'Tipo excluído.')}
                        >
                          Excluir
                        </Button>
                      ) : null}
                    </div>
                  </DataTableCell>
                </DataTableRow>
              ))
            )}
          </DataTableBody>
        </DataTable>
      </div>
    </div>
  );
}

function TiposChamadoPanel({
  tipos,
  mutate,
}: {
  tipos: AdminTipoChamado[];
  mutate: (action: () => Promise<unknown>, message: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState<AdminTipoChamado | null>(null);
  const [filterNome, setFilterNome] = useState('');
  const [filterVistoria, setFilterVistoria] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const filtersActive = Boolean(filterNome || filterVistoria || filterStatus);

  const filtered = useMemo(
    () =>
      tipos.filter((tipo) => {
        const vistoriaOk =
          !filterVistoria ||
          (filterVistoria === 'sim' && tipo.exigeVistoriaPrevia) ||
          (filterVistoria === 'nao' && !tipo.exigeVistoriaPrevia);
        return matchesText(tipo.nome, filterNome) && vistoriaOk && matchesStatus(tipo.ativo, filterStatus);
      }),
    [tipos, filterNome, filterVistoria, filterStatus],
  );

  function clearFilters() {
    setFilterNome('');
    setFilterVistoria('');
    setFilterStatus('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      nome: String(form.get('nome')),
      descricao: String(form.get('descricao') || ''),
      slaBaixaDias: Number(form.get('slaBaixaDias')),
      slaMediaDias: Number(form.get('slaMediaDias')),
      slaAltaDias: Number(form.get('slaAltaDias')),
      slaUrgenteDias: Number(form.get('slaUrgenteDias')),
      exigeVistoriaPrevia: form.get('exigeVistoriaPrevia') === 'on',
      ativo: editing?.ativo ?? true,
    };
    const ok = await mutate(
      () => saveAdminTipoChamado(payload, editing?.id),
      editing ? 'Tipo de chamado atualizado.' : 'Tipo de chamado cadastrado.',
    );
    if (ok) {
      setEditing(null);
      event.currentTarget.reset();
    }
  }

  return (
    <div className="space-y-6">
      <FormSection title={editing ? 'Editar tipo de chamado' : 'Novo tipo de chamado'}>
        <form key={editing?.id ?? 'new-tipo'} onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome"><Input name="nome" required defaultValue={editing?.nome} /></Field>
            <Field label="Descrição"><Input name="descricao" defaultValue={editing?.descricao ?? ''} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Field label="SLA Baixa (dias)"><Input name="slaBaixaDias" type="number" min={1} required defaultValue={editing?.slaBaixaDias ?? 30} /></Field>
            <Field label="SLA Média (dias)"><Input name="slaMediaDias" type="number" min={1} required defaultValue={editing?.slaMediaDias ?? 15} /></Field>
            <Field label="SLA Alta (dias)"><Input name="slaAltaDias" type="number" min={1} required defaultValue={editing?.slaAltaDias ?? 7} /></Field>
            <Field label="SLA Urgente (dias)"><Input name="slaUrgenteDias" type="number" min={1} required defaultValue={editing?.slaUrgenteDias ?? 3} /></Field>
          </div>
          <label className="flex items-center gap-2 text-[13px] text-[var(--ink-2)]">
            <input
              type="checkbox"
              name="exigeVistoriaPrevia"
              defaultChecked={editing?.exigeVistoriaPrevia ?? false}
              className="h-4 w-4 rounded border-[var(--line)]"
            />
            Exige Análise Técnica Prévia
          </label>
          <div className="flex gap-2">
            <Button type="submit" variant="filled">{editing ? 'Salvar' : 'Cadastrar'}</Button>
            {editing ? (
              <Button type="button" variant="text" onClick={() => setEditing(null)}>Cancelar</Button>
            ) : null}
          </div>
        </form>
      </FormSection>

      <div>
        <DataTableFiltersBar
          active={filtersActive}
          onClear={clearFilters}
          resultCount={filtered.length}
          totalCount={tipos.length}
        />
        <DataTable>
          <DataTableHead>
            <tr>
              <DataTableHeaderCell>Nome</DataTableHeaderCell>
              <DataTableHeaderCell>SLA Baixa/Média/Alta</DataTableHeaderCell>
              <DataTableHeaderCell>Vist. prévia</DataTableHeaderCell>
              <DataTableHeaderCell>Status</DataTableHeaderCell>
              <DataTableHeaderCell>Ações</DataTableHeaderCell>
            </tr>
            <DataTableFilterRow>
              <DataTableFilterCell>
                <DataTableTextFilter value={filterNome} onChange={setFilterNome} placeholder="Nome" aria-label="Filtrar nome" />
              </DataTableFilterCell>
              <DataTableFilterCell />
              <DataTableFilterCell>
                <DataTableSelectFilter
                  value={filterVistoria}
                  onChange={setFilterVistoria}
                  options={[
                    { value: 'sim', label: 'Sim' },
                    { value: 'nao', label: 'Não' },
                  ]}
                  aria-label="Filtrar vistoria prévia"
                />
              </DataTableFilterCell>
              <DataTableFilterCell>
                <DataTableSelectFilter value={filterStatus} onChange={setFilterStatus} options={STATUS_FILTER_OPTIONS} aria-label="Filtrar status" />
              </DataTableFilterCell>
              <DataTableFilterCell />
            </DataTableFilterRow>
          </DataTableHead>
          <DataTableBody>
            {filtered.length === 0 ? (
              <DataTableRow>
                <DataTableCell colSpan={5} className="py-6 text-center text-[var(--ink-3)]">
                  {tipos.length === 0 ? 'Nenhum tipo cadastrado.' : 'Nenhum registro corresponde aos filtros.'}
                </DataTableCell>
              </DataTableRow>
            ) : (
              filtered.map((tipo) => (
                <DataTableRow key={tipo.id}>
                  <DataTableCell>{tipo.nome}</DataTableCell>
                  <DataTableCell mono>{tipo.slaBaixaDias}/{tipo.slaMediaDias}/{tipo.slaAltaDias}d</DataTableCell>
                  <DataTableCell>{tipo.exigeVistoriaPrevia ? 'Sim' : 'Não'}</DataTableCell>
                  <DataTableCell>
                    <Badge variant={tipo.ativo ? 'success' : 'muted'}>{tipo.ativo ? 'Ativo' : 'Inativo'}</Badge>
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex gap-2">
                      <Button variant="text" size="sm" onClick={() => setEditing(tipo)}>Editar</Button>
                      <Button variant="text" size="sm" className="text-red-700" onClick={() => void mutate(() => deleteAdminTipoChamado(tipo.id), 'Tipo excluído.')}>
                        Excluir
                      </Button>
                    </div>
                  </DataTableCell>
                </DataTableRow>
              ))
            )}
          </DataTableBody>
        </DataTable>
      </div>
    </div>
  );
}

function CargosPanel({
  cargos,
  mutate,
}: {
  cargos: AdminCargo[];
  mutate: (action: () => Promise<unknown>, message: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState<AdminCargo | null>(null);
  const [filterNome, setFilterNome] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const filtersActive = Boolean(filterNome || filterStatus);

  const filtered = useMemo(
    () => cargos.filter((cargo) => matchesText(cargo.nome, filterNome) && matchesStatus(cargo.ativo, filterStatus)),
    [cargos, filterNome, filterStatus],
  );

  function clearFilters() {
    setFilterNome('');
    setFilterStatus('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      nome: String(form.get('nome')),
      ativo: editing?.ativo ?? true,
    };
    const ok = await mutate(
      () => saveAdminCargo(payload, editing?.id),
      editing ? 'Cargo atualizado.' : 'Cargo cadastrado.',
    );
    if (ok) {
      setEditing(null);
      event.currentTarget.reset();
    }
  }

  async function toggleAtivo(cargo: AdminCargo) {
    const nextAtivo = !cargo.ativo;
    await mutate(() => saveAdminCargo({ nome: cargo.nome, ativo: nextAtivo }, cargo.id), nextAtivo ? 'Cargo reativado.' : 'Cargo inativado.');
    if (editing?.id === cargo.id) {
      setEditing({ ...cargo, ativo: nextAtivo });
    }
  }

  return (
    <div className="space-y-6">
      <TipBanner id="admin-cargos">
        Cadastre os cargos dos usuários (ex.: Agente, Encarregado). Eles aparecem no cadastro de usuários para relatórios futuros por função.
      </TipBanner>

      <FormSection title={editing ? 'Editar cargo' : 'Novo cargo'}>
        <form key={editing?.id ?? 'new-cargo'} onSubmit={submit} className="space-y-4">
          <div className="max-w-md">
            <Field label="Nome" tooltip="Nome do cargo exibido na lista do cadastro de usuários.">
              <Input name="nome" required defaultValue={editing?.nome} placeholder="Ex.: Agente de campo" />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="filled">
              {editing ? 'Salvar' : 'Cadastrar'}
            </Button>
            {editing ? (
              <Button type="button" variant="text" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
            ) : null}
          </div>
        </form>
      </FormSection>

      <div>
        <DataTableFiltersBar
          active={filtersActive}
          onClear={clearFilters}
          resultCount={filtered.length}
          totalCount={cargos.length}
        />
        <DataTable>
          <DataTableHead>
            <tr>
              <DataTableHeaderCell>Nome</DataTableHeaderCell>
              <DataTableHeaderCell>Status</DataTableHeaderCell>
              <DataTableHeaderCell>Ações</DataTableHeaderCell>
            </tr>
            <DataTableFilterRow>
              <DataTableFilterCell>
                <DataTableTextFilter value={filterNome} onChange={setFilterNome} placeholder="Nome" aria-label="Filtrar nome" />
              </DataTableFilterCell>
              <DataTableFilterCell>
                <DataTableSelectFilter value={filterStatus} onChange={setFilterStatus} options={STATUS_FILTER_OPTIONS} aria-label="Filtrar status" />
              </DataTableFilterCell>
              <DataTableFilterCell />
            </DataTableFilterRow>
          </DataTableHead>
          <DataTableBody>
            {filtered.length === 0 ? (
              <DataTableRow>
                <DataTableCell colSpan={3} className="py-6 text-center text-[var(--ink-3)]">
                  {cargos.length === 0 ? 'Nenhum cargo cadastrado.' : 'Nenhum registro corresponde aos filtros.'}
                </DataTableCell>
              </DataTableRow>
            ) : (
              filtered.map((cargo) => (
                <DataTableRow key={cargo.id}>
                  <DataTableCell>{cargo.nome}</DataTableCell>
                  <DataTableCell>
                    <Badge variant={cargo.ativo ? 'success' : 'muted'}>{cargo.ativo ? 'Ativo' : 'Inativo'}</Badge>
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      <Button variant="text" size="sm" onClick={() => setEditing(cargo)}>
                        Editar
                      </Button>
                      {cargo.ativo ? (
                        <Button variant="text" size="sm" className="text-red-700" onClick={() => void toggleAtivo(cargo)}>
                          Inativar
                        </Button>
                      ) : (
                        <Button variant="text" size="sm" className="text-emerald-700" onClick={() => void toggleAtivo(cargo)}>
                          Reativar
                        </Button>
                      )}
                    </div>
                  </DataTableCell>
                </DataTableRow>
              ))
            )}
          </DataTableBody>
        </DataTable>
      </div>
    </div>
  );
}

function CategoriasVistoriaPanel({
  categorias,
  mutate,
}: {
  categorias: AdminCategoriaVistoria[];
  mutate: (action: () => Promise<unknown>, message: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState<AdminCategoriaVistoria | null>(null);
  const [filterNome, setFilterNome] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const filtersActive = Boolean(filterNome || filterStatus);

  const filtered = useMemo(
    () => categorias.filter((categoria) => matchesText(categoria.nome, filterNome) && matchesStatus(categoria.ativo, filterStatus)),
    [categorias, filterNome, filterStatus],
  );

  function clearFilters() {
    setFilterNome('');
    setFilterStatus('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      nome: String(form.get('nome')),
      ativo: editing?.ativo ?? true,
    };
    const ok = await mutate(
      () => saveAdminCategoriaVistoria(payload, editing?.id),
      editing ? 'Categoria atualizada.' : 'Categoria cadastrada.',
    );
    if (ok) {
      setEditing(null);
      event.currentTarget.reset();
    }
  }

  return (
    <div className="space-y-6">
      <TipBanner id="admin-categorias-vistoria">
        Categorias usadas nos itens Likert dos checklists e no mapa de notas da CCO (Pintura, Piso, Móveis, etc.).
      </TipBanner>

      <FormSection title={editing ? 'Editar categoria' : 'Nova categoria'}>
        <form key={editing?.id ?? 'new-categoria'} onSubmit={submit} className="space-y-4">
          <div className="max-w-md">
            <Field label="Nome"><Input name="nome" required defaultValue={editing?.nome} /></Field>
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="filled">{editing ? 'Salvar' : 'Cadastrar'}</Button>
            {editing ? (
              <Button type="button" variant="text" onClick={() => setEditing(null)}>Cancelar</Button>
            ) : null}
          </div>
        </form>
      </FormSection>

      <div>
        <DataTableFiltersBar
          active={filtersActive}
          onClear={clearFilters}
          resultCount={filtered.length}
          totalCount={categorias.length}
        />
        <DataTable>
          <DataTableHead>
            <tr>
              <DataTableHeaderCell>Nome</DataTableHeaderCell>
              <DataTableHeaderCell>Status</DataTableHeaderCell>
              <DataTableHeaderCell>Ações</DataTableHeaderCell>
            </tr>
            <DataTableFilterRow>
              <DataTableFilterCell>
                <DataTableTextFilter value={filterNome} onChange={setFilterNome} placeholder="Nome" aria-label="Filtrar nome" />
              </DataTableFilterCell>
              <DataTableFilterCell>
                <DataTableSelectFilter value={filterStatus} onChange={setFilterStatus} options={STATUS_FILTER_OPTIONS} aria-label="Filtrar status" />
              </DataTableFilterCell>
              <DataTableFilterCell />
            </DataTableFilterRow>
          </DataTableHead>
          <DataTableBody>
            {filtered.length === 0 ? (
              <DataTableRow>
                <DataTableCell colSpan={3} className="py-6 text-center text-[var(--ink-3)]">
                  {categorias.length === 0 ? 'Nenhuma categoria cadastrada.' : 'Nenhum registro corresponde aos filtros.'}
                </DataTableCell>
              </DataTableRow>
            ) : (
              filtered.map((categoria) => (
                <DataTableRow key={categoria.id}>
                  <DataTableCell>{categoria.nome}</DataTableCell>
                  <DataTableCell>
                    <Badge variant={categoria.ativo ? 'success' : 'muted'}>{categoria.ativo ? 'Ativo' : 'Inativo'}</Badge>
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex gap-2">
                      <Button variant="text" size="sm" onClick={() => setEditing(categoria)}>Editar</Button>
                      <Button variant="text" size="sm" className="text-red-700" onClick={() => void mutate(() => deleteAdminCategoriaVistoria(categoria.id), 'Categoria excluída.')}>
                        Excluir
                      </Button>
                    </div>
                  </DataTableCell>
                </DataTableRow>
              ))
            )}
          </DataTableBody>
        </DataTable>
      </div>
    </div>
  );
}

function parseCoordinate(value: FormDataEntryValue | null): number {
  const raw = String(value ?? '').trim().replace(',', '.');
  if (!raw) {
    throw new Error('Informe latitude e longitude válidas.');
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error('Coordenada inválida. Use números decimais (ex.: -20.5386).');
  }
  return parsed;
}
