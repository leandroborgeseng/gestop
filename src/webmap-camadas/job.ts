import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import type { AlvoCamada, AlvoGravacao, Stats } from './camada-io';
import type { LeitorCamadas } from './core';
import type { FonteConfig } from './source';

/**
 * 296 — limites do heap do worker (MB). A parte pesada (download em fluxo, parse, reparo, lotes) roda aqui;
 * o processo principal só planeja e troca versões. Ver desenho-296.md, "Memória".
 */
export const JOB_HEAP_OLD_MB = Number(process.env.WEBMAP_CAMADAS_JOB_HEAP_MB) || 48;
export const JOB_HEAP_YOUNG_MB = 4;

export type DadosWorker = { dbUrl: string; fonte: FonteConfig };
export type PedidoWorker = { id: number; op: 'contar'; alvo: AlvoCamada } | { id: number; op: 'gravar'; alvo: AlvoGravacao } | { id: 0; op: 'fechar' };
export type MsgDoWorker = { tipo: 'ok'; id: number; stats: Stats } | { tipo: 'lote'; id: number; lote: number } | { tipo: 'erro'; id: number; mensagem: string };

function criarWorker(dados: DadosWorker) {
  const opts = { workerData: dados, resourceLimits: { maxOldGenerationSizeMb: JOB_HEAP_OLD_MB, maxYoungGenerationSizeMb: JOB_HEAP_YOUNG_MB } };
  const js = join(__dirname, 'job.worker.js');
  if (existsSync(js)) return new Worker(js, opts);
  // a partir do TypeScript (testes/tsx): registra o tsx dentro do worker
  const ts = join(__dirname, 'job.worker.ts');
  return new Worker(`require('tsx/cjs'); require(${JSON.stringify(ts)});`, { ...opts, eval: true });
}

/** Leitor de camadas num worker com heap limitado. Feche com `fechar()` ao fim do job. */
export function leitorEmWorker(dbUrl: string, fonte: FonteConfig): LeitorCamadas & { fechar: () => Promise<void> } {
  const w = criarWorker({ dbUrl, fonte });
  let seq = 0;
  let morto: Error | null = null;
  const pend = new Map<number, { ok: (s: Stats) => void; falha: (e: Error) => void; lote?: (n: number) => Promise<void> | void }>();
  const falharTodos = (e: Error) => { morto = e; for (const p of pend.values()) p.falha(e); pend.clear(); };
  w.on('message', (m: MsgDoWorker) => {
    const p = pend.get(m.id);
    if (!p) return;
    if (m.tipo === 'lote') { void p.lote?.(m.lote); return; }
    pend.delete(m.id);
    if (m.tipo === 'ok') p.ok(m.stats);
    else p.falha(new Error(m.mensagem));
  });
  w.on('error', (e) => falharTodos(new Error(`Worker de camadas interrompido: ${e instanceof Error ? e.message : String(e)}`)));
  w.on('exit', (code) => falharTodos(new Error(`Worker de camadas terminou (código ${code})`)));
  const pedir = (op: 'contar' | 'gravar', alvo: AlvoCamada | AlvoGravacao, lote?: (n: number) => Promise<void> | void) =>
    new Promise<Stats>((ok, falha) => {
      if (morto) return falha(morto);
      const id = ++seq;
      pend.set(id, { ok, falha, lote });
      w.postMessage({ id, op, alvo } as PedidoWorker);
    });
  return {
    contar: (a) => pedir('contar', a),
    gravar: (a, aposLote) => pedir('gravar', a, aposLote),
    fechar: async () => {
      if (morto) return;
      await new Promise<void>((r) => { w.once('exit', () => r()); w.postMessage({ id: 0, op: 'fechar' } as PedidoWorker); setTimeout(() => { void w.terminate().then(() => r()); }, 5000).unref(); });
    },
  };
}
