/**
 * 296 — integração com Postgres descartável. Só roda com WEBMAP_CAMADAS_TEST_DATABASE_URL
 * (banco local de teste, migrado e com seed). Usa só fixtures locais (sem rede).
 */
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { aplicar, FonteMudouError, ImportacaoEmAndamentoError, simular } from './core';
import { DiretorioWebmapFonte } from './source';
import { WebmapCamadasService } from './webmap-camadas.service';

const URL = process.env.WEBMAP_CAMADAS_TEST_DATABASE_URL;
const FIX = join(__dirname, '../../test/fixtures/webmap-camadas');
const fonte = (v: string) => new DiretorioWebmapFonte(join(FIX, v));
const OPERACIONAIS = ['UnidadePublica', 'Secretaria', 'Chamado'];
const WEBMAP = ['WebmapCamadaGrupo', 'WebmapCamada', 'WebmapElemento', 'WebmapIcone'];

describe.skipIf(!URL)('296 — importação de camadas Webmap (Postgres)', () => {
  let prisma: PrismaClient;
  let todas: string[] = [];
  const evidencias: Record<string, unknown> = {};

  const md5 = async (tables: string[]) => {
    const out: Record<string, string> = {};
    for (const t of tables) {
      const [r] = await prisma.$queryRawUnsafe<Array<{ h: string }>>(`SELECT md5(coalesce(string_agg(x::text, '|' ORDER BY x::text), '')) AS h FROM "${t}" x`);
      out[t] = r.h;
    }
    return out;
  };
  const camada = (chave: string) => prisma.webmapCamada.findUnique({ where: { chaveOrigem: chave } });
  const user = { sub: '', nome: 'Tester 296', email: 't@aion.local', perfis: [], permissoes: [] };
  const icones = async (_b: Buffer, _m: string, sha: string) => ({ storageKey: `webmap-icones/${sha}`, url: `/storage/webmap-icones/${sha}` });

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: URL! }) });
    await prisma.$executeRawUnsafe('TRUNCATE "WebmapElemento","WebmapCamada","WebmapCamadaGrupo","WebmapIcone"');
    await prisma.logAuditoria.deleteMany({ where: { entidadeTipo: 'WebmapCamadasImport' } });
    const rows = await prisma.$queryRawUnsafe<Array<{ t: string }>>(`SELECT tablename AS t FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`);
    todas = rows.map((r) => r.t).sort();
    const u = await prisma.usuario.findFirst({ select: { id: true } });
    user.sub = u?.id ?? '';
    const ops = await md5(OPERACIONAIS);
    evidencias.inicio = ops;
  });
  afterAll(async () => {
    console.log('EVIDENCIAS_296', JSON.stringify(evidencias, null, 1));
    await prisma?.$disconnect();
  });

  it('simulação não grava nada (md5 de TODAS as tabelas igual)', async () => {
    const antes = await md5(todas);
    const { resultado } = await simular(prisma, fonte('v1'));
    expect(await md5(todas)).toEqual(antes);
    expect(resultado).toMatchObject({ grupos: 6, camadas: 8, novas: 8, totalErros: 0, elementos: { pontos: 6, linhas: 1, poligonos: 4, total: 11 } });
    evidencias.simulacao_v1 = { todasIguais: true, tabelas: todas.length };
  });

  it('serviço: simulação grava exatamente 1 linha de log SIMULACAO e nada mais', async () => {
    const service = new WebmapCamadasService(prisma as never, {} as never);
    service.usarFonte(fonte('v1'));
    const semLog = todas.filter((t) => t !== 'LogAuditoria');
    const antes = await md5(semLog);
    const logAntes = await md5(['LogAuditoria']);
    const n0 = await prisma.logAuditoria.count();
    const ids0 = (await prisma.logAuditoria.findMany({ select: { id: true } })).map((r) => r.id);
    await service.simular(user);
    expect(await md5(semLog)).toEqual(antes);
    expect(await prisma.logAuditoria.count()).toBe(n0 + 1);
    const novo = await prisma.logAuditoria.findFirst({ where: { id: { notIn: ids0 } } });
    expect(novo?.valorNovo).toMatchObject({ tipo: 'SIMULACAO', resultado: 'SUCESSO', usuario: 'Tester 296' });
    expect(String((novo?.valorNovo as { dataHoraBrt: string }).dataHoraBrt)).toMatch(/\(BRT\)$/);
    expect(await prisma.$queryRawUnsafe(`SELECT md5(coalesce(string_agg(x::text,'|' ORDER BY x::text),'')) h FROM "LogAuditoria" x WHERE id <> '${novo!.id}'`)).toEqual([{ h: logAntes.LogAuditoria }]);
  });

  it('aplicar v1: cria tudo; operacionais idênticos; reaplicar sem mudança não duplica', async () => {
    const ops = await md5(OPERACIONAIS);
    const { resultado } = await simular(prisma, fonte('v1'));
    const t0 = Date.now();
    const r = await aplicar(prisma, fonte('v1'), resultado, { icones });
    evidencias.aplicar_v1_ms = Date.now() - t0;
    expect(r).toMatchObject({ resultado: 'SUCESSO', novas: 8, icones: 1 });
    expect(await prisma.webmapCamada.count()).toBe(8);
    expect(await prisma.webmapElemento.count()).toBe(11);
    expect(await md5(OPERACIONAIS)).toEqual(ops);
    const lote = await prisma.webmapCamada.findMany({ where: { chaveOrigem: { startsWith: 'AREAS_PUBLICAS/LOTE' } } });
    expect(lote.map((l) => l.chaveOrigem).sort()).toEqual(['AREAS_PUBLICAS/LOTE#POINT', 'AREAS_PUBLICAS/LOTE#POLYGON']);
    const pv = await camada('PONTOS_VICIADOS/PONTO_VICIADO');
    expect(pv?.estilo).toMatchObject({ tipo: 'icon', icone: { origem: 'styles/ponto_viciado.svg', url: expect.stringMatching(/^\/storage\/webmap-icones\/[0-9a-f]{64}$/) } });
    expect(pv?.estiloOriginal).toContain('ol.style.Icon');

    const webAntes = await md5(WEBMAP);
    const s2 = (await simular(prisma, fonte('v1'))).resultado;
    expect(s2).toMatchObject({ semMudanca: 8, novas: 0, atualizadas: 0, removidasOrigem: 0 });
    await aplicar(prisma, fonte('v1'), s2, { icones });
    expect(await md5(WEBMAP)).toEqual(webAntes);
    expect(await md5(OPERACIONAIS)).toEqual(ops);
    evidencias.aplicar_v1 = { operacionais: await md5(OPERACIONAIS), reaplicarWebmapIgual: true };
  });

  it('falha no meio da aplicação: rollback total (md5 webmap e operacionais iguais)', async () => {
    const antes = await md5([...WEBMAP, ...OPERACIONAIS]);
    const { resultado } = await simular(prisma, fonte('v2'));
    await expect(aplicar(prisma, fonte('v2'), resultado, { icones, falharDepoisDe: 2 })).rejects.toThrow(/Falha simulada/);
    expect(await md5([...WEBMAP, ...OPERACIONAIS])).toEqual(antes);
    evidencias.falha = { iguais: true };
  });

  it('fonte quebrada (camada ilegível) aborta tudo', async () => {
    const antes = await md5(todas);
    await expect(simular(prisma, fonte('v_quebrada'))).rejects.toThrow(/GeoJSON inválido/);
    expect(await md5(todas)).toEqual(antes);
  });

  it('concorrência: segunda aplicação recebe "em andamento" e nada muda', async () => {
    const antes = await md5([...WEBMAP, ...OPERACIONAIS]);
    const { resultado } = await simular(prisma, fonte('v2'));
    let liberar!: () => void;
    const segurando = new Promise<void>((r) => (liberar = r));
    let pronto!: () => void;
    const lockPego = new Promise<void>((r) => (pronto = r));
    const outra = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(${296_000_296})::text AS ok`;
      pronto();
      await segurando;
    }, { timeout: 30_000 });
    await lockPego;
    await expect(aplicar(prisma, fonte('v2'), resultado, { icones })).rejects.toBeInstanceOf(ImportacaoEmAndamentoError);
    liberar();
    await outra;
    expect(await md5([...WEBMAP, ...OPERACIONAIS])).toEqual(antes);
    evidencias.concorrencia = { iguais: true };
  });

  it('simulação expirada ou fonte alterada: aplicação recusada', async () => {
    const { resultado } = await simular(prisma, fonte('v1'));
    await expect(aplicar(prisma, fonte('v2'), resultado)).rejects.toBeInstanceOf(FonteMudouError);
    await expect(aplicar(prisma, fonte('v1'), resultado, { agora: new Date(Date.now() + 31 * 60_000) })).rejects.toThrow(/expirou/);
  });

  it('v2: atualizada mantém id, só sufixo = mesma camada, renomeada = nova + removida, malformados = PARCIAL', async () => {
    const ops = await md5(OPERACIONAIS);
    const creche = await camada('SECRETARIA_EDUCACAO/CRECHE_PRE_ESCOLA');
    const vias = await camada('SISTEMA_VIARIO/VIAS_PRINCIPAIS');
    const ubs = await camada('SECRETARIA_SAUDE/UBS');
    const ete3 = await camada('SANEAMENTO/ETE_3');
    const ete2 = await camada('SANEAMENTO/ETE_2');
    const { resultado } = await simular(prisma, fonte('v2'));
    expect(resultado).toMatchObject({ novas: 2, removidasOrigem: 2, totalErros: 2, resultadoPrevisto: 'PARCIAL' });
    const det = Object.fromEntries(resultado.camadasDetalhe.map((c) => [c.chaveOrigem, c.status]));
    expect(det).toMatchObject({ 'SECRETARIA_EDUCACAO/CRECHE_PRE_ESCOLA': 'atualizada', 'SANEAMENTO/ETE_2': 'sem_mudanca', 'SANEAMENTO/ETE_3_NORTE': 'nova', 'SANEAMENTO/ETE_3': 'removida_origem', 'SECRETARIA_SAUDE/UBS': 'removida_origem', 'ECOPONTOS/ECOPONTO': 'nova' });
    const r = await aplicar(prisma, fonte('v2'), resultado, { icones });
    expect(r.resultado).toBe('PARCIAL');
    expect((await camada('SECRETARIA_EDUCACAO/CRECHE_PRE_ESCOLA'))).toMatchObject({ id: creche!.id, totalElementos: 3, nomeOriginal: 'CRECHE_PRE_ESCOLA (46 UNID.)', varOrigem: 'CRECHE_PRE_ESCOLA46UNID_77' });
    expect((await camada('SISTEMA_VIARIO/VIAS_PRINCIPAIS'))).toMatchObject({ id: vias!.id, varOrigem: 'VIAS_PRINCIPAIS_82' });
    expect((await camada('SANEAMENTO/ETE_2'))?.updatedAt).toEqual(ete2!.updatedAt);
    const ubsDepois = await camada('SECRETARIA_SAUDE/UBS');
    expect(ubsDepois).toMatchObject({ id: ubs!.id, ativo: false, removidaOrigem: true });
    expect(await prisma.webmapElemento.count({ where: { camadaId: ubs!.id } })).toBe(1);
    expect(await camada('SANEAMENTO/ETE_3')).toMatchObject({ id: ete3!.id, ativo: false, removidaOrigem: true });
    expect(await camada('SANEAMENTO/ETE_3_NORTE')).toMatchObject({ ativo: true });
    expect(await camada('ECOPONTOS/ECOPONTO')).toMatchObject({ totalElementos: 1 });
    expect(await md5(OPERACIONAIS)).toEqual(ops);
    evidencias.aplicar_v2 = { operacionais: await md5(OPERACIONAIS) };
  });

  it('v3: camadas que voltam à fonte são reativadas com o MESMO id', async () => {
    const ubs = await camada('SECRETARIA_SAUDE/UBS');
    const ete3 = await camada('SANEAMENTO/ETE_3');
    const { resultado } = await simular(prisma, fonte('v3'));
    expect(resultado).toMatchObject({ reativadas: 2, removidasOrigem: 2 });
    await aplicar(prisma, fonte('v3'), resultado, { icones });
    expect(await camada('SECRETARIA_SAUDE/UBS')).toMatchObject({ id: ubs!.id, ativo: true, removidaOrigem: false, removidaEm: null });
    expect(await camada('SANEAMENTO/ETE_3')).toMatchObject({ id: ete3!.id, ativo: true });
    expect(await camada('SANEAMENTO/ETE_3_NORTE')).toMatchObject({ ativo: false, removidaOrigem: true });
    expect(await prisma.webmapCamada.count({ where: { chaveOrigem: 'SECRETARIA_SAUDE/UBS' } })).toBe(1);
    evidencias.final = { operacionais: await md5(OPERACIONAIS) };
  });

  it('serviço: mapa lista só ativas, desligadas por padrão; GeoJSON por camada', async () => {
    const service = new WebmapCamadasService(prisma as never, {} as never);
    const arv = await service.arvore();
    const flat = arv.flatMap((g) => g.camadas);
    expect(flat.every((c) => c.ligadaPorPadrao === false)).toBe(true);
    expect(flat.map((c) => c.nomeOriginal)).not.toContain('ETE 3 NORTE');
    const gj = await service.geojson(flat.find((c) => c.nomeOriginal.startsWith('CRECHE'))!.camadaId);
    expect(gj.features).toHaveLength(2);
    const bb = await service.geojson(flat.find((c) => c.nomeOriginal.startsWith('LOTE ('))!.camadaId, '-47.3985,-20.521,-47.39,-20.51', '14');
    expect(bb.features).toHaveLength(1);
  });
});
