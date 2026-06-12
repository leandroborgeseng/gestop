import { Module } from '@nestjs/common';
import { OperacionalController } from './operacional.controller';
import { OperacionalService } from './operacional.service';

@Module({
  controllers: [OperacionalController],
  providers: [OperacionalService],
})
export class OperacionalModule {}
