/* 296 — levantamento na fonte: feições > 20.000 vértices (por camada) e feições sem conserto por grupo. Só leitura. */
import { lerEstrutura } from '../../src/webmap-camadas/core';
import { repararGeometria, MAX_VERTICES_REPARO } from '../../src/webmap-camadas/repair';
import { DiretorioWebmapFonte, GithubWebmapFonte } from '../../src/webmap-camadas/source';
import { FeatureStreamSplitter } from '../../src/webmap-camadas/stream';

const contar = (c: unknown): number => (Array.isArray(c) ? (typeof c[0] === 'number' ? 1 : c.reduce((t: number, x) => t + contar(x), 0)) : 0);
(async () => {
  const origem = process.argv[2];
  const fonte = origem === 'github' ? new GithubWebmapFonte() : new DiretorioWebmapFonte(origem);
  const { declaradas } = await lerEstrutura(fonte);
  const grandes: Array<{ grupo: string; camada: string; tipo: string; feicoes: number; validas: number; corrigidas: number; semConserto: number; maxVertices: number }> = [];
  const invalidasPorGrupo = new Map<string, number>();
  const motivos = new Map<string, number>();
  let total = 0;
  for (const d of declaradas) {
    const g = { grupo: d.grupo, camada: d.titulo, tipo: '', feicoes: 0, validas: 0, corrigidas: 0, semConserto: 0, maxVertices: 0 };
    const pend: unknown[] = [];
    const sp = new FeatureStreamSplitter((j) => pend.push(JSON.parse(j)));
    for await (const ch of fonte.lerStream(`layers/${d.arquivo}`)) {
      sp.push(ch);
      while (pend.length) {
        const f = pend.shift() as { geometry?: { type?: string; coordinates?: unknown } | null };
        const v = contar(f.geometry?.coordinates);
        const r = repararGeometria(f.geometry);
        if (r.status === 'invalida') {
          total++;
          invalidasPorGrupo.set(d.grupo, (invalidasPorGrupo.get(d.grupo) ?? 0) + 1);
          motivos.set(r.motivo.replace(/\(\d+\)/, '(n)'), (motivos.get(r.motivo.replace(/\(\d+\)/, '(n)')) ?? 0) + 1);
        }
        if (v > MAX_VERTICES_REPARO) {
          g.feicoes++;
          g.tipo = f.geometry?.type ?? '?';
          g.maxVertices = Math.max(g.maxVertices, v);
          if (r.status === 'ok') g.validas++;
          else if (r.status === 'corrigida') g.corrigidas++;
          else g.semConserto++;
        }
      }
    }
    if (g.feicoes) grandes.push(g);
  }
  console.log(`FEICOES_ACIMA_DE_${MAX_VERTICES_REPARO}_VERTICES (por camada)`);
  console.log('grupo | camada | tipo | feições | válidas como vieram | corrigidas | sem conserto | maior nº de vértices');
  for (const g of grandes.sort((a, b) => b.maxVertices - a.maxVertices)) console.log([g.grupo, g.camada, g.tipo, g.feicoes, g.validas, g.corrigidas, g.semConserto, g.maxVertices].join(' | '));
  const soma = (k: 'feicoes' | 'validas' | 'corrigidas' | 'semConserto') => grandes.reduce((t, g) => t + g[k], 0);
  console.log(`TOTAL acima do limite: ${soma('feicoes')} feições em ${grandes.length} camadas; válidas ${soma('validas')}, corrigidas ${soma('corrigidas')}, sem conserto ${soma('semConserto')}`);
  console.log(`\nSEM_CONSERTO por grupo (total ${total})`);
  for (const [k, v] of [...invalidasPorGrupo].sort((a, b) => b[1] - a[1])) console.log(`${k} | ${v}`);
  console.log('\nMOTIVOS');
  for (const [k, v] of [...motivos].sort((a, b) => b[1] - a[1])) console.log(`${k} | ${v}`);
})();
