import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import { JwtPayload } from '../auth/jwt';
import { RequirePermissions } from '../auth/permissions';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CreateOrdemServicoDto, UpdateOrdemServicoDto } from './ordens-servico.dto';
import { OrdensServicoService } from './ordens-servico.service';

@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermissions('chamados.gerenciar')
@Controller('ordens-servico')
export class OrdensServicoController {
  constructor(private readonly ordensServicoService: OrdensServicoService) {}

  @Get()
  listOrdens() {
    return this.ordensServicoService.listOrdens();
  }

  @Post()
  createOrdem(@Body() body: CreateOrdemServicoDto, @CurrentUser() user: JwtPayload) {
    return this.ordensServicoService.createOrdemServico(body, user);
  }

  @Get(':id')
  getOrdem(@Param('id') id: string) {
    return this.ordensServicoService.getOrdem(id);
  }

  @Put(':id')
  updateOrdem(@Param('id') id: string, @Body() body: UpdateOrdemServicoDto, @CurrentUser() user: JwtPayload) {
    return this.ordensServicoService.updateOrdem(id, body, user);
  }

  @Post('gerar/nao-conformidades/:id')
  generateForNaoConformidade(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.ordensServicoService.generateForNaoConformidade(id, user);
  }
}
