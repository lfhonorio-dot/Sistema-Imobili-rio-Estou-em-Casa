// Controller de Negócios (Deals) - rotas REST
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
import { DealsService } from './deals.service';
import {
  CreateDealDto,
  UpdateDealDto,
  MoveStageDealDto,
  DealQueryDto,
  AddDealTagDto,
} from './deals.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../../common/guards/workspace.guard';
import { CurrentUser, JwtPayload } from '../../../common/decorators/current-user.decorator';

@ApiTags('deals')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Workspace-Id', required: true })
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Controller('deals')
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

  @Get()
  findAll(
    @Headers('x-workspace-id') workspaceId: string,
    @Query() query: DealQueryDto,
  ) {
    return this.dealsService.findAll(workspaceId, query);
  }

  @Post()
  create(
    @Headers('x-workspace-id') workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateDealDto,
  ) {
    return this.dealsService.create(workspaceId, user.sub, dto);
  }

  @Get(':id')
  findOne(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.dealsService.findOne(workspaceId, id);
  }

  @Patch(':id')
  update(
    @Headers('x-workspace-id') workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateDealDto,
  ) {
    return this.dealsService.update(workspaceId, user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(
    @Headers('x-workspace-id') workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.dealsService.remove(workspaceId, user.sub, id);
  }

  @Patch(':id/stage')
  moveStage(
    @Headers('x-workspace-id') workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: MoveStageDealDto,
  ) {
    return this.dealsService.moveStage(workspaceId, user.sub, id, dto);
  }

  @Post(':id/tags')
  addTag(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: AddDealTagDto,
  ) {
    return this.dealsService.addTag(workspaceId, id, dto.tagId);
  }

  @Delete(':id/tags/:tagId')
  @HttpCode(HttpStatus.OK)
  removeTag(
    @Headers('x-workspace-id') workspaceId: string,
    @Param('id') id: string,
    @Param('tagId') tagId: string,
  ) {
    return this.dealsService.removeTag(workspaceId, id, tagId);
  }
}
