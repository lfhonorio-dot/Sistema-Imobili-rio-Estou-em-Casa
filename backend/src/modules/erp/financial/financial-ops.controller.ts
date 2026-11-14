// Fase 5 — rotas novas do financeiro: baixas (parcial, juros, multa,
// desconto, estorno, comprovante), cancelamento com motivo, categorias,
// centros de custo, multa/juros padrão, recorrência, fluxo de caixa e DRE
// (com exportação para Excel).

import {
  Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, Param, Patch, Post, Query, Res,
  UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../../common/guards/workspace.guard';
import { CurrentUser, JwtPayload } from '../../../common/decorators/current-user.decorator';
import { MAX_DOCUMENT_BYTES, UploadedFileInput } from '../../files/files.service';
import { FinancialService } from './financial.service';
import { PaymentsService } from './payments.service';
import { FinancialConfigService } from './financial-config.service';
import { RecurringService } from './recurring.service';
import { CashflowService } from './cashflow.service';
import {
  CashFlowQueryDto, CategoryDto, CostCenterDto, DreQueryDto, FinancialSettingsDto, ReasonDto, RecurringDto,
  RegisterPaymentDto, UpdateCategoryDto, UpdateCostCenterDto, UpdateRecurringDto,
} from './financial.dto';
import { Access, ALL, STAFF, FINANCE_AREA, FINANCE_CONFIG, MANAGEMENT, ADMIN_ONLY } from '../../../common/access/access';

const uploadInterceptor = FileInterceptor('file', {
  limits: { fileSize: MAX_DOCUMENT_BYTES + 1024 * 1024, files: 1 },
});
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@ApiTags('financial')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Workspace-Id', required: true })
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Access(...FINANCE_AREA)
@Controller('financial')
export class FinancialOpsController {
  constructor(
    private readonly financial: FinancialService,
    private readonly payments: PaymentsService,
    private readonly config: FinancialConfigService,
    private readonly recurring: RecurringService,
    private readonly cashflow: CashflowService,
  ) {}

  // ── Baixas ──────────────────────────────────────────────

  @Get('entries/:id/payments')
  listPayments(@Headers('x-workspace-id') ws: string, @Param('id') id: string) {
    return this.payments.list(ws, id);
  }

  @Get('entries/:id/payment-suggestion')
  suggestion(@Headers('x-workspace-id') ws: string, @Param('id') id: string, @Query('paidAt') paidAt?: string) {
    return this.payments.suggestion(ws, id, paidAt);
  }

  @Post('entries/:id/payments')
  registerPayment(
    @Headers('x-workspace-id') ws: string, @Param('id') id: string,
    @Body() dto: RegisterPaymentDto, @CurrentUser() user: JwtPayload,
  ) {
    return this.financial.registerPayment(ws, id, dto, user.sub);
  }

  @Post('payments/:paymentId/reverse')
  @HttpCode(HttpStatus.OK)
  reversePayment(
    @Headers('x-workspace-id') ws: string, @Param('paymentId') paymentId: string,
    @Body() dto: ReasonDto, @CurrentUser() user: JwtPayload,
  ) {
    return this.payments.reverse(ws, paymentId, dto.reason, user.sub);
  }

  @Post('payments/:paymentId/receipt')
  @UseInterceptors(uploadInterceptor)
  attachReceipt(
    @Headers('x-workspace-id') ws: string, @Param('paymentId') paymentId: string,
    @UploadedFile() file: UploadedFileInput, @CurrentUser() user: JwtPayload,
  ) {
    return this.payments.attachReceipt(ws, paymentId, file, user.sub);
  }

  /** Envia o comprovante antes de registrar a baixa (devolve o id do arquivo). */
  @Post('receipts')
  @UseInterceptors(uploadInterceptor)
  uploadReceipt(
    @Headers('x-workspace-id') ws: string,
    @UploadedFile() file: UploadedFileInput, @CurrentUser() user: JwtPayload,
  ) {
    return this.payments.uploadReceipt(ws, file, user.sub);
  }

  @Post('entries/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancelEntry(
    @Headers('x-workspace-id') ws: string, @Param('id') id: string,
    @Body() dto: ReasonDto, @CurrentUser() user: JwtPayload,
  ) {
    return this.financial.cancelEntry(ws, id, dto.reason, user.sub);
  }

  // ── Categorias ──────────────────────────────────────────

  @Get('categories')
  categories(@Headers('x-workspace-id') ws: string, @Query('type') type?: string, @Query('all') all?: string) {
    return this.config.listCategories(ws, type, all === 'true');
  }

  @Access(...FINANCE_CONFIG)
  @Post('categories')
  createCategory(@Headers('x-workspace-id') ws: string, @Body() dto: CategoryDto) {
    return this.config.createCategory(ws, dto);
  }

  @Access(...FINANCE_CONFIG)
  @Patch('categories/:id')
  updateCategory(@Headers('x-workspace-id') ws: string, @Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.config.updateCategory(ws, id, dto);
  }

  @Access(...FINANCE_CONFIG)
  @Delete('categories/:id')
  removeCategory(@Headers('x-workspace-id') ws: string, @Param('id') id: string) {
    return this.config.removeCategory(ws, id);
  }

  // ── Centros de custo ────────────────────────────────────

  @Get('cost-centers')
  costCenters(@Headers('x-workspace-id') ws: string, @Query('all') all?: string) {
    return this.config.listCostCenters(ws, all === 'true');
  }

  @Access(...FINANCE_CONFIG)
  @Post('cost-centers')
  createCostCenter(@Headers('x-workspace-id') ws: string, @Body() dto: CostCenterDto) {
    return this.config.createCostCenter(ws, dto);
  }

  @Access(...FINANCE_CONFIG)
  @Patch('cost-centers/:id')
  updateCostCenter(@Headers('x-workspace-id') ws: string, @Param('id') id: string, @Body() dto: UpdateCostCenterDto) {
    return this.config.updateCostCenter(ws, id, dto);
  }

  @Access(...FINANCE_CONFIG)
  @Delete('cost-centers/:id')
  removeCostCenter(@Headers('x-workspace-id') ws: string, @Param('id') id: string) {
    return this.config.removeCostCenter(ws, id);
  }

  // ── Multa e juros padrão ────────────────────────────────

  @Get('settings')
  settings(@Headers('x-workspace-id') ws: string) {
    return this.config.getSettings(ws);
  }

  @Access(...FINANCE_CONFIG)
  @Patch('settings')
  updateSettings(@Headers('x-workspace-id') ws: string, @Body() dto: FinancialSettingsDto) {
    return this.config.updateSettings(ws, dto);
  }

  // ── Recorrência ─────────────────────────────────────────

  @Get('recurring')
  listRecurring(@Headers('x-workspace-id') ws: string) {
    return this.recurring.list(ws);
  }

  @Post('recurring')
  createRecurring(@Headers('x-workspace-id') ws: string, @Body() dto: RecurringDto, @CurrentUser() user: JwtPayload) {
    return this.recurring.create(ws, dto, user.sub);
  }

  @Patch('recurring/:id')
  updateRecurring(@Headers('x-workspace-id') ws: string, @Param('id') id: string, @Body() dto: UpdateRecurringDto) {
    return this.recurring.update(ws, id, dto);
  }

  @Delete('recurring/:id')
  removeRecurring(@Headers('x-workspace-id') ws: string, @Param('id') id: string) {
    return this.recurring.remove(ws, id);
  }

  // ── Fluxo de caixa e DRE ────────────────────────────────

  @Get('cash-flow')
  cashFlow(@Headers('x-workspace-id') ws: string, @Query() q: CashFlowQueryDto) {
    return this.cashflow.cashFlow(ws, q);
  }

  @Get('cash-flow/export')
  async cashFlowExport(@Headers('x-workspace-id') ws: string, @Query() q: CashFlowQueryDto, @Res() res: Response) {
    const buf = await this.cashflow.cashFlowXlsx(ws, q);
    res.setHeader('Content-Type', XLSX);
    res.setHeader('Content-Disposition', 'attachment; filename="fluxo-de-caixa.xlsx"');
    res.send(buf);
  }

  @Get('dre')
  dre(@Headers('x-workspace-id') ws: string, @Query() q: DreQueryDto) {
    return this.cashflow.dre(ws, q.year);
  }

  @Get('dre/export')
  async dreExport(@Headers('x-workspace-id') ws: string, @Query() q: DreQueryDto, @Res() res: Response) {
    const buf = await this.cashflow.dreXlsx(ws, q.year);
    res.setHeader('Content-Type', XLSX);
    res.setHeader('Content-Disposition', `attachment; filename="dre-${q.year ?? new Date().getFullYear()}.xlsx"`);
    res.send(buf);
  }
}
