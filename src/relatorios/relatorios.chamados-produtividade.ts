import { ChamadoStatus } from '@prisma/client';
import { resolveChamadoTituloDisplay } from '../chamados/chamados.rules';
import { formatIsoDate } from './relatorios.csv';
import {
  type ExecucaoParticipantesResumo,
  formatParticipantesExport,
} from './relatorios.execucao-participantes';

export type ChamadoProdutividadeItem = {
  codigo: string;
  titulo: string | null;
  descricao: string;
  status: string;
  concluidoEm: Date | null;
  prazoEm: Date | null;
  enderecoTexto?: string | null;
  enderecoBairro?: string | null;
  secretaria: { sigla: string };
  unidade: { nome: string; endereco: string | null } | null;
  tipoChamado: { nome: string } | null;
  participantesExecucao?: ExecucaoParticipantesResumo | null;
};

export type ProdutividadeSlaLabel = 'Dentro do prazo' | 'Fora do prazo' | 'Sem SLA';

export const CHAMADOS_PRODUTIVIDADE_HEADERS = [
  'codigo',
  'titulo_descricao',
  'concluido_em',
  'equipe_concluiu',
  'funcionarios',
  'cargos',
  'sla',
  'secretaria_execucao',
  'local',
  'tipo_chamado',
] as const;

export function resolveSlaConclusao(
  concluidoEm: Date | null | undefined,
  prazoEm: Date | null | undefined,
): ProdutividadeSlaLabel {
  if (!prazoEm) return 'Sem SLA';
  if (!concluidoEm) return 'Sem SLA';
  return concluidoEm.getTime() <= prazoEm.getTime() ? 'Dentro do prazo' : 'Fora do prazo';
}

export function resolveLocalChamado(item: {
  unidade: { nome: string; endereco: string | null } | null;
  enderecoTexto?: string | null;
  enderecoBairro?: string | null;
}) {
  if (item.unidade?.nome) {
    const endereco = item.unidade.endereco?.trim();
    return endereco ? `${item.unidade.nome} — ${endereco}` : item.unidade.nome;
  }
  const endereco =
    [item.enderecoTexto, item.enderecoBairro].filter((part) => part && String(part).trim()).join(' · ') ||
    '';
  return endereco || 'Sem local';
}

export function resolveSecretariaExecucao(
  item: ChamadoProdutividadeItem,
  participantes: ExecucaoParticipantesResumo | null | undefined,
) {
  const fromParticipante = participantes?.participantes.find((p) => p.secretariaSigla)?.secretariaSigla;
  if (fromParticipante) return fromParticipante;
  return item.secretaria.sigla || '—';
}

export function mapChamadoProdutividadeRow(item: ChamadoProdutividadeItem) {
  const participantes = item.participantesExecucao;
  const formatted = formatParticipantesExport(participantes ?? null);
  const sla = resolveSlaConclusao(item.concluidoEm, item.prazoEm);

  return {
    codigo: item.codigo,
    tituloDescricao: resolveChamadoTituloDisplay(item),
    concluidoEm: formatIsoDate(item.concluidoEm),
    equipe: formatted.equipe || 'Sem equipe',
    funcionarios: formatted.nomes || 'Sem funcionário',
    cargos: formatted.cargos || 'Sem cargo',
    sla,
    secretariaExecucao: resolveSecretariaExecucao(item, participantes),
    local: resolveLocalChamado(item),
    tipoChamado: item.tipoChamado?.nome ?? '—',
  };
}

export function mapChamadosProdutividadeExportRows(items: ChamadoProdutividadeItem[]) {
  return items.map((item) => {
    const row = mapChamadoProdutividadeRow(item);
    return [
      row.codigo,
      row.tituloDescricao,
      row.concluidoEm,
      row.equipe,
      row.funcionarios,
      row.cargos,
      row.sla,
      row.secretariaExecucao,
      row.local,
      row.tipoChamado,
    ];
  });
}

export type ProdutividadeTotais = {
  total: number;
  dentroPrazo: number;
  foraPrazo: number;
  semSla: number;
  porEquipe: Array<{ nome: string; total: number }>;
  porFuncionario: Array<{ nome: string; total: number }>;
  porCargo: Array<{ nome: string; total: number }>;
};

export function computeProdutividadeTotais(items: ChamadoProdutividadeItem[]): ProdutividadeTotais {
  const porEquipe = new Map<string, number>();
  const porFuncionario = new Map<string, number>();
  const porCargo = new Map<string, number>();
  let dentroPrazo = 0;
  let foraPrazo = 0;
  let semSla = 0;

  for (const item of items) {
    const row = mapChamadoProdutividadeRow(item);
    if (row.sla === 'Dentro do prazo') dentroPrazo += 1;
    else if (row.sla === 'Fora do prazo') foraPrazo += 1;
    else semSla += 1;

    porEquipe.set(row.equipe, (porEquipe.get(row.equipe) ?? 0) + 1);

    const nomes = row.funcionarios === 'Sem funcionário' ? ['Sem funcionário'] : row.funcionarios.split('; ').filter(Boolean);
    for (const nome of nomes) {
      porFuncionario.set(nome, (porFuncionario.get(nome) ?? 0) + 1);
    }

    const cargos = row.cargos === 'Sem cargo' ? ['Sem cargo'] : row.cargos.split('; ').filter(Boolean);
    for (const cargo of cargos) {
      const label = cargo.trim() || 'Sem cargo';
      porCargo.set(label, (porCargo.get(label) ?? 0) + 1);
    }
  }

  const sortEntries = (map: Map<string, number>) =>
    [...map.entries()]
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));

  return {
    total: items.length,
    dentroPrazo,
    foraPrazo,
    semSla,
    porEquipe: sortEntries(porEquipe),
    porFuncionario: sortEntries(porFuncionario),
    porCargo: sortEntries(porCargo),
  };
}

export function formatProdutividadeSummaryLines(totais: ProdutividadeTotais): string[] {
  const lines = [
    `Total concluídos: ${totais.total}`,
    `Dentro do prazo: ${totais.dentroPrazo}`,
    `Fora do prazo: ${totais.foraPrazo}`,
    `Sem SLA: ${totais.semSla}`,
  ];

  if (totais.porEquipe.length) {
    lines.push(
      `Por equipe: ${totais.porEquipe.map((item) => `${item.nome} (${item.total})`).join('; ')}`,
    );
  }
  if (totais.porFuncionario.length) {
    lines.push(
      `Por funcionário: ${totais.porFuncionario.map((item) => `${item.nome} (${item.total})`).join('; ')}`,
    );
  }
  if (totais.porCargo.length) {
    lines.push(
      `Por cargo: ${totais.porCargo.map((item) => `${item.nome} (${item.total})`).join('; ')}`,
    );
  }

  return lines;
}
