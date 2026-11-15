// Controller de Notificações
import {
  Controller, Get, Patch, Post, Param, Query,
  Headers, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { NotificationRulesService } from './notification-rules.service';
import { NotificationQueryDto } from './notifications.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../../common/guards/workspace.guard';
import { CurrentUser, JwtPayload } from '../../../common/decorators/current-user.decorator';
import { Access, ALL, STAFF, FINANCE_AREA, FINANCE_CONFIG, MANAGEMENT, ADMIN_ONLY } from '../../../common/access/access';

@ApiTags('notifications')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Workspace-Id', required: true })
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Access(...ALL)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService, private readonly rules: NotificationRulesService) {}

  // Fase 7: roda agora as regras de aviso desta imobiliária (a rotina roda sozinha a cada 5 min)
  @Access(...MANAGEMENT)
  @Post('run-rules')
  @HttpCode(HttpStatus.OK)
  async runRules(@Headers('x-workspace-id') workspaceId: string) {
    return { created: await this.rules.runFor(workspaceId) };
  }

  @Get()
  findAll(
    @Headers('x-workspace-id') workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: NotificationQueryDto,
  ) {
    return this.service.findAll(workspaceId, user.sub, query);
  }

  @Get('unread-count')
  unreadCount(
    @Headers('x-workspace-id') workspaceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.getUnreadCount(workspaceId, user.sub);
  }

  @Patch(':id/read')
  markRead(
    @Headers('x-workspace-id') workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.service.markRead(workspaceId, user.sub, id);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  markAllRead(
    @Headers('x-workspace-id') workspaceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.markAllRead(workspaceId, user.sub);
  }
}
