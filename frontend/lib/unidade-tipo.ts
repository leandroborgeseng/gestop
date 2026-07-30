import { ChecklistEscopo, ChecklistModel, UnidadeTipo } from '@/lib/types';

export const UNIDADE_TIPO_LABELS: Record<string, string> = {
  ESCOLA: 'Escola',
  UBS: 'UBS',
  PRACA: 'Praça',
  PREDIO_ADMINISTRATIVO: 'Prédio administrativo',
  ESPACO_ESPORTIVO: 'Espaço esportivo',
  OUTRO: 'Outro',
};

export const CHECKLIST_ESCOPO_LABELS: Record<ChecklistEscopo, string> = {
  GLOBAL: 'Global (todos os próprios)',
  SECRETARIA: 'Por secretaria',
  UNIDADE_TIPO: 'Por tipo de próprio',
  UNIDADE: 'Por próprio específico',
};

type TipoProprioCatalog =
  | Record<string, string>
  | Map<string, string>
  | Array<{ codigo: string; nome: string }>;

function resolveFromCatalog(tipo: string, catalog?: TipoProprioCatalog): string | undefined {
  if (!catalog) return undefined;
  if (Array.isArray(catalog)) {
    return catalog.find((item) => item.codigo === tipo)?.nome;
  }
  if (catalog instanceof Map) {
    return catalog.get(tipo);
  }
  return catalog[tipo];
}

/** Label amigável: catalogo opcional → labels legado → codigo bruto. */
export function formatUnidadeTipo(tipo: UnidadeTipo | string, catalog?: TipoProprioCatalog) {
  return resolveFromCatalog(tipo, catalog) ?? UNIDADE_TIPO_LABELS[tipo] ?? tipo;
}

export function formatChecklistEscopo(escopo: ChecklistEscopo) {
  return CHECKLIST_ESCOPO_LABELS[escopo] ?? escopo;
}

export function formatChecklistVinculo(
  checklist: Pick<ChecklistModel, 'escopo' | 'unidadeTipo' | 'secretaria' | 'finalidade' | 'tiposChamado'>,
  catalog?: TipoProprioCatalog,
) {
  if (checklist.finalidade === 'CHAMADO') {
    const tipos = checklist.tiposChamado?.map((item) => item.tipoChamado.nome).filter(Boolean) ?? [];
    if (tipos.length === 0) return 'Chamado (sem tipos)';
    if (tipos.length <= 2) return `Chamado · ${tipos.join(', ')}`;
    return `Chamado · ${tipos.slice(0, 2).join(', ')} +${tipos.length - 2}`;
  }

  if (checklist.escopo === 'UNIDADE_TIPO' && checklist.unidadeTipo) {
    const tipo = formatUnidadeTipo(checklist.unidadeTipo, catalog);
    return checklist.secretaria ? `${tipo} · ${checklist.secretaria.sigla}` : tipo;
  }

  if (checklist.escopo === 'SECRETARIA' && checklist.secretaria) {
    return checklist.secretaria.sigla;
  }

  return formatChecklistEscopo(checklist.escopo);
}
