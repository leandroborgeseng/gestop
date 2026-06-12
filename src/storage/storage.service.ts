import { createHash, randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

export type StoredObject = {
  url: string;
  storageKey: string;
  mimeType: string;
  tamanhoBytes: number;
  checksum: string;
};

const ALLOWED_EVIDENCE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client | null = null;

  async persistEvidenceUrl(url: string, mimeType?: string | null): Promise<StoredObject> {
    if (url.startsWith('data:')) {
      const parsed = parseDataUrl(url, mimeType);
      return this.storeBuffer(parsed.buffer, parsed.mimeType, 'evidencias');
    }

    throw new BadRequestException('Envie a evidencia como upload (data URL). URLs externas nao sao aceitas.');
  }

  async deleteStoredObject(storageKey: string) {
    const normalizedKey = storageKey.trim();
    if (!normalizedKey) return;

    const driver = process.env.STORAGE_DRIVER?.trim() || 'local';

    try {
      if (driver === 's3') {
        const bucket = process.env.S3_BUCKET?.trim();
        if (!bucket) return;
        const client = this.getS3Client();
        await client.send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: normalizedKey,
          }),
        );
        return;
      }

      const root = process.env.STORAGE_LOCAL_DIR?.trim() || join(process.cwd(), 'storage');
      await unlink(join(root, normalizedKey));
    } catch (error) {
      this.logger.warn(
        `Falha ao remover objeto ${normalizedKey}: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
      );
    }
  }

  async deleteStoredObjects(storageKeys: string[]) {
    await Promise.all(storageKeys.map((key) => this.deleteStoredObject(key)));
  }

  private async storeBuffer(buffer: Buffer, mimeType: string, prefix: string): Promise<StoredObject> {
    const checksum = createHash('sha256').update(buffer).digest('hex');
    const extension = extensionFromMime(mimeType);
    const storageKey = `${prefix}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${extension}`;
    const driver = process.env.STORAGE_DRIVER?.trim() || 'local';

    if (driver === 's3') {
      const bucket = process.env.S3_BUCKET?.trim();
      if (!bucket) {
        throw new BadRequestException('Armazenamento S3 nao configurado.');
      }

      const client = this.getS3Client();
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: storageKey,
          Body: buffer,
          ContentType: mimeType,
        }),
      );

      return {
        url: buildPublicUrl(storageKey),
        storageKey,
        mimeType,
        tamanhoBytes: buffer.length,
        checksum,
      };
    }

    const root = process.env.STORAGE_LOCAL_DIR?.trim() || join(process.cwd(), 'storage');
    const absolutePath = join(root, storageKey);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, buffer);

    const publicBase = process.env.STORAGE_PUBLIC_URL_BASE?.trim() || `http://localhost:${process.env.PORT ?? 3001}`;
    return {
      url: `${publicBase.replace(/\/$/, '')}/storage/${storageKey}`,
      storageKey,
      mimeType,
      tamanhoBytes: buffer.length,
      checksum,
    };
  }

  private getS3Client() {
    if (!this.s3Client) {
      const region = process.env.S3_REGION?.trim() || 'auto';
      const endpoint = process.env.S3_ENDPOINT?.trim();

      this.s3Client = new S3Client({
        region,
        endpoint,
        forcePathStyle: Boolean(endpoint),
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID!.trim(),
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!.trim(),
        },
      });
    }

    return this.s3Client;
  }
}

function isProductionEnv() {
  return process.env.NODE_ENV === 'production';
}

function parseDataUrl(url: string, fallbackMimeType?: string | null) {
  const match = /^data:([^;,]+)?(?:;base64)?,(.+)$/i.exec(url);
  if (!match) {
    throw new BadRequestException('Data URL de evidencia invalida.');
  }

  const mimeType = (match[1] || fallbackMimeType || 'application/octet-stream').toLowerCase();
  if (!ALLOWED_EVIDENCE_MIMES.has(mimeType)) {
    throw new BadRequestException(`Tipo de arquivo nao permitido: ${mimeType}`);
  }
  const payload = match[2];
  const buffer = url.includes(';base64,')
    ? Buffer.from(payload, 'base64')
    : Buffer.from(decodeURIComponent(payload), 'utf8');

  if (buffer.length === 0) {
    throw new BadRequestException('Evidencia vazia.');
  }

  const maxBytes = Number(process.env.STORAGE_MAX_FILE_BYTES ?? 10 * 1024 * 1024);
  if (buffer.length > maxBytes) {
    throw new BadRequestException(`Evidencia excede o limite de ${maxBytes} bytes.`);
  }

  return { buffer, mimeType };
}

function extensionFromMime(mimeType: string) {
  switch (mimeType) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'image/heic':
      return '.heic';
    default:
      return '.bin';
  }
}

function buildPublicUrl(storageKey: string) {
  const base = process.env.S3_PUBLIC_URL_BASE?.trim();
  if (!base) {
    throw new BadRequestException('S3_PUBLIC_URL_BASE nao configurado.');
  }
  return `${base.replace(/\/$/, '')}/${storageKey}`;
}

function extractStorageKeyFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.pathname.replace(/^\//, '');
  } catch {
    return url;
  }
}
