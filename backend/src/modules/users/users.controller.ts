// Controller de usuários
// Perfil, convites e administração de membros

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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import {
  UpdateProfileDto,
  InviteUserDto,
  UpdateUserRoleDto,
  ChangePasswordDto,
} from './users.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // GET /users/profile
  @Get('profile')
  @ApiOperation({ summary: 'Obter perfil do usuário autenticado' })
  getProfile(@CurrentUser() user: JwtPayload) {
    return this.usersService.getProfile(user.sub);
  }

  // PUT /users/profile
  @Put('profile')
  @ApiOperation({ summary: 'Atualizar perfil do usuário' })
  updateProfile(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  // PUT /users/password
  @Put('password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Alterar senha do usuário autenticado' })
  async changePassword(@CurrentUser() user: JwtPayload, @Body() dto: ChangePasswordDto) {
    await this.usersService.changePassword(user.sub, dto);
    return { message: 'Senha alterada com sucesso. Você foi desconectado dos outros dispositivos.' };
  }

  // GET /users/workspace/members
  @Get('workspace/members')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @RequirePermissions('users:read')
  @ApiHeader({ name: 'X-Workspace-Id', required: true })
  @ApiOperation({ summary: 'Listar membros do workspace' })
  listMembers(@Headers('x-workspace-id') workspaceId: string) {
    return this.usersService.listWorkspaceMembers(workspaceId);
  }

  // POST /users/workspace/invite
  @Post('workspace/invite')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @RequirePermissions('users:write')
  @ApiHeader({ name: 'X-Workspace-Id', required: true })
  @ApiOperation({ summary: 'Convidar usuário ao workspace' })
  inviteUser(
    @Headers('x-workspace-id') workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: InviteUserDto,
  ) {
    return this.usersService.inviteUser(workspaceId, user.sub, dto);
  }

  // PUT /users/workspace/members/:userId/role
  @Put('workspace/members/:userId/role')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @RequirePermissions('users:write')
  @ApiHeader({ name: 'X-Workspace-Id', required: true })
  @ApiOperation({ summary: 'Atualizar papel de membro no workspace' })
  updateMemberRole(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.usersService.updateMemberRole(workspaceId, targetUserId, user.sub, dto);
  }

  // DELETE /users/workspace/members/:userId
  @Delete('workspace/members/:userId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WorkspaceGuard, RolesGuard)
  @RequirePermissions('users:delete')
  @ApiHeader({ name: 'X-Workspace-Id', required: true })
  @ApiOperation({ summary: 'Remover membro do workspace' })
  async removeMember(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.usersService.removeMember(workspaceId, targetUserId, user.sub);
    return { message: 'Membro removido do workspace.' };
  }
}
