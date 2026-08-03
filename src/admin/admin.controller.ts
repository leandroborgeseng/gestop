import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import { JwtPayload } from '../auth/jwt';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequireAnyPermissions } from '../auth/permissions';
import { adminTabPermissionKeys } from '../domain/admin-permissions';
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

  @RequireAnyPermissions(...adminTabPermissionKeys('secretarias', 'visualizar'))
  @Get('secretarias')
  listSecretarias(@CurrentUser() user: JwtPayload) {
    return this.adminService.listSecretarias(user);
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('secretarias', 'inserir'))
  @Post('secretarias')
  createSecretaria(@Body() body: SecretariaDto, @CurrentUser() user: JwtPayload) {
    return this.adminService.createSecretaria(body, user);
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('secretarias', 'alterar'))
  @Put('secretarias/:id')
  updateSecretaria(@Param('id') id: string, @Body() body: SecretariaDto, @CurrentUser() user: JwtPayload) {
    return this.adminService.updateSecretaria(id, body, user);
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('secretarias', 'excluir'))
  @Delete('secretarias/:id')
  deleteSecretaria(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.adminService.deleteSecretaria(id, user);
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('proprios', 'visualizar'))
  @Get('unidades')
  listUnidades(@CurrentUser() user: JwtPayload) {
    return this.adminService.listUnidades(user);
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('proprios', 'inserir'))
  @Post('unidades')
  createUnidade(@Body() body: UnidadeDto, @CurrentUser() user: JwtPayload) {
    return this.adminService.createUnidade(body, user);
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('proprios', 'alterar'))
  @Put('unidades/:id')
  updateUnidade(@Param('id') id: string, @Body() body: UnidadeDto, @CurrentUser() user: JwtPayload) {
    return this.adminService.updateUnidade(id, body, user);
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('proprios', 'excluir'))
  @Delete('unidades/:id')
  deleteUnidade(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.adminService.deleteUnidade(id, user);
  }

  @RequireAnyPermissions(
    ...adminTabPermissionKeys('usuarios', 'visualizar'),
    ...adminTabPermissionKeys('permissoes', 'visualizar'),
  )
  @Get('usuarios')
  listUsuarios(@CurrentUser() user: JwtPayload) {
    return this.adminService.listUsuarios(user);
  }

  @RequireAnyPermissions(
    ...adminTabPermissionKeys('usuarios', 'visualizar'),
    ...adminTabPermissionKeys('permissoes', 'visualizar'),
  )
  @Get('usuarios/:id/matriz')
  getMatrizUsuario(@Param('id') id: string) {
    return this.adminPermissionsService.getMatrizUsuario(id);
  }

  @RequireAnyPermissions(
    ...adminTabPermissionKeys('usuarios', 'alterar'),
    ...adminTabPermissionKeys('permissoes', 'alterar'),
  )
  @Put('usuarios/:id/matriz')
  saveMatrizUsuario(@Param('id') id: string, @Body() body: PerfilMatrizDto, @CurrentUser() user: JwtPayload) {
    return this.adminPermissionsService.saveMatrizUsuario(id, body.chaves, user);
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('usuarios', 'inserir'))
  @Post('usuarios')
  createUsuario(@Body() body: UsuarioDto, @CurrentUser() user: JwtPayload) {
    return this.adminService.createUsuario(body, user);
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('usuarios', 'alterar'))
  @Put('usuarios/:id')
  updateUsuario(@Param('id') id: string, @Body() body: UsuarioDto, @CurrentUser() user: JwtPayload) {
    return this.adminService.updateUsuario(id, body, user);
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('usuarios', 'excluir'))
  @Delete('usuarios/:id')
  deleteUsuario(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.adminService.deleteUsuario(id, user);
  }

  @RequireAnyPermissions(
    ...adminTabPermissionKeys('usuarios', 'visualizar'),
    ...adminTabPermissionKeys('usuarios', 'inserir'),
    ...adminTabPermissionKeys('usuarios', 'alterar'),
  )
  @Get('perfis')
  listPerfis() {
    return this.adminService.listPerfis();
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('permissoes', 'visualizar'))
  @Get('permissoes/catalogo')
  getPermissoesCatalogo() {
    return this.adminPermissionsService.getCatalogo();
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('permissoes', 'visualizar'))
  @Get('perfis/configuraveis')
  listPerfisConfiguraveis() {
    return this.adminPermissionsService.listPerfisConfiguraveis();
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('permissoes', 'visualizar'))
  @Get('perfis/:id/matriz')
  getMatrizPerfil(@Param('id') id: string) {
    return this.adminPermissionsService.getMatrizPerfil(id);
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('permissoes', 'alterar'))
  @Put('perfis/:id/matriz')
  saveMatrizPerfil(@Param('id') id: string, @Body() body: PerfilMatrizDto, @CurrentUser() user: JwtPayload) {
    return this.adminPermissionsService.saveMatrizPerfil(id, body.chaves, user);
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('permissoes', 'inserir'))
  @Post('perfis')
  createPerfil(@Body() body: PerfilCreateDto, @CurrentUser() user: JwtPayload) {
    return this.adminPermissionsService.createPerfil(body, user);
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('permissoes', 'alterar'))
  @Put('perfis/:id')
  updatePerfil(@Param('id') id: string, @Body() body: PerfilUpdateDto, @CurrentUser() user: JwtPayload) {
    return this.adminPermissionsService.updatePerfil(id, body, user);
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('permissoes', 'alterar'))
  @Put('perfis/:id/ativo')
  setPerfilAtivo(@Param('id') id: string, @Body() body: PerfilAtivoDto, @CurrentUser() user: JwtPayload) {
    return this.adminPermissionsService.setPerfilAtivo(id, body, user);
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('equipes', 'visualizar'))
  @Get('equipes')
  listEquipes(@CurrentUser() user: JwtPayload) {
    return this.adminService.listEquipes(user);
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('equipes', 'inserir'))
  @Post('equipes')
  createEquipe(@Body() body: EquipeDto, @CurrentUser() user: JwtPayload) {
    return this.adminService.createEquipe(body, user);
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('equipes', 'alterar'))
  @Put('equipes/:id')
  updateEquipe(@Param('id') id: string, @Body() body: EquipeDto, @CurrentUser() user: JwtPayload) {
    return this.adminService.updateEquipe(id, body, user);
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('equipes', 'excluir'))
  @Delete('equipes/:id')
  deleteEquipe(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.adminService.deleteEquipe(id, user);
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('tipos_chamado', 'visualizar'))
  @Get('tipos-chamado')
  listTiposChamado() {
    return this.adminService.listTiposChamado();
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('tipos_chamado', 'inserir'))
  @Post('tipos-chamado')
  createTipoChamado(@Body() body: TipoChamadoDto, @CurrentUser() user: JwtPayload) {
    return this.adminService.createTipoChamado(body, user);
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('tipos_chamado', 'alterar'))
  @Put('tipos-chamado/:id')
  updateTipoChamado(@Param('id') id: string, @Body() body: TipoChamadoDto, @CurrentUser() user: JwtPayload) {
    return this.adminService.updateTipoChamado(id, body, user);
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('tipos_chamado', 'excluir'))
  @Delete('tipos-chamado/:id')
  deleteTipoChamado(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.adminService.deleteTipoChamado(id, user);
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('tipos_proprio', 'visualizar'))
  @Get('tipos-proprio')
  listTiposProprio() {
    return this.adminService.listTiposProprio();
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('tipos_proprio', 'inserir'))
  @Post('tipos-proprio')
  createTipoProprio(@Body() body: TipoProprioDto, @CurrentUser() user: JwtPayload) {
    return this.adminService.createTipoProprio(body, user);
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('tipos_proprio', 'alterar'))
  @Put('tipos-proprio/:id')
  updateTipoProprio(@Param('id') id: string, @Body() body: TipoProprioDto, @CurrentUser() user: JwtPayload) {
    return this.adminService.updateTipoProprio(id, body, user);
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('tipos_proprio', 'excluir'))
  @Delete('tipos-proprio/:id')
  deleteTipoProprio(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.adminService.deleteTipoProprio(id, user);
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('categorias_vistoria', 'visualizar'))
  @Get('categorias-vistoria')
  listCategoriasVistoria() {
    return this.adminService.listCategoriasVistoria();
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('categorias_vistoria', 'inserir'))
  @Post('categorias-vistoria')
  createCategoriaVistoria(@Body() body: CategoriaVistoriaDto, @CurrentUser() user: JwtPayload) {
    return this.adminService.createCategoriaVistoria(body, user);
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('categorias_vistoria', 'alterar'))
  @Put('categorias-vistoria/:id')
  updateCategoriaVistoria(
    @Param('id') id: string,
    @Body() body: CategoriaVistoriaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.adminService.updateCategoriaVistoria(id, body, user);
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('categorias_vistoria', 'excluir'))
  @Delete('categorias-vistoria/:id')
  deleteCategoriaVistoria(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.adminService.deleteCategoriaVistoria(id, user);
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('cargos', 'visualizar'))
  @Get('cargos')
  listCargos() {
    return this.adminService.listCargos();
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('cargos', 'inserir'))
  @Post('cargos')
  createCargo(@Body() body: CargoDto, @CurrentUser() user: JwtPayload) {
    return this.adminService.createCargo(body, user);
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('cargos', 'alterar'))
  @Put('cargos/:id')
  updateCargo(@Param('id') id: string, @Body() body: CargoDto, @CurrentUser() user: JwtPayload) {
    return this.adminService.updateCargo(id, body, user);
  }

  @RequireAnyPermissions(...adminTabPermissionKeys('cargos', 'excluir'))
  @Delete('cargos/:id')
  deleteCargo(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.adminService.deleteCargo(id, user);
  }
}
