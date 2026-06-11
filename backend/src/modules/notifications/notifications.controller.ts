import {
  Controller, Get, Post, Patch, Body, Headers, UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { UpdateNotificationPreferenceDto, CreateInAppNotificationDto } from './notifications.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

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

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Post('send')
  createNotification(
    @Headers('x-workspace-id') workspaceId: string,
    @Body() dto: CreateInAppNotificationDto,
  ) {
    return this.service.createNotification(workspaceId, dto);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Get('stats')
  getStats(@Headers('x-workspace-id') workspaceId: string) {
    return this.service.getStats(workspaceId);
  }
}
