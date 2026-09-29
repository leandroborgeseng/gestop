import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmailConfigController } from './email-config.controller';
import { EmailConfigService } from './email-config.service';
import { EmailService } from './email.service';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [EmailConfigController],
  providers: [EmailService, EmailConfigService],
  exports: [EmailService, EmailConfigService],
})
export class EmailModule {}
