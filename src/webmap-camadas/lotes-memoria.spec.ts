import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gravarCamada, LOTE_ELEMENTOS } from './camada-io';
import type { WebmapCamadasFonte } from './source';

const ROOT = join(__dirname, '../..');
const CHILD = join(ROOT, 'test/webmap-camadas/lote-volume-child.ts');

type Linha = { id: string; camadaId: string };

function fonteSintetica(qtd: (arquivo: string) => number): WebmapCamadasFonte {
  return {
    descricao: 'sintetica',
    async listar() { throw new Error('nao usado'); },
    async lerTexto() { throw new Error('nao usado'); },
    async lerBinario() { throw new Error('nao usado'); },
    async *lerStream(caminho: string) {
      const n = qtd(caminho);
      yield 'var json_S={"type":"FeatureCollection","features":[';
      for (let i = 0; i < n; i++) {
        if (i) yield ',';
        const lat = (-20.5 - i * 1e-6).toFixed(6);
        yield `{"type":"Feature","properties":{"fid":"f${i}"},"geometry":{"type":"Point","coordinates":[-47.4,${lat}]}}`;
      }
      yield ']}';
    },
  };
}

describe('camadas Webmap — lotes e reaplicação', () => {
  it('aplicação parcial + reaplicar não duplica e não apaga o que já foi gravado', async () => {
    const N1 = 2500;
    const N2 = 800;
    const fonte = fonteSintetica((caminho) => (caminho.endsWith('B.js') ? N2 : N1));
    const rows = new Map<string, Linha>();
    const sqls: string[] = [];
    const tamanhos: number[] = [];
    const exec = async (sql: string, params: unknown[]) => {
      sqls.push(sql);
      if (/\bDELETE\b/i.test(sql)) throw new Error('apagou dados existentes');
      const lista = JSON.parse(String(params[0])) as Linha[];
      tamanhos.push(lista.length);
      for (const row of lista) rows.set(row.id, row);
    };
    const alvo = (arquivo: string, camadaId: string) => ({ arquivo, label: arquivo, grupo: 'Sintetico', camadaId, versaoId: 'ver-1' });
    const da = (camadaId: string) => [...rows.values()].filter((r) => r.camadaId === camadaId);

    await gravarCamada(exec, fonte, alvo('A.js', 'cam-a'));
    let lotesB = 0;
    await expect(gravarCamada(exec, fonte, alvo('B.js', 'cam-b'), {
      aposLote: () => { if (++lotesB >= 2) throw new Error('corte parcial'); },
    })).rejects.toThrow(/corte parcial/);

    const idsParciais = da('cam-b').map((r) => r.id);
    expect(idsParciais.length).toBeGreaterThan(0);
    expect(idsParciais.length).toBeLessThan(N2);
    expect(da('cam-a')).toHaveLength(N1);

    await gravarCamada(exec, fonte, alvo('A.js', 'cam-a'));
    await gravarCamada(exec, fonte, alvo('B.js', 'cam-b'));

    expect(da('cam-a')).toHaveLength(N1);
    expect(da('cam-b')).toHaveLength(N2);
    expect(rows.size).toBe(N1 + N2);
    for (const id of idsParciais) expect(rows.has(id)).toBe(true);
    expect(sqls.some((sql) => /ON CONFLICT/i.test(sql))).toBe(true);
    expect(sqls.some((sql) => /\bDELETE\b/i.test(sql))).toBe(false);
    expect(tamanhos.length).toBeGreaterThan(2);
    expect(Math.max(...tamanhos)).toBeLessThanOrEqual(LOTE_ELEMENTOS);
  });

  it('volume sintético maior que o heap é gravado em lotes', async () => {
    const feicoes = 40_000;
    const pad = 8_000;
    const heapMb = 192;
    const saida = await new Promise<{ feicoes: number; lotes: number; maiorLote: number; bytesFonte: number; heapMiB: number }>((resolve, reject) => {
      const child = spawn(process.execPath, ['--max-old-space-size=' + heapMb, '--import', 'tsx', CHILD, String(feicoes), String(pad)], {
        cwd: ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let out = '';
      let err = '';
      child.stdout.on('data', (d: Buffer) => { out += d.toString(); });
      child.stderr.on('data', (d: Buffer) => { err += d.toString(); });
      child.on('error', reject);
      child.on('exit', (code) => {
        if (code !== 0) reject(new Error(`volume saiu ${code}: ${err || out}`));
        else {
          try { resolve(JSON.parse(out)); } catch (error) { reject(new Error(`saida invalida: ${out} ${error}`)); }
        }
      });
    });
    expect(saida.feicoes).toBe(feicoes);
    expect(saida.lotes).toBeGreaterThan(10);
    expect(saida.maiorLote).toBeLessThanOrEqual(LOTE_ELEMENTOS);
    expect(saida.bytesFonte).toBeGreaterThan(heapMb * 1024 * 1024);
    expect(saida.heapMiB).toBeLessThan(heapMb);
  }, 120_000);

  it('worker com heap menor que o arquivo conta duas camadas sintéticas', async () => {
    const heapMb = 48;
    const dir = await mkdtemp(join(tmpdir(), 'wm-lotes-'));
    try {
      const layers = join(dir, 'layers');
      const { mkdir } = await import('node:fs/promises');
      await mkdir(layers);
      const n = 6_000;
      const pad = 16_000;
      await escreverCamada(join(layers, 'A.js'), n, pad, 'A');
      await escreverCamada(join(layers, 'B.js'), n, pad, 'B');
      const bytes = (await stat(join(layers, 'A.js'))).size;
      expect(bytes).toBeGreaterThan(heapMb * 1024 * 1024);
      const contagem = await new Promise<number>((resolve, reject) => {
        const child = spawn(process.execPath, ['--import', 'tsx', CHILD, 'worker', dir, String(n)], {
          cwd: ROOT,
          env: { ...process.env, WEBMAP_CAMADAS_JOB_HEAP_MB: String(heapMb), WEBMAP_CAMADAS_JOB_HEAP_YOUNG_MB: '4' },
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        let out = '';
        let err = '';
        child.stdout.on('data', (d: Buffer) => { out += d.toString(); });
        child.stderr.on('data', (d: Buffer) => { err += d.toString(); });
        child.on('error', reject);
        child.on('exit', (code) => {
          if (code !== 0) reject(new Error(`worker saiu ${code}: ${err || out}`));
          else resolve(Number(out.trim()));
        });
      });
      expect(contagem).toBe(n * 2);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 120_000);
});

function escreverCamada(path: string, n: number, pad: number, prefixo: string) {
  return new Promise<void>((resolve, reject) => {
    const ws = createWriteStream(path);
    const bloco = prefixo.repeat(Math.ceil(pad / prefixo.length)).slice(0, pad);
    ws.on('error', reject);
    ws.on('finish', () => resolve());
    ws.write('var json_Vol={"type":"FeatureCollection","features":[');
    let i = 0;
    const step = () => {
      let ok = true;
      while (i < n && ok) {
        const virgula = i ? ',' : '';
        const lat = (-20.5 - i * 1e-8).toFixed(8);
        ok = ws.write(`${virgula}{"type":"Feature","properties":{"fid":"${i}","pad":"${bloco}"},"geometry":{"type":"Point","coordinates":[-47.4,${lat}]}}`);
        i++;
      }
      if (i < n) ws.once('drain', step);
      else ws.end(']}');
    };
    step();
  });
}
