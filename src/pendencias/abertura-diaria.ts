/**
 * 289: abertura automática diária do modal de Pendências.
 * O servidor decide. "Hoje" é calculado aqui, em America/Sao_Paulo, nunca no cliente.
 */
export const FUSO_PENDENCIAS = 'America/Sao_Paulo';

/** Dia civil (YYYY-MM-DD) de `agora` no fuso de São Paulo. */
export function diaSaoPaulo(agora: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_PENDENCIAS,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora);
}

/** Valor para coluna `@db.Date` (meia-noite UTC do dia civil de São Paulo). */
export function diaSaoPauloComoData(agora: Date): Date {
  return new Date(`${diaSaoPaulo(agora)}T00:00:00.000Z`);
}

export type ResumoComTotal = { total: number };

export type UsuarioUpdateManyDelegate = {
  updateMany(args: {
    where: Record<string, unknown>;
    data: { ultimaVerificacaoPendencias: Date };
  }): Promise<{ count: number }>;
};

/**
 * 1) calcula as pendências (se falhar, propaga o erro e não marca nada);
 * 2) marca o dia com update CONDICIONAL (só onde a data não é hoje) — atômico no banco:
 *    duas chamadas simultâneas: só uma afeta a linha;
 * 3) `abrir` = marcou agora (count === 1) E há pendências.
 */
export async function verificarAberturaDiaria<R extends ResumoComTotal>(input: {
  usuarioId: string;
  usuarios: UsuarioUpdateManyDelegate;
  calcular: () => Promise<R>;
  agora?: Date;
}): Promise<{ abrir: boolean; pendencias: R }> {
  const pendencias = await input.calcular();
  const hoje = diaSaoPauloComoData(input.agora ?? new Date());
  const { count } = await input.usuarios.updateMany({
    where: {
      id: input.usuarioId,
      OR: [{ ultimaVerificacaoPendencias: null }, { ultimaVerificacaoPendencias: { not: hoje } }],
    },
    data: { ultimaVerificacaoPendencias: hoje },
  });
  return { abrir: count === 1 && pendencias.total > 0, pendencias };
}
