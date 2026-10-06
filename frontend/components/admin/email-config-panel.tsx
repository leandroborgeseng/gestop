'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Mail, Save, Send } from 'lucide-react';
import { getEmailConfig, saveEmailConfig, testarEmailConfig } from '@/lib/api';
import { EmailConfigPublica } from '@/lib/types';
import { useSessionUser } from '@/components/auth/session-context';
import { isAdministradorSistemaAtivo } from '@/lib/administrador-sistema';
import { hasAdminTabAccess } from '@/lib/permissions-matrix';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useSnackbar } from '@/components/ui/snackbar';
import { ErrorState, LoadingState } from '@/components/ui-states';

type FormState = {
  ativo: boolean;
  remetenteEmail: string;
  remetenteNome: string;
  replyTo: string;
  smtpHost: string;
  smtpPort: string;
  seguranca: 'NENHUMA' | 'SSL' | 'TLS';
  usarAutenticacao: boolean;
  usuario: string;
  senha: string;
  assuntoEquipe: string;
  textoIntroEquipe: string;
};

function fromConfig(config: EmailConfigPublica): FormState {
  return {
    ativo: config.ativo,
    remetenteEmail: config.remetenteEmail,
    remetenteNome: config.remetenteNome,
    replyTo: config.replyTo,
    smtpHost: config.smtpHost,
    smtpPort: String(config.smtpPort || 587),
    seguranca: config.seguranca,
    usarAutenticacao: config.usarAutenticacao,
    usuario: config.usuario,
    senha: '',
    assuntoEquipe: config.assuntoEquipe,
    textoIntroEquipe: config.textoIntroEquipe,
  };
}

export function EmailConfigPanel() {
  const snackbar = useSnackbar();
  const user = useSessionUser();
  const permissoes = user?.permissoes ?? [];
  const admin = isAdministradorSistemaAtivo(user);
  const canAlter = admin || hasAdminTabAccess('email', 'alterar', permissoes);
  const canTest = admin || hasAdminTabAccess('email', 'executar', permissoes);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [senhaDefinida, setSenhaDefinida] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [destino, setDestino] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getEmailConfig()
      .then((config) => {
        setForm(fromConfig(config));
        setSenhaDefinida(config.senhaDefinida);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Falha ao carregar o e-mail.'))
      .finally(() => setLoading(false));
  }, []);

  function patch(partial: Partial<FormState>) {
    setForm((current) => (current ? { ...current, ...partial } : current));
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    setBusy(true);
    try {
      const saved = await saveEmailConfig({
        ativo: form.ativo,
        remetenteEmail: form.remetenteEmail || undefined,
        remetenteNome: form.remetenteNome || undefined,
        replyTo: form.replyTo || undefined,
        smtpHost: form.smtpHost || undefined,
        smtpPort: Number(form.smtpPort) || 587,
        seguranca: form.seguranca,
        usarAutenticacao: form.usarAutenticacao,
        usuario: form.usuario || undefined,
        senha: form.senha || undefined,
        assuntoEquipe: form.assuntoEquipe || undefined,
        textoIntroEquipe: form.textoIntroEquipe || undefined,
      });
      setForm(fromConfig(saved));
      setSenhaDefinida(saved.senhaDefinida);
      snackbar.show('Configuração de e-mail salva.', 'success');
    } catch (err) {
      snackbar.show(err instanceof Error ? err.message : 'Não foi possível salvar.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function onTest() {
    if (!destino.trim()) {
      snackbar.show('Informe o e-mail de destino do teste.', 'warning');
      return;
    }
    setBusy(true);
    try {
      const result = await testarEmailConfig(destino.trim());
      snackbar.show(result.mensagem, 'success');
    } catch (err) {
      snackbar.show(err instanceof Error ? err.message : 'Falha no teste de envio.', 'error');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingState label="Carregando configuração de e-mail..." />;
  if (error || !form) return <ErrorState message={error ?? 'Configuração indisponível.'} />;

  return (
    <form onSubmit={(event) => void onSave(event)} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Configurações de e-mail
          </CardTitle>
          <CardDescription>
            Servidor usado pelo SIGMA, inclusive no botão Notificar equipe. A senha não é exibida depois de salva.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-[13px] sm:col-span-2">
            <input type="checkbox" checked={form.ativo} onChange={(event) => patch({ ativo: event.target.checked })} disabled={!canAlter} />
            E-mail ativo
          </label>
          <Field label="E-mail remetente">
            <Input value={form.remetenteEmail} onChange={(event) => patch({ remetenteEmail: event.target.value })} disabled={!canAlter} type="email" />
          </Field>
          <Field label="Nome do remetente">
            <Input value={form.remetenteNome} onChange={(event) => patch({ remetenteNome: event.target.value })} disabled={!canAlter} />
          </Field>
          <Field label="E-mail de resposta">
            <Input value={form.replyTo} onChange={(event) => patch({ replyTo: event.target.value })} disabled={!canAlter} type="email" />
          </Field>
          <Field label="Servidor SMTP">
            <Input value={form.smtpHost} onChange={(event) => patch({ smtpHost: event.target.value })} disabled={!canAlter} />
          </Field>
          <Field label="Porta SMTP">
            <Input value={form.smtpPort} onChange={(event) => patch({ smtpPort: event.target.value })} disabled={!canAlter} inputMode="numeric" />
          </Field>
          <Field label="Segurança">
            <Select value={form.seguranca} onChange={(event) => patch({ seguranca: event.target.value as FormState['seguranca'] })} disabled={!canAlter}>
              <option value="NENHUMA">Nenhuma</option>
              <option value="SSL">SSL</option>
              <option value="TLS">TLS/STARTTLS</option>
            </Select>
          </Field>
          <label className="flex items-center gap-2 text-[13px] sm:col-span-2">
            <input
              type="checkbox"
              checked={form.usarAutenticacao}
              onChange={(event) => patch({ usarAutenticacao: event.target.checked })}
              disabled={!canAlter}
            />
            Usar autenticação
          </label>
          <Field label="Usuário">
            <Input value={form.usuario} onChange={(event) => patch({ usuario: event.target.value })} disabled={!canAlter || !form.usarAutenticacao} autoComplete="off" />
          </Field>
          <Field label="Senha" hint={senhaDefinida ? 'Deixe em branco para manter a senha já cadastrada.' : 'Senha ou senha de aplicativo.'}>
            <Input value={form.senha} onChange={(event) => patch({ senha: event.target.value })} disabled={!canAlter || !form.usarAutenticacao} type="password" autoComplete="new-password" placeholder={senhaDefinida ? '••••••••' : ''} />
          </Field>
          <Field label="Assunto da notificação de equipe" className="sm:col-span-2">
            <Input value={form.assuntoEquipe} onChange={(event) => patch({ assuntoEquipe: event.target.value })} disabled={!canAlter} placeholder="Chamado atribuído à equipe" />
          </Field>
          <Field label="Texto introdutório" className="sm:col-span-2">
            <textarea
              value={form.textoIntroEquipe}
              onChange={(event) => patch({ textoIntroEquipe: event.target.value })}
              disabled={!canAlter}
              rows={3}
              className="w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px]"
              placeholder="Mensagem opcional no início do e-mail de Notificar equipe."
            />
          </Field>
          {canAlter ? (
            <div className="sm:col-span-2">
              <Button type="submit" variant="filled" disabled={busy} className="gap-1.5">
                <Save className="h-4 w-4" />
                Salvar
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {canTest ? (
        <Card>
          <CardHeader>
            <CardTitle>Testar envio</CardTitle>
            <CardDescription>Envia uma mensagem simples para o endereço informado.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="E-mail de destino" className="min-w-0 flex-1">
              <Input value={destino} onChange={(event) => setDestino(event.target.value)} type="email" />
            </Field>
            <Button type="button" variant="outlined" disabled={busy} onClick={() => void onTest()} className="gap-1.5">
              <Send className="h-4 w-4" />
              Testar envio
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Alert variant="info">Seu perfil pode consultar esta configuração, sem alterar ou testar o envio.</Alert>
      )}
    </form>
  );
}
