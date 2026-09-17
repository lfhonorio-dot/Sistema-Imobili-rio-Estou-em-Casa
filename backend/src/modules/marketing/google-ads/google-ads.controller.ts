// Controller Google Ads
import {
  Controller, Get, Post, Delete, Body, Headers, HttpCode, HttpStatus, UseGuards, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { GoogleAdsService } from './google-ads.service';
import { SaveGoogleIntegrationDto, OfflineConversionDto } from './google-ads.dto';
import { Public } from '../../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../../common/guards/workspace.guard';

@Controller('marketing/google')
export class GoogleAdsController {
  constructor(private readonly service: GoogleAdsService) {}

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Get('integration')
  getIntegration(@Headers('x-workspace-id') workspaceId: string) {
    return this.service.getIntegration(workspaceId);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Post('integration')
  saveIntegration(@Headers('x-workspace-id') workspaceId: string, @Body() dto: SaveGoogleIntegrationDto) {
    return this.service.saveIntegration(workspaceId, dto);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Delete('integration')
  @HttpCode(HttpStatus.OK)
  deleteIntegration(@Headers('x-workspace-id') workspaceId: string) {
    return this.service.deleteIntegration(workspaceId);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Get('campaigns')
  getCampaigns(@Headers('x-workspace-id') workspaceId: string) {
    return this.service.getCampaigns(workspaceId);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Post('campaigns/sync')
  @HttpCode(HttpStatus.OK)
  syncCampaigns(@Headers('x-workspace-id') workspaceId: string) {
    return this.service.syncCampaigns(workspaceId);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Post('offline-conversion')
  @HttpCode(HttpStatus.OK)
  sendOfflineConversion(@Headers('x-workspace-id') workspaceId: string, @Body() dto: OfflineConversionDto) {
    return this.service.sendOfflineConversion(workspaceId, dto);
  }

  // Chave a colar na configuração de webhook do Google Ads (campo google_key)
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Get('webhook-key')
  async getWebhookKey(@Headers('x-workspace-id') workspaceId: string) {
    return { webhookKey: await this.service.getWebhookKey(workspaceId) };
  }

  // Webhook público — validado pela chave própria do workspace (google_key no
  // corpo), já que o Lead Form do Google não assina a requisição por HMAC.
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async processWebhook(@Body() body: Record<string, unknown> & { google_key?: string }) {
    const workspaceId = await this.service.resolveWorkspaceIdByWebhookKey(body.google_key);
    if (!workspaceId) {
      throw new ForbiddenException('Chave de webhook inválida ou ausente');
    }
    return this.service.processLeadWebhook(workspaceId, body);
  }
}
