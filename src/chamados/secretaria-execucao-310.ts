/**
 * 310 — troca da Secretaria responsável pela execução do chamado.
 * Regras puras: o que precisa ser revisto (equipe/responsável de outra Secretaria) e o resumo origem → destino.
 * Não altera a Secretaria do próprio público (`unidade.secretariaId`) nem limpa equipe/responsável: só orienta.
 */
export type SecretariaRef = { id: string; nome: string; sigla: string };

export type RevisaoExecucao = {
  equipe?: { id: string; nome: string; secretaria: SecretariaRef | null };
  responsavel?: { id: string; nome: string };
};

export const MSG_REVISAR_EQUIPE = 'A equipe atual é de outra Secretaria. Revise a equipe do chamado.';
export const MSG_REVISAR_RESPONSAVEL = 'O responsável atual não pertence à Secretaria de destino. Revise o responsável do chamado.';

/** Equipe sem Secretaria (global) é compatível; com Secretaria, precisa ser a de destino. */
export function equipeIncompativel(equipe: { secretariaId?: string | null } | null | undefined, destinoId: string) {
  return Boolean(equipe?.secretariaId && equipe.secretariaId !== destinoId);
}

/** Responsável compatível: acesso a todas as Secretarias, principal ou vínculo na de destino. */
export function responsavelIncompativel(
  u: { acessoTodasSecretarias?: boolean; secretariaId?: string | null; secretariasVinculos?: Array<{ secretariaId: string }> } | null | undefined,
  destinoId: string,
) {
  if (!u) return false;
  if (u.acessoTodasSecretarias) return false;
  if (u.secretariaId === destinoId) return false;
  return !(u.secretariasVinculos ?? []).some((v) => v.secretariaId === destinoId);
}

export function descricaoTransferencia(origem: SecretariaRef | null, destino: SecretariaRef) {
  return `Secretaria responsável pela execução: ${origem ? origem.sigla : '—'} → ${destino.sigla}`;
}
