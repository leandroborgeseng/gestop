'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Building2, MapPin, UserRound } from 'lucide-react';
import { AuthGate } from '@/components/auth-gate';
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
      <main className="gestop-shell p-4 md:p-6">
        <div className="mx-auto max-w-7xl">
          <Link
            href="/cco"
            className="mb-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para CCO
          </Link>

          <header className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Administração Base</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">Cadastros estruturais do GestOP</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Mantenha secretarias, próprios públicos e usuários. As alterações são registradas na trilha de auditoria.
            </p>
          </header>

          {error ? <div className="mb-4"><ErrorState message={error} /></div> : null}
          {success ? (
            <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">
              {success}
            </div>
          ) : null}

          <div className="mb-6 flex flex-wrap gap-2">
            <TabButton active={tab === 'secretarias'} onClick={() => setTab('secretarias')} icon={Building2}>
              Secretarias
            </TabButton>
            <TabButton active={tab === 'unidades'} onClick={() => setTab('unidades')} icon={MapPin}>
              Próprios públicos
            </TabButton>
            <TabButton active={tab === 'usuarios'} onClick={() => setTab('usuarios')} icon={UserRound}>
              Usuários
            </TabButton>
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
        </div>
      </main>
    </AuthGate>
  );
}

function TabButton({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof Building2; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold ${
        active ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
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
    <AdminGrid
      form={
        <form onSubmit={submit} className="space-y-3">
          <Input name="nome" label="Nome" required />
          <Input name="sigla" label="Sigla" required />
          <Input name="responsavelNome" label="Responsável" />
          <Input name="responsavelEmail" label="E-mail do responsável" type="email" />
          <SubmitButton>Cadastrar secretaria</SubmitButton>
        </form>
      }
      list={secretarias.map((secretaria) => (
        <Row key={secretaria.id} title={`${secretaria.sigla} - ${secretaria.nome}`} subtitle={secretaria.responsavelNome ?? 'Sem responsável'} active={secretaria.ativo}>
          <button onClick={() => mutate(() => deleteAdminSecretaria(secretaria.id), 'Secretaria inativada.')} className="text-sm font-semibold text-red-700">Inativar</button>
        </Row>
      ))}
    />
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
    <AdminGrid
      form={
        <form onSubmit={submit} className="space-y-3">
          <Select name="secretariaId" label="Secretaria" options={secretarias.map((s) => [s.id, `${s.sigla} - ${s.nome}`])} required />
          <Input name="codigoPatrimonial" label="Código patrimonial" required />
          <Input name="nome" label="Nome do próprio" required />
          <Select name="tipo" label="Tipo" options={tipos.map((tipo) => [tipo, tipo])} required />
          <Input name="endereco" label="Endereço" required />
          <Input name="bairro" label="Bairro" />
          <Input name="cep" label="CEP" />
          <div className="grid gap-3 md:grid-cols-3">
            <Input name="latitude" label="Latitude" type="number" step="0.000001" required />
            <Input name="longitude" label="Longitude" type="number" step="0.000001" required />
            <Input name="raioValidacaoMetros" label="Raio (m)" type="number" defaultValue="200" />
          </div>
          <SubmitButton>Cadastrar próprio</SubmitButton>
        </form>
      }
      list={unidades.map((unidade) => (
        <Row key={unidade.id} title={unidade.nome} subtitle={`${unidade.codigoPatrimonial} · ${unidade.secretaria.sigla} · ${unidade.bairro ?? 'sem bairro'}`} active={unidade.ativo}>
          <button onClick={() => mutate(() => deleteAdminUnidade(unidade.id), 'Próprio público inativado.')} className="text-sm font-semibold text-red-700">Inativar</button>
        </Row>
      ))}
    />
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
    <AdminGrid
      form={
        <form onSubmit={submit} className="space-y-3">
          <Input name="nome" label="Nome" required />
          <Input name="email" label="E-mail" type="email" required />
          <Input name="cpf" label="CPF" />
          <Input name="telefone" label="Telefone" />
          <Input name="cargo" label="Cargo" />
          <Input name="senha" label="Senha inicial" defaultValue="Gestop@123" />
          <Select name="secretariaId" label="Secretaria" options={[['', 'Sem secretaria'], ...secretarias.map((s) => [s.id, `${s.sigla} - ${s.nome}`])]} />
          <Select name="perfilId" label="Perfil" options={perfis.map((p) => [p.id, p.nome])} required />
          <SubmitButton>Cadastrar usuário</SubmitButton>
        </form>
      }
      list={usuarios.map((usuario) => (
        <Row key={usuario.id} title={usuario.nome} subtitle={`${usuario.email} · ${usuario.perfis.map((p) => p.perfil.nome).join(', ') || 'sem perfil'}`} active={usuario.ativo}>
          <button onClick={() => mutate(() => deleteAdminUsuario(usuario.id), 'Usuário inativado.')} className="text-sm font-semibold text-red-700">Inativar</button>
        </Row>
      ))}
    />
  );
}

function AdminGrid({ form, list }: { form: React.ReactNode; list: React.ReactNode[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-slate-950">Novo cadastro</h2>
        {form}
      </section>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-slate-950">Registros</h2>
        <div className="space-y-3">{list.length ? list : <p className="text-sm text-slate-600">Nenhum registro.</p>}</div>
      </section>
    </div>
  );
}

function Row({ title, subtitle, active, children }: { title: string; subtitle: string; active: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4">
      <div>
        <p className="font-semibold text-slate-950">{title}</p>
        <p className="text-sm text-slate-600">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {active ? 'Ativo' : 'Inativo'}
        </span>
        {children}
      </div>
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...inputProps } = props;
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">
      {label}
      <input {...inputProps} className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
    </label>
  );
}

function Select({ label, options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: string[][] }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">
      {label}
      <select {...props} className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

function SubmitButton({ children }: { children: React.ReactNode }) {
  return (
    <button type="submit" className="min-h-11 w-full rounded-xl bg-blue-700 px-4 font-bold text-white hover:bg-blue-800">
      {children}
    </button>
  );
}
