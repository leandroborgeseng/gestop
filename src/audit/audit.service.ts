import { Injectable, Logger } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { JwtPayload } from '../auth/jwt';
import { resolveAuditUsuarioId } from './audit.util';
import { PrismaService } from '../prisma/prisma.service';
import {
  AUDITORIA_EVENTOS,
  AUDITORIA_EVENTOS_JA_REGISTRADOS,
  auditoriaConfigChave,
  catalogoTelasAuditoria,
  entidadeTipoParaTela,
  mapAuditActionToEvento,
} from './audit.constants';

export type AuditWriteInput = {
  user?: JwtPayload | null;
  usuarioId?: string;
  acao: AuditAction;
  entidadeTipo: string;
  entidadeId?: string | null;
  valorAntigo?: unknown;
  valorNovo?: unknown;
  tela?: string;
  funcao?: string;
  descricao?: string;
  ip?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private configCache = new Map<string, boolean>();
  private configLoadedAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  async ensureConfigSeed() {
    const existing = await this.prisma.auditoriaConfig.count();
    const rows = this.buildDefaultRows();
    if (existing >= rows.length) return;

    await this.prisma.auditoriaConfig.createMany({
      data: rows,
      skipDuplicates: true,
    });
    this.configCache.clear();
    this.configLoadedAt = 0;
  }

  private buildDefaultRows() {
    const telas = catalogoTelasAuditoria();
    const rows: Array<{ chave: string; telaId: string; funcaoId: string; acao: string; ativo: boolean }> = [];
    for (const tela of telas) {
      for (const funcao of tela.functions) {
        for (const evento of AUDITORIA_EVENTOS) {
          const ativo =
            tela.id === 'auth' && (evento.id === 'LOGIN' || evento.id === 'LOGOUT')
              ? true
              : AUDITORIA_EVENTOS_JA_REGISTRADOS.includes(evento.id) &&
                evento.id !== 'LOGIN' &&
                evento.id !== 'LOGOUT';
          rows.push({
            chave: auditoriaConfigChave(tela.id, funcao.id, evento.id),
            telaId: tela.id,
            funcaoId: funcao.id,
            acao: evento.id,
            ativo,
          });
        }
      }
    }
    return rows;
  }

  async isEnabled(telaId: string, funcaoId: string, acao: string) {
    await this.refreshConfigCache();
    const exact = this.configCache.get(auditoriaConfigChave(telaId, funcaoId, acao));
    if (exact != null) return exact;
    const tela = this.configCache.get(auditoriaConfigChave(telaId, '_tela', acao));
    if (tela != null) return tela;
    return true;
  }

  private async refreshConfigCache() {
    if (this.configCache.size > 0 && Date.now() - this.configLoadedAt < 15_000) return;
    const rows = await this.prisma.auditoriaConfig.findMany({ select: { chave: true, ativo: true } });
    this.configCache = new Map(rows.map((row) => [row.chave, row.ativo]));
    this.configLoadedAt = Date.now();
  }

  invalidateConfigCache() {
    this.configCache.clear();
    this.configLoadedAt = 0;
  }

  async record(input: AuditWriteInput) {
    const mapped = entidadeTipoParaTela(input.entidadeTipo);
    const tela = input.tela ?? mapped.telaId;
    const funcao = input.funcao ?? mapped.funcaoId;
    const evento = mapAuditActionToEvento(input.acao);

    try {
      if (!(await this.isEnabled(tela, funcao, evento))) {
        return null;
      }

      const usuarioId = await resolveAuditUsuarioId(this.prisma, input.usuarioId ?? input.user?.sub);
      const contexto = await this.resolveContexto(input.user);

      return await this.prisma.logAuditoria.create({
        data: {
          usuarioId,
          acao: input.acao,
          entidadeTipo: input.entidadeTipo,
          entidadeId: input.entidadeId ?? undefined,
          valorAntigo: toJsonValue(input.valorAntigo),
          valorNovo: toJsonValue(input.valorNovo),
          ip: input.ip ?? undefined,
          userAgent: input.userAgent ?? undefined,
          tela,
          funcao,
          descricao: input.descricao ?? undefined,
          perfilAtivoNome: contexto.perfilAtivoNome,
          secretariaAtivaId: contexto.secretariaAtivaId,
          secretariaAtivaSigla: contexto.secretariaAtivaSigla,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Falha ao gravar auditoria (${input.entidadeTipo}/${input.acao}): ${
          error instanceof Error ? error.message : 'erro'
        }`,
      );
      return null;
    }
  }

  private async resolveContexto(user?: JwtPayload | null) {
    if (!user) {
      return { perfilAtivoNome: null as string | null, secretariaAtivaId: null as string | null, secretariaAtivaSigla: null as string | null };
    }

    const [perfil, secretaria] = await Promise.all([
      user.perfilAtivoId
        ? this.prisma.perfil.findUnique({ where: { id: user.perfilAtivoId }, select: { nome: true } })
        : Promise.resolve(null),
      user.secretariaId
        ? this.prisma.secretaria.findUnique({
            where: { id: user.secretariaId },
            select: { id: true, sigla: true },
          })
        : Promise.resolve(null),
    ]);

    return {
      perfilAtivoNome: perfil?.nome ?? user.perfis[0] ?? null,
      secretariaAtivaId: secretaria?.id ?? user.secretariaId ?? null,
      secretariaAtivaSigla: secretaria?.sigla ?? null,
    };
  }
}

function toJsonValue(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
