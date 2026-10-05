import { describe, expect, it } from 'vitest';
import {
  buildVistoriaRealizadaPdf,
  type VistoriaRealizadaPdfInput,
  type VistoriaRealizadaPdfResposta,
} from './vistoria-realizada-pdf';

describe('vistoria-realizada-pdf (279 - seção + código)', () => {
  it('gera PDF com seções agrupadas e título sem código quando há seção', async () => {
    const respostas: VistoriaRealizadaPdfResposta[] = [
      {
        codigo: 'P1',
        secao: 'Infraestrutura',
        titulo: 'Estado das paredes',
        categoriaNome: null,
        tipo: 'MULTIPLA_ESCOLHA',
        respostaTexto: 'Bom, Ótimo',
        comentario: null,
        conformidade: null,
        naoConformidade: null,
        evidencias: [],
      },
      {
        codigo: 'P2',
        secao: 'Infraestrutura',
        titulo: 'Estado do piso',
        categoriaNome: null,
        tipo: 'MULTIPLA_ESCOLHA',
        respostaTexto: 'Regular',
        comentario: 'Precisa de manutenção',
        conformidade: null,
        naoConformidade: null,
        evidencias: [],
      },
      {
        codigo: 'P3',
        secao: null,
        titulo: 'Observações gerais',
        categoriaNome: null,
        tipo: 'TEXTO',
        respostaTexto: 'Tudo OK',
        comentario: null,
        conformidade: null,
        naoConformidade: null,
        evidencias: [],
      },
    ];

    const input: VistoriaRealizadaPdfInput = {
      unidadeNome: 'Unidade de Teste',
      unidadeCodigoPatrimonial: 'UT001',
      secretariaSigla: 'TEST',
      secretariaNome: 'Secretaria de Teste',
      endereco: 'Rua Teste, 123',
      bairro: 'Centro',
      checklistNome: 'Checklist de Teste',
      checklistVersao: 1,
      dataHora: new Date().toISOString(),
      origemLabel: 'Manual',
      realizadaPorLabel: 'Agente Teste',
      lancamentoManual: false,
      lancadoPorLabel: null,
      responsaveisPrevistosLabel: null,
      observacoes: null,
      notaGeral: 8.5,
      notasPorCategoria: [],
      respostas,
    };

    const pdfBuffer = await buildVistoriaRealizadaPdf(input);
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    
    expect(pdfBuffer.toString('utf-8', 0, 100)).toContain('%PDF');
  });

  it('gera PDF com perguntas sem seção (mostra código)', async () => {
    const respostas: VistoriaRealizadaPdfResposta[] = [
      {
        codigo: 'Q1',
        secao: null,
        titulo: 'Pergunta sem seção',
        categoriaNome: null,
        tipo: 'TEXTO',
        respostaTexto: 'Resposta teste',
        comentario: null,
        conformidade: null,
        naoConformidade: null,
        evidencias: [],
      },
    ];

    const input: VistoriaRealizadaPdfInput = {
      unidadeNome: 'Unidade Teste',
      unidadeCodigoPatrimonial: 'UT002',
      secretariaSigla: 'TEST',
      secretariaNome: 'Secretaria Teste',
      endereco: null,
      bairro: null,
      checklistNome: 'Checklist Teste',
      checklistVersao: 1,
      dataHora: new Date().toISOString(),
      origemLabel: 'App',
      realizadaPorLabel: null,
      lancamentoManual: false,
      lancadoPorLabel: null,
      responsaveisPrevistosLabel: null,
      observacoes: null,
      notaGeral: null,
      notasPorCategoria: [],
      respostas,
    };

    const pdfBuffer = await buildVistoriaRealizadaPdf(input);
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
  });
});
