import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OperacionalController } from './operacional.controller';
import { OperacionalService } from './operacional.service';

@Module({
  imports: [AuthModule],
  controllers: [OperacionalController],
  providers: [OperacionalService],
})
export class OperacionalModule {}
