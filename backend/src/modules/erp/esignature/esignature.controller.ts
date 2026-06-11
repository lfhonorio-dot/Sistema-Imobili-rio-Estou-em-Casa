// Controller de Assinatura Eletrônica
import {
  Controller, Get, Post, Delete, Param, Query, Body,
  Headers, UseGuards, HttpCode, HttpStatus, Ip,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { EsignatureService } from './esignature.service';
import { CreateEnvelopeDto, EnvelopeQueryDto, ValidateOtpDto, RejectSignatureDto } from './esignature.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../../common/guards/workspace.guard';
import { CurrentUser, JwtPayload } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';

@ApiTags('esignature')
@Controller('esignature')
export class EsignatureController {
  constructor(private readonly service: EsignatureService) {}

  // ── ROTAS AUTENTICADAS ─────────────────────────────────

  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Workspace-Id', required: true })
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Get('envelopes')
  findAll(
    @Headers('x-workspace-id') workspaceId: string,
    @Query() query: EnvelopeQueryDto,
  ) {
    return this.service.findAll(workspaceId, query);
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Workspace-Id', required: true })
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Get('envelopes/:id')
  findOne(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.service.findOne(workspaceId, id);
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Workspace-Id', required: true })
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Post('envelopes')
  create(
    @Headers('x-workspace-id') workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateEnvelopeDto,
  ) {
    return this.service.create(workspaceId, user.sub, dto);
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Workspace-Id', required: true })
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Post('envelopes/:id/send')
  @HttpCode(HttpStatus.OK)
  send(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.service.send(workspaceId, id);
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Workspace-Id', required: true })
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Delete('envelopes/:id')
  cancel(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.service.cancel(workspaceId, id);
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Workspace-Id', required: true })
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Get('envelopes/:id/audit-trail')
  auditTrail(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.service.getAuditTrail(workspaceId, id);
  }

  // ── PORTAL PÚBLICO (sem JWT) ───────────────────────────

  @Public()
  @Get('portal/:token')
  getPortal(@Param('token') token: string) {
    return this.service.getPortalData(token);
  }

  @Public()
  @Post('portal/:token/otp')
  @HttpCode(HttpStatus.OK)
  requestOtp(@Param('token') token: string) {
    return this.service.requestOtp(token);
  }

  @Public()
  @Post('portal/:token/sign')
  @HttpCode(HttpStatus.OK)
  sign(
    @Param('token') token: string,
    @Body() dto: ValidateOtpDto,
    @Req() req: Request,
  ) {
    const ip = req.ip;
    const ua = req.headers['user-agent'];
    return this.service.sign(token, dto, ip, ua);
  }

  @Public()
  @Post('portal/:token/reject')
  @HttpCode(HttpStatus.OK)
  reject(
    @Param('token') token: string,
    @Body() dto: RejectSignatureDto,
    @Req() req: Request,
  ) {
    return this.service.reject(token, dto, req.ip);
  }
}
