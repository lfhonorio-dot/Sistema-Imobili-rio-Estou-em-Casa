// Controller LGPD - endpoints de conformidade com a LGPD
// Consentimentos, direitos dos titulares, políticas e incidentes

import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiHeader,
  ApiQuery,
} from '@nestjs/swagger';
import { LgpdService } from './lgpd.service';
import {
  RecordConsentDto,
  WithdrawConsentDto,
  CreateLgpdRequestDto,
  UpdateLgpdRequestDto,
  CreatePrivacyPolicyDto,
  CreateSecurityIncidentDto,
} from './lgpd.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermissions } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('lgpd')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Workspace-Id', required: true })
@UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
@Controller('lgpd')
export class LgpdController {
  constructor(private readonly lgpdService: LgpdService) {}

  // -----------------------------------------------
  // CONSENTIMENTOS
  // -----------------------------------------------

  // POST /lgpd/consents - Registrar consentimento
  @Post('consents')
  @RequirePermissions('lgpd:write')
  @ApiOperation({ summary: 'Registrar consentimento do titular' })
  recordConsent(
    @Headers('x-workspace-id') workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: RecordConsentDto,
  ) {
    return this.lgpdService.recordConsent(workspaceId, user.sub, dto);
  }

  // POST /lgpd/consents/withdraw - Retirar consentimento
  @Post('consents/withdraw')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('lgpd:write')
  @ApiOperation({ summary: 'Retirar consentimento do titular' })
  withdrawConsent(
    @Headers('x-workspace-id') workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: WithdrawConsentDto,
  ) {
    return this.lgpdService.withdrawConsent(workspaceId, user.sub, dto);
  }

  // GET /lgpd/consents - Listar consentimentos
  @Get('consents')
  @RequirePermissions('lgpd:read')
  @ApiOperation({ summary: 'Listar consentimentos do workspace' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  listConsents(
    @Headers('x-workspace-id') workspaceId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.lgpdService.listConsents(workspaceId, page, limit);
  }

  // -----------------------------------------------
  // REQUISIÇÕES DOS TITULARES
  // -----------------------------------------------

  // POST /lgpd/requests - Criar requisição (endpoint público para titulares)
  @Post('requests')
  @Public()
  @ApiOperation({ summary: 'Criar requisição de direito do titular (endpoint público)' })
  createRequest(
    @Headers('x-workspace-id') workspaceId: string,
    @Body() dto: CreateLgpdRequestDto,
  ) {
    return this.lgpdService.createRequest(workspaceId, dto);
  }

  // GET /lgpd/requests - Listar requisições
  @Get('requests')
  @RequirePermissions('lgpd:read')
  @ApiOperation({ summary: 'Listar requisições de titulares' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  listRequests(
    @Headers('x-workspace-id') workspaceId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.lgpdService.listRequests(workspaceId, page, limit);
  }

  // PUT /lgpd/requests/:id - Atualizar status da requisição
  @Put('requests/:id')
  @RequirePermissions('lgpd:write')
  @ApiOperation({ summary: 'Atualizar status de requisição LGPD' })
  updateRequest(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') requestId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateLgpdRequestDto,
  ) {
    return this.lgpdService.updateRequest(workspaceId, requestId, user.sub, dto);
  }

  // GET /lgpd/export/:email - Exportar dados do titular
  @Get('export/:email')
  @RequirePermissions('lgpd:read')
  @ApiOperation({ summary: 'Exportar todos os dados de um titular' })
  exportSubjectData(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('email') email: string,
  ) {
    return this.lgpdService.exportSubjectData(workspaceId, decodeURIComponent(email));
  }

  // POST /lgpd/anonymize/:email - Anonimizar dados do titular
  @Post('anonymize/:email')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('lgpd:write')
  @ApiOperation({ summary: 'Anonimizar todos os dados de um titular (irreversível)' })
  anonymizeSubjectData(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('email') email: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.lgpdService.anonymizeSubjectData(workspaceId, decodeURIComponent(email), user.sub);
  }

  // -----------------------------------------------
  // POLÍTICAS DE PRIVACIDADE
  // -----------------------------------------------

  // POST /lgpd/policies - Criar política
  @Post('policies')
  @RequirePermissions('lgpd:write')
  @ApiOperation({ summary: 'Criar nova versão da política de privacidade' })
  createPolicy(
    @Headers('x-workspace-id') workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreatePrivacyPolicyDto,
  ) {
    return this.lgpdService.createPrivacyPolicy(workspaceId, user.sub, dto);
  }

  // GET /lgpd/policies - Listar políticas
  @Get('policies')
  @RequirePermissions('lgpd:read')
  @ApiOperation({ summary: 'Listar versões da política de privacidade' })
  listPolicies(@Headers('x-workspace-id') workspaceId: string) {
    return this.lgpdService.listPrivacyPolicies(workspaceId);
  }

  // GET /lgpd/policies/:id - Buscar política
  @Get('policies/:id')
  @RequirePermissions('lgpd:read')
  @ApiOperation({ summary: 'Buscar política de privacidade por ID' })
  getPolicy(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') policyId: string,
  ) {
    return this.lgpdService.getPrivacyPolicy(workspaceId, policyId);
  }

  // -----------------------------------------------
  // INCIDENTES DE SEGURANÇA
  // -----------------------------------------------

  // POST /lgpd/incidents - Registrar incidente
  @Post('incidents')
  @RequirePermissions('lgpd:write')
  @ApiOperation({ summary: 'Registrar incidente de segurança' })
  createIncident(
    @Headers('x-workspace-id') workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateSecurityIncidentDto,
  ) {
    return this.lgpdService.createIncident(workspaceId, user.sub, dto);
  }

  // GET /lgpd/incidents - Listar incidentes
  @Get('incidents')
  @RequirePermissions('lgpd:read')
  @ApiOperation({ summary: 'Listar incidentes de segurança' })
  listIncidents(@Headers('x-workspace-id') workspaceId: string) {
    return this.lgpdService.listIncidents(workspaceId);
  }
}
