/**
 * 316 — integração com Postgres LOCAL descartável: opções do filtro Tipo de chamado da CCO (duas abas).
 * Só roda com ESCOPO_306_TEST_DATABASE_URL. Cria Secretarias/próprios/tipos/chamados fictícios próprios
 * (ZZTESTE 316 <sufixo>) e remove tudo no fim; não depende do seed 306.
 */
import { randomBytes } from 'node:crypto';
import { ChamadoStatus, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertBancoLocal306 } from '../../scripts/seed-escopo-306-core';
import { JwtPayload } from '../auth/jwt';
import { OperacionalController } from './operacional.controller';
import { LIMITE_CHAMADOS_MAPA, OperacionalService } from './operacional.service';

const URL = process.env.ESCOPO_306_TEST_DATABASE_URL;

describe.skipIf(!URL)('316 — Tipo de chamado disponível na CCO (Postgres local)', () => {
  let prisma: PrismaClient;
  let svc: OperacionalService;
  const suf = randomBytes(3).toString('hex').toUpperCase();
  const tag = `ZZ316${suf}`;
  const ids = { sec: [] as string[], uni: [] as string[], tipo: [] as string[], eq: [] as string[] };
  let S1: string, S2: string, U1: string, U2: string, E1: string;
  let T: Record<'aberto' | 'equipe' | 'concluido' | 'outraSec' | 'antigo' | 'alemCorte', string>;
  const global = { sub: 'g', nome: 'G', email: 'g@aion.local', permissoes: ['usuarios.gerenciar'] } as unknown as JwtPayload;
  const soS1 = () => ({ sub: 'a', nome: 'A', email: 'a@aion.local', permissoes: [], secretariaId: S1 }) as unknown as JwtPayload;
  const nomes = (r: Array<{ nome: string }>) => r.map((t) => t.nome.replace(`ZZTESTE 316 ${suf} `, ''));
  let n = 0;
  const ch = (secretariaId: string, tipoChamadoId: string, extra: Record<string, unknown> = {}) => ({
    codigo: `${tag}-${String(++n).padStart(5, '0')}`, secretariaId, tipoChamadoId, descricao: `ZZTESTE 316 ${suf}`, ...extra,
  });

  beforeAll(async () => {
    assertBancoLocal306(URL);
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: URL! }) });
    svc = new OperacionalService(prisma as never);
    const sec = async (s: string) => (await prisma.secretaria.create({ data: { sigla: `${s}${suf}`, nome: `ZZTESTE 316 ${suf} Secretaria ${s}` } })).id;
    S1 = await sec('X'); S2 = await sec('Y'); ids.sec.push(S1, S2);
    const uni = async (secretariaId: string, nome: string) =>
      (await prisma.unidadePublica.create({ data: { secretariaId, codigoPatrimonial: `${tag}-${nome}`, nome: `ZZTESTE 316 ${suf} ${nome}`, tipo: 'ESCOLA', endereco: 'Rua Fictícia', latitude: -20.5, longitude: -47.4 } })).id;
    U1 = await uni(S1, 'Escola'); U2 = await uni(S2, 'UBS'); ids.uni.push(U1, U2);
    E1 = (await prisma.equipe.create({ data: { codigo: `${tag}-EQ`, nome: `ZZTESTE 316 ${suf} Equipe`, secretariaId: S1 } })).id; ids.eq.push(E1);
    const tipo = async (k: string) => (await prisma.tipoChamado.create({ data: { nome: `ZZTESTE 316 ${suf} ${k}` } })).id;
    T = { aberto: await tipo('aberto'), equipe: await tipo('equipe'), concluido: await tipo('concluido'), outraSec: await tipo('outraSec'), antigo: await tipo('antigo'), alemCorte: await tipo('alemCorte') };
    ids.tipo.push(...Object.values(T));
    const antigo = new Date(Date.now() - 90 * 86_400_000);
    await prisma.chamado.createMany({ data: [
      ch(S1, T.aberto, { unidadeId: U1 }),
      ch(S1, T.equipe, { unidadeId: U1, equipeId: E1 }),
      ch(S1, T.concluido, { unidadeId: U1, status: ChamadoStatus.CONCLUIDO }),
      ch(S2, T.outraSec, { unidadeId: U2 }),
      ch(S1, T.antigo, { createdAt: antigo }),
      ch(S1, T.alemCorte, { createdAt: new Date(antigo.getTime() - 86_400_000) }),
      ch(S1, null as unknown as string, { unidadeId: U1 }), // sem tipo: não vira opção
    ] });
    // Conjunto maior que o corte do mapa: o tipo "alemCorte" (mais antigo) fica fora dos itens, mas é opção.
    await prisma.chamado.createMany({ data: Array.from({ length: LIMITE_CHAMADOS_MAPA }, () => ch(S1, T.aberto)) });
  }, 60_000);

  afterAll(async () => {
    if (prisma) {
      await prisma.chamado.deleteMany({ where: { codigo: { startsWith: tag } } });
      await prisma.equipe.deleteMany({ where: { id: { in: ids.eq } } });
      await prisma.unidadePublica.deleteMany({ where: { id: { in: ids.uni } } });
      await prisma.tipoChamado.deleteMany({ where: { id: { in: ids.tipo } } });
      await prisma.secretaria.deleteMany({ where: { id: { in: ids.sec } } });
    }
    await prisma?.$disconnect();
  });

  describe('aba Chamados (mesmos filtros do mapa, exceto o tipo)', () => {
    it('conjunto inteiro: inclui tipo que ficou além do corte de itens; ignora chamados sem tipo; consulta agregada com total', async () => {
      const mapa = await svc.listChamadosMapa({ search: tag }, global);
      expect(mapa.truncado).toBe(true);
      expect(mapa.items.some((i) => i.tipoChamado?.id === T.alemCorte)).toBe(false);
      const tipos = await svc.listTiposChamadoDisponiveisMapa({ search: tag }, global);
      expect(nomes(tipos)).toEqual(['aberto', 'alemCorte', 'antigo', 'concluido', 'equipe', 'outraSec']);
      expect(tipos.find((t) => t.id === T.aberto)?.total).toBe(LIMITE_CHAMADOS_MAPA + 1);
    });
    it('considera status, equipe, datas e sem/com próprio; ignora o próprio filtro de tipo', async () => {
      expect(nomes(await svc.listTiposChamadoDisponiveisMapa({ search: tag, status: ['CONCLUIDO'] }, global))).toEqual(['concluido']);
      expect(nomes(await svc.listTiposChamadoDisponiveisMapa({ search: tag, equipeIds: [E1] }, global))).toEqual(['equipe']);
      expect(nomes(await svc.listTiposChamadoDisponiveisMapa({ search: tag, diasMinimos: '60' }, global))).toEqual(['alemCorte', 'antigo']);
      expect(nomes(await svc.listTiposChamadoDisponiveisMapa({ search: tag, comUnidade: 'COM' }, global))).toEqual(['aberto', 'concluido', 'equipe', 'outraSec']);
      const comTipo = await svc.listTiposChamadoDisponiveisMapa({ search: tag, tipoChamadoId: [T.equipe] }, global);
      expect(nomes(comTipo)).toContain('aberto'); // o filtro de tipo não restringe as próprias opções
    });
    it('Secretaria: usuário só da Secretaria X não vê o tipo dos chamados da Y; sem Secretaria → vazio', async () => {
      const tipos = nomes(await svc.listTiposChamadoDisponiveisMapa({ search: tag }, soS1()));
      expect(tipos).not.toContain('outraSec');
      expect(tipos).toContain('aberto');
      const semSec = { sub: 'z', nome: 'Z', email: 'z@aion.local', permissoes: [] } as unknown as JwtPayload;
      expect(await svc.listTiposChamadoDisponiveisMapa({ search: tag }, semSec)).toEqual([]);
    });
  });

  it('endpoints HTTP: query string (valor único e lista) chega igual ao serviço', async () => {
    const ctrl = new OperacionalController(svc);
    expect(nomes(await ctrl.listTiposChamadoDisponiveisMapa(global, { search: tag, status: 'CONCLUIDO' }))).toEqual(['concluido']);
    expect(nomes(await ctrl.listTiposChamadoDisponiveisMapa(global, { search: tag, status: ['CONCLUIDO', 'ABERTO'], equipeIds: E1 }))).toEqual(['equipe']);
    expect(nomes(await ctrl.listTiposChamadoDisponiveisUnidades(global, { search: `ZZTESTE 316 ${suf}`, secretariaIds: S2 }))).toEqual(['outraSec']);
  });

  describe('aba Próprios (chamados abertos dos próprios filtrados, exceto o tipo)', () => {
    it('tipos dos chamados abertos dos próprios filtrados (concluído e sem próprio ficam de fora)', async () => {
      expect(nomes(await svc.listTiposChamadoDisponiveisUnidades({ search: `ZZTESTE 316 ${suf}` }, global))).toEqual(['aberto', 'equipe', 'outraSec']);
    });
    it('considera os outros filtros (Secretaria, equipe) e ignora o próprio tipo de chamado', async () => {
      expect(nomes(await svc.listTiposChamadoDisponiveisUnidades({ search: `ZZTESTE 316 ${suf}`, secretariaIds: [S2] }, global))).toEqual(['outraSec']);
      expect(nomes(await svc.listTiposChamadoDisponiveisUnidades({ search: `ZZTESTE 316 ${suf}`, equipeIds: [E1] }, global))).toEqual(['equipe']);
      expect(nomes(await svc.listTiposChamadoDisponiveisUnidades({ search: `ZZTESTE 316 ${suf}`, tiposChamadoId: [T.equipe] }, global))).toEqual(['aberto', 'equipe', 'outraSec']);
    });
    it('Secretaria: escopo X não vê próprios nem tipos da Y; pedido forçado da Y → vazio', async () => {
      expect(nomes(await svc.listTiposChamadoDisponiveisUnidades({ search: `ZZTESTE 316 ${suf}` }, soS1()))).toEqual(['aberto', 'equipe']);
      expect(await svc.listTiposChamadoDisponiveisUnidades({ search: `ZZTESTE 316 ${suf}`, secretariaIds: [S2] }, soS1())).toEqual([]);
    });
  });
});
