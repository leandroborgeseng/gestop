'use client';

import { useEffect, useState } from 'react';
import {
  Building2,
  ClipboardCheck,
  FileSpreadsheet,
  FileText,
  Inbox,
  BarChart3,
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
import { Sheet } from '@/components/ui/sheet';
import {
  downloadRelatorioCsv,
  downloadRelatorioPdf,
  downloadRelatorioXlsx,
  getOpcoesFiltroUnidades,
  getSecretarias,
} from '@/lib/api';
import { CHAMADO_STATUS_META } from '@/lib/chamado-status';
import { SecretariaOption, UnidadeFiltroOpcoes } from '@/lib/types';

type RelatorioTipoSimples = 'unidades' | 'fiscalizacoes';
type RelatorioTipoModal = 'chamados' | 'chamados-produtividade';
type RelatorioFormato = 'csv' | 'pdf' | 'xlsx';

const PRIORIDADES = [
  { value: 'BAIXA', label: 'Baixa' },
  { value: 'MEDIA', label: 'Média' },
  { value: 'ALTA', label: 'Alta' },
  { value: 'URGENTE', label: 'Urgente' },
] as const;

const RELATORIOS_SIMPLES: Array<{
  tipo: RelatorioTipoSimples;
  title: string;
  hint: string;
  icon: typeof Building2;
}> = [
  { tipo: 'unidades', title: 'Próprios públicos', hint: 'Cadastro, situação e localização das unidades.', icon: Building2 },
  { tipo: 'fiscalizacoes', title: 'Vistorias', hint: 'Checklists aplicados, conformidade e não conformidades.', icon: ClipboardCheck },
];

const RELATORIOS_MODAL: Array<{
  tipo: RelatorioTipoModal;
  title: string;
  hint: string;
  icon: typeof Inbox;
}> = [
  {
    tipo: 'chamados',
    title: 'Chamados',
    hint: 'Relação de chamados cadastrados conforme filtros de status, tipo, prioridade e equipe.',
    icon: Inbox,
  },
  {
    tipo: 'chamados-produtividade',
    title: 'Chamados concluídos (produtividade)',
    hint: 'Relação analítica de chamados concluídos com equipe, funcionário, cargo e cumprimento de prazo.',
    icon: BarChart3,
  },
];

type ChamadosModalState = {
  secretariaId: string;
  from: string;
  to: string;
  status: string;
  tipoChamadoId: string;
  prioridade: string;
  equipeId: string;
  formato: RelatorioFormato;
};

type ProdutividadeModalState = {
  secretariaId: string;
  from: string;
  to: string;
  tipoChamadoId: string;
  formato: RelatorioFormato;
};

const EMPTY_CHAMADOS_MODAL: ChamadosModalState = {
  secretariaId: '',
  from: '',
  to: '',
  status: '',
  tipoChamadoId: '',
  prioridade: '',
  equipeId: '',
  formato: 'pdf',
};

const EMPTY_PROD_MODAL: ProdutividadeModalState = {
  secretariaId: '',
  from: '',
  to: '',
  tipoChamadoId: '',
  formato: 'pdf',
};

export default function RelatoriosPage() {
  const [secretarias, setSecretarias] = useState<SecretariaOption[]>([]);
  const [opcoes, setOpcoes] = useState<UnidadeFiltroOpcoes | null>(null);
  const [secretariaId, setSecretariaId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [chamadosOpen, setChamadosOpen] = useState(false);
  const [prodOpen, setProdOpen] = useState(false);
  const [chamadosModal, setChamadosModal] = useState<ChamadosModalState>(EMPTY_CHAMADOS_MODAL);
  const [prodModal, setProdModal] = useState<ProdutividadeModalState>(EMPTY_PROD_MODAL);

  useEffect(() => {
    getSecretarias().then(setSecretarias).catch(() => setSecretarias([]));
    getOpcoesFiltroUnidades()
      .then(setOpcoes)
      .catch(() => setOpcoes(null));
  }, []);

  function buildGlobalParams() {
    const params: Record<string, string> = {};
    if (secretariaId) params.secretariaId = secretariaId;
    if (from) params.from = from;
    if (to) params.to = to;
    return params;
  }

  async function exportar(
    tipo: RelatorioTipoSimples | RelatorioTipoModal,
    formato: RelatorioFormato,
    params: Record<string, string>,
  ) {
    setLoading(`${tipo}-${formato}`);
    setError(null);
    try {
      if (formato === 'csv') await downloadRelatorioCsv(tipo, params);
      else if (formato === 'pdf') await downloadRelatorioPdf(tipo, params);
      else await downloadRelatorioXlsx(tipo, params);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao exportar relatório.');
    } finally {
      setLoading(null);
    }
  }

  function openChamadosModal() {
    setChamadosModal({
      ...EMPTY_CHAMADOS_MODAL,
      secretariaId,
      from,
      to,
      formato: 'pdf',
    });
    setChamadosOpen(true);
  }

  function openProdModal() {
    setProdModal({
      ...EMPTY_PROD_MODAL,
      secretariaId,
      from,
      to,
      formato: 'pdf',
    });
    setProdOpen(true);
  }

  async function gerarChamados() {
    const params: Record<string, string> = {};
    if (chamadosModal.secretariaId) params.secretariaId = chamadosModal.secretariaId;
    if (chamadosModal.from) params.from = chamadosModal.from;
    if (chamadosModal.to) params.to = chamadosModal.to;
    if (chamadosModal.status) params.status = chamadosModal.status;
    if (chamadosModal.tipoChamadoId) params.tipoChamadoId = chamadosModal.tipoChamadoId;
    if (chamadosModal.prioridade) params.prioridade = chamadosModal.prioridade;
    if (chamadosModal.equipeId) params.equipeId = chamadosModal.equipeId;
    await exportar('chamados', chamadosModal.formato, params);
    setChamadosOpen(false);
  }

  async function gerarProdutividade() {
    const params: Record<string, string> = {};
    if (prodModal.secretariaId) params.secretariaId = prodModal.secretariaId;
    if (prodModal.from) params.from = prodModal.from;
    if (prodModal.to) params.to = prodModal.to;
    if (prodModal.tipoChamadoId) params.tipoChamadoId = prodModal.tipoChamadoId;
    await exportar('chamados-produtividade', prodModal.formato, params);
    setProdOpen(false);
  }

  const tiposChamado = opcoes?.tiposChamado ?? [];
  const equipes = opcoes?.equipes ?? [];
  const statusOptions = Object.entries(CHAMADO_STATUS_META);

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
          PDFs são gerados em formato paisagem A4 com logo da PMF. Nos cards de Chamados, use{' '}
          <b>Gerar</b> para escolher filtros e formato.
        </TipBanner>

        {error ? <Alert variant="error" className="mb-4">{error}</Alert> : null}

        <Card elevation={1} className="mb-6">
          <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
            <Field label="Secretaria (padrão)">
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
          {RELATORIOS_SIMPLES.map((item) => {
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
                        onClick={() => void exportar(item.tipo, 'csv', buildGlobalParams())}
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                        {loading === `${item.tipo}-csv` ? 'Exportando...' : 'CSV'}
                      </Button>
                      <Button
                        variant="filled"
                        size="sm"
                        className="gap-2"
                        disabled={loading === `${item.tipo}-pdf`}
                        onClick={() => void exportar(item.tipo, 'pdf', buildGlobalParams())}
                      >
                        <FileText className="h-4 w-4" />
                        {loading === `${item.tipo}-pdf` ? 'Gerando...' : 'PDF'}
                      </Button>
                      <Button
                        variant="outlined"
                        size="sm"
                        className="gap-2"
                        disabled={loading === `${item.tipo}-xlsx`}
                        onClick={() => void exportar(item.tipo, 'xlsx', buildGlobalParams())}
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

          {RELATORIOS_MODAL.map((item) => {
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
                    <div className="mt-4">
                      <Button
                        variant="filled"
                        size="sm"
                        onClick={() => (item.tipo === 'chamados' ? openChamadosModal() : openProdModal())}
                      >
                        Gerar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <Sheet
          open={chamadosOpen}
          onClose={() => setChamadosOpen(false)}
          title="Gerar relatório de Chamados"
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outlined" onClick={() => setChamadosOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="filled"
                disabled={Boolean(loading?.startsWith('chamados-'))}
                onClick={() => void gerarChamados()}
              >
                {loading?.startsWith('chamados-') ? 'Gerando...' : 'Gerar relatório'}
              </Button>
            </div>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Secretaria">
              <Select
                value={chamadosModal.secretariaId}
                onChange={(e) => setChamadosModal((prev) => ({ ...prev, secretariaId: e.target.value }))}
              >
                <option value="">Todas</option>
                {secretarias.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.sigla} — {item.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <Select
                value={chamadosModal.status}
                onChange={(e) => setChamadosModal((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="">Todos</option>
                {statusOptions.map(([value, meta]) => (
                  <option key={value} value={value}>
                    {meta.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="De (abertura)">
              <Input
                type="date"
                value={chamadosModal.from}
                onChange={(e) => setChamadosModal((prev) => ({ ...prev, from: e.target.value }))}
              />
            </Field>
            <Field label="Até (abertura)">
              <Input
                type="date"
                value={chamadosModal.to}
                onChange={(e) => setChamadosModal((prev) => ({ ...prev, to: e.target.value }))}
              />
            </Field>
            <Field label="Tipo do chamado">
              <Select
                value={chamadosModal.tipoChamadoId}
                onChange={(e) => setChamadosModal((prev) => ({ ...prev, tipoChamadoId: e.target.value }))}
              >
                <option value="">Todos</option>
                {tiposChamado.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Prioridade">
              <Select
                value={chamadosModal.prioridade}
                onChange={(e) => setChamadosModal((prev) => ({ ...prev, prioridade: e.target.value }))}
              >
                <option value="">Todas</option>
                {PRIORIDADES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Equipe">
              <Select
                value={chamadosModal.equipeId}
                onChange={(e) => setChamadosModal((prev) => ({ ...prev, equipeId: e.target.value }))}
              >
                <option value="">Todas</option>
                <option value="sem-equipe">Sem equipe atribuída</option>
                {equipes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Formato">
              <Select
                value={chamadosModal.formato}
                onChange={(e) =>
                  setChamadosModal((prev) => ({ ...prev, formato: e.target.value as RelatorioFormato }))
                }
              >
                <option value="pdf">PDF</option>
                <option value="csv">CSV</option>
                <option value="xlsx">Excel (XLSX)</option>
              </Select>
            </Field>
          </div>
        </Sheet>

        <Sheet
          open={prodOpen}
          onClose={() => setProdOpen(false)}
          title="Gerar relatório de produtividade"
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outlined" onClick={() => setProdOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="filled"
                disabled={Boolean(loading?.startsWith('chamados-produtividade-'))}
                onClick={() => void gerarProdutividade()}
              >
                {loading?.startsWith('chamados-produtividade-') ? 'Gerando...' : 'Gerar relatório'}
              </Button>
            </div>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Secretaria responsável pela execução">
              <Select
                value={prodModal.secretariaId}
                onChange={(e) => setProdModal((prev) => ({ ...prev, secretariaId: e.target.value }))}
              >
                <option value="">Todas</option>
                {secretarias.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.sigla} — {item.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tipo de chamado">
              <Select
                value={prodModal.tipoChamadoId}
                onChange={(e) => setProdModal((prev) => ({ ...prev, tipoChamadoId: e.target.value }))}
              >
                <option value="">Todos</option>
                {tiposChamado.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="De (conclusão)">
              <Input
                type="date"
                value={prodModal.from}
                onChange={(e) => setProdModal((prev) => ({ ...prev, from: e.target.value }))}
              />
            </Field>
            <Field label="Até (conclusão)">
              <Input
                type="date"
                value={prodModal.to}
                onChange={(e) => setProdModal((prev) => ({ ...prev, to: e.target.value }))}
              />
            </Field>
            <Field label="Formato" className="sm:col-span-2">
              <Select
                value={prodModal.formato}
                onChange={(e) => setProdModal((prev) => ({ ...prev, formato: e.target.value as RelatorioFormato }))}
              >
                <option value="pdf">PDF</option>
                <option value="csv">CSV</option>
                <option value="xlsx">Excel (XLSX)</option>
              </Select>
            </Field>
          </div>
          <p className="mt-3 text-[12px] text-[var(--ink-3)]">
            O período considera a <b>data de conclusão</b>. Equipe e participantes vêm do log de conclusão da
            execução, não da atribuição atual do chamado.
          </p>
        </Sheet>
      </PageShell>
    </RequirePermissions>
  );
}
