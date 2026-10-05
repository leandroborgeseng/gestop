import { describe, expect, it } from 'vitest';
import { buildVistoriaManualPdf } from './vistoria-manual-pdf';
import { CODIGOS_TECNICOS_AMOSTRA } from '../checklists/checklist-resposta-amostra';
import { contarOcorrencias, extrairTextoPdf } from '../checklists/pdf-texto';

describe('PDF de vistoria manual (impressão)', () => {
  it('usa ordem visível, agrupa seção e omite código técnico', async () => {
    const buffer = await buildVistoriaManualPdf({
      checklistNome: 'Checklist manual',
      checklistVersao: 1,
      ondeEncaminharFotos: 'WhatsApp da equipe',
      geradoEm: '2026-10-05T14:30:00.000Z',
      geradoPor: 'João',
      unidades: [
        {
          nome: 'Escola',
          codigoPatrimonial: 'EM-001',
          tipo: 'Escola',
          endereco: 'Rua 1',
          bairro: 'Centro',
          secretariaSigla: 'SEDUC',
          secretariaNome: 'Educação',
          chamadosPendentes: [],
        },
      ],
      itens: [
        {
          ordem: 1,
          codigo: 'ZZ-COD-001',
          secao: 'Infraestrutura básica',
          titulo: 'Estado das paredes internas',
          tipo: 'MULTIPLA_ESCOLHA',
          obrigatorio: true,
          exigeEvidencia: false,
          geraNaoConformidade: false,
          opcoes: { opcoes: ['Bom', 'Ótimo'] },
        },
        {
          ordem: 2,
          codigo: 'ZZ-COD-002',
          secao: 'Infraestrutura básica',
          titulo: 'Estado do piso',
          tipo: 'MULTIPLA_ESCOLHA',
          obrigatorio: false,
          exigeEvidencia: false,
          geraNaoConformidade: false,
          opcoes: { opcoes: ['Regular'] },
        },
        {
          ordem: 3,
          codigo: 'ZZ-COD-004',
          secao: null,
          titulo: 'Observações gerais adicionais',
          tipo: 'TEXTO',
          obrigatorio: false,
          exigeEvidencia: false,
          geraNaoConformidade: false,
        },
      ],
    });

    const texto = await extrairTextoPdf(buffer);
    expect(texto).toContain('1. Estado das paredes internas');
    expect(contarOcorrencias(texto, 'Infraestrutura básica')).toBe(1);
    for (const codigo of ['ZZ-COD-001', 'ZZ-COD-002', 'ZZ-COD-004']) {
      expect(texto).not.toContain(codigo);
    }
    expect(CODIGOS_TECNICOS_AMOSTRA.length).toBeGreaterThan(0);
  });
});
