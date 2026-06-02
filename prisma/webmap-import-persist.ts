import { AuditAction, Prisma, PrismaClient } from '@prisma/client';
import type { WebmapImportResult } from './webmap-import-core';

const WEBMAP_AUDIT_ENTITY = 'WebmapImport';

export async function persistWebmapImportResult(
  prisma: PrismaClient,
  result: WebmapImportResult,
  options: {
    triggeredBy: WebmapImportResult['triggeredBy'];
    usuarioId?: string | null;
  },
) {
  await prisma.webmapImport.create({
    data: {
      githubCommitSha: result.github.commitSha,
      commitMessage: result.github.commitMessage,
      dryRun: false,
      triggeredBy: options.triggeredBy,
      featuresRead: result.featuresRead,
      uniqueUnits: result.uniqueUnits,
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      deactivated: result.deactivated,
      rejectedCount: result.rejectedFeatures.length,
      layersProcessed: result.layersProcessed,
      layersFailed: result.layersFailed,
      layersDiscovered: result.layersDiscovered,
      durationMs: result.durationMs,
      result: result as unknown as Prisma.InputJsonValue,
      usuarioId: options.usuarioId ?? undefined,
    },
  });

  try {
    await prisma.logAuditoria.create({
      data: {
        usuarioId: options.usuarioId ?? undefined,
        acao: AuditAction.SYNC,
        entidadeTipo: WEBMAP_AUDIT_ENTITY,
        entidadeId: result.github.commitSha,
        valorAntigo: Prisma.JsonNull,
        valorNovo: result as unknown as Prisma.InputJsonValue,
      },
    });
  } catch {
    // Auditoria opcional no boot automatico.
  }
}
