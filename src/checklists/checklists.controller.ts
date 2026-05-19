import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user';
import { JwtPayload } from '../auth/jwt';
import { RequirePermissions } from '../auth/permissions';
import { PermissionsGuard } from '../auth/permissions.guard';
import { ChecklistDto, ChecklistVersionDto } from './checklists.dto';
import { ChecklistsService } from './checklists.service';

@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermissions('checklists.gerenciar')
@Controller('checklists')
export class ChecklistsController {
  constructor(private readonly checklistsService: ChecklistsService) {}

  @Get()
  listChecklists() {
    return this.checklistsService.listChecklists();
  }

  @Get(':id')
  getChecklist(@Param('id') id: string) {
    return this.checklistsService.getChecklist(id);
  }

  @Post()
  createChecklist(@Body() body: ChecklistDto, @CurrentUser() user: JwtPayload) {
    return this.checklistsService.createChecklist(body, user);
  }

  @Put(':id')
  updateChecklist(@Param('id') id: string, @Body() body: ChecklistDto, @CurrentUser() user: JwtPayload) {
    return this.checklistsService.updateChecklist(id, body, user);
  }

  @Delete(':id')
  deactivateChecklist(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.checklistsService.deactivateChecklist(id, user);
  }

  @Post(':id/versions')
  createVersion(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.checklistsService.createVersion(id, user);
  }

  @Put('versions/:versionId')
  updateVersion(@Param('versionId') versionId: string, @Body() body: ChecklistVersionDto, @CurrentUser() user: JwtPayload) {
    return this.checklistsService.updateVersion(versionId, body, user);
  }

  @Post('versions/:versionId/publish')
  publishVersion(@Param('versionId') versionId: string, @CurrentUser() user: JwtPayload) {
    return this.checklistsService.publishVersion(versionId, user);
  }
}
