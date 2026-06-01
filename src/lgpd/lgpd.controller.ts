import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import { JwtPayload } from '../auth/jwt';
import { RequirePermissions } from '../auth/permissions';
import { PermissionsGuard } from '../auth/permissions.guard';
import { LgpdService } from './lgpd.service';

@UseGuards(AuthGuard, PermissionsGuard)
@Controller('lgpd')
export class LgpdController {
  constructor(private readonly lgpdService: LgpdService) {}

  @RequirePermissions('usuarios.gerenciar')
  @Post('usuarios/:id/anonymize')
  anonymizeUsuario(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.lgpdService.anonymizeUsuario(id, user);
  }

  @RequirePermissions('usuarios.gerenciar')
  @Post('auditoria/purge')
  purgeAuditoria(@CurrentUser() user: JwtPayload) {
    return this.lgpdService.purgeAuditoria(user);
  }
}
