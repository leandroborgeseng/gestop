import { createHash } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { AuditAction, Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import type { JwtPayload } from '../auth/jwt';
import {
  BOOT_ID, executarAplicacao, Fase, FonteMudouError, HEARTBEAT_MS, MAX_ERROS_TELA, PgSessionLock, recuperarInterrompidas, ResultadoSimulacao,
  SIMULACAO_TTL_MS, simplificarGeometria, simular, toleranciaPorZoom, WEBMAP_CAMADAS_ENTIDADE,
} from './core';
import type { ErroLeitura } from './parse';
import { leitorEmWorker } from './job';
import { GithubWebmapFonte, WebmapCamadasFonte } from './source';

export const LIMITE_ELEMENTOS_RESPOSTA = 5000;
/** 298: teto de JSON por resposta (~2 MB); passa disso => truncado. */
export const LIMITE_BYTES_RESPOSTA = 2 * 1024 * 1024;

/** 298: versão curta (10 hex do sha1) — identifica a versão ATIVA na lista e no `v` do GeoJSON (cache do cliente). */
export function versaoCurta(v: string) {
  return createHash('sha1').update(v).digest('hex').slice(0, 10);
}

/** 298: estilo sem chaves nulas (lista leve); ícone só com a url. */
export function estiloEnxuto(e: unknown): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries((e ?? {}) as Record<string, unknown>)) {
    if (v === null || v === undefined) continue;
    o[k] = k === 'icone' && typeof v === 'object' ? { url: (v as { url?: unknown }).url } : v;
  }
  return o;
}

/** 298: 6 casas decimais (~0,11 m no equador) — reduz o payload sem passar de 1 m (crit. 10). */
export function arredondarGeometria(g: { type: string; coordinates: unknown }): { type: string; coordinates: unknown } {
  const r = (c: unknown): unknown => (typeof c === 'number' ? Math.round(c * 1e6) / 1e6 : Array.isArray(c) ? c.map(r) : c);
  return { ...g, coordinates: r(g.coordinates) };
}

/**
 * 296 (TL): toda consulta de EXIBIÇÃO no mapa ignora, explicitamente, feições sem conserto e feições com bbox nulo.
 * Elas continuam gravadas (geometria original), no CSV e no resultado PARCIAL.
 */
export const FILTRO_EXIBICAO = {
  geometriaInvalida: false,
  minLng: { not: null }, minLat: { not: null }, maxLng: { not: null }, maxLat: { not: null },
} satisfies Prisma.WebmapElementoWhereInput;
const CAMADA_PESADA_ELEMENTOS = 2000;

/** "20/10/2026 16:23:05 (BRT)" — sem a vírgula que o Intl pt-BR põe entre data e hora (achado QA A3). */
export function dataHoraBrt(d: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(d).map((x) => [x.type, x.value]),
  );
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second} (BRT)`;
}

type ResultadoLog = 'SUCESSO' | 'OK_COM_AVISOS' | 'PARCIAL' | 'FALHA';

@Injectable()
export class WebmapCamadasService implements OnModuleInit {
  private readonly logger = new Logger(WebmapCamadasService.name);
  private readonly simulacoes = new Map<string, ResultadoSimulacao & { usuarioId: string }>();
  private simulando: { usuarioNome: string; desde: Date; fase: Fase } | null = null;
  private fonte: WebmapCamadasFonte;
  private lockUrl = process.env.WEBMAP_CAMADAS_LOCK_DATABASE_URL || process.env.DATABASE_URL || '';
  /** Última execução em segundo plano deste processo (testes aguardam por ela). */
  execucao: Promise<void> | null = null;

  constructor(private readonly prisma: PrismaService, private readonly storage: StorageService) {
    this.fonte = new GithubWebmapFonte();
  }

  private get db() {
    return this.prisma as unknown as PrismaClient;
  }

  /** Testes: troca a fonte e a conexão do lock. */
  usarFonte(fonte: WebmapCamadasFonte, lockUrl?: string) {
    this.fonte = fonte;
    if (lockUrl) this.lockUrl = lockUrl;
  }

  /** Job em worker com heap limitado (padrão). WEBMAP_CAMADAS_WORKER=0 roda no próprio processo. */
  private usarWorker() {
    if (process.env.WEBMAP_CAMADAS_WORKER === '0' || !this.lockUrl) return null;
    return this.fonte.config ?? null;
  }

  async onModuleInit() {
    if (!this.lockUrl) return;
    try {
      const ids = await this.recuperar();
      if (ids.length) this.logger.warn(`Importações de camadas interrompidas marcadas como FALHA: ${ids.join(', ')}`);
    } catch (error) {
      this.logger.warn(`Recuperação de importações de camadas não executada: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** 296-ALTO: marca FALHA os jobs de processo morto e registra cada um no Histórico. Roda antes de qualquer 409. */
  private async recuperar() {
    if (!this.lockUrl) return [] as string[];
    const ids = await recuperarInterrompidas(this.db, new PgSessionLock(this.lockUrl));
    for (const id of ids) {
      const job = await this.db.webmapImportacao.findUnique({ where: { id } });
      if (!job) continue;
      await this.log({ sub: job.usuarioId, nome: job.usuarioNome }, 'APLICACAO', 'FALHA', {
        importacaoId: job.id, simulacaoId: job.simulacaoId, motivo: job.motivo ?? 'interrompida por reinício', interrompidaPorReinicio: true,
      }).catch(() => undefined);
    }
    return ids;
  }

  private async log(user: { sub: string | null; nome: string }, tipo: 'SIMULACAO' | 'APLICACAO', resultado: ResultadoLog, dados: Record<string, unknown>) {
    const agora = new Date();
    await this.db.logAuditoria.create({
      data: {
        usuarioId: user.sub || undefined, acao: AuditAction.SYNC, entidadeTipo: WEBMAP_CAMADAS_ENTIDADE,
        entidadeId: ((dados.importacaoId ?? dados.simulacaoId) as string) ?? null,
        tela: 'Administração > Importação', valorAntigo: Prisma.JsonNull,
        valorNovo: { tipo, resultado, usuario: user.nome, dataHora: agora.toISOString(), dataHoraBrt: dataHoraBrt(agora), ...dados } as Prisma.InputJsonValue,
      },
    });
  }

  private semDetalhe<T extends { camadasDetalhe?: unknown; erros: ErroLeitura[] }>(r: T) {
    const { camadasDetalhe: _d, erros, ...rest } = r;
    return { ...rest, erros: erros.slice(0, MAX_ERROS_TELA) };
  }

  private async emAndamento() {
    const job = await this.db.webmapImportacao.findFirst({ where: { status: 'EM_ANDAMENTO' }, orderBy: { iniciadoEm: 'desc' } });
    if (job) return { tipo: 'APLICACAO' as const, usuario: job.usuarioNome, desde: job.iniciadoEm, fase: (job.fase ?? 'lendo_fonte') as Fase, importacaoId: job.id };
    if (this.simulando) return { tipo: 'SIMULACAO' as const, usuario: this.simulando.usuarioNome, desde: this.simulando.desde, fase: this.simulando.fase, importacaoId: null };
    return null;
  }

  private conflito(a: { usuario: string; desde: Date }) {
    return new ConflictException(`Importação de camadas em andamento por ${a.usuario} desde ${dataHoraBrt(a.desde)}.`);
  }

  async simular(user: JwtPayload) {
    if (this.simulando) throw this.conflito({ usuario: this.simulando.usuarioNome, desde: this.simulando.desde });
    this.simulando = { usuarioNome: user.nome, desde: new Date(), fase: 'lendo_fonte' };
    try {
      await this.recuperar().catch(() => undefined); // 296-ALTO: antes do 409 de job EM_ANDAMENTO
      const job = await this.db.webmapImportacao.findFirst({ where: { status: 'EM_ANDAMENTO' }, orderBy: { iniciadoEm: 'desc' } });
      if (job) throw this.conflito({ usuario: job.usuarioNome, desde: job.iniciadoEm });
      const onFase = (f: Fase) => { if (this.simulando) this.simulando.fase = f; };
      const cfg = this.usarWorker();
      const leitor = cfg ? leitorEmWorker(this.lockUrl, cfg) : undefined;
      let resultado: ResultadoSimulacao;
      try {
        resultado = (await simular(this.db, this.fonte, onFase, leitor)).resultado;
      } finally {
        await leitor?.fechar();
      }
      this.purgar();
      this.simulacoes.set(resultado.simulacaoId, { ...resultado, usuarioId: user.sub });
      await this.log(user, 'SIMULACAO', resultado.resultadoPrevisto, this.semDetalhe(resultado));
      return { ...resultado, erros: resultado.erros.slice(0, MAX_ERROS_TELA) };
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      const motivo = error instanceof Error ? error.message : String(error);
      await this.log(user, 'SIMULACAO', 'FALHA', { motivo, fonte: this.fonte.descricao }).catch(() => undefined);
      throw new BadRequestException(`Não foi possível ler a fonte do Webmap: ${motivo}`);
    } finally {
      this.simulando = null;
    }
  }

  /** 202: inicia em segundo plano; acompanhe por GET status. */
  async aplicar(user: JwtPayload, simulacaoId: string | undefined) {
    const sim = simulacaoId ? this.simulacoes.get(simulacaoId) : undefined;
    if (!sim) throw new BadRequestException('Simule a importação antes de aplicar.');
    if (Date.now() - new Date(sim.criadaEm).getTime() > SIMULACAO_TTL_MS) {
      this.simulacoes.delete(sim.simulacaoId);
      throw new ConflictException('O prazo da simulação (30 min) venceu; simule novamente.');
    }
    await this.recuperar().catch(() => undefined);
    const lock = new PgSessionLock(this.lockUrl);
    if (!(await lock.tentar())) {
      const a = await this.emAndamento();
      throw this.conflito(a ?? { usuario: 'outro usuário', desde: new Date() });
    }
    const job = await this.db.webmapImportacao.create({
      data: { status: 'EM_ANDAMENTO', bootId: BOOT_ID, fase: 'lendo_fonte', usuarioId: user.sub || null, usuarioNome: user.nome, simulacaoId: sim.simulacaoId, fonteHash: sim.fonteHash },
    });
    this.simulacoes.delete(sim.simulacaoId);
    this.execucao = this.rodar(job.id, user, sim, lock);
    return { importacaoId: job.id, status: 'EM_ANDAMENTO', iniciadoEm: job.iniciadoEm, iniciadoEmBrt: dataHoraBrt(job.iniciadoEm) };
  }

  private async rodar(importacaoId: string, user: JwtPayload, sim: ResultadoSimulacao, lock: PgSessionLock) {
    let fase: Fase = 'lendo_fonte';
    const hb = setInterval(() => {
      void this.db.webmapImportacao.update({ where: { id: importacaoId }, data: { heartbeatEm: new Date(), fase } }).catch(() => undefined);
    }, HEARTBEAT_MS);
    try {
      let ultimoBatimento = 0;
      const cb = {
        onFase: (f: Fase) => {
          fase = f;
          void this.db.webmapImportacao.update({ where: { id: importacaoId }, data: { fase: f, heartbeatEm: new Date() } }).catch(() => undefined);
        },
        // heartbeat também por lote (além do timer): camada pesada > 60 s continua dando sinal de vida
        batimento: () => {
          if (Date.now() - ultimoBatimento < 2000) return;
          ultimoBatimento = Date.now();
          void this.db.webmapImportacao.update({ where: { id: importacaoId }, data: { heartbeatEm: new Date() } }).catch(() => undefined);
        },
        leitor: undefined as ReturnType<typeof leitorEmWorker> | undefined,
        icones: async (buf: Buffer, mime: string) => {
          const s = await this.storage.persistBuffer(buf, mime, 'webmap-icones');
          return { storageKey: s.storageKey, url: s.url };
        },
      };
      const cfg = this.usarWorker();
      if (cfg) cb.leitor = leitorEmWorker(this.lockUrl, cfg);
      let r;
      try {
        r = await executarAplicacao(this.db, this.fonte, importacaoId, sim, cb);
      } finally {
        await cb.leitor?.fechar();
      }
      await this.db.webmapImportacao.update({ where: { id: importacaoId }, data: { resultado: this.semDetalhe(r) as unknown as Prisma.InputJsonValue } });
      await this.log(user, 'APLICACAO', r.resultado, this.semDetalhe(r)).catch(() => undefined);
    } catch (error) {
      const motivo = error instanceof Error ? error.message : String(error);
      await this.db.webmapImportacao.update({ where: { id: importacaoId }, data: { status: 'FALHA', fase: null, concluidoEm: new Date(), motivo } }).catch(() => undefined);
      await this.log(user, 'APLICACAO', 'FALHA', { importacaoId, simulacaoId: sim.simulacaoId, motivo, fonteMudou: error instanceof FonteMudouError }).catch(() => undefined);
    } finally {
      clearInterval(hb);
      await lock.liberar();
    }
  }

  async errosCsv(simulacaoId?: string) {
    let erros: ErroLeitura[];
    if (simulacaoId) {
      const sim = this.simulacoes.get(simulacaoId);
      if (!sim) throw new NotFoundException('Simulação não encontrada ou expirada.');
      erros = sim.erros;
    } else {
      const camadas = await this.db.webmapCamada.findMany({ where: { ativo: true, totalInvalidos: { gt: 0 } }, select: { errosLeitura: true } });
      erros = camadas.flatMap((c) => (c.errosLeitura as ErroLeitura[] | null) ?? []);
    }
    const esc = (v: string | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    return ['grupo;camada;elemento;motivo', ...erros.map((e) => [esc(e.grupo), esc(e.camada), esc(e.elemento), esc(e.motivo)].join(';'))].join('\n');
  }

  private purgar() {
    const now = Date.now();
    for (const [id, s] of this.simulacoes) if (now - new Date(s.criadaEm).getTime() > SIMULACAO_TTL_MS) this.simulacoes.delete(id);
  }

  async historico(limit = 20) {
    const rows = await this.db.logAuditoria.findMany({
      where: { entidadeTipo: WEBMAP_CAMADAS_ENTIDADE }, orderBy: { createdAt: 'desc' }, take: Math.min(Math.max(limit, 1), 100),
      select: { id: true, createdAt: true, usuarioId: true, valorNovo: true },
    });
    return rows.map((r) => ({ id: r.id, createdAt: r.createdAt, dataHoraBrt: dataHoraBrt(r.createdAt), usuarioId: r.usuarioId, ...(r.valorNovo as Record<string, unknown>) }));
  }

  async status() {
    await this.recuperar().catch(() => undefined);
    const [ultimaLog] = await this.historico(1);
    const ultimaImportacao = await this.db.webmapImportacao.findFirst({ orderBy: { iniciadoEm: 'desc' } });
    const [camadas, ativas, removidas] = await Promise.all([
      this.db.webmapCamada.count({ where: { versaoAtual: { not: null } } }), this.db.webmapCamada.count({ where: { ativo: true } }), this.db.webmapCamada.count({ where: { removidaOrigem: true } }),
    ]);
    const a = await this.emAndamento();
    return {
      fonte: this.fonte.descricao,
      emAndamento: a ? { tipo: a.tipo, usuario: a.usuario, desde: a.desde.toISOString(), desdeBrt: dataHoraBrt(a.desde), fase: a.fase, importacaoId: a.importacaoId } : null,
      ultimaImportacao: ultimaImportacao
        ? { id: ultimaImportacao.id, status: ultimaImportacao.status, usuario: ultimaImportacao.usuarioNome, iniciadoEmBrt: dataHoraBrt(ultimaImportacao.iniciadoEm), concluidoEmBrt: ultimaImportacao.concluidoEm ? dataHoraBrt(ultimaImportacao.concluidoEm) : null, motivo: ultimaImportacao.motivo, resultado: ultimaImportacao.resultado }
        : null,
      ultima: ultimaLog ?? null, camadas, ativas, removidasOrigem: removidas,
    };
  }

  /** Para quem NÃO tem a permissão de Importação (mapa): só o aviso, sem fase, nome ou horário. */
  async statusPublico() {
    const a = await this.emAndamento();
    return { emAndamento: Boolean(a && a.tipo === 'APLICACAO'), mensagem: a && a.tipo === 'APLICACAO' ? 'Importação em andamento' : null };
  }

  /**
   * Árvore para o mapa (D-296c: todos os usuários do mapa; camadas desligadas por padrão).
   * 298 (crit. 1): só a lista, enxuta — sem geometria, sem bbox; estilo sem campos nulos; versão curta (hash).
   */
  async arvore() {
    const grupos = await this.db.webmapCamadaGrupo.findMany({
      where: { ativo: true }, orderBy: { ordem: 'asc' },
      include: { camadas: { where: { ativo: true, versaoAtual: { not: null } }, orderBy: { ordem: 'asc' }, select: { id: true, nomeOriginal: true, geometriaTipo: true, estilo: true, totalElementos: true, totalInvalidos: true, versaoAtual: true } } },
    });
    return grupos.filter((g) => g.camadas.length).map((g) => ({
      id: g.id, titulo: g.titulo,
      camadas: g.camadas.map((c) => ({
        id: `webmap:${c.id}`, camadaId: c.id, nomeOriginal: c.nomeOriginal, geometriaTipo: c.geometriaTipo, estilo: estiloEnxuto(c.estilo),
        totalElementos: c.totalElementos, totalInvalidos: c.totalInvalidos, versaoAtual: versaoCurta(c.versaoAtual!), ligadaPorPadrao: false, pesada: c.totalElementos > CAMADA_PESADA_ELEMENTOS,
      })),
    }));
  }

  /**
   * GeoJSON sob demanda da versão ATIVA (298). Camada pesada: bbox + zoom obrigatórios (índice composto da 296) e
   * simplificação por zoom; limites por resposta: 5.000 feições e ~2 MB (truncado=true → aviso no cliente).
   * Coordenadas com 6 casas (~0,11 m). `v` (versão vista pelo cliente) diferente da ativa => 409 versao_mudou.
   */
  async geojson(camadaId: string, bboxParam?: string, zoomParam?: string, versaoParam?: string) {
    const camada = await this.db.webmapCamada.findFirst({ where: { id: camadaId, ativo: true, versaoAtual: { not: null } }, select: { id: true, totalElementos: true, versaoAtual: true } });
    if (!camada) throw new NotFoundException('Camada não encontrada.');
    const versao = versaoCurta(camada.versaoAtual!);
    if (versaoParam && versaoParam !== versao) throw new ConflictException({ message: 'A camada foi reimportada; recarregue a lista de camadas.', codigo: 'versao_mudou', versao });
    const bbox = bboxParam?.split(',').map(Number);
    if (bbox && (bbox.length !== 4 || bbox.some((n) => !Number.isFinite(n)) || bbox[0] > bbox[2] || bbox[1] > bbox[3])) throw new BadRequestException('bbox inválido (minLng,minLat,maxLng,maxLat).');
    const pesada = camada.totalElementos > CAMADA_PESADA_ELEMENTOS;
    if (pesada && (!bbox || !zoomParam)) throw new BadRequestException('Camada pesada: informe bbox e zoom.');
    const zoom = zoomParam ? Number(zoomParam) : 18;
    if (!Number.isFinite(zoom)) throw new BadRequestException('zoom inválido.');
    const where: Prisma.WebmapElementoWhereInput = { camadaId: camada.id, versao: camada.versaoAtual!, ...FILTRO_EXIBICAO };
    if (bbox) Object.assign(where, { minLng: { lte: bbox[2] }, maxLng: { gte: bbox[0] }, minLat: { lte: bbox[3] }, maxLat: { gte: bbox[1] } });
    const rows = await this.db.webmapElemento.findMany({ where, take: LIMITE_ELEMENTOS_RESPOSTA + 1, select: { id: true, fidOrigem: true, geometria: true, atributos: true, corrigida: true } });
    let truncado = rows.length > LIMITE_ELEMENTOS_RESPOSTA;
    const tol = pesada || zoomParam ? toleranciaPorZoom(zoom) : 0;
    const features: Array<{ type: 'Feature'; id: string; fid: string | null; properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } }> = [];
    let bytes = 0;
    for (const r of rows.slice(0, LIMITE_ELEMENTOS_RESPOSTA)) {
      const g = r.geometria as { type: string; coordinates: unknown };
      const f = {
        type: 'Feature' as const, id: r.id, fid: r.fidOrigem,
        properties: { ...(r.atributos as Record<string, unknown>), ...(r.corrigida ? { _geometriaCorrigida: true } : {}) },
        geometry: arredondarGeometria(tol ? simplificarGeometria(g, tol) : g),
      };
      bytes += JSON.stringify(f).length + 1;
      if (bytes > LIMITE_BYTES_RESPOSTA && features.length) { truncado = true; break; }
      features.push(f);
    }
    return { type: 'FeatureCollection', versao, truncado, total: camada.totalElementos, features };
  }
}
