'use client';

import { FormEvent, Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { KeyRound } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { resetPasswordWithToken } from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PageSkeleton } from '@/components/ui/skeleton';

export default function RedefinirSenhaPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RedefinirSenhaContent />
    </Suspense>
  );
}

function RedefinirSenhaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!token) {
      setError('Token ausente. Solicite um novo link de recuperação.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('A confirmação da senha não confere.');
      return;
    }

    setLoading(true);
    try {
      await resetPasswordWithToken(token, newPassword);
      router.replace('/login?reason=password-reset');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao redefinir senha.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="gestop-shell flex min-h-dvh items-center justify-center px-4 py-8">
      <Card elevation={2} className="w-full max-w-md">
        <CardHeader>
          <Logo variant="full" className="mx-auto h-12 max-w-[220px]" />
          <CardTitle className="mt-4 flex items-center gap-2 md-headline-md">
            <KeyRound className="h-5 w-5 text-[var(--color-brand-primary)]" />
            Redefinir senha
          </CardTitle>
          <CardDescription>Escolha uma senha forte com pelo menos 12 caracteres.</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? <Alert variant="error" className="mb-4">{error}</Alert> : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Nova senha">
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={12} required />
            </Field>
            <Field label="Confirmar senha">
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={12} required />
            </Field>
            <Button type="submit" variant="filled" className="w-full" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar nova senha'}
            </Button>
          </form>

          <p className="md-body-md mt-6 text-center">
            <Link href="/recuperar-senha" className="text-[var(--color-brand-primary)] hover:underline">
              Solicitar novo link
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
