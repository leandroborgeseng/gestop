/**
 * 289 · integração REAL contra Postgres local (Promise.all de verdade).
 * Roda só com DATABASE_URL apontando para localhost/127.0.0.1 (nunca produção); sem isso, é pulado (CI).
 *   DATABASE_URL=postgresql://gestop:gestop@localhost:5432/gestop289 npx vitest run src/pendencias/abertura-diaria.int.spec.ts
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { verificarAberturaDiaria } from './abertura-diaria';

const url = process.env.DATABASE_URL ?? '';
const local = /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url);

describe.skipIf(!local)('289 · integração (Postgres local)', () => {
  let prisma: PrismaClient;
  const ids: string[] = [];

  async function novoUsuario() {
    const id = randomUUID();
    await prisma.usuario.create({
      data: { id, nome: 'Teste 289', email: `teste-289-${id}@aion.local`, senhaHash: 'x' },
    });
    ids.push(id);
    return id;
  }
  const ler = async (id: string) =>
    (await prisma.usuario.findUniqueOrThrow({ where: { id }, select: { ultimaVerificacaoPendencias: true } }))
      .ultimaVerificacaoPendencias;

  beforeAll(() => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  });
  afterAll(async () => {
    if (ids.length) await prisma.usuario.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  it('duas chamadas paralelas reais: exatamente uma devolve abrir', async () => {
    for (let rodada = 0; rodada < 10; rodada++) {
      const id = await novoUsuario();
      const chamada = () =>
        verificarAberturaDiaria({ usuarioId: id, usuarios: prisma.usuario, calcular: async () => ({ total: 2 }) });
      const resultados = await Promise.all([chamada(), chamada()]);
      expect(resultados.filter((r) => r.abrir)).toHaveLength(1);
      expect(await ler(id)).not.toBeNull();
    }
  });

  it('falha no cálculo não grava a data; zero pendências grava e não abre', async () => {
    const id = await novoUsuario();
    await expect(
      verificarAberturaDiaria({ usuarioId: id, usuarios: prisma.usuario, calcular: async () => { throw new Error('boom'); } }),
    ).rejects.toThrow('boom');
    expect(await ler(id)).toBeNull();
    const r = await verificarAberturaDiaria({ usuarioId: id, usuarios: prisma.usuario, calcular: async () => ({ total: 0 }) });
    expect(r.abrir).toBe(false);
    expect(await ler(id)).not.toBeNull();
  });

  it('virada de dia (23:59 → 00:01 BRT) reabre no banco real', async () => {
    const id = await novoUsuario();
    const v = (iso: string) =>
      verificarAberturaDiaria({ usuarioId: id, usuarios: prisma.usuario, calcular: async () => ({ total: 1 }), agora: new Date(`${iso}-03:00`) });
    expect((await v('2026-10-14T23:59:00')).abrir).toBe(true);
    expect((await v('2026-10-14T23:59:30')).abrir).toBe(false);
    expect((await v('2026-10-15T00:01:00')).abrir).toBe(true);
  });
});
