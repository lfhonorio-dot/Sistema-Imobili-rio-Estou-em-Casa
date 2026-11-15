// Fase 4 — rotas do ciclo de vida da venda (ativar, rescindir, pós-venda, espécie).
import { Body, Controller, Get, Headers, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../../common/guards/workspace.guard';
import { CurrentUser, JwtPayload } from '../../../common/decorators/current-user.decorator';
import { SaleLifecycleService } from './sale-lifecycle.service';
import {
  ActivateSaleDto, AddChecklistItemDto, CashReviewDto, RescindSaleDto, UpdateChecklistItemDto,
} from './sale-lifecycle.dto';
import { Access, ALL, STAFF, FINANCE_AREA, FINANCE_CONFIG, MANAGEMENT, ADMIN_ONLY } from '../../../common/access/access';

@ApiTags('contracts')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Workspace-Id', required: true })
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Access(...ALL)
@Controller('contracts')
export class SaleLifecycleController {
  constructor(private readonly sale: SaleLifecycleService) {}

  /** Prévia das contas que a ativação vai gerar (não grava nada). */
  @Access(...STAFF)
  @Post(':id/sale/preview')
  preview(@Headers('x-workspace-id') ws: string, @Param('id') id: string, @Body() dto: ActivateSaleDto) {
    return this.sale.preview(ws, id, dto);
  }

  @Access(...STAFF)
  @Post(':id/sale/activate')
  activate(@Headers('x-workspace-id') ws: string, @CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: ActivateSaleDto) {
    return this.sale.activate(ws, u.sub, id, dto);
  }

  // Fase 5: vendas antigas (ativas antes do novo fluxo)
  @Access(...STAFF)
  @Get('sale/legacy')
  legacy(@Headers('x-workspace-id') ws: string) {
    return this.sale.legacyDiagnostic(ws);
  }

  @Access(...STAFF)
  @Post(':id/sale/regularize')
  regularize(@Headers('x-workspace-id') ws: string, @CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: ActivateSaleDto) {
    return this.sale.regularizeLegacy(ws, u.sub, id, dto);
  }

  @Access(...STAFF)
  @Post(':id/sale/rescind')
  rescind(@Headers('x-workspace-id') ws: string, @CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: RescindSaleDto) {
    return this.sale.rescind(ws, u.sub, id, dto);
  }

  @Access(...STAFF)
  @Patch(':id/sale/cash-review')
  cashReview(@Headers('x-workspace-id') ws: string, @CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: CashReviewDto) {
    return this.sale.reviewCash(ws, u.sub, id, dto);
  }

  @Get(':id/checklist')
  checklist(@Headers('x-workspace-id') ws: string, @Param('id') id: string) {
    return this.sale.listChecklist(ws, id);
  }

  @Post(':id/checklist')
  addItem(@Headers('x-workspace-id') ws: string, @Param('id') id: string, @Body() dto: AddChecklistItemDto) {
    return this.sale.addChecklistItem(ws, id, dto);
  }

  @Patch(':id/checklist/:itemId')
  updateItem(
    @Headers('x-workspace-id') ws: string, @CurrentUser() u: JwtPayload,
    @Param('id') id: string, @Param('itemId') itemId: string, @Body() dto: UpdateChecklistItemDto,
  ) {
    return this.sale.updateChecklistItem(ws, u.sub, id, itemId, dto);
  }
}
