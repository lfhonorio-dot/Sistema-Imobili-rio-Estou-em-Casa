// Controller de Email
import {
  Controller, Get, Post, Patch, Delete, Param, Query, Body,
  Headers, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { EmailService } from './email.service';
import {
  CreateEmailTemplateDto,
  UpdateEmailTemplateDto,
  SendEmailDto,
  EmailTemplateQueryDto,
} from './email.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../../common/guards/workspace.guard';

@ApiTags('email')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Workspace-Id', required: true })
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Controller('email')
export class EmailController {
  constructor(private readonly service: EmailService) {}

  // Diagnóstico de conectividade SMTP (autenticado)
  @Get('smtp-health')
  smtpHealth() {
    return this.service.verifySmtp();
  }

  @Get('templates')
  findAllTemplates(
    @Headers('x-workspace-id') workspaceId: string,
    @Query() query: EmailTemplateQueryDto,
  ) {
    return this.service.findAllTemplates(workspaceId, query);
  }

  @Get('templates/:id')
  findOneTemplate(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.service.findOneTemplate(workspaceId, id);
  }

  @Post('templates')
  createTemplate(
    @Headers('x-workspace-id') workspaceId: string,
    @Body() dto: CreateEmailTemplateDto,
  ) {
    return this.service.createTemplate(workspaceId, dto);
  }

  @Patch('templates/:id')
  updateTemplate(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEmailTemplateDto,
  ) {
    return this.service.updateTemplate(workspaceId, id, dto);
  }

  @Delete('templates/:id')
  deleteTemplate(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.service.deleteTemplate(workspaceId, id);
  }

  @Post('templates/:id/preview')
  @HttpCode(HttpStatus.OK)
  previewTemplate(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @Body() body: { variables?: Record<string, string> },
  ) {
    return this.service.previewTemplate(workspaceId, id, body.variables);
  }

  @Post('send')
  @HttpCode(HttpStatus.OK)
  sendEmail(
    @Headers('x-workspace-id') workspaceId: string,
    @Body() dto: SendEmailDto,
  ) {
    return this.service.sendEmail(workspaceId, dto);
  }
}
