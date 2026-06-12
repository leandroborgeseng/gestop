import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IntegracoesModule } from '../integracoes/integracoes.module';
import { StorageModule } from '../storage/storage.module';
import { ChamadosController } from './chamados.controller';
import { ChamadosService } from './chamados.service';
import { PublicChamadosController } from './public-chamados.controller';

@Module({
  imports: [AuthModule, forwardRef(() => IntegracoesModule), StorageModule],
  controllers: [ChamadosController, PublicChamadosController],
  providers: [ChamadosService],
  exports: [ChamadosService],
})
export class ChamadosModule {}
