import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { WebmapCamadasAdminController, WebmapCamadasMapaController } from './webmap-camadas.controller';
import { WebmapCamadasService } from './webmap-camadas.service';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [WebmapCamadasAdminController, WebmapCamadasMapaController],
  providers: [WebmapCamadasService],
})
export class WebmapCamadasModule {}
