/** 310 — textos da troca de Secretaria responsável pela execução (mesmas regras do backend). */
import type { TransferenciaExecucao } from '@/lib/api';

export const MSG_REVISAR_EQUIPE = 'A equipe atual é de outra Secretaria. Revise a equipe do chamado.';
export const MSG_REVISAR_RESPONSAVEL = 'O responsável atual não pertence à Secretaria de destino. Revise o responsável do chamado.';
export const AVISO_PROPRIO_MANTIDO = 'A Secretaria responsável pelo próprio público não muda.';

export function avisosRevisao(t: TransferenciaExecucao): string[] {
  const out: string[] = [];
  if (t.revisar.equipe) out.push(`${MSG_REVISAR_EQUIPE} (${t.revisar.equipe.nome}${t.revisar.equipe.secretaria ? ` · ${t.revisar.equipe.secretaria.sigla}` : ''})`);
  if (t.revisar.responsavel) out.push(`${MSG_REVISAR_RESPONSAVEL} (${t.revisar.responsavel.nome})`);
  return out;
}

/** 310 (TL #48): acesso só pelo próprio ou pela equipe. */
export const AVISO_SOMENTE_EXECUCAO =
  'Você continua vendo este chamado (pelo próprio ou pela equipe), mas a abertura agora é da Secretaria de destino: não é possível editar, devolver ou transferir.';

export function mensagemTransferencia(t: TransferenciaExecucao) {
  const base = `Execução transferida: ${t.origem?.sigla ?? '—'} → ${t.destino.sigla}.`;
  if (t.saiuDoEscopo) return `${base} O chamado saiu da sua Secretaria ativa e foi fechado; a lista foi atualizada.`;
  if (t.somenteExecucao) return `${base} ${AVISO_SOMENTE_EXECUCAO}`;
  return base;
}
