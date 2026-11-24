// Controller Fiscal
import {
  Controller, Get, Post, Delete, Param, Query, Body,
  Headers, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { FiscalService } from './fiscal.service';
import { DimobService } from './dimob.service';
import {
  SaveTaxConfigDto, GenerateDimobDto, GenerateCarneLeaoDto,
  DimobQueryDto, IrrfQueryDto, CarneLeaoQueryDto,
} from './fiscal.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../../common/guards/workspace.guard';
import { Access, ALL, STAFF, FINANCE_AREA, FINANCE_CONFIG, MANAGEMENT, ADMIN_ONLY } from '../../../common/access/access';

@ApiTags('fiscal')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Workspace-Id', required: true })
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Access(...FINANCE_AREA)
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

  // CNPJs declarantes do ano (um arquivo por CNPJ; troca de CNPJ no meio do ano = dois arquivos)
  @Get('dimob/declarants')
  dimobDeclarants(@Headers('x-workspace-id') workspaceId: string, @Query('year') year: string) {
    return this.dimob.declarants(workspaceId, Number(year));
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
  // Fase 7: valida partes e estrutura do arquivo da DIMOB
  @Get('dimob/validate')
  validateDimob(@Headers('x-workspace-id') workspaceId: string, @Query('year') year: string, @Query('declarantDoc') declarantDoc: string) {
    return this.dimob.validateDimob(workspaceId, Number(year), declarantDoc);
  }

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
  // Fase 6: emissão, consulta e cancelamento foram para o módulo NFS-e
  // (/nfse), com o provedor SIL Tecnologia (Franca). As rotas antigas daqui
  // (Focus NFe e um "cancelar" que só mudava o status sem ir à prefeitura)
  // foram removidas.

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
