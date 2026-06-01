import { Controller, Get, NotFoundException, Param, StreamableFile } from '@nestjs/common';
import { createReadStream, existsSync } from 'node:fs';
import { join } from 'node:path';

@Controller('storage')
export class StorageController {
  @Get('*path')
  serveLocalFile(@Param('path') path: string) {
    const driver = process.env.STORAGE_DRIVER?.trim() || 'local';
    if (driver !== 'local') {
      throw new NotFoundException('Arquivo nao encontrado.');
    }

    if (!path || path.includes('..')) {
      throw new NotFoundException('Arquivo nao encontrado.');
    }

    const root = process.env.STORAGE_LOCAL_DIR?.trim() || join(process.cwd(), 'storage');
    const absolutePath = join(root, path);
    if (!existsSync(absolutePath)) {
      throw new NotFoundException('Arquivo nao encontrado.');
    }

    return new StreamableFile(createReadStream(absolutePath));
  }
}
