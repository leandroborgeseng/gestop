/**
 * Prova de volume, sem dados reais.
 * - gravar: node --max-old-space-size=N --import tsx lote-volume-child.ts <feicoes> <pad>
 * - worker: node --import tsx lote-volume-child.ts worker <dir-fonte> <feicoes-por-arquivo>
 */
import { gravarCamada, LOTE_ELEMENTOS } from '../../src/webmap-camadas/camada-io';
import type { WebmapCamadasFonte } from '../../src/webmap-camadas/source';

async function gravarVolume() {
  const n = Number(process.argv[2]);
  const pad = Number(process.argv[3]);
  if (!Number.isFinite(n) || !Number.isFinite(pad) || n < 1 || pad < 1) {
    throw new Error('uso: lote-volume-child.ts <feicoes> <pad>');
  }
  const bloco = 'd'.repeat(pad);
  let bytesFonte = 0;
  const fonte: WebmapCamadasFonte = {
    descricao: 'sintetica',
    async listar() { throw new Error('nao usado'); },
    async lerTexto() { throw new Error('nao usado'); },
    async lerBinario() { throw new Error('nao usado'); },
    async *lerStream() {
      const abrir = 'var json_V={"type":"FeatureCollection","features":[';
      bytesFonte += abrir.length;
      yield abrir;
      for (let i = 0; i < n; i++) {
        const lat = (-20.5 - i * 1e-8).toFixed(8);
        const feat = `${i ? ',' : ''}{"type":"Feature","properties":{"fid":"${i}","pad":"${bloco}"},"geometry":{"type":"Polygon","coordinates":[[[-47.4,${lat}],[-47.399,${lat}],[-47.399,${(-20.499 - i * 1e-8).toFixed(8)}],[-47.4,${(-20.499 - i * 1e-8).toFixed(8)}],[-47.4,${lat}]]]}}`;
        bytesFonte += feat.length;
        yield feat;
      }
      const fechar = ']}';
      bytesFonte += fechar.length;
      yield fechar;
    },
  };
  const lotes: Array<{ n: number; bytes: number }> = [];
  const exec = async (sql: string, params: unknown[]) => {
    if (/\bDELETE\b/i.test(sql)) throw new Error('nao pode apagar');
    const payload = String(params[0] ?? '');
    const lista = JSON.parse(payload) as unknown[];
    lotes.push({ n: lista.length, bytes: payload.length });
  };
  const stats = await gravarCamada(exec, fonte, { arquivo: 'V.js', label: 'Volume', grupo: 'Sintetico', camadaId: 'cam-vol', versaoId: 'ver-vol' });
  const total = stats.pontos + stats.linhas + stats.poligonos;
  const maior = lotes.reduce((m, l) => Math.max(m, l.n), 0);
  if (total !== n) throw new Error(`contagem ${total} != ${n}`);
  if (lotes.length < 2) throw new Error('gravou num lote so');
  if (maior > LOTE_ELEMENTOS) throw new Error(`lote com ${maior} feicoes`);
  if (lotes.reduce((s, l) => s + l.n, 0) !== n) throw new Error('soma dos lotes diferente do total');
  process.stdout.write(JSON.stringify({
    feicoes: total,
    lotes: lotes.length,
    maiorLote: maior,
    bytesFonte,
    heapMiB: Math.round(process.memoryUsage().heapUsed / 1048576),
  }));
}

async function contarNoWorker() {
  const root = process.argv[3];
  const porArquivo = Number(process.argv[4]);
  const { leitorEmWorker } = await import('../../src/webmap-camadas/job');
  const leitor = leitorEmWorker('postgres://127.0.0.1/unused', { tipo: 'dir', root });
  try {
    const a = await leitor.contar({ arquivo: 'A.js', label: 'A', grupo: 'Sintetico' });
    const b = await leitor.contar({ arquivo: 'B.js', label: 'B', grupo: 'Sintetico' });
    const total = a.pontos + a.linhas + a.poligonos + b.pontos + b.linhas + b.poligonos;
    if (total !== porArquivo * 2) throw new Error(`worker contou ${total}`);
    process.stdout.write(String(total));
  } finally {
    await leitor.fechar();
  }
}

const tarefa = process.argv[2] === 'worker' ? contarNoWorker() : gravarVolume();
tarefa.catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
