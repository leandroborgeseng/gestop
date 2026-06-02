import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AuditAction } from '@prisma/client';
import { resolveAuditUsuarioId } from '../audit/audit.util';
import { JwtPayload } from '../auth/jwt';
import { IntegracoesService } from '../integracoes/integracoes.service';
import { PrismaService } from '../prisma/prisma.service';
import { importSecretariasFromCsvContent } from '../../prisma/import-secretarias-core';
import { fetchWebmapGithubStatus, verifyGithubWebhookSignature } from '../../prisma/webmap-github';
import { runWebmapImport, type WebmapImportResult } from '../../prisma/webmap-import-core';
import { persistWebmapImportResult } from '../../prisma/webmap-import-persist';
import { skippedUnitsToGeoJson } from '../../prisma/webmap-geo';
import { WEBMAP_LAYER_FILES } from '../../prisma/webmap-layers';

const WEBMAP_AUDIT_ENTITY = 'WebmapImport';
const SECRETARIAS_TEMPLATE = resolve(process.cwd(), 'data/secretarias.template.csv');

@Injectable()
export class AdminImportService {
  private readonly logger = new Logger(AdminImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly integracoesService: IntegracoesService,
  ) {}

  async getWebmapStatus() {
    const [github, lastImport, unidadesCount] = await Promise.all([
      fetchWebmapGithubStatus(),
      this.getLastWebmapImport(),
      this.prisma.unidadePublica.count({ where: { ativo: true } }),
    ]);

    const hasUpdates = !lastImport?.githubCommitSha || lastImport.githubCommitSha !== github.commitSha;

    return {
      github,
      lastSync: lastImport,
      unidadesCount,
      hasUpdates,
      layersConfigured: lastImport?.layersDiscovered ?? WEBMAP_LAYER_FILES.length,
      repoUrl: 'https://github.com/SMMAFRANCA/webmap',
      automation: {
        cronEnabled: Boolean(this.configService.get<string>('WEBMAP_CRON_SECRET')),
        webhookEnabled: Boolean(this.configService.get<string>('WEBMAP_WEBHOOK_SECRET')),
      },
    };
  }

  async importSecretarias(dryRun = false) {
    const content = await readFile(SECRETARIAS_TEMPLATE, 'utf8');
    return importSecretariasFromCsvContent(this.prisma, content, dryRun);
  }

  async syncWebmap(
    user: JwtPayload | null,
    dryRun = false,
    triggeredBy: WebmapImportResult['triggeredBy'] = 'manual',
  ): Promise<WebmapImportResult> {
    const previous = await this.prisma.webmapImport.findFirst({
      where: { dryRun: false },
      orderBy: { createdAt: 'desc' },
      select: { githubCommitSha: true },
    });

    const result = await runWebmapImport(
      this.prisma,
      { dryRun, deactivateMissing: !dryRun },
      triggeredBy,
      previous?.githubCommitSha ?? null,
    );

    if (!dryRun) {
      const usuarioId = user ? await resolveAuditUsuarioId(this.prisma, user.sub) : undefined;
      await persistWebmapImportResult(this.prisma, result, { triggeredBy, usuarioId });
      await this.notifyImportResult(result);
    }

    return result;
  }

  async syncAll(user: JwtPayload, dryRun = false) {
    const secretarias = await this.importSecretarias(dryRun);
    const webmap = await this.syncWebmap(user, dryRun, 'manual');
    return { secretarias, webmap };
  }

  async runAutomatedSync(triggeredBy: 'cron' | 'webhook') {
    const github = await fetchWebmapGithubStatus();
    const last = await this.prisma.webmapImport.findFirst({
      where: { dryRun: false },
      orderBy: { createdAt: 'desc' },
      select: { githubCommitSha: true },
    });

    if (last?.githubCommitSha === github.commitSha) {
      return { skipped: true, reason: 'Commit ja importado', github };
    }

    const result = await this.syncWebmap(null, false, triggeredBy);
    return { skipped: false, result };
  }

  validateCronSecret(headerValue: string | undefined) {
    const secret = this.configService.get<string>('WEBMAP_CRON_SECRET')?.trim();
    if (!secret) throw new BadRequestException('WEBMAP_CRON_SECRET nao configurado.');
    if (!headerValue || headerValue !== secret) {
      throw new UnauthorizedException('Cron secret invalido.');
    }
  }

  validateWebhook(rawBody: string, signature: string | undefined) {
    const secret = this.configService.get<string>('WEBMAP_WEBHOOK_SECRET')?.trim();
    if (!secret) throw new BadRequestException('WEBMAP_WEBHOOK_SECRET nao configurado.');
    if (!verifyGithubWebhookSignature(rawBody, signature, secret)) {
      throw new UnauthorizedException('Assinatura do webhook invalida.');
    }
  }

  buildSkippedGeoJson(result: WebmapImportResult) {
    return skippedUnitsToGeoJson(
      result.skippedUnits.map((unit) => ({
        codigoPatrimonial: unit.codigoPatrimonial,
        nome: unit.nome,
        latitude: unit.latitude,
        longitude: unit.longitude,
        reason: unit.reason,
      })),
    );
  }

  async getImportById(id: string) {
    const record = await this.prisma.webmapImport.findUnique({ where: { id } });
    if (!record) throw new BadRequestException('Importacao nao encontrada.');
    return record;
  }

  private async notifyImportResult(result: WebmapImportResult) {
    const threshold = Number(this.configService.get<string>('WEBMAP_SKIP_NOTIFY_THRESHOLD') ?? '10');
    const shouldNotify =
      result.layersFailed > 0 || result.skipped >= threshold || result.rejectedFeatures.length >= threshold;

    if (!shouldNotify) return;

    try {
      await this.integracoesService.notifySystem('webmap.import.alert', {
        commitSha: result.github.commitSha,
        skipped: result.skipped,
        rejected: result.rejectedFeatures.length,
        layersFailed: result.layersFailed,
        deactivated: result.deactivated,
      });
    } catch (error) {
      this.logger.warn(`Notificacao webmap falhou: ${error instanceof Error ? error.message : error}`);
    }
  }

  private async getLastWebmapImport() {
    const record = await this.prisma.webmapImport.findFirst({
      where: { dryRun: false },
      orderBy: { createdAt: 'desc' },
      include: { usuario: { select: { nome: true, email: true } } },
    });

    if (record) {
      const payload = record.result as WebmapImportResult;
      return {
        id: record.id,
        syncedAt: record.createdAt.toISOString(),
        githubCommitSha: record.githubCommitSha,
        usuario: record.usuario ?? { nome: 'Automacao', email: 'sistema@gestop' },
        created: record.created,
        updated: record.updated,
        uniqueUnits: record.uniqueUnits,
        skipped: record.skipped,
        deactivated: record.deactivated,
        skippedUnits: payload.skippedUnits ?? [],
        rejectedFeatures: payload.rejectedFeatures ?? [],
        deactivatedUnits: payload.deactivatedUnits ?? [],
        diff: payload.diff ?? null,
        layersFailed: record.layersFailed,
        layersDiscovered: record.layersDiscovered,
        durationMs: record.durationMs,
        triggeredBy: record.triggeredBy,
        importResult: payload,
      };
    }

    return this.getLegacyLastSync();
  }

  private async getLegacyLastSync() {
    const record = await this.prisma.logAuditoria.findFirst({
      where: { entidadeTipo: WEBMAP_AUDIT_ENTITY, acao: AuditAction.SYNC },
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
      id: null,
      syncedAt: record.createdAt.toISOString(),
      githubCommitSha: record.entidadeId,
      usuario: record.usuario ?? { nome: 'Sistema', email: 'sistema@gestop' },
      created: payload?.created ?? null,
      updated: payload?.updated ?? null,
      uniqueUnits: payload?.uniqueUnits ?? null,
      skipped: payload?.skipped ?? null,
      deactivated: payload?.deactivated ?? 0,
      skippedUnits: payload?.skippedUnits ?? [],
      rejectedFeatures: payload?.rejectedFeatures ?? [],
      deactivatedUnits: payload?.deactivatedUnits ?? [],
      diff: payload?.diff ?? null,
      layersFailed: payload?.layersFailed ?? null,
      layersDiscovered: payload?.layersDiscovered ?? WEBMAP_LAYER_FILES.length,
      durationMs: payload?.durationMs ?? null,
      triggeredBy: payload?.triggeredBy ?? 'manual',
    };
  }
}
