import { createHash, randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { Client } from 'pg';
import { chaveCamada, chaveGrupo } from './normalize';
import {
  CamadaDeclarada, ElementoLido, ErroLeitura, EstiloNormalizado, FAMILIA, GeometriaFamilia, lerElementosStream, nomeBaseCamada, parseLayersJs, parseStyle,
} from './parse';
import type { ListagemFonte, WebmapCamadasFonte } from './source';
import { AlvoCamada, AlvoGravacao, contarCamada, Contagem, gravarCamada, novoStats, Stats } from './camada-io';
export type { Contagem, Stats } from './camada-io';

export const WEBMAP_CAMADAS_ENTIDADE = 'WebmapCamadasImport';
export const SIMULACAO_TTL_MS = 30 * 60 * 1000;
export const MAX_ERROS_TELA = 50;
export const HEARTBEAT_MS = 10_000;
export const HEARTBEAT_LIMITE_MS = 60_000;
export const LOCK_KEY = 296_000_296;

export type Fase = 'lendo_fonte' | 'comparando' | 'gravando' | 'ativando' | 'limpando';
export type StatusCamada = 'nova' | 'atualizada' | 'sem_mudanca' | 'reativada' | 'removida_origem';
export type Resultado = 'SUCESSO' | 'OK_COM_AVISOS' | 'PARCIAL';

export class FonteMudouError extends Error {}
export class ImportacaoEmAndamentoError extends Error {}

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

export function resultadoDe(corrigidos: number, invalidos: number): Resultado {
  return invalidos > 0 ? 'PARCIAL' : corrigidos > 0 ? 'OK_COM_AVISOS' : 'SUCESSO';
}

function familiaDoEstilo(e: EstiloNormalizado): GeometriaFamilia | null {
  if (e.tipo === 'circle' || e.tipo === 'icon') return 'POINT';
  if (e.tipo === 'fill') return 'POLYGON';
  if (e.tipo === 'line') return 'LINE';
  return null;
}

/** Família pela 1ª geometria do arquivo (lê só o começo, em fluxo). */
async function familiaDoConteudo(fonte: WebmapCamadasFonte, arquivo: string): Promise<GeometriaFamilia | null> {
  const re = /"geometry"\s*:\s*\{\s*"type"\s*:\s*"(\w+)"/;
  let acc = '';
  for await (const chunk of fonte.lerStream(`layers/${arquivo}`)) {
    acc = (acc + chunk).slice(-4096);
    const m = re.exec(acc);
    if (m && FAMILIA[m[1]]) return FAMILIA[m[1]];
  }
  return null;
}

export type Declarada = CamadaDeclarada & { chave: string; grupoChave: string; familia: GeometriaFamilia; arquivo: string; estiloArquivo: string | null; estiloTexto: string | null };
type Leitura = { list: ListagemFonte; declaradas: Declarada[]; grupos: Array<{ titulo: string; ordem: number; chave: string }> };

/**
 * Lê layers.js e estilos; chave estável (D-296d, decisão TL): GRUPO/NOME_BASE#FAMILIA (sempre com a família geométrica).
 */
export async function lerEstrutura(fonte: WebmapCamadasFonte): Promise<Leitura> {
  const list = await fonte.listar();
  const parsed = parseLayersJs(await fonte.lerTexto('layers/layers.js'));
  const declaradas = await mapLimit(parsed.camadas, 8, async (c): Promise<Declarada> => {
    const arquivo = `${c.variavel}.js`;
    if (!list.layers.has(arquivo)) throw new Error(`Camada ${c.titulo}: arquivo layers/${arquivo} ausente na fonte`);
    const estiloNome = `${c.variavel}_style.js`;
    const estiloArquivo = list.styles.has(estiloNome) ? estiloNome : null;
    const estiloTexto = estiloArquivo ? await fonte.lerTexto(`styles/${estiloArquivo}`) : null;
    const familia = familiaDoEstilo(parseStyle(estiloTexto)) ?? (await familiaDoConteudo(fonte, arquivo)) ?? 'POINT';
    return { ...c, chave: `${chaveCamada(c.grupo, nomeBaseCamada(c))}#${familia}`, grupoChave: chaveGrupo(c.grupo), familia, arquivo, estiloArquivo, estiloTexto };
  });
  const seen = new Map<string, number>();
  for (const d of declaradas) {
    const n = (seen.get(d.chave) ?? 0) + 1;
    seen.set(d.chave, n);
    if (n > 1) d.chave = `${d.chave}#${n}`;
  }
  return { list, declaradas, grupos: parsed.grupos.map((g) => ({ ...g, chave: chaveGrupo(g.titulo) })) };
}

export function fonteHashDe(list: ListagemFonte, declaradas: Array<{ arquivo: string; estiloArquivo: string | null }>) {
  const h = createHash('sha256').update(`layers.js:${list.layersJsSha}\n`);
  for (const d of [...declaradas].sort((a, b) => a.arquivo.localeCompare(b.arquivo))) {
    h.update(`${d.arquivo}:${list.layers.get(d.arquivo)?.sha ?? ''}:${d.estiloArquivo ? list.styles.get(d.estiloArquivo)?.sha ?? '' : ''}\n`);
  }
  return h.digest('hex');
}

export type PlanoCamada = {
  chaveOrigem: string; grupo: string; grupoChave: string; nomeOriginal: string; variavel: string; arquivo: string; familia: GeometriaFamilia;
  ordem: number; shaArquivo: string; shaEstilo: string | null; status: StatusCamada; conteudoMudou: boolean; metaMudou: boolean; bytes: number; camadaId: string | null;
};

type Existente = Prisma.WebmapCamadaGetPayload<{ include: { grupo: true } }>;

function planejar(leitura: Leitura, existentes: Existente[]): PlanoCamada[] {
  const porChave = new Map(existentes.map((e) => [e.chaveOrigem, e]));
  const plano: PlanoCamada[] = leitura.declaradas.map((d) => {
    const ex = porChave.get(d.chave);
    const ativo = ex && ex.versaoAtual ? ex : undefined; // linha só criada por importação descartada não conta
    const shaArquivo = leitura.list.layers.get(d.arquivo)!.sha;
    const shaEstilo = d.estiloArquivo ? leitura.list.styles.get(d.estiloArquivo)!.sha : null;
    const conteudoMudou = !ativo || ativo.shaArquivo !== shaArquivo;
    const metaMudou = !!ativo && (ativo.shaEstilo !== shaEstilo || ativo.nomeOriginal !== d.titulo || ativo.grupo.chaveOrigem !== d.grupoChave || ativo.ordem !== d.ordem || ativo.varOrigem !== d.variavel || ativo.grupo.titulo !== d.grupo || ativo.grupo.ordem !== d.grupoOrdem);
    const status: StatusCamada = !ativo ? 'nova' : !ativo.ativo || ativo.removidaOrigem ? 'reativada' : conteudoMudou || metaMudou ? 'atualizada' : 'sem_mudanca';
    return { chaveOrigem: d.chave, grupo: d.grupo, grupoChave: d.grupoChave, nomeOriginal: d.titulo, variavel: d.variavel, arquivo: d.arquivo, familia: d.familia, ordem: d.ordem, shaArquivo, shaEstilo, status, conteudoMudou, metaMudou, bytes: leitura.list.layers.get(d.arquivo)!.bytes, camadaId: ex?.id ?? null };
  });
  const naFonte = new Set(plano.map((p) => p.chaveOrigem));
  for (const ex of existentes) {
    if (naFonte.has(ex.chaveOrigem) || ex.removidaOrigem || !ex.versaoAtual) continue;
    plano.push({ chaveOrigem: ex.chaveOrigem, grupo: ex.grupo.titulo, grupoChave: ex.grupo.chaveOrigem, nomeOriginal: ex.nomeOriginal, variavel: ex.varOrigem, arquivo: ex.arquivoOrigem, familia: (ex.geometriaTipo as GeometriaFamilia) ?? 'POINT', ordem: ex.ordem, shaArquivo: ex.shaArquivo, shaEstilo: ex.shaEstilo, status: 'removida_origem', conteudoMudou: false, metaMudou: false, bytes: ex.bytesOrigem, camadaId: ex.id });
  }
  return plano;
}

export type ResumoCamada = { chaveOrigem: string; grupo: string; nomeOriginal: string; variavel: string; ordem: number; status: StatusCamada; elementos: Contagem; corrigidos: number; invalidos: number; bytes: number };
export type ResultadoSimulacao = {
  simulacaoId: string; fonte: string; commitSha: string; fonteHash: string; criadaEm: string; expiraEm: string;
  grupos: number; camadas: number; elementos: Contagem & { total: number }; corrigidos: number; invalidos: number;
  novas: number; atualizadas: number; semMudanca: number; reativadas: number; removidasOrigem: number;
  camadasDetalhe: ResumoCamada[]; erros: ErroLeitura[]; totalErros: number; resultadoPrevisto: Resultado;
};

function resumir(base: { fonte: string; commitSha: string; fonteHash: string; grupos: number }, plano: PlanoCamada[], stats: Map<string, { contagem: Contagem; corrigidos: number; invalidos: number; erros: ErroLeitura[] }>): Omit<ResultadoSimulacao, 'simulacaoId' | 'criadaEm' | 'expiraEm' | 'resultadoPrevisto'> & { resultadoPrevisto: Resultado } {
  const det: ResumoCamada[] = plano.map((p) => {
    const s = stats.get(p.chaveOrigem) ?? { contagem: { pontos: 0, linhas: 0, poligonos: 0 }, corrigidos: 0, invalidos: 0, erros: [] };
    return { chaveOrigem: p.chaveOrigem, grupo: p.grupo, nomeOriginal: p.nomeOriginal, variavel: p.variavel, ordem: p.ordem, status: p.status, elementos: s.contagem, corrigidos: s.corrigidos, invalidos: s.invalidos, bytes: p.bytes };
  });
  const ativos = det.filter((d) => d.status !== 'removida_origem');
  const tot = ativos.reduce((a, d) => ({ pontos: a.pontos + d.elementos.pontos, linhas: a.linhas + d.elementos.linhas, poligonos: a.poligonos + d.elementos.poligonos }), { pontos: 0, linhas: 0, poligonos: 0 });
  const corrigidos = ativos.reduce((a, d) => a + d.corrigidos, 0);
  const invalidos = ativos.reduce((a, d) => a + d.invalidos, 0);
  const erros = ativos.flatMap((d) => stats.get(d.chaveOrigem)?.erros ?? []);
  const by = (s: StatusCamada) => det.filter((d) => d.status === s).length;
  return {
    ...base, camadas: ativos.length, elementos: { ...tot, total: tot.pontos + tot.linhas + tot.poligonos }, corrigidos, invalidos,
    novas: by('nova'), atualizadas: by('atualizada'), semMudanca: by('sem_mudanca'), reativadas: by('reativada'), removidasOrigem: by('removida_origem'),
    camadasDetalhe: det, erros, totalErros: erros.length, resultadoPrevisto: resultadoDe(corrigidos, invalidos),
  };
}

function statsGuardados(ex: Existente | undefined) {
  return {
    contagem: { pontos: ex?.totalPontos ?? 0, linhas: ex?.totalLinhas ?? 0, poligonos: ex?.totalPoligonos ?? 0 },
    corrigidos: ex?.totalCorrigidos ?? 0, invalidos: ex?.totalInvalidos ?? 0, erros: ((ex?.errosLeitura as ErroLeitura[] | null) ?? []),
  };
}

/** Simulação: só lê (fonte em fluxo e banco). Não grava nada. */
/** Quem lê/grava as camadas: no processo (padrão) ou no worker do job. */
export type LeitorCamadas = {
  contar: (a: AlvoCamada) => Promise<Stats>;
  gravar: (a: AlvoGravacao, aposLote: (lote: number) => Promise<void> | void) => Promise<Stats>;
  /** Libera o worker assim que a leitura acaba (antes de ativar a versão). */
  fechar?: () => Promise<void>;
};
export function leitorNoProcesso(prisma: PrismaClient, fonte: WebmapCamadasFonte): LeitorCamadas {
  return {
    contar: (a) => contarCamada(fonte, a),
    gravar: (a, aposLote) => gravarCamada((sql, params) => prisma.$executeRawUnsafe(sql, ...params), fonte, a, { aposLote }),
  };
}

export async function simular(prisma: PrismaClient, fonte: WebmapCamadasFonte, onFase?: (f: Fase) => void, leitor: LeitorCamadas = leitorNoProcesso(prisma, fonte)): Promise<{ resultado: ResultadoSimulacao; plano: PlanoCamada[] }> {
  onFase?.('lendo_fonte');
  const leitura = await lerEstrutura(fonte);
  onFase?.('comparando');
  const existentes = await prisma.webmapCamada.findMany({ include: { grupo: true } });
  const porChave = new Map(existentes.map((e) => [e.chaveOrigem, e]));
  const plano = planejar(leitura, existentes);
  const stats = new Map<string, { contagem: Contagem; corrigidos: number; invalidos: number; erros: ErroLeitura[] }>();
  await mapLimit(plano, 1, async (p) => {
    if (!p.conteudoMudou || p.status === 'removida_origem') {
      stats.set(p.chaveOrigem, statsGuardados(porChave.get(p.chaveOrigem)));
      return;
    }
    const s = await leitor.contar({ arquivo: p.arquivo, label: p.nomeOriginal, grupo: p.grupo });
    stats.set(p.chaveOrigem, { contagem: { pontos: s.pontos, linhas: s.linhas, poligonos: s.poligonos }, corrigidos: s.corrigidos, invalidos: s.invalidos, erros: s.erros });
  });
  await leitor.fechar?.();
  const agora = new Date();
  const r = resumir({ fonte: fonte.descricao, commitSha: leitura.list.commitSha, fonteHash: fonteHashDe(leitura.list, leitura.declaradas), grupos: leitura.grupos.length }, plano, stats);
  return { resultado: { ...r, simulacaoId: randomUUID(), criadaEm: agora.toISOString(), expiraEm: new Date(agora.getTime() + SIMULACAO_TTL_MS).toISOString() }, plano };
}

// ---------------------------------------------------------------- lock de sessão
/** pg_advisory_lock ligado a uma conexão dedicada: se o processo morre, a sessão cai e o lock é liberado. */
export class PgSessionLock {
  private client: Client | null = null;
  constructor(private readonly connectionString: string, private readonly key = LOCK_KEY) {}
  async tentar(): Promise<boolean> {
    const c = new Client({ connectionString: this.connectionString });
    await c.connect();
    const r = await c.query<{ ok: boolean }>('SELECT pg_try_advisory_lock($1) AS ok', [this.key]);
    if (!r.rows[0]?.ok) {
      await c.end();
      return false;
    }
    this.client = c;
    return true;
  }
  async liberar() {
    const c = this.client;
    this.client = null;
    if (!c) return;
    await c.query('SELECT pg_advisory_unlock($1)', [this.key]).catch(() => undefined);
    await c.end().catch(() => undefined);
  }
}

// ---------------------------------------------------------------- aplicação versionada
export type ResultadoAplicacao = Omit<ResultadoSimulacao, 'expiraEm' | 'criadaEm' | 'resultadoPrevisto'> & { importacaoId: string; aplicadaEm: string; resultado: Resultado; duracaoMs: number; icones: number };
export type IconeStore = (buf: Buffer, mimeType: string, sha256: string) => Promise<{ storageKey: string; url: string }>;

function mimeDe(path: string) {
  const ext = path.split('.').pop()?.toLowerCase();
  return ext === 'svg' ? 'image/svg+xml' : ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'application/octet-stream';
}

/** Remove tudo que uma importação não ativada gravou (versões, elementos, camadas/grupos criados por ela). */
export async function descartarImportacao(prisma: PrismaClient, importacaoId: string) {
  const versoes = await prisma.webmapCamadaVersao.findMany({ where: { importacaoId, status: { not: 'ATIVA' } }, select: { id: true } });
  for (const v of versoes) {
    for (;;) {
      const n = await prisma.$executeRaw`DELETE FROM "WebmapElemento" WHERE id IN (SELECT id FROM "WebmapElemento" WHERE versao = ${v.id} LIMIT 5000)`;
      if (n === 0) break;
    }
  }
  await prisma.webmapCamadaVersao.deleteMany({ where: { importacaoId, status: { not: 'ATIVA' } } });
  await prisma.webmapCamada.deleteMany({ where: { criadaPorImportacao: importacaoId } });
  await prisma.webmapCamadaGrupo.deleteMany({ where: { criadaPorImportacao: importacaoId, camadas: { none: {} } } });
}

/** No boot (ou antes de aplicar): job EM_ANDAMENTO sem heartbeat há > limite vira FALHA e sua versão incompleta é descartada. Só age se conseguir o lock (ninguém vivo aplicando). */
export async function recuperarInterrompidas(prisma: PrismaClient, lock: PgSessionLock, limiteMs = HEARTBEAT_LIMITE_MS) {
  if (!(await lock.tentar())) return [] as string[];
  try {
    const presos = await prisma.webmapImportacao.findMany({ where: { status: 'EM_ANDAMENTO', heartbeatEm: { lt: new Date(Date.now() - limiteMs) } } });
    for (const job of presos) {
      await descartarImportacao(prisma, job.id);
      await prisma.webmapImportacao.update({ where: { id: job.id }, data: { status: 'FALHA', fase: null, concluidoEm: new Date(), motivo: 'interrompida por reinício' } });
    }
    return presos.map((p) => p.id);
  } finally {
    await lock.liberar();
  }
}

export type OpcoesAplicacao = {
  icones?: IconeStore; onFase?: (f: Fase) => void; agora?: Date;
  /** Testes: chamado após cada lote gravado. */
  aposLote?: (info: { camada: string; lote: number }) => Promise<void> | void;
  /** Testes: falha simulada depois de N camadas gravadas. */
  falharDepoisDe?: number;
  /** Heartbeat por lote (além do timer do serviço): prova de vida mesmo se o laço ficar ocupado. */
  batimento?: () => Promise<void> | void;
  /** Medição/diagnóstico: chamado após cada camada gravada. */
  aposCamada?: (chave: string) => void;
  /** Leitura/gravação das camadas (padrão: no processo). O serviço usa o worker com heap limitado. */
  leitor?: LeitorCamadas;
  tentativasPorCamada?: number;
};

/**
 * Aplica uma simulação válida (mesmo fonteHash, < 30 min) como NOVA versão, camada a camada e em lotes (fluxo).
 * Só no fim troca a versão ativa numa transação curta. Em falha: a versão anterior continua ativa e a incompleta é descartada.
 * Quem chama deve ter o lock de sessão e o job (WebmapImportacao) criado.
 */
export async function executarAplicacao(
  prisma: PrismaClient, fonte: WebmapCamadasFonte, importacaoId: string,
  sim: { simulacaoId: string; fonteHash: string; criadaEm: string }, opts: OpcoesAplicacao = {},
): Promise<ResultadoAplicacao> {
  const inicio = Date.now();
  const agora = opts.agora ?? new Date();
  if (agora.getTime() - new Date(sim.criadaEm).getTime() > SIMULACAO_TTL_MS) throw new FonteMudouError('O prazo da simulação (30 min) venceu; simule novamente.');
  try {
    opts.onFase?.('lendo_fonte');
    const leitura = await lerEstrutura(fonte);
    if (fonteHashDe(leitura.list, leitura.declaradas) !== sim.fonteHash) throw new FonteMudouError('A fonte mudou desde a simulação; simule novamente.');
    opts.onFase?.('comparando');
    const existentes = await prisma.webmapCamada.findMany({ include: { grupo: true } });
    const porChave = new Map(existentes.map((e) => [e.chaveOrigem, e]));
    const plano = planejar(leitura, existentes);
    const decl = new Map(leitura.declaradas.map((d) => [d.chave, d]));

    // ícones: copiados para o nosso storage, endereçados por sha256
    const iconeUrl = new Map<string, { url: string; sha256: string }>();
    const iconesNovos: Array<{ origem: string; sha256: string; mimeType: string; storageKey: string; url: string }> = [];
    if (opts.icones) {
      for (const d of leitura.declaradas) {
        const origem = parseStyle(d.estiloTexto).icone?.origem;
        if (!origem || iconeUrl.has(origem)) continue;
        const buf = await fonte.lerBinario(origem.replace(/^\.?\//, ''));
        const sha256 = createHash('sha256').update(buf).digest('hex');
        const ex = await prisma.webmapIcone.findUnique({ where: { sha256 } });
        if (ex) { iconeUrl.set(origem, { url: ex.url, sha256 }); continue; }
        const stored = await opts.icones(buf, mimeDe(origem), sha256);
        iconesNovos.push({ origem, sha256, mimeType: mimeDe(origem), ...stored });
        iconeUrl.set(origem, { url: stored.url, sha256 });
      }
    }

    opts.onFase?.('gravando');
    const gruposEx = new Map((await prisma.webmapCamadaGrupo.findMany()).map((g) => [g.chaveOrigem, g]));
    const grupoId = async (chave: string, titulo: string, ordem: number) => {
      const g = gruposEx.get(chave);
      if (g) return g.id;
      const novo = await prisma.webmapCamadaGrupo.create({ data: { chaveOrigem: chave, titulo, ordem, ativo: false, criadaPorImportacao: importacaoId } });
      gruposEx.set(chave, novo);
      return novo.id;
    };
    const grupoOrdem = new Map(leitura.grupos.map((g) => [g.chave, g.ordem]));
    const statsPorChave = new Map<string, { contagem: Contagem; corrigidos: number; invalidos: number; erros: ErroLeitura[] }>();
    const versaoPorChave = new Map<string, string>();
    let gravadas = 0;
    for (const p of plano) {
      if (p.status === 'removida_origem' || !p.conteudoMudou) {
        statsPorChave.set(p.chaveOrigem, statsGuardados(porChave.get(p.chaveOrigem)));
        continue;
      }
      const d = decl.get(p.chaveOrigem)!;
      const gId = await grupoId(p.grupoChave, p.grupo, grupoOrdem.get(p.grupoChave) ?? 0);
      let camadaId = p.camadaId;
      if (!camadaId) {
        const c = await prisma.webmapCamada.create({
          data: {
            chaveOrigem: p.chaveOrigem, grupoId: gId, nomeOriginal: p.nomeOriginal, varOrigem: p.variavel, arquivoOrigem: p.arquivo, ordem: p.ordem,
            geometriaTipo: p.familia, estilo: {}, estiloOriginal: '', shaArquivo: '', totalElementos: 0, versaoAtual: null, ativo: false,
            criadaPorImportacao: importacaoId, commitSha: leitura.list.commitSha, importadoEm: agora,
          },
        });
        camadaId = c.id;
        porChave.set(p.chaveOrigem, { ...c, grupo: gruposEx.get(p.grupoChave)! } as Existente);
      }
      const versaoId = `${importacaoId}:${camadaId}`;
      await prisma.webmapCamadaVersao.upsert({ where: { id: versaoId }, create: { id: versaoId, camadaId, importacaoId, status: 'GRAVANDO', shaArquivo: p.shaArquivo }, update: { status: 'GRAVANDO' } });
      const tentativas = opts.tentativasPorCamada ?? 3;
      let s = novoStats();
      const leitor = opts.leitor ?? leitorNoProcesso(prisma, fonte);
      for (let t = 1; ; t++) {
        try {
          // retentativa da camada nunca duplica: gravarCamada apaga antes o que esta versão já tinha
          s = await leitor.gravar({ arquivo: p.arquivo, label: p.nomeOriginal, grupo: p.grupo, camadaId: camadaId!, versaoId }, async (lote) => {
            await opts.batimento?.();
            await opts.aposLote?.({ camada: p.chaveOrigem, lote });
          });
          break;
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          if (t >= tentativas || /GeoJSON inválido/.test(msg)) throw error;
        }
      }
      const total = s.pontos + s.linhas + s.poligonos;
      await prisma.webmapCamadaVersao.update({
        where: { id: versaoId },
        data: {
          status: 'PRONTA', totalElementos: total, totalPontos: s.pontos, totalLinhas: s.linhas, totalPoligonos: s.poligonos, totalCorrigidos: s.corrigidos, totalInvalidos: s.invalidos,
          errosLeitura: s.erros as unknown as Prisma.InputJsonValue, bbox: total ? (s.bbox as Prisma.InputJsonValue) : Prisma.JsonNull,
        },
      });
      statsPorChave.set(p.chaveOrigem, { contagem: { pontos: s.pontos, linhas: s.linhas, poligonos: s.poligonos }, corrigidos: s.corrigidos, invalidos: s.invalidos, erros: s.erros });
      versaoPorChave.set(p.chaveOrigem, versaoId);
      gravadas++;
      opts.aposCamada?.(p.chaveOrigem);
      if (opts.falharDepoisDe !== undefined && gravadas >= opts.falharDepoisDe) throw new Error('Falha simulada (teste)');
      void d;
    }

    const resumo = resumir({ fonte: fonte.descricao, commitSha: leitura.list.commitSha, fonteHash: sim.fonteHash, grupos: leitura.grupos.length }, plano, statsPorChave);
    const resultado: ResultadoAplicacao = {
      ...resumo, simulacaoId: sim.simulacaoId, importacaoId, aplicadaEm: agora.toISOString(), resultado: resumo.resultadoPrevisto, duracaoMs: 0, icones: iconesNovos.length,
    };

    // troca atômica da versão ativa (transação curta: só metadados)
    await opts.leitor?.fechar?.();
    opts.onFase?.('ativando');
    const antigas: Array<{ camadaId: string; versao: string }> = [];
    await prisma.$transaction(async (tx) => {
      for (const ic of iconesNovos) await tx.webmapIcone.upsert({ where: { sha256: ic.sha256 }, create: ic, update: {} });
      for (const g of leitura.grupos) {
        const ex = gruposEx.get(g.chave);
        if (ex && ex.titulo === g.titulo && ex.ordem === g.ordem && ex.ativo && !ex.removidaOrigem && !ex.criadaPorImportacao) continue;
        if (ex) await tx.webmapCamadaGrupo.update({ where: { id: ex.id }, data: { titulo: g.titulo, ordem: g.ordem, ativo: true, removidaOrigem: false, criadaPorImportacao: null } });
        else gruposEx.set(g.chave, await tx.webmapCamadaGrupo.create({ data: { chaveOrigem: g.chave, titulo: g.titulo, ordem: g.ordem } }));
      }
      await tx.webmapCamadaGrupo.updateMany({ where: { chaveOrigem: { notIn: leitura.grupos.map((g) => g.chave) }, removidaOrigem: false }, data: { ativo: false, removidaOrigem: true } });
      for (const p of plano) {
        const ex = porChave.get(p.chaveOrigem);
        if (p.status === 'removida_origem') {
          await tx.webmapCamada.update({ where: { chaveOrigem: p.chaveOrigem }, data: { ativo: false, removidaOrigem: true, removidaEm: agora } });
          continue;
        }
        if (p.status === 'sem_mudanca') continue;
        const d = decl.get(p.chaveOrigem)!;
        const estilo = parseStyle(d.estiloTexto);
        if (estilo.icone) {
          const ic = iconeUrl.get(estilo.icone.origem);
          if (ic) estilo.icone = { ...estilo.icone, ...ic };
        }
        const meta: Prisma.WebmapCamadaUncheckedUpdateInput = {
          grupoId: gruposEx.get(p.grupoChave)!.id, nomeOriginal: p.nomeOriginal, varOrigem: p.variavel, arquivoOrigem: p.arquivo, ordem: p.ordem,
          estilo: estilo as unknown as Prisma.InputJsonValue, estiloOriginal: d.estiloTexto ?? '', shaEstilo: p.shaEstilo,
          ativo: true, removidaOrigem: false, removidaEm: null, criadaPorImportacao: null, commitSha: leitura.list.commitSha, importadoEm: agora,
        };
        const versaoId = versaoPorChave.get(p.chaveOrigem);
        if (versaoId) {
          const v = await tx.webmapCamadaVersao.findUniqueOrThrow({ where: { id: versaoId } });
          if (ex?.versaoAtual) {
            antigas.push({ camadaId: ex.id, versao: ex.versaoAtual });
            await tx.webmapCamadaVersao.updateMany({ where: { id: ex.versaoAtual }, data: { status: 'SUBSTITUIDA' } });
          }
          await tx.webmapCamadaVersao.update({ where: { id: versaoId }, data: { status: 'ATIVA' } });
          Object.assign(meta, {
            versaoAtual: versaoId, shaArquivo: v.shaArquivo, bytesOrigem: p.bytes, geometriaTipo: p.familia,
            totalElementos: v.totalElementos, totalPontos: v.totalPontos, totalLinhas: v.totalLinhas, totalPoligonos: v.totalPoligonos,
            totalCorrigidos: v.totalCorrigidos, totalInvalidos: v.totalInvalidos, errosLeitura: v.errosLeitura ?? Prisma.JsonNull, bbox: v.bbox ?? Prisma.JsonNull,
          });
        }
        await tx.webmapCamada.update({ where: { chaveOrigem: p.chaveOrigem }, data: meta });
      }
      await tx.webmapImportacao.update({ where: { id: importacaoId }, data: { status: resultado.resultado, fase: 'limpando', concluidoEm: new Date(), resultado: { ...resultado, camadasDetalhe: undefined, erros: resultado.erros.slice(0, MAX_ERROS_TELA) } as unknown as Prisma.InputJsonValue } });
    }, { timeout: 120_000 });

    // limpeza das versões substituídas (fora da transação; invisível para o mapa)
    opts.onFase?.('limpando');
    for (const a of antigas) {
      for (;;) {
        const n = await prisma.$executeRaw`DELETE FROM "WebmapElemento" WHERE id IN (SELECT id FROM "WebmapElemento" WHERE "camadaId" = ${a.camadaId} AND versao = ${a.versao} LIMIT 5000)`;
        if (n === 0) break;
      }
    }
    await prisma.webmapImportacao.update({ where: { id: importacaoId }, data: { fase: null } });
    resultado.duracaoMs = Date.now() - inicio;
    return resultado;
  } catch (error) {
    await descartarImportacao(prisma, importacaoId);
    throw error;
  }
}

// ---------------------------------------------------------------- mapa
/** Douglas-Peucker por anel/linha (graus). */
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

export function toleranciaPorZoom(zoom: number) {
  return 360 / (256 * 2 ** Math.max(0, Math.min(22, zoom)));
}
