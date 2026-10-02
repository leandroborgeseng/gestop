'use client';

import { formatSecretariaLabel } from '@/lib/format-secretaria';

import { useEffect, useState } from 'react';
import {
  Building2,
  ClipboardCheck,
  FileSpreadsheet,
  Inbox,
  BarChart3,
  CalendarDays,
  ListChecks,
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
  downloadRelatorioTarefas,
  downloadRelatorioXlsx,
  getOpcoesFiltroUnidades,
  getSecretarias,
  getUnidades,
  listChecklists,
  listUsuariosAtivosExecucao,
} from '@/lib/api';
import { CHAMADO_STATUS_META } from '@/lib/chamado-status';
import { TAREFA_PRIORIDADE_LABEL, TAREFA_STATUS_LABEL } from '@/lib/chamado-tarefa';
import { CRONOGRAMA_FREQUENCIAS, CRONOGRAMA_FREQUENCIA_LABELS } from '@/lib/cronograma';
import { formatUnidadeTipo } from '@/lib/unidade-tipo';
import {
  ChecklistModel,
  SecretariaOption,
  UnidadeFiltroOpcoes,
  UnidadeOperacional,
  UsuarioExecucaoOpcao,
} from '@/lib/types';

type RelatorioTipo = 'unidades' | 'fiscalizacoes' | 'chamados' | 'chamados-produtividade' | 'cronograma-cobertura' | 'tarefas-chamados';
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
  {
    tipo: 'cronograma-cobertura',
    title: 'Cobertura de cronogramas',
    modalTitle: 'Gerar relatório de cobertura de vistorias',
    hint: 'Lista próprios ativos e indica se possuem cronograma de vistoria vinculado, com responsáveis previstos.',
    icon: CalendarDays,
  },
  {
    tipo: 'tarefas-chamados',
    title: 'Tarefas de chamados',
    modalTitle: 'Gerar relatório de tarefas de chamados',
    hint: 'Relação de tarefas vinculadas a chamados, com status, prazo, responsáveis, equipes e situação.',
    icon: ListChecks,
  },
];

const SITUACOES_PRAZO = [
  { value: 'SEM_PRAZO', label: 'Sem prazo' },
  { value: 'NO_PRAZO', label: 'No prazo' },
  { value: 'ATRASADA', label: 'Atrasada' },
  { value: 'CONCLUIDA_NO_PRAZO', label: 'Concluída no prazo' },
  { value: 'CONCLUIDA_COM_ATRASO', label: 'Concluída com atraso' },
  { value: 'CANCELADA', label: 'Cancelada' },
] as const;

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

type CoberturaModalState = Omit<BaseModalState, 'from' | 'to'> & {
  tipo: string;
  unidadeId: string;
  checklistId: string;
  frequencia: string;
  ativo: string;
  responsavelId: string;
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

type TarefasModalState = BaseModalState & {
  status: string;
  prioridade: string;
  equipeId: string;
  responsavelId: string;
  tipoChamadoId: string;
  numero: string;
  texto: string;
  situacaoPrazo: string;
  atrasadas: boolean;
  concluidas: boolean;
  canceladas: boolean;
};

const EMPTY_TAREFAS: TarefasModalState = {
  ...EMPTY_BASE,
  status: '',
  prioridade: '',
  equipeId: '',
  responsavelId: '',
  tipoChamadoId: '',
  numero: '',
  texto: '',
  situacaoPrazo: '',
  atrasadas: false,
  concluidas: false,
  canceladas: false,
};

const EMPTY_COBERTURA: CoberturaModalState = {
  secretariaId: '',
  tipo: '',
  unidadeId: '',
  checklistId: '',
  frequencia: '',
  ativo: '',
  responsavelId: '',
  formato: 'pdf',
};

export default function RelatoriosPage() {
  const [secretarias, setSecretarias] = useState<SecretariaOption[]>([]);
  const [opcoes, setOpcoes] = useState<UnidadeFiltroOpcoes | null>(null);
  const [unidades, setUnidades] = useState<UnidadeOperacional[]>([]);
  const [checklists, setChecklists] = useState<ChecklistModel[]>([]);
  const [responsaveis, setResponsaveis] = useState<UsuarioExecucaoOpcao[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [activeTipo, setActiveTipo] = useState<RelatorioTipo | null>(null);
  const [simplesModal, setSimplesModal] = useState<BaseModalState>(EMPTY_BASE);
  const [chamadosModal, setChamadosModal] = useState<ChamadosModalState>(EMPTY_CHAMADOS);
  const [prodModal, setProdModal] = useState<ProdutividadeModalState>(EMPTY_PROD);
  const [coberturaModal, setCoberturaModal] = useState<CoberturaModalState>(EMPTY_COBERTURA);
  const [tarefasModal, setTarefasModal] = useState<TarefasModalState>(EMPTY_TAREFAS);

  useEffect(() => {
    getSecretarias().then(setSecretarias).catch(() => setSecretarias([]));
    getOpcoesFiltroUnidades()
      .then(setOpcoes)
      .catch(() => setOpcoes(null));
    getUnidades({}).then(setUnidades).catch(() => setUnidades([]));
    listChecklists().then(setChecklists).catch(() => setChecklists([]));
    listUsuariosAtivosExecucao().then(setResponsaveis).catch(() => setResponsaveis([]));
  }, []);

  async function exportar(
    tipo: Exclude<RelatorioTipo, 'tarefas-chamados'>,
    formato: RelatorioFormato,
    params: Record<string, string>,
  ) {
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
    } else if (tipo === 'cronograma-cobertura') {
      setCoberturaModal({ ...EMPTY_COBERTURA });
    } else if (tipo === 'tarefas-chamados') {
      setTarefasModal({ ...EMPTY_TAREFAS });
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

  async function gerarTarefas() {
    const params: Record<string, string | undefined> = { capa: 'formal' };
    if (tarefasModal.secretariaId) params.secretariaId = tarefasModal.secretariaId;
    if (tarefasModal.from) params.from = tarefasModal.from;
    if (tarefasModal.to) params.to = tarefasModal.to;
    if (tarefasModal.status) params.status = tarefasModal.status;
    if (tarefasModal.prioridade) params.prioridade = tarefasModal.prioridade;
    if (tarefasModal.equipeId) params.equipeId = tarefasModal.equipeId;
    if (tarefasModal.responsavelId) params.responsavelId = tarefasModal.responsavelId;
    if (tarefasModal.tipoChamadoId) params.tipoChamadoId = tarefasModal.tipoChamadoId;
    if (tarefasModal.numero.trim()) params.numero = tarefasModal.numero.trim();
    if (tarefasModal.texto.trim()) params.texto = tarefasModal.texto.trim();
    if (tarefasModal.situacaoPrazo) params.situacaoPrazo = tarefasModal.situacaoPrazo;
    if (tarefasModal.atrasadas) params.atrasadas = '1';
    if (tarefasModal.concluidas) params.concluidas = '1';
    if (tarefasModal.canceladas) params.canceladas = '1';
    setLoading(`tarefas-chamados-${tarefasModal.formato}`);
    setError(null);
    try {
      await downloadRelatorioTarefas(tarefasModal.formato, params);
      setActiveTipo(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao exportar relatório.');
    } finally {
      setLoading(null);
    }
  }

  async function gerarCobertura() {
    const params: Record<string, string> = {};
    if (coberturaModal.secretariaId) params.secretariaId = coberturaModal.secretariaId;
    if (coberturaModal.tipo) params.tipo = coberturaModal.tipo;
    if (coberturaModal.unidadeId) params.unidadeId = coberturaModal.unidadeId;
    if (coberturaModal.checklistId) params.checklistId = coberturaModal.checklistId;
    if (coberturaModal.frequencia) params.frequencia = coberturaModal.frequencia;
    if (coberturaModal.ativo) params.cronogramaAtivo = coberturaModal.ativo;
    if (coberturaModal.responsavelId) params.responsavelId = coberturaModal.responsavelId;
    await exportar('cronograma-cobertura', coberturaModal.formato, params);
  }

  const tiposChamado = opcoes?.tiposChamado ?? [];
  const equipes = opcoes?.equipes ?? [];
  const tiposUnidade = opcoes?.tipos ?? [];
  const statusOptions = Object.entries(CHAMADO_STATUS_META);
  const activeMeta = RELATORIOS.find((item) => item.tipo === activeTipo) ?? null;
  const isLoading = Boolean(loading);

  const unidadesDaCobertura = coberturaModal.secretariaId
    ? unidades.filter((item) => item.secretaria.id === coberturaModal.secretariaId)
    : unidades;
  const checklistsDaCobertura = coberturaModal.secretariaId
    ? checklists.filter((item) => !item.secretariaId || item.secretariaId === coberturaModal.secretariaId)
    : checklists;

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
                    {formatSecretariaLabel(item)}
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
                    {formatSecretariaLabel(item)}
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
                    {formatSecretariaLabel(item)}
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

        <Sheet
          open={activeTipo === 'cronograma-cobertura'}
          onClose={closeModal}
          title="Gerar relatório de cobertura de cronogramas"
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outlined" onClick={closeModal}>
                Cancelar
              </Button>
              <Button variant="filled" disabled={isLoading} onClick={() => void gerarCobertura()}>
                {isLoading ? 'Gerando...' : 'Gerar relatório'}
              </Button>
            </div>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Secretaria">
              <Select
                value={coberturaModal.secretariaId}
                onChange={(e) =>
                  setCoberturaModal((prev) => ({ ...prev, secretariaId: e.target.value, unidadeId: '' }))
                }
              >
                <option value="">Todas</option>
                {secretarias.map((item) => (
                  <option key={item.id} value={item.id}>
                    {formatSecretariaLabel(item)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tipo de próprio">
              <Select
                value={coberturaModal.tipo}
                onChange={(e) => setCoberturaModal((prev) => ({ ...prev, tipo: e.target.value }))}
              >
                <option value="">Todos</option>
                {tiposUnidade.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {formatUnidadeTipo(tipo)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Próprio">
              <Select
                value={coberturaModal.unidadeId}
                onChange={(e) => setCoberturaModal((prev) => ({ ...prev, unidadeId: e.target.value }))}
              >
                <option value="">Todos</option>
                {unidadesDaCobertura.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Checklist">
              <Select
                value={coberturaModal.checklistId}
                onChange={(e) => setCoberturaModal((prev) => ({ ...prev, checklistId: e.target.value }))}
              >
                <option value="">Todos</option>
                {checklistsDaCobertura.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Periodicidade">
              <Select
                value={coberturaModal.frequencia}
                onChange={(e) => setCoberturaModal((prev) => ({ ...prev, frequencia: e.target.value }))}
              >
                <option value="">Todas</option>
                {CRONOGRAMA_FREQUENCIAS.map((frequencia) => (
                  <option key={frequencia} value={frequencia}>
                    {CRONOGRAMA_FREQUENCIA_LABELS[frequencia]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Situação do cronograma">
              <Select
                value={coberturaModal.ativo}
                onChange={(e) => setCoberturaModal((prev) => ({ ...prev, ativo: e.target.value }))}
              >
                <option value="">Todas</option>
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </Select>
            </Field>
            <Field label="Responsável previsto">
              <Select
                value={coberturaModal.responsavelId}
                onChange={(e) => setCoberturaModal((prev) => ({ ...prev, responsavelId: e.target.value }))}
              >
                <option value="">Todos</option>
                {responsaveis.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Formato">
              <Select
                value={coberturaModal.formato}
                onChange={(e) =>
                  setCoberturaModal((prev) => ({ ...prev, formato: e.target.value as RelatorioFormato }))
                }
              >
                <option value="pdf">PDF</option>
                <option value="csv">CSV</option>
                <option value="xlsx">Excel (XLSX)</option>
              </Select>
            </Field>
          </div>
          <p className="mt-3 text-[12px] text-[var(--ink-3)]">
            Lista todos os próprios ativos da secretaria e indica se possuem cronograma de vistoria vinculado.
            Responsáveis previstos são de acompanhamento; a execução da vistoria segue as permissões do sistema.
          </p>
        </Sheet>

        <Sheet
          open={activeTipo === 'tarefas-chamados'}
          onClose={closeModal}
          title="Gerar relatório de tarefas de chamados"
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outlined" onClick={closeModal}>
                Cancelar
              </Button>
              <Button variant="filled" disabled={isLoading} onClick={() => void gerarTarefas()}>
                {isLoading ? 'Gerando...' : 'Gerar relatório'}
              </Button>
            </div>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data inicial">
              <Input type="date" value={tarefasModal.from} onChange={(e) => setTarefasModal((prev) => ({ ...prev, from: e.target.value }))} />
            </Field>
            <Field label="Data final">
              <Input type="date" value={tarefasModal.to} onChange={(e) => setTarefasModal((prev) => ({ ...prev, to: e.target.value }))} />
            </Field>
            <Field label="Status">
              <Select value={tarefasModal.status} onChange={(e) => setTarefasModal((prev) => ({ ...prev, status: e.target.value }))}>
                <option value="">Todos</option>
                {Object.entries(TAREFA_STATUS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Prioridade">
              <Select value={tarefasModal.prioridade} onChange={(e) => setTarefasModal((prev) => ({ ...prev, prioridade: e.target.value }))}>
                <option value="">Todas</option>
                {Object.entries(TAREFA_PRIORIDADE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Secretaria da tarefa">
              <Select value={tarefasModal.secretariaId} onChange={(e) => setTarefasModal((prev) => ({ ...prev, secretariaId: e.target.value }))}>
                <option value="">Todas</option>
                {secretarias.map((item) => (
                  <option key={item.id} value={item.id}>{formatSecretariaLabel(item)}</option>
                ))}
              </Select>
            </Field>
            <Field label="Equipe">
              <Select value={tarefasModal.equipeId} onChange={(e) => setTarefasModal((prev) => ({ ...prev, equipeId: e.target.value }))}>
                <option value="">Todas</option>
                {equipes.map((item) => (
                  <option key={item.id} value={item.id}>{item.nome}</option>
                ))}
              </Select>
            </Field>
            <Field label="Responsável">
              <Select value={tarefasModal.responsavelId} onChange={(e) => setTarefasModal((prev) => ({ ...prev, responsavelId: e.target.value }))}>
                <option value="">Todos</option>
                {responsaveis.map((item) => (
                  <option key={item.id} value={item.id}>{item.nome}</option>
                ))}
              </Select>
            </Field>
            <Field label="Tipo de chamado">
              <Select value={tarefasModal.tipoChamadoId} onChange={(e) => setTarefasModal((prev) => ({ ...prev, tipoChamadoId: e.target.value }))}>
                <option value="">Todos</option>
                {tiposChamado.map((item) => (
                  <option key={item.id} value={item.id}>{item.nome}</option>
                ))}
              </Select>
            </Field>
            <Field label="Número do chamado">
              <Input value={tarefasModal.numero} onChange={(e) => setTarefasModal((prev) => ({ ...prev, numero: e.target.value }))} />
            </Field>
            <Field label="Título ou descrição">
              <Input value={tarefasModal.texto} onChange={(e) => setTarefasModal((prev) => ({ ...prev, texto: e.target.value }))} />
            </Field>
            <Field label="Situação do prazo">
              <Select value={tarefasModal.situacaoPrazo} onChange={(e) => setTarefasModal((prev) => ({ ...prev, situacaoPrazo: e.target.value }))}>
                <option value="">Todas</option>
                {SITUACOES_PRAZO.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Formato">
              <Select
                value={tarefasModal.formato}
                onChange={(e) => setTarefasModal((prev) => ({ ...prev, formato: e.target.value as RelatorioFormato }))}
              >
                <option value="pdf">PDF</option>
                <option value="csv">CSV</option>
                <option value="xlsx">Excel (XLSX)</option>
              </Select>
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-[13px] text-[var(--ink-2)]">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={tarefasModal.atrasadas} onChange={(e) => setTarefasModal((prev) => ({ ...prev, atrasadas: e.target.checked }))} />
              Atrasadas
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={tarefasModal.concluidas} onChange={(e) => setTarefasModal((prev) => ({ ...prev, concluidas: e.target.checked }))} />
              Concluídas
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={tarefasModal.canceladas} onChange={(e) => setTarefasModal((prev) => ({ ...prev, canceladas: e.target.checked }))} />
              Canceladas
            </label>
          </div>
        </Sheet>
      </PageShell>
    </RequirePermissions>
  );
}
