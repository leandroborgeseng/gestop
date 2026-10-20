import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import type { JwtPayload } from '../auth/jwt';
import { aplicar, Fase, FonteMudouError, ImportacaoEmAndamentoError, MAX_ERROS_TELA, ResultadoSimulacao, SIMULACAO_TTL_MS, simplificarGeometria, simular, toleranciaPorZoom, WEBMAP_CAMADAS_ENTIDADE } from './core';
import { GithubWebmapFonte, WebmapCamadasFonte } from './source';

export const WEBMAP_CAMADAS_FONTE = Symbol('WEBMAP_CAMADAS_FONTE');
const LIMITE_ELEMENTOS_RESPOSTA = 5000;
const CAMADA_PESADA_ELEMENTOS = 2000;

export function dataHoraBrt(d: Date) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'medium' }).format(d) + ' (BRT)';
}

type EmAndamento = { tipo: 'SIMULACAO' | 'APLICACAO'; usuarioId: string; usuarioNome: string; desde: Date; fase: Fase };

@Injectable()
export class WebmapCamadasService {
  private readonly logger = new Logger(WebmapCamadasService.name);
  private readonly simulacoes = new Map<string, ResultadoSimulacao & { usuarioId: string }>();
  private emAndamento: EmAndamento | null = null;
  private fonte: WebmapCamadasFonte;

  constructor(private readonly prisma: PrismaService, private readonly storage: StorageService) {
    this.fonte = new GithubWebmapFonte();
  }

  /** Testes: troca a fonte por um diretório local. */
  usarFonte(fonte: WebmapCamadasFonte) {
    this.fonte = fonte;
  }

  private ocupar(tipo: EmAndamento['tipo'], user: JwtPayload) {
    if (this.emAndamento) {
      const a = this.emAndamento;
      throw new ConflictException(`Importação de camadas em andamento por ${a.usuarioNome} desde ${dataHoraBrt(a.desde)}.`);
    }
    this.emAndamento = { tipo, usuarioId: user.sub, usuarioNome: user.nome, desde: new Date(), fase: 'lendo_fonte' };
  }

  private async log(user: JwtPayload, tipo: 'SIMULACAO' | 'APLICACAO', resultado: 'SUCESSO' | 'PARCIAL' | 'FALHA', dados: Record<string, unknown>) {
    const agora = new Date();
    await this.prisma.logAuditoria.create({
      data: {
        usuarioId: user.sub, acao: AuditAction.SYNC, entidadeTipo: WEBMAP_CAMADAS_ENTIDADE, entidadeId: (dados.simulacaoId as string) ?? null,
        tela: 'Administração > Importação', valorAntigo: Prisma.JsonNull,
        valorNovo: { tipo, resultado, usuario: user.nome, dataHora: agora.toISOString(), dataHoraBrt: dataHoraBrt(agora), ...dados } as Prisma.InputJsonValue,
      },
    });
  }

  private resumoLog(r: ResultadoSimulacao) {
    const { camadasDetalhe: _d, erros, ...rest } = r;
    return { ...rest, erros: erros.slice(0, MAX_ERROS_TELA) };
  }

  async simular(user: JwtPayload) {
    this.ocupar('SIMULACAO', user);
    try {
      const { resultado } = await simular(this.prisma, this.fonte, (f) => (this.emAndamento!.fase = f));
      this.purgar();
      this.simulacoes.set(resultado.simulacaoId, { ...resultado, usuarioId: user.sub });
      await this.log(user, 'SIMULACAO', resultado.resultadoPrevisto, this.resumoLog(resultado));
      return { ...resultado, erros: resultado.erros.slice(0, MAX_ERROS_TELA) };
    } catch (error) {
      const motivo = error instanceof Error ? error.message : String(error);
      await this.log(user, 'SIMULACAO', 'FALHA', { motivo, fonte: this.fonte.descricao }).catch(() => undefined);
      throw new BadRequestException(`Não foi possível ler a fonte do Webmap: ${motivo}`);
    } finally {
      this.emAndamento = null;
    }
  }

  async aplicar(user: JwtPayload, simulacaoId: string | undefined) {
    const sim = simulacaoId ? this.simulacoes.get(simulacaoId) : undefined;
    if (!sim) throw new BadRequestException('Simule a importação antes de aplicar.');
    if (Date.now() - new Date(sim.criadaEm).getTime() > SIMULACAO_TTL_MS) {
      this.simulacoes.delete(sim.simulacaoId);
      throw new ConflictException('A simulação expirou (30 min). Simule de novo.');
    }
    this.ocupar('APLICACAO', user);
    try {
      const r = await aplicar(this.prisma, this.fonte, sim, {
        onFase: (f) => (this.emAndamento!.fase = f),
        icones: async (buf, mime) => {
          const s = await this.storage.persistBuffer(buf, mime, 'webmap-icones');
          return { storageKey: s.storageKey, url: s.url };
        },
      });
      this.simulacoes.delete(sim.simulacaoId);
      const { camadasDetalhe: _d, erros, ...rest } = r;
      await this.log(user, 'APLICACAO', r.resultado, { ...rest, erros: erros.slice(0, MAX_ERROS_TELA) });
      return { ...r, erros: erros.slice(0, MAX_ERROS_TELA) };
    } catch (error) {
      const motivo = error instanceof Error ? error.message : String(error);
      await this.log(user, 'APLICACAO', 'FALHA', { simulacaoId: sim.simulacaoId, motivo }).catch(() => undefined);
      if (error instanceof FonteMudouError || error instanceof ImportacaoEmAndamentoError) throw new ConflictException(motivo);
      throw new BadRequestException(`A importação falhou e nada foi alterado: ${motivo}`);
    } finally {
      this.emAndamento = null;
    }
  }

  errosCsv(simulacaoId: string) {
    const sim = this.simulacoes.get(simulacaoId);
    if (!sim) throw new NotFoundException('Simulação não encontrada ou expirada.');
    const esc = (v: string | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    return ['camada;elemento;motivo', ...sim.erros.map((e) => [esc(e.camada), esc(e.elemento), esc(e.motivo)].join(';'))].join('\n');
  }

  private purgar() {
    const now = Date.now();
    for (const [id, s] of this.simulacoes) if (now - new Date(s.criadaEm).getTime() > SIMULACAO_TTL_MS) this.simulacoes.delete(id);
  }

  async historico(limit = 20) {
    const rows = await this.prisma.logAuditoria.findMany({
      where: { entidadeTipo: WEBMAP_CAMADAS_ENTIDADE }, orderBy: { createdAt: 'desc' }, take: Math.min(Math.max(limit, 1), 100),
      select: { id: true, createdAt: true, usuarioId: true, valorNovo: true },
    });
    return rows.map((r) => ({ id: r.id, createdAt: r.createdAt, dataHoraBrt: dataHoraBrt(r.createdAt), usuarioId: r.usuarioId, ...(r.valorNovo as Record<string, unknown>) }));
  }

  async status() {
    const [ultima] = await this.historico(1);
    const [camadas, ativas, removidas] = await Promise.all([
      this.prisma.webmapCamada.count(), this.prisma.webmapCamada.count({ where: { ativo: true } }), this.prisma.webmapCamada.count({ where: { removidaOrigem: true } }),
    ]);
    const a = this.emAndamento;
    return {
      fonte: this.fonte.descricao,
      emAndamento: a ? { tipo: a.tipo, usuario: a.usuarioNome, desde: a.desde.toISOString(), desdeBrt: dataHoraBrt(a.desde), fase: a.fase } : null,
      ultima: ultima ?? null, camadas, ativas, removidasOrigem: removidas,
    };
  }

  /** Árvore para o mapa (D-296c: todos os usuários do mapa; camadas desligadas por padrão). */
  async arvore() {
    const grupos = await this.prisma.webmapCamadaGrupo.findMany({
      where: { ativo: true }, orderBy: { ordem: 'asc' },
      include: { camadas: { where: { ativo: true }, orderBy: { ordem: 'asc' }, select: { id: true, nomeOriginal: true, geometriaTipo: true, estilo: true, totalElementos: true, bbox: true, versaoAtual: true, bytesOrigem: true } } },
    });
    return grupos.filter((g) => g.camadas.length).map((g) => ({
      id: g.id, titulo: g.titulo,
      camadas: g.camadas.map((c) => ({ ...c, id: `webmap:${c.id}`, camadaId: c.id, ligadaPorPadrao: false, pesada: c.totalElementos > CAMADA_PESADA_ELEMENTOS })),
    }));
  }

  /** GeoJSON sob demanda; camadas pesadas exigem bbox e são simplificadas pelo zoom. */
  async geojson(camadaId: string, bboxParam?: string, zoomParam?: string) {
    const camada = await this.prisma.webmapCamada.findFirst({ where: { id: camadaId, ativo: true }, select: { id: true, totalElementos: true, versaoAtual: true } });
    if (!camada) throw new NotFoundException('Camada não encontrada.');
    const bbox = bboxParam?.split(',').map(Number);
    if (bbox && (bbox.length !== 4 || bbox.some((n) => !Number.isFinite(n)))) throw new BadRequestException('bbox inválido (minLng,minLat,maxLng,maxLat).');
    const pesada = camada.totalElementos > CAMADA_PESADA_ELEMENTOS;
    if (pesada && !bbox) throw new BadRequestException('Camada pesada: informe bbox e zoom.');
    const zoom = zoomParam ? Number(zoomParam) : 18;
    const where: Prisma.WebmapElementoWhereInput = { camadaId: camada.id };
    if (bbox) Object.assign(where, { minLng: { lte: bbox[2] }, maxLng: { gte: bbox[0] }, minLat: { lte: bbox[3] }, maxLat: { gte: bbox[1] } });
    const rows = await this.prisma.webmapElemento.findMany({ where, take: LIMITE_ELEMENTOS_RESPOSTA + 1, select: { fidOrigem: true, geometria: true, atributos: true } });
    const truncado = rows.length > LIMITE_ELEMENTOS_RESPOSTA;
    const tol = pesada ? toleranciaPorZoom(zoom) : 0;
    return {
      type: 'FeatureCollection', versao: camada.versaoAtual, truncado, total: camada.totalElementos,
      features: rows.slice(0, LIMITE_ELEMENTOS_RESPOSTA).map((r) => ({
        type: 'Feature', id: r.fidOrigem ?? undefined, properties: r.atributos,
        geometry: tol ? simplificarGeometria(r.geometria as { type: string; coordinates: unknown }, tol) : r.geometria,
      })),
    };
  }
}
