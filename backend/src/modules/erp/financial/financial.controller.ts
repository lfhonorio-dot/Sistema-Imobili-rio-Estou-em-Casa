// Controller Financeiro - rotas REST

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { FinancialService } from './financial.service';
import {
  CreateFinancialEntryDto,
  UpdateFinancialEntryDto,
  FinancialQueryDto,
  PayEntryDto,
  CommissionQueryDto,
  ReceiveCommissionDto,
} from './financial.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../../common/guards/workspace.guard';

@ApiTags('financial')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Workspace-Id', required: true })
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Controller('financial')
export class FinancialController {
  constructor(private readonly financialService: FinancialService) {}

  // GET /financial/entries - lista lançamentos
  @Get('entries')
  findAllEntries(
    @Headers('x-workspace-id') workspaceId: string,
    @Query() query: FinancialQueryDto,
  ) {
    return this.financialService.findAllEntries(workspaceId, query);
  }

  // POST /financial/entries - cria lançamento manual
  @Post('entries')
  createEntry(
    @Headers('x-workspace-id') workspaceId: string,
    @Body() dto: CreateFinancialEntryDto,
  ) {
    return this.financialService.createEntry(workspaceId, dto);
  }

  // GET /financial/summary - DRE resumido
  @Get('summary')
  getSummary(@Headers('x-workspace-id') workspaceId: string) {
    return this.financialService.getSummary(workspaceId);
  }

  // GET /financial/forecast - previsão de recebimentos
  @Get('forecast')
  getForecast(@Headers('x-workspace-id') workspaceId: string) {
    return this.financialService.getForecast(workspaceId);
  }

  // GET /financial/overdue - inadimplentes
  @Get('overdue')
  getOverdue(@Headers('x-workspace-id') workspaceId: string) {
    return this.financialService.getOverdue(workspaceId);
  }

  // GET /financial/commissions - lista comissões
  @Get('commissions')
  findAllCommissions(
    @Headers('x-workspace-id') workspaceId: string,
    @Query() query: CommissionQueryDto,
  ) {
    return this.financialService.findAllCommissions(workspaceId, query);
  }

  // PATCH /financial/commissions/:id/pay - paga comissão (compatibilidade)
  @Patch('commissions/:id/pay')
  payCommission(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.financialService.payCommission(workspaceId, id);
  }

  // PATCH /financial/commissions/:id/receive - registra recebimento da comissão
  @Patch('commissions/:id/receive')
  receiveCommission(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: ReceiveCommissionDto,
  ) {
    return this.financialService.receiveCommission(workspaceId, id, dto);
  }

  // POST /financial/commissions/:id/process-split - gera repasses aos parceiros
  @Post('commissions/:id/process-split')
  processCommissionSplit(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.financialService.processCommissionSplit(workspaceId, id);
  }

  // GET /financial/entries/:id - detalhe
  @Get('entries/:id')
  findOneEntry(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.financialService.findOneEntry(workspaceId, id);
  }

  // PATCH /financial/entries/:id - atualiza
  @Patch('entries/:id')
  updateEntry(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFinancialEntryDto,
  ) {
    return this.financialService.updateEntry(workspaceId, id, dto);
  }

  // DELETE /financial/entries/:id - soft delete
  @Delete('entries/:id')
  removeEntry(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.financialService.removeEntry(workspaceId, id);
  }

  // PATCH /financial/entries/:id/pay - marca como pago
  @Patch('entries/:id/pay')
  payEntry(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: PayEntryDto,
  ) {
    return this.financialService.payEntry(workspaceId, id, dto);
  }
}
