'use client';

import { useEffect, useState } from 'react';
import { Bell, FileSpreadsheet, FileText } from 'lucide-react';
import { RequirePermissions } from '@/components/auth/require-permissions';
import { PageShell } from '@/components/layout/page-shell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { downloadRelatorioCsv, downloadRelatorioPdf, getSecretarias } from '@/lib/api';
import { SecretariaOption } from '@/lib/types';

type RelatorioTipo = 'unidades' | 'chamados' | 'ordens-servico' | 'fiscalizacoes';

export default function RelatoriosPage() {
  const [secretarias, setSecretarias] = useState<SecretariaOption[]>([]);
  const [secretariaId, setSecretariaId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSecretarias().then(setSecretarias).catch(() => setSecretarias([]));
  }, []);

  function buildParams() {
    const params: Record<string, string> = {};
    if (secretariaId) params.secretariaId = secretariaId;
    if (from) params.from = from;
    if (to) params.to = to;
    return params;
  }

  async function exportar(tipo: RelatorioTipo, formato: 'csv' | 'pdf') {
    setLoading(`${tipo}-${formato}`);
    setError(null);
    try {
      const params = buildParams();
      if (formato === 'csv') await downloadRelatorioCsv(tipo, params);
      else await downloadRelatorioPdf(tipo, params);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao exportar relatorio.');
    } finally {
      setLoading(null);
    }
  }

  return (
    <RequirePermissions permissions={['dashboard.visualizar']}>
      <PageShell
        kicker="Relatorios"
        icon={FileSpreadsheet}
        title="Exportacao CSV e PDF"
        description="Baixe dados operacionais para planilhas ou impressao. PDFs gerados em formato paisagem A4."
        backHref="/dashboard"
      >
        {error ? <Alert variant="error" className="mb-4">{error}</Alert> : null}

        <Card elevation={1} className="mb-6">
          <CardHeader>
            <CardTitle>Filtros opcionais</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Field label="Secretaria">
              <Select value={secretariaId} onChange={(e) => setSecretariaId(e.target.value)}>
                <option value="">Todas</option>
                {secretarias.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.sigla} — {item.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="De">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="Ate">
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </CardContent>
        </Card>

        <section className="grid gap-4 md:grid-cols-2">
          {[
            { tipo: 'unidades' as const, title: 'Proprios publicos', hint: 'Cadastro patrimonial completo' },
            { tipo: 'chamados' as const, title: 'Chamados', hint: 'Triagem e origem QR/interna' },
            { tipo: 'ordens-servico' as const, title: 'Ordens de servico', hint: 'Status, prazos e responsaveis' },
            { tipo: 'fiscalizacoes' as const, title: 'Fiscalizacoes', hint: 'Vistorias com GPS e agente' },
          ].map((item) => (
            <Card key={item.tipo} elevation={1}>
              <CardContent className="p-5">
                <h2 className="md-title-lg text-[var(--md-on-surface)]">{item.title}</h2>
                <p className="md-body-md mt-1 text-[var(--md-on-surface-variant)]">{item.hint}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="filled"
                    size="sm"
                    className="gap-2"
                    disabled={loading === `${item.tipo}-csv`}
                    onClick={() => exportar(item.tipo, 'csv')}
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    {loading === `${item.tipo}-csv` ? 'Exportando...' : 'CSV'}
                  </Button>
                  <Button
                    variant="tonal"
                    size="sm"
                    className="gap-2"
                    disabled={loading === `${item.tipo}-pdf`}
                    onClick={() => exportar(item.tipo, 'pdf')}
                  >
                    <FileText className="h-4 w-4" />
                    {loading === `${item.tipo}-pdf` ? 'Gerando...' : 'PDF'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      </PageShell>
    </RequirePermissions>
  );
}
