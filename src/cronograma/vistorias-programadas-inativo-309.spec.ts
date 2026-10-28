/**
 * 309/C5 + 304/B-3 — `checklistInativo` também nos cards de conflito (montados por `montarItem()`),
 * inclusive a data que conflitou e saiu da recorrência. Prisma simulado; dados fictícios.
 */
import { describe, expect, it } from 'vitest';
import { JwtPayload } from '../auth/jwt';
import { CronogramaService } from './cronograma.service';

const user = { sub: 'u-ficticio', nome: 'Fictício', email: 'gestor.ficticio@aion.local', permissoes: [], acessoTodasSecretarias: true } as unknown as JwtPayload;

const cronograma = (id: string, ativo: boolean, proximaChecagemEm: Date) => ({
  id,
  unidadeId: `uni-${id}`,
  frequencia: 'MENSAL',
  proximaChecagemEm,
  ultimaChecagemEm: null,
  updatedAt: new Date('2026-10-01T12:00:00Z'),
  checklist: { id: `chk-${id}`, nome: `Checklist Fictício ${id}`, ativo },
  unidade: { id: `uni-${id}`, nome: `Próprio Fictício ${id}`, tipo: 'ESCOLA', endereco: 'Rua Fictícia', bairro: null, latitude: null, longitude: null, secretariaId: 's1', secretaria: { id: 's1', nome: 'Secretaria Fictícia', sigla: 'TF' } },
  responsavel: null,
  responsaveis: [],
});

const conflito = (cronogramaId: string, data: string) => ({
  id: `f-${cronogramaId}`,
  avulsaMotivo: 'Programação alterada',
  conflitoCronogramaId: cronogramaId,
  conflitoDataProgramada: new Date(`${data}T12:00:00`),
  conflitoCodigo: 'PROGRAMACAO_ALTERADA',
  concluidaEm: new Date(`${data}T15:00:00`),
  createdAt: new Date(`${data}T15:00:00`),
  agente: { id: 'a1', nome: 'Agente Fictício' },
});

function service(cronogramas: unknown[], avulsas: unknown[]) {
  const prisma = {
    cronogramaChecagem: { findMany: async () => cronogramas },
    fiscalizacao: { findMany: async (args: { where: { avulsaPorConflito?: boolean } }) => (args.where.avulsaPorConflito ? avulsas : []) },
  };
  return new CronogramaService(prisma as never);
}

describe('309/C5 — checklistInativo nos cards de conflito (montarItem)', () => {
  // Dia de conflito fora da recorrência mensal: o card vem SÓ do laço de conflitos (data que saiu da recorrência).
  const fora = new Date('2027-06-01T12:00:00');
  const query = { from: '2026-11-01', to: '2026-11-30' };

  it('card de conflito de checklist INATIVO vem com checklistInativo=true e a sinalização do conflito', async () => {
    const svc = service([cronograma('c1', false, fora)], [conflito('c1', '2026-11-10')]);
    const { items } = await svc.listVistoriasProgramadas(query, user);
    // 2026-11-10 não está na recorrência mensal: o card só existe pelo laço de conflitos.
    expect(items.find((i) => i.id === 'c1:2026-11-10')).toMatchObject({ checklistInativo: true, conflitoAvulsa: { fiscalizacaoId: 'f-c1' } });
  });

  it('card de conflito de checklist ATIVO vem com checklistInativo=false', async () => {
    const svc = service([cronograma('c2', true, fora)], [conflito('c2', '2026-11-12')]);
    const { items } = await svc.listVistoriasProgramadas(query, user);
    // 2026-11-12 não está na recorrência mensal: o card só existe pelo laço de conflitos.
    expect(items.find((i) => i.id === 'c2:2026-11-12')).toMatchObject({ checklistInativo: false, conflitoAvulsa: { fiscalizacaoId: 'f-c2' } });
  });

  it('card de conflito na data da recorrência (checklist inativo) também sinaliza', async () => {
    const svc = service([cronograma('c3', false, new Date('2026-11-15T12:00:00'))], [conflito('c3', '2026-11-15')]);
    const { items } = await svc.listVistoriasProgramadas(query, user);
    const card = items.find((i) => i.id === 'c3:2026-11-15');
    expect(card).toMatchObject({ checklistInativo: true, conflitoAvulsa: { fiscalizacaoId: 'f-c3' } });
  });
});
