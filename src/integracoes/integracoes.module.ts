import { forwardRef, Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { MobileModule } from '../mobile/mobile.module';
import { IntegracoesController } from './integracoes.controller';
import { IntegracoesService } from './integracoes.service';

@Module({
  imports: [AuthModule, AuditModule, forwardRef(() => MobileModule)],
  controllers: [IntegracoesController],
  providers: [IntegracoesService],
  exports: [IntegracoesService],
})
export class IntegracoesModule {}
