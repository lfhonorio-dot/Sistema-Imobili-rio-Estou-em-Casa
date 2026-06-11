// Controller de Portais Imobiliários
import {
  Controller, Get, Post, Delete, Body, Param, Query, Headers, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { PortalsService } from './portals.service';
import { SavePortalIntegrationDto, PublishPropertyDto, PortalType } from './portals.dto';
import { Public } from '../../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../../common/guards/workspace.guard';

@Controller('marketing/portals')
export class PortalsController {
  constructor(private readonly service: PortalsService) {}

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Get('integrations')
  getIntegrations(@Headers('x-workspace-id') workspaceId: string) {
    return this.service.getIntegrations(workspaceId);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Post('integrations')
  saveIntegration(@Headers('x-workspace-id') workspaceId: string, @Body() dto: SavePortalIntegrationDto) {
    return this.service.saveIntegration(workspaceId, dto);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Delete('integrations/:portal')
  @HttpCode(HttpStatus.OK)
  deleteIntegration(@Headers('x-workspace-id') workspaceId: string, @Param('portal') portal: PortalType) {
    return this.service.deleteIntegration(workspaceId, portal);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Post('publish')
  publishProperty(@Headers('x-workspace-id') workspaceId: string, @Body() dto: PublishPropertyDto) {
    return this.service.publishProperty(workspaceId, dto);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Post('unpublish/:propertyId/:portal')
  @HttpCode(HttpStatus.OK)
  unpublishProperty(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('propertyId') propertyId: string,
    @Param('portal') portal: PortalType,
  ) {
    return this.service.unpublishProperty(workspaceId, propertyId, portal);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Get('publications')
  getPublications(@Headers('x-workspace-id') workspaceId: string, @Query('propertyId') propertyId?: string) {
    return this.service.getPublications(workspaceId, propertyId);
  }

  // Webhook público — sem guards de autenticação
  @Public()
  @Post('webhook/:portal')
  @HttpCode(HttpStatus.OK)
  processWebhook(@Param('portal') portal: string, @Body() body: Record<string, unknown>) {
    return { received: true, portal };
  }
}
