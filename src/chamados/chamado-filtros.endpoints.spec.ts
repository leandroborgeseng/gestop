/**
 * 295 · Os dois endpoints com o filtro "Data de abertura": GET /chamados (Triagem) e GET /operacional/chamados-mapa (CCO).
 * Prisma falso que avalia o where em memória — prova o mesmo conjunto de IDs nas duas telas.
 */
import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { JwtPayload } from '../auth/jwt';
import { resolveChamadoSecretariaFilter } from '../auth/secretaria-scope';
import { OperacionalService, LIMITE_CHAMADOS_MAPA } from '../operacional/operacional.service';
import { ChamadosService } from './chamados.service';
import { MSG_PERIODO_INVERTIDO } from './chamado-filtros';

type Row = Record<string, unknown> & { id: string; createdAt: Date };

function casa(row: Record<string, unknown>, where: unknown): boolean {
  if (!where || typeof where !== 'object') return true;
  return Object.entries(where as Record<string, unknown>).every(([k, cond]) => {
    if (k === 'AND') return (cond as unknown[]).every((w) => casa(row, w));
    if (k === 'OR') return (cond as unknown[]).some((w) => casa(row, w));
    if (k === 'NOT') return !casa(row, cond);
    const v = row[k];
    if (cond === null) return v == null;
    if (cond instanceof Date || typeof cond !== 'object') return v === cond;
    const c = cond as Record<string, unknown>;
    if ('in' in c && !(c.in as unknown[]).includes(v)) return false;
    if ('not' in c && (c.not === null ? v == null : v === c.not)) return false;
    const n = v instanceof Date ? v.getTime() : (v as number);
    const t = (x: unknown) => (x instanceof Date ? x.getTime() : (x as number));
    if ('lt' in c && !(v != null && n < t(c.lt))) return false;
    if ('lte' in c && !(v != null && n <= t(c.lte))) return false;
    if ('gt' in c && !(v != null && n > t(c.gt))) return false;
    if ('gte' in c && !(v != null && n >= t(c.gte))) return false;
    return true;
  });
}

function ordenar(rows: Row[], orderBy: unknown) {
  const regras = (Array.isArray(orderBy) ? orderBy : [orderBy]) as Array<Record<string, 'asc' | 'desc'>>;
  return [...rows].sort((a, b) => {
    for (const r of regras) {
      const [campo, dir] = Object.entries(r)[0];
      const x = a[campo] instanceof Date ? (a[campo] as Date).getTime() : (a[campo] as string);
      const y = b[campo] instanceof Date ? (b[campo] as Date).getTime() : (b[campo] as string);
      if (x < y) return dir === 'asc' ? -1 : 1;
      if (x > y) return dir === 'asc' ? 1 : -1;
    }
    return 0;
  });
}

function prismaFalso(rows: Row[]) {
  const findMany = vi.fn(async (args: { where: unknown; orderBy: unknown; take?: number; skip?: number }) => {
    const r = ordenar(rows.filter((row) => casa(row, args.where)), args.orderBy);
    return r.slice(args.skip ?? 0, (args.skip ?? 0) + (args.take ?? r.length));
  });
  const count = vi.fn(async (args: { where: unknown }) => rows.filter((row) => casa(row, args.where)).length);
  const groupBy = vi.fn(async (args: { where: unknown }) => {
    const m = new Map<string, number>();
    for (const row of rows.filter((x) => casa(x, args.where))) m.set(row.status as string, (m.get(row.status as string) ?? 0) + 1);
    return [...m].map(([status, n]) => ({ status, _count: { _all: n } }));
  });
  return { chamado: { findMany, count, groupBy } };
}

function servicos(rows: Row[]) {
  const prisma = prismaFalso(rows);
  const chamados = new ChamadosService(prisma as never, {} as never, {} as never, {} as never, {} as never);
  vi.spyOn(chamados as never as { serializeChamado: (c: Row) => unknown }, 'serializeChamado').mockImplementation((c: Row) => ({ id: c.id }));
  vi.spyOn(chamados as never as { includeRelations: () => unknown }, 'includeRelations').mockReturnValue({});
  const operacional = new OperacionalService(prisma as never);
  return { prisma, chamados, operacional };
}

const global: JwtPayload = { sub: 'u1', email: 'a@aion.local', nome: 'A', perfis: [], permissoes: [], acessoTodasSecretarias: true } as JwtPayload;
const daSecretaria: JwtPayload = { ...global, acessoTodasSecretarias: false, secretariaId: 'sec-1' } as JwtPayload;

function chamado(id: string, createdAt: string, extra: Partial<Row> = {}): Row {
  return {
    id, codigo: id, titulo: id, descricao: null, status: 'ABERTO', prioridade: 'MEDIA', origem: 'INTERNO', prazoEm: null,
    previstaExecucaoEm: null, enderecoTexto: null, enderecoBairro: null, latitude: null, longitude: null, excluidoEm: null,
    secretaria: null, unidade: null, equipe: null, tipoChamado: null, responsavel: null, unidadeId: null,
    createdAt: new Date(createdAt), ...extra,
  };
}

// Franca: 30/09 22h (01/10 01h UTC), 01/10 00h30 (03h30 UTC), 15/10 10h.
const base = () => [
  chamado('c-30-22h', '2026-10-01T01:00:00.000Z'),
  chamado('c-01-0030', '2026-10-01T03:30:00.000Z', { status: 'EM_EXECUCAO' }),
  chamado('c-15', '2026-10-15T13:00:00.000Z'),
  chamado('c-concl', '2026-09-01T12:00:00.000Z', { status: 'CONCLUIDO' }),
  chamado('c-excl', '2026-10-01T12:00:00.000Z', { excluidoEm: new Date('2026-10-02T00:00:00Z') }),
];

const idsTriagem = async (s: ReturnType<typeof servicos>, q: Record<string, string>, user = global) =>
  ((await s.chamados.listChamados({ all: true, ...q }, user)).items as Array<{ id: string }>).map((i) => i.id).sort();
const idsCco = async (s: ReturnType<typeof servicos>, q: Record<string, string>, user = global, agora?: Date) =>
  (await s.operacional.listChamadosMapa(q, user, agora)).items.map((i) => i.id).sort();

describe('295 · GET /chamados (Triagem) com Data de abertura', () => {
  it('período inclusivo no dia de Franca; excluídos continuam fora', async () => {
    const s = servicos(base());
    expect(await idsTriagem(s, { abertoAte: '2026-09-30' })).toEqual(['c-30-22h', 'c-concl']);
    expect(await idsTriagem(s, { abertoDe: '2026-10-01' })).toEqual(['c-01-0030', 'c-15']);
    expect(await idsTriagem(s, { abertoDe: '2026-10-01', abertoAte: '2026-10-01' })).toEqual(['c-01-0030']);
  });
  it('soma com os outros filtros (AND) e os contadores por status incluem o período', async () => {
    const s = servicos(base());
    const r = await s.chamados.listChamados({ all: true, abertoDe: '2026-09-30', statuses: 'ABERTO' }, global);
    expect((r.items as Array<{ id: string }>).map((i) => i.id)).toEqual(['c-15', 'c-30-22h']);
    expect(r.total).toBe(2);
    expect(r.statusCounts).toEqual({ TODOS: 3, ABERTO: 2, EM_EXECUCAO: 1 });
  });
  it('paginação: o total respeita o período e a ordem é createdAt desc, id desc', async () => {
    const rows = [chamado('b', '2026-10-10T12:00:00Z'), chamado('a', '2026-10-10T12:00:00Z'), chamado('c', '2026-10-11T12:00:00Z'), chamado('d', '2026-09-01T12:00:00Z')];
    const s = servicos(rows);
    const p1 = await s.chamados.listChamados({ limit: 2, offset: 0, abertoDe: '2026-10-01' }, global);
    const p2 = await s.chamados.listChamados({ limit: 2, offset: 2, abertoDe: '2026-10-01' }, global);
    expect([p1.total, p1.hasMore, p2.hasMore]).toEqual([3, true, false]);
    expect([...(p1.items as Array<{ id: string }>), ...(p2.items as Array<{ id: string }>)].map((i) => i.id)).toEqual(['c', 'b', 'a']);
    expect(s.prisma.chamado.findMany.mock.calls[0][0].orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
  });
  it('rápido: o servidor calcula com o relógio dele; exatamente N dias não entra', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-31T01:00:00.000Z'));
    try {
      const s = servicos([chamado('exato', '2026-10-01T01:00:00.000Z'), chamado('mais1min', '2026-10-01T00:59:00.000Z')]);
      expect(await idsTriagem(s, { diasMinimos: '30' })).toEqual(['mais1min']);
    } finally {
      vi.useRealTimers();
    }
  });
  it('inicial > final: 400 com a mensagem e nenhuma consulta', async () => {
    const s = servicos(base());
    await expect(s.chamados.listChamados({ abertoDe: '2026-10-02', abertoAte: '2026-10-01' }, global)).rejects.toEqual(new BadRequestException(MSG_PERIODO_INVERTIDO));
    expect(s.prisma.chamado.findMany).not.toHaveBeenCalled();
  });
  it('M1: ano 0202 (digitação incompleta) → 400 e nenhuma consulta', async () => {
    const s = servicos(base());
    await expect(s.chamados.listChamados({ abertoDe: '0202-09-05' }, global)).rejects.toEqual(new BadRequestException('Data inicial inválida.'));
    await expect(s.chamados.listChamados({ abertoAte: '0202-09-05' }, global)).rejects.toEqual(new BadRequestException('Data final inválida.'));
    expect(s.prisma.chamado.findMany).not.toHaveBeenCalled();
  });
  it('escopo da secretaria e exclusão lógica continuam no where', async () => {
    const s = servicos(base());
    await s.chamados.listChamados({ abertoDe: '2026-10-01' }, daSecretaria);
    const json = JSON.stringify(s.prisma.chamado.findMany.mock.calls[0][0].where);
    expect(json).toContain(JSON.stringify(resolveChamadoSecretariaFilter(daSecretaria)));
    expect(json).toContain('"excluidoEm":null');
    expect(json).toContain('"createdAt":{"gte":"2026-10-01T03:00:00.000Z"}');
  });
});

describe('295 · GET /operacional/chamados-mapa (CCO) com Data de abertura', () => {
  it('mesmos IDs que a Triagem para os mesmos filtros (lista, mapa e calor usam esses itens)', async () => {
    const agora = new Date();
    for (const q of <Array<Record<string, string>>>[{ abertoAte: '2026-09-30' }, { abertoDe: '2026-10-01' }, { abertoDe: '2026-10-01', abertoAte: '2026-10-01' }, { diasMinimos: '10' }, {}]) {
      const s = servicos(base());
      expect(await idsCco(s, q, global, agora)).toEqual(await idsTriagem(s, q));
    }
  });
  it('soma com status (padrão Não finalizados) e SLA', async () => {
    const s = servicos(base());
    expect(await idsCco(s, { abertoDe: '2026-09-01', status: ['ABERTO', 'EM_EXECUCAO'] } as never)).toEqual(['c-01-0030', 'c-15', 'c-30-22h']);
  });
  it('total real, truncado e corte determinístico (createdAt desc, id desc)', async () => {
    const rows = Array.from({ length: LIMITE_CHAMADOS_MAPA + 5 }, (_, i) => chamado(`id-${String(i).padStart(5, '0')}`, '2026-10-10T12:00:00Z'));
    const s = servicos(rows);
    const r = await s.operacional.listChamadosMapa({}, global);
    expect(LIMITE_CHAMADOS_MAPA).toBe(2000);
    expect([r.items.length, r.total, r.truncado]).toEqual([2000, 2005, true]);
    expect(r.items[0].id).toBe('id-02004');
    expect(r.items.at(-1)!.id).toBe('id-00005');
    expect(s.prisma.chamado.findMany.mock.calls[0][0]).toMatchObject({ take: 2000, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    const menor = await servicos(rows.slice(0, 2000)).operacional.listChamadosMapa({}, global);
    expect([menor.total, menor.truncado]).toEqual([2000, false]);
  });
  it('SLA é aplicado antes do corte (no where), com a mesma regra de antes', async () => {
    const agora = new Date('2026-10-16T15:00:00');
    const hoje = new Date('2026-10-16T09:00:00');
    const amanha = new Date('2026-10-17T09:00:00');
    const rows = [
      ...Array.from({ length: LIMITE_CHAMADOS_MAPA }, (_, i) => chamado(`dentro-${i}`, '2026-10-12T12:00:00Z', { prazoEm: amanha })),
      chamado('fora-velho', '2026-01-01T12:00:00Z', { prazoEm: hoje }),
      chamado('concl-velho', '2026-01-01T12:00:00Z', { prazoEm: hoje, status: 'CONCLUIDO' }),
    ];
    const s = servicos(rows);
    const fora = await s.operacional.listChamadosMapa({ sla: 'FORA' }, global, agora);
    expect([fora.items.map((i) => i.id), fora.total, fora.truncado]).toEqual([['fora-velho'], 1, false]);
    expect(fora.items[0].slaMapa).toBe('FORA');
    const dentro = await s.operacional.listChamadosMapa({ sla: 'DENTRO' }, global, agora);
    expect([dentro.total, dentro.truncado, dentro.items.every((i) => i.slaMapa === 'DENTRO')]).toEqual([2000, false, true]);
  });
  it('inicial > final: 400 com a mensagem e nenhuma consulta; rápido inválido também', async () => {
    const s = servicos(base());
    await expect(s.operacional.listChamadosMapa({ abertoDe: '2026-10-02', abertoAte: '2026-10-01' }, global)).rejects.toEqual(new BadRequestException(MSG_PERIODO_INVERTIDO));
    await expect(s.operacional.listChamadosMapa({ diasMinimos: '7' }, global)).rejects.toBeInstanceOf(BadRequestException);
    expect(s.prisma.chamado.findMany).not.toHaveBeenCalled();
  });
  it('M1: ano 0202 (digitação incompleta) → 400 e nenhuma consulta', async () => {
    const s = servicos(base());
    await expect(s.operacional.listChamadosMapa({ abertoDe: '0202-09-05' }, global)).rejects.toEqual(new BadRequestException('Data inicial inválida.'));
    expect(s.prisma.chamado.findMany).not.toHaveBeenCalled();
  });
  it('escopo da secretaria e exclusão lógica continuam no where', async () => {
    const s = servicos(base());
    await s.operacional.listChamadosMapa({ diasMinimos: '30' }, daSecretaria, new Date('2026-10-16T12:00:00Z'));
    const where = s.prisma.chamado.findMany.mock.calls[0][0].where as { AND: unknown[] };
    expect(where.AND.slice(0, 2)).toEqual([{ excluidoEm: null }, resolveChamadoSecretariaFilter(daSecretaria)]);
    expect(where.AND).toContainEqual({ createdAt: { lt: new Date('2026-09-16T12:00:00Z') } });
    expect(s.prisma.chamado.count.mock.calls[0][0].where).toBe(where);
  });
});
