// Controller Fiscal
import {
  Controller, Get, Post, Delete, Param, Query, Body,
  Headers, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { FiscalService } from './fiscal.service';
import { DimobService } from './dimob.service';
import {
  SaveTaxConfigDto, EmitNfseDto, GenerateDimobDto, GenerateCarneLeaoDto,
  DimobQueryDto, IrrfQueryDto, CarneLeaoQueryDto,
} from './fiscal.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../../common/guards/workspace.guard';

@ApiTags('fiscal')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Workspace-Id', required: true })
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Controller('fiscal')
export class FiscalController {
  constructor(
    private readonly service: FiscalService,
    private readonly dimob: DimobService,
  ) {}

  // ── DIMOB por declarante (rateio PJ/PF) ───────────────────

  @Post('dimob/contracts/:contractId/register')
  registerDimobEvents(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('contractId') contractId: string,
  ) {
    return this.dimob.registerSaleEvents(workspaceId, contractId);
  }

  @Get('dimob/export')
  exportDimob(
    @Headers('x-workspace-id') workspaceId: string,
    @Query('year') year: string,
    @Query('declarantDoc') declarantDoc?: string,
  ) {
    return this.dimob.exportDimob(workspaceId, Number(year), declarantDoc);
  }

  // Arquivo TXT de importação do PGD DIMOB (por declarante/ano)
  @Get('dimob/pgd')
  generatePgdFile(
    @Headers('x-workspace-id') workspaceId: string,
    @Query('year') year: string,
    @Query('declarantDoc') declarantDoc: string,
  ) {
    return this.dimob.generatePgdFile(workspaceId, Number(year), declarantDoc);
  }

  // ── CONFIGURAÇÃO FISCAL ───────────────────────────────────

  @Get('config')
  getTaxConfig(@Headers('x-workspace-id') workspaceId: string) {
    return this.service.getTaxConfig(workspaceId);
  }

  @Post('config')
  @HttpCode(HttpStatus.OK)
  saveTaxConfig(
    @Headers('x-workspace-id') workspaceId: string,
    @Body() dto: SaveTaxConfigDto,
  ) {
    return this.service.saveTaxConfig(workspaceId, dto);
  }

  // ── NFS-e ─────────────────────────────────────────────────

  @Get('nfse')
  findNfse(
    @Headers('x-workspace-id') workspaceId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.findNfse(workspaceId, page, limit);
  }

  @Post('nfse')
  emitNfse(
    @Headers('x-workspace-id') workspaceId: string,
    @Body() dto: EmitNfseDto,
  ) {
    return this.service.emitNfse(workspaceId, dto);
  }

  // Consulta/atualiza status da NFS-e na prefeitura (Focus NFe)
  @Get('nfse/:id/status')
  checkNfseStatus(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.service.checkNfseStatus(workspaceId, id);
  }

  @Delete('nfse/:id')
  cancelNfse(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.service.cancelNfse(workspaceId, id);
  }

  // ── IRRF ──────────────────────────────────────────────────

  @Get('irrf')
  findIrrf(
    @Headers('x-workspace-id') workspaceId: string,
    @Query() query: IrrfQueryDto,
  ) {
    return this.service.findIrrf(workspaceId, query);
  }

  @Post('irrf')
  createIrrfRecord(
    @Headers('x-workspace-id') workspaceId: string,
    @Body() dto: {
      period: string;
      contractId?: string;
      tenantDocument: string;
      tenantName: string;
      ownerDocument: string;
      ownerName: string;
      grossAmount: number;
      irrfRate?: number;
    },
  ) {
    return this.service.createIrrfRecord(workspaceId, dto);
  }

  // ── DIMOB ─────────────────────────────────────────────────

  @Get('dimob')
  findDimob(
    @Headers('x-workspace-id') workspaceId: string,
    @Query() query: DimobQueryDto,
  ) {
    return this.service.findDimob(workspaceId, query);
  }

  @Post('dimob/generate')
  @HttpCode(HttpStatus.OK)
  generateDimob(
    @Headers('x-workspace-id') workspaceId: string,
    @Body() dto: GenerateDimobDto,
  ) {
    return this.service.generateDimob(workspaceId, dto);
  }

  // ── CARNÊ-LEÃO ────────────────────────────────────────────

  @Get('carne-leao')
  findCarneLeao(
    @Headers('x-workspace-id') workspaceId: string,
    @Query() query: CarneLeaoQueryDto,
  ) {
    return this.service.findCarneLeao(workspaceId, query);
  }

  @Post('carne-leao/calculate')
  @HttpCode(HttpStatus.OK)
  calculateCarneLeao(
    @Headers('x-workspace-id') workspaceId: string,
    @Body() dto: GenerateCarneLeaoDto,
  ) {
    return this.service.calculateCarneLeao(workspaceId, dto);
  }
}
