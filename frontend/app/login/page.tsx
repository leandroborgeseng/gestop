'use client';

import { FormEvent, Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { LockKeyhole } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { SIGMA_NAME, SIGMA_TAGLINE } from '@/lib/brand';
import { login } from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PageSkeleton } from '@/components/ui/skeleton';

const showDemoLogin = process.env.NEXT_PUBLIC_SHOW_DEMO_LOGIN === 'true';

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginContent />
    </Suspense>
  );
}

function LoginSkeleton() {
  return (
    <main className="sigma-shell flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-md">
        <PageSkeleton />
      </div>
    </main>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(showDemoLogin ? 'admin.gestop@franca.sp.gov.br' : '');
  const [password, setPassword] = useState(showDemoLogin ? 'Gestop@123' : '');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const notice = useMemo(() => {
    const reason = searchParams.get('reason');

    if (reason === 'expired') {
      return { variant: 'warning' as const, text: 'Sua sessão expirou ou é necessária para acessar esta área.' };
    }
    if (reason === 'logout') {
      return { variant: 'success' as const, text: 'Você saiu do sistema com segurança.' };
    }
    if (reason === 'denied') {
      return { variant: 'error' as const, text: 'Seu perfil não tem permissão para acessar essa área.' };
    }
    if (reason === 'password-reset') {
      return { variant: 'success' as const, text: 'Senha redefinida com sucesso. Faça login com a nova senha.' };
    }
    return null;
  }, [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await login(email, password, remember);
      router.replace('/cco');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha inesperada no login.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="sigma-shell flex min-h-dvh flex-col justify-center px-4 py-8 sm:px-6">
      <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <section className="sigma-brand-panel hidden rounded-[var(--r-card)] p-10 text-white lg:block">
          <div className="space-y-5">
            <Logo theme="light" variant="full" priority className="h-20 max-w-[320px]" />
            <Chip variant="accent" className="bg-white/15 text-white">
              {SIGMA_NAME}
            </Chip>
          </div>
          <p className="mt-8 max-w-md text-[15px] leading-relaxed text-white/85">
            {SIGMA_TAGLINE} — Prefeitura de Franca.
          </p>
          {showDemoLogin ? (
            <div className="mt-8 rounded-[var(--r-md)] border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
              <strong className="block text-sm font-semibold">Ambiente de demonstração</strong>
              <p className="mt-2 text-sm text-white/85">Use as credenciais de desenvolvimento configuradas localmente.</p>
            </div>
          ) : null}
        </section>

        <Card elevation={2} className="w-full">
          <CardHeader>
            <div className="mb-6 flex flex-col items-center gap-2 text-center lg:hidden">
              <Logo variant="full" priority className="h-14 max-w-[260px]" />
              <p className="page-kicker">{SIGMA_NAME}</p>
            </div>
            <Chip variant="brand" className="mb-3 w-fit gap-1.5">
              <LockKeyhole className="h-3.5 w-3.5" />
              Acesso restrito
            </Chip>
            <CardTitle className="page-title text-[var(--ink)]">Entrar no sistema</CardTitle>
            <CardDescription>Use seu usuário institucional para acessar a CCO.</CardDescription>
          </CardHeader>

          <CardContent>
            {notice ? <Alert variant={notice.variant} className="mb-4">{notice.text}</Alert> : null}
            {error ? <Alert variant="error" className="mb-4">{error}</Alert> : null}

            <form onSubmit={handleSubmit} className="space-y-5">
              <Field label="E-mail">
                <Input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="seu.email@franca.sp.gov.br"
                  required
                />
              </Field>

              <Field label="Senha">
                <Input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  autoComplete="current-password"
                  minLength={6}
                  maxLength={128}
                  required
                />
              </Field>

              <label className="flex items-center gap-2 text-[13px] text-[var(--ink-2)]">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                  className="h-4 w-4 rounded border-[var(--line)]"
                />
                Manter conectado neste dispositivo (30 dias)
              </label>

              <Button type="submit" variant="filled" size="lg" className="w-full" disabled={loading}>
                {loading ? 'Entrando...' : 'Entrar'}
              </Button>

              <p className="text-center text-sm">
                <Link href="/recuperar-senha" className="font-semibold text-[var(--brand)] hover:underline">
                  Esqueci minha senha
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
