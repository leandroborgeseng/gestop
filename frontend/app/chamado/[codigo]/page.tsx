'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { MapPin, Megaphone } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { LoadingState } from '@/components/ui-states';
import { createPublicChamado, getPublicUnidade } from '@/lib/api';
import { ChamadoResumo, PublicUnidadeChamado } from '@/lib/types';

export default function ChamadoPublicoPage() {
  const params = useParams<{ codigo: string }>();
  const codigo = decodeURIComponent(params.codigo ?? '');

  const [unidade, setUnidade] = useState<PublicUnidadeChamado | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chamado, setChamado] = useState<ChamadoResumo | null>(null);

  const [descricao, setDescricao] = useState('');
  const [solicitanteNome, setSolicitanteNome] = useState('');
  const [solicitanteEmail, setSolicitanteEmail] = useState('');
  const [solicitanteTelefone, setSolicitanteTelefone] = useState('');

  useEffect(() => {
    setLoading(true);
    setError(null);
    getPublicUnidade(codigo)
      .then(setUnidade)
      .catch((err) => setError(err instanceof Error ? err.message : 'QR Code invalido ou proprio inativo.'))
      .finally(() => setLoading(false));
  }, [codigo]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const created = await createPublicChamado(codigo, {
        descricao,
        solicitanteNome: solicitanteNome || undefined,
        solicitanteEmail: solicitanteEmail || undefined,
        solicitanteTelefone: solicitanteTelefone || undefined,
      });
      setChamado(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao registrar chamado.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="gestop-shell min-h-dvh px-4 py-8">
      <div className="mx-auto w-full max-w-lg">
        <Logo variant="full" className="mx-auto h-12 max-w-[220px]" />

        <Card elevation={2} className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 md-headline-md">
              <Megaphone className="h-5 w-5 text-[var(--color-brand-primary)]" />
              Abrir chamado
            </CardTitle>
            <CardDescription>
              Registre uma solicitacao de manutencao para o proprio publico identificado pelo QR Code.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {loading ? <LoadingState label="Carregando proprio publico..." /> : null}

            {!loading && error && !unidade ? (
              <Alert variant="error">{error}</Alert>
            ) : null}

            {!loading && unidade && !chamado ? (
              <>
                <div className="mb-6 rounded-[var(--md-shape-md)] bg-[var(--md-surface-container-low)] p-4">
                  <p className="md-label-lg text-[var(--color-brand-primary)]">{unidade.codigoPatrimonial}</p>
                  <h2 className="md-title-lg mt-1 text-[var(--md-on-surface)]">{unidade.nome}</h2>
                  <p className="md-body-md mt-2 flex items-start gap-2 text-[var(--md-on-surface-variant)]">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                    {unidade.endereco}
                    {unidade.bairro ? ` · ${unidade.bairro}` : ''}
                  </p>
                  <p className="md-body-sm mt-2 text-[var(--md-on-surface-variant)]">
                    {unidade.secretaria.nome} ({unidade.secretaria.sigla})
                  </p>
                </div>

                {error ? <Alert variant="error" className="mb-4">{error}</Alert> : null}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <Field label="Descricao do problema" hint="Minimo de 10 caracteres.">
                    <textarea
                      value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                      minLength={10}
                      rows={4}
                      required
                      placeholder="Ex.: Vazamento no banheiro do 2o andar..."
                      className={cn(
                        'flex min-h-[120px] w-full rounded-[var(--md-shape-sm)] border border-[var(--md-outline)] bg-[var(--md-surface-container-lowest)] px-4 py-3 text-base text-[var(--md-on-surface)] shadow-none transition-all duration-[var(--md-duration-short)] placeholder:text-[var(--md-on-surface-variant)] focus:border-[var(--color-brand-primary)] focus:bg-[var(--md-surface)] focus:outline-none focus:ring-4 focus:ring-[color-mix(in_srgb,var(--color-brand-primary)_12%,transparent)] md:text-sm',
                      )}
                    />
                  </Field>
                  <Field label="Seu nome (opcional)">
                    <Input value={solicitanteNome} onChange={(e) => setSolicitanteNome(e.target.value)} />
                  </Field>
                  <Field label="E-mail (opcional)">
                    <Input
                      type="email"
                      value={solicitanteEmail}
                      onChange={(e) => setSolicitanteEmail(e.target.value)}
                    />
                  </Field>
                  <Field label="Telefone (opcional)">
                    <Input
                      type="tel"
                      value={solicitanteTelefone}
                      onChange={(e) => setSolicitanteTelefone(e.target.value)}
                    />
                  </Field>
                  <Button type="submit" variant="filled" className="w-full" disabled={submitting}>
                    {submitting ? 'Enviando...' : 'Registrar chamado'}
                  </Button>
                </form>
              </>
            ) : null}

            {chamado ? (
              <Alert variant="success">
                <p className="md-title-md">Chamado registrado com sucesso!</p>
                <p className="md-body-md mt-2">
                  Protocolo <strong>{chamado.codigo}</strong>. A equipe da {chamado.secretaria.sigla} ira analisar sua
                  solicitacao.
                </p>
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        <p className="md-body-sm mt-6 text-center text-[var(--md-on-surface-variant)]">
          Prefeitura Municipal de Franca · GestOP
        </p>
      </div>
    </main>
  );
}
