import { Controller, Get, Query, Headers, UseGuards, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { SalesReportsService } from './sales/sales-reports.service';
import { ReportsService } from './reports.service';
import { ReportFilterDto } from './reports.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { Access, ALL, STAFF, FINANCE_AREA, FINANCE_CONFIG, MANAGEMENT, ADMIN_ONLY } from '../../common/access/access';

@Access(...STAFF)
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService, private readonly sales: SalesReportsService) {}

  // Fase 7: relatórios de venda (tabela + exportação Excel/PDF)
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Get('sales/:key')
  salesReport(@Headers('x-workspace-id') ws: string, @Param('key') key: string, @Query('from') from?: string, @Query('to') to?: string, @Query('days') days?: string) {
    return this.sales.build(ws, key, { from, to, days: days ? Number(days) : undefined });
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Get('sales/:key/export')
  async salesReportExport(
    @Headers('x-workspace-id') ws: string, @Param('key') key: string, @Res() res: Response,
    @Query('format') format = 'xlsx', @Query('from') from?: string, @Query('to') to?: string, @Query('days') days?: string,
  ) {
    const f = await this.sales.export(ws, key, { from, to, days: days ? Number(days) : undefined }, format);
    res.setHeader('Content-Type', f.type);
    res.setHeader('Content-Disposition', `attachment; filename="${f.name}"`);
    res.send(f.buf);
  }

  // Painel do perfil de venda (Fase 1)
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Access(...ALL)
  @Get('sales-dashboard')
  getSalesDashboard(@Headers('x-workspace-id') workspaceId: string) {
    return this.service.getSalesDashboard(workspaceId);
  }

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
  @Get('cash-flow')
  getCashFlow(
    @Headers('x-workspace-id') workspaceId: string,
    @Query() filter: ReportFilterDto,
  ) {
    return this.service.getCashFlow(workspaceId, filter);
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
