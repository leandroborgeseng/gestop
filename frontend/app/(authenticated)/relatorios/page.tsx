'use client';

import { useEffect, useState } from 'react';
import {
  Building2,
  ClipboardCheck,
  FileSpreadsheet,
  FileText,
  Inbox,
} from 'lucide-react';
import { RequirePermissions } from '@/components/auth/require-permissions';
import { PageShell } from '@/components/layout/page-shell';
import { TipBanner } from '@/components/help/tip-banner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { downloadRelatorioCsv, downloadRelatorioPdf, downloadRelatorioXlsx, getSecretarias } from '@/lib/api';
import { SecretariaOption } from '@/lib/types';

type RelatorioTipo = 'unidades' | 'chamados' | 'fiscalizacoes';

const RELATORIOS: Array<{
  tipo: RelatorioTipo;
  title: string;
  hint: string;
  icon: typeof Building2;
}> = [
  { tipo: 'unidades', title: 'Próprios públicos', hint: 'Cadastro, situação e localização das unidades.', icon: Building2 },
  { tipo: 'fiscalizacoes', title: 'Vistorias', hint: 'Checklists aplicados, conformidade e não conformidades.', icon: ClipboardCheck },
  { tipo: 'chamados', title: 'Chamados', hint: 'Triagem, atendimento, prazos (SLA) e tempo de resolução.', icon: Inbox },
];

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

  async function exportar(tipo: RelatorioTipo, formato: 'csv' | 'pdf' | 'xlsx') {
    setLoading(`${tipo}-${formato}`);
    setError(null);
    try {
      const params = buildParams();
      if (formato === 'csv') await downloadRelatorioCsv(tipo, params);
      else if (formato === 'pdf') await downloadRelatorioPdf(tipo, params);
      else await downloadRelatorioXlsx(tipo, params);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao exportar relatório.');
    } finally {
      setLoading(null);
    }
  }

  return (
    <RequirePermissions permissions={['dashboard.visualizar']}>
      <PageShell
        kicker="Inteligência operacional"
        icon={FileSpreadsheet}
        title="Relatórios"
        description="Exportações por tipo e período — CSV e Excel para análise, PDF para registro oficial."
        backHref="/dashboard"
      >
        <TipBanner id="relatorios-export">
          PDFs são gerados em formato paisagem A4 com logo da PMF. Use os filtros opcionais para restringir secretaria e período.
        </TipBanner>

        {error ? <Alert variant="error" className="mb-4">{error}</Alert> : null}

        <Card elevation={1} className="mb-6">
          <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
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
            <Field label="Até">
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </CardContent>
        </Card>

        <section className="grid gap-4 md:grid-cols-2">
          {RELATORIOS.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.tipo} elevation={1} className="overflow-hidden">
                <CardContent className="flex gap-4 p-5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r-md)] bg-[var(--brand-soft)] text-[var(--brand)]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-[15px] font-semibold text-[var(--ink)]">{item.title}</h2>
                    <p className="mt-1 text-[13px] text-[var(--ink-3)]">{item.hint}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        variant="outlined"
                        size="sm"
                        className="gap-2"
                        disabled={loading === `${item.tipo}-csv`}
                        onClick={() => exportar(item.tipo, 'csv')}
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                        {loading === `${item.tipo}-csv` ? 'Exportando...' : 'CSV'}
                      </Button>
                      <Button
                        variant="filled"
                        size="sm"
                        className="gap-2"
                        disabled={loading === `${item.tipo}-pdf`}
                        onClick={() => exportar(item.tipo, 'pdf')}
                      >
                        <FileText className="h-4 w-4" />
                        {loading === `${item.tipo}-pdf` ? 'Gerando...' : 'PDF'}
                      </Button>
                      <Button
                        variant="outlined"
                        size="sm"
                        className="gap-2"
                        disabled={loading === `${item.tipo}-xlsx`}
                        onClick={() => exportar(item.tipo, 'xlsx')}
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                        {loading === `${item.tipo}-xlsx` ? 'Exportando...' : 'Excel (XLSX)'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>
      </PageShell>
    </RequirePermissions>
  );
}
