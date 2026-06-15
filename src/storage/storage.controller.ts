import { Controller, Get, NotFoundException, Param, StreamableFile, UseGuards } from '@nestjs/common';
import { createReadStream, existsSync } from 'node:fs';
import { join } from 'node:path';
import { AuthGuard } from '../auth/auth.guard';
import { normalizeStorageRoutePath } from './storage-url';
import { resolveStorageLocalDir } from './storage.health';

@UseGuards(AuthGuard)
@Controller('storage')
export class StorageController {
  @Get('{*splat}')
  serveLocalFile(@Param('splat') splat: string | string[]) {
    const driver = process.env.STORAGE_DRIVER?.trim() || 'local';
    if (driver !== 'local') {
      throw new NotFoundException('Arquivo nao encontrado.');
    }

    const path = normalizeStorageRoutePath(splat);
    if (!path) {
      throw new NotFoundException('Arquivo nao encontrado.');
    }

    const root = resolveStorageLocalDir();
    const absolutePath = join(root, path);
    if (!existsSync(absolutePath)) {
      throw new NotFoundException('Arquivo nao encontrado.');
    }

    const mimeType = mimeTypeFromPath(absolutePath);
    return new StreamableFile(createReadStream(absolutePath), { type: mimeType });
  }
}

function mimeTypeFromPath(path: string) {
  const ext = path.slice(path.lastIndexOf('.')).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.heic':
      return 'image/heic';
    default:
      return 'application/octet-stream';
  }
}
