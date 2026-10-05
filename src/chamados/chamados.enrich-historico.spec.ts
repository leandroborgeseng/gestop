import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ChamadoStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JwtPayload } from '../auth/jwt';
import { ChamadosService } from './chamados.service';

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

function adminUser(): JwtPayload {
  return {
    sub: 'user-admin',
    email: 'admin@test.com',
    nome: 'Admin',
    perfis: ['Administrador do Sistema'],
    permissoes: [],
    acessoTodasSecretarias: true,
    secretariaId: null,
    perfilAtivoId: null,
  };
}

function chamadoDaFicha() {
  return {
    id: 'chamado-1',
    secretariaId: 'sec-1',
    status: ChamadoStatus.ABERTO,
    excluidoEm: null,
    equipeId: 'eq-1',
    createdAt: new Date('2026-10-01T12:00:00.000Z'),
    fotoUrl: null,
    fotoMimeType: null,
    latitude: null,
    longitude: null,
    registradoPorId: 'user-admin',
    registradoPor: { id: 'user-admin', nome: 'Admin' },
    unidade: { secretariaId: 'sec-1', latitude: null, longitude: null },
    equipe: { secretariaId: 'sec-1' },
    observadores: [],
    evidencias: [],
  };
}

function evidenciaHistorico() {
  return {
    id: 'ev-hist',
    tipo: 'FOTO',
    url: '/storage/hist.jpg',
    storageKey: 'hist.jpg',
    mimeType: 'image/jpeg',
    tamanhoBytes: 32,
    latitude: null,
    longitude: null,
    precisaoMetros: null,
    capturadaEm: new Date('2026-10-01T12:05:00.000Z'),
    metadata: { nome: 'foto-historico.jpg', descricao: 'anexo do histórico' },
  };
}

describe('enrichHistorico na ficha normal do chamado', () => {
  const prisma = {
    chamado: { findUnique: vi.fn() },
    historicoStatus: { findMany: vi.fn() },
    evidencia: { findMany: vi.fn() },
  };
  let service: ChamadosService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ChamadosService(prisma as never, {} as never, {} as never, {} as never, {} as never);
    prisma.chamado.findUnique.mockResolvedValue(chamadoDaFicha());
    prisma.evidencia.findMany.mockResolvedValue([evidenciaHistorico()]);
  });

  it('devolve os mesmos campos da whitelist que a timeline e o PDF leem, sem o intruso', async () => {
    const lidos = camposMetadataLidosPelaFichaEPdf();
    const esperado = amostraMetadataLida(lidos);
    prisma.historicoStatus.findMany.mockResolvedValue([
      {
        id: 'h-ficha',
        statusAnterior: null,
        statusNovo: 'ABERTO',
        motivo: 'Atualização de histórico',
        metadata: {
          ...esperado,
          evidenciaIds: ['ev-hist'],
          tokenInterno: 'segredo-nao-pode-sair',
        },
        createdAt: new Date('2026-10-01T12:00:00.000Z'),
        alteradoPor: { id: 'user-admin', nome: 'Admin' },
      },
      {
        id: 'h-programacao',
        statusAnterior: 'ABERTO',
        statusNovo: 'ABERTO',
        motivo: 'Programação de execução atualizada.',
        metadata: { tipo: 'programacao_update', alteracoes: esperado.alteracoes },
        createdAt: new Date('2026-10-01T13:00:00.000Z'),
        alteradoPor: { id: 'user-admin', nome: 'Admin' },
      },
    ]);

    const detalhe = await service.getChamado('chamado-1', adminUser());
    const metadata = detalhe.historico[0]?.metadata ?? {};

    expect(prisma.historicoStatus.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { entidadeTipo: 'Chamado', entidadeId: 'chamado-1' },
      }),
    );

    expect(detalhe.historico).toHaveLength(2);
    expect(detalhe.historico.map((item: { id: string }) => item.id)).toEqual(['h-ficha', 'h-programacao']);

    for (const campo of lidos) {
      expect(metadata[campo], `campo ${campo} deveria sair igual na ficha`).toEqual(esperado[campo]);
    }
    expect(metadata).not.toHaveProperty('tokenInterno');
    expect(metadata).not.toHaveProperty('evidenciaIds');
    expect(detalhe.historico[0]?.anexos).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'ev-hist', nome: 'foto-historico.jpg' })]),
    );
  });
});
