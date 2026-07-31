import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { DocumentosController } from './documentos.controller';
import { DocumentosService } from './documentos.service';
import { PublicDocumentosController } from './public-documentos.controller';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [DocumentosController, PublicDocumentosController],
  providers: [DocumentosService],
  exports: [DocumentosService],
})
export class DocumentosModule {}
