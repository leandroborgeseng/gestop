/**
 * 296 — worker de leitura/gravação de camadas (heap limitado por resourceLimits, sem Prisma: só `pg`).
 * Recebe pedidos { id, op: 'contar' | 'gravar', alvo } e responde com as estatísticas da camada.
 */
import { parentPort, workerData } from 'node:worker_threads';
import { Client } from 'pg';
import { contarCamada, gravarCamada } from './camada-io';
import { criarFonte } from './source';
import type { DadosWorker, MsgDoWorker, PedidoWorker } from './job';

const dados = workerData as DadosWorker;
const fonte = criarFonte(dados.fonte);
const enviar = (m: MsgDoWorker) => parentPort!.postMessage(m);
let pg: Client | null = null;
async function conexao() {
  if (!pg) {
    pg = new Client({ connectionString: dados.dbUrl });
    await pg.connect();
  }
  return pg;
}
let fila = Promise.resolve();
parentPort!.on('message', (m: PedidoWorker) => {
  if (m.op === 'fechar') {
    fila = fila.then(async () => { await pg?.end().catch(() => undefined); process.exit(0); });
    return;
  }
  fila = fila.then(async () => {
    try {
      const stats = m.op === 'contar'
        ? await contarCamada(fonte, m.alvo)
        : await gravarCamada(async (sql, params) => (await conexao()).query(sql, params), fonte, m.alvo, { aposLote: (lote) => enviar({ tipo: 'lote', id: m.id, lote }) });
      enviar({ tipo: 'ok', id: m.id, stats });
    } catch (error) {
      enviar({ tipo: 'erro', id: m.id, mensagem: error instanceof Error ? error.message : String(error) });
    }
  });
});
