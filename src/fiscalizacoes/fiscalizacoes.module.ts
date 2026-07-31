import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChamadosModule } from '../chamados/chamados.module';
import { CronogramaModule } from '../cronograma/cronograma.module';
import { DocumentosModule } from '../documentos/documentos.module';
import { StorageModule } from '../storage/storage.module';
import { FiscalizacoesController } from './fiscalizacoes.controller';
import { FiscalizacoesService } from './fiscalizacoes.service';

@Module({
  imports: [AuthModule, forwardRef(() => ChamadosModule), CronogramaModule, StorageModule, DocumentosModule],
  controllers: [FiscalizacoesController],
  providers: [FiscalizacoesService],
  exports: [FiscalizacoesService],
})
export class FiscalizacoesModule {}
