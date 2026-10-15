import { Controller, Get, NotFoundException, Param, StreamableFile, UseGuards } from '@nestjs/common';
import { createReadStream, existsSync } from 'node:fs';
import { join } from 'node:path';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import type { JwtPayload } from '../auth/jwt';
import { StorageAcessoService } from './storage-acesso.service';
import { normalizeStorageRoutePath } from './storage-url';
import { resolveStorageLocalDir } from './storage.health';

@UseGuards(AuthGuard)
@Controller('storage')
export class StorageController {
  constructor(private readonly acesso: StorageAcessoService) {}

  @Get('{*splat}')
  async serveLocalFile(@Param('splat') splat: string | string[], @CurrentUser() user?: JwtPayload) {
    const driver = process.env.STORAGE_DRIVER?.trim() || 'local';
    if (driver !== 'local') {
      throw new NotFoundException('Arquivo nao encontrado.');
    }

    const path = normalizeStorageRoutePath(splat);
    if (!path) {
      throw new NotFoundException('Arquivo nao encontrado.');
    }

    // 285: permissão + escopo do registro dono do arquivo.
    await this.acesso.assertPodeBaixar(user, path);

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
    case '.pdf':
      return 'application/pdf';
    case '.mp4':
      return 'video/mp4';
    case '.mov':
      return 'video/quicktime';
    case '.webm':
      return 'video/webm';
    case '.m4v':
      return 'video/x-m4v';
    case '.3gp':
      return 'video/3gpp';
    default:
      return 'application/octet-stream';
  }
}
