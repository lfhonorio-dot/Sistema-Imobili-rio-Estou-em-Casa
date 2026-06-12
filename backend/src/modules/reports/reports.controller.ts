import { Controller, Get, Query, Headers, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportFilterDto } from './reports.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';

@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Get('dashboard')
  getDashboard(@Headers('x-workspace-id') workspaceId: string) {
    return this.service.getDashboard(workspaceId);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Get('crm-funnel')
  getCrmFunnel(
    @Headers('x-workspace-id') workspaceId: string,
    @Query() filter: ReportFilterDto,
  ) {
    return this.service.getCrmFunnel(workspaceId, filter);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Get('deal-performance')
  getDealPerformance(
    @Headers('x-workspace-id') workspaceId: string,
    @Query() filter: ReportFilterDto,
  ) {
    return this.service.getDealPerformance(workspaceId, filter);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Get('contact-growth')
  getContactGrowth(
    @Headers('x-workspace-id') workspaceId: string,
    @Query() filter: ReportFilterDto,
  ) {
    return this.service.getContactGrowth(workspaceId, filter);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Get('property-status')
  getPropertyStatus(@Headers('x-workspace-id') workspaceId: string) {
    return this.service.getPropertyStatus(workspaceId);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Get('financial-summary')
  getFinancialSummary(
    @Headers('x-workspace-id') workspaceId: string,
    @Query() filter: ReportFilterDto,
  ) {
    return this.service.getFinancialSummary(workspaceId, filter);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Get('marketing-roi')
  getMarketingRoi(@Headers('x-workspace-id') workspaceId: string) {
    return this.service.getMarketingRoi(workspaceId);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Get('automation-stats')
  getAutomationStats(@Headers('x-workspace-id') workspaceId: string) {
    return this.service.getAutomationStats(workspaceId);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Get('activity-heatmap')
  getActivityHeatmap(
    @Headers('x-workspace-id') workspaceId: string,
    @Query() filter: ReportFilterDto,
  ) {
    return this.service.getActivityHeatmap(workspaceId, filter);
  }
}
