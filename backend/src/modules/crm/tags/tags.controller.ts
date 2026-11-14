// Controller de Tags
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
import { TagsService } from './tags.service';
import { CreateTagDto, UpdateTagDto, TagQueryDto } from './tags.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../../common/guards/workspace.guard';
import { Access, ALL, STAFF, FINANCE_AREA, FINANCE_CONFIG, MANAGEMENT, ADMIN_ONLY } from '../../../common/access/access';

@ApiTags('tags')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Workspace-Id', required: true })
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Access(...ALL)
@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  findAll(
    @Headers('x-workspace-id') workspaceId: string,
    @Query() query: TagQueryDto,
  ) {
    return this.tagsService.findAll(workspaceId, query);
  }

  @Post()
  create(
    @Headers('x-workspace-id') workspaceId: string,
    @Body() dto: CreateTagDto,
  ) {
    return this.tagsService.create(workspaceId, dto);
  }

  @Patch(':id')
  update(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTagDto,
  ) {
    return this.tagsService.update(workspaceId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.tagsService.remove(workspaceId, id);
  }
}
