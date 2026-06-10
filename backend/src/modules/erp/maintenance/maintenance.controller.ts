// Controller de Manutenção

import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, Headers, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { MaintenanceService } from './maintenance.service';
import {
  CreateMaintenanceOrderDto, UpdateMaintenanceOrderDto,
  MaintenanceQueryDto, ChangeMaintenanceStatusDto,
} from './maintenance.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../../common/guards/workspace.guard';

@ApiTags('maintenance')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Workspace-Id', required: true })
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get()
  findAll(@Headers('x-workspace-id') workspaceId: string, @Query() query: MaintenanceQueryDto) {
    return this.maintenanceService.findAll(workspaceId, query);
  }

  @Post()
  create(@Headers('x-workspace-id') workspaceId: string, @Body() dto: CreateMaintenanceOrderDto) {
    return this.maintenanceService.create(workspaceId, dto);
  }

  @Get(':id')
  findOne(@Headers('x-workspace-id') workspaceId: string, @Param('id') id: string) {
    return this.maintenanceService.findOne(workspaceId, id);
  }

  @Patch(':id')
  update(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMaintenanceOrderDto,
  ) {
    return this.maintenanceService.update(workspaceId, id, dto);
  }

  @Delete(':id')
  remove(@Headers('x-workspace-id') workspaceId: string, @Param('id') id: string) {
    return this.maintenanceService.remove(workspaceId, id);
  }

  @Patch(':id/status')
  changeStatus(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: ChangeMaintenanceStatusDto,
  ) {
    return this.maintenanceService.changeStatus(workspaceId, id, dto);
  }

  @Patch(':id/approve')
  approve(@Headers('x-workspace-id') workspaceId: string, @Param('id') id: string) {
    return this.maintenanceService.approve(workspaceId, id);
  }
}
