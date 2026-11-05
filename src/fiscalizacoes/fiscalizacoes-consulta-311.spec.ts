import 'reflect-metadata';
import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import type { JwtPayload } from '../auth/jwt';
import { PermissionsGuard } from '../auth/permissions.guard';
import { FiscalizacoesController } from './fiscalizacoes.controller';
import { FiscalizacoesService } from './fiscalizacoes.service';

/**
 * #311 CCO-V14 — endpoint de consulta da vistoria (GET /fiscalizacoes/:id) usado pelo modal do CCO.
 * Cobre permissão (403 no guard real), Secretaria (fora do escopo = não encontrada, sem vazar dados)
 * e vistoria excluída/inexistente (404). Dados sintéticos ZZTESTE.
 */
const SEC_A = 'sec-zzteste-a';
const SEC_B = 'sec-zzteste-b';
const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_EXCLUIDA = '22222222-2222-4222-8222-222222222222';

const vistoria = (id: string, secretariaId: string) => ({
  id,
  secretariaId,
  unidadeId: 'uni-zzteste',
  status: 'CONCLUIDA',
  origem: 'ROTINA',
  metadata: null,
  dataVistoriaInformada: null,
  realizadaPorNome: null,
  distanciaCheckinMetros: '12.5',
  checkinLatitude: '-22.9',
  checkinLongitude: '-47.06',
  checkoutLatitude: null,
  checkoutLongitude: null,
  iniciadaEm: new Date('2026-11-01T12:00:00Z'),
  concluidaEm: new Date('2026-11-01T13:00:00Z'),
  createdAt: new Date('2026-11-01T12:00:00Z'),
  updatedAt: new Date('2026-11-01T13:00:00Z'),
  agente: { id: 'u1', nome: 'ZZTESTE Agente', email: null },
  lancadoPor: null,
  secretaria: { id: secretariaId, sigla: 'ZZT', nome: 'ZZTESTE Secretaria' },
  unidade: { id: 'uni-zzteste', nome: 'ZZTESTE Próprio', codigoPatrimonial: 'ZZT-1', bairro: null, tipo: 'OUTRO' },
  checklistVersao: { id: 'cv1', versao: 2, checklist: { id: 'ck1', nome: 'ZZTESTE Checklist' } },
  respostas: [],
  evidencias: [],
  naoConformidades: [],
});

function matches(row: { id: string; secretariaId: string }, where: Record<string, unknown>) {
  if (typeof where.id === 'string' && where.id !== row.id) return false;
  const idIn = (where.id as { in?: string[] } | undefined)?.in;
  if (idIn && !idIn.includes(row.id)) return false;
  const sec = where.secretariaId as string | { in: string[] } | undefined;
  if (typeof sec === 'string' && sec !== row.secretariaId) return false;
  if (sec && typeof sec === 'object' && !sec.in.includes(row.secretariaId)) return false;
  return true;
}

function makeService() {
  // Banco fake: só a vistoria de SEC_A existe; a "excluída" foi removida (não está mais no banco).
  const rows = [vistoria(ID_A, SEC_A)];
  const writes: string[] = [];
  const prisma = {
    fiscalizacao: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => rows.find((r) => matches(r, where)) ?? null,
      create: async () => writes.push('create'),
      update: async () => writes.push('update'),
      delete: async () => writes.push('delete'),
    },
    cronogramaChecagem: { findMany: async () => [] },
  };
  const service = new FiscalizacoesService(prisma as never, {} as never, {} as never, {} as never, {} as never);
  return { service, writes };
}

const user = (over: Partial<JwtPayload>): JwtPayload => ({
  sub: 'u',
  nome: 'ZZTESTE',
  email: 'zzteste@aion.local',
  perfis: ['TESTE'],
  permissoes: ['dashboard.visualizar'],
  ...over,
});

describe('#311 CCO-V14 — GET /fiscalizacoes/:id (consulta do modal)', () => {
  describe('permissão (guard real)', () => {
    const guard = new PermissionsGuard(new Reflector());
    const ctx = (permissoes: string[]) =>
      ({
        getHandler: () => FiscalizacoesController.prototype.getById,
        getClass: () => FiscalizacoesController,
        switchToHttp: () => ({ getRequest: () => ({ user: user({ permissoes }) }) }),
      }) as unknown as ExecutionContext;

    it('perfis com acesso à consulta passam (CCO / execução / gestão de chamados)', () => {
      for (const p of ['dashboard.visualizar', 'fiscalizacoes.executar', 'chamados.gerenciar']) {
        expect(guard.canActivate(ctx([p]))).toBe(true);
      }
    });

    it('perfil sem acesso à vistoria recebe 403', () => {
      expect(() => guard.canActivate(ctx(['chamados.abrir', 'meus_chamados.visualizar']))).toThrow(ForbiddenException);
      expect(() => guard.canActivate(ctx([]))).toThrow(ForbiddenException);
    });
  });

  describe('Secretaria', () => {
    it('mesma Secretaria ativa abre a vistoria com o mesmo id', async () => {
      const { service, writes } = makeService();
      const out = await service.getById(ID_A, user({ secretariaId: SEC_A }));
      expect(out.id).toBe(ID_A);
      expect(out.checkinLatitude).toBeCloseTo(-22.9);
      expect(out.distanciaCheckinMetros).toBe(12.5);
      expect(writes).toEqual([]); // CCO-V6: consulta não escreve
    });

    it('outra Secretaria não recebe dados (404, sem vazar existência)', async () => {
      const { service } = makeService();
      await expect(service.getById(ID_A, user({ secretariaId: SEC_B }))).rejects.toThrow(NotFoundException);
      await expect(service.getById(ID_A, user({ secretariasIds: [SEC_B] }))).rejects.toThrow(NotFoundException);
    });

    it('sem Secretaria vinculada e sem modo global não recebe dados', async () => {
      const { service } = makeService();
      await expect(service.getById(ID_A, user({}))).rejects.toThrow(NotFoundException);
    });

    it('global real (todas as Secretarias) abre', async () => {
      const { service } = makeService();
      const out = await service.getById(ID_A, user({ acessoTodasSecretarias: true }));
      expect(out.id).toBe(ID_A);
    });
  });

  describe('vistoria excluída', () => {
    it('não abre por id na consulta padrão (404)', async () => {
      const { service } = makeService();
      await expect(service.getById(ID_EXCLUIDA, user({ acessoTodasSecretarias: true }))).rejects.toThrow(
        'Vistoria não encontrada.',
      );
    });
  });

  it('CCO-V3: respostas ordenadas pela ordem do item na versão gravada', async () => {
    let orderBy: unknown;
    const prisma = {
      fiscalizacao: {
        findFirst: async (args: { include: { respostas: { orderBy: unknown } } }) => {
          orderBy = args.include.respostas.orderBy;
          return null;
        },
      },
    };
    const service = new FiscalizacoesService(prisma as never, {} as never, {} as never, {} as never, {} as never);
    await service.getById(ID_A, user({ acessoTodasSecretarias: true })).catch(() => undefined);
    expect(orderBy).toEqual([{ item: { ordem: 'asc' } }, { respondidoEm: 'asc' }]);
  });
});
