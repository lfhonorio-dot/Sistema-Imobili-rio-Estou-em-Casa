// Controller de Cobranças — Boletos, PIX, CNAB e Gateways
import {
  Controller, Get, Post, Patch, Delete, Param, Query, Body,
  Headers, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import {
  CreateGatewayConfigDto, GenerateBoletoDto, BoletoQueryDto,
  UploadCnabDto, GenerateCnabRemessaDto,
} from './billing.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../../common/guards/workspace.guard';
import { Public } from '../../../common/decorators/public.decorator';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly service: BillingService) {}

  // ── GATEWAYS ──────────────────────────────────────────────

  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Workspace-Id', required: true })
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Get('gateways')
  getGateways(@Headers('x-workspace-id') workspaceId: string) {
    return this.service.getGateways(workspaceId);
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Workspace-Id', required: true })
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Post('gateways')
  createGateway(
    @Headers('x-workspace-id') workspaceId: string,
    @Body() dto: CreateGatewayConfigDto,
  ) {
    return this.service.createGateway(workspaceId, dto);
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Workspace-Id', required: true })
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Patch('gateways/:id')
  updateGateway(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateGatewayConfigDto>,
  ) {
    return this.service.updateGateway(workspaceId, id, dto);
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Workspace-Id', required: true })
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Delete('gateways/:id')
  deleteGateway(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.service.deleteGateway(workspaceId, id);
  }

  // ── BOLETOS ───────────────────────────────────────────────

  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Workspace-Id', required: true })
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Get('boletos')
  findBoletos(
    @Headers('x-workspace-id') workspaceId: string,
    @Query() query: BoletoQueryDto,
  ) {
    return this.service.findBoletos(workspaceId, query);
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Workspace-Id', required: true })
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Get('boletos/:id')
  findOneBoleto(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.service.findOneBoleto(workspaceId, id);
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Workspace-Id', required: true })
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Post('boletos')
  generateBoleto(
    @Headers('x-workspace-id') workspaceId: string,
    @Body() dto: GenerateBoletoDto,
  ) {
    return this.service.generateBoleto(workspaceId, dto);
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Workspace-Id', required: true })
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Post('boletos/:id/reissue')
  @HttpCode(HttpStatus.OK)
  reissueBoleto(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @Body('newDueDate') newDueDate: string,
  ) {
    return this.service.reissueBoleto(workspaceId, id, newDueDate);
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Workspace-Id', required: true })
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Post('boletos/:id/confirm-payment')
  @HttpCode(HttpStatus.OK)
  confirmPayment(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @Body('paidAmount') paidAmount?: number,
  ) {
    return this.service.confirmPayment(workspaceId, id, paidAmount);
  }

  // ── CNAB ──────────────────────────────────────────────────

  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Workspace-Id', required: true })
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Get('cnab')
  findCnabFiles(@Headers('x-workspace-id') workspaceId: string) {
    return this.service.findCnabFiles(workspaceId);
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Workspace-Id', required: true })
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Post('cnab/upload')
  uploadCnabRetorno(
    @Headers('x-workspace-id') workspaceId: string,
    @Body() dto: UploadCnabDto,
  ) {
    return this.service.uploadCnabRetorno(workspaceId, dto);
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Workspace-Id', required: true })
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Post('cnab/remessa')
  generateRemessa(
    @Headers('x-workspace-id') workspaceId: string,
    @Body() dto: GenerateCnabRemessaDto,
  ) {
    return this.service.generateRemessa(workspaceId, dto);
  }

  // ── WEBHOOK PÚBLICO ───────────────────────────────────────

  @Public()
  @Post('webhook/:workspaceId')
  @HttpCode(HttpStatus.OK)
  processWebhook(
    @Param('workspaceId') workspaceId: string,
    @Body() payload: Record<string, unknown>,
  ) {
    return this.service.processWebhook(workspaceId, payload);
  }
}
