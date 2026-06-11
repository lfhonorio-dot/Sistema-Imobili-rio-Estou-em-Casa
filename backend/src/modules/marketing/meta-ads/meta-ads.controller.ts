// Controller Meta Ads
import {
  Controller, Get, Post, Delete, Body, Headers, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { MetaAdsService } from './meta-ads.service';
import { SaveMetaIntegrationDto, FieldMappingDto, CapiEventDto } from './meta-ads.dto';
import { Public } from '../../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../../common/guards/workspace.guard';

@Controller('marketing/meta')
export class MetaAdsController {
  constructor(private readonly service: MetaAdsService) {}

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Get('integration')
  getIntegration(@Headers('x-workspace-id') workspaceId: string) {
    return this.service.getIntegration(workspaceId);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Post('integration')
  saveIntegration(@Headers('x-workspace-id') workspaceId: string, @Body() dto: SaveMetaIntegrationDto) {
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
  @Get('field-mappings')
  getFieldMappings(@Headers('x-workspace-id') workspaceId: string) {
    return this.service.getFieldMappings(workspaceId);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Post('field-mappings')
  @HttpCode(HttpStatus.OK)
  saveFieldMappings(@Headers('x-workspace-id') workspaceId: string, @Body() dto: FieldMappingDto) {
    return this.service.saveFieldMappings(workspaceId, dto);
  }

  // Webhook público — sem guards de autenticação
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  processWebhook(@Body() body: Record<string, unknown>) {
    return { received: true };
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Post('capi')
  sendCapiEvent(@Headers('x-workspace-id') workspaceId: string, @Body() dto: CapiEventDto) {
    return this.service.sendCapiEvent(workspaceId, dto);
  }
}
