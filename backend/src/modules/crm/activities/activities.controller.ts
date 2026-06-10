// Controller de Atividades - rotas REST
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { ActivitiesService } from './activities.service';
import {
  CreateActivityDto,
  UpdateActivityDto,
  ActivityQueryDto,
  CalendarQueryDto,
} from './activities.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../../common/guards/workspace.guard';
import { CurrentUser, JwtPayload } from '../../../common/decorators/current-user.decorator';

@ApiTags('activities')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Workspace-Id', required: true })
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  findAll(
    @Headers('x-workspace-id') workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: ActivityQueryDto,
  ) {
    return this.activitiesService.findAll(workspaceId, user.sub, query);
  }

  @Get('calendar')
  getCalendar(
    @Headers('x-workspace-id') workspaceId: string,
    @Query() query: CalendarQueryDto,
  ) {
    return this.activitiesService.getCalendar(workspaceId, query);
  }

  @Get('today')
  getToday(@Headers('x-workspace-id') workspaceId: string) {
    return this.activitiesService.getToday(workspaceId);
  }

  @Get(':id')
  findOne(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.activitiesService.findOne(workspaceId, id);
  }

  @Post()
  create(
    @Headers('x-workspace-id') workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateActivityDto,
  ) {
    return this.activitiesService.create(workspaceId, user.sub, dto);
  }

  @Patch(':id')
  update(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateActivityDto,
  ) {
    return this.activitiesService.update(workspaceId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.activitiesService.remove(workspaceId, id);
  }

  @Patch(':id/done')
  markDone(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.activitiesService.markDone(workspaceId, id);
  }
}
