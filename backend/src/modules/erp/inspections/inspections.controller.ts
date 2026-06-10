// Controller de Vistorias

import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, Headers, UseGuards, Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { InspectionsService } from './inspections.service';
import {
  CreateInspectionDto, UpdateInspectionDto, AddRoomDto, InspectionQueryDto,
} from './inspections.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../../common/guards/workspace.guard';

@ApiTags('inspections')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Workspace-Id', required: true })
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Controller('inspections')
export class InspectionsController {
  constructor(private readonly inspectionsService: InspectionsService) {}

  @Get()
  findAll(@Headers('x-workspace-id') workspaceId: string, @Query() query: InspectionQueryDto) {
    return this.inspectionsService.findAll(workspaceId, query);
  }

  @Post()
  create(@Headers('x-workspace-id') workspaceId: string, @Body() dto: CreateInspectionDto) {
    return this.inspectionsService.create(workspaceId, dto);
  }

  @Get(':id')
  findOne(@Headers('x-workspace-id') workspaceId: string, @Param('id') id: string) {
    return this.inspectionsService.findOne(workspaceId, id);
  }

  @Patch(':id')
  update(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateInspectionDto,
  ) {
    return this.inspectionsService.update(workspaceId, id, dto);
  }

  @Post(':id/rooms')
  addRoom(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: AddRoomDto,
    @Req() req: Request,
  ) {
    // Usa rawBody.items para preservar objetos aninhados ignorados pelo whitelist
    const rawItems = (req.body as any)?.items;
    if (rawItems !== undefined) dto.items = rawItems;
    return this.inspectionsService.addRoom(workspaceId, id, dto);
  }

  @Patch(':id/rooms/:roomId')
  updateRoom(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @Param('roomId') roomId: string,
    @Body() dto: AddRoomDto,
  ) {
    return this.inspectionsService.updateRoom(workspaceId, id, roomId, dto);
  }

  @Delete(':id/rooms/:roomId')
  removeRoom(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @Param('roomId') roomId: string,
  ) {
    return this.inspectionsService.removeRoom(workspaceId, id, roomId);
  }

  @Get(':id/compare')
  compare(@Headers('x-workspace-id') workspaceId: string, @Param('id') id: string) {
    return this.inspectionsService.compare(workspaceId, id);
  }
}
