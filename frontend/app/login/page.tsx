'use client';

import { FormEvent, Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { login } from '@/lib/api';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('admin.gestop@franca.sp.gov.br');
  const [password, setPassword] = useState('Gestop@123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const notice = useMemo(() => {
    const reason = searchParams.get('reason');

    if (reason === 'expired') {
      return 'Sua sessão expirou ou é necessária para acessar esta área.';
    }

    if (reason === 'logout') {
      return 'Você saiu do sistema com segurança.';
    }

    if (reason === 'denied') {
      return 'Seu perfil não tem permissão para acessar essa área.';
    }

    return null;
  }, [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await login(email, password);
      router.replace('/cco');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha inesperada no login.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-xl md:grid-cols-[0.9fr_1.1fr]">
        <div className="bg-gradient-to-br from-blue-700 to-sky-600 p-8 text-white">
          <div className="inline-flex rounded-2xl bg-white/15 p-3">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="mt-6 text-3xl font-bold">GestOP</h1>
          <p className="mt-3 text-sm leading-6 text-blue-50">
            Plataforma de gestão de ordens de serviço e fiscalização georreferenciada da Prefeitura de Franca.
          </p>
          <div className="mt-8 rounded-2xl bg-white/10 p-4 text-sm text-blue-50">
            <strong className="block text-white">Usuários seed</strong>
            admin.gestop@franca.sp.gov.br
            <br />
            carla.mendes@franca.sp.gov.br
            <br />
            joao.pereira@franca.sp.gov.br
            <br />
            lucas.almeida@franca.sp.gov.br
            <br />
            <span className="mt-2 block">Senha: Gestop@123</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8">
          <div className="mb-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700">
              <LockKeyhole className="h-3.5 w-3.5" />
              Acesso restrito
            </span>
            <h2 className="mt-4 text-2xl font-bold text-slate-950">Entrar no sistema</h2>
            <p className="mt-2 text-sm text-slate-600">Use seu usuário institucional para acessar a CCO.</p>
          </div>

          {notice ? (
            <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              {notice}
            </div>
          ) : null}

          {error ? (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          <label className="mb-4 flex flex-col gap-1 text-sm font-semibold text-slate-700">
            E-mail
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              className="min-h-12 rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              required
            />
          </label>

          <label className="mb-6 flex flex-col gap-1 text-sm font-semibold text-slate-700">
            Senha
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              className="min-h-12 rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              required
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="min-h-12 w-full rounded-xl bg-blue-700 px-4 font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
}
