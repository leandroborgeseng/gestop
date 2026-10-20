import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { githubHeaders } from '../../prisma/webmap-github';

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
  async *lerStream(caminho: string): AsyncIterable<string> {
    const url = `${this.rawRoot}/${caminho}`;
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`Fonte ${res.status} em ${url}`);
    const decoder = new TextDecoder('utf-8');
    const reader = res.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        yield decoder.decode(value, { stream: true });
      }
      const tail = decoder.decode();
      if (tail) yield tail;
    } finally {
      reader.releaseLock();
      await res.body.cancel().catch(() => undefined);
    }
  }
}

export class DiretorioWebmapFonte implements WebmapCamadasFonte {
  readonly descricao: string;
  constructor(private readonly root: string) {
    this.descricao = `dir:${root}`;
  }
  async listar(): Promise<ListagemFonte> {
    const dir = async (d: string) => {
      const out = new Map<string, ArquivoFonte>();
      let names: string[] = [];
      try { names = await readdir(join(this.root, d)); } catch { return out; }
      for (const n of names) {
        const p = join(this.root, d, n);
        if (!(await stat(p)).isFile()) continue;
        const buf = await readFile(p);
        out.set(n, { nome: n, sha: gitBlobSha(buf), bytes: buf.length });
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
    const stream = createReadStream(join(this.root, caminho), { encoding: 'utf8', highWaterMark: 256 * 1024 });
    for await (const chunk of stream) yield chunk as string;
  }
}
