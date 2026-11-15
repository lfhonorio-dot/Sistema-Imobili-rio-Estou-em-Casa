// Fase 3 — rotas de visitas, propostas e ligação negócio ↔ imóvel/contrato.
import { Body, Controller, Get, Headers, Param, Patch, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../../common/guards/workspace.guard';
import { CurrentUser, JwtPayload } from '../../../common/decorators/current-user.decorator';
import { VisitsService } from './visits.service';
import { ProposalsService } from './proposals.service';
import { DealFunnelService } from './deal-funnel.service';
import {
  CancelVisitDto, CompleteVisitDto, CreateProposalDto, CreateVisitDto, DecideProposalDto, ProposalTermsDto,
  RescheduleVisitDto, SetDealPropertiesDto, VisitQueryDto,
} from './funnel.dto';
import { Access, ALL, STAFF, FINANCE_AREA, FINANCE_CONFIG, MANAGEMENT, ADMIN_ONLY } from '../../../common/access/access';

@ApiTags('visits')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Workspace-Id', required: true })
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Access(...ALL)
@Controller('visits')
export class VisitsController {
  constructor(private readonly visits: VisitsService) {}

  @Get()
  list(@Headers('x-workspace-id') ws: string, @CurrentUser() u: JwtPayload, @Query() q: VisitQueryDto) {
    return this.visits.list(ws, u.sub, q);
  }

  @Post()
  create(@Headers('x-workspace-id') ws: string, @CurrentUser() u: JwtPayload, @Body() dto: CreateVisitDto) {
    return this.visits.create(ws, u.sub, dto);
  }

  @Patch(':id/reschedule')
  reschedule(@Headers('x-workspace-id') ws: string, @CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: RescheduleVisitDto) {
    return this.visits.reschedule(ws, u.sub, id, dto);
  }

  @Patch(':id/complete')
  complete(@Headers('x-workspace-id') ws: string, @CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: CompleteVisitDto) {
    return this.visits.complete(ws, u.sub, id, dto);
  }

  @Patch(':id/cancel')
  cancel(@Headers('x-workspace-id') ws: string, @CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: CancelVisitDto) {
    return this.visits.cancel(ws, u.sub, id, dto);
  }
}

@ApiTags('proposals')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Workspace-Id', required: true })
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Access(...ALL)
@Controller('proposals')
export class ProposalsController {
  constructor(private readonly proposals: ProposalsService) {}

  @Get()
  list(@Headers('x-workspace-id') ws: string, @Query('dealId') dealId: string) {
    return this.proposals.listByDeal(ws, dealId);
  }

  @Post()
  create(@Headers('x-workspace-id') ws: string, @CurrentUser() u: JwtPayload, @Body() dto: CreateProposalDto) {
    return this.proposals.create(ws, u.sub, dto);
  }

  @Post(':id/counter')
  counter(@Headers('x-workspace-id') ws: string, @CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: ProposalTermsDto) {
    return this.proposals.counter(ws, u.sub, id, dto);
  }

  @Patch(':id/accept')
  accept(@Headers('x-workspace-id') ws: string, @CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: DecideProposalDto) {
    return this.proposals.accept(ws, u.sub, id, dto);
  }

  @Patch(':id/reject')
  reject(@Headers('x-workspace-id') ws: string, @CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: DecideProposalDto) {
    return this.proposals.reject(ws, u.sub, id, dto);
  }

  @Patch(':id/withdraw')
  withdraw(@Headers('x-workspace-id') ws: string, @CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: DecideProposalDto) {
    return this.proposals.withdraw(ws, u.sub, id, dto);
  }

  // Documento HTML (imprimir / salvar em PDF)
  @Get(':id/document')
  async document(@Headers('x-workspace-id') ws: string, @Param('id') id: string, @Res() res: Response) {
    const html = await this.proposals.document(ws, id);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }
}

@ApiTags('deals')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Workspace-Id', required: true })
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Access(...ALL)
@Controller('deals')
export class DealFunnelController {
  constructor(private readonly service: DealFunnelService) {}

  @Put(':id/properties')
  setProperties(@Headers('x-workspace-id') ws: string, @Param('id') id: string, @Body() dto: SetDealPropertiesDto) {
    return this.service.setProperties(ws, id, dto.propertyIds);
  }

  @Get(':id/contract-draft')
  contractDraft(@Headers('x-workspace-id') ws: string, @Param('id') id: string) {
    return this.service.contractDraft(ws, id);
  }
}
