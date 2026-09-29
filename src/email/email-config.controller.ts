import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import { JwtPayload } from '../auth/jwt';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequireAnyPermissions } from '../auth/permissions';
import { adminTabPermissionKeys } from '../domain/admin-permissions';
import { EmailConfigDto, EmailTesteDto } from './email.dto';
import { EmailConfigService } from './email-config.service';

@UseGuards(AuthGuard, PermissionsGuard)
@Controller('admin/email')
export class EmailConfigController {
  constructor(private readonly emailConfig: EmailConfigService) {}

  @RequireAnyPermissions(...adminTabPermissionKeys('email', 'visualizar'))
  @Get()
  getConfig() {
    return this.emailConfig.getPublic();
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('email', 'alterar'))
  @Put()
  save(@Body() body: EmailConfigDto, @CurrentUser() user: JwtPayload) {
    return this.emailConfig.save(body, user);
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('email', 'executar'))
  @Post('teste')
  testar(@Body() body: EmailTesteDto, @CurrentUser() user: JwtPayload) {
    return this.emailConfig.testar(body, user);
  }
}
