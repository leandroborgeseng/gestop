/* 296 — medição de memória/tempo. Uso: node [--max-old-space-size=N] --import tsx scripts/medicao-296/medir.ts <simular|aplicar> <dir-fonte|github>
   Amostra /proc/self/status (VmRSS) a cada 250 ms. Banco: MEDIR_DB. */
import { readFileSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { executarAplicacao, PgSessionLock, simular } from '../../src/webmap-camadas/core';
import { DiretorioWebmapFonte, GithubWebmapFonte } from '../../src/webmap-camadas/source';
import { leitorEmWorker } from '../../src/webmap-camadas/job';
import { mkdirSync, writeFileSync } from 'node:fs';
const emWorker = process.env.MEDIR_WORKER !== '0';

const [modo, origem] = process.argv.slice(2);
const url = process.env.MEDIR_DB!;
const t0 = Date.now();
let pico = 0;
let picoEm = '';
let etapa = 'inicio';
const rss = () => Number(/VmRSS:\s+(\d+)/.exec(readFileSync('/proc/self/status', 'utf8'))![1]) * 1024;
const mb = (n: number) => (n / 1048576).toFixed(0) + ' MiB';
let atual = '';
const amostra = () => { const r = rss(); if (r > pico) { if (process.env.MEDIR_DIAG === '1' && r - pico > 8 * 1048576) console.log('novo pico', mb(r), atual, 'heap', mb(process.memoryUsage().heapUsed), 'ext', mb(process.memoryUsage().external + process.memoryUsage().arrayBuffers)); pico = r; picoEm = etapa; } };
setInterval(amostra, 250).unref();
const log = (...a: unknown[]) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s rss=${mb(rss())} heap=${mb(process.memoryUsage().heapUsed)}]`, ...a);

(async () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 4 }) });
  const base = origem === 'github' ? new GithubWebmapFonte() : new DiretorioWebmapFonte(origem);
  const diag = process.env.MEDIR_DIAG === '1';
  const abertas = new Set<string>();
  if (diag) setInterval(() => log('abertas', [...abertas].join(',')), 1000).unref();
  const fonte = Object.assign(Object.create(Object.getPrototypeOf(base)), base, {
    async *lerStream(c: string) {
      abertas.add(c); atual = c; const antes = rss(); let maxL = antes; let n = 0;
      try { for await (const ch of base.lerStream(c)) { n += ch.length; yield ch; const r = rss(); if (r > maxL) maxL = r; } } finally { abertas.delete(c); }
      if (diag && maxL - antes > 30 * 1048576) log('CAMADA', c, (n / 1e6).toFixed(1) + 'MB', 'subiu', mb(maxL - antes), 'max', mb(maxL));
    },
  });
  etapa = 'simular';
  let t = Date.now();
  const onFaseS = (f: string) => { etapa = `simular:${f}`; log('fase', f); };
  const leitorS = emWorker ? leitorEmWorker(url, base.config) : undefined;
  const resultado = (await simular(prisma, fonte, onFaseS as never, leitorS)).resultado;
  await leitorS?.fechar();
  amostra();
  log('SIMULACAO', Date.now() - t, 'ms', JSON.stringify({ camadas: resultado.camadas, grupos: resultado.grupos, el: resultado.elementos, corrigidos: resultado.corrigidos, irreparaveis: resultado.invalidos, previsto: resultado.resultadoPrevisto, novas: resultado.novas, semMudanca: resultado.semMudanca }));
  log('PICO_RSS_SIMULACAO', mb(pico), 'em', picoEm);
  if (modo === 'aplicar') {
    pico = 0;
    const lock = new PgSessionLock(url);
    if (!(await lock.tentar())) throw new Error('lock ocupado');
    const job = await prisma.webmapImportacao.create({ data: { status: 'EM_ANDAMENTO', usuarioNome: 'medicao', simulacaoId: resultado.simulacaoId, fonteHash: resultado.fonteHash } });
    t = Date.now();
    let camadas = 0;
    let lotes = 0;
    mkdirSync('/tmp/g296-icones', { recursive: true });
    const cb = {
      onFase: (f: string) => { etapa = `aplicar:${f}`; log('fase', f); },
      batimento: () => { lotes++; if (lotes % 200 === 0) log('lotes gravados', lotes); },
      icones: async (buf: Buffer, _m: string, sha: string) => { writeFileSync(`/tmp/g296-icones/${sha}`, buf); return { storageKey: `webmap-icones/${sha}`, url: `/storage/webmap-icones/${sha}` }; },
      aposCamada: (c: string) => { camadas++; if (camadas % 50 === 0) log('camadas gravadas', camadas, c); },
    };
    const leitorA = emWorker ? leitorEmWorker(url, base.config) : undefined;
    const r = await executarAplicacao(prisma, fonte, job.id, resultado, { ...cb, leitor: leitorA } as never);
    await leitorA?.fechar();
    await lock.liberar();
    amostra();
    log('APLICACAO', Date.now() - t, 'ms', r.resultado, 'corrigidos', r.corrigidos, 'irreparaveis', r.invalidos);
    log('PICO_RSS_APLICACAO', mb(pico), 'em', picoEm);
    const size = await prisma.$queryRawUnsafe<Array<{ db: string; el: string }>>(`SELECT pg_size_pretty(pg_database_size(current_database())) db, pg_size_pretty(pg_total_relation_size('"WebmapElemento"')) el`);
    log('TAMANHO_BANCO', JSON.stringify(size[0]));
  }
  await prisma.$disconnect();
  process.exit(0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
