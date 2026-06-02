'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import { AuthPageShell } from '@/components/auth/auth-page-shell';
import { requestPasswordReset } from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
    <AuthPageShell
      icon={KeyRound}
      chipLabel="Recuperação de acesso"
      title="Recuperar senha"
      description="Informe seu e-mail institucional para receber o link de redefinição."
    >
      {error ? <Alert variant="error" className="mb-4">{error}</Alert> : null}
      {message ? <Alert variant="success" className="mb-4">{message}</Alert> : null}
      {devUrl ? (
        <Alert variant="warning" className="mb-4">
          Ambiente de desenvolvimento:{' '}
          <Link href={devUrl} className="font-semibold underline">
            abrir link de reset
          </Link>
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="E-mail">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="seu.email@franca.sp.gov.br"
            required
          />
        </Field>
        <Button type="submit" variant="filled" size="lg" className="w-full" disabled={loading}>
          {loading ? 'Enviando...' : 'Enviar link'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="font-semibold text-[var(--brand)] hover:underline">
          Voltar ao login
        </Link>
      </p>
    </AuthPageShell>
  );
}
