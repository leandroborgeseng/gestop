import { describe, expect, it } from 'vitest';
import { buildVistoriaRealizadaPdf } from './vistoria-realizada-pdf';
import { CODIGOS_TECNICOS_AMOSTRA, respostasAmostraParaPdf } from '../checklists/checklist-resposta-amostra';
import { contarOcorrencias, extrairTextoPdf } from '../checklists/pdf-texto';

describe('PDF de vistoria realizada', () => {
  it('apresenta múltipla formatada, seção única e nenhum código técnico', async () => {
    const buffer = await buildVistoriaRealizadaPdf({
      unidadeNome: 'Escola Municipal Exemplo',
      unidadeCodigoPatrimonial: 'EM-001',
      secretariaSigla: 'SEDUC',
      secretariaNome: 'Secretaria de Educação',
      endereco: 'Rua Exemplo, 123',
      bairro: 'Centro',
      checklistNome: 'Vistoria de Infraestrutura Escolar',
      checklistVersao: 2,
      dataHora: '2026-10-05T14:30:00.000Z',
      origemLabel: 'App Mobile',
      realizadaPorLabel: 'João Silva',
      lancamentoManual: false,
      lancadoPorLabel: null,
      responsaveisPrevistosLabel: null,
      observacoes: null,
      notaGeral: null,
      notasPorCategoria: [],
      respostas: respostasAmostraParaPdf(),
    });

    const texto = await extrairTextoPdf(buffer);
    expect(texto).toContain('Bom, Ótimo');
    expect(texto).toContain('Regular');
    expect(texto).toContain('Bom, Regular');
    expect(texto).not.toContain('["');
    expect(contarOcorrencias(texto, 'Infraestrutura básica')).toBe(1);
    expect(contarOcorrencias(texto, 'Equipamentos e mobiliário')).toBe(1);
    for (const codigo of CODIGOS_TECNICOS_AMOSTRA) {
      expect(texto).not.toContain(codigo);
    }
  });
});
