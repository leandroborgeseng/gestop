import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { IntegracoesModule } from '../integracoes/integracoes.module';
import { StorageModule } from '../storage/storage.module';
import { ChamadosController } from './chamados.controller';
import { ChamadosService } from './chamados.service';
import { MeusChamadosController } from './meus-chamados.controller';
import { PublicChamadosController } from './public-chamados.controller';

@Module({
  imports: [AuthModule, EmailModule, forwardRef(() => IntegracoesModule), StorageModule],
  controllers: [ChamadosController, MeusChamadosController, PublicChamadosController],
  providers: [ChamadosService],
  exports: [ChamadosService],
})
export class ChamadosModule {}
