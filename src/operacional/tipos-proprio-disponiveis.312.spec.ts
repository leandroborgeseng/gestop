import { describe, expect, it, vi } from 'vitest';
import type { JwtPayload } from '../auth/jwt';
import { OperacionalService, montarTiposProprioDisponiveis } from './operacional.service';

// Dados 100% sintéticos (312).
const SEC_A = '00000000-0000-4000-8000-00000000000a';
const SEC_B = '00000000-0000-4000-8000-00000000000b';

type U = { id: string; tipo: string; ativo: boolean; secretariaId: string; bairro: string };
const UNIDADES: U[] = [
  { id: 'u1', tipo: 'ESCOLA', ativo: true, secretariaId: SEC_A, bairro: 'Centro' },
  { id: 'u2', tipo: 'UBS', ativo: true, secretariaId: SEC_B, bairro: 'Centro' },
  { id: 'u3', tipo: 'PRACA', ativo: true, secretariaId: SEC_A, bairro: 'Norte' },
  { id: 'u4', tipo: 'GINASIO', ativo: false, secretariaId: SEC_A, bairro: 'Centro' },
  { id: 'u5', tipo: 'ACADEMIA', ativo: true, secretariaId: SEC_A, bairro: 'Centro' },
];
const CATALOGO = [
  { codigo: 'ESCOLA', nome: 'Escola' },
  { codigo: 'UBS', nome: 'UBS' },
  { codigo: 'PRACA', nome: 'Praça' },
  { codigo: 'GINASIO', nome: 'Ginásio' },
  { codigo: 'ACADEMIA', nome: 'Área de academia' },
];

/** Avalia o where gerado por buildUnidadeWhere em memória (subconjunto usado nos testes). */
function matches(u: U, where: any): boolean {
  if (where.ativo !== undefined && u.ativo !== where.ativo) return false;
  if (typeof where.secretariaId === 'string' && u.secretariaId !== where.secretariaId) return false;
  if (where.secretariaId?.in && !where.secretariaId.in.includes(u.secretariaId)) return false;
  if (typeof where.tipo === 'string' && u.tipo !== where.tipo) return false;
  if (where.tipo?.in && !where.tipo.in.includes(u.tipo)) return false;
  if (where.bairro?.equals && u.bairro.toLowerCase() !== where.bairro.equals.toLowerCase()) return false;
  return true;
}

function makeService() {
  const prisma = {
    unidadePublica: {
      findMany: vi.fn(async ({ where }: any) =>
        UNIDADES.filter((u) => matches(u, where)).map((u) => ({
          id: u.id, codigoPatrimonial: u.id, nome: u.id, tipo: u.tipo, endereco: '', bairro: u.bairro, cep: null,
          regiao: null, latitude: 0, longitude: 0, raioValidacaoMetros: 100, ativo: u.ativo,
          secretaria: { id: u.secretariaId, nome: 'S', sigla: 'S', responsavelNome: null, responsavelEmail: null },
          _count: { fiscalizacoes: 0, naoConformidades: 0, chamados: 0 },
          chamados: [],
        })),
      ),
    },
    tipoProprio: {
      findMany: vi.fn(async ({ where }: any) => CATALOGO.filter((t) => where.codigo.in.includes(t.codigo))),
    },
    fiscalizacao: { findMany: vi.fn(async () => []) },
    naoConformidade: { groupBy: vi.fn(async () => []) },
    cronogramaVistoria: { findMany: vi.fn(async () => []) },
  };
  const service = new OperacionalService(prisma as never);
  // Isola os enriquecimentos que não influenciam o tipo.
  const s = service as any;
  s.loadUltimasNotasPorUnidade = vi.fn(async () => new Map());
  s.loadVistoriasAtrasadasPorUnidade = vi.fn(async () => new Map());
  s.loadNcsSemChamadoCountPorUnidade = vi.fn(async () => new Map());
  return { service, prisma };
}

const global: JwtPayload = { sub: 'g', email: 'admin@aion.local', nome: 'Admin', perfis: [], permissoes: ['usuarios.gerenciar'] } as JwtPayload;
const soA: JwtPayload = { sub: 'a', email: 'gestor.a@aion.local', nome: 'A', perfis: [], permissoes: ['dashboard.visualizar'], secretariaId: SEC_A, secretariasIds: [SEC_A] } as JwtPayload;
const semSecretaria: JwtPayload = { sub: 'n', email: 'n@aion.local', nome: 'N', perfis: [], permissoes: ['dashboard.visualizar'] } as JwtPayload;

describe('312 · tipos de próprio disponíveis (backend)', () => {
  it('B1/B3: devolve Nome do catálogo, em ordem alfabética sem erro de acento', async () => {
    const { service } = makeService();
    const tipos = await service.listTiposProprioDisponiveis({}, global);
    expect(tipos.map((t) => t.nome)).toEqual(['Área de academia', 'Escola', 'Praça', 'UBS']);
  });

  it('B2: ignora próprios inativos e o próprio filtro de tipo, mas respeita os demais filtros', async () => {
    const { service } = makeService();
    const tipos = await service.listTiposProprioDisponiveis({ tipos: ['UBS'], bairros: ['Norte'] }, global);
    expect(tipos.map((t) => t.codigo)).toEqual(['PRACA']);
    const todos = await service.listTiposProprioDisponiveis({ tipos: ['UBS'] }, global);
    expect(todos.map((t) => t.codigo)).not.toContain('GINASIO');
    expect(todos.map((t) => t.codigo)).toContain('ESCOLA');
  });

  it('B2: situacao=INATIVA não faz aparecer tipo só de próprio inativo', async () => {
    const { service } = makeService();
    const tipos = await service.listTiposProprioDisponiveis({ situacao: 'INATIVA' }, global);
    expect(tipos.map((t) => t.codigo)).not.toContain('GINASIO');
  });

  it('B2/B4: Secretaria filtrada limita os tipos', async () => {
    const { service } = makeService();
    const tipos = await service.listTiposProprioDisponiveis({ secretariaIds: [SEC_B] }, global);
    expect(tipos).toEqual([{ codigo: 'UBS', nome: 'UBS' }]);
  });

  it('B6: usuário sem acesso à Secretaria B não vê tipos dela, mesmo pedindo pela API', async () => {
    const { service } = makeService();
    const pedidoB = await service.listTiposProprioDisponiveis({ secretariaIds: [SEC_B] }, soA);
    expect(pedidoB).toEqual([]);
    const semFiltro = await service.listTiposProprioDisponiveis({}, soA);
    expect(semFiltro.map((t) => t.codigo)).not.toContain('UBS');
    expect(await service.listTiposProprioDisponiveis({}, semSecretaria)).toEqual([]);
  });

  it('montarTiposProprioDisponiveis: sem duplicar, cai no código se não houver nome', () => {
    expect(
      montarTiposProprioDisponiveis(['b', 'a', 'b', 'Z'], [{ codigo: 'a', nome: 'Ônibus' }, { codigo: 'b', nome: 'obra' }]),
    ).toEqual([
      { codigo: 'b', nome: 'obra' },
      { codigo: 'a', nome: 'Ônibus' },
      { codigo: 'Z', nome: 'Z' },
    ]);
  });
});
