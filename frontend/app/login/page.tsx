'use client';

import { FormEvent, Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { login } from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginContent />
    </Suspense>
  );
}

function LoginSkeleton() {
  return (
    <main className="gestop-shell flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 p-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    </main>
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
      return {
        variant: 'warning' as const,
        text: 'Sua sessão expirou ou é necessária para acessar esta área.',
      };
    }

    if (reason === 'logout') {
      return {
        variant: 'success' as const,
        text: 'Você saiu do sistema com segurança.',
      };
    }

    if (reason === 'denied') {
      return {
        variant: 'error' as const,
        text: 'Seu perfil não tem permissão para acessar essa área.',
      };
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
    <main className="gestop-shell flex min-h-dvh flex-col justify-center px-4 py-8 md:px-6">
      <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <section className="hidden rounded-[28px] bg-gradient-to-br from-zinc-950 via-zinc-900 to-blue-950 p-8 text-white shadow-2xl lg:block">
          <div className="inline-flex rounded-2xl bg-white/10 p-3 backdrop-blur">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight">GestOP</h1>
          <p className="mt-4 max-w-md text-sm leading-7 text-zinc-300">
            Plataforma premium de gestão de ordens de serviço e fiscalização georreferenciada da Prefeitura de
            Franca.
          </p>
          <div className="mt-8 rounded-[24px] border border-white/10 bg-white/5 p-5 text-sm text-zinc-300">
            <strong className="block text-white">Acesso demo</strong>
            <p className="mt-2 leading-6">
              admin.gestop@franca.sp.gov.br
              <br />
              Senha: Gestop@123
            </p>
          </div>
        </section>

        <Card className="border-zinc-200/80 shadow-[var(--gestop-shadow)]">
          <CardHeader>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
              <LockKeyhole className="h-3.5 w-3.5" />
              Acesso restrito
            </div>
            <CardTitle className="text-2xl">Entrar no sistema</CardTitle>
            <CardDescription>Use seu usuário institucional para acessar a CCO.</CardDescription>
          </CardHeader>

          <CardContent>
            {notice ? <Alert variant={notice.variant} className="mb-4">{notice.text}</Alert> : null}
            {error ? <Alert variant="error" className="mb-4">{error}</Alert> : null}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Field label="E-mail">
                <Input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                />
              </Field>

              <Field label="Senha">
                <Input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </Field>

              <Button type="submit" variant="brand" size="lg" className="w-full" disabled={loading}>
                {loading ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
