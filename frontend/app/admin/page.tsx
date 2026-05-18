'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Building2, MapPin, UserRound } from 'lucide-react';
import { AuthGate } from '@/components/auth-gate';
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
  deleteAdminUsuario,
  listAdminPerfis,
  listAdminSecretarias,
  listAdminUnidades,
  listAdminUsuarios,
  saveAdminSecretaria,
  saveAdminUnidade,
  saveAdminUsuario,
} from '@/lib/api';
import { AdminPerfil, AdminSecretaria, AdminUnidade, AdminUsuario, UnidadeTipo } from '@/lib/types';

type Tab = 'secretarias' | 'unidades' | 'usuarios';

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
    <AuthGate requiredPermissions={['secretarias.gerenciar']}>
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
      </PageShell>
    </AuthGate>
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

function UsuariosPanel({ secretarias, usuarios, perfis, mutate }: { secretarias: AdminSecretaria[]; usuarios: AdminUsuario[]; perfis: AdminPerfil[]; mutate: (action: () => Promise<unknown>, message: string) => Promise<void> }) {
  const defaultPerfil = useMemo(() => perfis[0]?.id ?? '', [perfis]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate(
      () =>
        saveAdminUsuario({
          secretariaId: String(form.get('secretariaId') || ''),
          nome: String(form.get('nome')),
          email: String(form.get('email')),
          cpf: String(form.get('cpf') || ''),
          telefone: String(form.get('telefone') || ''),
          cargo: String(form.get('cargo') || ''),
          senha: String(form.get('senha') || 'Gestop@123'),
          perfilIds: [String(form.get('perfilId') || defaultPerfil)].filter(Boolean),
          ativo: true,
        }),
      'Usuário cadastrado.',
    );
    event.currentTarget.reset();
  }

  return (
    <FormGrid>
      <FormSection title="Novo usuário">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nome"><Input name="nome" required /></Field>
          <Field label="E-mail"><Input name="email" type="email" required /></Field>
          <Field label="CPF"><Input name="cpf" /></Field>
          <Field label="Telefone"><Input name="telefone" /></Field>
          <Field label="Cargo"><Input name="cargo" /></Field>
          <Field label="Senha inicial"><Input name="senha" defaultValue="Gestop@123" /></Field>
          <Field label="Secretaria">
            <Select name="secretariaId">
              <option value="">Sem secretaria</option>
              {secretarias.map((s) => <option key={s.id} value={s.id}>{s.sigla} — {s.nome}</option>)}
            </Select>
          </Field>
          <Field label="Perfil">
            <Select name="perfilId" required>
              {perfis.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </Select>
          </Field>
          <Button type="submit" variant="filled" className="w-full">Cadastrar usuário</Button>
        </form>
      </FormSection>
      <FormSection title="Registros">
        <RecordList empty="Nenhum usuário cadastrado.">
          {usuarios.map((usuario) => (
            <RecordItem
              key={usuario.id}
              title={usuario.nome}
              subtitle={`${usuario.email} · ${usuario.perfis.map((p) => p.perfil.nome).join(', ') || 'sem perfil'}`}
              active={usuario.ativo}
              actions={
                <Button variant="text" size="sm" className="text-red-700" onClick={() => mutate(() => deleteAdminUsuario(usuario.id), 'Usuário inativado.')}>
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
