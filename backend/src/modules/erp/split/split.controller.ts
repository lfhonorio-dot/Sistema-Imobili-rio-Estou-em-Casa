// Controller de Split de Pagamento
import {
  Controller, Get, Post, Patch, Delete, Param, Query, Body,
  Headers, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { SplitService } from './split.service';
import {
  CreateRecipientDto, CreateSplitRuleDto, ProcessSplitDto, SplitQueryDto,
} from './split.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../../common/guards/workspace.guard';

@ApiTags('split')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Workspace-Id', required: true })
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Controller('split')
export class SplitController {
  constructor(private readonly service: SplitService) {}

  // ── RECEBEDORES ───────────────────────────────────────────

  @Get('recipients')
  findRecipients(@Headers('x-workspace-id') workspaceId: string) {
    return this.service.findRecipients(workspaceId);
  }

  @Get('recipients/:id')
  findOneRecipient(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.service.findOneRecipient(workspaceId, id);
  }

  @Post('recipients')
  createRecipient(
    @Headers('x-workspace-id') workspaceId: string,
    @Body() dto: CreateRecipientDto,
  ) {
    return this.service.createRecipient(workspaceId, dto);
  }

  @Patch('recipients/:id')
  updateRecipient(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateRecipientDto>,
  ) {
    return this.service.updateRecipient(workspaceId, id, dto);
  }

  @Delete('recipients/:id')
  deleteRecipient(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.service.deleteRecipient(workspaceId, id);
  }

  @Post('recipients/:id/kyc')
  @HttpCode(HttpStatus.OK)
  submitKyc(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.service.submitKyc(workspaceId, id);
  }

  // ── REGRAS DE SPLIT ───────────────────────────────────────

  @Get('rules')
  findSplitRules(@Headers('x-workspace-id') workspaceId: string) {
    return this.service.findSplitRules(workspaceId);
  }

  @Get('rules/:id')
  findOneSplitRule(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.service.findOneSplitRule(workspaceId, id);
  }

  @Post('rules')
  createSplitRule(
    @Headers('x-workspace-id') workspaceId: string,
    @Body() dto: CreateSplitRuleDto,
  ) {
    return this.service.createSplitRule(workspaceId, dto);
  }

  @Delete('rules/:id')
  deactivateSplitRule(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.service.deactivateSplitRule(workspaceId, id);
  }

  // ── TRANSAÇÕES ────────────────────────────────────────────

  @Get('transactions')
  findTransactions(
    @Headers('x-workspace-id') workspaceId: string,
    @Query() query: SplitQueryDto,
  ) {
    return this.service.findSplitTransactions(workspaceId, query);
  }

  @Post('process')
  @HttpCode(HttpStatus.OK)
  processSplit(
    @Headers('x-workspace-id') workspaceId: string,
    @Body() dto: ProcessSplitDto,
  ) {
    return this.service.processSplit(workspaceId, dto);
  }

  @Post('transactions/:id/confirm')
  @HttpCode(HttpStatus.OK)
  confirmTransaction(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.service.confirmSplitTransaction(workspaceId, id);
  }
}
