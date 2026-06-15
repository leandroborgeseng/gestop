import { ChecklistItemTipo, ConformidadeStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { validateChecklistItemResponse, validateChecklistResponses } from './checklist-response.rules';

describe('checklist-response.rules', () => {
  const item = {
    id: 'item-1',
    titulo: 'Iluminacao',
    tipo: ChecklistItemTipo.TEXTO,
    obrigatorio: true,
    exigeEvidencia: false,
    opcoes: null,
  };

  it('exige resposta em item obrigatorio de texto', () => {
    const result = validateChecklistItemResponse(item, {
      itemId: 'item-1',
      conformidade: ConformidadeStatus.CONFORME,
      valorTexto: '',
      comentario: '',
      evidenciasCount: 0,
    });

    expect(result.valid).toBe(false);
  });

  it('valida valor de multipla escolha', () => {
    const multipla = {
      ...item,
      tipo: ChecklistItemTipo.MULTIPLA_ESCOLHA,
      opcoes: { opcoes: ['Sim', 'Nao'], modoExibicao: 'SELECT' },
    };

    const result = validateChecklistItemResponse(multipla, {
      itemId: 'item-1',
      conformidade: ConformidadeStatus.CONFORME,
      valorTexto: 'Talvez',
      comentario: '',
      evidenciasCount: 0,
    });

    expect(result.valid).toBe(false);
  });

  it('valida valor de escala Likert', () => {
    const likert = {
      ...item,
      tipo: ChecklistItemTipo.ESCALA_LIKERT,
      opcoes: { niveis: ['PESSIMO', 'RUIM', 'REGULAR', 'BOM', 'OTIMO'] },
    };

    const result = validateChecklistItemResponse(likert, {
      itemId: 'item-1',
      conformidade: ConformidadeStatus.CONFORME,
      valorTexto: 'INVALIDO',
      comentario: '',
      evidenciasCount: 0,
    });

    expect(result.valid).toBe(false);
  });

  it('exige todos os itens obrigatorios', () => {
    const result = validateChecklistResponses([item], []);
    expect(result.valid).toBe(false);
    expect(result.reasons[0]).toContain('obrigatorio');
  });
});
