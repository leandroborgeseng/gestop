import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CAMPOS_METADATA_HISTORICO_CHAMADO,
  projetarMetadataHistoricoChamado,
} from './chamado-historico.projecao';

/** Ficha (timeline) e PDF de detalhe — os únicos consumidores de metadata do histórico do chamado. */
const FONTES_METADATA_FICHA_E_PDF = [
  join(__dirname, '../../frontend/lib/chamado-status.ts'),
  join(__dirname, '../../frontend/components/chamados/chamado-timeline.tsx'),
  join(__dirname, '../../frontend/app/(authenticated)/chamados/page.tsx'),
  join(__dirname, 'chamados-detail-pdf.ts'),
] as const;

const AMOSTRA_CAMPO: Record<string, unknown> = {
  tipo: 'HISTORY_UPDATE',
  descricao: 'Comentário visível na ficha',
  alteracoes: [{ campo: 'status', label: 'Status', de: 'Aberto', para: 'Em triagem' }],
  observadorNome: 'Ana Observadora',
  observadorIds: ['user-obs'],
  perfilAtivo: 'Gestor',
  perfilAtivoNome: 'Gestor municipal',
  secretariaAtiva: 'Obras',
  secretariaAtivaSigla: 'SO',
  resumo: 'Resumo da tarefa',
  temAnexos: true,
  documentoCodigo: 'DOC-9',
  impedimento: true,
  impedimentoMotivo: 'Chuva',
  relatorio: 'Relatório de execução',
  distanciaMetros: 12,
  evidenciasCount: 2,
  equipeExecutora: { nome: 'Equipe Norte', codigo: 'N' },
  membrosExecutores: [{ nome: 'João', cargo: 'Técnico' }],
  membrosExternos: [{ nome: 'Maria', cargo: 'Apoio', origem: 'externo' }],
  participantes: [{ nome: 'Pedro' }],
  checklistComplementar: {
    checklistNome: 'Extra',
    respostas: [{ titulo: 'Conferiu?', valorBooleano: true }],
  },
};

function camposMetadataLidosPelaFichaEPdf(): string[] {
  const campos = new Set<string>();
  const re = /\b(?:entry\.)?metadata\.([A-Za-z_][A-Za-z0-9_]*)/g;
  for (const arquivo of FONTES_METADATA_FICHA_E_PDF) {
    const fonte = readFileSync(arquivo, 'utf8');
    for (const match of fonte.matchAll(re)) {
      campos.add(match[1]);
    }
  }
  return [...campos].sort();
}

function amostraMetadataLida(campos: string[]): Record<string, unknown> {
  const amostra: Record<string, unknown> = {};
  for (const campo of campos) {
    amostra[campo] = Object.prototype.hasOwnProperty.call(AMOSTRA_CAMPO, campo)
      ? AMOSTRA_CAMPO[campo]
      : `valor-${campo}`;
  }
  return amostra;
}

describe('projetarMetadataHistoricoChamado', () => {
  it('mantém só os campos que a ficha do chamado exibe', () => {
    const projetado = projetarMetadataHistoricoChamado({
      tipo: 'HISTORY_UPDATE',
      descricao: 'Comentário visível',
      tokenInterno: 'segredo-nao-pode-sair',
      storageKeyInterna: 'evidencias/secreto.bin',
      evidenciaIds: ['ev-1'],
    });

    expect(projetado.tipo).toBe('HISTORY_UPDATE');
    expect(projetado.descricao).toBe('Comentário visível');
    expect(projetado).not.toHaveProperty('tokenInterno');
    expect(projetado).not.toHaveProperty('storageKeyInterna');
    expect(projetado).not.toHaveProperty('evidenciaIds');
    expect(Object.keys(projetado).every((campo) => (CAMPOS_METADATA_HISTORICO_CHAMADO as readonly string[]).includes(campo))).toBe(
      true,
    );
  });

  it('preserva todos os campos que a ficha e o PDF leem e descarta o intruso', async () => {
    const lidos = camposMetadataLidosPelaFichaEPdf();
    expect(lidos.length).toBeGreaterThan(0);

    for (const campo of lidos) {
      expect(
        CAMPOS_METADATA_HISTORICO_CHAMADO as readonly string[],
        `campo lido pela ficha/PDF fora da whitelist: ${campo}`,
      ).toContain(campo);
    }

    const esperado = amostraMetadataLida(lidos);
    const projetado = projetarMetadataHistoricoChamado({
      ...esperado,
      tokenInterno: 'segredo-nao-pode-sair',
      storageKeyInterna: 'evidencias/secreto.bin',
    });

    for (const campo of lidos) {
      expect(projetado[campo], `campo ${campo} deveria sair igual`).toEqual(esperado[campo]);
    }
    expect(projetado).not.toHaveProperty('tokenInterno');
    expect(projetado).not.toHaveProperty('storageKeyInterna');

    const { buildChamadoTimelineFromHistorico } = await import('../../frontend/lib/chamado-status.js');
    const steps = buildChamadoTimelineFromHistorico(
      [
        {
          id: 'h-ficha',
          statusAnterior: null,
          statusNovo: 'ABERTO',
          motivo: 'Atualização de histórico',
          createdAt: '2026-10-01T12:00:00.000Z',
          alteradoPor: { nome: 'Admin' },
          metadata: projetado,
          anexos: [],
        },
      ],
      'ABERTO',
      '2026-10-01T12:00:00.000Z',
    );
    expect(steps[0]?.expand?.descricao).toBe(esperado.descricao);
  });
});
