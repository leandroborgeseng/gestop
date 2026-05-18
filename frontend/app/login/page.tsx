'use client';

import { FormEvent, Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LockKeyhole } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { login } from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Surface } from '@/components/ui/surface';

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
      <div className="w-full max-w-md">
        <PageSkeleton />
      </div>
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
      return { variant: 'warning' as const, text: 'Sua sessão expirou ou é necessária para acessar esta área.' };
    }
    if (reason === 'logout') {
      return { variant: 'success' as const, text: 'Você saiu do sistema com segurança.' };
    }
    if (reason === 'denied') {
      return { variant: 'error' as const, text: 'Seu perfil não tem permissão para acessar essa área.' };
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
    <main className="gestop-shell flex min-h-dvh flex-col justify-center px-4 py-8 sm:px-6">
      <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <Surface
          elevation={3}
          tone="default"
          className="gestop-brand-panel hidden border-0 p-8 text-white lg:block"
        >
          <Logo theme="light" variant="compact" priority />
          <Chip variant="accent" className="mt-3 bg-white/15 text-white">
            GestOP
          </Chip>
          <p className="md-body-lg mt-6 max-w-md text-white/85">
            Plataforma de gestão de ordens de serviço e fiscalização georreferenciada da Prefeitura de Franca.
          </p>
          <Surface tone="high" elevation={0} className="mt-8 border-white/15 bg-white/10 p-5 text-white backdrop-blur-sm">
            <strong className="md-title-md block">Acesso demo</strong>
            <p className="md-body-md mt-2">
              admin.gestop@franca.sp.gov.br
              <br />
              Senha: Gestop@123
            </p>
          </Surface>
        </Surface>

        <Card elevation={2} className="w-full">
          <CardHeader>
            <div className="mb-4 lg:hidden">
              <Logo variant="compact" priority />
              <p className="md-label-md mt-2 text-[var(--color-brand-primary)]">GestOP</p>
            </div>
            <Chip variant="brand" className="mb-3 w-fit gap-1.5">
              <LockKeyhole className="h-3.5 w-3.5" />
              Acesso restrito
            </Chip>
            <CardTitle className="md-headline-md">Entrar no sistema</CardTitle>
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

              <Button type="submit" variant="filled" size="lg" className="w-full" disabled={loading}>
                {loading ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
