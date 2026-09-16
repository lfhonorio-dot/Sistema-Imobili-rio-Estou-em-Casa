import {
  Controller, Get, Post, Body, Param, Headers, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { SetPlatformConfigDto, SetFeatureFlagDto, SetWorkspacePlanDto, CompleteOnboardingStepDto } from './admin.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { Public } from '../../common/decorators/public.decorator';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Public()
  @Get('health')
  getPlatformHealth() {
    return this.adminService.getPlatformHealth();
  }

  // Cross-tenant: estatísticas de TODOS os workspaces. Restrito a admin de plataforma.
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Get('stats')
  getPlatformStats() {
    return this.adminService.getPlatformStats();
  }

  // Cross-tenant: configs globais afetam todos os workspaces. Restrito a admin de plataforma.
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Get('platform-configs')
  getPlatformConfigs() {
    return this.adminService.getPlatformConfigs();
  }

  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Post('platform-configs')
  setPlatformConfig(@Body() dto: SetPlatformConfigDto) {
    return this.adminService.setPlatformConfig(dto);
  }

  // Cross-tenant: feature flags globais. Restrito a admin de plataforma.
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Get('feature-flags')
  getFeatureFlags() {
    return this.adminService.getFeatureFlags();
  }

  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Post('feature-flags')
  @HttpCode(HttpStatus.CREATED)
  setFeatureFlag(@Body() dto: SetFeatureFlagDto) {
    return this.adminService.setFeatureFlag(dto);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Get('feature-flags/:key/check')
  isFeatureEnabled(
    @Param('key') key: string,
    @Headers('x-workspace-id') workspaceId: string,
  ) {
    return this.adminService.isFeatureEnabled(key, workspaceId);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Get('plan')
  getWorkspacePlan(@Headers('x-workspace-id') workspaceId: string) {
    return this.adminService.getWorkspacePlan(workspaceId);
  }

  // Atribuição de plano é decisão de billing/plataforma, não self-service do workspace.
  @UseGuards(JwtAuthGuard, WorkspaceGuard, PlatformAdminGuard)
  @Post('plan')
  setWorkspacePlan(@Headers('x-workspace-id') workspaceId: string, @Body() dto: SetWorkspacePlanDto) {
    return this.adminService.setWorkspacePlan(workspaceId, dto);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Get('onboarding')
  getOnboardingSteps(@Headers('x-workspace-id') workspaceId: string) {
    return this.adminService.getOnboardingSteps(workspaceId);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Post('onboarding/complete')
  @HttpCode(HttpStatus.OK)
  completeOnboardingStep(
    @Headers('x-workspace-id') workspaceId: string,
    @Body() dto: CompleteOnboardingStepDto,
  ) {
    return this.adminService.completeOnboardingStep(workspaceId, dto);
  }
}
