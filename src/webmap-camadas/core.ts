import { createHash, randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { chaveCamada, chaveGrupo } from './normalize';
import { CamadaDeclarada, ErroLeitura, EstiloNormalizado, GeometriaFamilia, nomeBaseCamada, parseLayersJs, parseStyle, readFeatures } from './parse';
import type { ListagemFonte, WebmapCamadasFonte } from './source';

export const WEBMAP_CAMADAS_ENTIDADE = 'WebmapCamadasImport';
export const SIMULACAO_TTL_MS = 30 * 60 * 1000;
export const MAX_ERROS_TELA = 50;
const LOCK_KEY = 296_000_296;

export type Fase = 'lendo_fonte' | 'comparando' | 'gravando';
export type StatusCamada = 'nova' | 'atualizada' | 'sem_mudanca' | 'reativada' | 'removida_origem';
export type Contagem = { pontos: number; linhas: number; poligonos: number };

export type PlanoCamada = {
  chaveOrigem: string; grupo: string; grupoChave: string; nomeOriginal: string; variavel: string; arquivo: string; estiloArquivo: string | null;
  ordem: number; shaArquivo: string; shaEstilo: string | null; status: StatusCamada; conteudoMudou: boolean; elementos: Contagem; erros: number; bytes: number;
};

export type ResultadoSimulacao = {
  simulacaoId: string; fonte: string; commitSha: string; fonteHash: string; criadaEm: string; expiraEm: string;
  grupos: number; camadas: number; elementos: Contagem & { total: number };
  novas: number; atualizadas: number; semMudanca: number; reativadas: number; removidasOrigem: number;
  camadasDetalhe: Array<Omit<PlanoCamada, 'grupoChave' | 'arquivo' | 'estiloArquivo' | 'shaArquivo' | 'shaEstilo' | 'conteudoMudou'>>;
  erros: ErroLeitura[]; totalErros: number; resultadoPrevisto: 'SUCESSO' | 'PARCIAL';
};

export class FonteMudouError extends Error {}
export class ImportacaoEmAndamentoError extends Error {}

function familiaDoEstilo(e: EstiloNormalizado): GeometriaFamilia | 'X' {
  if (e.tipo === 'circle' || e.tipo === 'icon') return 'POINT';
  if (e.tipo === 'fill') return 'POLYGON';
  if (e.tipo === 'line') return 'LINE';
  return 'X';
}

/** Executa em paralelo com limite, preservando a ordem. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }));
  return out;
}

export function fonteHashDe(list: ListagemFonte, declaradas: Array<{ arquivo: string; estiloArquivo: string | null }>) {
  const h = createHash('sha256').update(`layers.js:${list.layersJsSha}\n`);
  for (const d of [...declaradas].sort((a, b) => a.arquivo.localeCompare(b.arquivo))) {
    h.update(`${d.arquivo}:${list.layers.get(d.arquivo)?.sha ?? ''}:${d.estiloArquivo ? list.styles.get(d.estiloArquivo)?.sha ?? '' : ''}\n`);
  }
  return h.digest('hex');
}

type Leitura = { list: ListagemFonte; declaradas: Array<CamadaDeclarada & { chave: string; grupoChave: string; arquivo: string; estiloArquivo: string | null; estiloTexto: string | null }>; grupos: Array<{ titulo: string; ordem: number; chave: string }> };

/** Lê layers.js e estilos e resolve a chave estável (D-296d). Colisão no mesmo grupo (par polígono/ponto do qgis2web) → sufixo da família. */
export async function lerEstrutura(fonte: WebmapCamadasFonte): Promise<Leitura> {
  const list = await fonte.listar();
  const parsed = parseLayersJs(await fonte.lerTexto('layers/layers.js'));
  const pre = await mapLimit(parsed.camadas, 8, async (c) => {
    const arquivo = `${c.variavel}.js`;
    if (!list.layers.has(arquivo)) throw new Error(`Camada ${c.titulo}: arquivo layers/${arquivo} ausente na fonte`);
    const estiloNome = `${c.variavel}_style.js`;
    const estiloArquivo = list.styles.has(estiloNome) ? estiloNome : null;
    const estiloTexto = estiloArquivo ? await fonte.lerTexto(`styles/${estiloArquivo}`) : null;
    return { ...c, chave: chaveCamada(c.grupo, nomeBaseCamada(c)), grupoChave: chaveGrupo(c.grupo), arquivo, estiloArquivo, estiloTexto };
  });
  const count = new Map<string, number>();
  pre.forEach((d) => count.set(d.chave, (count.get(d.chave) ?? 0) + 1));
  const seen = new Map<string, number>();
  for (const d of pre) {
    if ((count.get(d.chave) ?? 0) > 1) {
      let k = `${d.chave}#${familiaDoEstilo(parseStyle(d.estiloTexto))}`;
      const n = (seen.get(k) ?? 0) + 1;
      seen.set(k, n);
      if (n > 1) k = `${k}#${n}`;
      d.chave = k;
    }
  }
  return { list, declaradas: pre, grupos: parsed.grupos.map((g) => ({ ...g, chave: chaveGrupo(g.titulo) })) };
}

function contar(elementos: Array<{ familia: GeometriaFamilia }>): Contagem {
  const c = { pontos: 0, linhas: 0, poligonos: 0 };
  for (const e of elementos) {
    if (e.familia === 'POINT') c.pontos++;
    else if (e.familia === 'LINE') c.linhas++;
    else c.poligonos++;
  }
  return c;
}

/** Simulação: só lê (fonte e banco). Não grava nada. */
export async function simular(prisma: PrismaClient, fonte: WebmapCamadasFonte, onFase?: (f: Fase) => void): Promise<{ resultado: ResultadoSimulacao; plano: PlanoCamada[] }> {
  onFase?.('lendo_fonte');
  const leitura = await lerEstrutura(fonte);
  onFase?.('comparando');
  const existentes = await prisma.webmapCamada.findMany({ include: { grupo: true } });
  const porChave = new Map(existentes.map((e) => [e.chaveOrigem, e]));
  const plano: PlanoCamada[] = [];
  const erros: ErroLeitura[] = [];
  const lidos = await mapLimit(leitura.declaradas, 4, async (d) => {
    const ex = porChave.get(d.chave);
    const shaArquivo = leitura.list.layers.get(d.arquivo)!.sha;
    if (ex && ex.shaArquivo === shaArquivo) return null;
    const r = readFeatures(await fonte.lerTexto(`layers/${d.arquivo}`), d.titulo);
    return { contagem: contar(r.elementos), erros: r.erros };
  });
  leitura.declaradas.forEach((d, i) => {
    const ex = porChave.get(d.chave);
    const shaArquivo = leitura.list.layers.get(d.arquivo)!.sha;
    const shaEstilo = d.estiloArquivo ? leitura.list.styles.get(d.estiloArquivo)!.sha : null;
    const conteudoMudou = !ex || ex.shaArquivo !== shaArquivo;
    const metaMudou = !!ex && (ex.shaEstilo !== shaEstilo || ex.nomeOriginal !== d.titulo || ex.grupo.chaveOrigem !== d.grupoChave || ex.ordem !== d.ordem || ex.varOrigem !== d.variavel || ex.grupo.titulo !== d.grupo);
    let status: StatusCamada = !ex ? 'nova' : !ex.ativo || ex.removidaOrigem ? 'reativada' : conteudoMudou || metaMudou ? 'atualizada' : 'sem_mudanca';
    const lido = lidos[i];
    const elementos: Contagem = lido ? lido.contagem : { pontos: ex!.totalPontos, linhas: ex!.totalLinhas, poligonos: ex!.totalPoligonos };
    const nErros = lido ? lido.erros.length : 0;
    if (lido) erros.push(...lido.erros);
    if (status === 'sem_mudanca' && nErros) status = 'atualizada';
    plano.push({ chaveOrigem: d.chave, grupo: d.grupo, grupoChave: d.grupoChave, nomeOriginal: d.titulo, variavel: d.variavel, arquivo: d.arquivo, estiloArquivo: d.estiloArquivo, ordem: d.ordem, shaArquivo, shaEstilo, status, conteudoMudou, elementos, erros: nErros, bytes: leitura.list.layers.get(d.arquivo)!.bytes });
  });
  const naFonte = new Set(plano.map((p) => p.chaveOrigem));
  for (const ex of existentes) {
    if (naFonte.has(ex.chaveOrigem) || ex.removidaOrigem) continue;
    plano.push({ chaveOrigem: ex.chaveOrigem, grupo: ex.grupo.titulo, grupoChave: ex.grupo.chaveOrigem, nomeOriginal: ex.nomeOriginal, variavel: ex.varOrigem, arquivo: ex.arquivoOrigem, estiloArquivo: null, ordem: ex.ordem, shaArquivo: ex.shaArquivo, shaEstilo: ex.shaEstilo, status: 'removida_origem', conteudoMudou: false, elementos: { pontos: ex.totalPontos, linhas: ex.totalLinhas, poligonos: ex.totalPoligonos }, erros: 0, bytes: ex.bytesOrigem });
  }
  const ativos = plano.filter((p) => p.status !== 'removida_origem');
  const tot = ativos.reduce((a, p) => ({ pontos: a.pontos + p.elementos.pontos, linhas: a.linhas + p.elementos.linhas, poligonos: a.poligonos + p.elementos.poligonos }), { pontos: 0, linhas: 0, poligonos: 0 });
  const by = (s: StatusCamada) => plano.filter((p) => p.status === s).length;
  const agora = new Date();
  const resultado: ResultadoSimulacao = {
    simulacaoId: randomUUID(), fonte: fonte.descricao, commitSha: leitura.list.commitSha,
    fonteHash: fonteHashDe(leitura.list, leitura.declaradas), criadaEm: agora.toISOString(), expiraEm: new Date(agora.getTime() + SIMULACAO_TTL_MS).toISOString(),
    grupos: leitura.grupos.length, camadas: ativos.length, elementos: { ...tot, total: tot.pontos + tot.linhas + tot.poligonos },
    novas: by('nova'), atualizadas: by('atualizada'), semMudanca: by('sem_mudanca'), reativadas: by('reativada'), removidasOrigem: by('removida_origem'),
    camadasDetalhe: plano.map(({ chaveOrigem, grupo, nomeOriginal, variavel, ordem, status, elementos, erros: e, bytes }) => ({ chaveOrigem, grupo, nomeOriginal, variavel, ordem, status, elementos, erros: e, bytes })),
    erros, totalErros: erros.length, resultadoPrevisto: erros.length ? 'PARCIAL' : 'SUCESSO',
  };
  return { resultado, plano };
}

export type IconeStore = (buf: Buffer, mimeType: string, sha256: string) => Promise<{ storageKey: string; url: string }>;

export type ResultadoAplicacao = Omit<ResultadoSimulacao, 'simulacaoId' | 'expiraEm' | 'criadaEm'> & { simulacaoId: string; aplicadaEm: string; resultado: 'SUCESSO' | 'PARCIAL'; duracaoMs: number; icones: number };

function mimeDe(path: string) {
  const ext = path.split('.').pop()?.toLowerCase();
  return ext === 'svg' ? 'image/svg+xml' : ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'application/octet-stream';
}

/**
 * Aplicação: exige simulação válida (mesmo fonteHash, < 30 min). Tudo em UMA transação:
 * falha em qualquer ponto => rollback, nada muda. Lock consultivo impede aplicações simultâneas.
 */
export async function aplicar(
  prisma: PrismaClient, fonte: WebmapCamadasFonte,
  sim: { simulacaoId: string; fonteHash: string; criadaEm: string },
  opts: { icones?: IconeStore; onFase?: (f: Fase) => void; agora?: Date; txTimeoutMs?: number; falharDepoisDe?: number } = {},
): Promise<ResultadoAplicacao> {
  const inicio = Date.now();
  const agora = opts.agora ?? new Date();
  if (agora.getTime() - new Date(sim.criadaEm).getTime() > SIMULACAO_TTL_MS) throw new FonteMudouError('O prazo da simulação (30 min) venceu; simule novamente.');
  const { resultado: atual, plano } = await simular(prisma, fonte, opts.onFase);
  if (atual.fonteHash !== sim.fonteHash) throw new FonteMudouError('A fonte mudou desde a simulação; simule novamente.');
  const leitura = await lerEstrutura(fonte);
  const decl = new Map(leitura.declaradas.map((d) => [d.chave, d]));

  // Ícones: copiados para o nosso armazenamento (conteúdo endereçado por sha256), fora da transação; a linha no banco vai na transação.
  const iconesNovos = new Map<string, { origem: string; sha256: string; mimeType: string; storageKey: string; url: string }>();
  const iconePorOrigem = new Map<string, { url: string; sha256: string }>();
  for (const p of plano) {
    const d = decl.get(p.chaveOrigem);
    const est = d ? parseStyle(d.estiloTexto) : null;
    const origem = est?.icone?.origem;
    if (!origem || iconePorOrigem.has(origem) || !opts.icones) continue;
    const buf = await fonte.lerBinario(origem.replace(/^\.?\//, ''));
    const sha256 = createHash('sha256').update(buf).digest('hex');
    const existente = await prisma.webmapIcone.findUnique({ where: { sha256 } });
    if (existente) {
      iconePorOrigem.set(origem, { url: existente.url, sha256 });
      continue;
    }
    const stored = await opts.icones(buf, mimeDe(origem), sha256);
    iconesNovos.set(sha256, { origem, sha256, mimeType: mimeDe(origem), ...stored });
    iconePorOrigem.set(origem, { url: stored.url, sha256 });
  }

  opts.onFase?.('gravando');
  let escritas = 0;
  await prisma.$transaction(async (tx) => {
    const [{ ok }] = await tx.$queryRaw<Array<{ ok: boolean }>>`SELECT pg_try_advisory_xact_lock(${LOCK_KEY}) AS ok`;
    if (!ok) throw new ImportacaoEmAndamentoError('Importação de camadas em andamento');
    for (const ic of iconesNovos.values()) await tx.webmapIcone.upsert({ where: { sha256: ic.sha256 }, create: ic, update: {} });

    const grupoId = new Map<string, string>();
    const gruposExistentes = new Map((await tx.webmapCamadaGrupo.findMany()).map((g) => [g.chaveOrigem, g]));
    for (const g of leitura.grupos) {
      const ex = gruposExistentes.get(g.chave);
      if (ex && ex.titulo === g.titulo && ex.ordem === g.ordem && ex.ativo && !ex.removidaOrigem) {
        grupoId.set(g.chave, ex.id);
        continue;
      }
      const row = ex
        ? await tx.webmapCamadaGrupo.update({ where: { id: ex.id }, data: { titulo: g.titulo, ordem: g.ordem, ativo: true, removidaOrigem: false } })
        : await tx.webmapCamadaGrupo.create({ data: { chaveOrigem: g.chave, titulo: g.titulo, ordem: g.ordem } });
      grupoId.set(g.chave, row.id);
    }
    await tx.webmapCamadaGrupo.updateMany({ where: { chaveOrigem: { notIn: leitura.grupos.map((g) => g.chave) }, removidaOrigem: false }, data: { ativo: false, removidaOrigem: true } });

    for (const p of plano) {
      if (p.status === 'removida_origem') {
        await tx.webmapCamada.update({ where: { chaveOrigem: p.chaveOrigem }, data: { ativo: false, removidaOrigem: true, removidaEm: agora } });
        continue;
      }
      if (p.status === 'sem_mudanca') continue;
      const d = decl.get(p.chaveOrigem)!;
      const estilo = parseStyle(d.estiloTexto);
      if (estilo.icone) {
        const ic = iconePorOrigem.get(estilo.icone.origem);
        if (ic) estilo.icone = { ...estilo.icone, ...ic };
      }
      const meta = {
        grupoId: grupoId.get(p.grupoChave)!, nomeOriginal: p.nomeOriginal, varOrigem: p.variavel, arquivoOrigem: p.arquivo, ordem: p.ordem,
        estilo: estilo as unknown as Prisma.InputJsonValue, estiloOriginal: d.estiloTexto ?? '', shaEstilo: p.shaEstilo,
        ativo: true, removidaOrigem: false, removidaEm: null, commitSha: atual.commitSha, importadoEm: agora,
      };
      if (!p.conteudoMudou) {
        await tx.webmapCamada.update({ where: { chaveOrigem: p.chaveOrigem }, data: meta });
        continue;
      }
      const lido = readFeatures(await fonte.lerTexto(`layers/${p.arquivo}`), p.nomeOriginal);
      const c = contar(lido.elementos);
      const fams = new Set(lido.elementos.map((e) => e.familia));
      const bbox = lido.elementos.reduce((b, e) => [Math.min(b[0], e.bbox[0]), Math.min(b[1], e.bbox[1]), Math.max(b[2], e.bbox[2]), Math.max(b[3], e.bbox[3])], [Infinity, Infinity, -Infinity, -Infinity]);
      const dados = {
        ...meta, shaArquivo: p.shaArquivo, versaoAtual: p.shaArquivo, geometriaTipo: fams.size === 1 ? [...fams][0] : fams.size ? 'MIXED' : 'VAZIA',
        totalElementos: lido.elementos.length, totalPontos: c.pontos, totalLinhas: c.linhas, totalPoligonos: c.poligonos, bytesOrigem: p.bytes,
        bbox: lido.elementos.length ? (bbox as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      };
      const camada = await tx.webmapCamada.upsert({ where: { chaveOrigem: p.chaveOrigem }, create: { chaveOrigem: p.chaveOrigem, ...dados }, update: dados });
      await tx.webmapElemento.deleteMany({ where: { camadaId: camada.id } });
      for (let i = 0; i < lido.elementos.length; i += 1000) {
        await tx.webmapElemento.createMany({
          data: lido.elementos.slice(i, i + 1000).map((e) => ({
            camadaId: camada.id, versao: p.shaArquivo, fidOrigem: e.fidOrigem, geometriaTipo: e.geometriaTipo,
            geometria: e.geometria as unknown as Prisma.InputJsonValue, atributos: e.atributos as Prisma.InputJsonValue,
            minLng: e.bbox[0], minLat: e.bbox[1], maxLng: e.bbox[2], maxLat: e.bbox[3],
          })),
        });
      }
      escritas++;
      if (opts.falharDepoisDe !== undefined && escritas >= opts.falharDepoisDe) throw new Error('Falha simulada (teste)');
    }
  }, { timeout: opts.txTimeoutMs ?? 30 * 60 * 1000, maxWait: 10_000 });

  return {
    ...atual, simulacaoId: sim.simulacaoId, aplicadaEm: agora.toISOString(), resultado: atual.totalErros ? 'PARCIAL' : 'SUCESSO',
    duracaoMs: Date.now() - inicio, icones: iconesNovos.size,
  };
}

/** Douglas-Peucker por anel/linha (graus), para servir camadas pesadas simplificadas por zoom. */
export function simplificar(coords: number[][], tol: number): number[][] {
  if (coords.length <= 2 || tol <= 0) return coords;
  const keep = new Uint8Array(coords.length);
  keep[0] = keep[coords.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, coords.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [x1, y1] = coords[a], [x2, y2] = coords[b];
    const dx = x2 - x1, dy = y2 - y1, len = dx * dx + dy * dy;
    let max = -1, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [x, y] = coords[i];
      const t = len ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len)) : 0;
      const ex = x1 + t * dx - x, ey = y1 + t * dy - y, d = ex * ex + ey * ey;
      if (d > max) { max = d; idx = i; }
    }
    if (max > tol * tol && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return coords.filter((_, i) => keep[i]);
}

export function simplificarGeometria(g: { type: string; coordinates: unknown }, tol: number): { type: string; coordinates: unknown } {
  const ring = (r: number[][], min: number) => { const s = simplificar(r, tol); return s.length >= min ? s : r; };
  switch (g.type) {
    case 'LineString': return { ...g, coordinates: ring(g.coordinates as number[][], 2) };
    case 'MultiLineString': return { ...g, coordinates: (g.coordinates as number[][][]).map((l) => ring(l, 2)) };
    case 'Polygon': return { ...g, coordinates: (g.coordinates as number[][][]).map((r) => ring(r, 4)) };
    case 'MultiPolygon': return { ...g, coordinates: (g.coordinates as number[][][][]).map((p) => p.map((r) => ring(r, 4))) };
    default: return g;
  }
}

/** Tolerância ~ 1 pixel no zoom informado (graus). */
export function toleranciaPorZoom(zoom: number) {
  return 360 / (256 * 2 ** Math.max(0, Math.min(22, zoom)));
}
