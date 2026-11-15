import {
  Controller, Get, Post, Patch, Body, Headers, UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { EmailSwitchDto, UpdateNotificationPreferenceDto } from './notifications.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Access, ALL, STAFF, FINANCE_AREA, FINANCE_CONFIG, MANAGEMENT, ADMIN_ONLY } from '../../common/access/access';

@Access(...ALL)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Get('preferences')
  getPreferences(
    @Headers('x-workspace-id') workspaceId: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.service.getPreferences(workspaceId, user.sub);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Patch('preferences')
  updatePreference(
    @Headers('x-workspace-id') workspaceId: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: UpdateNotificationPreferenceDto,
  ) {
    return this.service.updatePreference(workspaceId, user.sub, dto);
  }

  // Fase 7: a rota POST /notifications/send (que fingia enviar) foi removida;
  // os avisos reais são gerados pelas regras em hub/notifications.

  // Fase 7: chave geral "receber avisos por e-mail" do próprio usuário
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Get('email-switch')
  getEmailSwitch(@Headers('x-workspace-id') workspaceId: string, @CurrentUser() user: { sub: string }) {
    return this.service.getEmailSwitch(workspaceId, user.sub);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Patch('email-switch')
  setEmailSwitch(@Headers('x-workspace-id') workspaceId: string, @CurrentUser() user: { sub: string }, @Body() dto: EmailSwitchDto) {
    return this.service.setEmailSwitch(workspaceId, user.sub, dto.enabled);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Get('stats')
  getStats(@Headers('x-workspace-id') workspaceId: string) {
    return this.service.getStats(workspaceId);
  }
}
