// Controller Bancário
import {
  Controller, Get, Post, Patch, Delete, Param, Query, Body,
  Headers, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { BankingService } from './banking.service';
import {
  CreateBankAccountDto, ImportOfxDto, BankTransactionQueryDto,
  ReconcileDto, ManualTransactionDto,
} from './banking.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../../common/guards/workspace.guard';

@ApiTags('banking')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Workspace-Id', required: true })
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Controller('banking')
export class BankingController {
  constructor(private readonly service: BankingService) {}

  // ── CONTAS ────────────────────────────────────────────────

  @Get('accounts')
  findAccounts(@Headers('x-workspace-id') workspaceId: string) {
    return this.service.findAccounts(workspaceId);
  }

  @Get('accounts/:id')
  findOneAccount(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.service.findOneAccount(workspaceId, id);
  }

  @Post('accounts')
  createAccount(
    @Headers('x-workspace-id') workspaceId: string,
    @Body() dto: CreateBankAccountDto,
  ) {
    return this.service.createAccount(workspaceId, dto);
  }

  @Patch('accounts/:id')
  updateAccount(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateBankAccountDto>,
  ) {
    return this.service.updateAccount(workspaceId, id, dto);
  }

  @Delete('accounts/:id')
  deleteAccount(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.service.deleteAccount(workspaceId, id);
  }

  @Get('accounts/:id/summary')
  getAccountSummary(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.service.getAccountSummary(workspaceId, id);
  }

  // ── OFX ───────────────────────────────────────────────────

  @Post('ofx/import')
  importOfx(
    @Headers('x-workspace-id') workspaceId: string,
    @Body() dto: ImportOfxDto,
  ) {
    return this.service.importOfx(workspaceId, dto);
  }

  // ── TRANSAÇÕES ────────────────────────────────────────────

  @Get('transactions')
  findTransactions(
    @Headers('x-workspace-id') workspaceId: string,
    @Query() query: BankTransactionQueryDto,
  ) {
    return this.service.findTransactions(workspaceId, query);
  }

  @Post('transactions')
  createManualTransaction(
    @Headers('x-workspace-id') workspaceId: string,
    @Body() dto: ManualTransactionDto,
  ) {
    return this.service.createManualTransaction(workspaceId, dto);
  }

  // ── CONCILIAÇÃO ───────────────────────────────────────────

  @Get('reconciliations')
  findReconciliations(@Headers('x-workspace-id') workspaceId: string) {
    return this.service.findReconciliations(workspaceId);
  }

  @Post('reconcile')
  @HttpCode(HttpStatus.OK)
  reconcileTransaction(
    @Headers('x-workspace-id') workspaceId: string,
    @Body() dto: ReconcileDto,
  ) {
    return this.service.reconcileTransaction(workspaceId, dto);
  }

  @Post('accounts/:id/auto-reconcile')
  @HttpCode(HttpStatus.OK)
  autoReconcile(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.service.autoReconcile(workspaceId, id);
  }

  // ── OPEN FINANCE ──────────────────────────────────────────

  @Get('open-finance/consent')
  getOpenFinanceConsent(@Headers('x-workspace-id') workspaceId: string) {
    return this.service.getOpenFinanceConsent(workspaceId);
  }
}
