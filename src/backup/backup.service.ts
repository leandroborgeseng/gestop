import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { AuditAction, Prisma } from '@prisma/client';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { CronJob } from 'cron';
import { spawnSync } from 'node:child_process';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { JwtPayload } from '../auth/jwt';
import { resolveAuditUsuarioId } from '../audit/audit.util';
import { PrismaService } from '../prisma/prisma.service';
import { resolveStorageLocalDir } from '../storage/storage.health';
import { decryptSecret, encryptSecret } from './backup-crypto';
import { BackupRestoreDto, BackupS3ConfigDto } from './backup.dto';

const CONFIG_ID = 'default';
const CRON_JOB_NAME = 'backup-s3-daily';
const RESTORE_CONFIRMATION = 'RESTAURAR';

export type BackupStatusCode = 'ativo' | 'desabilitado' | 'incompleto' | 'em_execucao';

type BackupTrigger = 'cron' | 'manual';

type Tier = 'daily' | 'weekly' | 'monthly';

@Injectable()
export class BackupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackupService.name);
  private running = false;
  private runningSince: Date | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  async onModuleInit() {
    try {
      await this.ensureConfigRow();
      await this.maybeImportFromEnv();
      await this.refreshCron();
    } catch (error) {
      this.logger.warn(
        `Falha ao inicializar backup S3: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
      );
    }
  }

  onModuleDestroy() {
    this.clearCron();
  }

  async getStatus() {
    const config = await this.ensureConfigRow();
    const complete = this.isConfigComplete(config);
    let status: BackupStatusCode = 'desabilitado';
    if (this.running) status = 'em_execucao';
    else if (!config.enabled) status = 'desabilitado';
    else if (!complete) status = 'incompleto';
    else status = 'ativo';

    return {
      status,
      running: this.running,
      runningSince: this.runningSince?.toISOString() ?? null,
      cronRegistered: this.hasCron(),
      config: this.toPublicConfig(config),
      lastRun: {
        at: config.lastRunAt?.toISOString() ?? null,
        status: config.lastRunStatus,
        error: config.lastRunError,
        trigger: config.lastRunTrigger,
        objectKey: config.lastRunObjectKey,
        bytes: config.lastRunBytes != null ? Number(config.lastRunBytes) : null,
      },
    };
  }

  async saveConfig(dto: BackupS3ConfigDto, user: JwtPayload) {
    const current = await this.ensureConfigRow();
    const bucket = normalizeOptional(dto.bucket);
    const region = normalizeOptional(dto.region) || 'auto';
    const accessKeyId = normalizeOptional(dto.accessKeyId);
    const prefix = normalizePrefix(dto.prefix) || 'sigma-backups';
    const endpoint = normalizeOptional(dto.endpoint);
    const timezone = normalizeOptional(dto.timezone) || 'America/Sao_Paulo';
    const secretInput = dto.secretAccessKey?.trim() || '';

    let secretAccessKeyEnc = current.secretAccessKeyEnc;
    if (secretInput) {
      secretAccessKeyEnc = encryptSecret(secretInput);
    }

    if (dto.enabled) {
      if (!bucket || !accessKeyId || !secretAccessKeyEnc) {
        throw new BadRequestException(
          'Para ativar o backup automatico, informe bucket, Access Key ID e Secret Access Key.',
        );
      }
    }

    const updated = await this.prisma.backupS3Config.update({
      where: { id: CONFIG_ID },
      data: {
        enabled: dto.enabled,
        bucket,
        region,
        accessKeyId,
        secretAccessKeyEnc,
        prefix,
        dailyHour: dto.dailyHour,
        keepDaily: dto.keepDaily,
        keepWeekly: dto.keepWeekly,
        keepMonthly: dto.keepMonthly,
        endpoint,
        timezone,
        forcePathStyle: Boolean(dto.forcePathStyle ?? Boolean(endpoint)),
      },
    });

    await this.audit(user, AuditAction.UPDATE, 'BackupS3Config', CONFIG_ID, this.toAuditSnapshot(current), this.toAuditSnapshot(updated));
    await this.refreshCron();
    return this.getStatus();
  }

  async runNow(user: JwtPayload) {
    const result = await this.executeBackup('manual');
    await this.audit(user, AuditAction.CREATE, 'BackupS3Run', result.objectKeys[0] ?? 'manual', null, {
      trigger: 'manual',
      objectKeys: result.objectKeys,
      bytes: result.bytes,
    });
    return { ...result, status: await this.getStatus() };
  }

  async listBackups() {
    const config = await this.requireReadyConfig();
    const client = this.buildS3Client(config);
    const prefix = normalizePrefix(config.prefix) || 'sigma-backups';
    const tiers: Tier[] = ['daily', 'weekly', 'monthly'];
    const items: Array<{
      tier: Tier;
      key: string;
      size: number;
      lastModified: string | null;
    }> = [];

    for (const tier of tiers) {
      const listed = await this.listTierObjects(client, config.bucket!, `${prefix}/${tier}/`);
      for (const obj of listed) {
        items.push({
          tier,
          key: obj.Key!,
          size: obj.Size ?? 0,
          lastModified: obj.LastModified?.toISOString() ?? null,
        });
      }
    }

    items.sort((a, b) => (b.lastModified ?? '').localeCompare(a.lastModified ?? ''));
    return { items };
  }

  async restore(dto: BackupRestoreDto, user: JwtPayload) {
    if (dto.confirmacao !== RESTORE_CONFIRMATION) {
      throw new BadRequestException(`Confirmacao invalida. Digite exatamente ${RESTORE_CONFIRMATION}.`);
    }
    if (this.running) {
      throw new ConflictException('Ha um backup em execucao. Aguarde a conclusao antes de restaurar.');
    }

    const config = await this.requireReadyConfig();
    const objectKey = dto.objectKey.trim();
    if (!objectKey) {
      throw new BadRequestException('Informe o objectKey do backup no S3.');
    }

    this.running = true;
    this.runningSince = new Date();
    const workDir = await mkdtemp(join(tmpdir(), 'sigma-restore-'));

    try {
      const client = this.buildS3Client(config);
      const archivePath = join(workDir, basename(objectKey) || 'backup.tar.gz');
      await this.downloadObject(client, config.bucket!, objectKey, archivePath);
      await this.extractArchive(archivePath, workDir);

      const sqlPath = join(workDir, 'database.sql');
      if (!existsSync(sqlPath)) {
        throw new BadRequestException('Arquivo de backup invalido: database.sql ausente.');
      }

      await this.restoreDatabase(sqlPath);
      await this.restoreFilesIfPresent(workDir);

      await this.audit(user, AuditAction.UPDATE, 'BackupS3Restore', objectKey, null, {
        objectKey,
        restoredAt: new Date().toISOString(),
      });

      return {
        ok: true,
        objectKey,
        message: 'Restore concluido. Reinicie a API se necessario e valide os dados.',
      };
    } finally {
      this.running = false;
      this.runningSince = null;
      await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  async refreshCron() {
    this.clearCron();
    const config = await this.ensureConfigRow();
    if (!config.enabled || !this.isConfigComplete(config)) {
      this.logger.log('Cron de backup S3 nao registrado (desabilitado ou incompleto).');
      return;
    }

    const expression = `0 ${config.dailyHour} * * *`;
    const timezone = config.timezone || 'America/Sao_Paulo';
    const job = new CronJob(
      expression,
      () => {
        void this.executeBackup('cron').catch((error) => {
          this.logger.error(
            `Backup automatico falhou: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
          );
        });
      },
      null,
      false,
      timezone,
    );

    this.schedulerRegistry.addCronJob(CRON_JOB_NAME, job);
    job.start();
    this.logger.log(`Cron de backup S3 registrado: "${expression}" (${timezone})`);
  }

  private async executeBackup(trigger: BackupTrigger) {
    if (this.running) {
      throw new ConflictException('Ja existe um backup em execucao. Aguarde a conclusao.');
    }

    const config = await this.requireReadyConfig();
    this.running = true;
    this.runningSince = new Date();
    const workDir = await mkdtemp(join(tmpdir(), 'sigma-backup-'));

    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const archiveName = `gestop-backup-${stamp}.tar.gz`;
      const archivePath = join(workDir, archiveName);

      await this.createBackupArchive(workDir, archivePath);
      const bytes = (await stat(archivePath)).size;

      const client = this.buildS3Client(config);
      const prefix = normalizePrefix(config.prefix) || 'sigma-backups';
      const tiers = this.resolveTiersForNow(config.timezone);
      const objectKeys: string[] = [];

      for (const tier of tiers) {
        const key = `${prefix}/${tier}/${archiveName}`;
        const body = await readFile(archivePath);
        await client.send(
          new PutObjectCommand({
            Bucket: config.bucket!,
            Key: key,
            Body: body,
            ContentType: 'application/gzip',
          }),
        );
        objectKeys.push(key);
      }

      await this.pruneRetention(client, config);

      const updated = await this.prisma.backupS3Config.update({
        where: { id: CONFIG_ID },
        data: {
          lastRunAt: new Date(),
          lastRunStatus: 'success',
          lastRunError: null,
          lastRunTrigger: trigger,
          lastRunObjectKey: objectKeys[0] ?? null,
          lastRunBytes: BigInt(bytes),
        },
      });

      if (trigger === 'cron') {
        await this.auditSystem(AuditAction.CREATE, 'BackupS3Run', objectKeys[0] ?? 'cron', {
          trigger,
          objectKeys,
          bytes,
        });
      }

      this.logger.log(
        `Backup S3 concluido (${trigger}): ${objectKeys.join(', ')} (${bytes} bytes). Retencao aplicada.`,
      );

      return {
        ok: true as const,
        trigger,
        objectKeys,
        bytes,
        tiers,
        lastRunAt: updated.lastRunAt?.toISOString() ?? null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha no backup';
      await this.prisma.backupS3Config
        .update({
          where: { id: CONFIG_ID },
          data: {
            lastRunAt: new Date(),
            lastRunStatus: 'error',
            lastRunError: message.slice(0, 2000),
            lastRunTrigger: trigger,
          },
        })
        .catch(() => undefined);

      if (trigger === 'cron') {
        await this.auditSystem(AuditAction.CREATE, 'BackupS3Run', 'error', {
          trigger,
          error: message.slice(0, 500),
        }).catch(() => undefined);
      }

      throw error instanceof ConflictException || error instanceof BadRequestException
        ? error
        : new BadRequestException(message);
    } finally {
      this.running = false;
      this.runningSince = null;
      await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private async createBackupArchive(workDir: string, archivePath: string) {
    const sqlPath = join(workDir, 'database.sql');
    await this.dumpDatabase(sqlPath);

    const storageDriver = process.env.STORAGE_DRIVER?.trim() || 'local';
    let filesIncluded = false;
    if (storageDriver === 'local') {
      const localDir = resolveStorageLocalDir();
      if (existsSync(localDir)) {
        const filesDir = join(workDir, 'files');
        await mkdir(filesDir, { recursive: true });
        await cp(localDir, filesDir, { recursive: true, force: true });
        filesIncluded = true;
      }
    }

    const manifest = {
      version: 1,
      createdAt: new Date().toISOString(),
      app: 'gestop',
      includesDatabase: true,
      includesFiles: filesIncluded,
      storageDriver,
      note: 'Restore via Administracao → Backup automatico (S3) ou scripts manuais.',
    };
    await writeFile(join(workDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

    const tarArgs = ['-czf', archivePath, '-C', workDir, 'database.sql', 'manifest.json'];
    if (filesIncluded) tarArgs.push('files');

    const tar = spawnSync('tar', tarArgs, { encoding: 'utf8' });
    if (tar.status !== 0) {
      throw new Error(tar.stderr || 'Falha ao gerar arquivo tar.gz do backup.');
    }
  }

  private dumpDatabase(outputFile: string) {
    const databaseUrl = process.env.DATABASE_URL?.trim();
    if (!databaseUrl) {
      throw new Error('DATABASE_URL nao definida.');
    }
    const pgDump = process.env.PG_DUMP_PATH?.trim() || 'pg_dump';
    const result = spawnSync(
      pgDump,
      ['--dbname', databaseUrl, '--file', outputFile, '--no-owner', '--no-acl'],
      { encoding: 'utf8' },
    );
    if (result.error?.message?.includes('ENOENT')) {
      throw new Error(
        'pg_dump nao encontrado. Instale o cliente PostgreSQL ou defina PG_DUMP_PATH.',
      );
    }
    if (result.status !== 0) {
      throw new Error(result.stderr || 'pg_dump falhou.');
    }
  }

  private restoreDatabase(sqlPath: string) {
    const databaseUrl = process.env.DATABASE_URL?.trim();
    if (!databaseUrl) {
      throw new Error('DATABASE_URL nao definida.');
    }
    const psql = process.env.PSQL_PATH?.trim() || 'psql';
    const result = spawnSync(psql, ['--dbname', databaseUrl, '--file', sqlPath, '--quiet'], {
      encoding: 'utf8',
    });
    if (result.error?.message?.includes('ENOENT')) {
      throw new Error('psql nao encontrado. Instale o cliente PostgreSQL ou defina PSQL_PATH.');
    }
    if (result.status !== 0) {
      throw new Error(result.stderr || 'psql falhou ao restaurar o dump.');
    }
  }

  private async restoreFilesIfPresent(workDir: string) {
    const filesDir = join(workDir, 'files');
    if (!existsSync(filesDir)) return;
    const storageDriver = process.env.STORAGE_DRIVER?.trim() || 'local';
    if (storageDriver !== 'local') {
      this.logger.warn('Backup contem arquivos locais, mas STORAGE_DRIVER nao e local — arquivos ignorados.');
      return;
    }
    const localDir = resolveStorageLocalDir();
    await mkdir(localDir, { recursive: true });
    await cp(filesDir, localDir, { recursive: true, force: true });
  }

  private async extractArchive(archivePath: string, workDir: string) {
    const tar = spawnSync('tar', ['-xzf', archivePath, '-C', workDir], { encoding: 'utf8' });
    if (tar.status === 0) return;

    // Fallback: arquivo .sql.gz legado
    if (archivePath.endsWith('.gz') && !archivePath.endsWith('.tar.gz')) {
      const out = join(workDir, 'database.sql');
      await pipeline(createReadStream(archivePath), createGunzip(), createWriteStream(out));
      return;
    }

    throw new Error(tar.stderr || 'Falha ao extrair arquivo de backup.');
  }

  private async downloadObject(client: S3Client, bucket: string, key: string, dest: string) {
    const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!response.Body) {
      throw new Error('Objeto S3 vazio.');
    }
    const bytes = await response.Body.transformToByteArray();
    await writeFile(dest, Buffer.from(bytes));
  }

  private resolveTiersForNow(timezone: string): Tier[] {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'America/Sao_Paulo',
      weekday: 'short',
      day: 'numeric',
    }).formatToParts(new Date());
    const weekday = parts.find((p) => p.type === 'weekday')?.value;
    const day = Number(parts.find((p) => p.type === 'day')?.value ?? '0');

    const tiers: Tier[] = ['daily'];
    if (weekday === 'Sun') tiers.push('weekly');
    if (day === 1) tiers.push('monthly');
    return tiers;
  }

  private async pruneRetention(
    client: S3Client,
    config: {
      bucket: string | null;
      prefix: string;
      keepDaily: number;
      keepWeekly: number;
      keepMonthly: number;
    },
  ) {
    const bucket = config.bucket!;
    const prefix = normalizePrefix(config.prefix) || 'sigma-backups';
    const plan: Array<{ tier: Tier; keep: number }> = [
      { tier: 'daily', keep: config.keepDaily },
      { tier: 'weekly', keep: config.keepWeekly },
      { tier: 'monthly', keep: config.keepMonthly },
    ];

    for (const { tier, keep } of plan) {
      const objects = await this.listTierObjects(client, bucket, `${prefix}/${tier}/`);
      objects.sort((a, b) => (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0));
      const toDelete = objects.slice(Math.max(0, keep));
      for (const obj of toDelete) {
        if (!obj.Key) continue;
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: obj.Key }));
        this.logger.log(`Prune ${tier}: removido ${obj.Key}`);
      }
    }
  }

  private async listTierObjects(client: S3Client, bucket: string, prefix: string) {
    const objects: Array<{ Key?: string; Size?: number; LastModified?: Date }> = [];
    let token: string | undefined;
    do {
      const page = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: token,
        }),
      );
      for (const item of page.Contents ?? []) {
        if (item.Key && !item.Key.endsWith('/')) objects.push(item);
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return objects;
  }

  private buildS3Client(config: {
    region: string;
    endpoint: string | null;
    forcePathStyle: boolean;
    accessKeyId: string | null;
    secretAccessKeyEnc: string | null;
  }) {
    if (!config.accessKeyId || !config.secretAccessKeyEnc) {
      throw new BadRequestException('Credenciais S3 incompletas.');
    }
    const secretAccessKey = decryptSecret(config.secretAccessKeyEnc);
    return new S3Client({
      region: config.region || 'auto',
      endpoint: config.endpoint || undefined,
      forcePathStyle: config.forcePathStyle || Boolean(config.endpoint),
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey,
      },
    });
  }

  private async requireReadyConfig() {
    const config = await this.ensureConfigRow();
    if (!this.isConfigComplete(config)) {
      throw new BadRequestException(
        'Configuracao de backup S3 incompleta. Salve bucket, chaves e prefixo na Administracao.',
      );
    }
    return config;
  }

  private isConfigComplete(config: {
    bucket: string | null;
    accessKeyId: string | null;
    secretAccessKeyEnc: string | null;
  }) {
    return Boolean(config.bucket?.trim() && config.accessKeyId?.trim() && config.secretAccessKeyEnc);
  }

  private toPublicConfig(config: {
    enabled: boolean;
    bucket: string | null;
    region: string;
    accessKeyId: string | null;
    secretAccessKeyEnc: string | null;
    prefix: string;
    dailyHour: number;
    timezone: string;
    endpoint: string | null;
    forcePathStyle: boolean;
    keepDaily: number;
    keepWeekly: number;
    keepMonthly: number;
    envImportedAt: Date | null;
    updatedAt: Date;
  }) {
    return {
      enabled: config.enabled,
      bucket: config.bucket,
      region: config.region,
      accessKeyId: config.accessKeyId,
      hasSecretAccessKey: Boolean(config.secretAccessKeyEnc),
      prefix: config.prefix,
      dailyHour: config.dailyHour,
      timezone: config.timezone,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      keepDaily: config.keepDaily,
      keepWeekly: config.keepWeekly,
      keepMonthly: config.keepMonthly,
      envImportedAt: config.envImportedAt?.toISOString() ?? null,
      updatedAt: config.updatedAt.toISOString(),
    };
  }

  private toAuditSnapshot(config: {
    enabled: boolean;
    bucket: string | null;
    region: string;
    accessKeyId: string | null;
    secretAccessKeyEnc: string | null;
    prefix: string;
    dailyHour: number;
    timezone: string;
    endpoint: string | null;
    forcePathStyle: boolean;
    keepDaily: number;
    keepWeekly: number;
    keepMonthly: number;
  }) {
    return {
      enabled: config.enabled,
      bucket: config.bucket,
      region: config.region,
      accessKeyId: config.accessKeyId,
      hasSecretAccessKey: Boolean(config.secretAccessKeyEnc),
      prefix: config.prefix,
      dailyHour: config.dailyHour,
      timezone: config.timezone,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      keepDaily: config.keepDaily,
      keepWeekly: config.keepWeekly,
      keepMonthly: config.keepMonthly,
    };
  }

  private async ensureConfigRow() {
    return this.prisma.backupS3Config.upsert({
      where: { id: CONFIG_ID },
      update: {},
      create: { id: CONFIG_ID },
    });
  }

  private async maybeImportFromEnv() {
    const config = await this.ensureConfigRow();
    if (config.envImportedAt) return;
    if (config.bucket || config.accessKeyId || config.secretAccessKeyEnc) {
      await this.prisma.backupS3Config.update({
        where: { id: CONFIG_ID },
        data: { envImportedAt: new Date() },
      });
      return;
    }

    const bucket = process.env.S3_BUCKET?.trim();
    const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
    const secret = process.env.S3_SECRET_ACCESS_KEY?.trim();
    if (!bucket || !accessKeyId || !secret) return;

    await this.prisma.backupS3Config.update({
      where: { id: CONFIG_ID },
      data: {
        bucket,
        region: process.env.S3_REGION?.trim() || 'auto',
        accessKeyId,
        secretAccessKeyEnc: encryptSecret(secret),
        endpoint: process.env.S3_ENDPOINT?.trim() || null,
        forcePathStyle: Boolean(process.env.S3_ENDPOINT?.trim()),
        prefix: process.env.BACKUP_S3_PREFIX?.trim() || 'sigma-backups',
        envImportedAt: new Date(),
      },
    });
    this.logger.log('Configuracao de backup S3 importada uma vez a partir das variaveis S3_* do ambiente.');
  }

  private clearCron() {
    try {
      if (this.schedulerRegistry.doesExist('cron', CRON_JOB_NAME)) {
        this.schedulerRegistry.deleteCronJob(CRON_JOB_NAME);
      }
    } catch {
      // ignore
    }
  }

  private hasCron() {
    try {
      return this.schedulerRegistry.doesExist('cron', CRON_JOB_NAME);
    } catch {
      return false;
    }
  }

  private async audit(
    user: JwtPayload,
    acao: AuditAction,
    entidadeTipo: string,
    entidadeId: string,
    valorAntigo: unknown,
    valorNovo: unknown,
  ) {
    const usuarioId = await resolveAuditUsuarioId(this.prisma, user.sub);
    await this.prisma.logAuditoria.create({
      data: {
        usuarioId,
        acao,
        entidadeTipo,
        entidadeId,
        valorAntigo: toJsonValue(valorAntigo),
        valorNovo: toJsonValue(valorNovo),
      },
    });
  }

  private async auditSystem(
    acao: AuditAction,
    entidadeTipo: string,
    entidadeId: string,
    valorNovo: unknown,
  ) {
    await this.prisma.logAuditoria.create({
      data: {
        acao,
        entidadeTipo,
        entidadeId,
        valorNovo: toJsonValue(valorNovo),
      },
    });
  }
}

function normalizeOptional(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizePrefix(value?: string | null) {
  const trimmed = value?.trim().replace(/^\/+|\/+$/g, '');
  return trimmed || null;
}

function toJsonValue(value: unknown) {
  if (value === null || value === undefined) {
    return Prisma.JsonNull;
  }
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
