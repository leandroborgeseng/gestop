'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Building2, Download, MapPin, UserRound } from 'lucide-react';
import { RequirePermissions } from '@/components/auth/require-permissions';
import { ImportacaoPanel } from '@/components/admin/importacao-panel';
import { PageShell } from '@/components/layout/page-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { FormGrid, FormSection, RecordItem, RecordList } from '@/components/ui/form-section';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Tabs } from '@/components/ui/tabs';
import { ErrorState, LoadingState } from '@/components/ui-states';
import {
  deleteAdminSecretaria,
  deleteAdminUnidade,
  listAdminPerfis,
  listAdminSecretarias,
  listAdminUnidades,
  listAdminUsuarios,
  saveAdminSecretaria,
  saveAdminUnidade,
  saveAdminUsuario,
  anonymizeUsuarioLgpd,
  purgeAuditoriaLgpd,
} from '@/lib/api';
import { AdminPerfil, AdminSecretaria, AdminUnidade, AdminUsuario, UnidadeTipo } from '@/lib/types';

type Tab = 'secretarias' | 'unidades' | 'usuarios' | 'importacao';

const tipos: UnidadeTipo[] = ['ESCOLA', 'UBS', 'PRACA', 'PREDIO_ADMINISTRATIVO', 'ESPACO_ESPORTIVO', 'OUTRO'];

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('secretarias');
  const [secretarias, setSecretarias] = useState<AdminSecretaria[]>([]);
  const [unidades, setUnidades] = useState<AdminUnidade[]>([]);
  const [usuarios, setUsuarios] = useState<AdminUsuario[]>([]);
  const [perfis, setPerfis] = useState<AdminPerfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [nextSecretarias, nextUnidades, nextUsuarios, nextPerfis] = await Promise.all([
        listAdminSecretarias(),
        listAdminUnidades(),
        listAdminUsuarios(),
        listAdminPerfis(),
      ]);
      setSecretarias(nextSecretarias);
      setUnidades(nextUnidades);
      setUsuarios(nextUsuarios);
      setPerfis(nextPerfis);
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
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operação não concluída.');
    }
  }

  return (
    <RequirePermissions permissions={['usuarios.gerenciar']}>
      <PageShell
        kicker="Administração Base"
        icon={Building2}
        title="Cadastros estruturais do GestOP"
        description="Mantenha secretarias, próprios públicos e usuários. As alterações são registradas na trilha de auditoria."
        backHref="/cco"
      >
        {error ? <div className="mb-4"><ErrorState message={error} onRetry={() => void load()} /></div> : null}
        {success ? <Alert variant="success" className="mb-4">{success}</Alert> : null}

        <div className="mb-6">
          <Tabs
            value={tab}
            onChange={(value) => setTab(value as Tab)}
            items={[
              { id: 'secretarias', label: 'Secretarias', icon: <Building2 className="h-4 w-4" /> },
              { id: 'unidades', label: 'Próprios', icon: <MapPin className="h-4 w-4" /> },
              { id: 'usuarios', label: 'Usuários', icon: <UserRound className="h-4 w-4" /> },
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
          <UsuariosPanel secretarias={secretarias} usuarios={usuarios} perfis={perfis} mutate={mutate} />
        ) : null}
        {!loading && tab === 'importacao' ? (
          <ImportacaoPanel onSynced={() => void load()} />
        ) : null}

        {!loading && tab !== 'importacao' ? (
          <FormSection title="LGPD" className="mt-8">
            <p className="md-body-md mb-4 text-[var(--md-on-surface-variant)]">
              Anonimize usuários inativos e aplique retenção de logs de auditoria conforme política municipal.
            </p>
            <Button
              variant="tonal"
              onClick={() =>
                void mutate(async () => purgeAuditoriaLgpd(), 'Retenção de auditoria aplicada.')
              }
            >
              Aplicar retenção de auditoria
            </Button>
          </FormSection>
        ) : null}
      </PageShell>
    </RequirePermissions>
  );
}

function SecretariasPanel({ secretarias, mutate }: { secretarias: AdminSecretaria[]; mutate: (action: () => Promise<unknown>, message: string) => Promise<void> }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate(
      () =>
        saveAdminSecretaria({
          nome: String(form.get('nome')),
          sigla: String(form.get('sigla')),
          responsavelNome: String(form.get('responsavelNome') || ''),
          responsavelEmail: String(form.get('responsavelEmail') || ''),
          ativo: true,
        }),
      'Secretaria cadastrada.',
    );
    event.currentTarget.reset();
  }

  return (
    <FormGrid>
      <FormSection title="Nova secretaria">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nome"><Input name="nome" required /></Field>
          <Field label="Sigla"><Input name="sigla" required /></Field>
          <Field label="Responsável"><Input name="responsavelNome" /></Field>
          <Field label="E-mail do responsável"><Input name="responsavelEmail" type="email" /></Field>
          <Button type="submit" variant="filled" className="w-full">Cadastrar secretaria</Button>
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
                <Button variant="text" size="sm" className="text-red-700" onClick={() => mutate(() => deleteAdminSecretaria(secretaria.id), 'Secretaria inativada.')}>
                  Inativar
                </Button>
              }
            />
          ))}
        </RecordList>
      </FormSection>
    </FormGrid>
  );
}

function UnidadesPanel({ secretarias, unidades, mutate }: { secretarias: AdminSecretaria[]; unidades: AdminUnidade[]; mutate: (action: () => Promise<unknown>, message: string) => Promise<void> }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate(
      () =>
        saveAdminUnidade({
          secretariaId: String(form.get('secretariaId')),
          codigoPatrimonial: String(form.get('codigoPatrimonial')),
          nome: String(form.get('nome')),
          tipo: String(form.get('tipo')),
          endereco: String(form.get('endereco')),
          bairro: String(form.get('bairro') || ''),
          cep: String(form.get('cep') || ''),
          latitude: Number(form.get('latitude')),
          longitude: Number(form.get('longitude')),
          raioValidacaoMetros: Number(form.get('raioValidacaoMetros') || 200),
          ativo: true,
        }),
      'Próprio público cadastrado.',
    );
    event.currentTarget.reset();
  }

  return (
    <FormGrid>
      <FormSection title="Novo próprio">
        <form onSubmit={submit} className="space-y-4">
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
              {tipos.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
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
      <FormSection title="Registros">
        <RecordList empty="Nenhum próprio cadastrado.">
          {unidades.map((unidade) => (
            <RecordItem
              key={unidade.id}
              title={unidade.nome}
              subtitle={`${unidade.codigoPatrimonial} · ${unidade.secretaria.sigla} · ${unidade.bairro ?? 'sem bairro'}`}
              active={unidade.ativo}
              actions={
                <Button variant="text" size="sm" className="text-red-700" onClick={() => mutate(() => deleteAdminUnidade(unidade.id), 'Próprio inativado.')}>
                  Inativar
                </Button>
              }
            />
          ))}
        </RecordList>
      </FormSection>
    </FormGrid>
  );
}

function usuarioPayloadFromForm(form: FormData, defaultPerfil: string, ativo: boolean, editingId?: string) {
  const senha = String(form.get('senha') || '').trim();
  const payload: Record<string, unknown> = {
    secretariaId: String(form.get('secretariaId') || ''),
    nome: String(form.get('nome')),
    email: String(form.get('email')),
    cpf: String(form.get('cpf') || ''),
    telefone: String(form.get('telefone') || ''),
    cargo: String(form.get('cargo') || ''),
    perfilIds: [String(form.get('perfilId') || defaultPerfil)].filter(Boolean),
    ativo,
  };

  if (editingId) {
    if (senha) {
      payload.senha = senha;
    }
  } else {
    payload.senha = senha || 'Gestop@123';
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
    ativo,
  };
}

function UsuariosPanel({ secretarias, usuarios, perfis, mutate }: { secretarias: AdminSecretaria[]; usuarios: AdminUsuario[]; perfis: AdminPerfil[]; mutate: (action: () => Promise<unknown>, message: string) => Promise<void> }) {
  const defaultPerfil = useMemo(() => perfis[0]?.id ?? '', [perfis]);
  const [editing, setEditing] = useState<AdminUsuario | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const isEdit = Boolean(editing);
    await mutate(
      () =>
        saveAdminUsuario(
          usuarioPayloadFromForm(form, defaultPerfil, editing?.ativo ?? true, editing?.id),
          editing?.id,
        ),
      isEdit ? 'Usuário atualizado.' : 'Usuário cadastrado.',
    );
    setEditing(null);
    event.currentTarget.reset();
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
          <Field label={editing ? 'Nova senha (opcional)' : 'Senha inicial'}>
            <Input
              name="senha"
              type="password"
              autoComplete="new-password"
              placeholder={editing ? 'Deixe em branco para manter a atual' : undefined}
              defaultValue={editing ? '' : 'Gestop@123'}
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
        <p className="md-body-sm mb-4 text-[var(--md-on-surface-variant)]">
          O sistema não remove usuários do banco: inativar impede o login; use Reativar para restaurar o acesso.
        </p>
        <RecordList empty="Nenhum usuário cadastrado.">
          {usuarios.map((usuario) => (
            <RecordItem
              key={usuario.id}
              title={usuario.nome}
              subtitle={`${usuario.email} · ${usuario.perfis.map((p) => p.perfil.nome).join(', ') || 'sem perfil'}`}
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
  );
}
