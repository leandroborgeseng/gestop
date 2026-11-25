import { startOfDay } from '../cronograma/cronograma.rules';

type CronogramaParaConflito = {
  id: string;
  unidadeId: string;
  checklistId: string;
  ativo: boolean;
  frequencia: import('@prisma/client').CronogramaFrequencia;
  proximaChecagemEm: Date;
  ultimaChecagemEm: Date | null;
  updatedAt: Date;
};

export type ConflitoProgramacao = {
  codigo: 'PROGRAMACAO_INEXISTENTE' | 'PROGRAMACAO_INATIVA' | 'PROGRAMACAO_DIVERGENTE' | 'PROGRAMACAO_JA_BAIXADA' | 'PROGRAMACAO_ALTERADA';
  mensagem: string;
};

/**
 * 304/O6 — a programação que o app levou offline ainda é a do servidor?
 * - inexistente/inativa, ou de outro próprio/checklist → conflito;
 * - já baixada no servidor para esta data (outra vistoria/avulsa) → conflito;
 * - alterada depois do download (atualizadaEm mais nova) e a data não cai mais na recorrência → conflito.
 * `null` = sem conflito (pode gravar e dar baixa).
 */
export function avaliarConflitoProgramacao(input: {
  cronograma: CronogramaParaConflito | null;
  unidadeId: string;
  checklistId: string;
  dataProgramada: string | null;
  programacaoAtualizadaEm: string | null;
  projetar: (c: CronogramaParaConflito, dia: Date) => boolean;
}): ConflitoProgramacao | null {
  const c = input.cronograma;
  if (!c) return { codigo: 'PROGRAMACAO_INEXISTENTE', mensagem: 'A programação desta vistoria não existe mais no servidor.' };
  if (!c.ativo) return { codigo: 'PROGRAMACAO_INATIVA', mensagem: 'A programação desta vistoria foi inativada no servidor.' };
  if (c.unidadeId !== input.unidadeId || c.checklistId !== input.checklistId) {
    return { codigo: 'PROGRAMACAO_DIVERGENTE', mensagem: 'A programação mudou de próprio ou de checklist no servidor.' };
  }
  if (!input.dataProgramada) return null;
  const dia = startOfDay(new Date(`${input.dataProgramada.slice(0, 10)}T12:00:00`));
  if (c.ultimaChecagemEm && startOfDay(c.ultimaChecagemEm) >= dia) {
    return { codigo: 'PROGRAMACAO_JA_BAIXADA', mensagem: 'Esta programação já foi baixada no servidor por outra vistoria.' };
  }
  const baixadoEm = input.programacaoAtualizadaEm ? new Date(input.programacaoAtualizadaEm) : null;
  if (baixadoEm && !Number.isNaN(baixadoEm.getTime()) && c.updatedAt > baixadoEm && !input.projetar(c, dia)) {
    return { codigo: 'PROGRAMACAO_ALTERADA', mensagem: 'A programação foi alterada no servidor depois do download do pacote.' };
  }
  return null;
}

export const MOTIVO_AVULSA_MIN = 5;

/** 304/O6a: regras do envio como avulsa por conflito. Retorna a mensagem de erro ou null. */
export function validarAvulsaPorConflito(input: {
  cronogramaId?: string | null;
  avulsaPorConflito?: { motivo?: string | null; cronogramaId?: string | null; dataProgramada?: string | null } | null;
}): string | null {
  const a = input.avulsaPorConflito;
  if (!a) return null;
  if (input.cronogramaId?.trim()) return 'Vistoria avulsa por conflito não pode baixar a programação (remova o cronogramaId).';
  if (!a.cronogramaId?.trim() || !a.dataProgramada) return 'Informe a programação com que a vistoria conflitou.';
  if ((a.motivo ?? '').trim().length < MOTIVO_AVULSA_MIN) return `Informe o motivo do envio como avulsa (mínimo ${MOTIVO_AVULSA_MIN} caracteres).`;
  return null;
}
