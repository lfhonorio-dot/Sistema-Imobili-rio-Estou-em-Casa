import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, Headers, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { CreateApiKeyDto, CreateWebhookDto, UpdateWebhookDto } from './integrations.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';

@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly service: IntegrationsService) {}

  // ── API Keys ──────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Get('api-keys')
  listApiKeys(@Headers('x-workspace-id') wid: string) {
    return this.service.listApiKeys(wid);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Post('api-keys')
  createApiKey(@Headers('x-workspace-id') wid: string, @Body() dto: CreateApiKeyDto) {
    return this.service.createApiKey(wid, dto);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Delete('api-keys/:id')
  @HttpCode(HttpStatus.OK)
  revokeApiKey(@Headers('x-workspace-id') wid: string, @Param('id') id: string) {
    return this.service.revokeApiKey(wid, id);
  }

  // ── Webhooks ──────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Get('webhooks')
  listWebhooks(@Headers('x-workspace-id') wid: string) {
    return this.service.listWebhooks(wid);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Post('webhooks')
  createWebhook(@Headers('x-workspace-id') wid: string, @Body() dto: CreateWebhookDto) {
    return this.service.createWebhook(wid, dto);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Patch('webhooks/:id')
  updateWebhook(@Headers('x-workspace-id') wid: string, @Param('id') id: string, @Body() dto: UpdateWebhookDto) {
    return this.service.updateWebhook(wid, id, dto);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Delete('webhooks/:id')
  @HttpCode(HttpStatus.OK)
  deleteWebhook(@Headers('x-workspace-id') wid: string, @Param('id') id: string) {
    return this.service.deleteWebhook(wid, id);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Post('webhooks/:id/test')
  @HttpCode(HttpStatus.OK)
  testWebhook(@Headers('x-workspace-id') wid: string, @Param('id') id: string) {
    return this.service.testWebhook(wid, id);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Get('webhooks/:id/logs')
  getWebhookLogs(
    @Headers('x-workspace-id') wid: string,
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getWebhookLogs(wid, id, page ? +page : 1, limit ? +limit : 20);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Get('events')
  getAvailableEvents() {
    return this.service.getAvailableEvents();
  }
}
