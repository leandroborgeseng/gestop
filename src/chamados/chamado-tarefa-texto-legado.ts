/**
 * 293 (decisão do Tech Lead, critério 6): texto exibido para um evento de tarefa.
 * - Evento novo: `metadata.texto` (sempre tem precedência).
 * - Conclusão legada (sem texto): `ChamadoTarefa.conclusaoTexto` (único por tarefa).
 * - Andamento legado (sem texto): `metadata.resumo` inteiro, cru, rotulado "Registro anterior" (sem dividir por " · ").
 * - Nunca usa `ChamadoTarefa.observacao` (é sobrescrita a cada andamento).
 * - Sem fonte: null (só cabeçalho e anexos; nada inventado).
 */
export type TextoEventoOrigem = 'evento' | 'conclusao' | 'registro_anterior';
export type TextoEventoTarefa = { texto: string; origem: TextoEventoOrigem } | null;

export function resolverTextoEventoTarefa(
  metadata: Record<string, unknown>,
  conclusaoTexto: string | null | undefined,
): TextoEventoTarefa {
  if (typeof metadata.texto === 'string' && metadata.texto.trim()) return { texto: metadata.texto, origem: 'evento' };
  if (metadata.acao === 'concluida' && conclusaoTexto && conclusaoTexto.trim()) return { texto: conclusaoTexto, origem: 'conclusao' };
  if (metadata.acao === 'andamento' && typeof metadata.resumo === 'string' && metadata.resumo.trim()) {
    return { texto: metadata.resumo, origem: 'registro_anterior' };
  }
  return null;
}

/** Ids das tarefas cujas conclusões legadas precisam de `conclusaoTexto`. */
export function tarefasComConclusaoLegada(metadatas: Array<Record<string, unknown>>) {
  return [
    ...new Set(
      metadatas
        .filter((m) => m.tipo === 'tarefa' && m.acao === 'concluida' && !(typeof m.texto === 'string' && m.texto.trim()))
        .map((m) => m.tarefaId)
        .filter((id): id is string => typeof id === 'string'),
    ),
  ];
}

type PrismaTarefaConclusao = {
  chamadoTarefa: { findMany(args: { where: { id: { in: string[] } }; select: { id: true; conclusaoTexto: true } }): Promise<Array<{ id: string; conclusaoTexto: string | null }>> };
};

/** Aplica o texto resolvido na metadata projetada da linha do tempo do chamado (`texto` + `textoOrigem`). */
export async function aplicarTextoTarefaNaLinhaDoTempo<T extends { metadata: Record<string, unknown> }>(
  prisma: PrismaTarefaConclusao,
  entradas: Array<{ bruta: Record<string, unknown>; saida: T }>,
) {
  const ids = tarefasComConclusaoLegada(entradas.map((e) => e.bruta));
  const conclusoes = ids.length
    ? new Map((await prisma.chamadoTarefa.findMany({ where: { id: { in: ids } }, select: { id: true, conclusaoTexto: true } })).map((t) => [t.id, t.conclusaoTexto]))
    : new Map<string, string | null>();
  for (const { bruta, saida } of entradas) {
    if (bruta.tipo !== 'tarefa') continue;
    const r = resolverTextoEventoTarefa(bruta, typeof bruta.tarefaId === 'string' ? conclusoes.get(bruta.tarefaId) : null);
    if (r) {
      saida.metadata.texto = r.texto;
      saida.metadata.textoOrigem = r.origem;
    } else {
      delete saida.metadata.texto;
      delete saida.metadata.textoOrigem;
    }
  }
  return entradas.map((e) => e.saida);
}
