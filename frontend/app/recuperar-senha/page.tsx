'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { requestPasswordReset } from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [devUrl, setDevUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    setDevUrl(null);

    try {
      const result = await requestPasswordReset(email);
      setMessage(result.message);
      if (result.devResetUrl) setDevUrl(result.devResetUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao solicitar recuperação.');
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
            Recuperar senha
          </CardTitle>
          <CardDescription>Informe seu e-mail institucional para receber o link de redefinição.</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? <Alert variant="error" className="mb-4">{error}</Alert> : null}
          {message ? <Alert variant="success" className="mb-4">{message}</Alert> : null}
          {devUrl ? (
            <Alert variant="warning" className="mb-4">
              Ambiente de desenvolvimento: <Link href={devUrl} className="underline">abrir link de reset</Link>
            </Alert>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="E-mail">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Button type="submit" variant="filled" className="w-full" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar link'}
            </Button>
          </form>

          <p className="md-body-md mt-6 text-center">
            <Link href="/login" className="text-[var(--color-brand-primary)] hover:underline">
              Voltar ao login
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
