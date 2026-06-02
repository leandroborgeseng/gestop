'use client';

import { FormEvent, Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { KeyRound } from 'lucide-react';
import { AuthPageShell } from '@/components/auth/auth-page-shell';
import { resetPasswordWithToken } from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PageSkeleton } from '@/components/ui/skeleton';

export default function RedefinirSenhaPage() {
  return (
    <Suspense
      fallback={
        <main className="gestop-shell flex min-h-dvh items-center justify-center p-4">
          <div className="w-full max-w-md">
            <PageSkeleton />
          </div>
        </main>
      }
    >
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
    <AuthPageShell
      icon={KeyRound}
      chipLabel="Nova credencial"
      title="Redefinir senha"
      description="Escolha uma senha forte com pelo menos 12 caracteres."
    >
      {error ? <Alert variant="error" className="mb-4">{error}</Alert> : null}

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Nova senha">
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            minLength={12}
            required
          />
        </Field>
        <Field label="Confirmar senha">
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            minLength={12}
            required
          />
        </Field>
        <Button type="submit" variant="filled" size="lg" className="w-full" disabled={loading}>
          {loading ? 'Salvando...' : 'Salvar nova senha'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm">
        <Link href="/recuperar-senha" className="font-semibold text-[var(--brand)] hover:underline">
          Solicitar novo link
        </Link>
      </p>
    </AuthPageShell>
  );
}
