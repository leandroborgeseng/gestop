'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Building2, ClipboardList, Download, MapPin, Search, Shield, UserRound, UsersRound } from 'lucide-react';
import { RequirePermissions } from '@/components/auth/require-permissions';
import { ImportacaoPanel } from '@/components/admin/importacao-panel';
import { PageShell } from '@/components/layout/page-shell';
import { TipBanner } from '@/components/help/tip-banner';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { FormGrid, FormSection, RecordItem, RecordList } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Sheet } from '@/components/ui/sheet';
import { Tabs } from '@/components/ui/tabs';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
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
  anonymizeUsuarioLgpd,
  purgeAuditoriaLgpd,
} from '@/lib/api';
import { AdminEquipe, AdminPerfil, AdminSecretaria, AdminTipoChamado, AdminUnidade, AdminUsuario, UnidadeTipo } from '@/lib/types';
import { formatUnidadeTipo } from '@/lib/unidade-tipo';
import { formatUnidadeOrigem, getLockedFields, getUnidadeMetadata, isQgisImported } from '@/lib/unidade-metadata';

type Tab = 'secretarias' | 'unidades' | 'usuarios' | 'equipes' | 'tipos-chamado' | 'importacao';

const tipos: UnidadeTipo[] = ['ESCOLA', 'UBS', 'PRACA', 'PREDIO_ADMINISTRATIVO', 'ESPACO_ESPORTIVO', 'OUTRO'];

export default function AdminPage() {
  const snackbar = useSnackbar();
  const [tab, setTab] = useState<Tab>('secretarias');
  const [secretarias, setSecretarias] = useState<AdminSecretaria[]>([]);
  const [unidades, setUnidades] = useState<AdminUnidade[]>([]);
  const [usuarios, setUsuarios] = useState<AdminUsuario[]>([]);
  const [equipes, setEquipes] = useState<AdminEquipe[]>([]);
  const [tiposChamado, setTiposChamado] = useState<AdminTipoChamado[]>([]);
  const [perfis, setPerfis] = useState<AdminPerfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [nextSecretarias, nextUnidades, nextUsuarios, nextEquipes, nextPerfis, nextTiposChamado] = await Promise.all([
        listAdminSecretarias(),
        listAdminUnidades(),
        listAdminUsuarios(),
        listAdminEquipes(),
        listAdminPerfis(),
        listAdminTiposChamado(),
      ]);
      setSecretarias(nextSecretarias);
      setUnidades(nextUnidades);
      setUsuarios(nextUsuarios);
      setEquipes(nextEquipes);
      setPerfis(nextPerfis);
      setTiposChamado(nextTiposChamado);
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
        backHref="/cco"
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
              { id: 'tipos-chamado', label: 'Tipos de chamado', icon: <ClipboardList className="h-4 w-4" />, count: tiposChamado.length },
              { id: 'importacao', label: 'Importação', icon: <Download className="h-4 w-4" /> },
            ]}
          />
        </div>

        {loading ? <LoadingState label="Carregando cadastros..." /> : null}

        {!loading && tab === 'secretarias' ? (
          <SecretariasPanel secretarias={secretarias} mutate={mutate} />
        ) : null}
        {!loading && tab === 'unidades' ? (
          <UnidadesPanel secretarias={secretarias} unidades={unidades} mutate={mutate} />
        ) : null}
        {!loading && tab === 'usuarios' ? (
          <UsuariosPanel secretarias={secretarias} usuarios={usuarios} equipes={equipes} perfis={perfis} mutate={mutate} />
        ) : null}
        {!loading && tab === 'equipes' ? (
          <EquipesPanel secretarias={secretarias} usuarios={usuarios} equipes={equipes} mutate={mutate} />
        ) : null}
        {!loading && tab === 'tipos-chamado' ? (
          <TiposChamadoPanel tipos={tiposChamado} mutate={mutate} />
        ) : null}
        {!loading && tab === 'importacao' ? (
          <ImportacaoPanel onSynced={() => void load()} />
        ) : null}

        {!loading && tab !== 'importacao' ? (
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

function SecretariasPanel({ secretarias, mutate }: { secretarias: AdminSecretaria[]; mutate: (action: () => Promise<unknown>, message: string) => Promise<boolean> }) {
  const [editing, setEditing] = useState<AdminSecretaria | null>(null);

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
      <DataTable>
        <DataTableHead>
          <DataTableHeaderCell>Sigla</DataTableHeaderCell>
          <DataTableHeaderCell>Secretaria</DataTableHeaderCell>
          <DataTableHeaderCell>Responsável</DataTableHeaderCell>
          <DataTableHeaderCell>Status</DataTableHeaderCell>
        </DataTableHead>
        <DataTableBody>
          {secretarias.map((secretaria) => (
            <DataTableRow key={secretaria.id}>
              <DataTableCell mono>{secretaria.sigla}</DataTableCell>
              <DataTableCell>{secretaria.nome}</DataTableCell>
              <DataTableCell>{secretaria.responsavelNome ?? '—'}</DataTableCell>
              <DataTableCell>
                <Badge variant={secretaria.ativo ? 'success' : 'muted'}>{secretaria.ativo ? 'Ativo' : 'Inativo'}</Badge>
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTableBody>
      </DataTable>

      <FormGrid>
      <FormSection title={editing ? 'Editar secretaria' : 'Nova secretaria'}>
        <form key={editing?.id ?? 'new-secretaria'} onSubmit={submit} className="space-y-4">
          <Field label="Nome"><Input name="nome" required defaultValue={editing?.nome} /></Field>
          <Field label="Sigla"><Input name="sigla" required defaultValue={editing?.sigla} /></Field>
          <Field label="Descrição"><Input name="descricao" defaultValue={editing?.descricao ?? ''} /></Field>
          <Field label="Responsável"><Input name="responsavelNome" defaultValue={editing?.responsavelNome ?? ''} /></Field>
          <Field label="E-mail do responsável"><Input name="responsavelEmail" type="email" defaultValue={editing?.responsavelEmail ?? ''} /></Field>
          <div className="flex gap-2">
            <Button type="submit" variant="filled" className="flex-1">{editing ? 'Salvar alterações' : 'Cadastrar secretaria'}</Button>
            {editing ? (
              <Button type="button" variant="text" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
            ) : null}
          </div>
        </form>
      </FormSection>
      <FormSection title="Registros">
        <RecordList empty="Nenhuma secretaria cadastrada.">
          {secretarias.map((secretaria) => (
            <RecordItem
              key={secretaria.id}
              title={`${secretaria.sigla} — ${secretaria.nome}`}
              subtitle={secretaria.responsavelNome ?? 'Sem responsável'}
              active={secretaria.ativo}
              actions={
                <div className="flex gap-2">
                  <Button variant="text" size="sm" onClick={() => setEditing(secretaria)}>
                    Editar
                  </Button>
                  {secretaria.ativo ? (
                    <Button variant="text" size="sm" className="text-red-700" onClick={() => void mutate(() => deleteAdminSecretaria(secretaria.id), 'Secretaria inativada.')}>
                      Inativar
                    </Button>
                  ) : null}
                </div>
              }
            />
          ))}
        </RecordList>
      </FormSection>
    </FormGrid>
    </div>
  );
}

function UnidadesPanel({ secretarias, unidades, mutate }: { secretarias: AdminSecretaria[]; unidades: AdminUnidade[]; mutate: (action: () => Promise<unknown>, message: string) => Promise<boolean> }) {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<AdminUnidade | null>(null);

  const filteredUnidades = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return unidades;

    return unidades.filter((unidade) =>
      [
        unidade.nome,
        unidade.codigoPatrimonial,
        unidade.endereco,
        unidade.bairro,
        unidade.secretaria.sigla,
        unidade.secretaria.nome,
        formatUnidadeTipo(unidade.tipo),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [search, unidades]);

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
      <Field label="Buscar próprio" hint="Nome, código patrimonial, endereço, bairro ou secretaria.">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--ink-3)]" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Ex.: PMF-ESC, Cidade Nova, UBS..."
            className="pl-9"
          />
        </div>
      </Field>

      <FormGrid>
        <FormSection title="Novo próprio">
          <form onSubmit={submitCreate} className="space-y-4">
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
                {tipos.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {formatUnidadeTipo(tipo)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Endereço"><Input name="endereco" required /></Field>
            <Field label="Bairro"><Input name="bairro" /></Field>
            <Field label="CEP"><Input name="cep" /></Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Latitude"><Input name="latitude" type="number" step="0.000001" required /></Field>
              <Field label="Longitude"><Input name="longitude" type="number" step="0.000001" required /></Field>
              <Field label="Raio (m)"><Input name="raioValidacaoMetros" type="number" defaultValue="200" /></Field>
            </div>
            <Button type="submit" variant="filled" className="w-full">Cadastrar próprio</Button>
          </form>
        </FormSection>

        <FormSection title={`Registros (${filteredUnidades.length})`}>
          <div className="max-h-[min(480px,55vh)] overflow-y-auto overscroll-contain pr-1">
            <RecordList empty={search.trim() ? 'Nenhum próprio encontrado para a busca.' : 'Nenhum próprio cadastrado.'}>
              {filteredUnidades.map((unidade) => (
                <RecordItem
                  key={unidade.id}
                  title={unidade.nome}
                  subtitle={`${unidade.codigoPatrimonial} · ${unidade.secretaria.sigla} · ${formatUnidadeTipo(unidade.tipo)} · ${unidade.bairro ?? 'sem bairro'}`}
                  active={unidade.ativo}
                  actions={
                    <div className="flex items-center gap-2">
                      <Badge variant={isQgisImported(unidade) ? 'info' : 'muted'}>
                        {formatUnidadeOrigem(unidade)}
                      </Badge>
                      <Button variant="text" size="sm" onClick={() => setEditing(unidade)}>
                        Editar
                      </Button>
                      {unidade.ativo ? (
                        <Button variant="text" size="sm" className="text-red-700" onClick={() => mutate(() => deleteAdminUnidade(unidade.id), 'Próprio inativado.')}>
                          Inativar
                        </Button>
                      ) : null}
                    </div>
                  }
                />
              ))}
            </RecordList>
          </div>
        </FormSection>
      </FormGrid>

      <div className="overflow-hidden rounded-[var(--r-md)] border border-[var(--line)]">
        <div className="max-h-[min(320px,40vh)] overflow-auto">
          <DataTable>
            <DataTableHead>
              <DataTableHeaderCell>Código</DataTableHeaderCell>
              <DataTableHeaderCell>Unidade</DataTableHeaderCell>
              <DataTableHeaderCell>Origem</DataTableHeaderCell>
              <DataTableHeaderCell>Tipo</DataTableHeaderCell>
              <DataTableHeaderCell>Secretaria</DataTableHeaderCell>
              <DataTableHeaderCell>Status</DataTableHeaderCell>
            </DataTableHead>
            <DataTableBody>
              {filteredUnidades.map((unidade) => (
                <DataTableRow key={unidade.id}>
                  <DataTableCell mono>{unidade.codigoPatrimonial}</DataTableCell>
                  <DataTableCell>{unidade.nome}</DataTableCell>
                  <DataTableCell>
                    <Badge variant={isQgisImported(unidade) ? 'info' : 'muted'}>
                      {formatUnidadeOrigem(unidade)}
                    </Badge>
                  </DataTableCell>
                  <DataTableCell>{formatUnidadeTipo(unidade.tipo)}</DataTableCell>
                  <DataTableCell mono>{unidade.secretaria.sigla}</DataTableCell>
                  <DataTableCell>
                    <Badge variant={unidade.ativo ? 'success' : 'muted'}>{unidade.ativo ? 'Ativo' : 'Inativo'}</Badge>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </div>
        {filteredUnidades.length === 0 ? (
          <p className="border-t border-[var(--line)] px-4 py-6 text-center text-[12px] text-[var(--ink-3)]">
            Nenhum registro para exibir.
          </p>
        ) : null}
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
                {tipos.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {formatUnidadeTipo(tipo)}
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
) {
  const senha = String(form.get('senha') || '').trim();
  const payload: Record<string, unknown> = {
    secretariaId: String(form.get('secretariaId') || ''),
    nome: String(form.get('nome')),
    email: String(form.get('email')),
    cpf: String(form.get('cpf') || ''),
    telefone: String(form.get('telefone') || ''),
    cargo: String(form.get('cargo') || ''),
    perfilIds: [String(form.get('perfilId') || defaultPerfil)].filter(Boolean),
    equipeIds,
    ativo,
  };

  if (editingId) {
    if (senha) {
      payload.senha = senha;
    }
  } else {
    if (!senha || senha.length < 12) {
      throw new Error('Informe uma senha inicial com pelo menos 12 caracteres.');
    }
    payload.senha = senha;
  }

  return payload;
}

function usuarioPayloadFromRecord(usuario: AdminUsuario, ativo: boolean) {
  return {
    secretariaId: usuario.secretariaId ?? '',
    nome: usuario.nome,
    email: usuario.email,
    cpf: usuario.cpf ?? '',
    telefone: usuario.telefone ?? '',
    cargo: usuario.cargo ?? '',
    perfilIds: usuario.perfis.map((item) => item.perfil.id),
    equipeIds: usuario.equipes?.map((item) => item.equipe.id) ?? [],
    ativo,
  };
}

function equipePayloadFromForm(form: FormData, usuarioIds: string[], ativo: boolean) {
  return {
    secretariaId: String(form.get('secretariaId') || ''),
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
  mutate,
}: {
  secretarias: AdminSecretaria[];
  usuarios: AdminUsuario[];
  equipes: AdminEquipe[];
  perfis: AdminPerfil[];
  mutate: (action: () => Promise<unknown>, message: string) => Promise<boolean>;
}) {
  const defaultPerfil = useMemo(() => perfis[0]?.id ?? '', [perfis]);
  const [editing, setEditing] = useState<AdminUsuario | null>(null);
  const [selectedEquipeIds, setSelectedEquipeIds] = useState<string[]>([]);

  useEffect(() => {
    setSelectedEquipeIds(editing?.equipes?.map((item) => item.equipe.id) ?? []);
  }, [editing?.id, editing?.equipes]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const isEdit = Boolean(editing);
    const ok = await mutate(
      () => {
        const payload = usuarioPayloadFromForm(form, defaultPerfil, editing?.ativo ?? true, selectedEquipeIds, editing?.id);
        return saveAdminUsuario(payload, editing?.id);
      },
      isEdit ? 'Usuário atualizado.' : 'Usuário cadastrado.',
    );
    if (ok) {
      setEditing(null);
      setSelectedEquipeIds([]);
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

  const editingPerfilId = editing?.perfis[0]?.perfil.id ?? defaultPerfil;

  return (
    <div className="space-y-6">
      <DataTable>
        <DataTableHead>
          <DataTableHeaderCell>Usuário</DataTableHeaderCell>
          <DataTableHeaderCell>Perfil</DataTableHeaderCell>
          <DataTableHeaderCell>Equipes</DataTableHeaderCell>
          <DataTableHeaderCell>Secretaria</DataTableHeaderCell>
          <DataTableHeaderCell>Status</DataTableHeaderCell>
        </DataTableHead>
        <DataTableBody>
          {usuarios.map((usuario) => (
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
            </DataTableRow>
          ))}
        </DataTableBody>
      </DataTable>

      <FormGrid>
      <FormSection title={editing ? 'Editar usuário' : 'Novo usuário'}>
        <form key={editing?.id ?? 'new'} onSubmit={submit} className="space-y-4">
          <Field label="Nome">
            <Input name="nome" required defaultValue={editing?.nome} />
          </Field>
          <Field label="E-mail">
            <Input name="email" type="email" required defaultValue={editing?.email} />
          </Field>
          <Field label="CPF">
            <Input name="cpf" defaultValue={editing?.cpf ?? ''} />
          </Field>
          <Field label="Telefone">
            <Input name="telefone" defaultValue={editing?.telefone ?? ''} />
          </Field>
          <Field label="Cargo">
            <Input name="cargo" defaultValue={editing?.cargo ?? ''} />
          </Field>
          <Field label={editing ? 'Nova senha (opcional)' : 'Senha inicial (mín. 12 caracteres)'}>
            <Input
              name="senha"
              type="password"
              autoComplete="new-password"
              minLength={editing ? undefined : 12}
              required={!editing}
              placeholder={editing ? 'Deixe em branco para manter a atual' : 'Defina uma senha forte'}
            />
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
          <Field label="Perfil">
            <Select name="perfilId" required defaultValue={editingPerfilId}>
              {perfis.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </Select>
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
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" variant="filled" className="w-full sm:flex-1">
              {editing ? 'Salvar alterações' : 'Cadastrar usuário'}
            </Button>
            {editing ? (
              <Button type="button" variant="outlined" className="w-full sm:flex-1" onClick={() => setEditing(null)}>
                Cancelar edição
              </Button>
            ) : null}
          </div>
        </form>
      </FormSection>
      <FormSection title="Registros">
        <p className="mb-4 text-[12px] text-[var(--ink-3)]">
          O sistema não remove usuários do banco: inativar impede o login; use Reativar para restaurar o acesso.
        </p>
        <RecordList empty="Nenhum usuário cadastrado.">
          {usuarios.map((usuario) => (
            <RecordItem
              key={usuario.id}
              title={usuario.nome}
              subtitle={`${usuario.email} · ${usuario.perfis.map((p) => p.perfil.nome).join(', ') || 'sem perfil'}${usuario.equipes?.length ? ` · ${usuario.equipes.map((e) => e.equipe.nome).join(', ')}` : ''}`}
              active={usuario.ativo}
              actions={
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
              }
            />
          ))}
        </RecordList>
      </FormSection>
    </FormGrid>
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

  useEffect(() => {
    setSelectedUsuarioIds(editing?.membros.map((item) => item.usuario.id) ?? []);
  }, [editing?.id, editing?.membros]);

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
      <DataTable>
        <DataTableHead>
          <DataTableHeaderCell>Equipe</DataTableHeaderCell>
          <DataTableHeaderCell>Secretaria</DataTableHeaderCell>
          <DataTableHeaderCell>Membros</DataTableHeaderCell>
          <DataTableHeaderCell>Chamados</DataTableHeaderCell>
          <DataTableHeaderCell>Status</DataTableHeaderCell>
        </DataTableHead>
        <DataTableBody>
          {equipes.map((equipe) => (
            <DataTableRow key={equipe.id}>
              <DataTableCell>
                <div>
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
            </DataTableRow>
          ))}
        </DataTableBody>
      </DataTable>

      <FormGrid>
        <FormSection title={editing ? 'Editar equipe' : 'Nova equipe'}>
          <form key={editing?.id ?? 'new-equipe'} onSubmit={submit} className="space-y-4">
            <Field label="Nome">
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
              <Button type="submit" variant="filled" className="w-full sm:flex-1">
                {editing ? 'Salvar alterações' : 'Cadastrar equipe'}
              </Button>
              {editing ? (
                <Button type="button" variant="outlined" className="w-full sm:flex-1" onClick={() => setEditing(null)}>
                  Cancelar edição
                </Button>
              ) : null}
            </div>
          </form>
        </FormSection>
        <FormSection title="Registros">
          <RecordList empty="Nenhuma equipe cadastrada.">
            {equipes.map((equipe) => (
              <RecordItem
                key={equipe.id}
                title={equipe.nome}
                subtitle={`${equipe.membros.length} membro(s) · ${equipe.secretaria?.sigla ?? 'sem secretaria'}`}
                active={equipe.ativo}
                actions={
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
                }
              />
            ))}
          </RecordList>
        </FormSection>
      </FormGrid>
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
      <DataTable>
        <DataTableHead>
          <DataTableHeaderCell>Nome</DataTableHeaderCell>
          <DataTableHeaderCell>SLA Baixa/Média/Alta</DataTableHeaderCell>
          <DataTableHeaderCell>Vist. prévia</DataTableHeaderCell>
          <DataTableHeaderCell>Status</DataTableHeaderCell>
        </DataTableHead>
        <DataTableBody>
          {tipos.map((tipo) => (
            <DataTableRow key={tipo.id}>
              <DataTableCell>{tipo.nome}</DataTableCell>
              <DataTableCell mono>{tipo.slaBaixaDias}/{tipo.slaMediaDias}/{tipo.slaAltaDias}d</DataTableCell>
              <DataTableCell>{tipo.exigeVistoriaPrevia ? 'Sim' : 'Não'}</DataTableCell>
              <DataTableCell>
                <Badge variant={tipo.ativo ? 'success' : 'muted'}>{tipo.ativo ? 'Ativo' : 'Inativo'}</Badge>
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTableBody>
      </DataTable>

      <FormGrid>
        <FormSection title={editing ? 'Editar tipo de chamado' : 'Novo tipo de chamado'}>
          <form key={editing?.id ?? 'new-tipo'} onSubmit={submit} className="space-y-4">
            <Field label="Nome"><Input name="nome" required defaultValue={editing?.nome} /></Field>
            <Field label="Descrição"><Input name="descricao" defaultValue={editing?.descricao ?? ''} /></Field>
            <div className="grid grid-cols-2 gap-3">
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
              Exige vistoria prévia
            </label>
            <div className="flex gap-2">
              <Button type="submit" variant="filled" className="flex-1">{editing ? 'Salvar' : 'Cadastrar'}</Button>
              {editing ? (
                <Button type="button" variant="text" onClick={() => setEditing(null)}>Cancelar</Button>
              ) : null}
            </div>
          </form>
        </FormSection>
        <FormSection title="Registros">
          <RecordList empty="Nenhum tipo cadastrado.">
            {tipos.map((tipo) => (
              <RecordItem
                key={tipo.id}
                title={tipo.nome}
                subtitle={tipo.descricao ?? 'Sem descrição'}
                active={tipo.ativo}
                actions={
                  <div className="flex gap-2">
                    <Button variant="text" size="sm" onClick={() => setEditing(tipo)}>Editar</Button>
                    <Button variant="text" size="sm" className="text-red-700" onClick={() => void mutate(() => deleteAdminTipoChamado(tipo.id), 'Tipo excluído.')}>
                      Excluir
                    </Button>
                  </div>
                }
              />
            ))}
          </RecordList>
        </FormSection>
      </FormGrid>
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
