// Controller de Pipelines - rotas REST
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { PipelinesService } from './pipelines.service';
import {
  CreatePipelineDto,
  UpdatePipelineDto,
  CreateStageDto,
  UpdateStageDto,
  ReorderStagesDto,
} from './pipelines.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../../common/guards/workspace.guard';
import { CurrentUser, JwtPayload } from '../../../common/decorators/current-user.decorator';

@ApiTags('pipelines')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Workspace-Id', required: true })
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Controller('pipelines')
export class PipelinesController {
  constructor(private readonly pipelinesService: PipelinesService) {}

  @Get()
  findAll(@Headers('x-workspace-id') workspaceId: string) {
    return this.pipelinesService.findAll(workspaceId);
  }

  @Post()
  create(
    @Headers('x-workspace-id') workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreatePipelineDto,
  ) {
    return this.pipelinesService.create(workspaceId, user.sub, dto);
  }

  @Get(':id')
  findOne(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.pipelinesService.findOne(workspaceId, id);
  }

  @Patch(':id')
  update(
    @Headers('x-workspace-id') workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdatePipelineDto,
  ) {
    return this.pipelinesService.update(workspaceId, user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(
    @Headers('x-workspace-id') workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.pipelinesService.remove(workspaceId, user.sub, id);
  }

  @Post(':id/stages')
  addStage(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: CreateStageDto,
  ) {
    return this.pipelinesService.addStage(workspaceId, id, dto);
  }

  @Patch(':id/stages/reorder')
  reorderStages(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: ReorderStagesDto,
  ) {
    return this.pipelinesService.reorderStages(workspaceId, id, dto);
  }

  @Patch(':id/stages/:stageId')
  updateStage(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @Param('stageId') stageId: string,
    @Body() dto: UpdateStageDto,
  ) {
    return this.pipelinesService.updateStage(workspaceId, id, stageId, dto);
  }

  @Delete(':id/stages/:stageId')
  @HttpCode(HttpStatus.OK)
  deleteStage(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @Param('stageId') stageId: string,
  ) {
    return this.pipelinesService.deleteStage(workspaceId, id, stageId);
  }
}
