import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FiscalizacoesController } from './fiscalizacoes.controller';
import { FiscalizacoesService } from './fiscalizacoes.service';

@Module({
  imports: [AuthModule],
  controllers: [FiscalizacoesController],
  providers: [FiscalizacoesService],
  exports: [FiscalizacoesService],
})
export class FiscalizacoesModule {}
