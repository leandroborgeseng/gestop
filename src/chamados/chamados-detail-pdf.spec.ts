import { describe, expect, it } from 'vitest';
import { buildChamadoDetalhePdf } from './chamados-detail-pdf';
import { resolveRespostaTexto } from '../checklists/checklist-resposta-apresentacao';
import { extrairTextoPdf } from '../checklists/pdf-texto';

describe('PDF de detalhe do chamado (histórico de execução)', () => {
  it('apresenta checklist complementar formatado sem JSON cru', async () => {
    const buffer = await buildChamadoDetalhePdf({
      codigo: 'CH-1',
      descricao: 'Teste',
      status: 'CONCLUIDO',
      prioridade: 'MEDIA',
      origem: 'INTERNO',
      createdAt: '2026-10-05T14:30:00.000Z',
      historico: [
        {
          statusAnterior: 'EM_EXECUCAO',
          statusNovo: 'CONCLUIDO',
          motivo: null,
          createdAt: '2026-10-05T14:30:00.000Z',
          alteradoPor: { nome: 'João' },
          metadata: {
            tipo: 'execucao_conclusao',
            relatorio: 'Feito',
            checklistComplementar: {
              checklistNome: 'Complementar',
              respostas: [
                {
                  titulo: 'Estado das paredes internas',
                  valorTexto: '["Bom","Ótimo"]',
                },
              ],
            },
          },
          anexos: [],
        },
      ],
    });

    const texto = await extrairTextoPdf(buffer);
    expect(resolveRespostaTexto({ valorTexto: '["Bom","Ótimo"]' })).toBe('Bom, Ótimo');
    expect(texto).toContain('Bom, Ótimo');
    expect(texto).not.toContain('["');
  });
});
