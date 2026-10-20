/**
 * 296 — integração com Postgres descartável SEM extensões. Só roda com WEBMAP_CAMADAS_TEST_DATABASE_URL
 * (banco local de teste, migrado e com seed). Usa só fixtures locais (sem rede).
 * Precisa de um banco PRÓPRIO: os md5 de "todas as tabelas" quebram se outros *.int.spec gravarem
 * no mesmo banco em paralelo; por isso é pulado quando a URL é igual a DATABASE_URL.
 */
import { spawn } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { executarAplicacao, FonteMudouError, HEARTBEAT_LIMITE_MS, PgSessionLock, recuperarInterrompidas, ResultadoSimulacao, simular } from './core';
import { DiretorioWebmapFonte } from './source';
import { WebmapCamadasService } from './webmap-camadas.service';

const URL = process.env.WEBMAP_CAMADAS_TEST_DATABASE_URL && process.env.WEBMAP_CAMADAS_TEST_DATABASE_URL !== process.env.DATABASE_URL ? process.env.WEBMAP_CAMADAS_TEST_DATABASE_URL : undefined;
const ROOT = join(__dirname, '../..');
const FIX = join(ROOT, 'test/fixtures/webmap-camadas');
const fonte = (v: string) => new DiretorioWebmapFonte(v.startsWith('/') ? v : join(FIX, v));
const OPERACIONAIS = ['UnidadePublica', 'Secretaria', 'Chamado'];
const CONTROLE = ['WebmapImportacao', 'LogAuditoria'];

describe.skipIf(!URL)('296 — importação de camadas Webmap (Postgres sem extensões)', () => {
  let prisma: PrismaClient;
  let todas: string[] = [];
  let semControle: string[] = [];
  let webmap: string[] = [];
  const evid: Record<string, unknown> = {};
  const user = { sub: '', nome: 'Tester 296', email: 't@aion.local', perfis: [], permissoes: [] };

  const md5 = async (tables: string[]) => {
    const out: Record<string, string> = {};
    for (const t of tables) {
      const [r] = await prisma.$queryRawUnsafe<Array<{ h: string }>>(`SELECT md5(coalesce(string_agg(x::text, '|' ORDER BY x::text), '')) AS h FROM "${t}" x`);
      out[t] = r.h;
    }
    return out;
  };
  const camada = (chave: string) => prisma.webmapCamada.findUnique({ where: { chaveOrigem: chave } });
  const aplicarAgora = async (f: DiretorioWebmapFonte, sim?: ResultadoSimulacao, opts: Parameters<typeof executarAplicacao>[4] = {}) => {
    const s = sim ?? (await simular(prisma, f)).resultado;
    const lock = new PgSessionLock(URL!);
    expect(await lock.tentar()).toBe(true);
    const job = await prisma.webmapImportacao.create({ data: { status: 'EM_ANDAMENTO', usuarioNome: user.nome, simulacaoId: s.simulacaoId, fonteHash: s.fonteHash } });
    try {
      return await executarAplicacao(prisma, f, job.id, s, { icones: async (_b, _m, sha) => ({ storageKey: `webmap-icones/${sha}`, url: `/storage/webmap-icones/${sha}` }), ...opts });
    } catch (e) {
      await prisma.webmapImportacao.update({ where: { id: job.id }, data: { status: 'FALHA', motivo: String(e) } });
      throw e;
    } finally {
      await lock.liberar();
    }
  };

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: URL! }) });
    await prisma.$executeRawUnsafe('TRUNCATE "WebmapElemento","WebmapCamadaVersao","WebmapCamada","WebmapCamadaGrupo","WebmapIcone","WebmapImportacao"');
    await prisma.logAuditoria.deleteMany({ where: { entidadeTipo: 'WebmapCamadasImport' } });
    const rows = await prisma.$queryRawUnsafe<Array<{ t: string }>>(`SELECT tablename AS t FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`);
    todas = rows.map((r) => r.t).sort();
    semControle = todas.filter((t) => !CONTROLE.includes(t));
    webmap = todas.filter((t) => t.startsWith('Webmap') && !CONTROLE.includes(t));
    const ext = await prisma.$queryRawUnsafe<Array<{ extname: string }>>(`SELECT extname FROM pg_extension`);
    evid.extensoes = ext.map((e) => e.extname);
    user.sub = (await prisma.usuario.findFirst({ select: { id: true } }))?.id ?? '';
    evid.inicio = await md5(OPERACIONAIS);
  });
  afterAll(async () => {
    console.log('EVIDENCIAS_296', JSON.stringify(evid, null, 1));
    await prisma?.$disconnect();
  });

  it('roda em Postgres sem extensões além de plpgsql', () => {
    expect(evid.extensoes).toEqual(['plpgsql']);
  });

  it('índice composto versão/camada + bbox existe (migration aditiva, sem PostGIS)', async () => {
    const ix = await prisma.$queryRawUnsafe<Array<{ indexdef: string }>>(`SELECT indexdef FROM pg_indexes WHERE tablename = 'WebmapElemento'`);
    expect(ix.map((i) => i.indexdef).join('\n')).toContain('("camadaId", versao, "minLng", "maxLng", "minLat", "maxLat")');
  });

  it('simulação não grava nada (md5 de TODAS as tabelas igual)', async () => {
    const antes = await md5(todas);
    const { resultado } = await simular(prisma, fonte('v1'));
    expect(await md5(todas)).toEqual(antes);
    expect(resultado).toMatchObject({ grupos: 6, camadas: 8, novas: 8, totalErros: 0, resultadoPrevisto: 'SUCESSO', elementos: { pontos: 6, linhas: 1, poligonos: 4, total: 11 } });
    evid.simulacao_v1 = { todasIguais: true, tabelas: todas.length };
  });

  it('serviço: simulação grava exatamente 1 linha de log SIMULACAO e nada mais', async () => {
    const service = new WebmapCamadasService(prisma as never, {} as never);
    service.usarFonte(fonte('v1'), URL);
    const outras = todas.filter((t) => t !== 'LogAuditoria');
    const antes = await md5(outras);
    const ids0 = (await prisma.logAuditoria.findMany({ select: { id: true } })).map((r) => r.id);
    await service.simular(user);
    expect(await md5(outras)).toEqual(antes);
    const novos = await prisma.logAuditoria.findMany({ where: { id: { notIn: ids0 } } });
    expect(novos).toHaveLength(1);
    expect(novos[0].valorNovo).toMatchObject({ tipo: 'SIMULACAO', resultado: 'SUCESSO', usuario: 'Tester 296' });
  });

  it('aplicar v1: chave sempre com a família; operacionais idênticos; reaplicar sem mudança não muda nada', async () => {
    const ops = await md5(OPERACIONAIS);
    const r = await aplicarAgora(fonte('v1'));
    expect(r).toMatchObject({ resultado: 'SUCESSO', novas: 8, icones: 1 });
    expect((await prisma.webmapCamada.findMany({ select: { chaveOrigem: true } })).map((c) => c.chaveOrigem).sort()).toEqual([
      'AREAS_PUBLICAS/LOTE#POINT', 'AREAS_PUBLICAS/LOTE#POLYGON', 'PONTOS_VICIADOS/PONTO_VICIADO#POINT', 'SANEAMENTO/ETE_2#POLYGON', 'SANEAMENTO/ETE_3#POLYGON',
      'SECRETARIA_EDUCACAO/CRECHE_PRE_ESCOLA#POINT', 'SECRETARIA_SAUDE/UBS#POINT', 'SISTEMA_VIARIO/VIAS_PRINCIPAIS#LINE',
    ]);
    expect(await prisma.webmapElemento.count()).toBe(11);
    expect(await md5(OPERACIONAIS)).toEqual(ops);
    const pv = await camada('PONTOS_VICIADOS/PONTO_VICIADO#POINT');
    expect(pv?.estilo).toMatchObject({ tipo: 'icon', icone: { url: expect.stringMatching(/^\/storage\/webmap-icones\/[0-9a-f]{64}$/) } });
    const web = await md5(webmap);
    const s2 = (await simular(prisma, fonte('v1'))).resultado;
    expect(s2).toMatchObject({ semMudanca: 8, novas: 0, atualizadas: 0 });
    await aplicarAgora(fonte('v1'), s2);
    expect(await md5(webmap)).toEqual(web);
  });

  it('falha no meio: versão anterior continua ativa e a incompleta é descartada (md5 igual, sem transação gigante)', async () => {
    const antes = await md5(semControle);
    await expect(aplicarAgora(fonte('v2'), undefined, { falharDepoisDe: 2 })).rejects.toThrow(/Falha simulada/);
    expect(await md5(semControle)).toEqual(antes);
    evid.falha = { iguais: true };
  });

  it('fonte com camada ilegível aborta tudo', async () => {
    const antes = await md5(todas);
    await expect(simular(prisma, fonte('v_quebrada'))).rejects.toThrow(/GeoJSON inválido/);
    expect(await md5(todas)).toEqual(antes);
  });

  it('simulação vencida ou fonte alterada: recusada', async () => {
    const { resultado } = await simular(prisma, fonte('v1'));
    await expect(aplicarAgora(fonte('v2'), resultado)).rejects.toBeInstanceOf(FonteMudouError);
    await expect(aplicarAgora(fonte('v1'), resultado, { agora: new Date(Date.now() + 31 * 60_000) })).rejects.toThrow(/prazo da simulação/);
  });

  it('v2: nova versão mantém o id lógico; renomeada = nova + removida; corrigidos e irreparáveis => PARCIAL', async () => {
    const ops = await md5(OPERACIONAIS);
    const ids = Object.fromEntries((await prisma.webmapCamada.findMany()).map((c) => [c.chaveOrigem, c]));
    const { resultado } = await simular(prisma, fonte('v2'));
    expect(resultado).toMatchObject({ novas: 3, removidasOrigem: 2, corrigidos: 2, invalidos: 3, resultadoPrevisto: 'PARCIAL' });
    expect(resultado.erros.every((e) => e.grupo && e.camada && e.motivo)).toBe(true);
    const r = await aplicarAgora(fonte('v2'), resultado);
    expect(r.resultado).toBe('PARCIAL');
    const creche = await camada('SECRETARIA_EDUCACAO/CRECHE_PRE_ESCOLA#POINT');
    expect(creche).toMatchObject({ id: ids['SECRETARIA_EDUCACAO/CRECHE_PRE_ESCOLA#POINT'].id, totalElementos: 3, varOrigem: 'CRECHE_PRE_ESCOLA46UNID_77' });
    expect(creche!.versaoAtual).not.toBe(ids['SECRETARIA_EDUCACAO/CRECHE_PRE_ESCOLA#POINT'].versaoAtual);
    expect(await prisma.webmapElemento.count({ where: { camadaId: creche!.id } })).toBe(3); // versão antiga limpa
    expect(await camada('SISTEMA_VIARIO/VIAS_PRINCIPAIS#LINE')).toMatchObject({ id: ids['SISTEMA_VIARIO/VIAS_PRINCIPAIS#LINE'].id, varOrigem: 'VIAS_PRINCIPAIS_82' });
    expect(await camada('SECRETARIA_SAUDE/UBS#POINT')).toMatchObject({ id: ids['SECRETARIA_SAUDE/UBS#POINT'].id, ativo: false, removidaOrigem: true });
    expect(await prisma.webmapElemento.count({ where: { camadaId: ids['SECRETARIA_SAUDE/UBS#POINT'].id } })).toBe(1);
    expect(await camada('SANEAMENTO/ETE_3#POLYGON')).toMatchObject({ ativo: false, removidaOrigem: true });
    const risco = await camada('SANEAMENTO/AREA_RISCO#POLYGON');
    expect(risco).toMatchObject({ totalElementos: 2, totalCorrigidos: 2, totalInvalidos: 1 });
    const corrigido = await prisma.webmapElemento.findFirst({ where: { camadaId: risco!.id, fidOrigem: '1' } });
    expect(corrigido).toMatchObject({ corrigida: true, geometria: { type: 'MultiPolygon' } });
    expect(corrigido?.geometriaOriginal).toMatchObject({ type: 'Polygon' });
    expect(await md5(OPERACIONAIS)).toEqual(ops);
    evid.v2 = { corrigidos: r.corrigidos, invalidos: r.invalidos };
  });

  it('v3: removida e que volta mantém o MESMO id lógico (reativada)', async () => {
    const ubs = await camada('SECRETARIA_SAUDE/UBS#POINT');
    const ete3 = await camada('SANEAMENTO/ETE_3#POLYGON');
    const { resultado } = await simular(prisma, fonte('v3'));
    expect(resultado).toMatchObject({ reativadas: 2 });
    await aplicarAgora(fonte('v3'), resultado);
    expect(await camada('SECRETARIA_SAUDE/UBS#POINT')).toMatchObject({ id: ubs!.id, ativo: true, removidaOrigem: false });
    expect(await camada('SANEAMENTO/ETE_3#POLYGON')).toMatchObject({ id: ete3!.id, ativo: true });
    expect(await prisma.webmapCamada.count({ where: { chaveOrigem: { startsWith: 'SECRETARIA_SAUDE/UBS' } } })).toBe(1);
  });

  it('v4: tema ganha camada de pontos e o polígono mantém o id; só corrigíveis => OK_COM_AVISOS; reaplicar dá o mesmo resultado', async () => {
    const ete2 = await camada('SANEAMENTO/ETE_2#POLYGON');
    const r = await aplicarAgora(fonte('v4'));
    expect(r).toMatchObject({ resultado: 'OK_COM_AVISOS', corrigidos: 2, invalidos: 0 });
    expect(await camada('SANEAMENTO/ETE_2#POLYGON')).toMatchObject({ id: ete2!.id, ativo: true });
    expect(await camada('SANEAMENTO/ETE_2#POINT')).toMatchObject({ ativo: true, totalElementos: 1 });
    const web = await md5(webmap);
    const r2 = await aplicarAgora(fonte('v4'));
    expect(r2).toMatchObject({ resultado: 'OK_COM_AVISOS', corrigidos: 2, invalidos: 0, semMudanca: r2.camadas });
    expect(await md5(webmap)).toEqual(web);
    evid.v4 = { resultado: r.resultado, reaplicar: r2.resultado };
  });

  it('heartbeat recente (< 60 s) não é recuperado; matar o processo no meio => FALHA "interrompida por reinício" e md5 igual', async () => {
    // fonte grande: v4 + UBS com 20.000 pontos (vários lotes)
    const dir = mkdtempSync(join(tmpdir(), 'wm296-'));
    cpSync(join(FIX, 'v4'), dir, { recursive: true });
    const feats = Array.from({ length: 20000 }, (_, i) => ({ type: 'Feature', properties: { fid: String(i + 1) }, geometry: { type: 'Point', coordinates: [-47.4 + (i % 100) / 1000, -20.5 - Math.floor(i / 100) / 1000] } }));
    writeFileSync(join(dir, 'layers/UBS24UNID_80.js'), `var json_UBS24UNID_80 = ${JSON.stringify({ type: 'FeatureCollection', name: 'UBS24UNID_80', features: feats })};`);
    const antes = await md5(semControle);
    const child = spawn(process.execPath, ['--import', 'tsx', join(ROOT, 'test/webmap-camadas/aplicar-worker.ts'), dir], { cwd: ROOT, env: { ...process.env, WEBMAP_CAMADAS_TEST_DATABASE_URL: URL }, stdio: ['ignore', 'pipe', 'pipe'] });
    let jobId = '';
    await new Promise<void>((resolve, reject) => {
      let out = '';
      child.stdout.on('data', (d: Buffer) => {
        out += d.toString();
        const m = /JOB (\S+)/.exec(out);
        if (m) jobId = m[1];
        if (/LOTE 3\b/.test(out)) { child.kill('SIGKILL'); resolve(); }
      });
      child.on('exit', () => resolve());
      setTimeout(() => reject(new Error(`worker não chegou ao lote 3: ${out}`)), 60_000);
    });
    expect(jobId).not.toBe('');
    await new Promise((r) => setTimeout(r, 500));
    expect(await prisma.webmapElemento.count({ where: { versao: { startsWith: jobId } } })).toBeGreaterThan(0); // versão incompleta existia
    expect(await recuperarInterrompidas(prisma, new PgSessionLock(URL!))).toEqual([]); // heartbeat fresco: não recupera
    expect(await recuperarInterrompidas(prisma, new PgSessionLock(URL!), 0)).toEqual([jobId]);
    expect(await prisma.webmapImportacao.findUnique({ where: { id: jobId } })).toMatchObject({ status: 'FALHA', motivo: 'interrompida por reinício' });
    expect(await md5(semControle)).toEqual(antes);
    evid.kill = { jobId, md5Iguais: true };
  }, 90_000);

  it('serviço: aplicar devolve 202 em segundo plano; segunda aplicação => "em andamento" com quem e desde quando; resultado consultável depois', async () => {
    const lenta = fonte('v2');
    const orig = lenta.lerStream.bind(lenta);
    lenta.lerStream = async function* (c: string) { for await (const x of orig(c)) { await new Promise((r) => setTimeout(r, 300)); yield x; } };
    const service = new WebmapCamadasService(prisma as never, { persistBuffer: async () => ({ storageKey: 'k', url: '/u' }) } as never);
    service.usarFonte(lenta, URL);
    const sim1 = await service.simular(user);
    const sim2 = await service.simular({ ...user, nome: 'Outro' });
    const r = await service.aplicar(user, sim1.simulacaoId);
    expect(r).toMatchObject({ status: 'EM_ANDAMENTO' });
    await expect(service.aplicar({ ...user, nome: 'Outro' }, sim2.simulacaoId)).rejects.toThrow(/em andamento por Tester 296 desde .*\(BRT\)/);
    const st = await service.status();
    expect(st.emAndamento).toMatchObject({ tipo: 'APLICACAO', usuario: 'Tester 296' });
    await service.execucao;
    const fim = await service.status();
    expect(fim.emAndamento).toBeNull();
    expect(fim.ultimaImportacao).toMatchObject({ id: r.importacaoId, status: 'PARCIAL' });
    const csv = await service.errosCsv();
    expect(csv.split('\n')[0]).toBe('grupo;camada;elemento;motivo');
    expect(csv).toContain('"SANEAMENTO";"AREA_RISCO"');
  }, 60_000);

  it('mapa: só versão ativa, desligadas por padrão, GeoJSON por camada', async () => {
    const service = new WebmapCamadasService(prisma as never, {} as never);
    const flat = (await service.arvore()).flatMap((g) => g.camadas);
    expect(flat.every((c) => c.ligadaPorPadrao === false)).toBe(true);
    const gj = await service.geojson(flat.find((c) => c.nomeOriginal.startsWith('CRECHE'))!.camadaId);
    expect(gj.features).toHaveLength(3);
    // bbox gravado por feição confere com a geometria
    const errados = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(`SELECT count(*) n FROM "WebmapElemento" WHERE "minLng" > "maxLng" OR "minLat" > "maxLat"`);
    expect(Number(errados[0].n)).toBe(0);
    evid.final = await md5(OPERACIONAIS);
  });
  /** Cópia temporária de uma fixture com um arquivo de camada alterado. */
  const variante = (base: string, arquivo: string, mudar: (txt: string) => string) => {
    const dir = mkdtempSync(join(tmpdir(), 'webmap296-'));
    cpSync(join(FIX, base), dir, { recursive: true });
    const p = join(dir, 'layers', arquivo);
    writeFileSync(p, mudar(readFileSync(p, 'utf8')));
    return dir;
  };
  const acrescentarFeature = (txt: string, feat: string) => { const i = txt.lastIndexOf(']'); return `${txt.slice(0, i)}, ${feat}${txt.slice(i)}`; };

  it('polígono real que estoura a pilha do reparo (FAZENDA_NOVA_ESPERANCA fid 431) vira erro do elemento no CSV; camada e job seguem (no worker)', async () => {
    const enorme = readFileSync(join(FIX, 'pilha/poligono-estouro-pilha.json'), 'utf8');
    const dir = variante('v1', 'ETE_2_100.js', (t) => acrescentarFeature(t, enorme));
    const service = new WebmapCamadasService(prisma as never, { persistBuffer: async () => ({ storageKey: 'k', url: '/u' }) } as never);
    service.usarFonte(fonte(dir), URL);
    const operAntes = await md5(OPERACIONAIS);
    const sim = await service.simular(user);
    expect(sim.erros.some((e) => e.camada.startsWith('ETE 2') || e.camada.startsWith('ETE_2'))).toBe(true);
    await service.aplicar(user, sim.simulacaoId);
    await service.execucao;
    const st = await service.status();
    expect(st.ultimaImportacao).toMatchObject({ status: 'PARCIAL' });
    const ete = (await prisma.webmapCamada.findMany({ where: { arquivoOrigem: 'ETE_2_100.js' } }))[0];
    expect(ete.ativo).toBe(true);
    expect(ete.totalInvalidos).toBe(1);
    expect(ete.totalElementos).toBeGreaterThan(0);
    const csv = await service.errosCsv();
    expect(csv).toMatch(/"431";"Polígono irreparável \(Maximum call stack size exceeded\)"/);
    expect(await md5(OPERACIONAIS)).toEqual(operAntes);
  }, 120_000);

  it('heartbeat bate por lote: camada pesada mais longa que o limite não vira FALHA no meio', async () => {
    const pts = Array.from({ length: 3000 }, (_, i) => `{"type": "Feature", "properties": {"fid": "hb${i}"}, "geometry": {"type": "Point", "coordinates": [${-47.4 + i * 1e-5}, -20.5]}}`).join(', ');
    const dir = variante('v1', 'PONTO_VICIADO_120.js', (t) => acrescentarFeature(t, pts));
    const f = fonte(dir);
    const s = (await simular(prisma, f)).resultado;
    const limiteMs = 800; // no teste o "limite" é 0,8 s; cada lote demora 0,3 s e a camada ~2 s (> limite)
    const lock = new PgSessionLock(URL!);
    expect(await lock.tentar()).toBe(true);
    const job = await prisma.webmapImportacao.create({ data: { status: 'EM_ANDAMENTO', usuarioNome: user.nome, simulacaoId: s.simulacaoId, fonteHash: s.fonteHash, heartbeatEm: new Date() } });
    const idades: number[] = [];
    let lotesCamadaPesada = 0;
    const inicio = Date.now();
    try {
      const r = await executarAplicacao(prisma, f, job.id, s, {
        icones: async (_b, _m, sha) => ({ storageKey: `webmap-icones/${sha}`, url: `/u/${sha}` }),
        batimento: async () => { await prisma.webmapImportacao.update({ where: { id: job.id }, data: { heartbeatEm: new Date() } }); },
        aposLote: async ({ camada }) => {
          if (!camada.includes('PONTO_VICIADO')) return;
          lotesCamadaPesada++;
          await new Promise((res) => setTimeout(res, 300));
          const j = await prisma.webmapImportacao.findUniqueOrThrow({ where: { id: job.id } });
          idades.push(Date.now() - j.heartbeatEm.getTime());
          // o mesmo critério da recuperação: sem heartbeat há > limite => seria FALHA
          expect(await prisma.webmapImportacao.count({ where: { id: job.id, status: 'EM_ANDAMENTO', heartbeatEm: { lt: new Date(Date.now() - limiteMs) } } })).toBe(0);
        },
      });
      expect(r.resultado).not.toBe('FALHA');
    } finally {
      await lock.liberar();
    }
    expect(lotesCamadaPesada).toBeGreaterThanOrEqual(6);
    expect(Date.now() - inicio).toBeGreaterThan(limiteMs * 2);
    expect(Math.max(...idades)).toBeLessThan(limiteMs);
    expect(HEARTBEAT_LIMITE_MS).toBe(60_000);
    await prisma.webmapImportacao.update({ where: { id: job.id }, data: { status: 'SUCESSO', concluidoEm: new Date() } });
    expect(await recuperarInterrompidas(prisma, new PgSessionLock(URL!), limiteMs)).toEqual([]);
  }, 60_000);
});
