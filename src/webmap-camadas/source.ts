import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { join } from 'node:path';
import { createGunzip, createInflate } from 'node:zlib';
import { githubHeaders } from '../../prisma/webmap-github';

/** Pedaco máximo entregue por lerStream. O parser nunca vê o arquivo inteiro de uma vez. */
export const PEDACO_TEXTO = 64 * 1024;

export type ArquivoFonte = { nome: string; sha: string; bytes: number };
export type ListagemFonte = { commitSha: string; layersJsSha: string; layers: Map<string, ArquivoFonte>; styles: Map<string, ArquivoFonte> };

/** Fonte do Webmap: a integração já configurada (GitHub qgis2web) ou um diretório local (testes/fixtures). */
export interface WebmapCamadasFonte {
  descricao: string;
  listar(): Promise<ListagemFonte>;
  lerTexto(caminho: string): Promise<string>;
  lerBinario(caminho: string): Promise<Buffer>;
  /** Conteúdo em pedaços de texto (UTF-8), sem carregar o arquivo inteiro. */
  lerStream(caminho: string): AsyncIterable<string>;
  /** Serializável: permite recriar a mesma fonte dentro do worker do job (memória limitada). */
  config?: FonteConfig;
}

export type FonteConfig = { tipo: 'github'; repo: string; branch: string; rawRoot: string } | { tipo: 'dir'; root: string };

export function criarFonte(c: FonteConfig): WebmapCamadasFonte {
  return c.tipo === 'github' ? new GithubWebmapFonte(c.repo, c.branch, c.rawRoot) : new DiretorioWebmapFonte(c.root);
}

export function gitBlobSha(buf: Buffer) {
  return createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
}

export class GithubWebmapFonte implements WebmapCamadasFonte {
  readonly descricao: string;
  constructor(
    private readonly repo = process.env.WEBMAP_GITHUB_REPO?.trim() || 'SMMAFRANCA/webmap',
    private readonly branch = process.env.WEBMAP_GITHUB_BRANCH?.trim() || 'main',
    private readonly rawRoot = (process.env.WEBMAP_RAW_BASE?.trim() || `https://raw.githubusercontent.com/${process.env.WEBMAP_GITHUB_REPO?.trim() || 'SMMAFRANCA/webmap'}/${process.env.WEBMAP_GITHUB_BRANCH?.trim() || 'main'}/layers`).replace(/\/layers\/?$/, ''),
  ) {
    this.descricao = `github:${this.repo}@${this.branch}`;
  }
  get config(): FonteConfig {
    return { tipo: 'github', repo: this.repo, branch: this.branch, rawRoot: this.rawRoot };
  }
  private async api<T>(path: string): Promise<T> {
    const url = `https://api.github.com/repos/${this.repo}/${path}`;
    const res = await fetch(url, { headers: githubHeaders() });
    if (!res.ok) throw new Error(`GitHub API ${res.status} em ${url}`);
    return (await res.json()) as T;
  }
  async listar(): Promise<ListagemFonte> {
    const commit = await this.api<{ sha: string }>(`commits/${this.branch}`);
    const dir = async (d: string) => {
      const items = await this.api<Array<{ name: string; sha: string; size: number; type: string }>>(`contents/${d}?ref=${commit.sha}`);
      return new Map(items.filter((i) => i.type === 'file').map((i) => [i.name, { nome: i.name, sha: i.sha, bytes: i.size }]));
    };
    const layers = await dir('layers');
    const styles = await dir('styles');
    return { commitSha: commit.sha, layersJsSha: layers.get('layers.js')?.sha ?? '', layers, styles };
  }
  async lerBinario(caminho: string) {
    const url = `${this.rawRoot}/${caminho}`;
    let ultimo: unknown;
    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      try {
        const res = await fetch(url);
        if (res.status === 404) throw Object.assign(new Error(`Fonte 404 em ${url}`), { definitivo: true });
        if (!res.ok) throw new Error(`Fonte ${res.status} em ${url}`);
        return Buffer.from(await res.arrayBuffer());
      } catch (error) {
        ultimo = error;
        if ((error as { definitivo?: boolean }).definitivo) break;
        await new Promise((r) => setTimeout(r, 500 * tentativa));
      }
    }
    throw ultimo instanceof Error ? ultimo : new Error(String(ultimo));
  }
  async lerTexto(caminho: string) {
    return (await this.lerBinario(caminho)).toString('utf8');
  }
  lerStream(caminho: string): AsyncIterable<string> {
    return textoHttpEmPedacos(`${this.rawRoot}/${caminho}`);
  }
}

export class DiretorioWebmapFonte implements WebmapCamadasFonte {
  readonly descricao: string;
  constructor(private readonly root: string) {
    this.descricao = `dir:${root}`;
  }
  get config(): FonteConfig {
    return { tipo: 'dir', root: this.root };
  }
  async listar(): Promise<ListagemFonte> {
    const dir = async (d: string) => {
      const out = new Map<string, ArquivoFonte>();
      let names: string[] = [];
      try { names = await readdir(join(this.root, d)); } catch { return out; }
      for (const n of names) {
        const p = join(this.root, d, n);
        if (!(await stat(p)).isFile()) continue;
        const st = await stat(p);
        const h = createHash('sha1').update(`blob ${st.size}\0`);
        for await (const ch of createReadStream(p, { highWaterMark: 256 * 1024 })) h.update(ch as Buffer);
        out.set(n, { nome: n, sha: h.digest('hex'), bytes: st.size });
      }
      return out;
    };
    const layers = await dir('layers');
    const styles = await dir('styles');
    const layersJsSha = layers.get('layers.js')?.sha;
    if (!layersJsSha) throw new Error(`Fonte ${this.root}: layers/layers.js não encontrado`);
    return { commitSha: `local-${layersJsSha.slice(0, 12)}`, layersJsSha, layers, styles };
  }
  async lerBinario(caminho: string) {
    return readFile(join(this.root, caminho));
  }
  async lerTexto(caminho: string) {
    return (await this.lerBinario(caminho)).toString('utf8');
  }
  async *lerStream(caminho: string): AsyncIterable<string> {
    const stream = createReadStream(join(this.root, caminho), { encoding: 'utf8', highWaterMark: PEDACO_TEXTO });
    for await (const chunk of stream) yield chunk as string;
  }
}

function pedirHttp(url: string, redirects = 0): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = (u.protocol === 'http:' ? httpRequest : httpsRequest)(u, {
      headers: { 'User-Agent': 'SIGMA-webmap-import', Accept: '*/*', 'Accept-Encoding': 'gzip, deflate' },
    }, (res) => {
      const code = res.statusCode ?? 0;
      if (code >= 300 && code < 400 && res.headers.location) {
        res.resume();
        if (redirects >= 5) {
          reject(new Error(`Fonte: redirects demais em ${url}`));
          return;
        }
        pedirHttp(new URL(res.headers.location, url).href, redirects + 1).then(resolve, reject);
        return;
      }
      resolve(res);
    });
    req.on('error', reject);
    req.end();
  });
}

/** Download em pedaços pequenos (socket/gzip), sem juntar o corpo num único Buffer. */
export async function* textoHttpEmPedacos(url: string): AsyncIterable<string> {
  const res = await pedirHttp(url);
  const code = res.statusCode ?? 0;
  if (code !== 200) {
    res.resume();
    throw new Error(`Fonte ${code} em ${url}`);
  }
  const enc = String(res.headers['content-encoding'] ?? '');
  const corpo = /gzip/i.test(enc)
    ? res.pipe(createGunzip({ chunkSize: 16 * 1024 }))
    : /deflate/i.test(enc)
      ? res.pipe(createInflate({ chunkSize: 16 * 1024 }))
      : res;
  const decoder = new TextDecoder('utf-8');
  try {
    for await (const chunk of corpo as AsyncIterable<Buffer>) {
      const text = decoder.decode(chunk, { stream: true });
      if (text) yield text;
    }
    const tail = decoder.decode();
    if (tail) yield tail;
  } finally {
    res.destroy();
  }
}
