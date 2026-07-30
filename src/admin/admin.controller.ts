import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import { JwtPayload } from '../auth/jwt';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequireAnyPermissions, RequirePermissions } from '../auth/permissions';
import { AdminPermissionsService } from './admin-permissions.service';
import { PerfilAtivoDto, PerfilCreateDto, PerfilMatrizDto, PerfilUpdateDto } from './admin-permissions.dto';
import { AdminService } from './admin.service';
import {
  SecretariaDto,
  UnidadeDto,
  UsuarioDto,
  EquipeDto,
  TipoChamadoDto,
  CategoriaVistoriaDto,
  CargoDto,
  TipoProprioDto,
} from './admin.dto';

@UseGuards(AuthGuard, PermissionsGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly adminPermissionsService: AdminPermissionsService,
  ) {}

  @RequirePermissions('secretarias.gerenciar')
  @Get('secretarias')
  listSecretarias() {
    return this.adminService.listSecretarias();
  }

  @RequirePermissions('secretarias.gerenciar')
  @Post('secretarias')
  createSecretaria(@Body() body: SecretariaDto, @CurrentUser() user: JwtPayload) {
    return this.adminService.createSecretaria(body, user);
  }

  @RequirePermissions('secretarias.gerenciar')
  @Put('secretarias/:id')
  updateSecretaria(@Param('id') id: string, @Body() body: SecretariaDto, @CurrentUser() user: JwtPayload) {
    return this.adminService.updateSecretaria(id, body, user);
  }

  @RequirePermissions('secretarias.gerenciar')
  @Delete('secretarias/:id')
  deleteSecretaria(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.adminService.deleteSecretaria(id, user);
  }

  @RequirePermissions('unidades.gerenciar')
  @Get('unidades')
  listUnidades() {
    return this.adminService.listUnidades();
  }

  @RequirePermissions('unidades.gerenciar')
  @Post('unidades')
  createUnidade(@Body() body: UnidadeDto, @CurrentUser() user: JwtPayload) {
    return this.adminService.createUnidade(body, user);
  }

  @RequirePermissions('unidades.gerenciar')
  @Put('unidades/:id')
  updateUnidade(@Param('id') id: string, @Body() body: UnidadeDto, @CurrentUser() user: JwtPayload) {
    return this.adminService.updateUnidade(id, body, user);
  }

  @RequirePermissions('unidades.gerenciar')
  @Delete('unidades/:id')
  deleteUnidade(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.adminService.deleteUnidade(id, user);
  }

  @RequireAnyPermissions('usuarios.gerenciar', 'permissoes.gerenciar')
  @Get('usuarios')
  listUsuarios() {
    return this.adminService.listUsuarios();
  }

  @RequireAnyPermissions('usuarios.gerenciar', 'permissoes.gerenciar')
  @Get('usuarios/:id/matriz')
  getMatrizUsuario(@Param('id') id: string) {
    return this.adminPermissionsService.getMatrizUsuario(id);
  }

  @RequireAnyPermissions('usuarios.gerenciar', 'permissoes.gerenciar')
  @Put('usuarios/:id/matriz')
  saveMatrizUsuario(@Param('id') id: string, @Body() body: PerfilMatrizDto, @CurrentUser() user: JwtPayload) {
    return this.adminPermissionsService.saveMatrizUsuario(id, body.chaves, user);
  }

  @RequirePermissions('usuarios.gerenciar')
  @Post('usuarios')
  createUsuario(@Body() body: UsuarioDto, @CurrentUser() user: JwtPayload) {
    return this.adminService.createUsuario(body, user);
  }

  @RequirePermissions('usuarios.gerenciar')
  @Put('usuarios/:id')
  updateUsuario(@Param('id') id: string, @Body() body: UsuarioDto, @CurrentUser() user: JwtPayload) {
    return this.adminService.updateUsuario(id, body, user);
  }

  @RequirePermissions('usuarios.gerenciar')
  @Delete('usuarios/:id')
  deleteUsuario(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.adminService.deleteUsuario(id, user);
  }

  @RequirePermissions('usuarios.gerenciar')
  @Get('perfis')
  listPerfis() {
    return this.adminService.listPerfis();
  }

  @RequireAnyPermissions('usuarios.gerenciar', 'permissoes.gerenciar')
  @Get('permissoes/catalogo')
  getPermissoesCatalogo() {
    return this.adminPermissionsService.getCatalogo();
  }

  @RequireAnyPermissions('usuarios.gerenciar', 'permissoes.gerenciar')
  @Get('perfis/configuraveis')
  listPerfisConfiguraveis() {
    return this.adminPermissionsService.listPerfisConfiguraveis();
  }

  @RequireAnyPermissions('usuarios.gerenciar', 'permissoes.gerenciar')
  @Get('perfis/:id/matriz')
  getMatrizPerfil(@Param('id') id: string) {
    return this.adminPermissionsService.getMatrizPerfil(id);
  }

  @RequireAnyPermissions('usuarios.gerenciar', 'permissoes.gerenciar')
  @Put('perfis/:id/matriz')
  saveMatrizPerfil(@Param('id') id: string, @Body() body: PerfilMatrizDto, @CurrentUser() user: JwtPayload) {
    return this.adminPermissionsService.saveMatrizPerfil(id, body.chaves, user);
  }

  @RequireAnyPermissions('usuarios.gerenciar', 'permissoes.gerenciar')
  @Post('perfis')
  createPerfil(@Body() body: PerfilCreateDto, @CurrentUser() user: JwtPayload) {
    return this.adminPermissionsService.createPerfil(body, user);
  }

  @RequireAnyPermissions('usuarios.gerenciar', 'permissoes.gerenciar')
  @Put('perfis/:id')
  updatePerfil(@Param('id') id: string, @Body() body: PerfilUpdateDto, @CurrentUser() user: JwtPayload) {
    return this.adminPermissionsService.updatePerfil(id, body, user);
  }

  @RequireAnyPermissions('usuarios.gerenciar', 'permissoes.gerenciar')
  @Put('perfis/:id/ativo')
  setPerfilAtivo(@Param('id') id: string, @Body() body: PerfilAtivoDto, @CurrentUser() user: JwtPayload) {
    return this.adminPermissionsService.setPerfilAtivo(id, body, user);
  }

  @RequirePermissions('usuarios.gerenciar')
  @Get('equipes')
  listEquipes() {
    return this.adminService.listEquipes();
  }

  @RequirePermissions('usuarios.gerenciar')
  @Post('equipes')
  createEquipe(@Body() body: EquipeDto, @CurrentUser() user: JwtPayload) {
    return this.adminService.createEquipe(body, user);
  }

  @RequirePermissions('usuarios.gerenciar')
  @Put('equipes/:id')
  updateEquipe(@Param('id') id: string, @Body() body: EquipeDto, @CurrentUser() user: JwtPayload) {
    return this.adminService.updateEquipe(id, body, user);
  }

  @RequirePermissions('usuarios.gerenciar')
  @Delete('equipes/:id')
  deleteEquipe(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.adminService.deleteEquipe(id, user);
  }

  @RequirePermissions('usuarios.gerenciar')
  @Get('tipos-chamado')
  listTiposChamado() {
    return this.adminService.listTiposChamado();
  }

  @RequirePermissions('usuarios.gerenciar')
  @Post('tipos-chamado')
  createTipoChamado(@Body() body: TipoChamadoDto, @CurrentUser() user: JwtPayload) {
    return this.adminService.createTipoChamado(body, user);
  }

  @RequirePermissions('usuarios.gerenciar')
  @Put('tipos-chamado/:id')
  updateTipoChamado(@Param('id') id: string, @Body() body: TipoChamadoDto, @CurrentUser() user: JwtPayload) {
    return this.adminService.updateTipoChamado(id, body, user);
  }

  @RequirePermissions('usuarios.gerenciar')
  @Delete('tipos-chamado/:id')
  deleteTipoChamado(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.adminService.deleteTipoChamado(id, user);
  }

  @RequireAnyPermissions('usuarios.gerenciar', 'unidades.gerenciar', 'checklists.gerenciar')
  @Get('tipos-proprio')
  listTiposProprio() {
    return this.adminService.listTiposProprio();
  }

  @RequirePermissions('usuarios.gerenciar')
  @Post('tipos-proprio')
  createTipoProprio(@Body() body: TipoProprioDto, @CurrentUser() user: JwtPayload) {
    return this.adminService.createTipoProprio(body, user);
  }

  @RequirePermissions('usuarios.gerenciar')
  @Put('tipos-proprio/:id')
  updateTipoProprio(@Param('id') id: string, @Body() body: TipoProprioDto, @CurrentUser() user: JwtPayload) {
    return this.adminService.updateTipoProprio(id, body, user);
  }

  @RequirePermissions('usuarios.gerenciar')
  @Delete('tipos-proprio/:id')
  deleteTipoProprio(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.adminService.deleteTipoProprio(id, user);
  }

  @RequirePermissions('checklists.gerenciar')
  @Get('categorias-vistoria')
  listCategoriasVistoria() {
    return this.adminService.listCategoriasVistoria();
  }

  @RequirePermissions('checklists.gerenciar')
  @Post('categorias-vistoria')
  createCategoriaVistoria(@Body() body: CategoriaVistoriaDto, @CurrentUser() user: JwtPayload) {
    return this.adminService.createCategoriaVistoria(body, user);
  }

  @RequirePermissions('checklists.gerenciar')
  @Put('categorias-vistoria/:id')
  updateCategoriaVistoria(@Param('id') id: string, @Body() body: CategoriaVistoriaDto, @CurrentUser() user: JwtPayload) {
    return this.adminService.updateCategoriaVistoria(id, body, user);
  }

  @RequirePermissions('checklists.gerenciar')
  @Delete('categorias-vistoria/:id')
  deleteCategoriaVistoria(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.adminService.deleteCategoriaVistoria(id, user);
  }

  @RequirePermissions('usuarios.gerenciar')
  @Get('cargos')
  listCargos() {
    return this.adminService.listCargos();
  }

  @RequirePermissions('usuarios.gerenciar')
  @Post('cargos')
  createCargo(@Body() body: CargoDto, @CurrentUser() user: JwtPayload) {
    return this.adminService.createCargo(body, user);
  }

  @RequirePermissions('usuarios.gerenciar')
  @Put('cargos/:id')
  updateCargo(@Param('id') id: string, @Body() body: CargoDto, @CurrentUser() user: JwtPayload) {
    return this.adminService.updateCargo(id, body, user);
  }

  @RequirePermissions('usuarios.gerenciar')
  @Delete('cargos/:id')
  deleteCargo(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.adminService.deleteCargo(id, user);
  }
}
