import { resolveRespostaTexto } from './checklist-resposta-apresentacao';

/**
 * Amostra no formato gravado em RespostaChecklist.valorTexto.
 *
 * Formatos (gravação atual):
 * - Múltipla nova (≥2 opções): JSON array via serializarValoresMultiplaEscolha
 *   frontend/lib/checklist-item-opcoes.ts e src/checklists/checklist-item.rules.ts
 *   (mobile: checklist-item-card.tsx; execução: chamado-execucao-checklist.tsx).
 * - Única (nova ou antiga): string simples — seleção única grava a opção crua
 *   (`onChange({ valorTexto: opcao })` em checklist-item-card.tsx) e
 *   serializarValoresMultiplaEscolha devolve o único valor sem JSON.
 * - Texto livre: string simples.
 */
export const AMOSTRA_RESPOSTAS_BANCO = [
  {
    codigo: 'ZZ-COD-001',
    secao: 'Infraestrutura básica',
    titulo: 'Estado das paredes internas',
    categoriaNome: 'Estrutura física',
    tipo: 'MULTIPLA_ESCOLHA',
    valorTexto: '["Bom","Ótimo"]',
    comentario: 'Apenas pequenos riscos',
    conformidade: 'CONFORME' as const,
  },
  {
    codigo: 'ZZ-COD-002',
    secao: 'Infraestrutura básica',
    titulo: 'Estado do piso',
    categoriaNome: 'Estrutura física',
    tipo: 'MULTIPLA_ESCOLHA',
    valorTexto: 'Regular',
    comentario: null,
    conformidade: 'NAO_CONFORME' as const,
  },
  {
    codigo: 'ZZ-COD-003',
    secao: 'Equipamentos e mobiliário',
    titulo: 'Estado das carteiras',
    categoriaNome: 'Equipamentos',
    tipo: 'MULTIPLA_ESCOLHA',
    valorTexto: '["Bom","Regular"]',
    comentario: null,
    conformidade: 'CONFORME' as const,
  },
  {
    codigo: 'ZZ-COD-004',
    secao: null,
    titulo: 'Observações gerais adicionais',
    categoriaNome: null,
    tipo: 'TEXTO',
    valorTexto: 'Escola bem mantida no geral.',
    comentario: null,
    conformidade: null,
  },
];

export function respostasAmostraParaPdf() {
  return AMOSTRA_RESPOSTAS_BANCO.map((item) => ({
    codigo: item.codigo,
    secao: item.secao,
    titulo: item.titulo,
    categoriaNome: item.categoriaNome,
    tipo: item.tipo,
    respostaTexto: resolveRespostaTexto(item),
    comentario: item.comentario,
    conformidade: item.conformidade,
    naoConformidade: null,
    evidencias: [] as [],
  }));
}

export const CODIGOS_TECNICOS_AMOSTRA = AMOSTRA_RESPOSTAS_BANCO.map((item) => item.codigo);
