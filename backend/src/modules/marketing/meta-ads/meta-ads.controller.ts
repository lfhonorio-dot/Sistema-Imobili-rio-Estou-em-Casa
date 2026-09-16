// Controller Meta Ads
import {
  Controller, Get, Post, Delete, Body, Headers, HttpCode, HttpStatus, UseGuards, Query, Req, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
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

  // Handshake GET exigido pelo Meta ao cadastrar a URL do webhook
  @Public()
  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    try {
      return this.service.verifyHandshake(mode, token, challenge);
    } catch {
      throw new ForbiddenException('Verificação de webhook falhou');
    }
  }

  // Webhook público — validado por assinatura HMAC-SHA256 (X-Hub-Signature-256),
  // não por autenticação de usuário (o Meta não tem um usuário/JWT nosso).
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async processWebhook(
    @Body() body: Record<string, unknown>,
    @Headers('x-hub-signature-256') signature: string,
    @Req() req: Request & { rawBody?: Buffer },
  ) {
    if (!this.service.verifySignature(req.rawBody ?? Buffer.from(JSON.stringify(body)), signature)) {
      throw new ForbiddenException('Assinatura do webhook inválida');
    }

    const entry = (body.entry as Record<string, unknown>[])?.[0];
    const pageId = entry?.id as string | undefined;
    const workspaceId = await this.service.resolveWorkspaceIdByPageId(pageId);
    if (!workspaceId) {
      // Sem integração cadastrada para essa página — não há workspace pra atribuir o lead.
      throw new BadRequestException('Página do Meta não está vinculada a nenhum workspace');
    }

    return this.service.processLeadWebhook(workspaceId, body);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Post('capi')
  sendCapiEvent(@Headers('x-workspace-id') workspaceId: string, @Body() dto: CapiEventDto) {
    return this.service.sendCapiEvent(workspaceId, dto);
  }
}
