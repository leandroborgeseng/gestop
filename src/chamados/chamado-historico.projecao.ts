/**
 * Campos de metadata que a ficha do chamado (timeline e PDF) realmente exibe.
 * `enrichHistorico` e a leitura via tarefa usam o mesmo recorte — não devolver o JSON bruto.
 */
export const CAMPOS_METADATA_HISTORICO_CHAMADO = [
  'tipo',
  'descricao',
  'alteracoes',
  'observadorNome',
  'observadorIds',
  'perfilAtivo',
  'perfilAtivoNome',
  'secretariaAtiva',
  'secretariaAtivaSigla',
  'resumo',
  'temAnexos',
  'documentoCodigo',
  'impedimento',
  'impedimentoMotivo',
  'relatorio',
  'distanciaMetros',
  'evidenciasCount',
  'equipeExecutora',
  'membrosExecutores',
  'membrosExternos',
  'participantes',
  'checklistComplementar',
  // 293: linha do tempo do chamado mostra o texto do evento e de qual tarefa ele é.
  'tarefaId',
  'tarefaTitulo',
  'acao',
  'texto',
] as const;

export type CampoMetadataHistoricoChamado = (typeof CAMPOS_METADATA_HISTORICO_CHAMADO)[number];

export function projetarMetadataHistoricoChamado(metadata: unknown): Record<string, unknown> {
  const fonte =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  const projetado: Record<string, unknown> = {};
  for (const campo of CAMPOS_METADATA_HISTORICO_CHAMADO) {
    if (Object.prototype.hasOwnProperty.call(fonte, campo)) {
      projetado[campo] = fonte[campo];
    }
  }
  return projetado;
}
