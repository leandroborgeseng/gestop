import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageController } from './storage.controller';
import { StorageAcessoService } from './storage-acesso.service';
import { StorageService } from './storage.service';

@Module({
  imports: [AuthModule],
  controllers: [StorageController],
  providers: [StorageService, StorageAcessoService],
  exports: [StorageService],
})
export class StorageModule {}
