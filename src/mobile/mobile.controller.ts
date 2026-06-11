import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import { JwtPayload } from '../auth/jwt';
import { RequirePermissions } from '../auth/permissions';
import { PermissionsGuard } from '../auth/permissions.guard';
import { MobileSyncFiscalizacaoDto } from './mobile.dto';
import { MobileService } from './mobile.service';

@UseGuards(AuthGuard, PermissionsGuard)
@Controller('mobile')
export class MobileController {
  constructor(private readonly mobileService: MobileService) {}

  @RequirePermissions('fiscalizacoes.executar')
  @Get('field-package')
  getFieldPackage(@CurrentUser() user: JwtPayload) {
    return this.mobileService.getFieldPackage(user);
  }

  @RequirePermissions('fiscalizacoes.executar')
  @Post('sync/fiscalizacoes')
  syncFiscalizacao(@Body() body: MobileSyncFiscalizacaoDto, @CurrentUser() user: JwtPayload) {
    return this.mobileService.syncFiscalizacao(body, user);
  }
}
