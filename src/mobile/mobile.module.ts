import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CronogramaModule } from '../cronograma/cronograma.module';
import { ChamadosModule } from '../chamados/chamados.module';
import { StorageModule } from '../storage/storage.module';
import { MobileController } from './mobile.controller';
import { MobileService } from './mobile.service';

@Module({
  imports: [AuthModule, CronogramaModule, forwardRef(() => ChamadosModule), StorageModule],
  controllers: [MobileController],
  providers: [MobileService],
  exports: [MobileService],
})
export class MobileModule {}
