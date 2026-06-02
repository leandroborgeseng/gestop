import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { resolveAuditUsuarioId } from '../audit/audit.util';
import { JwtPayload } from '../auth/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { fetchWebmapGithubStatus } from '../../prisma/webmap-github';
import { runWebmapImport, type WebmapImportResult } from '../../prisma/webmap-import-core';

const WEBMAP_AUDIT_ENTITY = 'WebmapImport';

@Injectable()
export class AdminImportService {
  constructor(private readonly prisma: PrismaService) {}

  async getWebmapStatus() {
    const [github, lastSync, unidadesCount] = await Promise.all([
      fetchWebmapGithubStatus(),
      this.getLastWebmapSync(),
      this.prisma.unidadePublica.count(),
    ]);

    const hasUpdates =
      !lastSync?.githubCommitSha || lastSync.githubCommitSha !== github.commitSha;

    return {
      github,
      lastSync,
      unidadesCount,
      hasUpdates,
      layersConfigured: 38,
      repoUrl: 'https://github.com/SMMAFRANCA/webmap',
    };
  }

  async syncWebmap(user: JwtPayload, dryRun = false): Promise<WebmapImportResult> {
    const result = await runWebmapImport(this.prisma, { dryRun });

    if (!dryRun) {
      const usuarioId = await resolveAuditUsuarioId(this.prisma, user.sub);

      await this.prisma.logAuditoria.create({
        data: {
          usuarioId,
          acao: AuditAction.SYNC,
          entidadeTipo: WEBMAP_AUDIT_ENTITY,
          entidadeId: result.github.commitSha,
          valorAntigo: Prisma.JsonNull,
          valorNovo: {
            ...(result as unknown as Record<string, unknown>),
            requestedBy: { sub: user.sub, email: user.email, nome: user.nome },
          } as Prisma.InputJsonValue,
        },
      });
    }

    return result;
  }

  private async getLastWebmapSync() {
    const record = await this.prisma.logAuditoria.findFirst({
      where: {
        entidadeTipo: WEBMAP_AUDIT_ENTITY,
        acao: AuditAction.SYNC,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        createdAt: true,
        entidadeId: true,
        valorNovo: true,
        usuario: { select: { nome: true, email: true } },
      },
    });

    if (!record) return null;

    const payload = record.valorNovo as WebmapImportResult | null;

    return {
      syncedAt: record.createdAt.toISOString(),
      githubCommitSha: record.entidadeId,
      usuario: record.usuario,
      created: payload?.created ?? null,
      updated: payload?.updated ?? null,
      uniqueUnits: payload?.uniqueUnits ?? null,
      skipped: payload?.skipped ?? null,
      layersFailed: payload?.layersFailed ?? null,
    };
  }
}
