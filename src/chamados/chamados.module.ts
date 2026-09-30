import { forwardRef, Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { DocumentosModule } from '../documentos/documentos.module';
import { EmailModule } from '../email/email.module';
import { IntegracoesModule } from '../integracoes/integracoes.module';
import { StorageModule } from '../storage/storage.module';
import { ChamadoTarefasController } from './chamado-tarefas.controller';
import { ChamadoTarefasService } from './chamado-tarefas.service';
import { ChamadosController } from './chamados.controller';
import { ChamadosService } from './chamados.service';
import { MeusChamadosController } from './meus-chamados.controller';
import { PublicChamadosController } from './public-chamados.controller';

@Module({
  imports: [AuthModule, AuditModule, EmailModule, forwardRef(() => IntegracoesModule), StorageModule, DocumentosModule],
  controllers: [ChamadosController, ChamadoTarefasController, MeusChamadosController, PublicChamadosController],
  providers: [ChamadosService, ChamadoTarefasService],
  exports: [ChamadosService],
})
export class ChamadosModule {}
