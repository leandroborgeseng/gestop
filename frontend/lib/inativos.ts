/**
 * 309 (base para o 308) — padrão comum de cadastro com inativos: sanfona, Reativar e somente leitura.
 * Textos e regras puras, sem React, para reaproveitar em checklists, cronogramas e outros cadastros.
 */
export type EntidadeInativavelTextos = {
  /** Plural minúsculo usado na sanfona: "checklists", "cronogramas". */
  plural: string;
  /** Singular com artigo: "o checklist", "o cronograma". */
  singularComArtigo: string;
  /** Mensagem de somente leitura (igual à do backend). */
  somenteLeitura: string;
  confirmarInativar: string;
  confirmarReativar: string;
};

export const TEXTOS_CHECKLIST: EntidadeInativavelTextos = {
  plural: 'checklists',
  singularComArtigo: 'o checklist',
  somenteLeitura: 'Este checklist está inativo. Reative o modelo para realizar alterações',
  confirmarInativar:
    'O checklist deixa de iniciar vistorias, documentos e aplicações novas. As vistorias e documentos já existentes ficam intactos, e os cronogramas que o usam ficam sinalizados.',
  confirmarReativar:
    'O checklist volta a poder ser editado e a iniciar vistorias, documentos e aplicações novas.',
};

export function rotuloSanfonaInativos(textos: Pick<EntidadeInativavelTextos, 'plural'>, aberta: boolean, total: number) {
  return `${aberta ? 'Ocultar' : 'Mostrar'} ${textos.plural} inativos (${total})`;
}

/** Separa mantendo a ordem original; os contadores saem da mesma lista (batem com o que é exibido). */
export function separarAtivosInativos<T extends { ativo: boolean }>(itens: readonly T[]) {
  const ativos: T[] = [];
  const inativos: T[] = [];
  for (const item of itens) (item.ativo ? ativos : inativos).push(item);
  return { ativos, inativos };
}

export type AcaoStatusAtivo = 'INATIVAR' | 'REATIVAR';

/** No lugar de "Inativar", um registro inativo mostra "Reativar". */
export function acaoStatusDisponivel(registro: { ativo: boolean }): AcaoStatusAtivo {
  return registro.ativo ? 'INATIVAR' : 'REATIVAR';
}

export function rotuloAcaoStatus(acao: AcaoStatusAtivo) {
  return acao === 'INATIVAR' ? 'Inativar' : 'Reativar';
}

export function textoConfirmacaoStatus(textos: EntidadeInativavelTextos, acao: AcaoStatusAtivo) {
  return {
    titulo: `${rotuloAcaoStatus(acao)} ${textos.singularComArtigo}?`,
    descricao: acao === 'INATIVAR' ? textos.confirmarInativar : textos.confirmarReativar,
    confirmar: rotuloAcaoStatus(acao),
  };
}
