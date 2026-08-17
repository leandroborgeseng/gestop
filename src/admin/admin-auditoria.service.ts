import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { JwtPayload } from '../auth/jwt';
import { AuditService } from '../audit/audit.service';
import {
  AUDITORIA_EVENTOS,
  auditoriaConfigChave,
  catalogoTelasAuditoria,
} from '../audit/audit.constants';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminAuditoriaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listLogs(query: {
    from?: string;
    to?: string;
    usuarioId?: string;
    acao?: string;
    tela?: string;
    secretariaId?: string;
    perfil?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    await this.auditService.ensureConfigSeed();
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const offset = Math.max(query.offset ?? 0, 0);
    const search = query.search?.trim();
    const where: Prisma.LogAuditoriaWhereInput = {
      AND: [
        query.from || query.to
          ? {
              createdAt: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
              },
            }
          : {},
        query.usuarioId ? { usuarioId: query.usuarioId } : {},
        query.acao && Object.values(AuditAction).includes(query.acao as AuditAction)
          ? { acao: query.acao as AuditAction }
          : {},
        query.tela ? { tela: query.tela } : {},
        query.secretariaId ? { secretariaAtivaId: query.secretariaId } : {},
        query.perfil ? { perfilAtivoNome: { contains: query.perfil, mode: 'insensitive' } } : {},
        search
          ? {
              OR: [
                { descricao: { contains: search, mode: 'insensitive' } },
                { entidadeTipo: { contains: search, mode: 'insensitive' } },
                { entidadeId: { contains: search, mode: 'insensitive' } },
                { tela: { contains: search, mode: 'insensitive' } },
                { funcao: { contains: search, mode: 'insensitive' } },
                { ip: { contains: search, mode: 'insensitive' } },
                { userAgent: { contains: search, mode: 'insensitive' } },
                { perfilAtivoNome: { contains: search, mode: 'insensitive' } },
                { secretariaAtivaSigla: { contains: search, mode: 'insensitive' } },
                { usuario: { nome: { contains: search, mode: 'insensitive' } } },
                { usuario: { email: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {},
      ],
    };

    const [items, total] = await Promise.all([
      this.prisma.logAuditoria.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          usuario: { select: { id: true, nome: true, email: true } },
        },
      }),
      this.prisma.logAuditoria.count({ where }),
    ]);

    return { items, total, limit, offset, hasMore: offset + items.length < total };
  }

  async getConfig() {
    await this.auditService.ensureConfigSeed();
    const [rows, usuarios] = await Promise.all([
      this.prisma.auditoriaConfig.findMany({ orderBy: [{ telaId: 'asc' }, { funcaoId: 'asc' }] }),
      this.prisma.usuario.findMany({
        where: { ativo: true },
        orderBy: { nome: 'asc' },
        select: { id: true, nome: true, email: true },
        take: 500,
      }),
    ]);
    const byChave = new Map(rows.map((row) => [row.chave, row]));
    return {
      eventos: AUDITORIA_EVENTOS,
      telas: catalogoTelasAuditoria().map((tela) => ({
        ...tela,
        functions: tela.functions.map((funcao) => ({
          ...funcao,
          eventos: AUDITORIA_EVENTOS.map((evento) => {
            const chave = auditoriaConfigChave(tela.id, funcao.id, evento.id);
            const row = byChave.get(chave);
            return { acao: evento.id, label: evento.label, chave, ativo: row?.ativo ?? false };
          }),
        })),
      })),
      usuarios,
    };
  }

  async updateConfig(
    body: { chave?: string; telaId: string; funcaoId: string; acao: string; ativo: boolean },
    user: JwtPayload,
  ) {
    await this.auditService.ensureConfigSeed();
    const chave = body.chave || auditoriaConfigChave(body.telaId, body.funcaoId, body.acao);
    const current = await this.prisma.auditoriaConfig.findUnique({ where: { chave } });
    if (!current && !catalogoTelasAuditoria().some((tela) => tela.id === body.telaId)) {
      throw new BadRequestException('Tela de auditoria inválida.');
    }

    const updated = await this.prisma.auditoriaConfig.upsert({
      where: { chave },
      update: { ativo: body.ativo, telaId: body.telaId, funcaoId: body.funcaoId, acao: body.acao },
      create: {
        chave,
        telaId: body.telaId,
        funcaoId: body.funcaoId,
        acao: body.acao,
        ativo: body.ativo,
      },
    });

    this.auditService.invalidateConfigCache();

    await this.auditService.record({
      user,
      acao: AuditAction.UPDATE,
      entidadeTipo: 'AuditoriaConfig',
      entidadeId: updated.id,
      tela: 'admin',
      funcao: 'auditoria',
      descricao: `Configuração de log ${chave}: ${current?.ativo ?? false} → ${body.ativo}`,
      valorAntigo: current,
      valorNovo: updated,
    });

    return updated;
  }
}
