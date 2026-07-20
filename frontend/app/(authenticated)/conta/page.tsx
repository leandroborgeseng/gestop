'use client';

import { FormEvent, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { PageShell } from '@/components/layout/page-shell';
import { TipBanner } from '@/components/help/tip-banner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useSnackbar } from '@/components/ui/snackbar';
import { changePassword } from '@/lib/api';
import { useSafeBackHref } from '@/lib/use-safe-back-href';
import {
  PASSWORD_MIN_LENGTH_NEW,
  PASSWORD_POLICY_HINT,
  validatePasswordPolicy,
} from '@/lib/password-policy';

export default function ContaPage() {
  const backHref = useSafeBackHref('/cco');
  const snackbar = useSnackbar();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError('A confirmação da nova senha não confere.');
      return;
    }

    const policyError = validatePasswordPolicy(newPassword);
    if (policyError) {
      setError(policyError);
      return;
    }

    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      setSuccess('Senha alterada com sucesso.');
      snackbar.show('Senha alterada com sucesso.', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao alterar senha.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell
      kicker="Conta"
      icon={KeyRound}
      title="Minha conta"
      description="Altere sua senha de acesso ao SIGMA."
      backHref={backHref}
    >
      <TipBanner id="conta-senha">
        {PASSWORD_POLICY_HINT} Após alterar, faça login novamente em outros dispositivos se necessário.
      </TipBanner>

      <Card elevation={1} className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle className="text-[var(--ink)]">Alterar senha</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? <Alert variant="error" className="mb-4">{error}</Alert> : null}
          {success ? <Alert variant="success" className="mb-4">{success}</Alert> : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Senha atual">
              <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            </Field>
            <Field label="Nova senha" hint={PASSWORD_POLICY_HINT}>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={PASSWORD_MIN_LENGTH_NEW}
                required
              />
            </Field>
            <Field label="Confirmar nova senha">
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={PASSWORD_MIN_LENGTH_NEW}
                required
              />
            </Field>
            <Button type="submit" variant="filled" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar nova senha'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}
