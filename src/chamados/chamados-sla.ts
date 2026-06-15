import { ChamadoPrioridade } from '@prisma/client';

export type TipoChamadoSla = {
  slaBaixaDias: number;
  slaMediaDias: number;
  slaAltaDias: number;
  slaUrgenteDias: number;
};

export function slaDiasForPrioridade(prioridade: ChamadoPrioridade, tipo: TipoChamadoSla): number {
  switch (prioridade) {
    case ChamadoPrioridade.BAIXA:
      return tipo.slaBaixaDias;
    case ChamadoPrioridade.MEDIA:
      return tipo.slaMediaDias;
    case ChamadoPrioridade.ALTA:
      return tipo.slaAltaDias;
    case ChamadoPrioridade.URGENTE:
      return tipo.slaUrgenteDias;
    default:
      return tipo.slaMediaDias;
  }
}

export function calcularPrazoSla(dataAbertura: Date, prioridade: ChamadoPrioridade, tipo: TipoChamadoSla): Date {
  const dias = slaDiasForPrioridade(prioridade, tipo);
  const prazo = new Date(dataAbertura);
  prazo.setUTCDate(prazo.getUTCDate() + dias);
  prazo.setUTCHours(23, 59, 59, 999);
  return prazo;
}

export function prioridadeLabel(prioridade: string) {
  const map: Record<string, string> = {
    BAIXA: 'Baixa',
    MEDIA: 'Média',
    ALTA: 'Alta',
    URGENTE: 'Urgente',
  };
  return map[prioridade] ?? prioridade;
}

export function formatDateBr(value: string | Date | null | undefined) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR');
}

export type PlanejamentoAlteracao = {
  campo: string;
  label: string;
  de: string;
  para: string;
};

export function buildPlanejamentoAlteracoes(input: {
  equipeAnterior?: { nome: string } | null;
  equipeNova?: { nome: string } | null;
  previstaAnterior?: Date | null;
  previstaNova?: Date | null;
  prioridadeAnterior?: string | null;
  prioridadeNova?: string | null;
}): PlanejamentoAlteracao[] {
  const alteracoes: PlanejamentoAlteracao[] = [];

  const equipeAnterior = input.equipeAnterior?.nome ?? 'Sem equipe';
  const equipeNova = input.equipeNova?.nome ?? 'Sem equipe';
  if (equipeAnterior !== equipeNova) {
    alteracoes.push({ campo: 'equipe', label: 'Equipe', de: equipeAnterior, para: equipeNova });
  }

  const previstaAnterior = formatDateBr(input.previstaAnterior);
  const previstaNova = formatDateBr(input.previstaNova);
  if (previstaAnterior !== previstaNova) {
    alteracoes.push({
      campo: 'previstaExecucaoEm',
      label: 'Data programada',
      de: previstaAnterior,
      para: previstaNova,
    });
  }

  if (input.prioridadeAnterior && input.prioridadeNova && input.prioridadeAnterior !== input.prioridadeNova) {
    alteracoes.push({
      campo: 'prioridade',
      label: 'Prioridade',
      de: prioridadeLabel(input.prioridadeAnterior),
      para: prioridadeLabel(input.prioridadeNova),
    });
  }

  return alteracoes;
}

export function buildTriagemAlteracoes(input: {
  tipoAnterior?: { nome: string } | null;
  tipoNovo?: { nome: string } | null;
  prioridadeAnterior?: string | null;
  prioridadeNova?: string | null;
  prazoAnterior?: Date | null;
  prazoNovo?: Date | null;
}): PlanejamentoAlteracao[] {
  const alteracoes: PlanejamentoAlteracao[] = [];

  const tipoAnterior = input.tipoAnterior?.nome ?? 'Sem tipo';
  const tipoNovo = input.tipoNovo?.nome ?? 'Sem tipo';
  if (tipoAnterior !== tipoNovo) {
    alteracoes.push({
      campo: 'tipoChamado',
      label: 'Tipo de chamado',
      de: tipoAnterior,
      para: tipoNovo,
    });
  }

  if (input.prioridadeAnterior && input.prioridadeNova && input.prioridadeAnterior !== input.prioridadeNova) {
    alteracoes.push({
      campo: 'prioridade',
      label: 'Prioridade',
      de: prioridadeLabel(input.prioridadeAnterior),
      para: prioridadeLabel(input.prioridadeNova),
    });
  }

  const prazoAnterior = formatDateBr(input.prazoAnterior);
  const prazoNovo = formatDateBr(input.prazoNovo);
  if (prazoAnterior !== prazoNovo) {
    alteracoes.push({
      campo: 'prazoEm',
      label: 'Prazo SLA',
      de: prazoAnterior,
      para: prazoNovo,
    });
  }

  return alteracoes;
}
