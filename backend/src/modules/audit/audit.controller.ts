// Controller de auditoria - consulta de logs

import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
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
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermissions } from '../../common/decorators/roles.decorator';

@ApiTags('audit')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Workspace-Id', required: true })
@UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
@RequirePermissions('audit:read')
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  // GET /audit/logs - Lista logs com filtros
  @Get('logs')
  @ApiOperation({ summary: 'Listar logs de auditoria' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'entity', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getLogs(
    @Headers('x-workspace-id') workspaceId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('entity') entity?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.auditService.getLogs(workspaceId, {
      page,
      limit,
      userId,
      action,
      entity,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  // GET /audit/logs/:id - Detalhes de um log específico
  @Get('logs/:id')
  @ApiOperation({ summary: 'Detalhes de um log de auditoria' })
  getLog(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') logId: string,
  ) {
    return this.auditService.getLogById(workspaceId, logId);
  }
}
