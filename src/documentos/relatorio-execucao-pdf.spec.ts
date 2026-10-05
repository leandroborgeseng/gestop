import { describe, expect, it } from 'vitest';
import { buildRelatorioExecucaoPdf } from './relatorio-execucao-pdf';
import { resolveRespostaTexto } from '../checklists/checklist-resposta-apresentacao';
import { AMOSTRA_RESPOSTAS_BANCO, CODIGOS_TECNICOS_AMOSTRA } from '../checklists/checklist-resposta-amostra';
import { contarOcorrencias, extrairTextoPdf } from '../checklists/pdf-texto';

describe('PDF de relatório de execução', () => {
  it('apresenta respostas formatadas, seção única e nenhum código técnico', async () => {
    const buffer = await buildRelatorioExecucaoPdf({
      documentoCodigo: null,
      chamadoCodigo: 'CH-1',
      tipoChamadoNome: 'Manutenção',
      secretariaLabel: 'SEDUC',
      localLabel: 'Escola',
      endereco: null,
      statusLabel: 'Concluído',
      responsavelLabel: 'João',
      equipeLabel: null,
      executadoEm: '2026-10-05T14:30:00.000Z',
      registradoPorLabel: 'João',
      origemExecucaoLabel: 'App',
      relatorio: 'Execução de teste',
      checklistNome: 'Checklist',
      checklistVersao: 1,
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
      evidenciasGerais: [],
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
