import { describe, expect, it } from 'vitest';
import { buildDocumentoPdf } from './documentos-pdf';
import { resolveRespostaTexto } from '../checklists/checklist-resposta-apresentacao';
import { AMOSTRA_RESPOSTAS_BANCO, CODIGOS_TECNICOS_AMOSTRA } from '../checklists/checklist-resposta-amostra';
import { contarOcorrencias, extrairTextoPdf } from '../checklists/pdf-texto';

describe('PDF de documento', () => {
  it('apresenta múltipla formatada, seção única e nenhum código técnico', async () => {
    const buffer = await buildDocumentoPdf({
      codigo: 'DOC-TESTE',
      codigoValidacao: 'VAL',
      codigoVerificador: 'VER',
      tipoLabel: 'Avulso',
      situacaoLabel: 'Concluído',
      origemLabel: 'Avulso',
      titulo: 'Documento de teste',
      secretariaLabel: 'SEDUC',
      unidadeLabel: 'EM-001 Escola',
      endereco: null,
      chamadoCodigo: null,
      vistoriaLabel: null,
      checklistLabel: 'Checklist v1',
      responsavelLabel: 'João',
      criadoEm: '2026-10-05T14:30:00.000Z',
      geradoEm: '2026-10-05T14:30:00.000Z',
      validationUrl: 'https://example.invalid/validar',
      hashResumo: null,
      respostas: AMOSTRA_RESPOSTAS_BANCO.map((item) => ({
        codigo: item.codigo,
        secao: item.secao,
        titulo: item.titulo,
        tipo: item.tipo,
        respostaTexto: resolveRespostaTexto(item),
        comentario: item.comentario,
        conformidade: item.conformidade,
        evidencias: [],
      })),
      incluirAssinaturas: false,
      incluirBlocoAutenticidade: false,
    });

    const texto = await extrairTextoPdf(buffer);
    expect(texto).toContain('Bom, Ótimo');
    expect(texto).not.toContain('["');
    expect(contarOcorrencias(texto, 'Infraestrutura básica')).toBe(1);
    for (const codigo of CODIGOS_TECNICOS_AMOSTRA) {
      expect(texto).not.toContain(codigo);
    }
  });
});
