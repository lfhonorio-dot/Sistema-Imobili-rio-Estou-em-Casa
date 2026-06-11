import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, Headers, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { AutomationService } from './automation.service';
import { CreateAutomationDto, UpdateAutomationDto, TriggerAutomationDto } from './automation.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';

@Controller('automations')
export class AutomationController {
  constructor(private readonly service: AutomationService) {}

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Get()
  findAll(
    @Headers('x-workspace-id') workspaceId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll(workspaceId, page ? +page : 1, limit ? +limit : 20);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Get(':id')
  findOne(@Headers('x-workspace-id') workspaceId: string, @Param('id') id: string) {
    return this.service.findOne(workspaceId, id);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Post()
  create(@Headers('x-workspace-id') workspaceId: string, @Body() dto: CreateAutomationDto) {
    return this.service.create(workspaceId, dto);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Patch(':id')
  update(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAutomationDto,
  ) {
    return this.service.update(workspaceId, id, dto);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Headers('x-workspace-id') workspaceId: string, @Param('id') id: string) {
    return this.service.remove(workspaceId, id);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Post('trigger')
  @HttpCode(HttpStatus.OK)
  trigger(@Headers('x-workspace-id') workspaceId: string, @Body() dto: TriggerAutomationDto) {
    return this.service.trigger(workspaceId, dto);
  }

  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @Get(':id/logs')
  getLogs(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getLogs(workspaceId, id, page ? +page : 1, limit ? +limit : 20);
  }
}
