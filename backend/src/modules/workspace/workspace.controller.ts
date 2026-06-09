// Controller do workspace
// Configurações e gerenciamento de papéis

import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { WorkspaceService } from './workspace.service';
import { UpdateWorkspaceDto, CreateRoleDto, UpdateRoleDto } from './workspace.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/roles.decorator';

@ApiTags('workspace')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Workspace-Id', required: true })
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Controller('workspace')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  // GET /workspace
  @Get()
  @ApiOperation({ summary: 'Dados do workspace atual' })
  getWorkspace(@Headers('x-workspace-id') workspaceId: string) {
    return this.workspaceService.getWorkspace(workspaceId);
  }

  // PUT /workspace
  @Put()
  @UseGuards(RolesGuard)
  @RequirePermissions('workspace:write')
  @ApiOperation({ summary: 'Atualizar configurações do workspace' })
  updateWorkspace(
    @Headers('x-workspace-id') workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspaceService.updateWorkspace(workspaceId, user.sub, dto);
  }

  // GET /workspace/roles
  @Get('roles')
  @UseGuards(RolesGuard)
  @RequirePermissions('roles:read')
  @ApiOperation({ summary: 'Listar papéis do workspace' })
  listRoles(@Headers('x-workspace-id') workspaceId: string) {
    return this.workspaceService.listRoles(workspaceId);
  }

  // POST /workspace/roles
  @Post('roles')
  @UseGuards(RolesGuard)
  @RequirePermissions('roles:write')
  @ApiOperation({ summary: 'Criar novo papel no workspace' })
  createRole(
    @Headers('x-workspace-id') workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateRoleDto,
  ) {
    return this.workspaceService.createRole(workspaceId, user.sub, dto);
  }

  // PUT /workspace/roles/:roleId
  @Put('roles/:roleId')
  @UseGuards(RolesGuard)
  @RequirePermissions('roles:write')
  @ApiOperation({ summary: 'Atualizar papel existente' })
  updateRole(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('roleId') roleId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.workspaceService.updateRole(workspaceId, roleId, user.sub, dto);
  }

  // DELETE /workspace/roles/:roleId
  @Delete('roles/:roleId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @RequirePermissions('roles:write')
  @ApiOperation({ summary: 'Excluir papel do workspace' })
  async deleteRole(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('roleId') roleId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.workspaceService.deleteRole(workspaceId, roleId, user.sub);
    return { message: 'Papel excluído com sucesso.' };
  }
}
