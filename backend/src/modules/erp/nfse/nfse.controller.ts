// Fase 6 — rotas da NFS-e (configuração fiscal, certificado, emissão, fila,
// cancelamento, e-mail ao tomador e relatório do contador).
import {
  Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, Param, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../../common/guards/workspace.guard';
import { CurrentUser, JwtPayload } from '../../../common/decorators/current-user.decorator';
import type { UploadedFileInput } from '../../files/files.service';
import { NfseService } from './nfse.service';
import { NfseConfigService } from './nfse-config.service';
import {
  AuthorizeProductionDto, CancelNfseDto, CertificateDto, NfseConfigDto, NfseQueryDto, ReportQueryDto, RequestNfseDto, SendNfseEmailDto,
} from './nfse.dto';
import { Access, ALL, STAFF, FINANCE_AREA, FINANCE_CONFIG, MANAGEMENT, ADMIN_ONLY } from '../../../common/access/access';

@ApiTags('nfse')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Workspace-Id', required: true })
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Access(...FINANCE_AREA)
@Controller('nfse')
export class NfseController {
  constructor(private readonly nfse: NfseService, private readonly config: NfseConfigService) {}

  @Get('config')
  getConfig(@Headers('x-workspace-id') ws: string) { return this.config.get(ws); }

  @Access(...FINANCE_CONFIG)
  @Patch('config')
  saveConfig(@Headers('x-workspace-id') ws: string, @Body() dto: NfseConfigDto) { return this.config.save(ws, dto); }

  @Access(...FINANCE_CONFIG)
  @Post('config/certificate')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 60_000, files: 1 } }))
  uploadCertificate(@Headers('x-workspace-id') ws: string, @UploadedFile() file: UploadedFileInput, @Body() dto: CertificateDto) {
    return this.config.uploadCertificate(ws, file?.buffer, dto.password);
  }

  @Access(...FINANCE_CONFIG)
  @Delete('config/certificate')
  removeCertificate(@Headers('x-workspace-id') ws: string) { return this.config.removeCertificate(ws); }

  @Access(...ADMIN_ONLY)
  @Post('config/authorize-production')
  @HttpCode(HttpStatus.OK)
  authorizeProduction(@Headers('x-workspace-id') ws: string, @CurrentUser() u: JwtPayload, @Body() dto: AuthorizeProductionDto) {
    return this.config.authorizeProduction(ws, u.sub, dto.confirm);
  }

  @Access(...FINANCE_CONFIG)
  @Post('config/back-to-homolog')
  @HttpCode(HttpStatus.OK)
  backToHomolog(@Headers('x-workspace-id') ws: string) { return this.config.backToHomolog(ws); }

  @Get()
  list(@Headers('x-workspace-id') ws: string, @Query() q: NfseQueryDto) { return this.nfse.list(ws, q); }

  @Get('report')
  report(@Headers('x-workspace-id') ws: string, @Query() q: ReportQueryDto) { return this.nfse.monthlyReport(ws, q.month); }

  @Get('report/export')
  async reportExport(@Headers('x-workspace-id') ws: string, @Query() q: ReportQueryDto, @Res() res: Response) {
    const buf = await this.nfse.monthlyReportXlsx(ws, q.month);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="nfse-${q.month}.xlsx"`);
    res.send(buf);
  }

  @Post('entries/:entryId/preview')
  @HttpCode(HttpStatus.OK)
  preview(@Headers('x-workspace-id') ws: string, @Param('entryId') entryId: string, @Body() dto: RequestNfseDto) {
    return this.nfse.preview(ws, entryId, dto);
  }

  @Post('entries/:entryId')
  request(@Headers('x-workspace-id') ws: string, @Param('entryId') entryId: string, @Body() dto: RequestNfseDto, @CurrentUser() u: JwtPayload) {
    return this.nfse.requestForEntry(ws, entryId, dto, u.sub);
  }

  @Get(':id')
  get(@Headers('x-workspace-id') ws: string, @Param('id') id: string) { return this.nfse.get(ws, id); }

  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  retry(@Headers('x-workspace-id') ws: string, @Param('id') id: string) { return this.nfse.retry(ws, id); }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Headers('x-workspace-id') ws: string, @Param('id') id: string, @Body() dto: CancelNfseDto) {
    return this.nfse.cancel(ws, id, dto.reason, dto.code);
  }

  @Post(':id/email')
  @HttpCode(HttpStatus.OK)
  email(@Headers('x-workspace-id') ws: string, @Param('id') id: string, @Body() dto: SendNfseEmailDto) {
    return this.nfse.sendEmail(ws, id, dto.to);
  }
}
