'use client';

import { useEffect, useState } from 'react';
import {
  Building2,
  ClipboardCheck,
  FileSpreadsheet,
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

type RelatorioTipo = 'unidades' | 'fiscalizacoes' | 'chamados' | 'chamados-produtividade';
type RelatorioFormato = 'csv' | 'pdf' | 'xlsx';

const PRIORIDADES = [
  { value: 'BAIXA', label: 'Baixa' },
  { value: 'MEDIA', label: 'Média' },
  { value: 'ALTA', label: 'Alta' },
  { value: 'URGENTE', label: 'Urgente' },
] as const;

const RELATORIOS: Array<{
  tipo: RelatorioTipo;
  title: string;
  modalTitle: string;
  hint: string;
  icon: typeof Building2;
}> = [
  {
    tipo: 'unidades',
    title: 'Próprios públicos',
    modalTitle: 'Gerar relatório de Próprios públicos',
    hint: 'Cadastro, situação e localização das unidades.',
    icon: Building2,
  },
  {
    tipo: 'fiscalizacoes',
    title: 'Vistorias',
    modalTitle: 'Gerar relatório de Vistorias',
    hint: 'Checklists aplicados, conformidade e não conformidades.',
    icon: ClipboardCheck,
  },
  {
    tipo: 'chamados',
    title: 'Chamados',
    modalTitle: 'Gerar relatório de Chamados',
    hint: 'Relação de chamados cadastrados conforme filtros de status, tipo, prioridade e equipe.',
    icon: Inbox,
  },
  {
    tipo: 'chamados-produtividade',
    title: 'Chamados concluídos (produtividade)',
    modalTitle: 'Gerar relatório de produtividade',
    hint: 'Relação analítica de chamados concluídos com equipe, funcionário, cargo e cumprimento de prazo.',
    icon: BarChart3,
  },
];

type BaseModalState = {
  secretariaId: string;
  from: string;
  to: string;
  formato: RelatorioFormato;
};

type ChamadosModalState = BaseModalState & {
  status: string;
  tipoChamadoId: string;
  prioridade: string;
  equipeId: string;
};

type ProdutividadeModalState = BaseModalState & {
  tipoChamadoId: string;
};

const EMPTY_BASE: BaseModalState = {
  secretariaId: '',
  from: '',
  to: '',
  formato: 'pdf',
};

const EMPTY_CHAMADOS: ChamadosModalState = {
  ...EMPTY_BASE,
  status: '',
  tipoChamadoId: '',
  prioridade: '',
  equipeId: '',
};

const EMPTY_PROD: ProdutividadeModalState = {
  ...EMPTY_BASE,
  tipoChamadoId: '',
};

export default function RelatoriosPage() {
  const [secretarias, setSecretarias] = useState<SecretariaOption[]>([]);
  const [opcoes, setOpcoes] = useState<UnidadeFiltroOpcoes | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [activeTipo, setActiveTipo] = useState<RelatorioTipo | null>(null);
  const [simplesModal, setSimplesModal] = useState<BaseModalState>(EMPTY_BASE);
  const [chamadosModal, setChamadosModal] = useState<ChamadosModalState>(EMPTY_CHAMADOS);
  const [prodModal, setProdModal] = useState<ProdutividadeModalState>(EMPTY_PROD);

  useEffect(() => {
    getSecretarias().then(setSecretarias).catch(() => setSecretarias([]));
    getOpcoesFiltroUnidades()
      .then(setOpcoes)
      .catch(() => setOpcoes(null));
  }, []);

  async function exportar(tipo: RelatorioTipo, formato: RelatorioFormato, params: Record<string, string>) {
    setLoading(`${tipo}-${formato}`);
    setError(null);
    try {
      if (formato === 'csv') await downloadRelatorioCsv(tipo, params);
      else if (formato === 'pdf') await downloadRelatorioPdf(tipo, params);
      else await downloadRelatorioXlsx(tipo, params);
      setActiveTipo(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao exportar relatório.');
    } finally {
      setLoading(null);
    }
  }

  function openModal(tipo: RelatorioTipo) {
    if (tipo === 'chamados') {
      setChamadosModal({ ...EMPTY_CHAMADOS });
    } else if (tipo === 'chamados-produtividade') {
      setProdModal({ ...EMPTY_PROD });
    } else {
      setSimplesModal({ ...EMPTY_BASE });
    }
    setActiveTipo(tipo);
  }

  function closeModal() {
    setActiveTipo(null);
  }

  async function gerarSimples(tipo: 'unidades' | 'fiscalizacoes') {
    const params: Record<string, string> = {};
    if (simplesModal.secretariaId) params.secretariaId = simplesModal.secretariaId;
    if (simplesModal.from) params.from = simplesModal.from;
    if (simplesModal.to) params.to = simplesModal.to;
    await exportar(tipo, simplesModal.formato, params);
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
  }

  async function gerarProdutividade() {
    const params: Record<string, string> = {};
    if (prodModal.secretariaId) params.secretariaId = prodModal.secretariaId;
    if (prodModal.from) params.from = prodModal.from;
    if (prodModal.to) params.to = prodModal.to;
    if (prodModal.tipoChamadoId) params.tipoChamadoId = prodModal.tipoChamadoId;
    await exportar('chamados-produtividade', prodModal.formato, params);
  }

  const tiposChamado = opcoes?.tiposChamado ?? [];
  const equipes = opcoes?.equipes ?? [];
  const statusOptions = Object.entries(CHAMADO_STATUS_META);
  const activeMeta = RELATORIOS.find((item) => item.tipo === activeTipo) ?? null;
  const isLoading = Boolean(loading);

  return (
    <RequirePermissions permissions={['dashboard.visualizar']}>
      <PageShell
        kicker="Inteligência operacional"
        icon={FileSpreadsheet}
        title="Relatórios"
        description="Escolha um relatório e configure filtros e formato na geração."
        backHref="/dashboard"
      >
        <TipBanner id="relatorios-export">
          Em cada card, use <b>Gerar</b> para abrir os filtros e escolher CSV, PDF ou Excel. PDFs saem em A4
          paisagem com logo da PMF.
        </TipBanner>

        {error ? <Alert variant="error" className="mb-4">{error}</Alert> : null}

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
                    <div className="mt-4">
                      <Button variant="filled" size="sm" onClick={() => openModal(item.tipo)}>
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
          open={activeTipo === 'unidades' || activeTipo === 'fiscalizacoes'}
          onClose={closeModal}
          title={activeMeta?.modalTitle ?? 'Gerar relatório'}
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outlined" onClick={closeModal}>
                Cancelar
              </Button>
              <Button
                variant="filled"
                disabled={isLoading}
                onClick={() => {
                  if (activeTipo === 'unidades' || activeTipo === 'fiscalizacoes') {
                    void gerarSimples(activeTipo);
                  }
                }}
              >
                {isLoading ? 'Gerando...' : 'Gerar relatório'}
              </Button>
            </div>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Secretaria">
              <Select
                value={simplesModal.secretariaId}
                onChange={(e) => setSimplesModal((prev) => ({ ...prev, secretariaId: e.target.value }))}
              >
                <option value="">Todas</option>
                {secretarias.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.sigla} — {item.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Formato">
              <Select
                value={simplesModal.formato}
                onChange={(e) => setSimplesModal((prev) => ({ ...prev, formato: e.target.value as RelatorioFormato }))}
              >
                <option value="pdf">PDF</option>
                <option value="csv">CSV</option>
                <option value="xlsx">Excel (XLSX)</option>
              </Select>
            </Field>
            <Field label="De">
              <Input
                type="date"
                value={simplesModal.from}
                onChange={(e) => setSimplesModal((prev) => ({ ...prev, from: e.target.value }))}
              />
            </Field>
            <Field label="Até">
              <Input
                type="date"
                value={simplesModal.to}
                onChange={(e) => setSimplesModal((prev) => ({ ...prev, to: e.target.value }))}
              />
            </Field>
          </div>
        </Sheet>

        <Sheet
          open={activeTipo === 'chamados'}
          onClose={closeModal}
          title="Gerar relatório de Chamados"
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outlined" onClick={closeModal}>
                Cancelar
              </Button>
              <Button variant="filled" disabled={isLoading} onClick={() => void gerarChamados()}>
                {isLoading ? 'Gerando...' : 'Gerar relatório'}
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
          open={activeTipo === 'chamados-produtividade'}
          onClose={closeModal}
          title="Gerar relatório de produtividade"
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outlined" onClick={closeModal}>
                Cancelar
              </Button>
              <Button variant="filled" disabled={isLoading} onClick={() => void gerarProdutividade()}>
                {isLoading ? 'Gerando...' : 'Gerar relatório'}
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
