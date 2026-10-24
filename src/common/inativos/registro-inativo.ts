/**
 * 309 (e base para o 308) — padrão comum de cadastro com inativação lógica:
 * somente leitura quando inativo, Inativar/Reativar com permissão e auditoria (quem, quando, antes e depois).
 * Nada aqui apaga registro: inativar é só `ativo = false`.
 */
import { ConflictException } from '@nestjs/common';

export type AcaoStatusAtivo = 'INATIVAR' | 'REATIVAR';

export type EntidadeInativavel = {
  /** Ex.: "Este checklist está inativo. Reative o modelo para realizar alterações" */
  mensagemSomenteLeitura: string;
  /** Ex.: "Este checklist está inativo e não pode iniciar vistoria, documento ou aplicação nova." */
  mensagemNaoInicia: string;
  jaAtivo: string;
  jaInativo: string;
};

export const CHECKLIST_INATIVO: EntidadeInativavel = {
  mensagemSomenteLeitura: 'Este checklist está inativo. Reative o modelo para realizar alterações',
  mensagemNaoInicia: 'Este checklist está inativo e não pode iniciar vistoria, documento ou aplicação nova.',
  jaAtivo: 'Este checklist já está ativo.',
  jaInativo: 'Este checklist já está inativo.',
};

export class RegistroInativoException extends ConflictException {
  constructor(message: string) {
    super({ statusCode: 409, error: 'Conflict', code: 'REGISTRO_INATIVO', message });
  }
}

/** Somente leitura no backend: qualquer alteração em registro inativo responde 409 com a mensagem da entidade. */
export function assertRegistroEditavel(registro: { ativo: boolean }, entidade: EntidadeInativavel): void {
  if (!registro.ativo) throw new RegistroInativoException(entidade.mensagemSomenteLeitura);
}

/** Registro inativo não inicia uso novo (vistoria, documento, aplicação). Os já existentes não são tocados. */
export function assertRegistroPodeIniciar(registro: { ativo: boolean }, entidade: EntidadeInativavel): void {
  if (!registro.ativo) throw new RegistroInativoException(entidade.mensagemNaoInicia);
}

/** Valida a transição e devolve o novo valor de `ativo`. Repetir a mesma ação responde 409 (não gera auditoria duplicada). */
export function planejarStatusAtivo(atual: boolean, acao: AcaoStatusAtivo, entidade: EntidadeInativavel): boolean {
  if (acao === 'INATIVAR' && !atual) throw new ConflictException(entidade.jaInativo);
  if (acao === 'REATIVAR' && atual) throw new ConflictException(entidade.jaAtivo);
  return acao === 'REATIVAR';
}

/** Payload de auditoria comum (quem, quando, antes e depois). */
export function auditoriaStatusAtivo(input: {
  acao: AcaoStatusAtivo;
  usuarioId: string;
  quando: Date;
  antes: Record<string, unknown>;
  depois: Record<string, unknown>;
}) {
  const base = { evento: input.acao, usuarioId: input.usuarioId, em: input.quando.toISOString() };
  return {
    valorAntigo: { ...base, ...input.antes },
    valorNovo: { ...base, ...input.depois },
  };
}

/** dd/mm/aaaa hh:mm no fuso do usuário (America/Sao_Paulo). */
export function formatarDataHoraBr(data: Date): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(data)
      .map((x) => [x.type, x.value]),
  );
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

export type DecisaoSyncInativo =
  | { tipo: 'ATIVO' }
  | { tipo: 'ACEITA_EXISTENTE'; inativadoEm: Date; checkinEm: Date }
  | { tipo: 'REJEITA'; inativadoEm: Date | null; checkinEm: Date; mensagem: string };

/**
 * 309/C4a — sync offline contra checklist inativo. Compara o check-in registrado no aparelho com `inativadoEm`.
 * Regra de fronteira: aceita só se check-in < inativadoEm (estritamente antes). Check-in IGUAL à inativação
 * é recusado: a inativação vale a partir do instante em que foi gravada.
 * Sem `inativadoEm` (não deveria ocorrer após o backfill) → recusa, porque não há como provar que foi antes.
 */
export function decidirSyncContraInativo(
  checklist: { ativo: boolean; inativadoEm?: Date | null },
  checkinEm: Date,
): DecisaoSyncInativo {
  if (checklist.ativo) return { tipo: 'ATIVO' };
  const inativadoEm = checklist.inativadoEm ?? null;
  if (inativadoEm && checkinEm.getTime() < inativadoEm.getTime()) {
    return { tipo: 'ACEITA_EXISTENTE', inativadoEm, checkinEm };
  }
  const mensagem = inativadoEm
    ? `${CHECKLIST_INATIVO.mensagemNaoInicia} Ele foi inativado em ${formatarDataHoraBr(inativadoEm)}, antes do check-in desta vistoria (${formatarDataHoraBr(checkinEm)}). A vistoria continua salva no aparelho.`
    : `${CHECKLIST_INATIVO.mensagemNaoInicia} A data da inativação não é conhecida. A vistoria continua salva no aparelho.`;
  return { tipo: 'REJEITA', inativadoEm, checkinEm, mensagem };
}

/**
 * 309/C4a — instante de corte do sync: o check-in (`iniciadaEm`, gravado no check-in). Sem check-in, o primeiro
 * horário do aparelho no pacote (conclusão e capturas das evidências). Instantes absolutos: um ISO com
 * "-03:00" e o mesmo instante em "Z" são iguais. Sem tolerância de relógio (risco conhecido).
 */
export function instanteCorteSync(dto: {
  iniciadaEm?: string | null;
  concluidaEm?: string | null;
  respostas?: Array<{ evidencias?: Array<{ capturadaEm?: string | null }> }>;
}): Date | null {
  const valida = (v?: string | null) => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const checkin = valida(dto.iniciadaEm);
  if (checkin) return checkin;
  const candidatos = [dto.concluidaEm, ...(dto.respostas ?? []).flatMap((r) => (r.evidencias ?? []).map((e) => e.capturadaEm))]
    .map(valida)
    .filter((d): d is Date => d !== null);
  if (!candidatos.length) return null;
  return new Date(Math.min(...candidatos.map((d) => d.getTime())));
}
